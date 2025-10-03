import { PotoModule } from "../server/PotoModule";
import { LLM } from "./llm";
import { LLMConfig } from "./LLMConfig";
import { UserSessionData } from "../server/UserSessionProvider";

// Model information interface
export interface ModelInfo {
    name: string;
    model: string;
    isDefault: boolean;
}

// Extend base session data with LLM-specific fields
export interface LLMSessionData extends UserSessionData {
	currentModelName: string;
}

/**
 * Specialized base class for modules that need LLM functionality
 * Provides clean access to cancellation-aware LLM instances
 * Extends the general PotoModule with LLM-specific capabilities
 * Adds LLM-specific session management (model preferences)
 */
export class LLMPotoModule extends PotoModule {
	/**
	 * Ensure LLMConfig is loaded before using it
	 */
	private static ensureLLMConfigLoaded(): void {
		if (!LLMConfig.isLoaded()) {
			LLMConfig.loadConfigs();
		}
	}

	/**
	 * Override to add LLM-specific fields to session data
	 */
	protected createDefaultSessionData(userId: string): LLMSessionData {
		LLMPotoModule.ensureLLMConfigLoaded();
		return {
			...super.createDefaultSessionData(userId),
			currentModelName: LLMConfig.getDefaultConfigName()
		};
	}

	/**
	 * Update user's current model preference
	 */
	protected async updateUserModel(modelName: string): Promise<void> {
		await this.updateUserSession((session) => {
			(session as LLMSessionData).currentModelName = modelName;
		});
	}

	/**
	 * Get user's current model preference
	 */
	protected async getUserModel(): Promise<string> {
		LLMPotoModule.ensureLLMConfigLoaded();
		const session = await this.getUserSession() as LLMSessionData;
		return session.currentModelName || LLMConfig.getDefaultConfigName();
	}
	
	/**
	 * Get a cancellation-aware LLM instance with user-specific model preferences
	 * This LLM will be automatically cancelled if the client disconnects
	 * Uses the user's session data to determine model configuration
	 * @returns LLM instance with automatic cancellation support and user preferences
	 */
	protected async getUserPreferredLLM(): Promise<LLM> {
		LLMPotoModule.ensureLLMConfigLoaded();
		const context = await super.getRequestContext();
		const userModelName = await this.getUserModel();
		const defaultConfigName = LLMConfig.getDefaultConfigName();
		
		let llm: LLM;
		if (userModelName === defaultConfigName) {
			// Use the default configuration
			const defaultConfig = LLMConfig.getDefaultConfig();
			llm = await this.getLLMWithConfig(defaultConfig.model, defaultConfig.apiKey, defaultConfig.endPoint);
		} else {
			const config = LLMConfig.getConfig(userModelName);
			if (config) {
				llm = await this.getLLMWithConfig(config.model, config.apiKey, config.endPoint);
			} else {
				// Fallback to default
				const defaultConfig = LLMConfig.getDefaultConfig();
				llm = await this.getLLMWithConfig(defaultConfig.model, defaultConfig.apiKey, defaultConfig.endPoint);
			}
		}
		
		// Allow subclasses to customize LLM configuration
		await this.configureLLM(llm);
		
		if (context?.abortSignal) {
			// Pre-configure the LLM with the request's abort signal
			(llm as any)._requestAbortSignal = context.abortSignal;
		}
		
		return llm;
	}

	/**
	 * Hook for subclasses to customize LLM configuration
	 * Called after LLM is created but before it's returned
	 */
	protected async configureLLM(llm: LLM): Promise<void> {
		// Default implementation does nothing
		// Subclasses can override to set prompt limits, etc.
	}

	/**
	 * Get a cancellation-aware LLM instance with custom configuration.
	 * @param model - The model name to use.
	 * @param apiKey - The API key for the LLM provider.
	 * @param endPoint - The endpoint URL for the LLM provider.
	 * @returns LLM instance with the specified configuration and automatic cancellation support.
	 */
	protected async getLLMWithConfig(model: string, apiKey: string, endPoint: string): Promise<LLM> {
		const context = await super.getRequestContext();
		const llm = new LLM(model, apiKey, endPoint);

		if (context?.abortSignal) {
			// Pre-configure the LLM with the request's abort signal
			(llm as any)._requestAbortSignal = context.abortSignal;
		}

		return llm;
	}

	/**
	 * Create multiple LLM instances for the same request
	 * All instances will share the same cancellation behavior
	 * @param count Number of LLM instances to create
	 * @returns Array of cancellation-aware LLM instances
	 */
	protected async createLLMPool(count: number): Promise<LLM[]> {
		const llms = [];
		for (let i = 0; i < count; i++) {
			llms.push(await this.getUserPreferredLLM());
		}
		return llms;
	}

