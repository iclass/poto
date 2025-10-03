import { PotoUser } from "./UserProvider";

// Enhanced ChatMessage interface
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    metadata?: {
        model?: string;
        tokens?: number;
        processingTime?: number;
        sessionId?: string;
    };
}

// Archived conversation interface
export interface ArchivedConversation {
    id: string;
    userId: string;
    archivedAt: string;
    messageCount: number;
    firstMessageTime: string;
    lastMessageTime: string;
    size: number; // in bytes
    tags?: string[];
}

// Dialogue journal statistics
export interface DialogueJournalStats {
    totalUsers: number;
    totalMessages: number;
    totalArchivedConversations: number;
    averageMessagesPerUser: number;
    storageUsage: number; // in bytes
    oldestMessage?: string;
    newestMessage?: string;
    backend: string;
    lastCleanup?: string;
}

// Cleanup options
export interface CleanupOptions {
    maxAgeHours?: number;
    maxInactiveHours?: number;
    dryRun?: boolean;
}

// Cleanup result
export interface CleanupResult {
    usersRemoved: number;
    messagesRemoved: number;
    memoryFreed: number;
}

// Conversation summary
export interface ConversationSummary {
    messageCount: number;
    lastMessageTime?: string;
    firstMessageTime?: string;
    userMessageCount: number;
    assistantMessageCount: number;
}

/**
 * Abstract interface for dialogue journal implementations
 * Supports multiple storage backends (memory, filesystem, redis)
 */
export interface DialogueJournal {
    // Core operations
    getConversation(user: PotoUser): Promise<ChatMessage[]>;
    addMessage(user: PotoUser, message: ChatMessage): Promise<void>;
    addMessages(user: PotoUser, messages: ChatMessage[]): Promise<void>;
    clearConversation(user: PotoUser): Promise<void>;
    
    // Advanced operations (not applicable to memory-based journal)
    archiveConversation?(user: PotoUser, conversationId?: string): Promise<string>;
    getArchivedConversations?(user: PotoUser): Promise<ArchivedConversation[]>;
    restoreConversation?(user: PotoUser, archiveId: string): Promise<void>;
    
    // Statistics and management
    getStats(): Promise<DialogueJournalStats>;
    cleanup(options: CleanupOptions): Promise<CleanupResult>;
    
    // Export/Import
    exportConversation(user: PotoUser, format: 'json' | 'csv'): Promise<string>;
    importConversation(user: PotoUser, data: string, format: 'json' | 'csv'): Promise<boolean>;
    
    // Utility methods
    getConversationLength(user: PotoUser): Promise<number>;
    getRecentMessages(user: PotoUser, count: number): Promise<ChatMessage[]>;
    hasActiveConversation(user: PotoUser): Promise<boolean>;
    getConversationSummary(user: PotoUser): Promise<ConversationSummary>;
}

/**
 * Base class for dialogue journal implementations
 * Provides common functionality and validation
 */
export abstract class BaseDialogueJournal implements DialogueJournal {
    protected maxConversationLength: number;
    protected maxConversationsPerUser: number;
    protected maxConversationAgeHours: number;
    protected maxInactiveUserHours: number;

    constructor(
        maxConversationLength: number = 1000,
        maxConversationsPerUser: number = 50,
        maxConversationAgeHours: number = 24 * 7, // 7 days
        maxInactiveUserHours: number = 24 * 30    // 30 days
    ) {
        this.maxConversationLength = maxConversationLength;
        this.maxConversationsPerUser = maxConversationsPerUser;
        this.maxConversationAgeHours = maxConversationAgeHours;
        this.maxInactiveUserHours = maxInactiveUserHours;
    }

    // Abstract methods to be implemented by subclasses
    abstract getConversation(user: PotoUser): Promise<ChatMessage[]>;
    abstract addMessage(user: PotoUser, message: ChatMessage): Promise<void>;
    abstract addMessages(user: PotoUser, messages: ChatMessage[]): Promise<void>;
    abstract clearConversation(user: PotoUser): Promise<void>;
    abstract getStats(): Promise<DialogueJournalStats>;
    abstract cleanup(options: CleanupOptions): Promise<CleanupResult>;
    abstract exportConversation(user: PotoUser, format: 'json' | 'csv'): Promise<string>;
    abstract importConversation(user: PotoUser, data: string, format: 'json' | 'csv'): Promise<boolean>;

    // Common utility methods
    async getConversationLength(user: PotoUser): Promise<number> {
        const conversation = await this.getConversation(user);
        return conversation.length;
    }

    async getRecentMessages(user: PotoUser, count: number): Promise<ChatMessage[]> {
        const conversation = await this.getConversation(user);
        return conversation.slice(-count);
    }

    async hasActiveConversation(user: PotoUser): Promise<boolean> {
        const conversation = await this.getConversation(user);
        return conversation.length > 0;
    }

    async getConversationSummary(user: PotoUser): Promise<ConversationSummary> {
        const conversation = await this.getConversation(user);
        
        if (conversation.length === 0) {
            return {
                messageCount: 0,
                userMessageCount: 0,
                assistantMessageCount: 0
            };
        }

        const userMessages = conversation.filter(msg => msg.role === 'user');
        const assistantMessages = conversation.filter(msg => msg.role === 'assistant');
        
        return {
            messageCount: conversation.length,
            lastMessageTime: conversation[conversation.length - 1]?.timestamp,
            firstMessageTime: conversation[0]?.timestamp,
            userMessageCount: userMessages.length,
            assistantMessageCount: assistantMessages.length
        };
    }

    // Validation helpers
    protected validateMessage(message: ChatMessage): void {
        if (!message.role || !['user', 'assistant'].includes(message.role)) {
            throw new Error('Invalid message role');
        }
        if (!message.content || typeof message.content !== 'string') {
            throw new Error('Invalid message content');
        }
        if (!message.timestamp || typeof message.timestamp !== 'string') {
            throw new Error('Invalid message timestamp');
        }
    }

    protected validateUser(user: PotoUser): void {
        if (!user || !user.id) {
            throw new Error('Invalid user');
        }
    }

    // Default implementations for optional methods
    async archiveConversation?(user: PotoUser, conversationId?: string): Promise<string> {
        throw new Error('Archival not supported by this backend');
    }

    async getArchivedConversations?(user: PotoUser): Promise<ArchivedConversation[]> {
        throw new Error('Archival not supported by this backend');
    }

    async restoreConversation?(user: PotoUser, archiveId: string): Promise<void> {
        throw new Error('Archival not supported by this backend');
    }
}
