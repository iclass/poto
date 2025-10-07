import { LLMPotoModule } from "../llms/LLMPotoModule";
import { PotoUser } from "../server/UserProvider";
import { DataPacket } from "../shared/DataPacket";
import { generatorToSseStream } from "../shared/CommonTypes";

/**
 * Example LLM module that demonstrates reasoning display with DataPacket
 * Extends LLMPotoModule to provide reasoning-enabled chat functionality
 */
export class LLMReasoningExample extends LLMPotoModule {
	getRoute(): string {
		return "llm-reasoning";
	}

	/**
	 * Chat endpoint that streams both content and reasoning using DataPacket
	 * This demonstrates the complete flow from LLM to frontend with reasoning display
	 */
	async postChatWithReasoning_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
		const self = this;
		async function* reasoningStream() {
			// Use the new chatWithReasoning method that returns DataPacket
			for await (const packet of self.chatWithReasoning(message, {
				reasoningEnabled: true,
				systemPrompt: "You are a helpful AI assistant. Show your reasoning process as you think through problems. Be thorough in your analysis and explain your thought process step by step."
			})) {
				yield packet;
			}
		}

		return generatorToSseStream(reasoningStream());
	}

	/**
	 * Simple chat without reasoning (for comparison)
	 */
	async postChatSimple_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
		const self = this;
		async function* simpleStream() {
			// Use the regular chatWithHistory method for simple text streaming
			for await (const text of self.chatWithHistory(message, {
				reasoningEnabled: false
			})) {
				yield text;
			}
		}

		return generatorToSseStream(simpleStream());
	}

	/**
	 * Get the current model information
	 */
	async getModelInfo_(user: PotoUser): Promise<any> {
		return await this.getCurrentModel();
	}

	/**
	 * Get available models
	 */
	async getAvailableModels_(user: PotoUser): Promise<any[]> {
		return await this.getAvailableModels();
	}

	/**
	 * Set the current model
	 */
	async postSetModel_(modelName: string, user: PotoUser): Promise<boolean> {
		return await this.postModel(modelName);
	}

	/**
	 * Get conversation history
	 */
	async getConversationHistory_(user: PotoUser): Promise<any[]> {
		return await this.getConversationHistory();
	}

	/**
	 * Get conversation statistics
	 */
	async getConversationStats_(user: PotoUser): Promise<any> {
		return await this.getConversationStats();
	}

}
