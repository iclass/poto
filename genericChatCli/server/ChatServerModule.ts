import { PotoUser } from "../../src/server/UserProvider";
import { LLMPotoModule } from "../../src/llms/LLMPotoModule";
import type { LLM } from "../../src/llms/llm";
import { DialogueJournal } from "../../src/server/DialogueJournal";
import { DialogueJournalFactory } from "../../src/server/DialogueJournalFactory";

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export class ChatServerModule extends LLMPotoModule  {
    private dialogueJournal: DialogueJournal;
    private userSessions = new Map<string, {
        lastActivity: Date;
        isActive: boolean;
        sessionId: string;
    }>();

    constructor() {
        super();
        // Create dialogue journal from YAML config if available, otherwise from environment
        try {
            // Try to load YAML configuration
            const config = require('../../poto.config.yaml');
            this.dialogueJournal = DialogueJournalFactory.createFromConfig(config);
        } catch (error) {
            // Fallback to environment variables
            this.dialogueJournal = DialogueJournalFactory.createFromEnv();
        }
        
        // Start session monitoring
        this.startSessionMonitoring();
    }

    /**
     * Override configureLLM to set chat-specific settings
     * Higher prompt length limit for chat conversations with images
     */
    protected async configureLLM(llm: LLM): Promise<void> {
        // Set much higher prompt length limit for chat conversations (500000 characters)
        // This is necessary for image-based conversations where base64 encoded images
        // can significantly increase the token count. PNG files especially can be very large.
        llm.setMaxPromptLength(500000);
    }

    /**
     * Simple streaming chat - returns text content directly
     * Perfect for CLI applications
     */
    async *postChat(message: string, systemPrompt?: string): AsyncGenerator<string> {
        
        try {
            // Get cancellation-aware LLM instance
            const llm = await this.getUserPreferredLLM();
            llm.clearFormat();

            // Set system prompt
            if (systemPrompt) {
                llm.system(systemPrompt);
            } else {
                llm.system("You are a helpful AI assistant. Provide clear and concise responses.");
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
     * Chat with conversation history (client interface version)
     * Uses server-side dialogue journal for conversation storage with enhanced metadata
     */
    async *chatWithHistory(message: string, jsonOutput: boolean = false, reasoningEnabled: boolean = false): AsyncGenerator<string> {
        const startTime = Date.now();
        let firstTokenTime: number | null = null;
        let tokenUsage: any = null;
        let finishReason = 'unknown';
        let responseId = '';
        let systemFingerprint: string | null = null;
        let llmModel = '';
        let llmConfig: any = null;
        
        try {
            // Get current user for dialogue journal
            const user = await this.getCurrentUser();
            if (!user) {
                yield `Error: User not authenticated`;
                return;
            }
            
            // Update user activity
            this.updateUserActivity(user.id);
            
            // Add user message to dialogue journal
            await this.dialogueJournal.addMessage(user, { 
                role: 'user', 
                content: message,
                timestamp: new Date().toISOString()
            });
            
            // Load conversation history from dialogue journal
            const history = await this.dialogueJournal.getConversation(user);
            
            // Get LLM instance to capture configuration
            const llm = await this.getUserPreferredLLM();
            llmModel = llm.model;
            llmConfig = {
                temperature: llm.temperature,
                maxTokens: llm.max_tokens,
                reasoningEnabled: llm.reasoningEnabled
            };
            
            // Use enhanced streaming method to capture metadata
            let aiResponse = '';
            const streamingResult = await this.streamLLMWithMetadata(message, history, {
                jsonOutput,
                reasoningEnabled
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
                
                // Capture final metadata (this is the key fix!)
                if (result.finalMetadata) {
                    tokenUsage = result.finalMetadata.tokenUsage;
                    finishReason = result.finalMetadata.finishReason || 'unknown';
                    responseId = result.finalMetadata.responseId || '';
                    systemFingerprint = result.finalMetadata.systemFingerprint;
                }
            }
            
            // Calculate performance metrics
            const processingTime = Date.now() - startTime;
            const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : 0;
            
            // Calculate tokens per second only if we have actual token usage
            const tokensPerSecond = tokenUsage ? (tokenUsage.total_tokens / (processingTime / 1000)) : 0;
            
            // Add AI response to dialogue journal with enhanced metadata
            if (aiResponse.trim()) {
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

    /**
     * Enhanced LLM streaming with metadata capture
     */
    private async *streamLLMWithMetadata(
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
     * Chat with conversation history (server version with user)
     */
    async *postChatWithHistoryAndUser(message: string, history: ChatMessage[]): AsyncGenerator<string> {
        try {
            // Use the generic LLM streaming method from the base class
            for await (const text of this.streamLLMWithHistory(message, history)) {
                yield text;
            }
        } catch (error) {
            const err = error as Error;
            yield `Error: ${err.message}`;
        }
    }

    /**
     * Non-streaming chat - returns complete response at once
     * Tests cancellation for non-streaming LLM invocations
     */
    async postChatNonStreaming(message: string, systemPrompt?: string): Promise<string> {
        try {
            // Get cancellation-aware LLM instance
            const llm = await this.getUserPreferredLLM();
            llm.clearFormat();

            // Set system prompt
            if (systemPrompt) {
                llm.system(systemPrompt);
            } else {
                llm.system("You are a helpful AI assistant. Provide clear and concise responses.");
            }

            llm.user(message);

            // Use non-streaming completion
            const response = await llm.requestCompletion_();
            return response.firstChoice;
        } catch (error) {
            const err = error as Error;
            throw new Error(`LLM Error: ${err.message}`);
        }
    }

    /**
     * Chat with custom LLM parameters
     */
    async *postChatWithParams(
        message: string,
        options: {
            systemPrompt?: string;
            temperature?: number;
            maxTokens?: number;
            model?: string;
        } = {},
        user?: PotoUser
    ): AsyncGenerator<string> {
        try {
            // Get cancellation-aware LLM instance
            const llm = await this.getUserPreferredLLM();

            // Apply custom options
            if (options.systemPrompt) {
                llm.system(options.systemPrompt);
            } else {
                llm.system("You are a helpful AI assistant.");
            }

            if (options.temperature !== undefined) {
                llm.temperature = options.temperature;
            }

            if (options.model) {
                llm.model = options.model;
            }

            llm.user(message);

            // Stream response with custom maxTokens
            for await (const text of await llm.requestCompletionTextGenerator_(options.maxTokens)) {
                yield text;
            }
        } catch (error) {
            const err = error as Error;
            yield `Error: ${err.message}`;
        }
    }

    /**
     * Clear user's conversation history (archives first if possible)
     */
    async clearConversation(): Promise<boolean> {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                return false;
            }

            console.log(`🔍 Checking conversation for user ${user.id}...`);

            // Check if there's a conversation to archive
            const conversation = await this.dialogueJournal.getConversation(user);
            console.log(`📊 Conversation length: ${conversation.length} messages`);
            
            if (conversation.length > 0) {
                // Try to archive the conversation if supported
                if (this.dialogueJournal.archiveConversation) {
                    console.log(`📦 Attempting to archive conversation for user ${user.id}...`);
                    try {
                        const archiveId = await this.dialogueJournal.archiveConversation(user);
                        console.log(`✅ Archived conversation ${archiveId} for user ${user.id}`);
                    } catch (archiveError) {
                        console.log(`⚠️  Archiving failed, proceeding with clear: ${archiveError}`);
                    }
                } else {
                    console.log(`ℹ️  Archiving not supported for this backend`);
                }
            } else {
                console.log(`ℹ️  No conversation to archive for user ${user.id}`);
            }

            // Clear the conversation
            await this.dialogueJournal.clearConversation(user);
            console.log(`🧹 Cleared conversation for user ${user.id}`);
            return true;
        } catch (error) {
            console.error('❌ Error in clearConversation:', error);
            return false;
        }
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
            return await this.dialogueJournal.getConversation(user);
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
            return await this.dialogueJournal.getConversationSummary(user);
        } catch (error) {
            return {
                messageCount: 0,
                userMessageCount: 0,
                assistantMessageCount: 0
            };
        }
    }

    /**
     * Export user's conversation as JSON
     */
    async exportConversation(): Promise<string> {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                return JSON.stringify({ error: 'User not authenticated' });
            }
            return await this.dialogueJournal.exportConversation(user, 'json');
        } catch (error) {
            return JSON.stringify({ error: 'Failed to export conversation' });
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
        const stats = await this.dialogueJournal.getStats();
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
            return await this.dialogueJournal.getRecentMessages(user, count);
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
        return await this.dialogueJournal.cleanup(options);
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
        const stats = await this.dialogueJournal.getStats();
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
        return await this.dialogueJournal.cleanup({
            maxAgeHours,
            maxInactiveHours,
            dryRun: false
        });
    }

    /**
     * Stop automatic cleanup (admin function)
     */
    async stopAutomaticCleanup(): Promise<void> {
        // Note: This method is only available for VolatileMemoryDialogueJournal
        // For filesystem journal, cleanup is handled by the OS and scheduled tasks
        if ('stopAutomaticCleanup' in this.dialogueJournal) {
            (this.dialogueJournal as any).stopAutomaticCleanup();
        }
    }

    // Session Management Methods

    /**
     * Start a new user session
     */
    startUserSession(userId: string, sessionId: string): void {
        this.userSessions.set(userId, {
            lastActivity: new Date(),
            isActive: true,
            sessionId
        });
        console.log(`📱 User ${userId} started session ${sessionId}`);
    }


    /**
     * Handle successful login - archive existing dialog and start fresh
     */
    async onLogin(userId: string): Promise<void> {
        console.log(`🔐 User ${userId} logged in successfully`);
        
        // Check if user has an existing active session
        const existingSession = this.userSessions.get(userId);
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
     * Update user activity timestamp
     */
    updateUserActivity(userId: string): void {
        const session = this.userSessions.get(userId);
        if (session) {
            session.lastActivity = new Date();
        }
    }

    /**
     * End user session and archive current dialog
     */
    async endUserSession(userId: string): Promise<void> {
        const session = this.userSessions.get(userId);
        if (session && session.isActive) {
            session.isActive = false;
            console.log(`📱 User ${userId} session ended, archiving dialog...`);
            
            try {
                // Archive the current conversation
                await this.archiveUserDialog(userId);
                console.log(`✅ Dialog archived for user ${userId}`);
            } catch (error) {
                console.error(`❌ Failed to archive dialog for user ${userId}:`, error);
            }
            
            // Remove from active sessions
            this.userSessions.delete(userId);
        }
    }

    /**
     * Archive user's current dialog
     */
    private async archiveUserDialog(userId: string): Promise<void> {
        try {
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
        } catch (error) {
            console.error(`❌ Error archiving dialog for user ${userId}:`, error);
        }
    }

    /**
     * Start session monitoring to detect inactive users
     */
    private startSessionMonitoring(): void {
        const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        const CHECK_INTERVAL = 30 * 1000; // 30 seconds
        
        setInterval(async () => {
            const now = new Date();
            const inactiveUsers: string[] = [];
            
            for (const [userId, session] of this.userSessions) {
                if (session.isActive && (now.getTime() - session.lastActivity.getTime()) > SESSION_TIMEOUT) {
                    inactiveUsers.push(userId);
                }
            }
            
            // End sessions for inactive users
            for (const userId of inactiveUsers) {
                console.log(`⏰ User ${userId} inactive for ${SESSION_TIMEOUT / 1000}s, ending session`);
                await this.endUserSession(userId);
            }
        }, CHECK_INTERVAL);
        
        console.log('🔄 Session monitoring started');
    }

    /**
     * Get active session count
     */
    getActiveSessionCount(): number {
        return Array.from(this.userSessions.values()).filter(s => s.isActive).length;
    }

    /**
     * Get session info for a user
     */
    getUserSessionInfo(userId: string): { lastActivity: Date; isActive: boolean; sessionId: string } | null {
        return this.userSessions.get(userId) || null;
    }

}
