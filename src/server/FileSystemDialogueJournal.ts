import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseDialogueJournal, ChatMessage, DialogueJournalStats, CleanupOptions, CleanupResult, ArchivedConversation, ConversationSummary } from './DialogueJournal';
import { PotoUser } from './UserProvider';

export interface FileSystemDialogueJournalConfig {
    root: string;
    maxConversationLength: number;
    maxConversationsPerUser: number;
    archiveThreshold: number;
    retentionDays: number;
    lockTimeoutMs: number;
    serverId: string;
    shardLevels?: number; // Number of sharding levels (default: 2)
    shardSize?: number; // Characters per shard level (default: 2)
}

/**
 * High-performance file system-based dialogue journal
 * Uses raw file operations with YAML format for maximum performance
 * Supports multi-server access with OS file locking
 * 
 * Features user directory sharding to handle hundreds of thousands of users:
 * - Configurable shard levels and size for optimal distribution
 * - Hierarchical directory structure (e.g., users/0/123/userId)
 * - Automatic shard path generation based on user ID hash
 * - Recursive directory traversal for stats and cleanup operations
 */
export class FileSystemDialogueJournal extends BaseDialogueJournal {
    private rootPath: string;
    private serverId: string;
    private lockTimeout: number;
    private archiveThreshold: number;
    private retentionDays: number;
    private shardLevels: number;
    private shardSize: number;

    constructor(config: FileSystemDialogueJournalConfig) {
        super(
            config.maxConversationLength,
            config.maxConversationsPerUser,
            24 * 7, // 7 days
            24 * 30  // 30 days
        );
        
        this.rootPath = config.root;
        this.serverId = config.serverId;
        this.lockTimeout = config.lockTimeoutMs;
        this.archiveThreshold = config.archiveThreshold;
        this.retentionDays = config.retentionDays;
        this.shardLevels = config.shardLevels || 2;
        this.shardSize = config.shardSize || 2;
        
        // Ensure root directory exists
        this.ensureDirectoryExists(this.rootPath);
    }

