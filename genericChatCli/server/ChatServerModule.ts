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
     * Start a new session with optional system prompt
     * This is a wrapper around createNewTopic for client compatibility
     */
	async startSession(systemPrompt?: string): Promise<boolean> {
		try {
			const sessionId = await this.createNewTopic(systemPrompt);
			return !!sessionId;
		} catch (error) {
			console.error('Error starting new session:', error);
			return false;
		}
	}

	/**
	 * Generate topic title for current session
	 */
	async generateTopicTitle(): Promise<{ title: string; timestamp: string } | null> {
		try {
			return await super.generateTopicTitle();
		} catch (error) {
			console.error('Error generating topic title:', error);
			return null;
		}
	}

	/**
	 * Get topic title for current session
	 */
	async getTopicTitle(): Promise<{ title: string; timestamp: string } | null> {
		try {
			const sessionData = await this.getUserSession();
			return await this.getTopicTitle(sessionData.sessionId);
		} catch (error) {
			console.error('Error getting topic title:', error);
			return null;
		}
	}
}