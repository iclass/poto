/**
 * Common value object for e2e streaming between backend and frontend
 * Experimental design with three fields: source, reasoning, content
 * Handles multiple data channels from LLM streams
 */
export class StreamPacket {
    /**
     * The source of the data (e.g., 'llm', 'user', 'system', 'tool')
     * Helps identify where the content originated
     */
    source: string;

    /**
     * The reasoning content from the LLM
     * This represents the model's internal reasoning process
     */
    reasoning: string;

    /**
     * The main content/response from the LLM
     * This is what the user sees as the final response
     */
    content: string;

    /**
     * Whether this packet represents a delta (incremental update) or complete content
     * Defaults to true for streaming scenarios
     */
    isDelta: boolean;

    /**
     * Optional metadata for the packet
     * Can include token usage, model info, etc.
     */
    metadata?: {
        tokenUsage?: any;
        model?: string;
        responseId?: string;
        finishReason?: string;
        systemFingerprint?: string;
        [key: string]: any;
    };

    /**
     * Timestamp when this packet was created
     */
    timestamp: number;

    constructor(
        source: string = 'llm',
        reasoning: string = '',
        content: string = '',
        isDelta: boolean = true,
        metadata?: any
    ) {
        this.source = source;
        this.reasoning = reasoning;
        this.content = content;
        this.isDelta = isDelta;
        this.metadata = metadata;
        this.timestamp = Date.now();
    }

    /**
     * Create a StreamPacket from an LLM StreamingChunk
     * Extracts both reasoning content and main content
     */
    static fromStreamingChunk(chunk: any): StreamPacket {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) {
            return new StreamPacket('llm', '', '', true);
        }

        // Extract reasoning content
        const reasoning = delta.reasoning_content || '';
        
        // Extract main content
        const content = delta.content || '';

        // Capture metadata if available
        const metadata = {
            tokenUsage: chunk.usage,
            model: chunk.model,
            responseId: chunk.id,
            systemFingerprint: chunk.systemFingerprint
        };

        return new StreamPacket('llm', reasoning, content, true, metadata);
    }

    /**
     * Create a StreamPacket for a complete response (not a delta)
     */
    static complete(source: string, reasoning: string, content: string, metadata?: any): StreamPacket {
        return new StreamPacket(source, reasoning, content, false, metadata);
    }

    /**
     * Create a StreamPacket for content-only streaming (no reasoning)
     */
    static contentOnly(source: string, content: string, isDelta: boolean = true): StreamPacket {
        return new StreamPacket(source, '', content, isDelta);
    }

    /**
     * Create a StreamPacket for reasoning-only streaming (no content)
     */
    static reasoningOnly(source: string, reasoning: string, isDelta: boolean = true): StreamPacket {
        return new StreamPacket(source, reasoning, '', isDelta);
    }

    /**
     * Create a StreamPacket for source-only streaming (no reasoning or content)
     */
    static sourceOnly(source: string, isDelta: boolean = true): StreamPacket {
        return new StreamPacket(source, '', '', isDelta);
    }

    /**
     * Check if this packet has any meaningful content
     */
    hasContent(): boolean {
        return this.content.length > 0 || this.reasoning.length > 0 || this.source.length > 0;
    }

    /**
     * Check if this packet represents the end of a stream
     */
    isComplete(): boolean {
        return !this.isDelta;
    }

    /**
     * Get the total length of all content in this packet
     */
    getTotalLength(): number {
        return this.source.length + this.reasoning.length + this.content.length;
    }

    /**
     * Convert to a simple object for JSON serialization
     */
    toJSON(): any {
        return {
            source: this.source,
            reasoning: this.reasoning,
            content: this.content,
            isDelta: this.isDelta,
            metadata: this.metadata,
            timestamp: this.timestamp
        };
    }

    /**
     * Create a StreamPacket from a JSON object
     */
    static fromJSON(data: any): StreamPacket {
        const packet = new StreamPacket(
            data.source || 'llm',
            data.reasoning || '',
            data.content || '',
            data.isDelta !== false, // default to true
        );
        packet.metadata = data.metadata;
        packet.timestamp = data.timestamp || Date.now();
        return packet;
    }

    /**
     * Merge this packet with another packet
     * Useful for accumulating deltas
     */
    merge(other: StreamPacket): StreamPacket {
        return new StreamPacket(
            other.source || this.source, // Use other's source if available
            this.reasoning + other.reasoning,
            this.content + other.content,
            other.isDelta, // Use the other packet's delta status
            { ...this.metadata, ...other.metadata }
        );
    }

    /**
     * Create a copy of this packet
     */
    clone(): StreamPacket {
        return new StreamPacket(
            this.source,
            this.reasoning,
            this.content,
            this.isDelta,
            this.metadata ? { ...this.metadata } : undefined
        );
    }
}
