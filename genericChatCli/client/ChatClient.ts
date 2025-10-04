import type { ChatServerModule } from "../server/ChatServerModule";
import { PotoClient, PotoConstants } from "../../src/index";
import { getAppEnv } from "../../src/AppEnv";
import { ChatMessage, ModelInfo} from "../shared/types";
import * as readline from 'readline';
import { startServer } from "../server/ServerMain";
import { ColorUtils } from "./ColorUtils";
import { ChatConfigManager } from "./ChatConfig";
import { MarkdownParser } from "./MarkdownParser";
import { CredentialManager, StoredCredentials } from "./CredentialManager";
import fs from 'fs';
import path from 'path';

export const port = parseInt(getAppEnv('PORT') || '3799');

const URL = `http://localhost:${port}` 
export class ChatClient {
    private client: PotoClient;
    private chatServerModuleProxy: ChatServerModule;
    private rl: readline.Interface;
    // Note: conversationHistory removed - now using server-side DialogueJournal
    private isConnected = false;
    private systemPrompt?: string;
    private currentModel: ModelInfo | null = null;
    private jsonOutputMode = false;
    private reasoningEnabled: boolean = false;
    private streamingEnabled: boolean = true;
    private isAuthenticated = false;
    private currentUser?: string;
    private verboseMode = false;
    
    // Request cancellation support - now handled by PotoClient
    private isProcessingRequest = false;
    
    // Enhanced interruption support
    private interruptRequested = false;
    private recentlyInterrupted = false;
    
    // Command history for CLI navigation
    private commandHistory: string[] = [];
    private currentHistoryIndex = -1;
    private maxHistorySize = 100;

