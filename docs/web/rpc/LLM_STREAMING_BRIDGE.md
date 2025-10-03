# LLM Streaming Bridge Pattern

This document explains how to bridge streaming responses from LLM APIs (like OpenAI) to clients using our generator-based streaming approach.

## 🎯 **Overview**

The LLM streaming bridge pattern allows you to:
1. **Receive streaming responses** from LLM APIs (OpenAI, Anthropic, etc.)
2. **Process and transform** the data as it arrives
3. **Stream the results** to clients in real-time
4. **Add metadata, progress tracking, and error handling**

## 🏗️ **Architecture**

```
Client Request → Server Module → LLM API → Generator → SSE Stream → Client
```

### **Key Components:**

1. **Server Module**: Handles client requests and manages LLM calls
2. **LLM API**: External streaming API (OpenAI, etc.)
3. **Generator**: Processes LLM chunks and yields transformed data
4. **SSE Stream**: Server-Sent Events stream to client
5. **Client**: Consumes the stream and updates UI

## 📝 **Server-Side Implementation**

### **Basic Pattern**

```typescript
async postChat_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
    async function* llmStream() {
        // 1. Initialize LLM
        const llm = LLM.newInstance();
        llm.system("You are a helpful assistant.");
        llm.user(message);

        // 2. Get streaming response from LLM API
        const stream = await llm.requestCompletionStream_();
        const reader = stream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = value as StreamingChunk;
                
                // 3. Transform and yield data
                yield {
                    type: "content",
                    content: chunk.getContent(),
                    timestamp: new Date().toISOString()
                };

                // 4. Handle completion
                if (chunk.isDone()) {
                    yield {
                        type: "done",
                        finishReason: chunk.getFinishReason()
                    };
                    break;
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    // 5. Convert generator to SSE stream
    return generatorToSseStream(llmStream());
}
```

### **Advanced Pattern with Progress Tracking**

```typescript
async postChatWithProgress_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
    async function* llmStreamWithProgress() {
        const llm = LLM.newInstance();
        llm.system("You are a helpful assistant.");
        llm.user(message);

        const stream = await llm.requestCompletionStream_();
        const reader = stream.getReader();

        let totalChunks = 0;
        let totalContent = "";
        let startTime = Date.now();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = value as StreamingChunk;
                totalChunks++;
                totalContent += chunk.getContent();

                // Progress updates every 5 chunks
                if (totalChunks % 5 === 0) {
                    yield {
                        type: "progress",
                        chunksReceived: totalChunks,
                        contentLength: totalContent.length,
                        elapsedMs: Date.now() - startTime
                    };
                }

                // Content chunks
                yield {
                    type: "content",
                    content: chunk.getContent(),
                    chunkNumber: totalChunks
                };

                if (chunk.isDone()) {
                    yield {
                        type: "complete",
                        totalChunks,
                        finalContentLength: totalContent.length,
                        totalTime: Date.now() - startTime,
                        finishReason: chunk.getFinishReason()
                    };
                    break;
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    return generatorToSseStream(llmStreamWithProgress());
}
```

## 🔄 **Client-Side Consumption**

### **Basic Client Usage**

```typescript
class LLMClient {
    private client: PotoClient;
    private proxy: any;

    constructor(baseUrl: string) {
        this.client = new PotoClient(baseUrl);
        this.proxy = this.client.getProxy('llm-streaming');
    }

    async chat(message: string, onChunk: (data: any) => void) {
        await this.client.loginAsVisitor();
        
        const stream = await this.proxy.postChat_(message) as ReadableStream<Uint8Array>;
        
        for await (const data of sseParser.extractJsonFromSse(stream)) {
            onChunk(data);
        }
    }
}
```

### **Advanced Client with Type Safety**

```typescript
interface LLMChunk {
    type: "content" | "progress" | "complete" | "error";
    content?: string;
    chunkNumber?: number;
    totalChunks?: number;
    contentLength?: number;
    elapsedMs?: number;
    finishReason?: string;
    error?: string;
}

class TypedLLMClient {
    private client: PotoClient;
    private proxy: any;

    constructor(baseUrl: string) {
        this.client = new PotoClient(baseUrl);
        this.proxy = this.client.getProxy('llm-streaming');
    }

    async chatWithProgress(message: string, callbacks: {
        onContent?: (content: string, chunkNumber: number) => void;
        onProgress?: (progress: { chunksReceived: number; contentLength: number }) => void;
        onComplete?: (summary: { totalChunks: number; finalContentLength: number }) => void;
        onError?: (error: string) => void;
    }) {
        await this.client.loginAsVisitor();
        
        const stream = await this.proxy.postChatWithProgress_(message) as ReadableStream<Uint8Array>;
        
        for await (const data of sseParser.extractJsonFromSse(stream)) {
            const chunk = data as LLMChunk;
            
            switch (chunk.type) {
                case "content":
                    callbacks.onContent?.(chunk.content!, chunk.chunkNumber!);
                    break;
                case "progress":
                    callbacks.onProgress?.({
                        chunksReceived: chunk.chunksReceived!,
                        contentLength: chunk.contentLength!
                    });
                    break;
                case "complete":
                    callbacks.onComplete?.({
                        totalChunks: chunk.totalChunks!,
                        finalContentLength: chunk.finalContentLength!
                    });
                    break;
                case "error":
                    callbacks.onError?.(chunk.error!);
                    break;
            }
        }
    }
}
```