	/**
	 * Execute an LLM operation with automatic retry on non-cancellation errors
	 * Will not retry if the error is due to client cancellation
	 * @param operation Function that returns a Promise with LLM operation
	 * @param maxRetries Maximum number of retries (default: 2)
	 * @returns Promise with operation result
	 */
	protected async withLLMRetry<T>(
		operation: () => Promise<T>, 
		maxRetries: number = 2
	): Promise<T> {
		let lastError: Error;
		
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error as Error;
				
				// Don't retry if request was cancelled
				if (await this.isRequestCancelled() || lastError.name === 'AbortError') {
					throw lastError;
				}
				
				// Don't retry on the last attempt
				if (attempt === maxRetries) {
					throw lastError;
				}
				
				// Optional: Add exponential backoff
				await new Promise(resolve => 
					setTimeout(resolve, Math.pow(2, attempt) * 100)
				);
			}
		}
		
		throw lastError!;
	}

	/**
	 * Execute multiple LLM operations concurrently
	 * All operations will be cancelled if the client disconnects
	 * @param operations Array of functions that return LLM operation Promises
	 * @returns Promise that resolves to array of results
	 */
	protected async executeLLMConcurrently<T>(
		operations: (() => Promise<T>)[]
	): Promise<T[]> {
		// Check for cancellation before starting
		if (await this.isRequestCancelled()) {
			throw new Error('Request already cancelled');
		}

		// Execute all operations concurrently
		// They will all be automatically cancelled together if client disconnects
		return Promise.all(operations.map(op => op()));
	}

	/**
	 * Get current model information
	 */
	async getCurrentModel(): Promise<ModelInfo> {
		LLMPotoModule.ensureLLMConfigLoaded();
		const userModelName = await this.getUserModel();
		const defaultConfigName = LLMConfig.getDefaultConfigName();
		
		if (userModelName === defaultConfigName) {
			const defaultConfig = LLMConfig.getDefaultConfig();
			return {
				name: userModelName,
				model: defaultConfig.model,
				isDefault: true
			};
		}

		const config = LLMConfig.getConfig(userModelName);
		if (config) {
			return {
				name: userModelName,
				model: config.model,
				isDefault: false
			};
		}

		// Fallback to default if config not found
		const defaultConfig = LLMConfig.getDefaultConfig();
		return {
			name: defaultConfigName,
			model: defaultConfig.model,
			isDefault: true
		};
	}

	/**
	 * Get all available models
	 */
	async getAvailableModels(): Promise<ModelInfo[]> {
		LLMPotoModule.ensureLLMConfigLoaded();
		const models: ModelInfo[] = [];
		const defaultConfigName = LLMConfig.getDefaultConfigName();
		
		// Add all configured models
		const configs = LLMConfig.getAllConfigs();
		for (const [name, config] of configs) {
			if (LLMConfig.isValidConfig(config)) {
				models.push({
					name: name,
					model: config.model,
					isDefault: name === defaultConfigName
				});
			}
		}

		return models;
	}

	/**
	 * Set the current model for this user's session
	 */
	async postModel(modelName: string): Promise<boolean> {
		LLMPotoModule.ensureLLMConfigLoaded();
		const defaultConfigName = LLMConfig.getDefaultConfigName();
		
		if (modelName === 'default' || modelName === defaultConfigName) {
			await this.updateUserModel(defaultConfigName);
			return true;
		}

		const config = LLMConfig.getConfig(modelName);
		if (config && LLMConfig.isValidConfig(config)) {
			await this.updateUserModel(modelName);
			return true;
		}

		return false;
	}

	/**
	 * Generic method for LLM interactions with conversation history
	 * This method handles the core LLM setup, history loading, and streaming
	 * Subclasses can override to add their own storage/retrieval logic
	 * @param message Current user message
	 * @param history Array of previous conversation messages
	 * @param options Configuration options for the LLM interaction
	 * @returns AsyncGenerator that yields streaming text responses
	 */
	protected async *streamLLMWithHistory(
		message: string,
		history: Array<{ role: 'user' | 'assistant'; content: string }>,
		options: {
			jsonOutput?: boolean;
			reasoningEnabled?: boolean;
			systemPrompt?: string;
		} = {}
	): AsyncGenerator<string> {
		try {
			// Get cancellation-aware LLM instance with user-specific model from session
			const llm = await this.getUserPreferredLLM();
			llm.clearFormat();
			
			// Set JSON output format if requested
			if (options.jsonOutput) {
				llm.responseFormat = 'json_object';
			}
			
			// Set reasoning enabled/disabled
			llm.setReasoningEnabled(options.reasoningEnabled || false);
			
			// Set system prompt based on output mode
			if (options.systemPrompt) {
				llm.system(options.systemPrompt);
			} else if (options.jsonOutput) {
				llm.system("You are a helpful AI assistant. Always respond with valid JSON format. Structure your responses as JSON objects with appropriate fields. Maintain conversation context and provide relevant responses.");
			} else {
				llm.system("You are a helpful AI assistant. Maintain conversation context and provide relevant responses.");
			}

			// Load conversation history into LLM context
			for (const msg of history) {
				if (msg.role === 'user') {
					llm.user(msg.content);
				} else {
					llm.assistant(msg.content);
				}
			}

			// Add current message
			llm.user(message);

			// Stream the response
			for await (const text of await llm.requestCompletionTextGenerator_()) {
				yield text;
			}
		} catch (error) {
			const err = error as Error;
			yield `Error: ${err.message}`;
		}
	}

}
