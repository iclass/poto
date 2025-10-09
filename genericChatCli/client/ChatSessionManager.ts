import { ColorUtils } from "./ColorUtils";
import { MarkdownParser } from "./MarkdownParser";
import { CredentialManager, StoredCredentials } from "./CredentialManager";
import type { ChatServerModule } from "../server/ChatServerModule";
import type { ModelInfo } from "../shared/types";
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

export interface ChatSessionManagerDependencies {
    chatServerModuleProxy: ChatServerModule;
    rl: readline.Interface;
    currentUser?: string;
    isAuthenticated: boolean;
    isConnected: boolean;
    currentModel: ModelInfo | null;
    currentTopicTitle?: string;
}

export interface ChatSessionManagerCallbacks {
    updatePrompt: () => void;
    updateCurrentModel: () => Promise<void>;
    promptInput: (prompt: string, hidden?: boolean) => Promise<string>;
    setCurrentTopicTitle: (title?: string) => void;
    loginWithCredentials: (userId: string, password: string) => Promise<void>;
    setAuthenticationState: (authenticated: boolean, connected: boolean, user?: string) => void;
}

export class ChatSessionManager {
    private deps: ChatSessionManagerDependencies;
    private callbacks: ChatSessionManagerCallbacks;

    constructor(deps: ChatSessionManagerDependencies, callbacks: ChatSessionManagerCallbacks) {
        this.deps = deps;
        this.callbacks = callbacks;
    }

    /**
     * Handle login command
     */
    async handleLogin(showPrompt: boolean = true): Promise<void> {
        try {
            console.log(ColorUtils.info('🔐 Login'));
            
            // Get User ID first
            const userId = await this.callbacks.promptInput('Enter your User ID: ');
            if (!userId.trim()) {
                console.log(ColorUtils.error('❌ User ID cannot be empty'));
                this.deps.rl.prompt();
                return;
            }
            
            // Then get password
            const password = await this.callbacks.promptInput('Enter your Password: ', true);
            if (!password.trim()) {
                console.log(ColorUtils.error('❌ Password cannot be empty'));
                this.deps.rl.prompt();
                return;
            }
            
            // Attempt login
            await this.loginWithCredentials(userId.trim(), password.trim());
            
            // Set authentication state
            this.callbacks.setAuthenticationState(true, true, userId.trim());
            
            // Save credentials
            const credentials: StoredCredentials = {
                username: userId.trim(),
                password: password.trim(),
                serverUrl: 'http://localhost:3799', // TODO: Make this configurable
                lastLogin: new Date().toISOString()
            };
            
            CredentialManager.saveCredentials(credentials);
            
            console.log(ColorUtils.success(`✅ Successfully logged in as: ${userId.trim()}`));
            console.log(ColorUtils.info('💾 Credentials saved for future use'));
            
            // Prompt for system prompt since login creates a new session
            console.log('');
            console.log(ColorUtils.info('🆕 A new chat session has been created. Please set a system prompt:'));
            const systemPrompt = await this.callbacks.promptInput('Enter system prompt for this session (or press Enter for no system prompt): ');
            const finalSystemPrompt = systemPrompt.trim();
            
            if (finalSystemPrompt) {
                // Start new session on server with the system prompt
                const success = await this.deps.chatServerModuleProxy.startNewConversation(finalSystemPrompt);
                
                if (success) {
                    // Clear the current topic title for new session
                    this.callbacks.setCurrentTopicTitle(undefined);
                    this.callbacks.updatePrompt();
                    
                    console.log(ColorUtils.success('✅ Session started with system prompt'));
                    console.log(ColorUtils.info(`🎯 System prompt: ${ColorUtils.system(finalSystemPrompt)}`));
                } else {
                    console.log(ColorUtils.error('❌ Failed to set system prompt'));
                }
            } else {
                console.log(ColorUtils.info('ℹ️  No system prompt set - using raw model behavior'));
            }
            
        } catch (error) {
            console.error(ColorUtils.error('❌ Login failed:'), error);
        }
        
        if (showPrompt) {
            this.deps.rl.prompt();
        }
    }