    constructor(serverUrl: string = URL) {
        // Create in-memory storage for Node.js environment
        const memoryStorage = {
            data: new Map<string, string>(),
            getItem(key: string): string | null {
                return this.data.get(key) || null;
            },
            setItem(key: string, value: string): void {
                this.data.set(key, value);
            },
            removeItem(key: string): void {
                this.data.delete(key);
            }
        };
        
        this.client = new PotoClient(serverUrl, memoryStorage);
        // Set verbose mode callback for HTTP logging
        this.client.setVerboseCallback(() => this.verboseMode);
        
        // Use string route name instead of importing server module
        this.chatServerModuleProxy = this.client.getProxy<ChatServerModule>('ChatServerModule');
        
        // Load command history from localStorage
        this.loadCommandHistory();
        
        // Set up readline interface for user input with enhanced interrupt handling
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> ',
            // Disable automatic handling of SIGINT
            terminal: true,
            history: this.commandHistory
        });
        
        // Set up initial SIGINT handler
        this.setupReadlineSigintHandler();
        
        // Set up other handlers
        this.setupLineHandlers();
        
        // Set up process exit handlers for proper cleanup
        this.setupProcessExitHandlers();
    }

    /**
     * Initialize the client by trying stored credentials
     * Returns true if authentication was successful, false if credentials are needed
     */
    async initialize(): Promise<boolean> {
        try {
            // Try to load stored credentials first
            const storedCredentials = CredentialManager.loadCredentials();
            
            if (storedCredentials) {
                console.log('🔐 Found stored credentials, attempting login...');
                try {
                    await this.loginWithCredentials(storedCredentials.username, storedCredentials.password);
                    console.log(`✅ Logged in as: ${this.currentUser}`);
                    this.isAuthenticated = true;
                    this.isConnected = true;
                    return true;
                } catch (error) {
                    console.log('❌ Stored credentials failed. Authentication required.');
                    this.isConnected = false;
                    return false;
                }
            } else {
                console.log('🔐 No stored credentials found. Authentication required.');
                this.isConnected = false;
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to initialize client:', error);
            this.isConnected = false;
            return false;
        }
    }


    /**
     * Login with user ID and password using PotoClient's built-in login method
     */
    private async loginWithCredentials(userId: string, password: string): Promise<void> {
        try {
            // Use PotoClient's built-in login method
            await this.client.login({ username: userId, password });
            
            this.currentUser = userId;
            this.isAuthenticated = true;
        } catch (error) {
            throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Sets up line input handlers
     */
    private setupLineHandlers(): void {
        // Simple line handling - only process input when not streaming
        this.rl.on('line', (input) => {
            if (!this.isProcessingRequest) {
                this.handleUserInput(input.trim());
            }
            // If streaming, ignore input (user should use Ctrl+C to interrupt)
        });
    }
    
    /**
     * Sets up process exit handlers for proper cleanup
     */
    private setupProcessExitHandlers(): void {
        // Handle process exit
        process.on('exit', () => {
            // Cleanup handled by readline close
        });
        
        // Handle SIGTERM
        process.on('SIGTERM', () => {
            process.exit(0);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            process.exit(1);
        });
    }

    /**
     * Sets up the readline SIGINT handler
     */
    private setupReadlineSigintHandler(): void {
        this.rl.on('SIGINT', () => {
            if (this.recentlyInterrupted) {
                // Second Ctrl+C within timeout period - always exit
                console.log(ColorUtils.success('\n👋 Goodbye!'));
                process.exit(0);
            } else if (this.isProcessingRequest) {
                // First interrupt during processing
                this.requestInterrupt();
                this.recentlyInterrupted = true;
                console.log(ColorUtils.info('\n🔄 Response interrupted. Press Ctrl+C again to exit.'));
                
                // Reset the flag after 3 seconds
                setTimeout(() => {
                    this.recentlyInterrupted = false;
                }, 3000);
            } else {
                // Not processing - just exit
                console.log(ColorUtils.success('\n👋 Goodbye!'));
                process.exit(0);
            }
        });
    }

    /**
     * Requests an interrupt of the current streaming response
     */
    private requestInterrupt(): void {
        this.interruptRequested = true;
        this.cancelCurrentRequest();
    }

    /**
     * Cancels the current ongoing request if any
     */
    private cancelCurrentRequest(): void {
        this.client.cancelCurrentRequest();
        // Note: isProcessingRequest is managed in processAiResponse method
    }

    /**
     * Makes a request to the server (cancellation handled by PotoClient)
     */
    private async makeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
        this.isProcessingRequest = true;
        this.updatePrompt();
        
        try {
            return await requestFn();
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request was cancelled');
            }
            throw error;
        } finally {
            this.isProcessingRequest = false;
            this.updatePrompt();
        }
    }

    /**
     * Updates the prompt to show current status and model
     */
    private updatePrompt(): void {
        // If not authenticated, show minimal prompt
        if (!this.isAuthenticated || !this.isConnected) {
            this.rl.setPrompt('> ');
            return;
        }
        
        const modelInfo = this.currentModel ? this.currentModel.model : 'unknown';
        const jsonMode = this.jsonOutputMode ? ' [JSON]' : '';
        const reasoningMode = this.reasoningEnabled ? ' [reasoning]' : '';
        const streamingMode = this.streamingEnabled ? ' [streaming]' : ' [non-streaming]';
        const verboseMode = this.verboseMode ? ' [verbose]' : '';
        const userInfo = this.currentUser ? ` [👤${this.currentUser}]` : '';
        
        if (this.isProcessingRequest) {
            this.rl.setPrompt(`🔄 (Ctrl+C to interrupt) ${modelInfo}${jsonMode}${reasoningMode}${streamingMode}${verboseMode}${userInfo} > `);
        } else {
            this.rl.setPrompt(`${modelInfo}${jsonMode}${reasoningMode}${streamingMode}${verboseMode}${userInfo} > `);
        }
    }

    /**
     * Updates the current model information from server
     */
    private async updateCurrentModel(): Promise<void> {
        try {
            this.currentModel = await this.chatServerModuleProxy.getCurrentModel();
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to get current model:'), error);
            this.currentModel = null;
        }
    }

    async connect(): Promise<void> {
        try {
            console.log(ColorUtils.info('🔌 Connecting to chat server...'));
            
            // Initialize the client (requires authentication)
            const authSuccess = await this.initialize();
            
            if (!authSuccess) {
                throw new Error('Authentication required');
            }
            
            // Get current model information
            await this.updateCurrentModel();
            this.updatePrompt(); // Update the prompt with model info
            
            console.log(ColorUtils.success('✅ Connected to chat server!'));
            if (this.currentModel) {
                console.log(ColorUtils.info(`🤖 Current model: ${this.currentModel.model}`));
            }
            if (this.isAuthenticated && this.currentUser) {
                console.log(ColorUtils.info(`👤 Logged in as: ${this.currentUser}`));
            }
            console.log('');
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to connect to server:'), error);
            throw error;
        }
    }


    setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
        console.log(ColorUtils.info('🎯 System prompt set:'), ColorUtils.system(prompt));
    }

    /**
     * Enable or disable automatic cancellation of previous requests
     */
    setAutoCancel(enabled: boolean): void {
        this.client.setAutoCancelPreviousRequests(enabled);
        console.log(ColorUtils.info(`🔄 Auto-cancellation ${enabled ? 'enabled' : 'disabled'}`));
    }

    /**
     * Load command history from localStorage
     */
    private loadCommandHistory(): void {
        try {
            const historyFile = path.join(__dirname, '..', '.chat_history');
            
            if (fs.existsSync(historyFile)) {
                const data = fs.readFileSync(historyFile, 'utf8');
                this.commandHistory = JSON.parse(data);
            }
        } catch (error) {
            console.warn('Could not load command history:', error);
            this.commandHistory = [];
        }
    }

    /**
     * Save command history to localStorage
     */
    private saveCommandHistory(): void {
        try {
            const historyFile = path.join(__dirname, '..', '.chat_history');
            
            // Keep only the last maxHistorySize commands
            const trimmedHistory = this.commandHistory.slice(-this.maxHistorySize);
            fs.writeFileSync(historyFile, JSON.stringify(trimmedHistory, null, 2));
        } catch (error) {
            console.warn('Could not save command history:', error);
        }
    }

    /**
     * Check if input is a command (starts with known command prefixes)
     */
    private isCommand(input: string): boolean {
        const commands = [
            'quit', 'exit', 'bye', 'clear', 'history', 'cancel', 'status',
            'autocancel', 'test-nonstream', 'models', 'model', 'json', 'reasoning',
            'streaming', 'system', 'color', 'markdown', 'attach', 'help', 'login', 'logout', 'verbose'
        ];
        
        const firstWord = input.split(' ')[0].toLowerCase();
        return commands.includes(firstWord);
    }

    /**
     * Add command to history
     */
    private addToHistory(command: string): void {
        // Don't add empty commands or duplicates of the last command
        if (command.trim() && this.commandHistory[this.commandHistory.length - 1] !== command) {
            this.commandHistory.push(command);
            
            // Trim history if it gets too long
            if (this.commandHistory.length > this.maxHistorySize) {
                this.commandHistory = this.commandHistory.slice(-this.maxHistorySize);
            }
            
            this.saveCommandHistory();
        }
    }

    /**
     * Handles user input processing (commands and chat messages)
     */
    private async handleUserInput(message: string): Promise<void> {
        if (!message) {
            this.rl.prompt();
            return;
        }

        // Add command to history (only for actual commands, not chat messages)
        if (this.isCommand(message)) {
            this.addToHistory(message);
        }

        // Allow login and logout commands even when not authenticated
        if (['login', 'logout'].includes(message.toLowerCase())) {
            // These commands will be handled below, no need to check authentication
        } else if (!this.isConnected || !this.isAuthenticated) {
            console.log(ColorUtils.error('❌ Authentication required. Please use the "login" command to continue.'));
            this.rl.prompt();
            return;
        }

        // Handle special commands
        if (['quit', 'exit', 'bye'].includes(message.toLowerCase())) {
            console.log(ColorUtils.success('👋 Goodbye!'));
            this.rl.close();
            process.exit(0);
            return;
        }

        if (message.toLowerCase() === 'clear') {
            await this.clearConversationHistory();
            return;
        }

        if (message.toLowerCase() === 'history') {
            await this.showConversationHistory();
            return;
        }

        if (message.toLowerCase() === 'cancel') {
            if (this.isProcessingRequest) {
                this.requestInterrupt();
                console.log(ColorUtils.success('✅ Request cancelled successfully.'));
            } else {
                console.log(ColorUtils.info('ℹ️  No active request to cancel.'));
            }
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'status') {
            if (this.isProcessingRequest) {
                console.log(ColorUtils.info('🔄 Currently processing AI request...'));
            } else {
                console.log(ColorUtils.success('✅ No active requests. Ready for new input.'));
            }
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('autocancel ')) {
            const parts = message.split(' ');
            if (parts.length === 2) {
                const setting = parts[1].toLowerCase();
                
                if (setting === 'on') {
                    this.setAutoCancel(true);
                } else if (setting === 'off') {
                    this.setAutoCancel(false);
                } else {
                    console.log(ColorUtils.error('❌ Usage: autocancel <on|off>'));
                }
            } else {
                console.log(ColorUtils.error('❌ Usage: autocancel <on|off>'));
            }
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'test-nonstream') {
            this.testNonStreamingCancellation();
            return;
        }

        if (message.toLowerCase() === 'models') {
            await this.listAvailableModels();
            return;
        }

        if (message.toLowerCase() === 'model') {
            await this.showCurrentModel();
            return;
        }

        if (message.toLowerCase() === 'json') {
            console.log(ColorUtils.info(`📋 JSON output mode: ${this.jsonOutputMode ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'reasoning') {
            console.log(ColorUtils.info(`🧠 Reasoning: ${this.reasoningEnabled ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'streaming') {
            console.log(ColorUtils.info(`📡 Streaming: ${this.streamingEnabled ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'verbose') {
            console.log(ColorUtils.info(`🔍 Verbose mode: ${this.verboseMode ? ColorUtils.success('enabled') : ColorUtils.info('disabled')}`));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('reasoning on')) {
            this.reasoningEnabled = true;
            console.log(ColorUtils.success('✅ Reasoning enabled (reasoning content will be silently ignored)'));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('reasoning off')) {
            this.reasoningEnabled = false;
            console.log(ColorUtils.success('✅ Reasoning disabled'));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('streaming on')) {
            this.streamingEnabled = true;
            this.updatePrompt(); // Update prompt to show new streaming status
            console.log(ColorUtils.success('✅ Streaming enabled'));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('streaming off')) {
            this.streamingEnabled = false;
            this.updatePrompt(); // Update prompt to show new streaming status
            console.log(ColorUtils.success('✅ Streaming disabled'));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('verbose on')) {
            this.verboseMode = true;
            this.updatePrompt(); // Update prompt to show new verbose status
            console.log(ColorUtils.success('✅ Verbose mode enabled - HTTP requests and responses will be logged'));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('verbose off')) {
            this.verboseMode = false;
            this.updatePrompt(); // Update prompt to show new verbose status
            console.log(ColorUtils.success('✅ Verbose mode disabled'));
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('model ')) {
            const modelInput = message.substring(6).trim();
            await this.switchModel(modelInput);
            return;
        }

        if (message.toLowerCase() === 'clear model' || message.toLowerCase() === 'reset model') {
            await this.clearModelPreference();
            return;
        }

        if (message.toLowerCase().startsWith('attach ')) {
            const imageUrl = message.substring(7).trim();
            await this.fetchImage(imageUrl);
            return;
        }

        if (message.toLowerCase() === 'cmdhistory') {
            if (this.commandHistory.length === 0) {
                console.log(ColorUtils.info('📝 No command history yet.'));
            } else {
                console.log(ColorUtils.info('📝 Command History:'));
                this.commandHistory.forEach((cmd, index) => {
                    console.log(`  ${index + 1}. ${ColorUtils.system(cmd)}`);
                });
            }
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase() === 'help') {
            console.log(ColorUtils.info('📖 Available Commands:'));
            console.log(ColorUtils.system('  quit/exit/bye - End the chat session'));
            console.log(ColorUtils.system('  clear         - Clear conversation history (server-side)'));
            console.log(ColorUtils.system('  history       - Show conversation history (server-side)'));
            console.log(ColorUtils.system('  convstats     - Show conversation statistics'));
            console.log(ColorUtils.system('  export        - Export conversation as JSON'));
            console.log(ColorUtils.system('  recent <n>   - Show recent messages (default: 10)'));
            console.log(ColorUtils.system('  memstats      - Show memory usage statistics'));
            console.log(ColorUtils.system('  cleanup <age> <inactive> [dry] - Manual cleanup (dry run)'));
            console.log(ColorUtils.system('  forcecleanup - Force cleanup with default settings'));
            console.log(ColorUtils.system('  cmdhistory    - Show command history (arrow key navigation)'));
            console.log(ColorUtils.system('  system <prompt> - Set system prompt'));
            console.log(ColorUtils.system('  color <ai|user> <color> - Change colors'));
            console.log(ColorUtils.system('  markdown on|off - Toggle markdown parsing'));
            console.log(ColorUtils.system('  json on|off   - Toggle JSON output mode'));
            console.log(ColorUtils.system('  json          - Show current JSON output mode status'));
            console.log(ColorUtils.system('  reasoning     - Show current reasoning status'));
            console.log(ColorUtils.system('  reasoning on  - Enable reasoning (content hidden)'));
            console.log(ColorUtils.system('  reasoning off - Disable reasoning'));
            console.log(ColorUtils.system('  streaming     - Show current streaming status'));
            console.log(ColorUtils.system('  streaming on  - Enable streaming responses'));
            console.log(ColorUtils.system('  streaming off - Disable streaming responses'));
            console.log(ColorUtils.system('  verbose       - Show current verbose status'));
            console.log(ColorUtils.system('  verbose on    - Enable verbose mode (HTTP logging)'));
            console.log(ColorUtils.system('  verbose off   - Disable verbose mode'));
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
            console.log(ColorUtils.system('  help          - Show this help message'));
            console.log('');
            console.log(ColorUtils.info('💡 Navigation Features:'));
            console.log(ColorUtils.system('  • Use ↑/↓ arrow keys to browse command history'));
            console.log(ColorUtils.system('  • Press Ctrl+C during AI responses to interrupt and get a new prompt'));
            console.log(ColorUtils.system('  • Type your next question after interrupting'));
            console.log('');
            console.log(ColorUtils.info('Available colors:'));
            console.log(ColorUtils.system('  brightCyan, brightGreen, brightYellow, brightMagenta, brightBlue, brightRed'));
            console.log(ColorUtils.system('  cyan, green, yellow, magenta, blue, red'));
            console.log('');
            
            // Also show available models
            await this.listAvailableModels(false);
            return;
        }

        if (message.toLowerCase() === 'login') {
            await this.handleLogin();
            return;
        }

        if (message.toLowerCase() === 'logout') {
            await this.handleLogout();
            return;
        }

        if (message.toLowerCase() === 'convstats') {
            await this.showConversationStats();
            return;
        }

        if (message.toLowerCase() === 'export') {
            await this.exportConversation();
            return;
        }

        if (message.toLowerCase().startsWith('recent ')) {
            const parts = message.split(' ');
            const count = parts.length > 1 ? parseInt(parts[1]) : 10;
            await this.showRecentMessages(count);
            return;
        }

        if (message.toLowerCase() === 'recent') {
            await this.showRecentMessages(10);
            return;
        }

        if (message.toLowerCase() === 'memstats') {
            await this.showMemoryStats();
            return;
        }

        if (message.toLowerCase().startsWith('cleanup ')) {
            const parts = message.split(' ');
            if (parts.length >= 3) {
                const maxAgeHours = parseInt(parts[1]);
                const maxInactiveHours = parseInt(parts[2]);
                const dryRun = parts[3] === 'dry';
                await this.performCleanup(maxAgeHours, maxInactiveHours, dryRun);
            } else {
                console.log(ColorUtils.error('❌ Usage: cleanup <maxAgeHours> <maxInactiveHours> [dry]'));
                console.log(ColorUtils.info('Example: cleanup 24 72 dry (dry run)'));
                console.log(ColorUtils.info('Example: cleanup 24 72 (actual cleanup)'));
            }
            return;
        }

        if (message.toLowerCase() === 'forcecleanup') {
            await this.forceCleanup();
            return;
        }

        if (message.toLowerCase().startsWith('system ')) {
            const prompt = message.substring(7); // Remove "system " prefix
            this.setSystemPrompt(prompt);
            this.rl.prompt();
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
                } else {
                    console.log(ColorUtils.error('❌ Invalid target. Use "ai" or "user"'));
                }
            } else {
                console.log(ColorUtils.error('❌ Usage: color <ai|user> <color>'));
                console.log(ColorUtils.info('Example: color ai brightGreen'));
            }
            this.rl.prompt();
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
            this.rl.prompt();
            return;
        }

        if (message.toLowerCase().startsWith('json ')) {
            const parts = message.split(' ');
            if (parts.length === 2) {
                const setting = parts[1].toLowerCase();
                
                if (setting === 'on') {
                    this.jsonOutputMode = true;
                    console.log(ColorUtils.success('✅ JSON output mode enabled'));
                } else if (setting === 'off') {
                    this.jsonOutputMode = false;
                    console.log(ColorUtils.success('✅ JSON output mode disabled'));
                } else {
                    console.log(ColorUtils.error('❌ Usage: json <on|off>'));
                }
            } else {
                console.log(ColorUtils.error('❌ Usage: json <on|off>'));
            }
            this.rl.prompt();
            return;
        }

        // Note: Conversation history is now managed server-side via DialogueJournal
        // No need to add user message to local history

        await this.processAiResponse(message);
    }

    /**
     * Handle login command
     */
    private async handleLogin(showPrompt: boolean = true): Promise<void> {
        try {
            console.log(ColorUtils.info('🔐 Login'));
            
            // Get User ID first
            const userId = await this.promptInput('Enter your User ID: ');
            if (!userId.trim()) {
                console.log(ColorUtils.error('❌ User ID cannot be empty'));
                this.rl.prompt();
                return;
            }
            
            // Then get password
            const password = await this.promptInput('Enter your Password: ', true);
            if (!password.trim()) {
                console.log(ColorUtils.error('❌ Password cannot be empty'));
                this.rl.prompt();
                return;
            }
            
            // Attempt login
            await this.loginWithCredentials(userId.trim(), password.trim());
            
            // Save credentials
            const credentials: StoredCredentials = {
                username: userId.trim(),
                password: password.trim(),
                serverUrl: URL,
                lastLogin: new Date().toISOString()
            };
            
            CredentialManager.saveCredentials(credentials);
            
            // Set connection state
            this.isConnected = true;
            
            // Update current model and prompt after successful login
            await this.updateCurrentModel();
            this.updatePrompt();
            
            console.log(ColorUtils.success(`✅ Successfully logged in as: ${this.currentUser}`));
            console.log(ColorUtils.info('💾 Credentials saved for future use'));
            
        } catch (error) {
            console.error(ColorUtils.error('❌ Login failed:'), error);
        }
        
        if (showPrompt) {
            this.rl.prompt();
        }
    }

    /**
     * Handle logout command
     */
    private async handleLogout(): Promise<void> {
        try {
            // Clear stored credentials
            CredentialManager.clearCredentials();
            
            // Reset authentication state
            this.isAuthenticated = false;
            this.currentUser = undefined;
            this.isConnected = false;
            
            // Reset all user preferences to defaults
            // Note: conversationHistory is now managed server-side
            this.systemPrompt = undefined;
            this.currentModel = null;
            this.jsonOutputMode = false;
            this.reasoningEnabled = false;
            this.streamingEnabled = true;
            
            // Update prompt to show clean state
            this.updatePrompt();
            
            console.log(ColorUtils.success('✅ Logged out successfully'));
            console.log(ColorUtils.info('🗑️  Stored credentials cleared'));
            console.log(ColorUtils.info('🔄 All settings reset to defaults'));
            console.log('');
            console.log(ColorUtils.info('🔐 Please login to continue:'));
            console.log('');
            
            // Immediately prompt for login after logout
            await this.handleLogin();
            
            // Update prompt after successful login
            if (this.isConnected && this.isAuthenticated) {
                await this.updateCurrentModel();
                this.updatePrompt();
            }
            
        } catch (error) {
            console.error(ColorUtils.error('❌ Logout failed:'), error);
        }
    }

    /**
     * Prompt for user input with optional hidden input
     */
    private async promptInput(prompt: string, hidden: boolean = false): Promise<string> {
        return new Promise((resolve) => {
            // Use readline's question method with the prompt
            this.rl.question(prompt, (answer) => {
                resolve(answer);
            });
        });
    }

    /**
     * Test non-streaming cancellation
     */
    private async testNonStreamingCancellation(): Promise<void> {
        try {
            console.log(ColorUtils.info('🧪 Testing non-streaming cancellation...'));
            console.log(ColorUtils.info('📝 This will make a non-streaming LLM request that takes time to complete.'));
            console.log(ColorUtils.info('⏰ You can interrupt with Ctrl+C to test cancellation.'));
            console.log('');

            // Set processing state
            this.isProcessingRequest = true;
            this.updatePrompt();

            // Make a non-streaming request that will take time
            const response = await this.chatServerModuleProxy.postChatNonStreaming(
                "Write a very long and detailed story with many characters and plot twists. Make it at least 2000 words long.",
                "You are a creative storyteller. Write engaging, detailed stories."
            );

            // Process the response
            if (response) {
                console.log(ColorUtils.aiPrompt() + ColorUtils.ai('🤖 AI Response:'));
                console.log(MarkdownParser.parseWithAiColor(response));
                
                // Note: Conversation history is now managed server-side via DialogueJournal
            } else {
                console.log(ColorUtils.info('ℹ️  Request was cancelled.'));
            }

        } catch (error) {
            if (error instanceof Error && (
                error.message === 'Request was cancelled' || 
                error.name === 'AbortError' ||
                error.message === 'The operation was aborted.'
            )) {
                console.log(ColorUtils.info('🔄 Non-streaming request cancelled by user.'));
            } else {
                console.error(ColorUtils.error('❌ Error in non-streaming test:'), error);
            }
        } finally {
            // Reset processing state
            this.isProcessingRequest = false;
            this.updatePrompt();
            
            console.log(''); // Empty line for readability
            this.rl.prompt();
        }
    }

    /**
     * Processes AI response with enhanced interrupt handling
     */
    private async processAiResponse(message: string): Promise<void> {
        try {
            // Reset interrupt state and set processing state
            this.interruptRequested = false;
            this.recentlyInterrupted = false; // Reset for new request
            this.isProcessingRequest = true;
            this.updatePrompt();
            
            let aiResponse = '';
            
            if (this.streamingEnabled) {
                // Get AI response with streaming directly (no makeRequest wrapper for streams)
                // Server now manages conversation history via DialogueJournal
                const responseGenerator = await this.chatServerModuleProxy.chatWithHistory(
                    message, 
                    this.jsonOutputMode, // Pass JSON output mode
                    this.reasoningEnabled // Pass reasoning enabled
                );

                for await (const text of responseGenerator) {
                    // Only check for interrupt request (not isProcessingRequest since we manage it here)
                    if (this.interruptRequested) {
                        console.log(ColorUtils.info('\n🔄 Response interrupted.'));
                        break;
                    }
                    
                    // Simply apply AI color to each chunk as it comes in
                    // We'll parse markdown after the full response is complete
                    process.stdout.write(ColorUtils.ai(text));
                    aiResponse += text;
                }
            } else {
                // Use non-streaming approach
                const response = await this.makeRequest(async () => {
                    return await this.chatServerModuleProxy.postChatNonStreaming(
                        message,
                        this.systemPrompt || "You are a helpful AI assistant. Maintain conversation context and provide relevant responses."
                    );
                });
                
                if (response) {
                    aiResponse = response;
                    console.log(ColorUtils.ai(aiResponse));
                }
            }
            
            // Note: AI response is automatically added to server-side DialogueJournal
            if (!this.interruptRequested && aiResponse.trim()) {
                console.log(''); // New line after AI response
            }

        } catch (error) {
            if (error instanceof Error && (
                error.message === 'Request was cancelled' || 
                error.name === 'AbortError' ||
                error.message === 'The operation was aborted.'
            )) {
                console.log(ColorUtils.info('🔄 Request cancelled by user.'));
            } else {
                console.error(ColorUtils.error('❌ Error getting AI response:'), error);
                console.log(ColorUtils.aiPrompt() + ColorUtils.error('Sorry, I encountered an error. Please try again.'));
            }
        } finally {
            // Reset processing state
            this.isProcessingRequest = false;
            this.updatePrompt();
            
            console.log(''); // Empty line for readability
            this.rl.prompt();
        }
    }

    /**
     * List all available models
     */
    private async listAvailableModels(showPrompt: boolean = true): Promise<void> {
        try {
            const models = await this.chatServerModuleProxy.getAvailableModels();
            console.log(ColorUtils.info('🤖 Available Models:'));
            
            models.forEach((model, index) => {
                const isCurrent = this.currentModel?.name === model.name;
                const indicator = isCurrent ? '👉' : '  ';
                const nameColor = isCurrent ? ColorUtils.success : ColorUtils.system;
                
                // Extract number from llm<n> format for display
                const modelNumber = model.name.startsWith('llm') ? model.name.substring(3) : model.name;
                const displayName = model.name.startsWith('llm') ? `Model ${modelNumber}` : model.name;
                
                console.log(`  ${indicator} ${nameColor(displayName)} (${model.name}) - ${ColorUtils.system(model.model)} ${model.isDefault ? '(default)' : ''}`);
            });
            
            console.log('');
            console.log(ColorUtils.info('💡 Use "model <n>" to switch models (e.g., model 1, model 2)'));
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to get available models:'), error);
        }
        
        if (showPrompt) {
            this.rl.prompt();
        }
    }

    /**
     * Show current model information
     */
    private async showCurrentModel(): Promise<void> {
        try {
            await this.updateCurrentModel();
            
            if (this.currentModel) {
                console.log(ColorUtils.info('🤖 Current Model:'));
                console.log(`  Name: ${ColorUtils.success(this.currentModel.name)}`);
                console.log(`  Model: ${ColorUtils.system(this.currentModel.model)}`);
                console.log(`  Type: ${this.currentModel.isDefault ? ColorUtils.info('Default') : ColorUtils.info('Custom')}`);
            } else {
                console.log(ColorUtils.error('❌ Unable to get current model information'));
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to get current model:'), error);
        }
        
        this.rl.prompt();
    }

    /**
     * Fetch and attach an image to conversation
     */
    private async fetchImage(imageUrl: string): Promise<void> {
        try {
            // Determine if it's a local file or HTTP URL
            const isLocalFile = !imageUrl.toLowerCase().startsWith('http');
            const imageType = isLocalFile ? 'local file' : 'URL';
            
            console.log(ColorUtils.info(`📷 Attaching ${imageType}: ${imageUrl}`));
            
            // Add user message to history with image content
            let userMessage: any;
            
            if (isLocalFile) {
                // Resolve the path
                const resolvedPath = path.resolve(imageUrl);
                
                if (!fs.existsSync(resolvedPath)) {
                    throw new Error(`Local file not found: ${resolvedPath}`);
                }
                
                // Get file stats
                const stats = fs.statSync(resolvedPath);
                if (!stats.isFile()) {
                    throw new Error(`Path is not a file: ${resolvedPath}`);
                }
                
                console.log(ColorUtils.success(`✅ Local file found: ${resolvedPath}`));
                console.log(ColorUtils.info(`📁 File size: ${(stats.size / 1024).toFixed(2)} KB`));
                
                // Read and encode the image file
                const imageBuffer = fs.readFileSync(resolvedPath);
                const base64Image = imageBuffer.toString('base64');
                const mimeType = this.getMimeType(resolvedPath);
                
                // Create message with image content
                userMessage = {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `📷 Attach image: ${imageUrl}`
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                };
            } else {
                // For HTTP URLs, just use the URL directly
                userMessage = {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `📷 Attach image: ${imageUrl}`
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl
                            }
                        }
                    ]
                };
            }
            
            // Note: User message is now managed server-side via DialogueJournal
            
            // Display user message
            console.log(ColorUtils.userPrompt() + ColorUtils.user(`📷 Attach image: ${imageUrl}`));
            console.log(ColorUtils.aiPrompt());
            
            // Note: AI response is now managed server-side via DialogueJournal
            const aiResponse = `📷 Image attached to conversation: ${imageUrl}`;
            
            // Display the simple response
            console.log(ColorUtils.ai(aiResponse));
            
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to attach image:'), error);
            
            // Note: Error response is now managed server-side via DialogueJournal
            const errorResponse = `❌ Failed to attach image: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.log(ColorUtils.aiPrompt() + ColorUtils.error(errorResponse));
        }
        
        console.log(''); // Empty line for readability
        this.rl.prompt();
    }

    /**
     * Get MIME type based on file extension
     */
    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        
        const mimeTypes: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        };
        
        return mimeTypes[ext] || 'image/jpeg';
    }

    /**
     * Switch to a different model
     */
    private async switchModel(modelInput: string): Promise<void> {
        try {
            let modelName: string;
            
            // Check if input is a number (e.g., "1", "2", "3")
            const modelNumber = parseInt(modelInput);
            if (!isNaN(modelNumber) && modelNumber > 0) {
                modelName = `llm${modelNumber}`;
            } else {
                // Use input as-is (could be "default" or full config name)
                modelName = modelInput;
            }
            
            const success = await this.chatServerModuleProxy.postModel(modelName);
            
            if (success) {
                // Note: conversation history is now managed server-side
                // Server will maintain conversation context across model switches
                
                await this.updateCurrentModel();
                this.updatePrompt(); // Update the prompt with new model info
                console.log(ColorUtils.success(`✅ Successfully switched to model: ${modelName}`));
            } else {
                console.log(ColorUtils.error(`❌ Failed to switch to model: ${modelInput}`));
                console.log(ColorUtils.info('💡 Use "models" to see available models'));
                console.log(ColorUtils.info('💡 Use "model 1", "model 2", etc. to switch by number'));
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to switch model:'), error);
        }
        
        this.rl.prompt();
    }

    /**
     * Clear model preference and reset to default
     */
    private async clearModelPreference(): Promise<void> {
        try {
            // Switch back to default model
            const success = await this.chatServerModuleProxy.postModel('default');
            
            if (success) {
                // Note: conversation history is now managed server-side
                // Server will maintain conversation context when resetting to default
                
                await this.updateCurrentModel();
                this.updatePrompt();
                console.log(ColorUtils.success(`✅ Model preference cleared, reset to default`));
            } else {
                console.log(ColorUtils.error(`❌ Failed to clear model preference`));
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to clear model preference:'), error);
        }
        
        this.rl.prompt();
    }

    async startChat(): Promise<void> {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
        } catch (error) {
            console.log(ColorUtils.error('❌ Authentication required to start chat.'));
            console.log(ColorUtils.info('💡 Prompting for login credentials...'));
            console.log('');
            
            // Always prompt for login when authentication fails (whether no credentials or failed credentials)
            console.log(ColorUtils.success('🔐 Please login to continue:'));
            console.log('');
            await this.handleLogin();
            
            // Update prompt after successful login
            if (this.isConnected && this.isAuthenticated) {
                await this.updateCurrentModel();
                this.updatePrompt();
            }
        }

        console.log(ColorUtils.success('💬 Generic Chat CLI Started!'));
        console.log(ColorUtils.info('Type your messages and press Enter.'));
        console.log(ColorUtils.info('Type "quit", "exit", or "bye" to end the chat.'));
        console.log(ColorUtils.info('Type "clear" to clear conversation history.'));
        console.log(ColorUtils.info('Type "history" to see conversation history.'));
        console.log(ColorUtils.info('Type "cmdhistory" to see command history.'));
        console.log(ColorUtils.info('Type "system <prompt>" to set system prompt.'));
        console.log(ColorUtils.info('Type "color <ai|user> <color>" to change colors.'));
        console.log(ColorUtils.info('Type "markdown on|off" to toggle markdown parsing.'));
        console.log(ColorUtils.info('Type "json on|off" to toggle JSON output mode.'));
        console.log(ColorUtils.info('Type "reasoning on" to enable reasoning (content hidden).'));
        console.log(ColorUtils.info('Type "reasoning off" to disable reasoning.'));
        console.log(ColorUtils.info('Type "streaming on|off" to toggle streaming responses.'));
        console.log(ColorUtils.info('Type "verbose on|off" to toggle verbose mode (HTTP logging).'));
        console.log(ColorUtils.info('Type "model <n>" to switch models (e.g., model 1, model 2).'));
        console.log(ColorUtils.info('Type "models" to list available models.'));
        console.log(ColorUtils.info('Type "attach <path|url>" to attach an image to conversation (local file or URL).'));
        console.log(ColorUtils.info('Type "login" to login with User ID and password.'));
        console.log(ColorUtils.info('Type "logout" to logout and clear stored credentials.'));
        console.log(ColorUtils.info('AI responses support **bold** markdown formatting.'));
        console.log(ColorUtils.info('Type "help" for more commands.'));
        console.log('');
        
        // Show available models at startup
        await this.listAvailableModels(false);
        
        console.log(ColorUtils.success('🚀 Navigation Features:'));
        console.log(ColorUtils.info('  • Use ↑/↓ arrow keys to browse command history'));
        console.log(ColorUtils.info('  • Press Ctrl+C during AI responses to interrupt and get a new prompt'));
        console.log('');

        this.rl.prompt();

        // Note: Line handling is now done in setupInterruptHandlers()

        this.rl.on('close', async () => {
            console.log(ColorUtils.success('👋 Chat session ended.'));
            // Clean up SSE connection before exiting
            this.client.unsubscribe();
            process.exit(0);
        });
    }

    async disconnect(): Promise<void> {
        this.rl.close();
        console.log(ColorUtils.info('🔌 Disconnected from chat server.'));
    }

    /**
     * Show conversation history from server-side DialogueJournal
     */
    private async showConversationHistory(): Promise<void> {
        try {
            const history = await this.chatServerModuleProxy.getConversationHistory();
            
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
        
        this.rl.prompt();
    }

    /**
     * Archive current conversation on server (preserves conversation data)
     */
    private async clearConversationHistory(): Promise<void> {
        try {
            console.log(ColorUtils.info('📦 Archiving current conversation...'));
            
            const success = await this.chatServerModuleProxy.archiveCurrentConversation();
            
            if (success) {
                console.log(ColorUtils.success('✅ Conversation archived successfully'));
            } else {
                console.log(ColorUtils.error('❌ Failed to archive conversation'));
            }
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to archive conversation:'), error);
        }
        
        this.rl.prompt();
    }

    /**
     * Show conversation statistics
     */
    private async showConversationStats(): Promise<void> {
        try {
            const stats = await this.chatServerModuleProxy.getConversationStats();
            
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
        
        this.rl.prompt();
    }

    /**
     * Export conversation as JSON
     */
    private async exportConversation(): Promise<void> {
        try {
            const jsonData = await this.chatServerModuleProxy.exportConversation();
            
            // Save to file
            const filename = `conversation_export_${new Date().toISOString().split('T')[0]}.json`;
            const fs = require('fs');
            const path = require('path');
            
            const exportPath = path.join(__dirname, '..', filename);
            fs.writeFileSync(exportPath, jsonData);
            
            console.log(ColorUtils.success(`✅ Conversation exported to: ${filename}`));
            console.log(ColorUtils.info(`📁 Full path: ${exportPath}`));
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to export conversation:'), error);
        }
        
        this.rl.prompt();
    }

    /**
     * Show recent messages
     */
    private async showRecentMessages(count: number): Promise<void> {
        try {
            const recentMessages = await this.chatServerModuleProxy.getRecentMessages(count);
            
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
        
        this.rl.prompt();
    }

    /**
     * Show memory statistics
     */
    private async showMemoryStats(): Promise<void> {
        try {
            const stats = await this.chatServerModuleProxy.getMemoryStats();
            
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
        
        this.rl.prompt();
    }

    /**
     * Perform manual cleanup
     */
    private async performCleanup(maxAgeHours: number, maxInactiveHours: number, dryRun: boolean = false): Promise<void> {
        try {
            console.log(ColorUtils.info(`🧹 Performing cleanup (${dryRun ? 'DRY RUN' : 'LIVE'})...`));
            console.log(ColorUtils.info(`  Max message age: ${maxAgeHours} hours`));
            console.log(ColorUtils.info(`  Max inactive time: ${maxInactiveHours} hours`));
            
            const result = await this.chatServerModuleProxy.performCleanup({
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
        
        this.rl.prompt();
    }

    /**
     * Force cleanup with default settings
     */
    private async forceCleanup(): Promise<void> {
        try {
            console.log(ColorUtils.warning('🧹 Force cleanup with default settings (24h age, 72h inactive)...'));
            
            const result = await this.chatServerModuleProxy.forceCleanup(24, 72);
            
            console.log(ColorUtils.success('✅ Force cleanup completed:'));
            console.log(`  Users removed: ${ColorUtils.warning(result.usersRemoved.toString())}`);
            console.log(`  Messages removed: ${ColorUtils.warning(result.messagesRemoved.toString())}`);
            console.log(`  Memory freed: ${ColorUtils.success(this.formatBytes(result.memoryFreed))}`);
        } catch (error) {
            console.error(ColorUtils.error('❌ Failed to perform force cleanup:'), error);
        }
        
        this.rl.prompt();
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
}


// Main function to run the chat client
async function main() {
    // For demo purposes, also start the server in the same process if not already running.

    // Only start the server if not already running (i.e., if not started by another process)
    // This is a simple check for demo; in real use, server and client should be separate.

    await startServer();

    console.log(ColorUtils.system('--------------------------------'));

    const serverUrl = process.argv[2] || URL;
    
    console.log(ColorUtils.success('🎯 Generic Chat CLI'));
    console.log(ColorUtils.info(`📡 Connecting to: ${serverUrl}`));
    console.log('');

    const chatClient = new ChatClient(serverUrl);
    
    try {
        await chatClient.startChat();
    } catch (error) {
        console.error(ColorUtils.error('❌ Failed to start chat:'), error);
        console.log(ColorUtils.info('💡 Make sure you are authenticated. Use the "login" command if needed.'));
        // Don't exit immediately, allow user to try login
    }
}

// Run the client if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(ColorUtils.error('❌ Unexpected error:'), error);
        process.exit(1);
    });
}
