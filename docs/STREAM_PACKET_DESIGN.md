# StreamPacket Design Documentation

## Overview

The `StreamPacket` is a common value object designed for end-to-end streaming between backend and frontend. It provides a unified way to handle both reasoning channels and content channels from LLM streams.

## Design Rationale

### Problem Statement
- LLM streams contain both reasoning content and main content
- Current system ignores reasoning content (`reasoning_content` field)
- No unified format for streaming different types of content
- Frontend needs to handle both channels separately

### Solution
The `StreamPacket` provides:
- **Unified interface** for both reasoning and content channels
- **Type safety** with clear TypeScript definitions
- **Backward compatibility** with existing streaming infrastructure
- **Extensibility** for future enhancements

## StreamPacket Structure

```typescript
class StreamPacket {
    reasoning: string;        // Reasoning content from LLM
    content: string;         // Main response content
    isDelta: boolean;        // Whether this is incremental (default: true)
    metadata?: any;          // Optional metadata (tokens, model info, etc.)
    timestamp: number;        // Creation timestamp
}
```

## Key Features

### 1. Dual Channel Support
```typescript
// Extract both reasoning and content from LLM deltas
const packet = StreamPacket.fromStreamingChunk(chunk);
console.log('Reasoning:', packet.reasoning);
console.log('Content:', packet.content);
```

### 2. Flexible Creation Patterns
```typescript
// Content-only streaming
yield StreamPacket.contentOnly("Hello world");

// Reasoning-only streaming  
yield StreamPacket.reasoningOnly("Let me analyze this...");

// Combined reasoning and content
yield new StreamPacket("I need to consider...", "Here's my answer:", true);

// Complete response (not a delta)
yield StreamPacket.complete("Final reasoning", "Complete answer");
```

### 3. Utility Methods
```typescript
// Check if packet has meaningful content
if (packet.hasContent()) {
    // Process the packet
}

// Check if stream is complete
if (packet.isComplete()) {
    // Handle final packet
}

// Get total content length
const length = packet.getTotalLength();

// Merge packets (useful for accumulation)
const merged = packet1.merge(packet2);
```

## Integration with Existing Code

### 1. LLM Streaming Integration
The `StreamingChunk` class now includes:
```typescript
// Extract reasoning content (previously ignored)
const reasoning = chunk.getReasoningContent();

// Convert to StreamPacket
const packet = chunk.toStreamPacket();
```

### 2. LLMPotoModule Integration
New streaming method that returns `StreamPacket`:
```typescript
async *streamLLMWithPackets(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: {
        reasoningEnabled?: boolean;
        systemPrompt?: string;
    } = {}
): AsyncGenerator<StreamPacket>
```

### 3. Frontend Consumption
```typescript
// Process StreamPackets on the client
for await (const packet of stream) {
    if (packet.reasoning) {
        // Update reasoning display
        updateReasoningDisplay(packet.reasoning);
    }
    
    if (packet.content) {
        // Update main content display
        updateContentDisplay(packet.content);
    }
    
    if (packet.isComplete()) {
        // Handle stream completion
        onStreamComplete();
    }
}
```

## Usage Examples

### 1. Basic Streaming
```typescript
// Server-side generator method
async *chatWithReasoning(message: string): AsyncGenerator<StreamPacket> {
    for await (const packet of this.streamLLMWithPackets(message, [], {
        reasoningEnabled: true
    })) {
        yield packet;
    }
}
```

### 2. Client-side Processing
```typescript
// Client-side consumption
async function processStream(stream: AsyncGenerator<StreamPacket>) {
    let reasoning = '';
    let content = '';
    
    for await (const packet of stream) {
        reasoning += packet.reasoning;
        content += packet.content;
        
        // Real-time updates
        updateUI(reasoning, content);
    }
    
    return { reasoning, content };
}
```

### 3. Error Handling
```typescript
try {
    for await (const packet of stream) {
        yield packet;
    }
} catch (error) {
    // Return error as complete packet
    yield StreamPacket.complete('', `Error: ${error.message}`);
}
```

## Benefits

### 1. **Unified Interface**
- Single object handles both reasoning and content
- Consistent API across all streaming scenarios
- Type-safe with TypeScript support

### 2. **Backward Compatibility**
- Existing streaming methods continue to work
- Gradual migration path available
- No breaking changes to current code

### 3. **Enhanced Functionality**
- Access to previously ignored reasoning content
- Rich metadata support
- Flexible creation patterns

### 4. **Developer Experience**
- Clear, intuitive API
- Comprehensive utility methods
- Excellent TypeScript support

## Migration Guide

### Phase 1: Add StreamPacket Support
1. Import `StreamPacket` from `../shared/CommonTypes`
2. Add new streaming methods that return `StreamPacket`
3. Keep existing methods unchanged

### Phase 2: Update Frontend
1. Update client code to handle `StreamPacket` objects
2. Implement thinking/reasoning display
3. Update UI to show both channels

### Phase 3: Gradual Migration
1. Migrate existing streaming endpoints
2. Remove old string-based streaming
3. Full adoption of `StreamPacket` format

## Future Enhancements

### 1. Additional Metadata
```typescript
interface StreamPacketMetadata {
    tokenUsage?: TokenUsage;
    model?: string;
    responseId?: string;
    finishReason?: string;
    systemFingerprint?: string;
    confidence?: number;
    processingTime?: number;
}
```

### 2. Streaming Modes
```typescript
enum StreamMode {
    DELTA = 'delta',           // Incremental updates
    COMPLETE = 'complete',     // Full content
    THINKING_ONLY = 'thinking', // Only reasoning
    CONTENT_ONLY = 'content'   // Only main content
}
```

### 3. Advanced Features
- Packet compression
- Binary content support
- Streaming analytics
- Quality metrics

## Conclusion

The `StreamPacket` design provides a robust, flexible, and type-safe solution for handling dual-channel LLM streaming. It addresses the current limitations while maintaining backward compatibility and providing a clear migration path.

The design is simple yet powerful, making it easy for developers to work with both reasoning and content channels while maintaining the integrity of the streaming data.
