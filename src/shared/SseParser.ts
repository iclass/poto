import { EventSourceMessage } from './fetch-eventsource/parse';

/**
 * Shared SSE parser that can be used for both long-lived connections and streaming RPC
 */
export class SseParser {
    private buffer = '';
    private decoder = new TextDecoder();

    /**
     * Parse SSE data from a ReadableStream and yield parsed messages
     */
    async *parseSseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<EventSourceMessage> {
        const reader = stream.getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const text = this.decoder.decode(value, { stream: true });
                this.buffer += text;
                
                // Process complete messages from buffer
                const messages = this.processBuffer();
                for (const message of messages) {
                    yield message;
                }
            }
            
            // Process any remaining data in buffer
            const finalMessages = this.processBuffer();
            for (const message of finalMessages) {
                yield message;
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Parse a single SSE message from text
     */
    parseSseMessage(text: string): EventSourceMessage | null {
        const lines = text.split('\n');
        let id = '';
        let event = '';
        let data = '';
        let retry: number | undefined;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '') continue;
            
            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex === -1) continue;
            
            const field = trimmedLine.substring(0, colonIndex);
            const value = trimmedLine.substring(colonIndex + 1).trim();
            
            switch (field) {
                case 'id':
                    id = value;
                    break;
                case 'event':
                    event = value;
                    break;
                case 'data':
                    data = value;
                    break;
                case 'retry':
                    retry = parseInt(value, 10);
                    break;
            }
        }

        if (data === '') return null;
        
        return { id, event, data, retry };
    }

    /**
     * Process the internal buffer and extract complete SSE messages
     */
    private processBuffer(): EventSourceMessage[] {
        const messages: EventSourceMessage[] = [];
        const lines = this.buffer.split('\n');
        
        let currentMessage = '';
        let hasData = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.trim() === '') {
                // Empty line marks end of message
                if (hasData) {
                    const message = this.parseSseMessage(currentMessage);
                    if (message) {
                        messages.push(message);
                    }
                }
                currentMessage = '';
                hasData = false;
            } else {
                currentMessage += line + '\n';
                if (line.startsWith('data:')) {
                    hasData = true;
                }
            }
        }
        
        // Keep incomplete message in buffer
        this.buffer = currentMessage;
        
        return messages;
    }

    /**
     * Extract just the data field from SSE messages (for simple RPC use cases)
     */
    async *extractDataFromSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
        for await (const message of this.parseSseStream(stream)) {
            yield message.data;
        }
    }

    /**
     * Parse JSON data from SSE messages
     */
    async *extractJsonFromSse<T = any>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T> {
        for await (const message of this.parseSseStream(stream)) {
            try {
                const data = JSON.parse(message.data);
                yield data;
            } catch (error) {
                console.error('Error parsing SSE JSON data:', error);
            }
        }
    }
}

// Export a singleton instance for convenience
export const sseParser = new SseParser();
