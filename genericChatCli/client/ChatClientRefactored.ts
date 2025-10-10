import type { ChatServerModule } from "../server/ChatServerModule";
import { PotoClient, PotoConstants } from "../../src/index";
import { getAppEnv } from "../../src/server/AppEnv";
import { ChatMessage, ModelInfo} from "../shared/types";
import { DataPacket } from "../../src/shared/DataPacket";
import * as readline from 'readline';
import { startServer } from "../server/ServerMain";
import { ColorUtils } from "./ColorUtils";
import { ChatConfigManager } from "./ChatConfig";
import { MarkdownParser } from "./MarkdownParser";
import { createMarkdownSplitter } from "../../src/shared/SimpleMarkdownTracker";
import { CredentialManager, StoredCredentials } from "./CredentialManager";
import { ChatCommandHandler, ChatCommandHandlerDependencies, ChatCommandHandlerCallbacks } from "./ChatCommandHandler";
import { ChatSessionManager, ChatSessionManagerDependencies, ChatSessionManagerCallbacks } from "./ChatSessionManager";
import { ChatResponseProcessor, ChatResponseProcessorDependencies, ChatResponseProcessorCallbacks } from "./ChatResponseProcessor";
import fs from 'fs';
import path from 'path';

export const port = parseInt(getAppEnv('PORT') || '3799');

const URL = `http://localhost:${port}` 

export class ChatClient {
    private client: PotoClient;
    private chatServerModuleProxy: ChatServerModule; // Will be typed as ChatServerModuleProxy in constructor
    private rl: readline.Interface;
    // Note: conversationHistory removed - now using server-side DialogueJournal
    private isConnected = false;
    private systemPrompt?: string;
    private currentModel: ModelInfo | null = null;
    private jsonOutputMode = false;
    private reasoningEnabled: boolean = false;
    private streamingEnabled: boolean = true;
    private messageBodyEnabled: boolean = true;
    private isAuthenticated = false;
    private currentUser?: string;
    private verboseMode = false;
    private currentTopicTitle?: string;
    
    // Request cancellation support - now handled by PotoClient
    private isProcessingRequest = false;
    
    // Enhanced interruption support
    private interruptRequested = false;
    private recentlyInterrupted = false;
    
    // Command history for CLI navigation
    private commandHistory: string[] = [];
    private currentHistoryIndex = -1;
    private maxHistorySize = 100;
    
    // Simple markdown buffering for progressive parsing
    private markdownBuffer: string = '';
    
    // Enhanced markdown splitter for progressive rendering
    private markdownSplitter = createMarkdownSplitter();

    // Module instances
    private commandHandler: ChatCommandHandler;
    private sessionManager: ChatSessionManager;
    private responseProcessor: ChatResponseProcessor;

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
        // Define explicit interface for RPC proxy with AsyncGenerator types
        
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

