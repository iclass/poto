export class RoleContent {
    role: string; // role of the message (e.g., "system", "user")
    content: string; // content of the message

    constructor(role: string, content: string) {
        this.role = role;
        this.content = content;
    }
}

export type RawLLMResponse = {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: { index: number; message: { role: string; content: string }; finish_reason: string }[];
	usage: TokenUsage
	system_fingerprint: string | null;
}

// Responses API types
export type RawResponsesResponse = {
	id: string;
	object: string;
	created_at: number;
	model: string;
	output: Array<{
		id: string;
		type: string;
		content?: Array<{
			type: string;
			text: string;
			annotations?: any[];
			logprobs?: any[];
		}>;
		role?: string;
		status?: string;
		summary?: any[];
	}>;
	usage?: TokenUsage;
}

export class TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details: object | undefined
    completion_tokens_details: object | undefined

    // Enhanced token tracking
    input_tokens: number;
    output_tokens: number;
    cached_input_tokens: number;

    constructor(usage: TokenUsage | null = null) {
        this.prompt_tokens = usage?.prompt_tokens ?? 0;
        this.completion_tokens = usage?.completion_tokens ?? 0;
        this.total_tokens = usage?.total_tokens ?? 0;
        usage?.prompt_tokens_details  && (this.prompt_tokens_details = usage.prompt_tokens_details)
        usage?.completion_tokens_details  && (this.completion_tokens_details = usage.completion_tokens_details)
        
        // Initialize enhanced tracking
        this.input_tokens = usage?.input_tokens ?? 0;
        this.output_tokens = usage?.output_tokens ?? 0;
        this.cached_input_tokens = usage?.cached_input_tokens ?? 0;
        
        // Extract detailed token information if available
        this.extractDetailedTokens();
    }

    add(_tokenUsage: TokenUsage): void {
        this.completion_tokens += _tokenUsage.completion_tokens;
        this.prompt_tokens += _tokenUsage.prompt_tokens;
        this.total_tokens += _tokenUsage.total_tokens;
        
        // Add enhanced tracking
        this.input_tokens += _tokenUsage.input_tokens;
        this.output_tokens += _tokenUsage.output_tokens;
        this.cached_input_tokens += _tokenUsage.cached_input_tokens;
    }

    /**
     * Extract detailed token information from prompt_tokens_details and completion_tokens_details
     */
    private extractDetailedTokens(): void {
        // Extract input tokens (including cached) from prompt_tokens_details
        if (this.prompt_tokens_details && typeof this.prompt_tokens_details === 'object') {
            const details = this.prompt_tokens_details as any;
            
            // Handle different API response formats
            if (details.cached_tokens !== undefined) {
                this.cached_input_tokens = details.cached_tokens;
            }
            if (details.input_tokens !== undefined) {
                this.input_tokens = details.input_tokens;
            } else {
                // Fallback: assume prompt_tokens are input tokens if no detailed breakdown
                this.input_tokens = this.prompt_tokens - this.cached_input_tokens;
            }
        } else {
            // Fallback: assume prompt_tokens are input tokens
            this.input_tokens = this.prompt_tokens;
        }
        
        // Extract output tokens from completion_tokens_details
        if (this.completion_tokens_details && typeof this.completion_tokens_details === 'object') {
            const details = this.completion_tokens_details as any;
            if (details.output_tokens !== undefined) {
                this.output_tokens = details.output_tokens;
            } else {
                // Fallback: assume completion_tokens are output tokens
                this.output_tokens = this.completion_tokens;
            }
        } else {
            // Fallback: assume completion_tokens are output tokens
            this.output_tokens = this.completion_tokens;
        }
    }

    /**
     * Get comprehensive token breakdown
     */
    getTokenBreakdown(): {
        input_tokens: number;
        output_tokens: number;
        cached_input_tokens: number;
        total_tokens: number;
        prompt_tokens: number;
        completion_tokens: number;
        cache_hit_ratio: number;
        input_efficiency: number;
    } {
        const cache_hit_ratio = this.input_tokens > 0 ? this.cached_input_tokens / this.input_tokens : 0;
        const input_efficiency = this.prompt_tokens > 0 ? this.input_tokens / this.prompt_tokens : 0;
        
        return {
            input_tokens: this.input_tokens,
            output_tokens: this.output_tokens,
            cached_input_tokens: this.cached_input_tokens,
            total_tokens: this.total_tokens,
            prompt_tokens: this.prompt_tokens,
            completion_tokens: this.completion_tokens,
            cache_hit_ratio,
            input_efficiency
        };
    }

    static init(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): TokenUsage {
        const u = new TokenUsage();
        u.prompt_tokens = usage.prompt_tokens;
        u.completion_tokens = usage.completion_tokens;
        u.total_tokens = usage.total_tokens;
        return u;
    }
}

