import { ChatMessage } from "../shared/types";
import { PotoUser } from "../../src/server/UserProvider";

/**
 * Server-side dialogue journal for maintaining conversation history
 * Provides user-isolated conversation storage with memory management and time-based eviction
 */
export class DialogueJournal {
    private conversations: Map<string, ChatMessage[]> = new Map();
    private userLastActivity: Map<string, Date> = new Map();
    private maxConversationLength: number;
    private maxConversationsPerUser: number;
    private maxConversationAgeHours: number;
    private maxInactiveUserHours: number;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(
        maxConversationLength: number = 100, 
        maxConversationsPerUser: number = 10,
        maxConversationAgeHours: number = 24 * 7, // 7 days default
        maxInactiveUserHours: number = 24 * 30    // 30 days default
    ) {
        this.maxConversationLength = maxConversationLength;
        this.maxConversationsPerUser = maxConversationsPerUser;
        this.maxConversationAgeHours = maxConversationAgeHours;
        this.maxInactiveUserHours = maxInactiveUserHours;
        
        // Start automatic cleanup every hour
        this.startAutomaticCleanup();
    }

    /**
     * Get user's conversation history
     */
    getConversation(user: PotoUser): ChatMessage[] {
        const userId = user.id;
        return this.conversations.get(userId) || [];
    }

    /**
     * Add a message to user's conversation
     */
    addMessage(user: PotoUser, message: ChatMessage): void {
        const userId = user.id;
        let conversation = this.conversations.get(userId) || [];
        
        // Add timestamp if not present
        const messageWithTimestamp: ChatMessage = {
            ...message,
            timestamp: message.timestamp || new Date().toISOString()
        };
        
        conversation.push(messageWithTimestamp);
        
        // Update user's last activity
        this.userLastActivity.set(userId, new Date());
        
        // Trim conversation if it exceeds max length
        if (conversation.length > this.maxConversationLength) {
            conversation = conversation.slice(-this.maxConversationLength);
        }
        
        this.conversations.set(userId, conversation);
    }

