import { PotoModule } from "../../src/server/PotoModule";

// Test generator module that will be used in the e2e tests
export class TestGeneratorModule extends PotoModule {

    async *postSimpleGenerator_(count: number): AsyncGenerator<{ number: number; message: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        for (let i = 1; i <= count; i++) {
            yield { number: i, message: `Item ${i}`, userId: user?.id };
            await new Promise(resolve => setTimeout(resolve, 10)); // Fast for testing
        }
    }

    async *postFibonacciGenerator_(limit: number): AsyncGenerator<{ index: number; value: number; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        let a = 0, b = 1;
        for (let i = 0; i < limit; i++) {
            yield { index: i, value: a, userId: user?.id };
            [a, b] = [b, a + b];
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }

    async *postErrorGenerator_(shouldError: boolean): AsyncGenerator<{ status: string; userId: string | undefined; data?: string; }> {
        const user = await this.getCurrentUser();
        yield { status: "started", userId: user?.id };
        
        if (shouldError) {
            throw new Error("Generator error occurred as expected");
        }
        
        yield { status: "processing", data: "some data", userId: user?.id };
        yield { status: "completed", userId: user?.id };
    }

    async *postEmptyGenerator_() {
        const user = await this.getCurrentUser();
        // This generator yields nothing
        return;
    }

    async *postAsyncGenerator_(items: string[]) {
        const user = await this.getCurrentUser();
        for (const item of items) {
            // Simulate async processing
            await new Promise(resolve => setTimeout(resolve, 5));
            const processed = item.toUpperCase();
            yield { item, processed, delay: 5, userId: user?.id };
        }
    }

    async postRegularMethod_(message: string): Promise<string> {
        const user = await this.getCurrentUser();
        return `Regular method: ${message} (user: ${user?.id})`;
    }

    // Method without HTTP verb prefix - should default to POST
    async processData_(data: string): Promise<string> {
        const user = await this.getCurrentUser();
        return `Processed data: ${data.toUpperCase()} (user: ${user?.id})`;
    }

    // Another method without HTTP verb prefix - should default to POST
    async *streamData_(items: string[]): AsyncGenerator<{ item: string; processed: string; userId: string | undefined }> {
        const user = await this.getCurrentUser();
        for (const item of items) {
            yield { 
                item, 
                processed: item.toUpperCase(), 
                userId: user?.id 
            };
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }

    async *postProgressGenerator_(steps: number) {
        const user = await this.getCurrentUser();
        for (let i = 0; i < steps; i++) {
            const progress = Math.round(((i + 1) / steps) * 100);
            
            yield {
                type: "progress",
                step: i + 1,
                total: steps,
                progress,
                message: `Processing step ${i + 1} of ${steps}`,
                userId: user?.id
            };
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        yield {
            type: "complete",
            message: "All steps completed successfully!",
            userId: user?.id
        };
    }

    async *postLargeDataGenerator_(size: number) {
        const user = await this.getCurrentUser();
        for (let i = 0; i < size; i++) {
            yield {
                index: i,
                data: `Large data chunk ${i}`.repeat(10), // Create larger chunks
                timestamp: new Date().toISOString(),
                userId: user?.id
            };
            await new Promise(resolve => setTimeout(resolve, 1)); // Very fast for testing
        }
    }

    /**
     * Mock LLM streaming response that simulates real LLM behavior
     * This allows testing the complete streaming pipeline without requiring OpenAI API
     */
    async *postLlmStream_(prompt: string): AsyncGenerator<{
        type: 'content' | 'done';
        content?: string;
        finishReason?: string;
        timestamp: string;
        userId: string | undefined;
    }> {
        const user = await this.getCurrentUser()
        // Simulate LLM thinking time
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Generate a mock response based on the prompt
        const responses = {
            "hello": "Hello! How can I help you today?",
            "story": "Once upon a time, there was a brave little cat who loved to explore. Every day, she would venture into the garden to discover new adventures.",
            "code": "Here's a simple function:\n\n```javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n```",
            "math": "Let me solve that for you. The answer is 42, which is the meaning of life, the universe, and everything.",
            "weather": "I can't check the weather in real-time, but I can help you understand weather patterns and climate science."
        };
        
        // Find the best matching response
        let response = "I understand your question. Let me provide a helpful response.";
        for (const [key, value] of Object.entries(responses)) {
            if (prompt.toLowerCase().includes(key)) {
                response = value;
                break;
            }
        }
        
        // Stream the response character by character to simulate real LLM streaming
        const words = response.split(' ');
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const isLastWord = i === words.length - 1;
            
            yield {
                type: 'content',
                content: word + (isLastWord ? '' : ' '),
                timestamp: new Date().toISOString(),
                userId: user?.id
            };
            
            // Simulate realistic typing speed (10-30ms per word for faster testing)
            await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
        }
        
        // Send completion signal
        yield {
            type: 'done',
            finishReason: 'stop',
            timestamp: new Date().toISOString(),
            userId: user?.id
        };
    }

    /**
     * Mock LLM streaming with progress tracking
     */
    async *postLlmStreamWithProgress_(prompt: string): AsyncGenerator<{
        type: 'content' | 'progress' | 'complete';
        content?: string;
        progress?: number;
        chunksReceived?: number;
        contentLength?: number;
        totalChunks?: number;
        finalContentLength?: number;
        timestamp: string;
        userId: string | undefined;
    }> {
        const user = await this.getCurrentUser()
        const totalWords = 20; // Simulate a longer response
        let chunksReceived = 0;
        let contentLength = 0;
        
        // Start progress
        yield {
            type: 'progress',
            progress: 0,
            chunksReceived: 0,
            contentLength: 0,
            timestamp: new Date().toISOString(),
            userId: user?.id
        };
        
        // Generate mock content
        const words = [
            "This", "is", "a", "mock", "LLM", "response", "that", "simulates",
            "real", "streaming", "behavior", "with", "progress", "tracking",
            "to", "test", "the", "complete", "pipeline", "end-to-end"
        ];
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            chunksReceived++;
            contentLength += word.length + 1; // +1 for space
            
            yield {
                type: 'content',
                content: word + (i === words.length - 1 ? '' : ' '),
                timestamp: new Date().toISOString(),
                userId: user?.id
            };
            
            // Send progress update every 5 words
            if (chunksReceived % 5 === 0) {
                const progress = Math.round((chunksReceived / totalWords) * 100);
                yield {
                    type: 'progress',
                    progress,
                    chunksReceived,
                    contentLength,
                    timestamp: new Date().toISOString(),
                    userId: user?.id
                };
            }
            
            await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        }
        
        // Final completion
        yield {
            type: 'complete',
            totalChunks: chunksReceived,
            finalContentLength: contentLength,
            timestamp: new Date().toISOString(),
            userId: user?.id
        };
    }

    /**
     * Returns a ReadableStream directly (not using generator)
     * This tests the server's ability to handle ReadableStream responses
     */
    async postReadableStream_(message: string): Promise<ReadableStream<Uint8Array>> {
        const user = await this.getCurrentUser()
        const encoder = new TextEncoder();
        
        return new ReadableStream({
            async start(controller) {
                try {
                    // Send initial message
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'start',
                        message: `Starting stream for: ${message}`,
                        userId: user?.id,
                        timestamp: new Date().toISOString()
                    })}\n\n`));
                    
                    // Simulate processing with multiple chunks
                    const words = message.split(' ');
                    for (let i = 0; i < words.length; i++) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                        
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'chunk',
                            index: i,
                            word: words[i],
                            progress: Math.round(((i + 1) / words.length) * 100),
                            userId: user?.id,
                            timestamp: new Date().toISOString()
                        })}\n\n`));
                    }
                    
