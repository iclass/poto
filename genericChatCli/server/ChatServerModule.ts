import { PotoUser } from "../../src/server/UserProvider";
import { LLMPotoModule, LLMPotoModuleOptions } from "../../src/llms/LLMPotoModule";
import { LLM } from "../../src/llms/llm";
import { DataPacket } from "../../src/shared/DataPacket";

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

}