    /**
     * Get user's conversation history
     */
    async getConversation(user: PotoUser): Promise<ChatMessage[]> {
        this.validateUser(user);
        const conversationPath = this.getConversationPath(user);
        
        try {
            const content = await fs.readFile(conversationPath, 'utf-8');
            if (!content.trim()) return [];
            
            // Parse multiple YAML documents using Bun's built-in parser
            const documents = (Bun as any).YAML.parse(content) as ChatMessage[];
            return Array.isArray(documents) ? documents : [documents];
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return []; // File doesn't exist yet
            }
            throw error;
        }
    }

    /**
     * Add a single message to user's conversation
     */
    async addMessage(user: PotoUser, message: ChatMessage): Promise<void> {
        this.validateUser(user);
        this.validateMessage(message);
        
        const conversationPath = this.getConversationPath(user);
        
        // Ensure directory exists
        await this.ensureDirectoryExists(path.dirname(conversationPath));
        
        await this.withAppendLock(conversationPath, async () => {
            // Check if file exists to determine if we need to start a new list
            const fileExists = await fs.exists(conversationPath);
            let yamlDoc = this.formatMessageAsYAML(message);
            
            if (!fileExists) {
                // First message - start the YAML list
                yamlDoc = yamlDoc;
            } else {
                // Subsequent messages - just append to the list
                yamlDoc = '\n' + yamlDoc;
            }
            
            await fs.appendFile(conversationPath, yamlDoc);
        });

        // Check if we need to archive
        await this.checkAndArchiveIfNeeded(user);
    }

    /**
     * Add multiple messages to user's conversation (batch operation)
     */
    async addMessages(user: PotoUser, messages: ChatMessage[]): Promise<void> {
        this.validateUser(user);
        messages.forEach(msg => this.validateMessage(msg));
        
        const conversationPath = this.getConversationPath(user);
        
        // Ensure directory exists
        await this.ensureDirectoryExists(path.dirname(conversationPath));
        
        await this.withAppendLock(conversationPath, async () => {
            // Check if file exists to determine if we need to start a new list
            const fileExists = await fs.exists(conversationPath);
            
            // Batch append for multiple messages - much faster
            const yamlDocs = messages.map((msg, index) => {
                const formatted = this.formatMessageAsYAML(msg);
                if (!fileExists && index === 0) {
                    // First message of first batch - no prefix
                    return formatted;
                } else {
                    // Subsequent messages - add newline prefix
                    return '\n' + formatted;
                }
            }).join('');
            
            await fs.appendFile(conversationPath, yamlDocs);
        });

        // Check if we need to archive
        await this.checkAndArchiveIfNeeded(user);
    }

    /**
     * Clear user's conversation history
     */
    async clearConversation(user: PotoUser): Promise<void> {
        this.validateUser(user);
        const conversationPath = this.getConversationPath(user);
        
        try {
            await fs.unlink(conversationPath);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Archive user's current conversation
     */
    async archiveConversation(user: PotoUser, conversationId?: string): Promise<string> {
        this.validateUser(user);
        
        const conversation = await this.getConversation(user);
        if (conversation.length === 0) {
            throw new Error('No conversation to archive');
        }

        const archiveId = conversationId || `archive-${new Date().toLocaleString('sv-SE').replace(/[:.]/g, '-')}`;
        const archivePath = this.getArchivePath(user, archiveId);
        
        // Ensure archive directory exists
        await this.ensureDirectoryExists(this.getArchiveDirectory(user));
        
        // Move current conversation to archive
        const currentPath = this.getConversationPath(user);
        await fs.rename(currentPath, archivePath);
        
        // Create new empty conversation file
        await this.ensureDirectoryExists(path.dirname(currentPath));
        await fs.writeFile(currentPath, '');
        
        return archiveId;
    }

    /**
     * Get user's archived conversations
     */
    async getArchivedConversations(user: PotoUser): Promise<ArchivedConversation[]> {
        this.validateUser(user);
        const archiveDir = this.getArchiveDirectory(user);
        
        try {
            const files = await fs.readdir(archiveDir);
            const archives: ArchivedConversation[] = [];
            
            for (const file of files) {
                if (file.endsWith('.yaml')) {
                    const archivePath = path.join(archiveDir, file);
                    const stats = await fs.stat(archivePath);
                    const content = await fs.readFile(archivePath, 'utf-8');
                    
                    // Parse to get message count and times
                    const messages = (Bun as any).YAML.parse(content) as ChatMessage[];
                    const messageArray = Array.isArray(messages) ? messages : [messages];
                    
                    archives.push({
                        id: file.replace('.yaml', ''),
                        userId: user.id,
                        archivedAt: stats.mtime.toISOString(),
                        messageCount: messageArray.length,
                        firstMessageTime: messageArray[0]?.timestamp || stats.mtime.toISOString(),
                        lastMessageTime: messageArray[messageArray.length - 1]?.timestamp || stats.mtime.toISOString(),
                        size: stats.size
                    });
                }
            }
            
            return archives.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    /**
     * Restore an archived conversation
     */
    async restoreConversation(user: PotoUser, archiveId: string): Promise<void> {
        this.validateUser(user);
        
        const archivePath = this.getArchivePath(user, archiveId);
        const currentPath = this.getConversationPath(user);
        
        try {
            // Check if archive exists
            await fs.access(archivePath);
            
            // Move archive back to current
            await fs.rename(archivePath, currentPath);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw new Error(`Archive ${archiveId} not found`);
            }
            throw error;
        }
    }

    /**
     * Get system statistics
     */
    async getStats(): Promise<DialogueJournalStats> {
        let totalUsers = 0;
        let totalMessages = 0;
        let totalArchivedConversations = 0;
        let storageUsage = 0;
        let oldestMessage: string | undefined;
        let newestMessage: string | undefined;

        try {
            const userDirs = await this.traverseShardedDirectories();
            totalUsers = userDirs.length;

            for (const userPath of userDirs) {
                const currentPath = path.join(userPath, 'dialogs', 'current.yaml');
                const archiveDir = path.join(userPath, 'dialogs', 'archived');

                // Count current conversation messages
                try {
                    const content = await fs.readFile(currentPath, 'utf-8');
                    if (content.trim()) {
                        const messages = (Bun as any).YAML.parse(content) as ChatMessage[];
                        const messageArray = Array.isArray(messages) ? messages : [messages];
                        totalMessages += messageArray.length;
                        storageUsage += content.length;

                        // Track oldest and newest messages
                        for (const msg of messageArray) {
                            if (!oldestMessage || msg.timestamp < oldestMessage) {
                                oldestMessage = msg.timestamp;
                            }
                            if (!newestMessage || msg.timestamp > newestMessage) {
                                newestMessage = msg.timestamp;
                            }
                        }
                    }
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Error reading conversation for user ${path.basename(userPath)}:`, error.message);
                    }
                }

                // Count archived conversations
                try {
                    const archiveFiles = await fs.readdir(archiveDir);
                    totalArchivedConversations += archiveFiles.filter(f => f.endsWith('.yaml')).length;
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Error reading archives for user ${path.basename(userPath)}:`, error.message);
                    }
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        return {
            totalUsers,
            totalMessages,
            totalArchivedConversations,
            averageMessagesPerUser: totalUsers > 0 ? totalMessages / totalUsers : 0,
            storageUsage,
            oldestMessage,
            newestMessage,
            backend: 'filesystem',
            lastCleanup: new Date().toISOString()
        };
    }

    /**
     * Cleanup old conversations and archives
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

        try {
            const userDirs = await this.traverseShardedDirectories();

            for (const userPath of userDirs) {
                const currentPath = path.join(userPath, 'dialogs', 'current.yaml');
                const archiveDir = path.join(userPath, 'dialogs', 'archived');

                // Check current conversation
                try {
                    const stats = await fs.stat(currentPath);
                    const lastModified = stats.mtime.getTime();
                    const isInactive = (now.getTime() - lastModified) > maxInactiveMs;

                    if (isInactive) {
                        if (!dryRun) {
                            await fs.unlink(currentPath);
                        }
                        usersRemoved++;
                    } else {
                        // Check for old messages in current conversation
                        const content = await fs.readFile(currentPath, 'utf-8');
                        if (content.trim()) {
                            const messages = (Bun as any).YAML.parse(content) as ChatMessage[];
                            const messageArray = Array.isArray(messages) ? messages : [messages];
                            
                            const recentMessages = messageArray.filter(msg => {
                                const messageAge = now.getTime() - new Date(msg.timestamp).getTime();
                                return messageAge <= maxAgeMs;
                            });

                            if (recentMessages.length !== messageArray.length) {
                                if (!dryRun) {
                                    const yamlDocs = recentMessages.map(msg => 
                                        (Bun as any).YAML.stringify(msg, null, 2) + '---\n'
                                    ).join('');
                                    await fs.writeFile(currentPath, yamlDocs);
                                    memoryFreed += content.length - yamlDocs.length;
                                } else {
                                    memoryFreed += content.length;
                                }
                                messagesRemoved += messageArray.length - recentMessages.length;
                            }
                        }
                    }
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Error processing user ${path.basename(userPath)}:`, error.message);
                    }
                }

                // Clean up old archives
                try {
                    const archiveFiles = await fs.readdir(archiveDir);
                    for (const file of archiveFiles) {
                        if (file.endsWith('.yaml')) {
                            const archivePath = path.join(archiveDir, file);
                            const stats = await fs.stat(archivePath);
                            const archiveAge = now.getTime() - stats.mtime.getTime();
                            
                            if (archiveAge > maxAgeMs) {
                                if (!dryRun) {
                                    await fs.unlink(archivePath);
                                }
                                messagesRemoved++;
                                memoryFreed += stats.size;
                            }
                        }
                    }
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Error processing archives for user ${path.basename(userPath)}:`, error.message);
                    }
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
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
                        role: values[1] as 'user' | 'assistant',
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

    // Private helper methods

    /**
     * Generate shard path for a user ID using human-readable prefix-based sharding
     * Creates a hierarchical structure based on user ID prefixes for easy navigation
     * Examples:
     * - "user123" -> "users/u/s/user123" (2 levels, 1 char per level)
     * - "abc123" -> "users/a/ab/abc123" (2 levels, 1 char per level)
     * - "user123" -> "users/us/user123" (1 level, 2 chars)
     */
    private getUserShardPath(userId: string): string {
        if (!userId || userId.length === 0) {
            // Fallback for empty/invalid user IDs
            return path.join('users', 'misc', userId);
        }
        
        const shardParts: string[] = [];
        let currentPos = 0;
        
        // Generate shard levels based on user ID prefixes
        for (let level = 0; level < this.shardLevels && currentPos < userId.length; level++) {
            // Take characters for this shard level
            const charsToTake = Math.min(this.shardSize, userId.length - currentPos);
            const shardPrefix = userId.substring(currentPos, currentPos + charsToTake);
            shardParts.push(shardPrefix);
            currentPos += charsToTake;
        }
        
        // If we have remaining characters, include them in the final part
        if (currentPos < userId.length) {
            const remaining = userId.substring(currentPos);
            shardParts.push(remaining);
        } else {
            // If we've used all characters in shard levels, just use the full ID
            shardParts.push(userId);
        }
        
        return path.join('users', ...shardParts);
    }

    /**
     * Recursively traverse sharded user directories
     * Returns array of user directory paths
     */
    private async traverseShardedDirectories(): Promise<string[]> {
        const usersDir = path.join(this.rootPath, 'users');
        const userDirs: string[] = [];
        
        try {
            await this.traverseDirectoryRecursive(usersDir, userDirs);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        
        return userDirs;
    }

    /**
     * Recursively traverse a directory to find user directories
     * A user directory is identified by containing a 'dialogs' subdirectory
     */
    private async traverseDirectoryRecursive(dirPath: string, userDirs: string[]): Promise<void> {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Check if this directory contains a 'dialogs' subdirectory (user directory)
                    try {
                        const dialogsPath = path.join(fullPath, 'dialogs');
                        const dialogsStat = await fs.stat(dialogsPath);
                        if (dialogsStat.isDirectory()) {
                            userDirs.push(fullPath);
                        } else {
                            // Continue traversing if it's not a user directory
                            await this.traverseDirectoryRecursive(fullPath, userDirs);
                        }
                    } catch (error: any) {
                        if (error.code === 'ENOENT') {
                            // No dialogs directory, continue traversing
                            await this.traverseDirectoryRecursive(fullPath, userDirs);
                        } else {
                            throw error;
                        }
                    }
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }


    private getConversationPath(user: PotoUser): string {
        const userShardPath = this.getUserShardPath(user.id);
        return path.join(this.rootPath, userShardPath, 'dialogs', 'current.yaml');
    }

    private getArchiveDirectory(user: PotoUser): string {
        const userShardPath = this.getUserShardPath(user.id);
        return path.join(this.rootPath, userShardPath, 'dialogs', 'archived');
    }

    private getArchivePath(user: PotoUser, archiveId: string): string {
        return path.join(this.getArchiveDirectory(user), `${archiveId}.yaml`);
    }

    private formatMessageAsYAML(message: ChatMessage): string {
        // Use YAML list item format with text block notation for content
        const lines = [
            `- role: ${message.role}`,
            `  content: |`,
            ...message.content.split('\n').map(line => `    ${line}`),
            `  timestamp: ${message.timestamp}`
        ];
        
        // Add metadata if present
        if (message.metadata) {
            lines.push('  metadata:');
            this.addMetadataToYAML(lines, message.metadata, 2);
        }
        
        return lines.join('\n');
    }

    private addMetadataToYAML(lines: string[], obj: any, indentLevel: number): void {
        const indent = '  '.repeat(indentLevel);
        
        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                lines.push(`${indent}${key}: null`);
            } else if (typeof value === 'string') {
                lines.push(`${indent}${key}: "${value}"`);
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                lines.push(`${indent}${key}: ${value}`);
            } else if (Array.isArray(value)) {
                lines.push(`${indent}${key}: [${value.join(', ')}]`);
            } else if (typeof value === 'object') {
                lines.push(`${indent}${key}:`);
                this.addMetadataToYAML(lines, value, indentLevel + 1);
            } else {
                lines.push(`${indent}${key}: ${value}`);
            }
        }
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    private async withAppendLock<T>(
        filePath: string, 
        operation: () => Promise<T>
    ): Promise<T> {
        // For now, use simple file operations without locking
        // TODO: Implement proper file locking when Bun supports it
        return await operation();
    }

    private async checkAndArchiveIfNeeded(user: PotoUser): Promise<void> {
        const conversation = await this.getConversation(user);
        
        if (conversation.length >= this.archiveThreshold) {
            await this.archiveConversation(user);
        }
    }
}
