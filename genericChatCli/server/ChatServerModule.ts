import { PotoUser } from "../../src/server/UserProvider";
import { LLMPotoModule, LLMPotoModuleOptions } from "../../src/llms/LLMPotoModule";
import type { LLM } from "../../src/llms/llm";

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




}