        // Initialize modules
        this.initializeModules();
    }

    /**
     * Initialize the modules with their dependencies and callbacks
     */
    private initializeModules(): void {
        // Command Handler
        const commandHandlerDeps: ChatCommandHandlerDependencies = {
            chatServerModuleProxy: this.chatServerModuleProxy,
            rl: this.rl,
            currentUser: this.currentUser,
            isAuthenticated: this.isAuthenticated,
            isConnected: this.isConnected,
            isProcessingRequest: this.isProcessingRequest,
            currentModel: this.currentModel,
            jsonOutputMode: this.jsonOutputMode,
            reasoningEnabled: this.reasoningEnabled,
            streamingEnabled: this.streamingEnabled,
            messageBodyEnabled: this.messageBodyEnabled,
            verboseMode: this.verboseMode,
            currentTopicTitle: this.currentTopicTitle,
            commandHistory: this.commandHistory,
            maxHistorySize: this.maxHistorySize
        };

        const commandHandlerCallbacks: ChatCommandHandlerCallbacks = {
            setJsonOutputMode: (enabled: boolean) => { this.jsonOutputMode = enabled; },
            setReasoningEnabled: (enabled: boolean) => { this.reasoningEnabled = enabled; },
            setStreamingEnabled: (enabled: boolean) => { this.streamingEnabled = enabled; },
            setMessageBodyEnabled: (enabled: boolean) => { this.messageBodyEnabled = enabled; },
            setVerboseMode: (enabled: boolean) => { this.verboseMode = enabled; },
            setAutoCancel: (enabled: boolean) => { this.client.setAutoCancelPreviousRequests(enabled); },
            requestInterrupt: () => { this.requestInterrupt(); },
            updatePrompt: () => { this.updatePrompt(); },
            updateCurrentModel: () => this.updateCurrentModel(),
            switchModel: (modelInput: string) => this.switchModel(modelInput),
            clearModelPreference: () => this.clearModelPreference(),
            showMarkdownTest: () => this.responseProcessor.showMarkdownTest(),
            testNonStreamingCancellation: () => this.responseProcessor.testNonStreamingCancellation(),
            handleLogin: (showPrompt?: boolean) => this.sessionManager.handleLogin(showPrompt),
            handleLogout: () => this.sessionManager.handleLogout(),
            startNewSession: () => this.sessionManager.startNewSession(),
            showConversationHistory: () => this.sessionManager.showConversationHistory(),
            listTopics: () => this.sessionManager.listTopics(),
            listArchivedTopics: () => this.sessionManager.listArchivedTopics(),
            archiveTopic: (conversationId: string) => this.sessionManager.archiveTopic(conversationId),
            archiveCurrentTopic: () => this.sessionManager.archiveCurrentTopic(),
            restoreArchivedTopic: (conversationId: string) => this.sessionManager.restoreArchivedTopic(conversationId),
            deleteArchivedTopic: (conversationId: string) => this.sessionManager.deleteArchivedTopic(conversationId),
            showConversationStats: () => this.sessionManager.showConversationStats(),
            exportConversation: () => this.sessionManager.exportConversation(),
            showRecentMessages: (count: number) => this.sessionManager.showRecentMessages(count),
            showMemoryStats: () => this.sessionManager.showMemoryStats(),
            performCleanup: (maxAgeHours: number, maxInactiveHours: number, dryRun: boolean) => this.sessionManager.performCleanup(maxAgeHours, maxInactiveHours, dryRun),
            forceCleanup: () => this.sessionManager.forceCleanup(),
            listAvailableModels: (showPrompt?: boolean) => this.listAvailableModels(showPrompt),
            showCurrentModel: () => this.showCurrentModel(),
            fetchImage: (imageUrl: string) => this.fetchImage(imageUrl),
            promptInput: (prompt: string, hidden?: boolean) => this.promptInput(prompt, hidden)
        };

        this.commandHandler = new ChatCommandHandler(commandHandlerDeps, commandHandlerCallbacks);

        // Session Manager
        const sessionManagerDeps: ChatSessionManagerDependencies = {
            chatServerModuleProxy: this.chatServerModuleProxy,
            rl: this.rl,
            currentUser: this.currentUser,
            isAuthenticated: this.isAuthenticated,
            isConnected: this.isConnected,
            currentModel: this.currentModel,
            currentTopicTitle: this.currentTopicTitle
        };

        const sessionManagerCallbacks: ChatSessionManagerCallbacks = {
            updatePrompt: () => { this.updatePrompt(); },
            updateCurrentModel: () => this.updateCurrentModel(),
            promptInput: (prompt: string, hidden?: boolean) => this.promptInput(prompt, hidden),
            setCurrentTopicTitle: (title?: string) => { this.currentTopicTitle = title; }
        };

        this.sessionManager = new ChatSessionManager(sessionManagerDeps, sessionManagerCallbacks);

        // Response Processor
        const responseProcessorDeps: ChatResponseProcessorDependencies = {
            chatServerModuleProxy: this.chatServerModuleProxy,
            rl: this.rl,
            isProcessingRequest: this.isProcessingRequest,
            reasoningEnabled: this.reasoningEnabled,
            streamingEnabled: this.streamingEnabled,
            messageBodyEnabled: this.messageBodyEnabled,
            jsonOutputMode: this.jsonOutputMode,
            interruptRequested: this.interruptRequested,
            recentlyInterrupted: this.recentlyInterrupted
        };

        const responseProcessorCallbacks: ChatResponseProcessorCallbacks = {
            setProcessingRequest: (processing: boolean) => { this.isProcessingRequest = processing; },
            setInterruptRequested: (requested: boolean) => { this.interruptRequested = requested; },
            setRecentlyInterrupted: (interrupted: boolean) => { this.recentlyInterrupted = interrupted; },
            updatePrompt: () => { this.updatePrompt(); },
            requestTopicTitleGeneration: () => this.sessionManager.requestTopicTitleGeneration(),
            makeRequest: <T>(requestFn: () => Promise<T>) => this.makeRequest(requestFn)
        };

        this.responseProcessor = new ChatResponseProcessor(responseProcessorDeps, responseProcessorCallbacks);
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
                    
                    // Prompt for system prompt since login creates a new session
                    console.log('');
                    console.log(ColorUtils.info('🆕 A new chat session has been created. Please set a system prompt:'));
                    const systemPrompt = await this.promptInput('Enter system prompt for this session (or press Enter for no system prompt): ');
                    const finalSystemPrompt = systemPrompt.trim();
                    
                    if (finalSystemPrompt) {
                        // Start new session on server with the system prompt
                        const success = await this.chatServerModuleProxy.startNewConversation(finalSystemPrompt);
                        
                        if (success) {
                            console.log(ColorUtils.success('✅ Session started with system prompt'));
                            console.log(ColorUtils.info(`🎯 System prompt: ${ColorUtils.system(finalSystemPrompt)}`));
                        } else {
                            console.log(ColorUtils.error('❌ Failed to set system prompt'));
                        }
                    } else {
                        console.log(ColorUtils.info('ℹ️  No system prompt set - using raw model behavior'));
                    }
                    
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
        
        // Build emoji indicators for current state
        const indicators: string[] = [];
        
        // Streaming mode
        indicators.push(this.streamingEnabled ? '📡' : '📄');
        
        // Message body mode  
        indicators.push(this.messageBodyEnabled ? '💬' : '📊');
        
        // JSON mode
        if (this.jsonOutputMode) indicators.push('🔧');
        
        // Reasoning mode
        if (this.reasoningEnabled) indicators.push('🧠');
        
        // Verbose mode
        if (this.verboseMode) indicators.push('📝');
        
        // User info
        const userInfo = this.currentUser ? `👤${this.currentUser}` : '';
        
        // Topic title
        const topicInfo = this.currentTopicTitle ? `[${this.currentTopicTitle}]` : '';
        
        // Build clean prompt
        const stateIndicators = indicators.join('');
        const basePrompt = `${modelInfo} ${stateIndicators} ${userInfo} ${topicInfo}`.trim();
        
        if (this.isProcessingRequest) {
            this.rl.setPrompt(`🔄 ${basePrompt} > `);
        } else {
            this.rl.setPrompt(`${basePrompt} > `);
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
     * Handles user input processing (commands and chat messages)
     */
    private async handleUserInput(message: string): Promise<void> {
        // Use the command handler to process the input
        const isChatMessage = await this.commandHandler.handleUserInput(message);
        
        // If it's a chat message (not a command), process it with the response processor
        if (isChatMessage) {
            await this.responseProcessor.processAiResponse(message);
        }
        
        // Update prompt after any command to reflect current state
        this.updatePrompt();
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
            await this.sessionManager.handleLogin();
            
            // Update prompt after successful login
            if (this.isConnected && this.isAuthenticated) {
                await this.updateCurrentModel();
                this.updatePrompt();
            }
        }

        console.log(ColorUtils.success('💬 Generic Chat CLI Started!'));
        console.log(ColorUtils.info('Type your messages and press Enter.'));
        console.log(ColorUtils.info('Type "quit", "exit", or "bye" to end the chat.'));
        console.log(ColorUtils.info('Type "new" to start a new chat session.'));
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