export class Choice {
    index: number;
    message: RoleContent; // Message content
    finish_reason: string;

    constructor(index: number, message: { role: string; content: string }, finishReason: string) {
        this.index = index;
        this.message = new RoleContent(message.role, message.content);
        this.finish_reason = finishReason;
    }
}

export class CompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Choice[];
    usage: TokenUsage;
    systemFingerprint: string | null; // System fingerprint can be null
    firstChoice: string; // Shortcut to the first choice
    remainingToken: number;
    remainingRequests: number;

    constructor(data: RawLLMResponse) {
        this.id = data.id;
        this.object = data.object;
        this.created = data.created;
        this.model = data.model;
        this.choices = data.choices.map(c => new Choice(c.index, c.message, c.finish_reason));
        this.usage = new TokenUsage(data.usage);
        this.systemFingerprint = data.system_fingerprint;
        this.firstChoice = this.choices[0].message.content;
        this.remainingToken = 0;
        this.remainingRequests = 0;
    }

    wasCutOff(): boolean {
        return this.choices[0].finish_reason === 'length';
    }

    wasTimedOut(): boolean {
        return this.choices[0].finish_reason === 'timeout';
    }

    wasFinished(): boolean {
        return this.choices[0].finish_reason === 'stop';
    }

    // Add methods here as necessary
}

/**
 * Convert Responses API response to Chat Completions format
 */
export function convertResponsesToCompletionResponse(responsesData: RawResponsesResponse): CompletionResponse {
    // Find the message item in the output
    const messageItem = responsesData.output.find(item => item.type === 'message');
    
    if (!messageItem || !messageItem.content) {
        throw new Error('No message content found in Responses API output');
    }

    // Extract text content
    const textContent = messageItem.content.find(content => content.type === 'output_text');
    const content = textContent?.text || '';

    // Create a Chat Completions compatible response
    const chatCompletionData: RawLLMResponse = {
        id: responsesData.id,
        object: 'chat.completion',
        created: responsesData.created_at,
        model: responsesData.model,
        choices: [{
            index: 0,
            message: {
                role: messageItem.role || 'assistant',
                content: content
            },
            finish_reason: messageItem.status === 'completed' ? 'stop' : 'length'
        }],
        usage: responsesData.usage || new TokenUsage(),
        system_fingerprint: null
    };

    return new CompletionResponse(chatCompletionData);
}

// Example usage:
// const data = {
//     id: 'chatcmpl-8Zz1T2pI793WHZg5WBG6pMhiOe4Xw',
//     object: 'chat.completion',
//     created: 1703586743,
//     model: 'gpt-35-turbo-16k',
//     choices: [
//         { 
//             index: 0, 
//             message: { 
//                 role: "user", 
//                 content: "Sample message content"
//             }, 
//             finish_reason: 'stop' 
//         }
//     ],
//     usage: { prompt_tokens: 15, completion_tokens: 26, total_tokens: 41 },
//     system_fingerprint: null
// };

// const chatCompletion = new CompletionResponse(data);
// console.log(chatCompletion);
