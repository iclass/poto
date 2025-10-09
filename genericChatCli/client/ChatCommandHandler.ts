import { ColorUtils } from "./ColorUtils";
import { ChatConfigManager } from "./ChatConfig";
import { MarkdownParser } from "./MarkdownParser";
import { CredentialManager, StoredCredentials } from "./CredentialManager";
import type { ChatServerModule } from "../server/ChatServerModule";
import type { ModelInfo } from "../shared/types";
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

export interface ChatCommandHandlerDependencies {
    chatServerModuleProxy: ChatServerModule;
    rl: readline.Interface;
    currentUser?: string;
    isAuthenticated: boolean;
    isConnected: boolean;
    isProcessingRequest: boolean;
    currentModel: ModelInfo | null;
    jsonOutputMode: boolean;
    reasoningEnabled: boolean;
    streamingEnabled: boolean;
    messageBodyEnabled: boolean;
    verboseMode: boolean;
    currentTopicTitle?: string;
    commandHistory: string[];
    maxHistorySize: number;
}

export interface ChatCommandHandlerCallbacks {
    setJsonOutputMode: (enabled: boolean) => void;
    setReasoningEnabled: (enabled: boolean) => void;
    setStreamingEnabled: (enabled: boolean) => void;
    setMessageBodyEnabled: (enabled: boolean) => void;
    setVerboseMode: (enabled: boolean) => void;
    setAutoCancel: (enabled: boolean) => void;
    requestInterrupt: () => void;
    updatePrompt: () => void;
    updateCurrentModel: () => Promise<void>;
    switchModel: (modelInput: string) => Promise<void>;
    clearModelPreference: () => Promise<void>;
    showMarkdownTest: () => void;
    testNonStreamingCancellation: () => Promise<void>;
    handleLogin: (showPrompt?: boolean) => Promise<void>;
    handleLogout: () => Promise<void>;
    startNewSession: () => Promise<void>;
    showConversationHistory: () => Promise<void>;
    listTopics: () => Promise<void>;
    listArchivedTopics: () => Promise<void>;
    archiveTopic: (conversationId: string) => Promise<void>;
    archiveCurrentTopic: () => Promise<void>;
    restoreArchivedTopic: (conversationId: string) => Promise<void>;
    deleteArchivedTopic: (conversationId: string) => Promise<void>;
    showConversationStats: () => Promise<void>;
    exportConversation: () => Promise<void>;
    showRecentMessages: (count: number) => Promise<void>;
    showMemoryStats: () => Promise<void>;
    performCleanup: (maxAgeHours: number, maxInactiveHours: number, dryRun: boolean) => Promise<void>;
    forceCleanup: () => Promise<void>;
    listAvailableModels: (showPrompt?: boolean) => Promise<void>;
    showCurrentModel: () => Promise<void>;
    fetchImage: (imageUrl: string) => Promise<void>;
    promptInput: (prompt: string, hidden?: boolean) => Promise<string>;
    updateAuthenticationState: (authenticated: boolean, connected: boolean, user?: string) => void;
}

export class ChatCommandHandler {
    private deps: ChatCommandHandlerDependencies;
    private callbacks: ChatCommandHandlerCallbacks;

    constructor(deps: ChatCommandHandlerDependencies, callbacks: ChatCommandHandlerCallbacks) {
        this.deps = deps;
        this.callbacks = callbacks;
    }

    /**
     * Update authentication state in dependencies
     */
    updateAuthenticationState(authenticated: boolean, connected: boolean, user?: string): void {
        this.deps.isAuthenticated = authenticated;
        this.deps.isConnected = connected;
        this.deps.currentUser = user;
    }

    /**
     * Check if input is a command (starts with '/' prefix)
     */
    private isCommand(input: string): boolean {
        return input.startsWith('/');
    }