                    // Send completion
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'complete',
                        totalWords: words.length,
                        finalMessage: `Processed: ${message}`,
                        userId: user?.id,
                        timestamp: new Date().toISOString()
                    })}\n\n`));
                    
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }

    /**
     * Returns a ReadableStream with binary data (simulating file download)
     */
    async postBinaryStream_(filename: string): Promise<ReadableStream<Uint8Array>> {
        const user = await this.getCurrentUser()
        const encoder = new TextEncoder();
        
        return new ReadableStream({
            async start(controller) {
                try {
                    // Send file metadata
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'metadata',
                        filename,
                        size: 1024,
                        userId: user?.id,
                        timestamp: new Date().toISOString()
                    })}\n\n`));
                    
                    // Simulate file chunks
                    const chunkSize = 256;
                    const totalChunks = 4;
                    
                    for (let i = 0; i < totalChunks; i++) {
                        await new Promise(resolve => setTimeout(resolve, 20));
                        
                        // Create mock binary data
                        const chunkData = new Uint8Array(chunkSize);
                        for (let j = 0; j < chunkSize; j++) {
                            chunkData[j] = (i * chunkSize + j) % 256;
                        }
                        
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'binary_chunk',
                            index: i,
                            size: chunkData.length,
                            data: Array.from(chunkData), // Convert to array for JSON serialization
                            progress: Math.round(((i + 1) / totalChunks) * 100),
                            userId: user?.id,
                            timestamp: new Date().toISOString()
                        })}\n\n`));
                    }
                    
                    // Send completion
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'complete',
                        totalChunks,
                        totalSize: chunkSize * totalChunks,
                        userId: user?.id,
                        timestamp: new Date().toISOString()
                    })}\n\n`));
                    
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }

    /**
     * Returns a ReadableStream with pure binary data (simulating audio/video streaming)
     * This streams raw binary data directly without SSE formatting
     */
    async postPureBinaryStream_(fileType: 'audio' | 'video'): Promise<ReadableStream<Uint8Array>> {
        
        // Simulate audio/video file streaming with pure binary data
        const chunkSize = 4096; // Typical chunk size for multimedia streaming
        // Audio: ~40KB (10 chunks), Video: 10MB (2560 chunks)
        const totalChunks = fileType === 'audio' ? 10 : 2560;
        const totalSize = chunkSize * totalChunks;

        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for (let i = 0; i < totalChunks; i++) {
                        // Reduce delay for video to avoid timeout with large size
                        const delay = fileType === 'audio' ? 10 : 0;
                        if (delay > 0) {
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        
                        // Create realistic binary data patterns
                        const chunkData = new Uint8Array(chunkSize);
                        
                        if (fileType === 'audio') {
                            // Simulate audio waveform data (sine wave pattern)
                            for (let j = 0; j < chunkSize; j++) {
                                const sample = Math.sin((i * chunkSize + j) * 0.01) * 127 + 128;
                                chunkData[j] = Math.floor(sample);
                            }
                        } else {
                            // Simulate video frame data (gradient pattern)
                            for (let j = 0; j < chunkSize; j++) {
                                const pattern = ((i * chunkSize + j) * 13) % 256; // Pseudo-random pattern
                                chunkData[j] = pattern;
                            }
                        }
                        
                        // Stream pure binary data directly (no JSON wrapping)
                        controller.enqueue(chunkData);
                    }
                    
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });

        // Return stream directly - PotoServer will detect binary content and handle appropriately
        return stream;
    }
}
