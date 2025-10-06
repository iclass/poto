import { PotoModule } from "../server/PotoModule";
import { LLM } from "./llm";
import { LLMConfig } from "./LLMConfig";
import { UserSessionData } from "../server/UserSessionProvider";
import { DialogueJournal, ChatMessage } from "../server/DialogueJournal";
import { PotoUser } from "../server/UserProvider";
import { DialogueJournalFactory } from "../server/DialogueJournalFactory";
import { SimpleStreamPacket } from "../shared/SimpleStreamPacket";
import { roles } from "src/server/serverDecorators";
import * as path from "path";
import * as fs from "fs/promises";

// Model information interface
export interface ModelInfo {
    name: string;
    model: string;
    isDefault: boolean;
}

// Extend base session data with LLM-specific fields
export interface LLMSessionData extends UserSessionData {
	currentModelName: string;
	systemPrompt?: string;
	sessionId?: string;
}

// User session info for activity tracking
export interface UserSessionInfo {
	lastActivity: Date;
	isActive: boolean;
	sessionId: string;
}

// Options for LLMPotoModule initialization
export interface LLMPotoModuleOptions {
	dialogueJournal?: DialogueJournal;
	enableSessionMonitoring?: boolean;
	sessionTimeoutMs?: number;
	checkIntervalMs?: number;
	// Disable automatic dialogue journal creation from config (enabled by default)
	createDialogueJournalFromConfig?: boolean;
}

/**
 * Specialized base class for modules that need LLM functionality
 * Provides clean access to cancellation-aware LLM instances
 * Extends the general PotoModule with LLM-specific capabilities
 * Adds LLM-specific session management (model preferences)
 * Optional dialogue journal integration and session monitoring
 */
export class LLMPotoModule extends PotoModule {
	// Optional dialogue journal for conversation persistence
	protected dialogueJournal?: DialogueJournal;
	
	// Optional session monitoring for user activity tracking
	protected userSessions = new Map<string, UserSessionInfo>();
	protected enableSessionMonitoring: boolean = false;
	protected sessionTimeoutMs: number = 5 * 60 * 1000; // 5 minutes
	protected checkIntervalMs: number = 30 * 1000; // 30 seconds
	protected sessionMonitoringInterval?: NodeJS.Timeout;

	constructor(options?: LLMPotoModuleOptions) {
		super();
		
		// Load configuration from config file
		const config = this.loadConfig();
		
		// Handle dialogue journal creation
		if (options?.dialogueJournal) {
			// Use provided dialogue journal
			this.dialogueJournal = options.dialogueJournal;
		} else if (options?.createDialogueJournalFromConfig !== false) {
			// Create dialogue journal from configuration by default
			// Only skip if explicitly set to false
			this.dialogueJournal = this.createDialogueJournalFromConfig();
		}
		
		// Use config values with option overrides
		this.enableSessionMonitoring = options?.enableSessionMonitoring ?? config.sessionMonitoring?.enabled ?? false;
		this.sessionTimeoutMs = options?.sessionTimeoutMs ?? config.sessionMonitoring?.timeoutMs ?? 5 * 60 * 1000;
		this.checkIntervalMs = options?.checkIntervalMs ?? config.sessionMonitoring?.checkIntervalMs ?? 30 * 1000;
		
		if (this.enableSessionMonitoring) {
			this.startSessionMonitoring();
		}
	}

	/**
	 * Ensure LLMConfig is loaded before using it
	 */
	private static ensureLLMConfigLoaded(): void {
		if (!LLMConfig.isLoaded()) {
			LLMConfig.loadConfigs();
		}
	}

	/**
	 * Load configuration from config file
	 */
	private loadConfig(): any {
		try {
			// Try to load YAML configuration
			return require('../../poto.config.yaml');
		} catch (error) {
			// Return empty config if file not found
			return {};
		}
	}

	/**
	 * Create dialogue journal from configuration file
	 */
	private createDialogueJournalFromConfig(): DialogueJournal {
		try {
			// Try to load YAML configuration
			const config = this.loadConfig();
			return DialogueJournalFactory.createFromConfig(config);
		} catch (error) {
			// Fallback to environment variables
			return DialogueJournalFactory.createFromEnv();
		}
	}

	/**
	 * Override to ensure sessionId is always present in LLM sessions
	 */
	protected async getUserSession(): Promise<LLMSessionData> {
		const session = await super.getUserSession() as LLMSessionData;
		
		// If session doesn't have a sessionId, create one
		if (!session.sessionId) {
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
			const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
			const randomSuffix = Math.random().toString(36).substr(2, 2); // 2 random chars
			session.sessionId = `session-${dateStr}-${timeStr}-${randomSuffix}`;
			
			// Save the updated session with sessionId
			const user = await this.getCurrentUser();
			if (user) {
				await this.sessionProvider.setSession(user.id, session);
			}
		}
		
		return session;
	}

	/**
	 * Override to add LLM-specific fields to session data
	 */
	protected createDefaultSessionData(userId: string): LLMSessionData {
		LLMPotoModule.ensureLLMConfigLoaded();
		
		// Generate a unique session ID for all new sessions
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
		const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
		const randomSuffix = Math.random().toString(36).substr(2, 2); // 2 random chars
		const sessionId = `session-${dateStr}-${timeStr}-${randomSuffix}`;
		
		return {
			...super.createDefaultSessionData(userId),
			currentModelName: LLMConfig.getDefaultConfigName(),
			sessionId: sessionId
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
		history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
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
			
			// Set system prompt only if explicitly provided
			if (options.systemPrompt) {
				llm.system(options.systemPrompt);
			}

			// Load conversation history into LLM context
			for (const msg of history) {
				if (msg.role === 'user') {
					llm.user(msg.content);
				} else if (msg.role === 'assistant') {
					llm.assistant(msg.content);
				} else if (msg.role === 'system') {
					llm.system(msg.content);
				}
			}

			// Add current message
			llm.user(message);

			// Stream the response
			for await (const text of await llm.requestCompletionTextGenerator_(3000)) {
				yield text;
			}
		} catch (error) {
			const err = error as Error;
			yield `Error: ${err.message}`;
		}
	}

