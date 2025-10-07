/**
 * 
 * Note: keep the class lean and mean. don't add unnecessary methods, such as JSON related
 * 
 */
export class DataPacket {
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

    /**
     * The error content
     */
    error?: string;

    constructor(source: string = '', reasoning: string = '', content: string = '', error?: string) {
        this.source = source;
        this.reasoning = reasoning;
        this.content = content;
        this.error = error;
    }

    /**
     * Check if this packet has any meaningful content
     */
    hasContent(): boolean {
        return this.content.length > 0 || this.reasoning.length > 0 || this.source.length > 0 || (this.error !== undefined && this.error.length > 0);
    }

    /**
     * Check if this packet has an error
     */
    hasError(): boolean {
        return this.error !== undefined;
    }

}
