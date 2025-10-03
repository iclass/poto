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
     * Uses server-side dialogue journal for conversation storage
     */
    async *chatWithHistory(message: string, jsonOutput: boolean = false, reasoningEnabled: boolean = false): AsyncGenerator<string> {
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
            
            // Use the generic LLM streaming method from the base class
            let aiResponse = '';
            for await (const text of this.streamLLMWithHistory(message, history, {
                jsonOutput,
                reasoningEnabled
            })) {
                aiResponse += text;
                yield text;
            }
            
            // Add AI response to dialogue journal
            if (aiResponse.trim()) {
                await this.dialogueJournal.addMessage(user, { 
                    role: 'assistant', 
                    content: aiResponse,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            const err = error as Error;
            yield `Error: ${err.message}`;
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