    /**
     * Add multiple messages to user's conversation
     */
    addMessages(user: PotoUser, messages: ChatMessage[]): void {
        const userId = user.id;
        let conversation = this.conversations.get(userId) || [];
        
        // Add timestamps to messages that don't have them
        const messagesWithTimestamps = messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp || new Date().toISOString()
        }));
        
        conversation.push(...messagesWithTimestamps);
        
        // Update user's last activity
        this.userLastActivity.set(userId, new Date());
        
        // Trim conversation if it exceeds max length
        if (conversation.length > this.maxConversationLength) {
            conversation = conversation.slice(-this.maxConversationLength);
        }
        
        this.conversations.set(userId, conversation);
    }

    /**
     * Clear user's conversation history
     */
    clearConversation(user: PotoUser): void {
        const userId = user.id;
        this.conversations.delete(userId);
    }

    /**
     * Simplified method to add assistant message
     */
    addMessageForAssistant(user: PotoUser, content: string): void {
        const message: ChatMessage = {
            role: 'assistant',
            content,
            timestamp: new Date().toISOString()
        };
        
        this.addMessage(user, message);
    }

    /**
     * Simplified method to add user message
     */
    addMessageForUser(user: PotoUser, content: string): void {
        const message: ChatMessage = {
            role: 'user',
            content,
            timestamp: new Date().toISOString()
        };
        
        this.addMessage(user, message);
    }

    /**
     * Get conversation length for a user
     */
    getConversationLength(user: PotoUser): number {
        const conversation = this.getConversation(user);
        return conversation.length;
    }

    /**
     * Get recent messages from user's conversation
     */
    getRecentMessages(user: PotoUser, count: number): ChatMessage[] {
        const conversation = this.getConversation(user);
        return conversation.slice(-count);
    }

    /**
     * Export user's conversation as JSON
     */
    exportConversation(user: PotoUser): string {
        const conversation = this.getConversation(user);
        return JSON.stringify({
            userId: user.id,
            timestamp: new Date().toISOString(),
            messageCount: conversation.length,
            messages: conversation
        }, null, 2);
    }

    /**
     * Import conversation from JSON
     */
    importConversation(user: PotoUser, jsonData: string): boolean {
        try {
            const data = JSON.parse(jsonData);
            if (data.messages && Array.isArray(data.messages)) {
                this.conversations.set(user.id, data.messages);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get conversation statistics
     */
    getStats(): {
        totalUsers: number;
        totalMessages: number;
        averageMessagesPerUser: number;
        memoryUsage: number;
    } {
        const totalUsers = this.conversations.size;
        let totalMessages = 0;
        
        for (const conversation of this.conversations.values()) {
            totalMessages += conversation.length;
        }
        
        const averageMessagesPerUser = totalUsers > 0 ? totalMessages / totalUsers : 0;
        
        // Rough memory usage estimate (in bytes)
        const memoryUsage = JSON.stringify(Array.from(this.conversations.entries())).length;
        
        return {
            totalUsers,
            totalMessages,
            averageMessagesPerUser,
            memoryUsage
        };
    }

    /**
     * Start automatic cleanup scheduler
     */
    private startAutomaticCleanup(): void {
        // Run cleanup every hour
        this.cleanupInterval = setInterval(() => {
            this.performAutomaticCleanup();
        }, 60 * 60 * 1000); // 1 hour
        
        console.log('DialogueJournal: Automatic cleanup started (every hour)');
    }

    /**
     * Stop automatic cleanup
     */
    stopAutomaticCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('DialogueJournal: Automatic cleanup stopped');
        }
    }

    /**
     * Perform automatic cleanup based on age and inactivity
     */
    private performAutomaticCleanup(): void {
        const now = new Date();
        const maxAgeMs = this.maxConversationAgeHours * 60 * 60 * 1000;
        const maxInactiveMs = this.maxInactiveUserHours * 60 * 60 * 1000;
        
        let conversationsRemoved = 0;
        let messagesRemoved = 0;
        let usersRemoved = 0;
        
        // Clean up old messages and inactive users
        for (const [userId, conversation] of this.conversations.entries()) {
            const lastActivity = this.userLastActivity.get(userId);
            const isInactive = lastActivity && (now.getTime() - lastActivity.getTime()) > maxInactiveMs;
            
            if (isInactive) {
                // Remove entire conversation for inactive users
                this.conversations.delete(userId);
                this.userLastActivity.delete(userId);
                usersRemoved++;
                messagesRemoved += conversation.length;
            } else {
                // Remove old messages from active users
                const originalLength = conversation.length;
                const filteredConversation = conversation.filter(msg => {
                    if (!msg.timestamp) return true; // Keep messages without timestamps
                    const messageAge = now.getTime() - new Date(msg.timestamp).getTime();
                    return messageAge <= maxAgeMs;
                });
                
                if (filteredConversation.length !== originalLength) {
                    this.conversations.set(userId, filteredConversation);
                    messagesRemoved += originalLength - filteredConversation.length;
                }
            }
        }
        
        if (conversationsRemoved > 0 || messagesRemoved > 0 || usersRemoved > 0) {
            console.log(`DialogueJournal: Cleanup completed - Removed ${usersRemoved} users, ${messagesRemoved} messages`);
        }
    }

    /**
     * Manual cleanup with specific criteria
     */
    cleanup(options: {
        maxAgeHours?: number;
        maxInactiveHours?: number;
        dryRun?: boolean;
    } = {}): {
        usersRemoved: number;
        messagesRemoved: number;
        memoryFreed: number;
    } {
        const maxAgeHours = options.maxAgeHours || this.maxConversationAgeHours;
        const maxInactiveHours = options.maxInactiveHours || this.maxInactiveUserHours;
        const dryRun = options.dryRun || false;
        
        const now = new Date();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        const maxInactiveMs = maxInactiveHours * 60 * 60 * 1000;
        
        let usersRemoved = 0;
        let messagesRemoved = 0;
        let memoryFreed = 0;
        
        const conversationsToRemove: string[] = [];
        const conversationsToUpdate: Map<string, ChatMessage[]> = new Map();
        
        for (const [userId, conversation] of this.conversations.entries()) {
            const lastActivity = this.userLastActivity.get(userId);
            const isInactive = lastActivity && (now.getTime() - lastActivity.getTime()) > maxInactiveMs;
            
            if (isInactive) {
                conversationsToRemove.push(userId);
                usersRemoved++;
                messagesRemoved += conversation.length;
                memoryFreed += JSON.stringify(conversation).length;
            } else {
                // Filter old messages
                const filteredConversation = conversation.filter(msg => {
                    if (!msg.timestamp) return true;
                    const messageAge = now.getTime() - new Date(msg.timestamp).getTime();
                    return messageAge <= maxAgeMs;
                });
                
                if (filteredConversation.length !== conversation.length) {
                    conversationsToUpdate.set(userId, filteredConversation);
                    messagesRemoved += conversation.length - filteredConversation.length;
                    memoryFreed += JSON.stringify(conversation).length - JSON.stringify(filteredConversation).length;
                }
            }
        }
        
        if (!dryRun) {
            // Apply changes
            for (const userId of conversationsToRemove) {
                this.conversations.delete(userId);
                this.userLastActivity.delete(userId);
            }
            
            for (const [userId, conversation] of conversationsToUpdate.entries()) {
                this.conversations.set(userId, conversation);
            }
        }
        
        return {
            usersRemoved,
            messagesRemoved,
            memoryFreed
        };
    }

    /**
     * Get all user IDs with active conversations
     */
    getActiveUsers(): string[] {
        return Array.from(this.conversations.keys());
    }

    /**
     * Check if user has an active conversation
     */
    hasActiveConversation(user: PotoUser): boolean {
        const conversation = this.conversations.get(user.id);
        return conversation !== undefined && conversation.length > 0;
    }

    /**
     * Get conversation summary for a user
     */
    getConversationSummary(user: PotoUser): {
        messageCount: number;
        lastMessageTime?: string;
        firstMessageTime?: string;
        userMessageCount: number;
        assistantMessageCount: number;
    } {
        const conversation = this.getConversation(user);
        
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
            lastMessageTime: conversation[conversation.length - 1]?.content ? new Date().toISOString() : undefined,
            firstMessageTime: conversation[0]?.content ? new Date().toISOString() : undefined,
            userMessageCount: userMessages.length,
            assistantMessageCount: assistantMessages.length
        };
    }
}