    /**
     * Add input to history (both command history and readline history for arrow navigation)
     * Maintains chronological order: latest input goes to the END of the array
     */
    private addToHistory(input: string): void {
        // Don't add empty inputs
        if (!input.trim()) {
            return;
        }
        
        // Add to command history (for cmdhistory command) - always append to end
        this.deps.commandHistory.push(input);
        
        // Trim command history if it gets too long
        if (this.deps.commandHistory.length > this.deps.maxHistorySize) {
            this.deps.commandHistory = this.deps.commandHistory.slice(-this.deps.maxHistorySize);
        }
        
        // Add to readline history for arrow key navigation - always append to end
        (this.deps.rl as any).history.push(input);
        
        // Keep readline history manageable (last 50 inputs for arrow navigation)
        if ((this.deps.rl as any).history.length > 50) {
            (this.deps.rl as any).history = (this.deps.rl as any).history.slice(-50);
        }
        
        this.saveCommandHistory();
    }

    /**
     * Save command history to localStorage
     */
    private saveCommandHistory(): void {
        try {
            const historyFile = path.join(__dirname, '..', '.chat_history');
            
            // Keep only the last maxHistorySize commands
            const trimmedHistory = this.deps.commandHistory.slice(-this.deps.maxHistorySize);
            fs.writeFileSync(historyFile, JSON.stringify(trimmedHistory, null, 2));
        } catch (error) {
            console.warn('Could not save command history:', error);
        }
    }

    /**
     * Handles user input processing (commands and chat messages)
     */
    async handleUserInput(message: string): Promise<boolean> {
        if (!message) {
            this.deps.rl.prompt();
            return false;
        }

        // Check for special markdown test command
        if (message.trim() === '/test-markdown' || message.trim() === '/md-test') {
            this.callbacks.showMarkdownTest();
            this.deps.rl.prompt();
            return false;
        }

        // Add ALL user input to history (both commands and chat messages)
        this.addToHistory(message);

        // Handle commands (starting with '/')
        if (this.isCommand(message)) {
            // Strip the '/' prefix for command processing and use the rest as the original message
            message = message.substring(1).trim();
            
            // Allow login and logout commands even when not authenticated
            if (['login', 'logout'].includes(message.toLowerCase())) {
                // These commands will be handled below, no need to check authentication
            } else if (!this.deps.isConnected || !this.deps.isAuthenticated) {
                console.log(ColorUtils.error('❌ Authentication required. Please use the "/login" command to continue.'));
                this.deps.rl.prompt();
                return false;
            }

            await this.executeCommand(message);
            return false; // Command was handled, not a chat message
        }

        // Return true to indicate this is a chat message that should be processed
        return true;
    }

