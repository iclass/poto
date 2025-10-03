# Streaming RPC Implementation

This document describes the streaming RPC functionality added to the PotoClient/PotoServer infrastructure.

## Overview

The streaming RPC feature allows server methods to return `Promise<ReadableStream<T>>` and have the client automatically handle the streaming response. This implementation uses **Server-Sent Events (SSE)** format for streaming, enabling real-time data streaming with proper event formatting.

## Server-Side Implementation

### Method Signature
Server methods that want to stream data should return `Promise<ReadableStream<Uint8Array>>`. You can use async generators for cleaner code:

```typescript
import { generatorToStream, generatorToSseStream } from "../shared/CommonTypes";

async postMyStreamingMethod_(param1: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
    async function* myGenerator() {
        for (let i = 0; i < 10; i++) {
            yield { message: `chunk${i}`, timestamp: new Date().toISOString() };
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return generatorToStream(myGenerator());
}
```

### Generator Utilities
Two utility functions are available for converting generators to streams:

1. **`generatorToStream<T>()`** - Converts generator to plain JSON stream
2. **`generatorToSseStream<T>()`** - Converts generator to SSE format stream

```typescript
// Plain JSON format (each item on a new line)
return generatorToStream(myGenerator());

// SSE format (data: {...}\n\n)
return generatorToSseStream(myGenerator());
```

### Automatic Detection
The server automatically detects when a method returns a `ReadableStream` and:
1. Sets the response content type to `text/event-stream` (SSE format)
2. Returns the stream as the response body
3. Adds appropriate streaming headers (`no-cache`, `keep-alive`)

### SSE Format
The server expects data to be sent in SSE format: `data: {...}\n\n`
- Each chunk should be prefixed with `data: `
- Followed by JSON-encoded data
- Ending with `\n\n` (double newline)

## Client-Side Usage

### Basic Usage
```typescript
const client = new PotoClient('http://localhost:3000');
await client.loginAsVisitor();

const proxy = client.getProxy('mymodule');

// Call streaming method
const stream = await proxy.postMyStreamingMethod_('param') as ReadableStream<Uint8Array>;

// Consume the SSE stream
for await (const data of client.consumeSseStream(stream)) {
    console.log('Received:', data);
}
```

### Helper Methods
The PotoClient provides three helper methods for consuming streams:

1. **`consumeStream<T>(stream: ReadableStream<T>)`** - Generic stream consumer
2. **`consumeTextStream(stream: ReadableStream<Uint8Array>)`** - Text stream consumer with decoding
3. **`consumeSseStream<T>(stream: ReadableStream<Uint8Array>)`** - SSE stream consumer with automatic parsing

### Manual Stream Reading
```typescript
const stream = await proxy.postMyStreamingMethod_('param') as ReadableStream<Uint8Array>;
const reader = stream.getReader();
const decoder = new TextDecoder();

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const text = decoder.decode(value, { stream: true });
    console.log('Received:', text);
}

reader.releaseLock();
```

## Example: Test Module

See `TestStreamingModule.ts` for complete examples:

- `postCounterStream_(count: number)` - Streams numbers from 1 to count
- `postTextStream_(message: string)` - Streams words from a message
- `postEcho_(message: string)` - Regular non-streaming method for comparison

## Integration with Existing Code

The streaming RPC is fully backward compatible. Existing non-streaming methods continue to work unchanged.

### Service Class Example
```typescript
export class MyStreamingService {
    private client: PotoClient;
    private proxy: any;
    
    constructor(baseUrl: string) {
        this.client = new PotoClient(baseUrl);
        this.proxy = this.client.getProxy('mymodule');
    }
    
    async startStream(param: string, onChunk: (data: any) => void) {
        const stream = await this.proxy.postMyStreamingMethod_(param) as ReadableStream<Uint8Array>;
        
        for await (const chunk of this.client.consumeTextStream(stream)) {
            try {
                // Parse SSE format if needed
                const match = chunk.match(/^data: (.+)$/m);
                if (match) {
                    const data = JSON.parse(match[1]);
                    onChunk(data);
                }
            } catch (error) {
                console.error('Error parsing chunk:', error);
            }
        }
    }
}
```

## Technical Details

### Server-Side Changes
- Enhanced `createHttpHandler` in `PotoServer.ts` to detect `ReadableStream` return types
- Automatic setting of streaming headers (`text/event-stream`, `no-cache`, `keep-alive`)

### Client-Side Changes
- Enhanced `getProxy` method to detect streaming responses
- Added `consumeStream`, `consumeTextStream`, and `consumeSseStream` helper methods
- Automatic handling of `text/event-stream` content type

### Shared SSE Infrastructure
- Created `SseParser` class for consistent SSE parsing across the codebase
- Reused existing SSE parsing logic from `fetch-eventsource` module
- Provides both low-level message parsing and high-level JSON extraction

### Error Handling
- Streaming errors are propagated through the stream
- Network errors are thrown as exceptions
- Proper cleanup of stream readers

## Future Enhancements

1. **Type Safety**: Add TypeScript decorators to mark streaming methods
2. **Bidirectional Streaming**: Support for streaming request bodies
3. **Stream Transformation**: Built-in support for common stream transformations
4. **Retry Logic**: Automatic retry for failed streaming connections
5. **Backpressure**: Handle backpressure in streaming scenarios

## Testing

Run the demo to test the streaming RPC functionality:

```typescript
import { demoStreamingRpc } from './StreamingRpcDemo';

// Test the streaming functionality
await demoStreamingRpc();
```

This will demonstrate both regular RPC calls and streaming RPC calls with different consumption patterns.
