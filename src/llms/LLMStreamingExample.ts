import { PotoModule } from "../server/PotoModule";
import { PotoUser } from "../server/UserProvider";
import { generatorToStream } from "../shared/CommonTypes";
import { LLM, StreamingChunk } from "./llm";

export class LLMStreamingExample extends PotoModule {
	getRoute(): string {
		return "llm-streaming";
	}

	/**
	 * Example 1: Simple LLM streaming - bridge OpenAI response to client
	 */
	async postChat_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
		async function* llmStream() {
			// Initialize LLM
			const llm = LLM.newInstance();
			llm.system("You are a helpful assistant. Keep responses concise.");
			llm.user(message);

			// Get streaming response from OpenAI
			const stream = await llm.requestCompletionStream_();
			const reader = stream.getReader();

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = value as StreamingChunk;
					
					// Yield content to client
					yield {
						type: "content",
						content: chunk.getContent(),
						timestamp: new Date().toISOString(),
						chunkId: chunk.id
					};

					// Check if stream is complete
					if (chunk.isDone()) {
						yield {
							type: "done",
							finishReason: chunk.getFinishReason(),
							timestamp: new Date().toISOString()
						};
						break;
					}
				}
			} finally {
				reader.releaseLock();
			}
		}

		return generatorToStream(llmStream());
	}

	/**
	 * Example 2: LLM streaming with progress tracking
	 */
	async postChatWithProgress_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
		async function* llmStreamWithProgress() {
			const llm = LLM.newInstance();
			llm.system("You are a helpful assistant. Provide detailed responses.");
			llm.user(message);

			const stream = await llm.requestCompletionStream_();
			const reader = stream.getReader();

			let totalChunks = 0;
			let totalContent = "";

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = value as StreamingChunk;
					totalChunks++;
					totalContent += chunk.getContent();

					// Yield progress update every 5 chunks
					if (totalChunks % 5 === 0) {
						yield {
							type: "progress",
							chunksReceived: totalChunks,
							contentLength: totalContent.length,
							timestamp: new Date().toISOString()
						};
					}

					// Yield content
					yield {
						type: "content",
						content: chunk.getContent(),
						chunkNumber: totalChunks
					};

					if (chunk.isDone()) {
						yield {
							type: "complete",
							finishReason: chunk.getFinishReason(),
							totalChunks,
							finalContentLength: totalContent.length,
							timestamp: new Date().toISOString()
						};
						break;
					}
				}
			} finally {
				reader.releaseLock();
			}
		}

		return generatorToStream(llmStreamWithProgress());
	}

	/**
	 * Example 3: LLM streaming with error handling and retries
	 */
	async postChatWithRetry_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
		async function* llmStreamWithRetry() {
			const maxRetries = 3;
			let attempt = 0;

			while (attempt < maxRetries) {
				try {
					attempt++;
					
					yield {
						type: "status",
						message: `Attempt ${attempt}/${maxRetries}`,
						timestamp: new Date().toISOString()
					};

					const llm = LLM.newInstance();
					llm.system("You are a helpful assistant.");
					llm.user(message);

					const stream = await llm.requestCompletionStream_();
					const reader = stream.getReader();

					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;

							const chunk = value as StreamingChunk;
							
							yield {
								type: "content",
								content: chunk.getContent(),
								attempt
							};

							if (chunk.isDone()) {
								yield {
									type: "success",
									attempt,
									finishReason: chunk.getFinishReason()
								};
								return; // Success, exit retry loop
							}
						}
					} finally {
						reader.releaseLock();
					}

				} catch (error) {
					yield {
						type: "error",
						attempt,
						error: error instanceof Error ? error.message : String(error),
						timestamp: new Date().toISOString()
					};

					if (attempt >= maxRetries) {
						yield {
							type: "failed",
							message: "All retry attempts failed",
							timestamp: new Date().toISOString()
						};
						return;
					}

					// Wait before retry
					await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
				}
			}
		}

		return generatorToStream(llmStreamWithRetry());
	}

	/**
	 * Example 4: LLM streaming with custom formatting and metadata
	 */
	async postFormattedChat_(message: string, format: "markdown" | "json" | "plain", user: PotoUser): Promise<ReadableStream<Uint8Array>> {
		async function* formattedLlmStream() {
			const llm = LLM.newInstance();
			
			// Set system prompt based on format
			const formatPrompts = {
				markdown: "You are a helpful assistant. Format your responses in Markdown.",
				json: "You are a helpful assistant. Respond with valid JSON only.",
				plain: "You are a helpful assistant. Provide plain text responses."
			};
			
			llm.system(formatPrompts[format]);
			llm.user(message);

			const stream = await llm.requestCompletionStream_();
			const reader = stream.getReader();

			let fullContent = "";
			let startTime = Date.now();

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = value as StreamingChunk;
					const content = chunk.getContent();
					fullContent += content;

					// Calculate streaming metrics
					const elapsed = Date.now() - startTime;
					const charsPerSecond = Math.round((fullContent.length / elapsed) * 1000);

					yield {
						type: "content",
						content,
						format,
						metrics: {
							elapsedMs: elapsed,
							totalChars: fullContent.length,
							charsPerSecond
						},
						timestamp: new Date().toISOString()
					};

					if (chunk.isDone()) {
						yield {
							type: "complete",
							format,
							finalMetrics: {
								totalTime: elapsed,
								totalChars: fullContent.length,
								averageCharsPerSecond: Math.round((fullContent.length / elapsed) * 1000)
							},
							finishReason: chunk.getFinishReason()
						};
						break;
					}
				}
			} finally {
				reader.releaseLock();
			}
		}

		return generatorToStream(formattedLlmStream());
	}
}