    /**
     * Login with user ID and password using PotoClient's built-in login method
     */
    private async loginWithCredentials(userId: string, password: string): Promise<void> {
        try {
            // Use the callback to delegate to the main client
            await this.callbacks.loginWithCredentials(userId, password);
        } catch (error) {
            throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle logout command
     */
    async handleLogout(): Promise<void> {
        try {
            // Clear stored credentials
            CredentialManager.clearCredentials();
            
            console.log(ColorUtils.success('✅ Logged out successfully'));
            console.log(ColorUtils.info('🗑️  Stored credentials cleared'));
            console.log(ColorUtils.info('🔄 All settings reset to defaults'));
            console.log('');
            console.log(ColorUtils.info('🔐 Please use the "/login" command to continue.'));
            
        } catch (error) {
            console.error(ColorUtils.error('❌ Logout failed:'), error);
        }
    }

    /**
     * Show conversation history from server-side DialogueJournal
     */
    async showConversationHistory(): Promise<void> {
        try {
            const history = await this.deps.chatServerModuleProxy.getConversationHistory();
            
            if (history.length === 0) {
                console.log(ColorUtils.info('📝 No conversation history yet.'));
            } else {
                console.log(ColorUtils.info('📝 Conversation History (Server-side):'));
                history.forEach((msg, index) => {
                    const role = msg.role === 'user' ? ColorUtils.user('👤 You') : ColorUtils.ai('🤖 AI');
                    let content = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
                    
                    // Apply markdown formatting for AI messages
                    if (msg.role === 'assistant') {
                        content = MarkdownParser.parseWithAiColor(content);
                    } else {
                        content = ColorUtils.user(content);
                    }
                    
                    console.log(`  ${index + 1}. ${role}: ${content}`);
                });
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to get conversation history:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * List all available topics
     */
    async listTopics(): Promise<void> {
        try {
            console.log(ColorUtils.info('📋 Fetching topics...'));
            const conversations = await this.deps.chatServerModuleProxy.listConversations();
            
            if (conversations.length === 0) {
                console.log(ColorUtils.info('ℹ️  No topics found.'));
                this.deps.rl.prompt();
                return;
            }

            console.log(ColorUtils.info(`📋 Available Topics (${conversations.length}):`));
            console.log('');

            conversations.forEach((topic, index) => {
                const lastActivity = new Date(topic.lastActivity).toLocaleString();
                const status = topic.isArchived ? '📦 Archived' : '💬 Active';
                const archivedInfo = topic.isArchived ? ` (archived: ${new Date(topic.archivedAt!).toLocaleString()})` : '';
                
                console.log(ColorUtils.system(`[${index + 1}] ${status} - ${topic.title}`));
                console.log(ColorUtils.info(`    Session: ${topic.conversationId}`));
                console.log(ColorUtils.info(`    Messages: ${topic.messageCount} | Last: ${lastActivity}${archivedInfo}`));
                if (topic.systemPrompt) {
                    console.log(ColorUtils.info(`    System: ${topic.systemPrompt.substring(0, 100)}${topic.systemPrompt.length > 100 ? '...' : ''}`));
                }
                console.log('');
            });

            this.deps.rl.prompt();
        } catch (error) {
            console.error('❌ Error fetching topics:', error);
            this.deps.rl.prompt();
        }
    }

    /**
     * List archived topics
     */
    async listArchivedTopics(): Promise<void> {
        try {
            console.log(ColorUtils.info('📦 Fetching archived topics...'));
            const archivedTopics = await this.deps.chatServerModuleProxy.listArchivedTopics();
            
            if (archivedTopics.length === 0) {
                console.log(ColorUtils.info('ℹ️  No archived topics found.'));
                this.deps.rl.prompt();
                return;
            }

            console.log(ColorUtils.info(`📦 Archived Topics (${archivedTopics.length}):`));
            console.log('');

            archivedTopics.forEach((topic, index) => {
                const archivedAt = new Date(topic.archivedAt).toLocaleString();
                const lastActivity = new Date(topic.lastActivity).toLocaleString();
                
                console.log(ColorUtils.system(`[${index + 1}] 📦 ${topic.title}`));
                console.log(ColorUtils.info(`    Session: ${topic.conversationId}`));
                console.log(ColorUtils.info(`    Messages: ${topic.messageCount} | Last: ${lastActivity}`));
                console.log(ColorUtils.info(`    Archived: ${archivedAt}`));
                console.log('');
            });

            this.deps.rl.prompt();
        } catch (error) {
            console.error('❌ Error fetching archived topics:', error);
            this.deps.rl.prompt();
        }
    }

    /**
     * Archive a specific topic
     */
    async archiveTopic(conversationId: string): Promise<void> {
        try {
            console.log(ColorUtils.info(`📦 Archiving topic: ${conversationId}...`));
            const success = await this.deps.chatServerModuleProxy.archiveTopic(conversationId);
            
            if (success) {
                console.log(ColorUtils.success('✅ Topic archived successfully.'));
            } else {
                console.log(ColorUtils.error('❌ Failed to archive topic.'));
            }
            
            this.deps.rl.prompt();
        } catch (error) {
            console.error('❌ Error archiving topic:', error);
            this.deps.rl.prompt();
        }
    }

    /**
     * Archive current topic
     */
    async archiveCurrentTopic(): Promise<void> {
        try {
            console.log(ColorUtils.info('📦 Archiving current topic...'));
            const success = await this.deps.chatServerModuleProxy.archiveCurrentTopic();
            
            if (success) {
                console.log(ColorUtils.success('✅ Current topic archived successfully.'));
            } else {
                console.log(ColorUtils.error('❌ Failed to archive current topic.'));
            }
            
            this.deps.rl.prompt();
        } catch (error) {
            console.error('❌ Error archiving current topic:', error);
            this.deps.rl.prompt();
        }
    }

    /**
     * Restore an archived topic
     */
    async restoreArchivedTopic(conversationId: string): Promise<void> {
        try {
            console.log(ColorUtils.info(`🔄 Restoring archived topic: ${conversationId}...`));
            const newSessionId = await this.deps.chatServerModuleProxy.restoreArchivedTopic(conversationId);
            
            if (newSessionId) {
                console.log(ColorUtils.success(`✅ Topic restored as new session: ${newSessionId}`));
            } else {
                console.log(ColorUtils.error('❌ Failed to restore archived topic.'));
            }
            
            this.deps.rl.prompt();
        } catch (error) {
            console.error('❌ Error restoring archived topic:', error);
            this.deps.rl.prompt();
        }
    }

    /**
     * Delete an archived topic permanently
     */
    async deleteArchivedTopic(conversationId: string): Promise<void> {
        try {
            console.log(ColorUtils.info(`🗑️  Deleting archived topic: ${conversationId}...`));
            const success = await this.deps.chatServerModuleProxy.deleteArchivedTopic(conversationId);
            
            if (success) {
                console.log(ColorUtils.success('✅ Archived topic deleted permanently.'));
            } else {
                console.log(ColorUtils.error('❌ Failed to delete archived topic.'));
            }
            
            this.deps.rl.prompt();
        } catch (error) {
            console.error('❌ Error deleting archived topic:', error);
            this.deps.rl.prompt();
        }
    }

    /**
     * Start a new chat session with system prompt
     */
    async startNewSession(): Promise<void> {
        try {
            console.log(ColorUtils.info('🆕 Starting new chat session...'));
            console.log(ColorUtils.info('💡 This will clear the current conversation and start fresh.'));
            console.log('');
            
            // Get system prompt from user
            const systemPrompt = await this.callbacks.promptInput('Enter system prompt for the new session (or press Enter for default): ');
            const finalSystemPrompt = systemPrompt.trim();
            
            console.log('');
            console.log(ColorUtils.info('🔄 Starting new session...'));
            
            // Start new session on server
            const success = await this.deps.chatServerModuleProxy.startNewConversation(finalSystemPrompt);
            
            if (success) {
                // Clear the current topic title for new session
                this.callbacks.setCurrentTopicTitle(undefined);
                this.callbacks.updatePrompt();
                
                console.log(ColorUtils.success('✅ New chat session started successfully'));
                console.log(ColorUtils.info(`🎯 System prompt: ${ColorUtils.system(finalSystemPrompt)}`));
                console.log(ColorUtils.info('💬 You can now start chatting with the new system prompt in effect.'));
            } else {
                console.log(ColorUtils.error('❌ Failed to start new session'));
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to start new session:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * Show conversation statistics
     */
    async showConversationStats(): Promise<void> {
        try {
            const stats = await this.deps.chatServerModuleProxy.getConversationStats();
            
            console.log(ColorUtils.info('📊 Conversation Statistics:'));
            console.log(`  Total Messages: ${ColorUtils.success(stats.messageCount.toString())}`);
            console.log(`  User Messages: ${ColorUtils.user(stats.userMessageCount.toString())}`);
            console.log(`  AI Messages: ${ColorUtils.ai(stats.assistantMessageCount.toString())}`);
            
            if (stats.firstMessageTime) {
                console.log(`  First Message: ${ColorUtils.system(stats.firstMessageTime)}`);
            }
            if (stats.lastMessageTime) {
                console.log(`  Last Message: ${ColorUtils.system(stats.lastMessageTime)}`);
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to get conversation statistics:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * Export conversation as JSON
     */
    async exportConversation(): Promise<void> {
        try {
            const jsonData = await this.deps.chatServerModuleProxy.exportConversation();
            
            // Save to file
            const filename = `conversation_export_${new Date().toISOString().split('T')[0]}.json`;
            const exportPath = path.join(__dirname, '..', filename);
            fs.writeFileSync(exportPath, jsonData);
            
            console.log(ColorUtils.success(`✅ Conversation exported to: ${filename}`));
            console.log(ColorUtils.info(`📁 Full path: ${exportPath}`));
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to export conversation:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * Show recent messages
     */
    async showRecentMessages(count: number): Promise<void> {
        try {
            const recentMessages = await this.deps.chatServerModuleProxy.getRecentMessages(count);
            
            if (recentMessages.length === 0) {
                console.log(ColorUtils.info('📝 No recent messages found.'));
            } else {
                console.log(ColorUtils.info(`📝 Recent Messages (Last ${count}):`));
                recentMessages.forEach((msg, index) => {
                    const role = msg.role === 'user' ? ColorUtils.user('👤 You') : ColorUtils.ai('🤖 AI');
                    let content = msg.content.substring(0, 150) + (msg.content.length > 150 ? '...' : '');
                    
                    // Apply markdown formatting for AI messages
                    if (msg.role === 'assistant') {
                        content = MarkdownParser.parseWithAiColor(content);
                    } else {
                        content = ColorUtils.user(content);
                    }
                    
                    console.log(`  ${index + 1}. ${role}: ${content}`);
                });
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to get recent messages:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * Show memory statistics
     */
    async showMemoryStats(): Promise<void> {
        try {
            const stats = await this.deps.chatServerModuleProxy.getMemoryStats();
            
            console.log(ColorUtils.info('🧠 Memory Statistics:'));
            console.log(`  Total Users: ${ColorUtils.success(stats.totalUsers.toString())}`);
            console.log(`  Total Messages: ${ColorUtils.success(stats.totalMessages.toString())}`);
            console.log(`  Memory Usage: ${ColorUtils.system(this.formatBytes(stats.memoryUsage))}`);
            console.log(`  Average Messages/User: ${ColorUtils.system(stats.averageMessagesPerUser.toFixed(2))}`);
            console.log(`  Inactive Users: ${ColorUtils.warning(stats.inactiveUsers.toString())}`);
            
            if (stats.oldestMessage) {
                const oldestDate = new Date(stats.oldestMessage);
                console.log(`  Oldest Message: ${ColorUtils.system(oldestDate.toLocaleString())}`);
            }
            if (stats.newestMessage) {
                const newestDate = new Date(stats.newestMessage);
                console.log(`  Newest Message: ${ColorUtils.system(newestDate.toLocaleString())}`);
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to get memory statistics:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * Perform manual cleanup
     */
    async performCleanup(maxAgeHours: number, maxInactiveHours: number, dryRun: boolean = false): Promise<void> {
        try {
            console.log(ColorUtils.info(`🧹 Performing cleanup (${dryRun ? 'DRY RUN' : 'LIVE'})...`));
            console.log(ColorUtils.info(`  Max message age: ${maxAgeHours} hours`));
            console.log(ColorUtils.info(`  Max inactive time: ${maxInactiveHours} hours`));
            
            const result = await this.deps.chatServerModuleProxy.performCleanup({
                maxAgeHours,
                maxInactiveHours,
                dryRun
            });
            
            console.log(ColorUtils.success('✅ Cleanup completed:'));
            console.log(`  Users removed: ${ColorUtils.warning(result.usersRemoved.toString())}`);
            console.log(`  Messages removed: ${ColorUtils.warning(result.messagesRemoved.toString())}`);
            console.log(`  Memory freed: ${ColorUtils.success(this.formatBytes(result.memoryFreed))}`);
            
            if (dryRun) {
                console.log(ColorUtils.info('💡 This was a dry run. Use without "dry" to perform actual cleanup.'));
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to perform cleanup:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * Force cleanup with default settings
     */
    async forceCleanup(): Promise<void> {
        try {
            console.log(ColorUtils.warning('🧹 Force cleanup with default settings (24h age, 72h inactive)...'));
            
            const result = await this.deps.chatServerModuleProxy.forceCleanup(24, 72);
            
            console.log(ColorUtils.success('✅ Force cleanup completed:'));
            console.log(`  Users removed: ${ColorUtils.warning(result.usersRemoved.toString())}`);
            console.log(`  Messages removed: ${ColorUtils.warning(result.messagesRemoved.toString())}`);
            console.log(`  Memory freed: ${ColorUtils.success(this.formatBytes(result.memoryFreed))}`);
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to perform force cleanup:'), error);
        }
        
        this.deps.rl.prompt();
    }

    /**
     * Format bytes to human readable format
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Request topic title generation from server and wait for completion
     */
    async requestTopicTitleGeneration(): Promise<void> {
        try {
            const response = await this.deps.chatServerModuleProxy.generateConversationTitle();
            if (response && response.title) {
                // Display the generated title and update prompt
                this.displayTopicTitle(response.title);
            }
        } catch (error) {
            // Silently fail - topic title is optional
        }
    }

    /**
     * Display topic title to user and update prompt
     */
    private displayTopicTitle(title: string): void {
        this.callbacks.setCurrentTopicTitle(title);
        // Update the prompt to show the new topic title (silently)
        this.callbacks.updatePrompt();
    }
}