    /**
     * Execute a command
     */
    private async executeCommand(message: string): Promise<void> {
        // Handle special commands
        if (['quit', 'exit', 'bye'].includes(message.toLowerCase())) {
            console.log(ColorUtils.success('👋 Goodbye!'));
            this.deps.rl.close();
            process.exit(0);
            return;
        }

        if (message.toLowerCase() === 'new') {
            await this.callbacks.startNewSession();
            return;
        }

        if (message.toLowerCase() === 'history') {
            await this.callbacks.showConversationHistory();
            return;
        }

        if (message.toLowerCase() === 'topics') {
            await this.callbacks.listTopics();
            return;
        }

        if (message.toLowerCase() === 'archives') {
            await this.callbacks.listArchivedTopics();
            return;
        }

        if (message.toLowerCase().startsWith('archive ')) {
            const conversationId = message.substring(8).trim();
            await this.callbacks.archiveTopic(conversationId);
            return;
        }

        if (message.toLowerCase() === 'archive') {
            await this.callbacks.archiveCurrentTopic();
            return;
        }

        if (message.toLowerCase().startsWith('restore ')) {
            const conversationId = message.substring(8).trim();
            await this.callbacks.restoreArchivedTopic(conversationId);
            return;
        }

        if (message.toLowerCase().startsWith('delete-archive ')) {
            const conversationId = message.substring(15).trim();
            await this.callbacks.deleteArchivedTopic(conversationId);
            return;
        }

        if (message.toLowerCase() === 'cancel') {
            if (this.deps.isProcessingRequest) {
                this.callbacks.requestInterrupt();
                console.log(ColorUtils.success('✅ Request cancelled successfully.'));
            } else {
                console.log(ColorUtils.info('ℹ️  No active request to cancel.'));
            }
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'status') {
            if (this.deps.isProcessingRequest) {
                console.log(ColorUtils.info('🔄 Currently processing AI request...'));
            } else {
                console.log(ColorUtils.success('✅ No active requests. Ready for new input.'));
            }
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('autocancel ')) {
            const parts = message.split(' ');
            if (parts.length === 2) {
                const setting = parts[1].toLowerCase();
                
                if (setting === 'on') {
                    this.callbacks.setAutoCancel(true);
                } else if (setting === 'off') {
                    this.callbacks.setAutoCancel(false);
                } else {
                    console.log(ColorUtils.error('❌ Usage: autocancel <on|off>'));
                }
            } else {
                console.log(ColorUtils.error('❌ Usage: autocancel <on|off>'));
            }
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'test-nonstream') {
            await this.callbacks.testNonStreamingCancellation();
            return;
        }

        if (message.toLowerCase() === 'models') {
            await this.callbacks.listAvailableModels();
            return;
        }

        if (message.toLowerCase() === 'model') {
            await this.callbacks.showCurrentModel();
            return;
        }

        if (message.toLowerCase() === 'json') {
            console.log(ColorUtils.info(`📋 JSON output mode: ${this.deps.jsonOutputMode ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'reasoning') {
            console.log(ColorUtils.info(`🧠 Reasoning: ${this.deps.reasoningEnabled ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'streaming') {
            console.log(ColorUtils.info(`📡 Streaming: ${this.deps.streamingEnabled ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'verbose') {
            console.log(ColorUtils.info(`🔍 Verbose mode: ${this.deps.verboseMode ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'messagebody') {
            console.log(ColorUtils.info(`📝 Message body: ${this.deps.messageBodyEnabled ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('reasoning on')) {
            this.callbacks.setReasoningEnabled(true);
            this.callbacks.updatePrompt(); // Update prompt to show new reasoning status
            console.log(ColorUtils.success('✅ Reasoning enabled - AI thinking process will be displayed in real-time'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('reasoning off')) {
            this.callbacks.setReasoningEnabled(false);
            this.callbacks.updatePrompt(); // Update prompt to show new reasoning status
            console.log(ColorUtils.success('✅ Reasoning disabled'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('streaming on')) {
            this.callbacks.setStreamingEnabled(true);
            this.callbacks.updatePrompt(); // Update prompt to show new streaming status
            console.log(ColorUtils.success('✅ Streaming enabled'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('streaming off')) {
            this.callbacks.setStreamingEnabled(false);
            this.callbacks.updatePrompt(); // Update prompt to show new streaming status
            console.log(ColorUtils.success('✅ Streaming disabled'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('verbose on')) {
            this.callbacks.setVerboseMode(true);
            this.callbacks.updatePrompt(); // Update prompt to show new verbose status
            console.log(ColorUtils.success('✅ Verbose mode enabled - HTTP requests and responses will be logged'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('verbose off')) {
            this.callbacks.setVerboseMode(false);
            this.callbacks.updatePrompt(); // Update prompt to show new verbose status
            console.log(ColorUtils.success('✅ Verbose mode disabled'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('messagebody on')) {
            this.callbacks.setMessageBodyEnabled(true);
            await this.deps.chatServerModuleProxy.setLLMDebugMode(true);
            this.callbacks.updatePrompt(); // Update prompt to show new message body status
            console.log(ColorUtils.success('✅ Message body debug enabled - LLM request body will be logged'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('messagebody off')) {
            this.callbacks.setMessageBodyEnabled(false);
            await this.deps.chatServerModuleProxy.setLLMDebugMode(false);
            this.callbacks.updatePrompt(); // Update prompt to show new message body status
            console.log(ColorUtils.success('✅ Message body debug disabled - LLM request body logging turned off'));
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('model ')) {
            const modelInput = message.substring(6).trim();
            await this.callbacks.switchModel(modelInput);
            return;
        }

        if (message.toLowerCase() === 'clear model' || message.toLowerCase() === 'reset model') {
            await this.callbacks.clearModelPreference();
            return;
        }

        if (message.toLowerCase().startsWith('attach ')) {
            const imageUrl = message.substring(7).trim();
            await this.callbacks.fetchImage(imageUrl);
            return;
        }

        if (message.toLowerCase() === 'cmdhistory') {
            if (this.deps.commandHistory.length === 0) {
                console.log(ColorUtils.info('📝 No command history yet.'));
            } else {
                console.log(ColorUtils.info('📝 Command History:'));
                this.deps.commandHistory.forEach((cmd, index) => {
                    console.log(`  ${index + 1}. ${ColorUtils.system(cmd)}`);
                });
            }
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'help') {
            await this.showHelp();
            return;
        }

        if (message.toLowerCase() === 'login') {
            await this.callbacks.handleLogin();
            return;
        }

        if (message.toLowerCase() === 'logout') {
            await this.callbacks.handleLogout();
            return;
        }

        if (message.toLowerCase() === 'convstats') {
            await this.callbacks.showConversationStats();
            return;
        }

        if (message.toLowerCase() === 'export') {
            await this.callbacks.exportConversation();
            return;
        }

        if (message.toLowerCase().startsWith('recent ')) {
            const parts = message.split(' ');
            const count = parts.length > 1 ? parseInt(parts[1]) : 10;
            await this.callbacks.showRecentMessages(count);
            return;
        }

        if (message.toLowerCase() === 'recent') {
            await this.callbacks.showRecentMessages(10);
            return;
        }

        if (message.toLowerCase() === 'memstats') {
            await this.callbacks.showMemoryStats();
            return;
        }

        if (message.toLowerCase().startsWith('cleanup ')) {
            const parts = message.split(' ');
            if (parts.length >= 3) {
                const maxAgeHours = parseInt(parts[1]);
                const maxInactiveHours = parseInt(parts[2]);
                const dryRun = parts[3] === 'dry';
                await this.callbacks.performCleanup(maxAgeHours, maxInactiveHours, dryRun);
            } else {
                console.log(ColorUtils.error('❌ Usage: cleanup <maxAgeHours> <maxInactiveHours> [dry]'));
                console.log(ColorUtils.info('Example: cleanup 24 72 dry (dry run)'));
                console.log(ColorUtils.info('Example: cleanup 24 72 (actual cleanup)'));
            }
            return;
        }

        if (message.toLowerCase() === 'forcecleanup') {
            await this.callbacks.forceCleanup();
            return;
        }

        if (message.toLowerCase().startsWith('system ')) {
            const prompt = message.substring(7); // Remove "system " prefix
            this.setSystemPrompt(prompt);
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('color ')) {
            const parts = message.split(' ');
            if (parts.length === 3) {
                const target = parts[1].toLowerCase();
                const color = parts[2] as any;
                
                if (target === 'ai') {
                    ChatConfigManager.setAiResponseColor(color);
                    console.log(ColorUtils.success(`✅ AI response color changed to ${color}`));
                } else if (target === 'user') {
                    ChatConfigManager.setUserMessageColor(color);
                    console.log(ColorUtils.success(`✅ User message color changed to ${color}`));
                } else if (target === 'reasoning') {
                    ChatConfigManager.setReasoningColor(color);
                    console.log(ColorUtils.success(`✅ Reasoning color changed to ${color}`));
                } else {
                    console.log(ColorUtils.error('❌ Invalid target. Use "ai", "user", or "reasoning"'));
                }
            } else {
                console.log(ColorUtils.error('❌ Usage: color <ai|user|reasoning> <color>'));
                console.log(ColorUtils.info('Example: color reasoning brightBlue'));
            }
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('markdown ')) {
            const parts = message.split(' ');
            if (parts.length === 2) {
                const setting = parts[1].toLowerCase();
                
                if (setting === 'on') {
                    ChatConfigManager.enableMarkdown(true);
                    console.log(ColorUtils.success('✅ Markdown parsing enabled'));
                } else if (setting === 'off') {
                    ChatConfigManager.enableMarkdown(false);
                    console.log(ColorUtils.success('✅ Markdown parsing disabled'));
                } else {
                    console.log(ColorUtils.error('❌ Usage: markdown <on|off>'));
                }
            } else {
                console.log(ColorUtils.error('❌ Usage: markdown <on|off>'));
            }
            this.deps.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('json ')) {
            const parts = message.split(' ');
            if (parts.length === 2) {
                const setting = parts[1].toLowerCase();
                
                if (setting === 'on') {
                    this.callbacks.setJsonOutputMode(true);
                    this.callbacks.updatePrompt(); // Update prompt to show new JSON status
                    console.log(ColorUtils.success('✅ JSON output mode enabled'));
                } else if (setting === 'off') {
                    this.callbacks.setJsonOutputMode(false);
                    this.callbacks.updatePrompt(); // Update prompt to show new JSON status
                    console.log(ColorUtils.success('✅ JSON output mode disabled'));
                } else {
                    console.log(ColorUtils.error('❌ Usage: json <on|off>'));
                }
            } else {
                console.log(ColorUtils.error('❌ Usage: json <on|off>'));
            }
            this.deps.rl.prompt();
            return;
        }
    }

    /**
     * Show help information
     */
    private async showHelp(): Promise<void> {
        console.log(ColorUtils.info('📖 Available Commands (all commands must start with "/"):'));
        console.log(ColorUtils.system('  /quit, /exit, /bye - End the chat session'));
        console.log(ColorUtils.system('  new           - Start new chat session (clears history and sets system prompt)'));
        console.log(ColorUtils.system('  history       - Show conversation history (server-side)'));
        console.log(ColorUtils.system('  topics        - List all available topics/sessions'));
        console.log(ColorUtils.system('  archives      - List archived topics'));
        console.log(ColorUtils.system('  archive       - Archive current topic'));
        console.log(ColorUtils.system('  archive <id>  - Archive specific topic by session ID'));
        console.log(ColorUtils.system('  restore <id>  - Restore archived topic as new session'));
        console.log(ColorUtils.system('  delete-archive <id> - Permanently delete archived topic'));
        console.log(ColorUtils.system('  convstats     - Show conversation statistics'));
        console.log(ColorUtils.system('  export        - Export conversation as JSON'));
        console.log(ColorUtils.system('  recent <n>   - Show recent messages (default: 10)'));
        console.log(ColorUtils.system('  memstats      - Show memory usage statistics'));
        console.log(ColorUtils.system('  cleanup <age> <inactive> [dry] - Manual cleanup (dry run)'));
        console.log(ColorUtils.system('  forcecleanup - Force cleanup with default settings'));
        console.log(ColorUtils.system('  cmdhistory    - Show all command history (stored commands)'));
        console.log(ColorUtils.system('  system <prompt> - Set system prompt'));
        console.log(ColorUtils.system('  color <ai|user|reasoning> <color> - Change colors'));
        console.log(ColorUtils.system('  markdown on|off - Toggle markdown parsing'));
        console.log(ColorUtils.system('  json on|off   - Toggle JSON output mode'));
        console.log(ColorUtils.system('  json          - Show current JSON output mode status'));
        console.log(ColorUtils.system('  reasoning     - Show current reasoning status'));
        console.log(ColorUtils.system('  reasoning on  - Enable reasoning (AI thinking displayed)'));
        console.log(ColorUtils.system('  reasoning off - Disable reasoning'));
        console.log(ColorUtils.system('  streaming     - Show current streaming status'));
        console.log(ColorUtils.system('  streaming on  - Enable streaming responses'));
        console.log(ColorUtils.system('  streaming off - Disable streaming responses'));
        console.log(ColorUtils.system('  verbose       - Show current verbose status'));
        console.log(ColorUtils.system('  verbose on    - Enable verbose mode (HTTP logging)'));
        console.log(ColorUtils.system('  verbose off   - Disable verbose mode'));
        console.log(ColorUtils.system('  messagebody   - Show current message body status'));
        console.log(ColorUtils.system('  messagebody on - Enable message body (send full content to LLM)'));
        console.log(ColorUtils.system('  messagebody off - Disable message body (send only metadata to LLM)'));
        console.log(ColorUtils.system('  cancel        - Cancel current AI response'));
        console.log(ColorUtils.system('  status        - Show current request status'));
        console.log(ColorUtils.system('  autocancel on|off - Toggle auto-cancellation'));
        console.log(ColorUtils.system('  test-nonstream - Test non-streaming cancellation'));
        console.log(ColorUtils.system('  model         - Show current model'));
        console.log(ColorUtils.system('  models        - List available models'));
        console.log(ColorUtils.system('  model <n>     - Switch to model number (e.g., model 1, model 2)'));
        console.log(ColorUtils.system('  attach <path|url> - Attach an image to conversation (local file or URL)'));
        console.log(ColorUtils.system('  login         - Login with User ID and password'));
        console.log(ColorUtils.system('  logout        - Logout and clear stored credentials'));
        console.log(ColorUtils.system('  test-markdown - Show markdown formatting demonstration'));
        console.log(ColorUtils.system('  help          - Show this help message'));
        console.log('');
        console.log(ColorUtils.info('📊 Prompt Emoji Indicators:'));
        console.log(ColorUtils.system('  📡 - Streaming mode enabled'));
        console.log(ColorUtils.system('  📄 - Non-streaming mode'));
        console.log(ColorUtils.system('  💬 - Message body mode (full content sent to LLM)'));
        console.log(ColorUtils.system('  📊 - Metadata mode (only metadata sent to LLM)'));
        console.log(ColorUtils.system('  🔧 - JSON output mode'));
        console.log(ColorUtils.system('  🧠 - Reasoning mode (AI thinking displayed)'));
        console.log(ColorUtils.system('  📝 - Verbose mode (HTTP logging)'));
        console.log(ColorUtils.system('  [TopicName] - Current conversation topic title'));
        console.log(ColorUtils.system('  👤 - Current user ID'));
        console.log(ColorUtils.system('  🔄 - Processing request (Ctrl+C to interrupt)'));
        console.log('');
        console.log(ColorUtils.info('💡 Navigation Features:'));
        console.log(ColorUtils.system('  • Use ↑/↓ arrow keys to browse recent inputs (commands + chat messages)'));
        console.log(ColorUtils.system('  • Press Ctrl+C during AI responses to interrupt and get a new prompt'));
        console.log(ColorUtils.system('  • Type your next question after interrupting'));
        console.log('');
        console.log(ColorUtils.info('Available colors:'));
        console.log(ColorUtils.system('  brightCyan, brightGreen, brightYellow, brightMagenta, brightBlue, brightRed'));
        console.log(ColorUtils.system('  cyan, green, yellow, magenta, blue, red'));
        console.log('');
        
        // Also show available models
        await this.callbacks.listAvailableModels(false);
    }

    /**
     * Set system prompt
     */
    private setSystemPrompt(prompt: string): void {
        console.log(ColorUtils.info('🎯 System prompt set:'), ColorUtils.system(prompt));
    }
}