## 🎨 **UI Integration Examples**

### **React Component Example**

```typescript
import React, { useState, useEffect } from 'react';
import { LLMClient } from './LLMClient';

function ChatComponent() {
    const [messages, setMessages] = useState<string[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [progress, setProgress] = useState(0);

    const client = new LLMClient('http://localhost:3000');

    const sendMessage = async (message: string) => {
        setIsStreaming(true);
        setCurrentMessage('');
        
        let fullMessage = '';
        
        await client.chatWithProgress(message, {
            onContent: (content, chunkNumber) => {
                fullMessage += content;
                setCurrentMessage(fullMessage);
            },
            onProgress: (progress) => {
                setProgress((progress.chunksReceived / 50) * 100); // Estimate total chunks
            },
            onComplete: (summary) => {
                setMessages(prev => [...prev, fullMessage]);
                setCurrentMessage('');
                setIsStreaming(false);
                setProgress(0);
            }
        });
    };

    return (
        <div>
            <div className="messages">
                {messages.map((msg, i) => (
                    <div key={i} className="message">{msg}</div>
                ))}
                {isStreaming && (
                    <div className="streaming-message">
                        {currentMessage}
                        {progress > 0 && <div className="progress">{progress.toFixed(1)}%</div>}
                    </div>
                )}
            </div>
            
            <input 
                type="text" 
                placeholder="Type a message..."
                onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isStreaming) {
                        sendMessage(e.currentTarget.value);
                        e.currentTarget.value = '';
                    }
                }}
            />
        </div>
    );
}
```

### **Vue Component Example**

```vue
<template>
    <div class="chat-container">
        <div class="messages">
            <div v-for="(message, index) in messages" :key="index" class="message">
                {{ message }}
            </div>
            <div v-if="isStreaming" class="streaming-message">
                {{ currentMessage }}
                <div v-if="progress > 0" class="progress">{{ progress.toFixed(1) }}%</div>
            </div>
        </div>
        
        <input 
            v-model="inputMessage"
            @keyup.enter="sendMessage"
            :disabled="isStreaming"
            placeholder="Type a message..."
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { LLMClient } from './LLMClient';

const messages = ref<string[]>([]);
const currentMessage = ref('');
const isStreaming = ref(false);
const progress = ref(0);
const inputMessage = ref('');

const client = new LLMClient('http://localhost:3000');

const sendMessage = async () => {
    if (!inputMessage.value.trim() || isStreaming.value) return;
    
    const message = inputMessage.value;
    inputMessage.value = '';
    isStreaming.value = true;
    currentMessage.value = '';
    
    let fullMessage = '';
    
    await client.chatWithProgress(message, {
        onContent: (content) => {
            fullMessage += content;
            currentMessage.value = fullMessage;
        },
        onProgress: (progressData) => {
            progress.value = (progressData.chunksReceived / 50) * 100;
        },
        onComplete: () => {
            messages.value.push(fullMessage);
            currentMessage.value = '';
            isStreaming.value = false;
            progress.value = 0;
        }
    });
};
</script>
```

## 🛠️ **Error Handling Patterns**

### **Server-Side Error Handling**

```typescript
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

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
        }
    }

    return generatorToSseStream(llmStreamWithRetry());
}
```

## 📊 **Performance Considerations**

### **Chunk Processing**

- **Small chunks**: Process immediately for low latency
- **Large chunks**: Buffer and process in batches
- **Backpressure**: Respect client processing speed

### **Memory Management**

```typescript
// Good: Process chunks immediately
yield { content: chunk.getContent() };

// Bad: Accumulate all content in memory
let fullContent = "";
// ... accumulate ...
yield { content: fullContent }; // Memory grows with response size
```

### **Connection Management**

```typescript
// Always release readers
try {
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Process chunk
    }
} finally {
    reader.releaseLock(); // Important!
}
```

## 🎯 **Best Practices**

1. **Use generators** for clean, readable streaming code
2. **Handle errors gracefully** with proper cleanup
3. **Provide progress updates** for long-running operations
4. **Use typed interfaces** for better client-side experience
5. **Implement retry logic** for reliability
6. **Monitor performance** with metrics and timing
7. **Clean up resources** properly (readers, timers, etc.)

## 🔗 **Related Documentation**

- [Streaming RPC Implementation](./STREAMING_RPC_README.md)
- [Generator-based Streaming](./GeneratorExample.ts)
- [SSE Parser Usage](./SseParser.ts)
