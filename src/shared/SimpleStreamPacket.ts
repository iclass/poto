/**
 * Simple experimental StreamPacket with three fields: source, reasoning, content
 * Designed for testing with it-merge and it-all tools
 * 
 * Note: keep the class lean and mean. don't add unnecessary methods, such as JSON related
 * 
 */
export class SimpleStreamPacket {
    /**
     * The source of the data (e.g., 'llm', 'user', 'system', 'tool')
     */
    source: string;

    /**
     * The reasoning content
     */
    reasoning: string;

    /**
     * The main content
     */
    content: string;

    constructor(source: string = '', reasoning: string = '', content: string = '') {
        this.source = source;
        this.reasoning = reasoning;
        this.content = content;
    }

    /**
     * Check if this packet has any meaningful content
     */
    hasContent(): boolean {
        return this.content.length > 0 || this.reasoning.length > 0 || this.source.length > 0;
    }

}