	/**
	 * Enhanced LLM streaming with metadata capture
	 */
	protected async *streamLLMWithMetadata(
		message: string,
		history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
		options: {
			jsonOutput?: boolean;
			reasoningEnabled?: boolean;
			systemPrompt?: string;
		} = {}
	): AsyncGenerator<{ content: string; metadata?: any; finalMetadata?: any }> {
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
			
			// Set system prompt only if explicitly provided
			if (options.systemPrompt) {
				llm.system(options.systemPrompt);
			}

			// Load conversation history into LLM context
			for (const msg of history) {
				if (msg.role === 'user') {
					llm.user(msg.content);
				} else if (msg.role === 'assistant') {
					llm.assistant(msg.content);
				} else if (msg.role === 'system') {
					llm.system(msg.content);
				}
			}

			// Add current message
			llm.user(message);

			// Stream the response and capture metadata
			const stream = await llm.requestCompletionStream_(3000);
			const reader = stream.getReader();
			let tokenUsage: any = null;
			let finishReason = 'unknown';
			let responseId = '';
			let systemFingerprint: string | null = null;
			
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = value as any;
					const content = chunk.getContent();
					
					// Capture metadata from any chunk that has it
					if (chunk.usage) {
						tokenUsage = chunk.usage;
					}
					if (chunk.id) {
						responseId = chunk.id;
					}
					if (chunk.systemFingerprint) {
						systemFingerprint = chunk.systemFingerprint;
					}
					
					// Capture metadata from final chunk
					if (chunk.isDone && chunk.isDone()) {
						finishReason = chunk.getFinishReason() || 'unknown';
						
						// Final chance to capture usage if not already captured
						if (chunk.usage && !tokenUsage) {
							tokenUsage = chunk.usage;
						}
					}
					
					if (content) {
						yield { 
							content,
							metadata: {
								tokenUsage,
								finishReason,
								responseId,
								systemFingerprint
							}
						};
					}
				}
			} finally {
				reader.releaseLock();
				
				// Return final metadata with captured token usage
				yield {
					content: '',
					finalMetadata: {
						tokenUsage,
						finishReason,
						responseId,
						systemFingerprint
					}
				};
			}
		} catch (error) {
			const err = error as Error;
			yield { 
				content: `Error: ${err.message}`,
				metadata: {
					error: err.message
				}
			};
		}
	}

	/**
	 * Enhanced LLM streaming with SimpleStreamPacket support
	 * This method provides unified handling of both thinking and content channels
	 * Returns SimpleStreamPacket objects that can be easily consumed by frontend
	 */
	protected async *streamLLMWithSimplePackets(
		message: string,
		history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
		options: {
			jsonOutput?: boolean;
			reasoningEnabled?: boolean;
			systemPrompt?: string;
		} = {}
	): AsyncGenerator<SimpleStreamPacket> {
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
			
			// Set system prompt only if explicitly provided
			if (options.systemPrompt) {
				llm.system(options.systemPrompt);
			}

			// Load conversation history into LLM context
			for (const msg of history) {
				if (msg.role === 'user') {
					llm.user(msg.content);
				} else if (msg.role === 'assistant') {
					llm.assistant(msg.content);
				} else if (msg.role === 'system') {
					llm.system(msg.content);
				}
			}

			// Add current message
			llm.user(message);

			// Stream the response and convert to StreamPackets
			const stream = await llm.requestCompletionStream_(3000);
			const reader = stream.getReader();
			
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					// Convert StreamingChunk to StreamPacket
					const packet = value.toStreamPacket();
					
					// Capture token usage from the chunk if available
					if (value.usage) {
						// Update the LLM instance's session usage
						llm.sessionUsage.add(value.usage);
					}
					
					// Only yield packets that have content
					if (packet.hasContent()) {
						yield packet;
					}
				}
			} finally {
				reader.releaseLock();
			}
		} catch (error) {
			const err = error as Error;
			// Return error as a SimpleStreamPacket
			yield new SimpleStreamPacket('error', '', `Error: ${err.message}`);
		}
	}

	    /**
     * Simple streaming chat - returns text content directly
     * Perfect for CLI applications
     */
	public async *postChat(message: string, systemPrompt?: string): AsyncGenerator<string> {
	
		try {
			// Get cancellation-aware LLM instance
			const llm = await this.getUserPreferredLLM();
			llm.clearFormat();

			// Set system prompt only if provided
			if (systemPrompt) {
				llm.system(systemPrompt);
			}

			llm.user(message);

			// Use the text-only generator for clean streaming
			for await (const text of await llm.requestCompletionTextGenerator_()) {
				yield text;
			}
		} catch (error) {
			const err = error as Error;
			yield `Error: ${err.message}`;
		}
	}
	
	
	/**
	 * Enhanced chat with SimpleStreamPacket support for reasoning display
	 * This method provides both content and reasoning streams to the frontend
	 */
	public async *chatWithReasoning(
		message: string, 
		options: {
			jsonOutput?: boolean;
			reasoningEnabled?: boolean;
			systemPrompt?: string;
		} = {}
	): AsyncGenerator<SimpleStreamPacket> {
		const startTime = Date.now();
		let firstTokenTime: number | null = null;
		
		try {
			// Get current user
			const user = await this.getCurrentUser();
			if (!user) {
				yield new SimpleStreamPacket('error', '', 'User not authenticated');
				return;
			}
			
			// Update user activity if session monitoring is enabled
			if (this.enableSessionMonitoring) {
				this.updateUserActivity(user.id);
			}
			
			// Get session ID from session data
			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			
			// Load conversation history from dialogue journal or use empty array
			const history = this.dialogueJournal 
				? await this.dialogueJournal.getConversation(user, sessionId)
				: [];
			
			// Use the new SimpleStreamPacket streaming method
			let aiResponse = '';
			let aiReasoning = '';
			
			for await (const packet of this.streamLLMWithSimplePackets(message, history, {
				jsonOutput: options.jsonOutput,
				reasoningEnabled: options.reasoningEnabled,
				systemPrompt: options.systemPrompt
			})) {
				if (firstTokenTime === null) {
					firstTokenTime = Date.now();
				}
				
				// Accumulate content and reasoning
				aiResponse += packet.content;
				aiReasoning += packet.reasoning;
				
				// Yield the packet to the frontend
				yield packet;
			}
			
			// Add both user message and AI response to dialogue journal if available
			if (this.dialogueJournal) {
				// Add user message first
				await this.dialogueJournal.addMessage(user, { 
					role: 'user', 
					content: message,
					timestamp: new Date().toISOString()
				}, sessionId);
				
				// Add AI response with enhanced metadata if we have content
				if (aiResponse.trim()) {
					// Calculate performance metrics
					const processingTime = Date.now() - startTime;
					const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : 0;
					
					await this.dialogueJournal.addMessage(user, { 
						role: 'assistant', 
						content: aiResponse,
						timestamp: new Date().toISOString(),
						metadata: {
							reasoning: aiReasoning,
							performance: {
								processingTimeMs: processingTime,
								firstTokenLatencyMs: firstTokenLatency,
								tokensPerSecond: 0 // SimpleStreamPacket doesn't provide token usage
							}
						}
				}, sessionId);

				// Trigger topic summarization in background
				this.triggerTopicSummarization().catch(error => {
					console.error('Background topic summarization failed:', error);
					});
				}
			}
		} catch (error) {
			const err = error as Error;
			yield new SimpleStreamPacket('error', '', `Error: ${err.message}`);
		}
	}

	/**
	 * Generic chat with conversation history and optional dialogue journal integration
	 * This method handles the core chat functionality with metadata capture and persistence
	 */
	public async *chatWithHistory(
		message: string, 
		options: {
			jsonOutput?: boolean;
			reasoningEnabled?: boolean;
			systemPrompt?: string;
			enableMetadata?: boolean;
		} = {}
	): AsyncGenerator<string> {
		const startTime = Date.now();
		let firstTokenTime: number | null = null;
		let tokenUsage: any = null;
		let finishReason = 'unknown';
		let responseId = '';
		let systemFingerprint: string | null = null;
		let llmModel = '';
		let llmConfig: any = null;
		
		try {
			// Get current user
			const user = await this.getCurrentUser();
			if (!user) {
				yield `Error: User not authenticated`;
				return;
			}
			
			// Update user activity if session monitoring is enabled
			if (this.enableSessionMonitoring) {
				this.updateUserActivity(user.id);
			}
			
			// Get session ID from session data
			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			
			// Add user message to dialogue journal if available
			if (this.dialogueJournal) {
				await this.dialogueJournal.addMessage(user, { 
					role: 'user', 
					content: message,
					timestamp: new Date().toISOString()
				}, sessionId);
			}
			
			// Load conversation history from dialogue journal or use empty array
			const history = this.dialogueJournal 
				? await this.dialogueJournal.getConversation(user, sessionId)
				: [];
			
			// Get LLM instance to capture configuration
			const llm = await this.getUserPreferredLLM();
			llmModel = llm.model;
			llmConfig = {
				temperature: llm.temperature,
				maxTokens: llm.max_tokens,
				reasoningEnabled: llm.reasoningEnabled
			};
			
			// Use enhanced streaming method to capture metadata if enabled
			let aiResponse = '';
			if (options.enableMetadata !== false) {
				const streamingResult = await this.streamLLMWithMetadata(message, history, {
					jsonOutput: options.jsonOutput,
					reasoningEnabled: options.reasoningEnabled,
					systemPrompt: options.systemPrompt
				});
				
				for await (const result of streamingResult) {
					if (firstTokenTime === null) {
						firstTokenTime = Date.now();
					}
					aiResponse += result.content;
					yield result.content;
					
					// Capture metadata from streaming result
					if (result.metadata) {
						if (result.metadata.tokenUsage) {
							tokenUsage = result.metadata.tokenUsage;
						}
						finishReason = result.metadata.finishReason || 'unknown';
						responseId = result.metadata.responseId || '';
					}
					
					// Capture final metadata
					if (result.finalMetadata) {
						tokenUsage = result.finalMetadata.tokenUsage;
						finishReason = result.finalMetadata.finishReason || 'unknown';
						responseId = result.finalMetadata.responseId || '';
						systemFingerprint = result.finalMetadata.systemFingerprint;
					}
				}
			} else {
				// Use simple streaming without metadata capture
				for await (const text of this.streamLLMWithHistory(message, history, {
					jsonOutput: options.jsonOutput,
					reasoningEnabled: options.reasoningEnabled,
					systemPrompt: options.systemPrompt
				})) {
					if (firstTokenTime === null) {
						firstTokenTime = Date.now();
					}
					aiResponse += text;
					yield text;
				}
			}
			
			// Add AI response to dialogue journal with enhanced metadata if available
			if (this.dialogueJournal && aiResponse.trim()) {
				// Calculate performance metrics
				const processingTime = Date.now() - startTime;
				const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : 0;
				const tokensPerSecond = tokenUsage ? (tokenUsage.total_tokens / (processingTime / 1000)) : 0;
				
				await this.dialogueJournal.addMessage(user, { 
					role: 'assistant', 
					content: aiResponse,
					timestamp: new Date().toISOString(),
					metadata: {
						model: llmModel,
						tokens: tokenUsage ? {
							prompt: tokenUsage.prompt_tokens || 0,
							completion: tokenUsage.completion_tokens || 0,
							total: tokenUsage.total_tokens || 0,
							input: tokenUsage.input_tokens || 0,
							output: tokenUsage.output_tokens || 0,
							cached: tokenUsage.cached_input_tokens || 0
						} : null,
						performance: {
							processingTimeMs: processingTime,
							firstTokenLatencyMs: firstTokenLatency,
							tokensPerSecond: Math.round(tokensPerSecond)
						},
						config: llmConfig,
						response: {
							finishReason,
							responseId: responseId || `resp_${Date.now()}`
						}
					}
				}, sessionId);

				// Trigger topic summarization in background
				this.triggerTopicSummarization().catch(error => {
					console.error('Background topic summarization failed:', error);
				});
			}
		} catch (error) {
			const err = error as Error;
			yield `Error: ${err.message}`;
		}
	}

	// Session Management Methods

	/**
	 * Start a new user session
	 */
	protected startUserSession(userId: string, sessionId: string): void {
		this.userSessions.set(userId, {
			lastActivity: new Date(),
			isActive: true,
			sessionId
		});
		console.log(`📱 User ${userId} started session ${sessionId}`);
	}

	/**
	 * Update user activity timestamp
	 */
	protected updateUserActivity(userId: string): void {
		const session = this.userSessions.get(userId);
		if (session) {
			session.lastActivity = new Date();
		}
	}

	/**
	 * End user session
	 */
	protected async endUserSession(userId: string): Promise<void> {
		const session = this.userSessions.get(userId);
		if (session && session.isActive) {
			session.isActive = false;
			console.log(`📱 User ${userId} session ended`);
			
			// Remove from active sessions
			this.userSessions.delete(userId);
		}
	}

	/**
	 * Start session monitoring to detect inactive users
	 */
	private startSessionMonitoring(): void {
		if (this.sessionMonitoringInterval) {
			clearInterval(this.sessionMonitoringInterval);
		}
		
		this.sessionMonitoringInterval = setInterval(async () => {
			const now = new Date();
			const inactiveUsers: string[] = [];
			
			for (const [userId, session] of this.userSessions) {
				if (session.isActive && (now.getTime() - session.lastActivity.getTime()) > this.sessionTimeoutMs) {
					inactiveUsers.push(userId);
				}
			}
			
			// End sessions for inactive users
			for (const userId of inactiveUsers) {
				console.log(`⏰ User ${userId} inactive for ${this.sessionTimeoutMs / 1000}s, ending session`);
				await this.endUserSession(userId);
			}
		}, this.checkIntervalMs);
		
		console.log('🔄 Session monitoring started');
	}

	/**
	 * Stop session monitoring
	 */
	protected stopSessionMonitoring(): void {
		if (this.sessionMonitoringInterval) {
			clearInterval(this.sessionMonitoringInterval);
			this.sessionMonitoringInterval = undefined;
		}
	}

	/**
	 * Get active session count
	 */
	protected getActiveSessionCount(): number {
		return Array.from(this.userSessions.values()).filter(s => s.isActive).length;
	}

	/**
	 * Get session info for a user
	 */
	protected getUserSessionInfo(userId: string): UserSessionInfo | null {
		return this.userSessions.get(userId) || null;
	}


	/**
	 * Get user's conversation history
	 */
	async getConversationHistory(): Promise<ChatMessage[]> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				return [];
			}
			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			return this.dialogueJournal ? await this.dialogueJournal.getConversation(user, sessionId) : [];
		} catch (error) {
			return [];
		}
	}

	/**
	 * Get conversation statistics for current user
	 */
	async getConversationStats(): Promise<{
		messageCount: number;
		lastMessageTime?: string;
		firstMessageTime?: string;
		userMessageCount: number;
		assistantMessageCount: number;
	}> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				return {
					messageCount: 0,
					userMessageCount: 0,
					assistantMessageCount: 0
				};
			}
			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			return this.dialogueJournal ? await this.dialogueJournal.getConversationSummary(user, sessionId) : {
				messageCount: 0,
				userMessageCount: 0,
				assistantMessageCount: 0
			};
		} catch (error) {
			return {
				messageCount: 0,
				userMessageCount: 0,
				assistantMessageCount: 0
			};
		}
	}

	/**
	 * Get dialogue journal statistics (admin function)
	 */
	@roles('admin')
	public async getDialogueJournalStats(): Promise<{
		totalUsers: number;
		totalMessages: number;
		averageMessagesPerUser: number;
		memoryUsage: number;
	}> {
		const stats = this.dialogueJournal ? await this.dialogueJournal.getStats() : {
			totalUsers: 0,
			totalMessages: 0,
			averageMessagesPerUser: 0,
			storageUsage: 0
		};
		return {
			totalUsers: stats.totalUsers,
			totalMessages: stats.totalMessages,
			averageMessagesPerUser: stats.averageMessagesPerUser,
			memoryUsage: stats.storageUsage
		};
	}

	/**
	 * Get recent messages from user's conversation
	 */
	@roles('user')
	public async getRecentMessages(count: number = 10): Promise<ChatMessage[]> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				return [];
			}
			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			return this.dialogueJournal ? await this.dialogueJournal.getRecentMessages(user, count, sessionId) : [];
		} catch (error) {
			return [];
		}
	}

	/**
	 * Perform manual cleanup of old conversations
	 */
	@roles('admin')
	public async performCleanup(options: {
		maxAgeHours?: number;
		maxInactiveHours?: number;
		dryRun?: boolean;
	} = {}): Promise<{
		usersRemoved: number;
		messagesRemoved: number;
		memoryFreed: number;
	}> {
		return this.dialogueJournal ? await this.dialogueJournal.cleanup(options) : {
			usersRemoved: 0,
			messagesRemoved: 0,
			memoryFreed: 0
		};
	}


   /**
     * Public RPC method to clear current conversation
     * Exposes the clearConversation functionality to the client
     */
	@roles('user')
	public async clearCurrentConversation(): Promise<boolean> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				console.error('❌ User not authenticated for clear conversation');
				return false;
			}

			if (this.dialogueJournal) {
				const sessionData = await this.getUserSession();
				const sessionId = sessionData.sessionId;
				await this.dialogueJournal.clearConversation(user, sessionId);
				console.log(`🧹 Cleared conversation for user ${user.id}`);
				return true;
			} else {
				console.log('⚠️ No dialogue journal available for clearing conversation');
				return false;
			}
		} catch (error) {
			console.error('❌ Failed to clear conversation:', error);
			return false;
		}
	}
	
	/**
	 * Get memory usage statistics
	 */
	@roles('admin')
	public async getMemoryStats(): Promise<{
		totalUsers: number;
		totalMessages: number;
		memoryUsage: number;
		averageMessagesPerUser: number;
		oldestMessage?: string;
		newestMessage?: string;
		inactiveUsers: number;
	}> {
		const stats = this.dialogueJournal ? await this.dialogueJournal.getStats() : {
			totalUsers: 0,
			totalMessages: 0,
			averageMessagesPerUser: 0,
			storageUsage: 0,
			oldestMessage: undefined,
			newestMessage: undefined
		};
		// Note: getActiveUsers is not part of the interface, we'll need to implement this differently
		
		// Calculate inactive users (users with no recent activity)
		const now = new Date();
		const maxInactiveMs = 24 * 60 * 60 * 1000; // 24 hours
		let inactiveUsers = 0;
		let oldestMessage: string | undefined;
		let newestMessage: string | undefined;
		
		// For now, we'll use the stats from the dialogue journal
		// TODO: Implement proper active user tracking
		
		return {
			totalUsers: stats.totalUsers,
			totalMessages: stats.totalMessages,
			averageMessagesPerUser: stats.averageMessagesPerUser,
			memoryUsage: stats.storageUsage,
			oldestMessage: stats.oldestMessage,
			newestMessage: stats.newestMessage,
			inactiveUsers
		};
	}

	/**
	 * Force cleanup of old conversations (admin function)
	 */
	@roles('admin')
	async forceCleanup(maxAgeHours: number = 24, maxInactiveHours: number = 72): Promise<{
		usersRemoved: number;
		messagesRemoved: number;
		memoryFreed: number;
	}> {
		return this.dialogueJournal ? await this.dialogueJournal.cleanup({
			maxAgeHours,
			maxInactiveHours,
			dryRun: false
		}) : {
			usersRemoved: 0,
			messagesRemoved: 0,
			memoryFreed: 0
		};
	}

	/**
	 * Stop automatic cleanup (admin function)
	 */
	@roles('admin')
	public async stopAutomaticCleanup(): Promise<void> {
		// Note: This method is only available for VolatileMemoryDialogueJournal
		// For filesystem journal, cleanup is handled by the OS and scheduled tasks
		if (this.dialogueJournal && 'stopAutomaticCleanup' in this.dialogueJournal) {
			(this.dialogueJournal as any).stopAutomaticCleanup();
		}
	}

	/**
	 * Handle successful login - start a new topic/session
	 */
	async onLogin(userId: string): Promise<void> {
		console.log(`🔐 User ${userId} logged in successfully`);
		
		// Start a new topic/session for the user with human-readable ID
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
		const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
		const randomSuffix = Math.random().toString(36).substr(2, 2); // 2 random chars
		const sessionId = `login-${dateStr}-${timeStr}-${randomSuffix}`;
		this.startUserSession(userId, sessionId);
		console.log(`🆕 New topic/session started for user ${userId}: ${sessionId}`);
	}

	/**
	 * List all available topics/sessions for the current user
	 */
	@roles('user')
	public async listTopics(includeArchived: boolean = false): Promise<Array<{
		sessionId: string;
		title: string;
		lastActivity: string;
		messageCount: number;
		systemPrompt?: string;
		isArchived?: boolean;
		archivedAt?: string;
	}>> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}

			if (!this.dialogueJournal) {
				return [];
			}

			const topics: Array<{
				sessionId: string;
				title: string;
				lastActivity: string;
				messageCount: number;
				systemPrompt?: string;
				isArchived?: boolean;
				archivedAt?: string;
			}> = [];

			const sessionData = await this.getUserSession();

			// Get current active session
			if (sessionData.sessionId) {
				try {
					const conversation = await this.dialogueJournal.getConversation(user, sessionData.sessionId);
					if (conversation.length > 0) {
						const firstMessage = conversation[0];
						const lastMessage = conversation[conversation.length - 1];
						
						// Extract title from first user message or system prompt
						let title = 'Current Topic';
						if (firstMessage.role === 'system') {
							title = firstMessage.content.substring(0, 50) + (firstMessage.content.length > 50 ? '...' : '');
						} else if (firstMessage.role === 'user') {
							title = firstMessage.content.substring(0, 50) + (firstMessage.content.length > 50 ? '...' : '');
						}
						
						// Get system prompt from first system message
						const systemPrompt = conversation.find(msg => msg.role === 'system')?.content;
						
						topics.push({
							sessionId: sessionData.sessionId,
							title,
							lastActivity: lastMessage.timestamp,
							messageCount: conversation.length,
							systemPrompt,
							isArchived: false
						});
					}
		} catch (error) {
					console.warn(`Failed to get current conversation:`, error);
				}
			}

			// Include archived topics if requested
			if (includeArchived) {
				const archivedTopics = sessionData.archivedTopics || [];
				for (const archivedTopic of archivedTopics) {
					topics.push({
						sessionId: archivedTopic.sessionId,
						title: archivedTopic.title,
						lastActivity: archivedTopic.lastActivity,
						messageCount: archivedTopic.messageCount,
						isArchived: true,
						archivedAt: archivedTopic.archivedAt
					});
				}
			}

			// Sort by last activity (newest first)
			topics.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

			return topics;
		} catch (error) {
			console.error('Error listing topics:', error);
			return [];
		}
	}

	/**
	 * Switch to a different topic/session
	 */
	@roles('user')
	public async switchToTopic(sessionId: string): Promise<boolean> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}

			// Update the current session data with the new sessionId
			const sessionData = await this.getUserSession();
			sessionData.sessionId = sessionId;
			await this.sessionProvider.setSession(user.id, sessionData);

			console.log(`🔄 Switched to topic/session: ${sessionId}`);
			return true;
		} catch (error) {
			console.error('Error switching to topic:', error);
			return false;
		}
	}

	/**
	 * Create a new topic/session
	 */
	@roles('user')
	public async createNewTopic(systemPrompt?: string): Promise<string> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}

			// Generate a new session ID
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
		const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
		const randomSuffix = Math.random().toString(36).substr(2, 2); // 2 random chars
			const sessionId = `topic-${dateStr}-${timeStr}-${randomSuffix}`;

			// Update session data
			const sessionData = await this.getUserSession();
			sessionData.sessionId = sessionId;
			if (systemPrompt) {
				sessionData.systemPrompt = systemPrompt;
			}
			await this.sessionProvider.setSession(user.id, sessionData);

			// Create the new session file with system prompt if provided
			if (this.dialogueJournal && systemPrompt) {
				await this.dialogueJournal.addMessage(user, {
					role: 'system',
					content: systemPrompt,
					timestamp: new Date().toISOString(),
					metadata: {
						model: 'system',
						reasoning: 'topic_start',
						sessionId: sessionId
					}
				}, sessionId);
			}

			console.log(`🆕 Created new topic/session: ${sessionId}`);
			return sessionId;
		} catch (error) {
			console.error('Error creating new topic:', error);
			throw error;
		}
	}

	/**
	 * Helper method to parse YAML messages from file content
	 */
	private parseYamlMessages(content: string): Array<{
		role: 'user' | 'assistant' | 'system';
		content: string;
		timestamp: string;
	}> {
		try {
			// Simple YAML parsing for message extraction
			const lines = content.split('\n');
			const messages: Array<{
				role: 'user' | 'assistant' | 'system';
				content: string;
				timestamp: string;
			}> = [];

			let currentMessage: any = null;
			let contentLines: string[] = [];

			for (const line of lines) {
				if (line.startsWith('- role:')) {
					// Save previous message
					if (currentMessage) {
						currentMessage.content = contentLines.join('\n').trim();
						messages.push(currentMessage);
					}
					
					// Start new message
					const role = line.split(':')[1].trim();
					currentMessage = { role, content: '', timestamp: '' };
					contentLines = [];
				} else if (line.startsWith('  content: |')) {
					// Start of content
					continue;
				} else if (line.startsWith('  timestamp:')) {
					currentMessage.timestamp = line.split(':')[1].trim();
				} else if (line.startsWith('  ') && currentMessage) {
					// Content line
					contentLines.push(line.substring(2));
				}
			}

			// Save last message
			if (currentMessage) {
				currentMessage.content = contentLines.join('\n').trim();
				messages.push(currentMessage);
			}

			return messages;
		} catch (error) {
			console.error('Error parsing YAML messages:', error);
			return [];
		}
	}

	/**
	 * Helper method to get user shard path
	 */
	private getUserShardPath(userId: string): string {
		// Simple sharding: take first 2 characters of userId
		const shard = userId.substring(0, 2);
		return `${shard}/${userId}`;
	}


	/**
	 * Generate topic title for current session (client-initiated)
	 */
	@roles('user')
	public async generateTopicTitle(): Promise<{ title: string; timestamp: string } | null> {
		try {
			const user = await this.getCurrentUser();
			if (!user || !this.dialogueJournal) {
				return null;
			}

			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			
			// Get current conversation
			const conversation = await this.dialogueJournal.getConversation(user, sessionId);
			
			// Need at least 2 messages (user + assistant) to generate a title
			if (conversation.length < 2) {
				return null;
			}

			// Find the first user and assistant messages
			const userMessage = conversation.find(msg => msg.role === 'user');
			const assistantMessage = conversation.find(msg => msg.role === 'assistant');
			
			if (!userMessage || !assistantMessage) {
				return null;
			}

			// Generate title using LLM
			const llm = await this.getUserPreferredLLM();
			llm.clearFormat();

			const titlePrompt = `Generate a short, descriptive title (max 50 characters) that describes what the user wants to discuss. Focus ONLY on the user's intent, not any response content.

Examples:
- User: "a joke" → Title: "Joke Request"
- User: "How do I implement binary search?" → Title: "Binary Search Implementation"
- User: "Help me debug Python code" → Title: "Python Code Debugging"

User request: ${userMessage.content}

Title:`;

			llm.user(titlePrompt);
			const response = await llm.requestCompletion_();
			const title = response.firstChoice.trim()
				.replace(/^["']|["']$/g, '') // Remove quotes
				.substring(0, 50) // Limit to 50 characters
				.trim();

			if (title && title !== 'Title' && title.length > 3) {
				// Add title as an assistant message with reasoning
				await this.dialogueJournal.addMessage(user, {
					role: 'assistant',
					content: `📝 **Topic: ${title}**`,
					timestamp: new Date().toISOString(),
					metadata: {
						model: 'system',
						reasoning: `Generated topic title: "${title}"`,
						sessionId: sessionId
					}
				}, sessionId);

				console.log(`📝 Generated topic title: "${title}"`);
				
				return {
					title: title,
					timestamp: new Date().toISOString()
				};
			}
			
			return null;
		} catch (error) {
			console.error('Error generating topic title:', error);
			return null;
		}
	}

	/**
	 * Get topic title for a session (client can call this)
	 */
	@roles('user')
	public async getTopicTitle(sessionId?: string): Promise<{ title: string; timestamp: string } | null> {
		try {
			const user = await this.getCurrentUser();
			if (!user) return null;

			const sessionData = await this.sessionProvider.getSession(user.id);
			if (sessionData?.topicTitles?.[sessionId || '']) {
				return sessionData.topicTitles[sessionId || ''];
			}
			return null;
		} catch (error) {
			console.error('Error getting topic title:', error);
			return null;
		}
	}

	/**
	 * Generate a topic summary for a conversation asynchronously
	 * This runs in the background and updates the topic title
	 */
	private async generateTopicSummary(sessionId: string, conversation: ChatMessage[]): Promise<string> {
		try {
			// Only summarize if conversation has enough content
			if (conversation.length < 3) {
				return 'New Topic';
			}

			// Get LLM instance for summarization
			const llm = await this.getUserPreferredLLM();
			llm.clearFormat();

			// Create a summarization prompt
			const conversationText = conversation
				.filter(msg => msg.role === 'user' || msg.role === 'assistant')
				.map(msg => `${msg.role}: ${msg.content}`)
				.join('\n\n');

			const summaryPrompt = `Please provide a concise, descriptive title (max 60 characters) for this conversation topic. Focus on the main subject or theme being discussed.

Conversation:
${conversationText}

Title:`;

			llm.user(summaryPrompt);

			// Get the summary
			const response = await llm.requestCompletion_();
			const summary = response.firstChoice.trim();

			// Clean up the summary (remove quotes, limit length)
			const cleanSummary = summary
				.replace(/^["']|["']$/g, '') // Remove surrounding quotes
				.substring(0, 60) // Limit to 60 characters
				.trim();

			return cleanSummary || 'Conversation Topic';
		} catch (error) {
			console.error('Error generating topic summary:', error);
			return 'Topic Summary';
		}
	}

	/**
	 * Update topic summary asynchronously
	 * This method can be called after significant conversation activity
	 */
	@roles('user')
	public async updateTopicSummary(): Promise<void> {
		try {
			const user = await this.getCurrentUser();
			if (!user || !this.dialogueJournal) {
				return;
			}

			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			
			if (!sessionId) {
				return;
			}

			// Get current conversation
			const conversation = await this.dialogueJournal.getConversation(user, sessionId);
			
			// Only update if conversation has grown significantly
			if (conversation.length < 5) {
				return;
			}

			// Generate summary in background (don't await)
			this.generateTopicSummary(sessionId, conversation)
				.then(summary => {
					console.log(`📝 Topic summary generated: ${summary}`);
					// TODO: Store summary in session metadata or dialogue journal
					// This could be added to the session data or stored separately
				})
				.catch(error => {
					console.error('Background topic summarization failed:', error);
				});

		} catch (error) {
			console.error('Error updating topic summary:', error);
		}
	}

	/**
	 * Get enhanced topic information including AI-generated summary
	 */
	@roles('user')
	public async getTopicInfo(sessionId?: string): Promise<{
		sessionId: string;
		title: string;
		summary?: string;
		lastActivity: string;
		messageCount: number;
		systemPrompt?: string;
		aiGeneratedTitle?: boolean;
	}> {
		try {
			const user = await this.getCurrentUser();
			if (!user || !this.dialogueJournal) {
				throw new Error('User not authenticated or dialogue journal not available');
			}

			const currentSessionId = sessionId || (await this.getUserSession()).sessionId;
			if (!currentSessionId) {
				throw new Error('No session ID available');
			}

			const conversation = await this.dialogueJournal.getConversation(user, currentSessionId);
			
			if (conversation.length === 0) {
				return {
					sessionId: currentSessionId,
					title: 'Empty Topic',
					lastActivity: new Date().toISOString(),
					messageCount: 0
				};
			}

			const lastMessage = conversation[conversation.length - 1];
			const systemPrompt = conversation.find(msg => msg.role === 'system')?.content;

			// Try to get AI-generated summary if available
			// TODO: This would come from stored metadata
			const aiSummary: string | undefined = undefined; // Placeholder for future implementation

			// Fallback to simple title extraction
			let title = 'Untitled Topic';
			const firstUserMessage = conversation.find(msg => msg.role === 'user');
			if (firstUserMessage) {
				title = firstUserMessage.content.substring(0, 50) + 
					(firstUserMessage.content.length > 50 ? '...' : '');
			} else if (systemPrompt) {
				title = systemPrompt.substring(0, 50) + 
					(systemPrompt.length > 50 ? '...' : '');
			}

			return {
				sessionId: currentSessionId,
				title,
				summary: aiSummary,
				lastActivity: lastMessage.timestamp,
				messageCount: conversation.length,
				systemPrompt,
				aiGeneratedTitle: !!aiSummary
			};

		} catch (error) {
			console.error('Error getting topic info:', error);
			throw error;
		}
	}

	/**
	 * Trigger topic summarization after conversation milestones
	 * This can be called after significant conversation activity
	 */
	private async triggerTopicSummarization(): Promise<void> {
		try {
			const user = await this.getCurrentUser();
			if (!user || !this.dialogueJournal) {
				return;
			}

			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			
			if (!sessionId) {
				return;
			}

			const conversation = await this.dialogueJournal.getConversation(user, sessionId);
			
			// Trigger summarization at conversation milestones
			const messageCount = conversation.length;
			const shouldSummarize = 
				messageCount === 10 || 
				messageCount === 25 || 
				messageCount === 50 || 
				(messageCount > 50 && messageCount % 25 === 0);

			if (shouldSummarize) {
				console.log(`🔄 Triggering topic summarization at ${messageCount} messages`);
				await this.updateTopicSummary();
			}

		} catch (error) {
			console.error('Error triggering topic summarization:', error);
		}
	}

	/**
	 * Archive a specific topic/session
	 */
	@roles('user')
	public async archiveTopic(sessionId: string): Promise<boolean> {
		try {
			const user = await this.getCurrentUser();
			if (!user || !this.dialogueJournal) {
				throw new Error('User not authenticated or dialogue journal not available');
			}

			// Get the conversation to archive
			const conversation = await this.dialogueJournal.getConversation(user, sessionId);
			
			if (conversation.length === 0) {
				console.log(`ℹ️  No conversation to archive for session ${sessionId}`);
				return false;
			}

			// Create archive metadata
			const archiveMetadata = {
				archivedAt: new Date().toISOString(),
				messageCount: conversation.length,
				lastActivity: conversation[conversation.length - 1]?.timestamp,
				title: this.extractTopicTitle(conversation),
				sessionId: sessionId
			};

			// Store archive metadata in session data
			const sessionData = await this.getUserSession();
			if (!sessionData.archivedTopics) {
				sessionData.archivedTopics = [];
			}
			
			// Add to archived topics
			sessionData.archivedTopics.push(archiveMetadata);
			await this.sessionProvider.setSession(user.id, sessionData);

			// Clear the conversation (effectively archiving it)
			await this.dialogueJournal.clearConversation(user, sessionId);

			console.log(`📦 Archived topic: ${archiveMetadata.title} (${archiveMetadata.messageCount} messages)`);
			return true;

		} catch (error) {
			console.error('Error archiving topic:', error);
			return false;
		}
	}

	/**
	 * Archive the current topic/session
	 */
	@roles('user')
	public async archiveCurrentTopic(): Promise<boolean> {
		try {
			const sessionData = await this.getUserSession();
			const sessionId = sessionData.sessionId;
			
			if (!sessionId) {
				console.log('ℹ️  No current session to archive');
				return false;
			}

			return await this.archiveTopic(sessionId);
		} catch (error) {
			console.error('Error archiving current topic:', error);
			return false;
		}
	}

	/**
	 * List archived topics
	 */
	@roles('user')
	public async listArchivedTopics(): Promise<Array<{
		sessionId: string;
		title: string;
		archivedAt: string;
		messageCount: number;
		lastActivity: string;
	}>> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}

			const sessionData = await this.getUserSession();
			const archivedTopics = sessionData.archivedTopics || [];

			// Sort by archive date (newest first)
			return archivedTopics.sort((a: any, b: any) => 
				new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
			);

		} catch (error) {
			console.error('Error listing archived topics:', error);
			return [];
		}
	}

	/**
	 * Restore an archived topic (create new session with archived content)
	 */
	@roles('user')
	public async restoreArchivedTopic(archivedSessionId: string): Promise<string | null> {
		try {
			const user = await this.getCurrentUser();
			if (!user || !this.dialogueJournal) {
				throw new Error('User not authenticated or dialogue journal not available');
			}

			const sessionData = await this.getUserSession();
			const archivedTopics = sessionData.archivedTopics || [];
			
			// Find the archived topic
			const archivedTopic = archivedTopics.find((topic: any) => topic.sessionId === archivedSessionId);
			if (!archivedTopic) {
				console.log(`❌ Archived topic ${archivedSessionId} not found`);
				return null;
			}

			// Create new session for restored topic
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
			const randomSuffix = Math.random().toString(36).substr(2, 2);
			const newSessionId = `restored-${dateStr}-${timeStr}-${randomSuffix}`;

			// Update session data
			sessionData.sessionId = newSessionId;
			await this.sessionProvider.setSession(user.id, sessionData);

			// Add restoration message to new session
			await this.dialogueJournal.addMessage(user, {
				role: 'system',
				content: `Topic restored from archive: ${archivedTopic.title}\nOriginally archived: ${archivedTopic.archivedAt}\nOriginal message count: ${archivedTopic.messageCount}`,
				timestamp: new Date().toISOString(),
				metadata: {
					model: 'system',
					reasoning: 'topic_restoration',
					sessionId: newSessionId
				} as any
			}, newSessionId);

			console.log(`🔄 Restored archived topic: ${archivedTopic.title} as ${newSessionId}`);
			return newSessionId;

		} catch (error) {
			console.error('Error restoring archived topic:', error);
			return null;
		}
	}

	/**
	 * Delete an archived topic permanently
	 */
	@roles('user')
	public async deleteArchivedTopic(archivedSessionId: string): Promise<boolean> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}

			const sessionData = await this.getUserSession();
			const archivedTopics = sessionData.archivedTopics || [];
			
			// Find and remove the archived topic
			const topicIndex = archivedTopics.findIndex((topic: any) => topic.sessionId === archivedSessionId);
			if (topicIndex === -1) {
				console.log(`❌ Archived topic ${archivedSessionId} not found`);
				return false;
			}

			const deletedTopic = archivedTopics.splice(topicIndex, 1)[0];
			await this.sessionProvider.setSession(user.id, sessionData);

			console.log(`🗑️  Permanently deleted archived topic: ${deletedTopic.title}`);
			return true;

		} catch (error) {
			console.error('Error deleting archived topic:', error);
			return false;
		}
	}

	/**
	 * Helper method to extract topic title from conversation
	 */
	private extractTopicTitle(conversation: ChatMessage[]): string {
		if (conversation.length === 0) {
			return 'Empty Topic';
		}

		const firstUserMessage = conversation.find(msg => msg.role === 'user');
		if (firstUserMessage) {
			return firstUserMessage.content.substring(0, 50) + 
				(firstUserMessage.content.length > 50 ? '...' : '');
		}

		const systemMessage = conversation.find(msg => msg.role === 'system');
		if (systemMessage) {
			return systemMessage.content.substring(0, 50) + 
				(systemMessage.content.length > 50 ? '...' : '');
		}

		return 'Untitled Topic';
	}


	/**
	 * Simple non-streaming chat - returns the full response as a string.
	 * Does not persist conversation or update dialogue journal.
	 * Useful for one-off LLM invocations.
	 */
	public async chatOnce(systemPrompt: string, message: string): Promise<string> {
		try {
			const llm = await this.getUserPreferredLLM();
			llm.clearFormat();

			// Set system prompt only if provided
			if (systemPrompt) {
				llm.system(systemPrompt);
			}

			llm.user(message);

			const response = await llm.requestCompletion_();
			return response.firstChoice;
		} catch (error) {
			const err = error as Error;
			throw new Error(`LLM Error: ${err.message}`);
		}
	}

	/**
	 * Consolidated streaming chat method
	 * Returns an AsyncGenerator of SimpleStreamPacket for consistent interface
	 * Uses session-specific system prompts and session IDs when available
	 */
	public async *chatStreaming(message: string, options: {
		reasoningEnabled?: boolean;
		jsonOutput?: boolean;
	} = {}): AsyncGenerator<SimpleStreamPacket> {
		const startTime = Date.now();
		let firstTokenTime: number | null = null;
		let aiResponse = '';
		let aiReasoning = '';
		let tokenUsage: any = null;
		let finishReason = 'unknown';
		let responseId = '';
		let systemFingerprint: string | null = null;
		let llmModel = '';
		let llmConfig: any = null;
		
		try {
			// Get current user
			const user = await this.getCurrentUser();
			if (!user) {
				yield new SimpleStreamPacket('error', '', 'User not authenticated');
				return;
			}
			
			// Update user activity if session monitoring is enabled
			if (this.enableSessionMonitoring) {
				this.updateUserActivity(user.id);
			}
			
			// Get system prompt and session ID from session data
			const sessionData = await this.getUserSession();
			const systemPrompt = sessionData.systemPrompt;
			const sessionId = sessionData.sessionId;
			
			// Add user message to dialogue journal if available
			if (this.dialogueJournal) {
				await this.dialogueJournal.addMessage(user, { 
					role: 'user', 
					content: message,
					timestamp: new Date().toISOString()
				}, sessionId);
			}
			
			// Load conversation history from dialogue journal or use empty array
			const history = this.dialogueJournal 
				? await this.dialogueJournal.getConversation(user, sessionId)
				: [];
			
			// Get LLM instance to capture configuration
			const llm = await this.getUserPreferredLLM();
			llmModel = llm.model;
			llmConfig = {
				temperature: llm.temperature,
				maxTokens: llm.max_tokens,
				reasoningEnabled: llm.reasoningEnabled
			};
			
			// Use the SimpleStreamPacket streaming method to maintain proper reasoning/content handling
			for await (const packet of this.streamLLMWithSimplePackets(message, history, {
				reasoningEnabled: options.reasoningEnabled,
				jsonOutput: options.jsonOutput,
				systemPrompt: systemPrompt
			})) {
				if (firstTokenTime === null) {
					firstTokenTime = Date.now();
				}
				
				// Accumulate content and reasoning
				aiResponse += packet.content;
				aiReasoning += packet.reasoning;
				
				// Yield the packet to the frontend
				yield packet;
			}
			
			// Capture token usage from the LLM instance after streaming is complete
			// The LLM instance tracks usage internally during the streaming process
			const sessionUsage = llm.getRawSessionUsage();
			if (sessionUsage && sessionUsage.total_tokens > 0) {
				tokenUsage = sessionUsage;
			}
			
			// Add AI response to dialogue journal with enhanced metadata if we have content
			if (this.dialogueJournal && aiResponse.trim()) {
				// Calculate performance metrics
				const processingTime = Date.now() - startTime;
				const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : 0;
				const tokensPerSecond = tokenUsage ? (tokenUsage.total_tokens / (processingTime / 1000)) : 0;
				
				await this.dialogueJournal.addMessage(user, { 
					role: 'assistant', 
					content: aiResponse,
					timestamp: new Date().toISOString(),
					metadata: {
						model: llmModel,
						reasoning: aiReasoning,
						tokens: tokenUsage ? {
							prompt: tokenUsage.prompt_tokens || 0,
							completion: tokenUsage.completion_tokens || 0,
							total: tokenUsage.total_tokens || 0,
							input: tokenUsage.input_tokens || 0,
							output: tokenUsage.output_tokens || 0,
							cached: tokenUsage.cached_input_tokens || 0
						} : null,
						performance: {
							processingTimeMs: processingTime,
							firstTokenLatencyMs: firstTokenLatency,
							tokensPerSecond: Math.round(tokensPerSecond)
						},
						config: llmConfig,
						response: {
							finishReason: 'stop', // Default for streaming
							responseId: `resp_${Date.now()}`
						},
						sessionId: sessionId
					}
				}, sessionId);

				// Topic title generation is now client-initiated
			}
		} catch (error) {
			const err = error as Error;
			yield new SimpleStreamPacket('error', '', `Error: ${err.message}`);
		}
	}

	/**
	 * Consolidated non-streaming chat method
	 * Returns a Promise of SimpleStreamPacket for consistent interface
	 * Uses session-specific system prompts and session IDs when available
	 */
	public async chat(message: string, options: {
		reasoningEnabled?: boolean;
		jsonOutput?: boolean;
	} = {}): Promise<SimpleStreamPacket> {
		const startTime = Date.now();
		let tokenUsage: any = null;
		let finishReason = 'unknown';
		let responseId = '';
		let systemFingerprint: string | null = null;
		let llmModel = '';
		let llmConfig: any = null;
		
		try {
			// Get current user
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}
			
			// Update user activity if session monitoring is enabled
			if (this.enableSessionMonitoring) {
				this.updateUserActivity(user.id);
			}
			
			// Get system prompt and session ID from session data
			const sessionData = await this.getUserSession();
			const systemPrompt = sessionData.systemPrompt;
			const sessionId = sessionData.sessionId;
			
			// Add user message to dialogue journal if available
			if (this.dialogueJournal) {
				await this.dialogueJournal.addMessage(user, { 
					role: 'user', 
					content: message,
					timestamp: new Date().toISOString()
				}, sessionId);
			}
			
			// Load conversation history from dialogue journal or use empty array
			const history = this.dialogueJournal 
				? await this.dialogueJournal.getConversation(user, sessionId)
				: [];
			
			// Get LLM instance to capture configuration
			const llm = await this.getUserPreferredLLM();
			llmModel = llm.model;
			llmConfig = {
				temperature: llm.temperature,
				maxTokens: llm.max_tokens,
				reasoningEnabled: llm.reasoningEnabled
			};
			
			llm.clearFormat();
			
			// Set system prompt only if provided
			if (systemPrompt) {
			llm.system(systemPrompt);
			}

			// Load conversation history into LLM context
			for (const msg of history) {
				if (msg.role === 'user') {
					llm.user(msg.content);
				} else if (msg.role === 'assistant') {
					llm.assistant(msg.content);
				} else if (msg.role === 'system') {
					llm.system(msg.content);
				}
			}

			// Add current message
			llm.user(message);

			// Use non-streaming completion with metadata capture
			const response = await llm.requestCompletion_();
			const aiResponse = response.firstChoice;
			
			// Capture metadata if available
			if (response.usage) {
				tokenUsage = response.usage;
			}
			if (response.id) {
				responseId = response.id;
			}
			if (response.systemFingerprint) {
				systemFingerprint = response.systemFingerprint;
			}
			// Note: finishReason is not available in non-streaming completion response
			// We'll use a default value
			finishReason = 'stop';
			
			// Add AI response to dialogue journal with enhanced metadata if available
			if (this.dialogueJournal && aiResponse.trim()) {
				// Calculate performance metrics
				const processingTime = Date.now() - startTime;
				
				await this.dialogueJournal.addMessage(user, { 
					role: 'assistant', 
					content: aiResponse,
					timestamp: new Date().toISOString(),
					metadata: {
						model: llmModel,
						tokens: tokenUsage ? {
							prompt: tokenUsage.prompt_tokens || 0,
							completion: tokenUsage.completion_tokens || 0,
							total: tokenUsage.total_tokens || 0,
							input: tokenUsage.input_tokens || 0,
							output: tokenUsage.output_tokens || 0,
							cached: tokenUsage.cached_input_tokens || 0
						} : null,
						performance: {
							processingTimeMs: processingTime,
							firstTokenLatencyMs: 0, // Not applicable for non-streaming
							tokensPerSecond: 0 // Will be calculated if tokenUsage is available
						},
						config: llmConfig,
						response: {
							finishReason,
							responseId: responseId || `resp_${Date.now()}`
						},
						sessionId: sessionId
					}
				}, sessionId);

				// Topic title generation is now client-initiated
			}
			
			// Return as SimpleStreamPacket for consistent interface
			return new SimpleStreamPacket('llm', '', aiResponse);
		} catch (error) {
			const err = error as Error;
			return new SimpleStreamPacket('error', '', `LLM Error: ${err.message}`);
		}
	}

	/**
	 * Start a new LLM session with a system prompt
	 * This creates a new conversation journal file and sets up the assistant's role
	 * Uses session-specific system prompts and session IDs when available
	 */
	public async startSession(systemPrompt: string): Promise<boolean> {
		try {
			// Get current user
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}
			
			// Generate a human-readable session ID with date and time
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
			const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
			const randomSuffix = Math.random().toString(36).substr(2, 2); // 2 random chars
			const sessionId = `session-${dateStr}-${timeStr}-${randomSuffix}`;
			
			// Store the system prompt and session ID in the session data
			const sessionData = await this.getUserSession();
			sessionData.systemPrompt = systemPrompt;
			sessionData.sessionId = sessionId;
			await this.sessionProvider.setSession(user.id, sessionData);
			
			// Create a new journal file for this session
			if (this.dialogueJournal) {
				// Clear any existing conversation first
				await this.dialogueJournal.clearConversation(user, sessionId);
				
				// Add system prompt as the first entry in the new session
				if (systemPrompt.trim()) {
					await this.dialogueJournal.addMessage(user, { 
						role: 'system', 
						content: systemPrompt,
						timestamp: new Date().toISOString(),
						metadata: {
							model: 'system',
							reasoning: 'session_start',
							sessionId: sessionId
						}
					}, sessionId);
				}
			}
			
			return true;
		} catch (error) {
			const err = error as Error;
			console.error('Failed to start new session:', err.message);
			return false;
		}
	}
	/**
     * Export current user's conversation as JSON or CSV
     */
	public async exportConversation(format: 'json' | 'csv' = 'json'): Promise<string> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				throw new Error('User not authenticated');
			}
			
			if (this.dialogueJournal) {
				return await this.dialogueJournal.exportConversation(user, format);
			} else {
				throw new Error('Dialogue journal not available');
			}
		} catch (error) {
			const err = error as Error;
			throw new Error(`Export failed: ${err.message}`);
		}
	}
}

