import { BaseDialogueJournal, ChatMessage, DialogueJournalStats, CleanupOptions, CleanupResult } from './DialogueJournal';
import { PotoUser } from './UserProvider';

export interface VolatileMemoryDialogueJournalConfig {
    maxConversationLength: number;
    maxConversationsPerUser: number;
    maxConversationAgeHours: number;
    maxInactiveUserHours: number;
}

/**
 * Volatile memory-based dialogue journal for development and testing
 * Data is lost on restart - no persistence
 * No archival capabilities - core operations only
 */
export class VolatileMemoryDialogueJournal extends BaseDialogueJournal {
    private conversations: Map<string, ChatMessage[]> = new Map();
    private userLastActivity: Map<string, Date> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: VolatileMemoryDialogueJournalConfig) {
        super(
            config.maxConversationLength,
            config.maxConversationsPerUser,
            config.maxConversationAgeHours,
            config.maxInactiveUserHours
        );
        
        // Start automatic cleanup
        this.startAutomaticCleanup();
    }

    /**
     * Get user's conversation history
     */
    async getConversation(user: PotoUser, sessionId?: string): Promise<ChatMessage[]> {
        this.validateUser(user);
        const userId = user.id;
        const key = sessionId ? `${userId}-${sessionId}` : userId;
        return this.conversations.get(key) || [];
    }

    /**
     * Add a message to user's conversation
     */
    async addMessage(user: PotoUser, message: ChatMessage, sessionId?: string): Promise<void> {
        this.validateUser(user);
        this.validateMessage(message);
        
        const userId = user.id;
        const key = sessionId ? `${userId}-${sessionId}` : userId;
        let conversation = this.conversations.get(key) || [];
        
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
        
        this.conversations.set(key, conversation);
    }

    /**
     * Add multiple messages to user's conversation
     */
    async addMessages(user: PotoUser, messages: ChatMessage[], sessionId?: string): Promise<void> {
        this.validateUser(user);
        messages.forEach(msg => this.validateMessage(msg));
        
        const userId = user.id;
        const key = sessionId ? `${userId}-${sessionId}` : userId;
        let conversation = this.conversations.get(key) || [];
        
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
    async clearConversation(user: PotoUser, sessionId?: string): Promise<void> {
        this.validateUser(user);
        const userId = user.id;
        const key = sessionId ? `${userId}-${sessionId}` : userId;
        this.conversations.delete(key);
    }

    /**
     * Get system statistics
     */
    async getStats(): Promise<DialogueJournalStats> {
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
            totalArchivedConversations: 0, // Not supported
            averageMessagesPerUser,
            storageUsage: memoryUsage,
            backend: 'memory',
            lastCleanup: new Date().toISOString()
        };
    }

    /**
     * Cleanup old conversations and inactive users
     */
    async cleanup(options: CleanupOptions): Promise<CleanupResult> {
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
     * Export conversation as JSON or CSV
     */
    async exportConversation(user: PotoUser, format: 'json' | 'csv'): Promise<string> {
        this.validateUser(user);
        const conversation = await this.getConversation(user);
        
        if (format === 'json') {
            return JSON.stringify({
                userId: user.id,
                timestamp: new Date().toISOString(),
                messageCount: conversation.length,
                messages: conversation
            }, null, 2);
        } else {
            // CSV format
            const headers = ['timestamp', 'role', 'content'];
            const rows = conversation.map(msg => [
                msg.timestamp,
                msg.role,
                `"${msg.content.replace(/"/g, '""')}"` // Escape quotes
            ]);
            
            return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        }
    }

    /**
     * Import conversation from JSON or CSV
     */
    async importConversation(user: PotoUser, data: string, format: 'json' | 'csv'): Promise<boolean> {
        this.validateUser(user);
        
        try {
            let messages: ChatMessage[];
            
            if (format === 'json') {
                const parsed = JSON.parse(data);
                messages = parsed.messages || [];
            } else {
                // CSV format
                const lines = data.split('\n');
                const headers = lines[0].split(',');
                messages = lines.slice(1).map(line => {
                    const values = line.split(',');
                    return {
                        role: values[1] as 'user' | 'assistant' | 'system',
                        content: values[2].replace(/^"|"$/g, '').replace(/""/g, '"'),
                        timestamp: values[0]
                    };
                });
            }
            
            // Validate messages
            messages.forEach(msg => this.validateMessage(msg));
            
            // Add messages
            await this.addMessages(user, messages);
            
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    }

    /**
     * Start automatic cleanup scheduler
     */
    private startAutomaticCleanup(): void {
        // Run cleanup every hour
        this.cleanupInterval = setInterval(() => {
            this.performAutomaticCleanup();
        }, 60 * 60 * 1000); // 1 hour
        
        console.log('VolatileMemoryDialogueJournal: Automatic cleanup started (every hour)');
    }

    /**
     * Stop automatic cleanup
     */
    stopAutomaticCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('VolatileMemoryDialogueJournal: Automatic cleanup stopped');
        }
    }

    /**
     * Perform automatic cleanup based on age and inactivity
     */
    private async performAutomaticCleanup(): Promise<void> {
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
            console.log(`VolatileMemoryDialogueJournal: Cleanup completed - Removed ${usersRemoved} users, ${messagesRemoved} messages`);
        }
    }
}
