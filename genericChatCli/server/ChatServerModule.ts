import { PotoUser } from "../../src/server/UserProvider";
import { LLMPotoModule, LLMPotoModuleOptions } from "../../src/llms/LLMPotoModule";
import { LLM } from "../../src/llms/llm";
import { SimpleStreamPacket } from "../../src/shared/SimpleStreamPacket";

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export class ChatServerModule extends LLMPotoModule  {
    constructor() {
        // Initialize with default behavior:
        // - Dialogue journal created from config (default)
        // - Session monitoring settings read from config file
        super();
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
     * Reasoning-enabled streaming chat with SimpleStreamPacket support
     * Returns both reasoning and content streams for real-time display
     */
    async *chatWithReasoning(
        message: string, 
        options: {
            jsonOutput?: boolean;
            reasoningEnabled?: boolean;
            systemPrompt?: string;
        } = {}
    ): AsyncGenerator<SimpleStreamPacket> {
        // Use the new chatWithReasoning method from LLMPotoModule
        for await (const packet of super.chatWithReasoning(message, options)) {
            yield packet;
        }
    }

    /**
     * Public RPC method for reasoning-enabled chat
     * Exposes the chatWithReasoning functionality to the client
     */
    async *postChatWithReasoning(
        message: string, 
        options: {
            jsonOutput?: boolean;
            reasoningEnabled?: boolean;
            systemPrompt?: string;
        } = {}
    ): AsyncGenerator<SimpleStreamPacket> {
        // Use the internal chatWithReasoning method
        for await (const packet of this.chatWithReasoning(message, options)) {
            yield packet;
        }
    }

    /**
     * Public RPC method to control LLM debug mode
     * Exposes debug mode control to the client
     */
    async setLLMDebugMode(enabled: boolean): Promise<void> {
        LLM.setDebugMode(enabled);
    }

    /**
     * Public RPC method to get current LLM debug mode
     */
    async getLLMDebugMode(): Promise<boolean> {
        return LLM.getDebugMode();
    }

    /**
     * Public RPC method to clear current conversation
     * Exposes the clearConversation functionality to the client
     */
    async clearCurrentConversation(): Promise<boolean> {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                console.error('❌ User not authenticated for clear conversation');
                return false;
            }

            if (this.dialogueJournal) {
                await this.dialogueJournal.clearConversation(user);
                console.log(`🧹 Cleared conversation for user ${user.id}`);
                return true;
            } else {
                console.log('⚠️ No dialogue journal available for clearing conversation');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to clear conversation:', error);
            return false;
        }
    }

    /**
     * Non-streaming chat with dialogue journal integration
     * Returns complete response at once with conversation persistence
     */
    async chatNonStreaming(message: string, systemPrompt?: string): Promise<string> {
        const startTime = Date.now();
        let tokenUsage: any = null;
        let finishReason = 'unknown';
        let responseId = '';
        let systemFingerprint: string | null = null;
        let llmModel = '';
        let llmConfig: any = null;
        
        try {
            // Get current user
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            // Update user activity if session monitoring is enabled
            if (this.enableSessionMonitoring) {
                this.updateUserActivity(user.id);
            }
            
            // Add user message to dialogue journal if available
            if (this.dialogueJournal) {
                await this.dialogueJournal.addMessage(user, { 
                    role: 'user', 
                    content: message,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Load conversation history from dialogue journal or use empty array
            const history = this.dialogueJournal 
                ? await this.dialogueJournal.getConversation(user)
                : [];
            
            // Get LLM instance to capture configuration
            const llm = await this.getUserPreferredLLM();
            llmModel = llm.model;
            llmConfig = {
                temperature: llm.temperature,
                maxTokens: llm.max_tokens,
                reasoningEnabled: llm.reasoningEnabled
            };
            
            llm.clearFormat();

            // Set system prompt
            if (systemPrompt) {
                llm.system(systemPrompt);
            } else {
                llm.system("You are a helpful AI assistant. Provide clear and concise responses.");
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

            // Use non-streaming completion with metadata capture
            const response = await llm.requestCompletion_();
            const aiResponse = response.firstChoice;
            
            // Capture metadata if available
            if (response.usage) {
                tokenUsage = response.usage;
            }
            if (response.id) {
                responseId = response.id;
            }
            if (response.systemFingerprint) {
                systemFingerprint = response.systemFingerprint;
            }
            // Note: finishReason is not available in non-streaming completion response
            // We'll use a default value
            finishReason = 'stop';
            
            // Add AI response to dialogue journal with enhanced metadata if available
            if (this.dialogueJournal && aiResponse.trim()) {
                // Calculate performance metrics
                const processingTime = Date.now() - startTime;
                
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
                            firstTokenLatencyMs: 0, // Not applicable for non-streaming
                            tokensPerSecond: 0 // Will be calculated if tokenUsage is available
                        },
                        config: llmConfig,
                        response: {
                            finishReason,
                            responseId: responseId || `resp_${Date.now()}`
                        }
                    }
                });
            }
            
            return aiResponse;
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
     * Export current user's conversation as JSON or CSV
     */
    async exportConversation(format: 'json' | 'csv' = 'json'): Promise<string> {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            if (this.dialogueJournal) {
                return await this.dialogueJournal.exportConversation(user, format);
            } else {
                throw new Error('Dialogue journal not available');
            }
        } catch (error) {
            const err = error as Error;
            throw new Error(`Export failed: ${err.message}`);
        }
    }

}
