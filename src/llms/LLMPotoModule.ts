import { PotoModule } from "../server/PotoModule";
import { LLM } from "./llm";
import { LLMConfig } from "./LLMConfig";
import { UserSessionData } from "../server/UserSessionProvider";
import { DialogueJournal, ChatMessage } from "../server/DialogueJournal";
import { PotoUser } from "../server/UserProvider";
import { DialogueJournalFactory } from "../server/DialogueJournalFactory";

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

	/**
	 * Enhanced LLM streaming with metadata capture
	 */
	protected async *streamLLMWithMetadata(
		message: string,
		history: Array<{ role: 'user' | 'assistant'; content: string }>,
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

			// Stream the response and capture metadata
			const stream = await llm.requestCompletionStream_();
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
	 * Generic chat with conversation history and optional dialogue journal integration
	 * This method handles the core chat functionality with metadata capture and persistence
	 */
	async *chatWithHistory(
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
			
			// Add user message to dialogue journal if available
			if (this.dialogueJournal) {
				await this.dialogueJournal.addMessage(user, { 
					role: 'user', 
					content: message,
					timestamp: new Date().toISOString()
				});
			}
			
			// Load conversation history from dialogue journal or use empty array
			const history = this.dialogueJournal 
				? await this.dialogueJournal.getConversation(user)
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
	 * Archive current conversation for the current user
	 */
	async archiveCurrentConversation(): Promise<boolean> {
		console.log('🚀 archiveCurrentConversation method called!');
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				console.log('❌ No authenticated user found for archiving');
				return false;
			}

			console.log(`🔍 Checking conversation for user ${user.id}...`);

			// Check if there's a conversation to archive
			if (this.dialogueJournal) {
				const conversation = await this.dialogueJournal.getConversation(user);
				console.log(`📊 Conversation length: ${conversation.length} messages`);
				
				if (conversation.length === 0) {
					console.log(`ℹ️  No conversation to archive for user ${user.id}`);
					return true; // Not an error, just nothing to archive
				}

				// Check if archiving is supported
				console.log(`🔧 Archive support check: ${!!this.dialogueJournal.archiveConversation}`);
				
				// Archive the conversation if supported
				if (this.dialogueJournal.archiveConversation) {
					console.log(`📦 Attempting to archive conversation for user ${user.id}...`);
					const archiveId = await this.dialogueJournal.archiveConversation(user);
					console.log(`✅ Archived conversation ${archiveId} for user ${user.id}`);
					return true;
				} else {
					// If archiving is not supported, just clear the conversation
					console.log(`⚠️  Archiving not supported, clearing conversation for user ${user.id}`);
					await this.dialogueJournal.clearConversation(user);
					console.log(`🧹 Cleared conversation for user ${user.id} (archiving not supported)`);
					return true;
				}
			} else {
				console.log(`ℹ️  No dialogue journal available for user ${user.id}`);
				return true;
			}
		} catch (error) {
			console.error('❌ Error archiving conversation:', error);
			return false;
		}
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
			return this.dialogueJournal ? await this.dialogueJournal.getConversation(user) : [];
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
			return this.dialogueJournal ? await this.dialogueJournal.getConversationSummary(user) : {
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
	async getDialogueJournalStats(): Promise<{
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
	async getRecentMessages(count: number = 10): Promise<ChatMessage[]> {
		try {
			const user = await this.getCurrentUser();
			if (!user) {
				return [];
			}
			return this.dialogueJournal ? await this.dialogueJournal.getRecentMessages(user, count) : [];
		} catch (error) {
			return [];
		}
	}

	/**
	 * Perform manual cleanup of old conversations
	 */
	async performCleanup(options: {
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
	 * Get memory usage statistics
	 */
	async getMemoryStats(): Promise<{
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
	async stopAutomaticCleanup(): Promise<void> {
		// Note: This method is only available for VolatileMemoryDialogueJournal
		// For filesystem journal, cleanup is handled by the OS and scheduled tasks
		if (this.dialogueJournal && 'stopAutomaticCleanup' in this.dialogueJournal) {
			(this.dialogueJournal as any).stopAutomaticCleanup();
		}
	}

	/**
	 * Handle successful login - archive existing dialog and start fresh
	 */
	async onLogin(userId: string): Promise<void> {
		console.log(`🔐 User ${userId} logged in successfully`);
		
		// Check if user has an existing active session
		const existingSession = this.getUserSessionInfo(userId);
		if (existingSession && existingSession.isActive) {
			console.log(`📱 User ${userId} had existing session, archiving current dialog...`);
			
			try {
				// Archive the existing conversation before starting fresh
				await this.archiveUserDialog(userId);
				console.log(`✅ Previous dialog archived for user ${userId}`);
			} catch (error) {
				console.error(`❌ Failed to archive previous dialog for user ${userId}:`, error);
			}
		}
		
		// Start a new session for the user
		const sessionId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.startUserSession(userId, sessionId);
		console.log(`🆕 New session started for user ${userId}`);
	}

	/**
	 * Archive user's current dialog
	 */
	async archiveUserDialog(userId: string): Promise<void> {
		try {
			if (this.dialogueJournal) {
				// Create a proper PotoUser object for the dialogue journal
				const user = new PotoUser(userId, '', ['user']);
				const conversation = await this.dialogueJournal.getConversation(user);
				
				if (conversation.length > 0) {
					// Archive the conversation if supported
					if (this.dialogueJournal.archiveConversation) {
						const archiveId = await this.dialogueJournal.archiveConversation(user);
						console.log(`📦 Archived conversation ${archiveId} for user ${userId}`);
					} else {
						// If archiving is not supported, just clear the conversation
						await this.dialogueJournal.clearConversation(user);
						console.log(`🧹 Cleared conversation for user ${userId} (archiving not supported)`);
					}
				}
			}
		} catch (error) {
			console.error(`❌ Error archiving dialog for user ${userId}:`, error);
		}
	}

}
