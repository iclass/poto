import { CompletionResponse, RawLLMResponse, RawResponsesResponse, TokenUsage, convertResponsesToCompletionResponse } from "../server/CompletionResponse";
import { JSONSchema } from "../shared/JSONSchema";
import {getAppEnv} from '../server/AppEnv'
import { DialogEntry, DialogRole, OpenAIContentBlock, DialogRoles } from "../shared/CommonTypes";
import { DataPacket } from "../shared/DataPacket";
import { LLMConfig } from "./LLMConfig";

/**
 * OpenAI streaming chunk delta structure
 */
export interface OpenAIStreamingDelta {
    role?: string;
    content?: string;
    reasoning_content?: string; // Doubao-specific reasoning content
    tool_calls?: Array<{
        index: number;
        id?: string;
        type: string;
        function?: {
            name: string;
            arguments: string;
        };
    }>;
}

/**
 * OpenAI streaming chunk choice structure
 */
export interface OpenAIStreamingChoice {
    index: number;
    delta: OpenAIStreamingDelta;
    finish_reason: string | null;
}

/**
 * OpenAI streaming chunk usage structure (only present in final chunk)
 */
export interface OpenAIStreamingUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

/**
 * OpenAI streaming chunk JSON structure
 * Matches the exact format returned by OpenAI's streaming API
 */
export interface OpenAIStreamingChunk {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    model: string;
    choices: OpenAIStreamingChoice[];
    usage?: OpenAIStreamingUsage;
    system_fingerprint?: string;
}

/**
 * Represents a single chunk in a streaming completion response
 */
export class StreamingChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: OpenAIStreamingChoice[];
    usage?: TokenUsage;
    systemFingerprint?: string;
    constructor(data: OpenAIStreamingChunk) {
        this.id = data.id;
        this.object = data.object;
        this.created = data.created;
        this.model = data.model;
        this.choices = data.choices;
        this.usage = data.usage ? TokenUsage.init(data.usage) : undefined;
        this.systemFingerprint = data.system_fingerprint;
    }

    /**
     * Get the content delta from the first choice
     * Only uses the content field, ignores reasoning_content completely
     */
    getContent(): string {
        const delta = this.choices[0]?.delta;
        if (!delta) return '';
        
        // Only use the content field, ignore reasoning_content completely
        // Only ignore zero-length content, stream everything else including spaces
        if (delta.content !== undefined && delta.content !== null && delta.content.length > 0) {
            return delta.content;
        }
        
        return '';
    }

    /**
     * Check if this is the final chunk
     */
    isDone(): boolean {
        const finishReason = this.choices[0]?.finish_reason;
        // Stream is done when finish_reason is not null and not undefined
        return finishReason != null;
    }

    /**
     * Get the finish reason if this is the final chunk
     */
    getFinishReason(): string | null {
        return this.choices[0]?.finish_reason || null;
    }

    /**
     * Get tool calls from the delta (if any)
     */
    getToolCalls(): OpenAIStreamingDelta['tool_calls'] {
        return this.choices[0]?.delta?.tool_calls;
    }

    /**
     * Check if this chunk contains tool calls
     */
    hasToolCalls(): boolean {
        return !!(this.choices[0]?.delta?.tool_calls?.length);
    }

    /**
     * Get the role from the delta (usually only present in first chunk)
     */
    getRole(): string | undefined {
        return this.choices[0]?.delta?.role;
    }

    /**
     * Get the reasoning content delta from the first choice
     * This extracts the thinking/reasoning content from models that support it
     */
    getReasoningContent(): string {
        const delta = this.choices[0]?.delta;
        if (!delta) return '';
        
        // Extract reasoning content (thinking channel)
        if (delta.reasoning_content !== undefined && delta.reasoning_content !== null && delta.reasoning_content.length > 0) {
            return delta.reasoning_content;
        }
        
        return '';
    }

    /**
     * Create a DataPacket from this StreamingChunk
     * This provides a unified way to handle both content and reasoning channels
     */
    toStreamPacket(): DataPacket {
        const delta = this.choices?.[0]?.delta;
        if (!delta) {
            return new DataPacket('llm', '', '');
        }

        // Extract reasoning content
        const reasoning = delta.reasoning_content || '';
        
        // Extract main content
        const content = delta.content || '';

        // Clean output - no debug logging

        return new DataPacket('llm', reasoning, content);
    }
}

/**
 * do not reuse the instance!
 */
export class LLM {
    static remainingTokens = 300000
    static debugMode = false
    static remainingRequests = 300

    static setDebugMode(enabled: boolean): void {
        LLM.debugMode = enabled;
    }

    static getDebugMode(): boolean {
        return LLM.debugMode;
    }

    static reqDelay = 1
    static delayIncrement = 50 // ms
    static midValueForRemainingTokens = 100000 // per minute

    messages: DialogEntry[] = []

    temperature = 0;
    n = 1;
    stream = false;
    top_p = 1.0;
    max_tokens = 4096;
    presence_penalty = 0.0;
    frequency_penalty = 0.0;
    model = ''
    apiKey = ''
    apiUrl = ''
	responseFormat: string = 'json_object';
    // Universal reasoning control - enabled/disabled for all models
    reasoningEnabled: boolean = false;
    // Reasoning effort level for GPT-5 models (minimal|low|medium|high)
    reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'medium';
    private currentAbortController: AbortController | undefined;
    
    // Maximum prompt length threshold (in characters) - configurable per instance
    private maxPromptLength: number = 5000;

    // Session tracking fields
    private sessionStartTime: Date;
    private sessionUsage: TokenUsage;
    private requestCount: number;
    private requestHistory: Array<{
        timestamp: Date;
        usage: TokenUsage;
        model: string;
        maxTokens: number;
        actualTokens: number;
    }>;
    

    /**
     * Get the correct parameter name for max tokens based on the model
     */
    private getMaxTokensParamName(): string {
        // GPT-5 models use max_completion_tokens in Chat Completions API
        if (this.isGpt5Model()) {
            return 'max_completion_tokens';
        }
        return 'max_tokens';
    }

    /**
     * Check if this model should use the Responses API
     */
    private isGpt5Model(): boolean {
        return this.model.includes('gpt-5');
    }

    /**
     * Check if this is a GPT-5-nano model that supports streaming
     */
    private isGpt5NanoModel(): boolean {
        return this.model.includes('gpt-5-nano');
    }

    /**
     * Check if this is a Doubao model based on model name
     */
    private isDoubaoModel(): boolean {
        return this.model.toLowerCase().includes('doubao');
    }

    /**
     * Get the appropriate API endpoint based on the model
     */
    private getApiEndpoint(): string {
        // Use Chat Completions API for all models (including GPT-5)
        return this.apiUrl;
    }
    
    static newInstance(maxPromptLength?: number) {
        // Ensure LLMConfig is loaded before using it
        if (!LLMConfig.isLoaded()) {
            LLMConfig.loadConfigs();
        }
        const defaultConfig = LLMConfig.getDefaultConfig();
        return new LLM(
            defaultConfig.model,
            defaultConfig.apiKey,
            defaultConfig.endPoint,
            maxPromptLength
        );
    }

    // Internal request-scoped abort signal (set by RequestContext)
    private _requestAbortSignal?: AbortSignal;

    constructor(model: string, apiKey: string, url: string, maxPromptLength?: number) {
        this.model = model
        this.apiKey = apiKey
        this.apiUrl = url
        this.maxPromptLength = maxPromptLength ?? 5000; // Default to 5000 if not specified
        
        // Initialize session tracking
        this.sessionStartTime = new Date();
        this.sessionUsage = new TokenUsage();
        this.requestCount = 0;
        this.requestHistory = [];
    }

    requireJsonResponse = true

    /**
     * message queue will be cleared afterward
     * @returns {Promise<CompletionResponse>}
     * @throws{Error}
     *      TypeError - network expcetions,
     *      AbortError - abort sgnal
     *      LLMExceptions - LLM related, such as
     *
     */
    async requestCompletion_(maxTokens: number = 3000, debug: boolean = false): Promise<CompletionResponse> {
        try {
            // Use Chat Completions API for all models (including GPT-5)
            const response = await this.requestCompletionChat_(maxTokens, debug);
            
            // Track token usage for this request
            this.trackTokenUsage(response.usage, maxTokens);
            
            return response;
        } finally {
            // Always clear messages after completion to prevent accumulation
            this.clearMsgs();
        }
    }

    /**
     * Chat Completions API implementation (existing)
     */
    private async requestCompletionChat_(maxTokens: number = 3000, debug: boolean = false): Promise<CompletionResponse> {
        // Validate prompt length before making the request to prevent runaway costs
        this.validatePromptLength();

        const bodyObj: any = {
            model: this.model,
            messages: this.messages,
            n: this.n,
            stream: this.stream,
            top_p: this.top_p,
            [this.getMaxTokensParamName()]: maxTokens ?? this.max_tokens,
            presence_penalty: this.presence_penalty,
            frequency_penalty: this.frequency_penalty
        };

        // GPT-5 models only support default temperature (1), so don't include temperature parameter
        if (!this.isGpt5Model() || this.temperature !== 0) {
            bodyObj.temperature = this.temperature;
        }

        this.responseFormat && (bodyObj.response_format = { type: this.responseFormat });

        // Add universal reasoning control
        this.addReasoningControlToBody(bodyObj);

        if (debug) {
            console.debug('>>> body to llm (Chat Completions)')
            console.dir(bodyObj,  { depth: null })
            console.debug('<<< ')
        }

        const body = JSON.stringify(bodyObj);

        // Establish an effective AbortSignal for the upstream fetch
        const effectiveSignal: AbortSignal | undefined = ((): AbortSignal | undefined => {
            // Priority: explicit signal > request-scoped signal > create new controller
            if (this._requestAbortSignal) return this._requestAbortSignal;
            this.currentAbortController = new AbortController();
            return this.currentAbortController.signal;
        })();

        const response: Response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body,
            ...(effectiveSignal ? { signal: effectiveSignal } as any : {})
        });

        if (response.ok) {
            let res = new CompletionResponse((await response.json()) as RawLLMResponse);
            return res
        }
        else {
            let msg = '<' + this.model + ">: " + response.status + ": " + response.statusText + " : " + await response.text();
            msg += '/ llm remaining tokens:' + LLM.remainingTokens
            console.error('AI call (Chat Completions)', msg)
            throw new LLMError(response.status, msg)
        }
    }

    /**
     * Responses API implementation (new)
     */
    private async requestCompletionResponses_(maxTokens: number = 3000, debug: boolean = false): Promise<CompletionResponse> {
        // Validate prompt length before making the request to prevent runaway costs
        this.validatePromptLength();

        // Convert messages to input format for Responses API
        const input = this.messages.length === 1 && this.messages[0].role === 'user' 
            ? this.messages[0].content 
            : this.messages;

        const bodyObj: any = {
            model: this.model,
            input: input,
            [this.getMaxTokensParamName()]: maxTokens ?? this.max_tokens
        };

        // Note: Responses API for GPT-5 models has limited parameter support
        // Only include parameters that are actually supported
        if (this.temperature !== 0) {
            bodyObj.temperature = this.temperature;
        }
        if (this.top_p !== 1.0) {
            bodyObj.top_p = this.top_p;
        }

        // Handle system messages
        const systemMessage = this.messages.find(msg => msg.role === 'system');
        if (systemMessage) {
            bodyObj.instructions = systemMessage.content;
        }

        // Handle response format
        if (this.responseFormat) {
            bodyObj.text = {
                format: { type: this.responseFormat }
            };
        }

        // Add universal reasoning control
        this.addReasoningControlToBody(bodyObj);

        if (debug) {
            console.debug('>>> body to llm (Responses API)')
            console.dir(bodyObj,  { depth: null })
            console.debug('<<< ')
        }

        const body = JSON.stringify(bodyObj);

        // Establish an effective AbortSignal for the upstream fetch
        const effectiveSignal: AbortSignal | undefined = ((): AbortSignal | undefined => {
            // Priority: explicit signal > request-scoped signal > create new controller
            if (this._requestAbortSignal) return this._requestAbortSignal;
            this.currentAbortController = new AbortController();
            return this.currentAbortController.signal;
        })();

        const response: Response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body,
            ...(effectiveSignal ? { signal: effectiveSignal } as any : {})
        });

        if (response.ok) {
            const responsesData = await response.json() as RawResponsesResponse;
            return convertResponsesToCompletionResponse(responsesData);
        }
        else {
            let msg = '<' + this.model + ">: " + response.status + ": " + response.statusText + " : " + await response.text();
            msg += '/ llm remaining tokens:' + LLM.remainingTokens
            console.debug('AI call (Responses API)', msg)
            throw new LLMError(response.status, msg)
        }
    }

    /**
     * Streaming version of requestCompletion_
     * Returns a ReadableStream that yields completion chunks as they arrive
     * 
     * @example
     * ```typescript
     * const llm = LLM.newInstance();
     * llm.user("Tell me a story");
     * 
     * const stream = await llm.requestCompletionStream_();
     * const reader = stream.getReader();
     * 
     * while (true) {
     *   const { done, value } = await reader.read();
     *   if (done) break;
     *   
     *   console.log('Chunk:', value.getContent());
     *   if (value.isDone()) {
     *     console.log('Finished with reason:', value.getFinishReason());
     *     break;
     *   }
     * }
     * ```
     * 
     * @param maxTokens Maximum tokens for the completion
     * @param debug Whether to enable debug logging
     * @returns ReadableStream<StreamingChunk>
     * @throws{Error}
     *      TypeError - network exceptions,
     *      AbortError - abort signal
     *      LLMError - LLM related errors
     */
    async requestCompletionStream_(maxTokens: number = 3000, signal?: AbortSignal): Promise<ReadableStream<StreamingChunk>> {
        // Use Chat Completions API for all models (including GPT-5)

        // Validate prompt length before making the request to prevent runaway costs
        this.validatePromptLength();
        
        const bodyObj: any = {
            model: this.model,
            messages: this.messages,
            n: this.n,
            stream: true, // !! Force streaming for this method
            top_p: this.top_p,
            [this.getMaxTokensParamName()]: maxTokens ?? this.max_tokens,
            presence_penalty: this.presence_penalty,
            frequency_penalty: this.frequency_penalty
        };

        // GPT-5 models only support default temperature (1), so don't include temperature parameter
        if (!this.isGpt5Model() || this.temperature !== 0) {
            bodyObj.temperature = this.temperature;
        }

        this.responseFormat && (bodyObj.response_format = { type: this.responseFormat });

        // Add universal reasoning control
        this.addReasoningControlToBody(bodyObj);

        // Add stream_options for Doubao to include token usage in streaming
        if (this.isDoubaoModel()) {
            bodyObj.stream_options = { include_usage: true };
        }

        if (LLM.debugMode) {
            console.debug('>>> body to llm (streaming)')
            console.dir(bodyObj, { depth: null })
            console.debug('<<< ')
        }
        
        

        const body = JSON.stringify(bodyObj);

        // Establish an effective AbortSignal for the upstream fetch
        const effectiveSignal: AbortSignal | undefined = ((): AbortSignal | undefined => {
            // Priority: explicit signal > request-scoped signal > create new controller
            if (signal) return signal;
            if (this._requestAbortSignal) return this._requestAbortSignal;
            this.currentAbortController = new AbortController();
            return this.currentAbortController.signal;
        })();

        const response: Response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body,
            signal: effectiveSignal
        });

        if (!response.ok) {
            let msg = '<' + this.model + ">: " + response.status + ": " + response.statusText + " : " + await response.text();
            msg += '/ llm remaining tokens:' + LLM.remainingTokens
            console.debug('AI call (streaming)', msg)
            throw new LLMError(response.status, msg)
        }

        if (!response.body) {
            throw new Error('Response body is null - cannot create stream');
        }

        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

        const llmSelf = this;
        // console.debug(`✅ LLM upstream response received, starting stream`, {
        //     model: this.model,
        //     status: response.status,
        //     timestamp: new Date().toISOString()
        // });

        return new ReadableStream<StreamingChunk>({
            async start(controller) {
                reader = response.body!.getReader();
                const decoder = new TextDecoder();

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            // console.debug(`✅ LLM upstream stream completed successfully`, {
                            //     model: llmSelf.model,
                            //     timestamp: new Date().toISOString()
                            // });
                            controller.close();
                            break;
                        }

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (line.trim() === '') continue;
                            
                            // Handle SSE format: data: <content>
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6); // Remove 'data: ' prefix
                                
                                // Handle the special [DONE] marker
                                if (data === '[DONE]') {
                                    // console.debug(`✅ LLM upstream stream [DONE] marker received`, {
                                    //     model: llmSelf.model,
                                    //     timestamp: new Date().toISOString()
                                    // });
                                    controller.close();
                                    return;
                                }
                                
                                // Skip empty data lines
                                if (data.trim() === '') continue;
                                
                                
                                // Try to parse as JSON, but handle non-JSON gracefully
                                try {
                                    /**
                                     * openAI SSE format sample:
                                     {
                                        "id": "chatcmpl-123",
                                        "object": "chat.completion.chunk",
                                        "created": 1712345678,
                                        "model": "gpt-4.1",
                                        "system_fingerprint": "fp_abc123",
                                        "choices": [
                                            {
                                            "index": 0,
                                            "delta": {
                                                "role": "assistant",
                                                "content": "Hello"
                                            },
                                            "logprobs": null,
                                            "finish_reason": null
                                            }
                                        ]
                                     }
                                     */
                                    const parsed: OpenAIStreamingChunk = JSON.parse(data) as OpenAIStreamingChunk;
                                    
                                    
                                    const streamingChunk = new StreamingChunk(parsed);
                                    controller.enqueue(streamingChunk);
                                } catch (e) {
                                    // Log non-JSON data for debugging, but don't fail
                                    if (LLM.debugMode) {
                                        console.debug('Non-JSON data in SSE stream:', data);
                                        console.debug('Parse error:', e);
                                    }
                                    // Continue processing other lines instead of failing
                                }
                            }
                            // Handle other SSE field types (event, id, retry) if needed
                            else if (line.startsWith('event: ') || line.startsWith('id: ') || line.startsWith('retry: ')) {
                                if (LLM.debugMode) {
                                    console.debug('SSE field:', line);
                                }
                            }
                            // Handle comment lines (start with :)
                            else if (line.startsWith(':')) {
                                if (LLM.debugMode) {
                                    console.debug('SSE comment:', line);
                                }
                            }
                            // Log unexpected lines for debugging
                            else if (LLM.debugMode && line.trim() !== '') {
                                console.debug('Unexpected SSE line:', line);
                            }
                        }
                    }
                } catch (error) {
                    // console.debug(`💥 LLM upstream stream error during processing`, {
                    //     error: error instanceof Error ? error.message : String(error),
                    //     model: llmSelf.model,
                    //     timestamp: new Date().toISOString()
                    // });
                    controller.error(error);
                } finally {
                    reader!.releaseLock();
                }
            },
            async cancel(reason) {
                // console.debug(`🤖 LLM upstream request cancellation initiated`, {
                //     reason: reason || 'Unknown',
                //     model: llmSelf.model,
                //     messageCount: llmSelf.messages.length,
                //     timestamp: new Date().toISOString(),
                //     hasAbortController: !!llmSelf.currentAbortController
                // });
                
                try {
                    // Cancel upstream network fetch via instance controller
                    if (llmSelf.currentAbortController) {
                        llmSelf.currentAbortController.abort();
                        // console.debug(`✅ LLM AbortController.abort() called successfully`, {
                        //     model: llmSelf.model,
                        //     timestamp: new Date().toISOString()
                        // });
                    }
                    
                    if (reader) {
                        await reader.cancel();
                        // console.debug(`✅ LLM Reader.cancel() completed successfully`, {
                        //     model: llmSelf.model,
                        //     timestamp: new Date().toISOString()
                        // });
                    }
                    
                    // console.debug(`🧹 LLM upstream cancellation completed`, {
                    //     model: llmSelf.model,
                    //     timestamp: new Date().toISOString()
                    // });
                } catch (error) {
                    // console.debug(`⚠️  Error during LLM upstream cancellation`, {
                    //     error: error instanceof Error ? error.message : String(error),
                    //     model: llmSelf.model,
                    //     timestamp: new Date().toISOString()
                    // });
                    // ignore cancel errors
                } finally {
                    // Always clear messages when stream is cancelled to prevent accumulation
                    llmSelf.clearMsgs();
                }
            }
        });
    }

    /**
     * Convenience method that returns a stream of just the text content
     * Useful when you only need the text and don't need the full chunk metadata
     * 
     * @example
     * ```typescript
     * const llm = LLM.newInstance();
     * llm.user("Write a poem");
     * 
     * const textStream = await llm.requestCompletionStreamText_();
     * const reader = textStream.getReader();
     * 
     * while (true) {
     *   const { done, value } = await reader.read();
     *   if (done) break;
     *   
     *   process.stdout.write(value); // Print text as it arrives
     * }
     * ```
     * 
     * @param maxTokens Maximum tokens for the completion
     * @param debug Whether to enable debug logging
     * @returns ReadableStream<string>
     */
    async requestCompletionStreamText_(maxTokens: number = 3000, signal?: AbortSignal): Promise<ReadableStream<string>> {
        const chunkStream = await this.requestCompletionStream_(maxTokens, signal);
        
        const llmSelf2 = this;
        return new ReadableStream<string>({
            async start(controller) {
                const reader = chunkStream.getReader();
                
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            controller.close();
                            break;
                        }

                        const content = value.getContent();
                        if (content) {
                            controller.enqueue(content);
                        }

                        if (value.isDone()) {
                            controller.close();
                            break;
                        }
                    }
                } catch (error) {
                    controller.error(error);
                } finally {
                    llmSelf2.cancel();
                    reader.releaseLock();
                }
            },
            async cancel(_reason) {
                try {
                    llmSelf2.cancel();
                } catch {}
            }
        });
    }

    /**
     * Async generator version that returns just the text content
     * This makes server code much cleaner when bridging LLM responses to clients
     * 
     * @example
     * ```typescript
     * const llm = LLM.newInstance();
     * llm.user("Write a poem");
     * 
     * const textGenerator = await llm.requestCompletionTextGenerator_();
     * for await (const text of textGenerator) {
     *   process.stdout.write(text); // Print text as it arrives
     * }
     * ```
     * 
     * @param maxTokens Maximum tokens for the completion
     * @param debug Whether to enable debug logging
     * @returns AsyncGenerator<string>
     */
    async *requestCompletionTextGenerator_(maxTokens: number = 3000): AsyncGenerator<string> {
        // Validate prompt length before making the request to prevent runaway costs
        this.validatePromptLength();
        
        const stream = await this.requestCompletionStream_(maxTokens);
        const reader = stream.getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const content = value.getContent();
                if (content) {
                    yield content;
                }
                
                if (value.isDone()) {
                    break;
                }
            }
        } finally {
            // If the generator is returned due to client disconnect, abort upstream
            this.cancel();
            reader.releaseLock();
        }
    }

    /**
     * Cancels the in-flight LLM request, if any.
     */
    cancel(): void {
        try {
            this.currentAbortController?.abort();
        } catch {
            // ignore
        } finally {
            this.currentAbortController = undefined;
        }
    }

    clearFormat() {
		this.responseFormat = '';
	}

    /**
     * Set universal reasoning control (enabled/disabled)
     * Automatically uses optimal settings for each model type:
     * When enabled:
     * - For Doubao models: uses "thinking": {"type": "enabled"}
     * - For GPT-5 models: uses "reasoning_effort": <configured_level> (Chat Completions API)
     * When disabled:
     * - For Doubao models: uses "thinking": {"type": "disabled"}
     * - For GPT-5 models: uses "reasoning_effort": "minimal" (Chat Completions API)
     * 
     * Note: Reasoning effort levels are automatically optimized per model type.
     * Users only need to enable/disable reasoning - the system handles the rest.
     */
    setReasoningEnabled(enabled: boolean): void {
        this.reasoningEnabled = enabled;
        console.log(`🧠 Reasoning ${enabled ? 'enabled' : 'disabled'} for model: ${this.model}`);
    }

    /**
     * Set reasoning effort level for GPT-5 models
     * @param effort The reasoning effort level (minimal|low|medium|high)
     */
    setReasoningEffort(effort: 'minimal' | 'low' | 'medium' | 'high'): void {
        this.reasoningEffort = effort;
        console.log(`🧠 Reasoning effort set to ${effort} for model: ${this.model}`);
    }

    /**
     * Add appropriate reasoning control to request body based on model type
     * Automatically uses optimal settings for each model type:
     * - Doubao models: "enabled" thinking when reasoning is on
     * - GPT-5 models: uses reasoning_effort parameter for Chat Completions API when reasoning is on, minimal when disabled
     * - Other models: omits reasoning field entirely (not supported)
     */
    private addReasoningControlToBody(bodyObj: any): void {
        if (this.isDoubaoModel()) {
            // Use the thinking field for Doubao reasoning
            if (this.reasoningEnabled) {
                bodyObj.thinking = { type: "enabled" };
            } else {
                bodyObj.thinking = { type: "disabled" };
            }
        } else if (this.isGpt5Model()) {
            // GPT-5 models use "reasoning_effort" as top-level parameter for Chat Completions API
            if (this.reasoningEnabled) {
                bodyObj.reasoning_effort = this.reasoningEffort;
            } else {
                // When disabled, use minimal effort instead of omitting the field
                bodyObj.reasoning_effort = "minimal";
            }
        } else {
            // For other OpenAI models, do NOT include reasoning field at all
            // This is required per OpenAI documentation - other models must not specify reasoning field
            if (this.reasoningEnabled) {
                console.warn(`⚠️ Reasoning control not supported for model: ${this.model}. Only GPT-5 series models support reasoning field.`);
            }
        }
    }

    async requestCompletionJsonSchema_(schemaObj: JSONSchema, maxTokens: number = 3000, temperature:number = 0, signal?: AbortSignal): Promise<CompletionResponse> {
        try {
            // Use Chat Completions API for all models (including GPT-5)
            return await this.requestCompletionJsonSchemaChat_(schemaObj, maxTokens, temperature, signal);
        } finally {
            // Always clear messages after completion to prevent accumulation
            this.clearMsgs();
        }
    }

    /**
     * Chat Completions API JSON Schema implementation
     */
    private async requestCompletionJsonSchemaChat_(schemaObj: JSONSchema, maxTokens: number = 3000, temperature:number = 0, signal?: AbortSignal): Promise<CompletionResponse> {
        // Validate prompt length before making the request to prevent runaway costs
        this.validatePromptLength();
        
        const bodyObj: any = {
            model: this.model,
            messages: this.messages,
            n: this.n,
            stream: this.stream,
            top_p: this.top_p,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: schemaObj.title,
                    strict: true,
                    schema: schemaObj
                }
            },
            [this.getMaxTokensParamName()]: maxTokens ?? this.max_tokens,
            presence_penalty: this.presence_penalty,
            frequency_penalty: this.frequency_penalty
        };

        // GPT-5 models only support default temperature (1), so don't include temperature parameter
        const effectiveTemperature = temperature ?? this.temperature;
        if (!this.isGpt5Model() || effectiveTemperature !== 0) {
            bodyObj.temperature = effectiveTemperature;
        }

        // Add universal reasoning control
        this.addReasoningControlToBody(bodyObj);

        console.debug('>>> body to llm (Chat Completions JSON Schema)', bodyObj)

        const body = JSON.stringify(bodyObj);

        // Establish an effective AbortSignal for the upstream fetch
        const effectiveSignal: AbortSignal | undefined = ((): AbortSignal | undefined => {
            // Priority: explicit signal > request-scoped signal > create new controller
            if (signal) return signal;
            if (this._requestAbortSignal) return this._requestAbortSignal;
            this.currentAbortController = new AbortController();
            return this.currentAbortController.signal;
        })();

        const response: Response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body,
            ...(effectiveSignal ? { signal: effectiveSignal } as any : {})
        });

        if (response.ok) {
            let res = new CompletionResponse((await response.json()) as RawLLMResponse);
            return res
        }
        else {
            let msg = response.status + ": " + response.statusText + " : " + await response.text();
            msg += '/ llm remaining tokens:' + LLM.remainingTokens
            console.debug('AI call', msg)
            throw new LLMError(response.status, msg)
        }
    }

    /**
     * Responses API JSON Schema implementation
     */
    private async requestCompletionJsonSchemaResponses_(schemaObj: JSONSchema, maxTokens: number = 3000, temperature:number = 0, signal?: AbortSignal): Promise<CompletionResponse> {
        // Validate prompt length before making the request to prevent runaway costs
        this.validatePromptLength();

        // Convert messages to input format for Responses API
        const input = this.messages.length === 1 && this.messages[0].role === 'user' 
            ? this.messages[0].content 
            : this.messages;

        const bodyObj: any = {
            model: this.model,
            input: input,
            [this.getMaxTokensParamName()]: maxTokens ?? this.max_tokens
        };

        // Note: Responses API for GPT-5 models has limited parameter support
        if (temperature !== 0) {
            bodyObj.temperature = temperature;
        }
        if (this.top_p !== 1.0) {
            bodyObj.top_p = this.top_p;
        }

        // Handle system messages
        const systemMessage = this.messages.find(msg => msg.role === 'system');
        if (systemMessage) {
            bodyObj.instructions = systemMessage.content;
        }

        // Handle JSON schema format for Responses API
        bodyObj.text = {
            format: {
                type: "json_schema",
                name: schemaObj.title,
                schema: schemaObj
            }
        };

        // Add universal reasoning control
        this.addReasoningControlToBody(bodyObj);

        console.debug('>>> body to llm (Responses API JSON Schema)', bodyObj)

        const body = JSON.stringify(bodyObj);

        // Establish an effective AbortSignal for the upstream fetch
        const effectiveSignal: AbortSignal | undefined = ((): AbortSignal | undefined => {
            // Priority: explicit signal > request-scoped signal > create new controller
            if (signal) return signal;
            if (this._requestAbortSignal) return this._requestAbortSignal;
            this.currentAbortController = new AbortController();
            return this.currentAbortController.signal;
        })();

        const response: Response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body,
            ...(effectiveSignal ? { signal: effectiveSignal } as any : {})
        });

        if (response.ok) {
            const responsesData = await response.json() as RawResponsesResponse;
            return convertResponsesToCompletionResponse(responsesData);
        }
        else {
            let msg = response.status + ": " + response.statusText + " : " + await response.text();
            msg += '/ llm remaining tokens:' + LLM.remainingTokens
            console.debug('AI call', msg)
            throw new LLMError(response.status, msg)
        }
    }

    /**
     * @param {string| object | OpenAIContentBlock[]} content
     */
    system(content: string| object | OpenAIContentBlock[]) {
        // If content is an array of OpenAIContentBlock, pass as-is
        if (Array.isArray(content) && content.length > 0 && (content[0].type === 'text' || content[0].type === 'image_url')) {
            this.messages.push({ role: "system", content });
            return this;
        }
        // If content is an object (not array), stringify
        // TODO: XML string seems to be most reliable format for OpenAI
        if (typeof content === 'object') content = JSON.stringify(content, null, 2)
        if (typeof content === 'string') content = content.trim()
        if (content) this.messages.push({ role: "system", content });
        return this; // Allows for method chaining
    }

    /**
     * @param {string| object | OpenAIContentBlock[]} content
     */
    assistant(content: string) {
        this.messages.push({ role: "assistant", content: content });
        return this; // Allows for method chaining
    }

    /**
     * Adds a user role message
     * @param {string| object | OpenAIContentBlock[]} content
     */
    user(content: string | object | OpenAIContentBlock[]) {
        // If content is an array of OpenAIContentBlock, pass as-is
        if (Array.isArray(content) && content.length > 0 && (content[0].type === 'text' || content[0].type === 'image_url')) {
            this.messages.push({ role: "user", content });
            return this;
        }
        // If content is an object (not array), stringify
        // TODO: XML string seems to be most reliable format for OpenAI
        if (typeof content === 'object') content = JSON.stringify(content, null, 2)
        if (typeof content === 'string') content = content.trim()
        if (content) this.messages.push({ role: "user", content });
        return this; // Allows for method chaining
    }

    /**
     *
     * @param script script containing content from various roles.example:
    * const script = `
    'user'
    hello, how are you?

    'system'
    I'm all good. How are you?

    'user'
    'nice nice'
    `;
     */
    parseScript(script: string) {
        let talks = parseDialog(script)
        this.messages.push(...talks)
    }

    // Retrieves the constructed message array
    build() {
        return this.messages;
    }

    // Resets the message builder for a new set of messages
    reset() {
        this.messages = [];
        return this
    }

    async send() {
        let res = await this.requestCompletion_()
        let fin = res.wasFinished()
        return fin ? res.choices[0].message.content : '<NOT_FINISHED>'
    }

    /**
     *
     * @returns {Promise<CompletionResponse>}l
     * @deprecated - need a maxtokenEstimator
     */
    async send2_() {
        let res = await this.requestCompletion_()
        let fin = res.wasFinished()
        if (!fin) console.warn('not finished: ', res.choices[0].finish_reason)
        return res
    }

    async fetchJson_(): Promise<object> {
        const r = (await this.requestCompletion_()).firstChoice
        let json = JSON.parse(r)
        // clear the messages
        return json
    }

    /**
     *
     * @param jsonSpec a dialogue script or monologue
     * @param role the default role
     */
    parseAs(jsonSpec: string, role: 'system' | 'user' | 'assistant') {
        let dialog = parseDialog(jsonSpec, role)
        if (dialog && dialog.length > 0)
            this.messages.push(...dialog)
    }

    loadDialogs(dialogs: DialogEntry[]) {
        if (dialogs.length > 0) this.messages.push(...dialogs)
    }

    clearMsgs() {
        this.messages.length = 0;
    }

    getPromptTokens() {
        const messageString = JSON.stringify(this.messages)
        return messageString.length
	}

    /**
     * Get the current prompt length threshold for this instance
     */
    getMaxPromptLength(): number {
        return this.maxPromptLength;
    }

    /**
     * Set the prompt length threshold for this instance
     * @param maxLength Maximum prompt length in characters
     */
    setMaxPromptLength(maxLength: number): void {
        if (maxLength <= 0) {
            throw new Error('Max prompt length must be greater than 0');
        }
        this.maxPromptLength = maxLength;
    }

    /**
     * Validate prompt length and truncate conversation history if needed
     * This prevents runaway costs from message accumulation or oversized prompts
     * For images, we use a more lenient approach to avoid truncating important visual content
     */
    private validatePromptLength(): void {
        const promptLength = this.getPromptTokens();
        const hasImages = this.messages.some(msg => 
            msg.content && typeof msg.content === 'string' && 
            (msg.content.includes('data:image/') || msg.content.includes('base64'))
        );
        
        // For conversations with images, use a much higher limit
        const effectiveLimit = hasImages ? this.maxPromptLength * 5 : this.maxPromptLength;
        
        if (promptLength > effectiveLimit) {
            if (hasImages) {
                console.warn(`⚠️  Prompt length ${promptLength} exceeds image limit of ${effectiveLimit}. Using image-optimized truncation...`);
                this.truncateConversationHistoryForImages();
            } else {
                console.warn(`⚠️  Prompt length ${promptLength} exceeds limit of ${effectiveLimit}. Truncating conversation history...`);
                this.truncateConversationHistory();
            }
            
            // Check if truncation helped
            const newPromptLength = this.getPromptTokens();
            if (newPromptLength > effectiveLimit) {
                const errorMsg = `❌ PROMPT TOO LONG: Prompt is ${newPromptLength} characters, exceeds limit of ${effectiveLimit}. Even after truncation, the prompt is too long.`;
                console.error(errorMsg);
                console.error('Current messages:', JSON.stringify(this.messages, null, 2));
                throw new Error(errorMsg);
            }
            
            console.log(`✅ Conversation truncated successfully. New prompt length: ${newPromptLength} characters`);
        }
        // console.debug(`✅ Prompt length check passed: ${promptLength} characters (limit: ${effectiveLimit})`);
    }

    /**
     * Intelligently truncate conversation history to fit within prompt length limits
     * Preserves the most recent messages, system context, and image messages
     */
    private truncateConversationHistory(): void {
        if (this.messages.length <= 1) {
            return; // Nothing to truncate
        }

        // Keep system message if it exists
        const systemMessage = this.messages.find(msg => msg.role === 'system');
        const nonSystemMessages = this.messages.filter(msg => msg.role !== 'system');
        
        // Identify messages with images (they have array content with image_url)
        const hasImageContent = (msg: DialogEntry): boolean => {
            if (Array.isArray(msg.content)) {
                return msg.content.some(block => block.type === 'image_url');
            }
            return false;
        };
        
        // Start with system message and work backwards from the end
        const truncatedMessages: DialogEntry[] = systemMessage ? [systemMessage] : [];
        
        // Add messages from the end until we hit the limit
        // Prioritize keeping recent image messages as they contain important visual context
        for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
            const testMessages = [...truncatedMessages, nonSystemMessages[i]];
            const testLength = JSON.stringify(testMessages).length;
            
            if (testLength <= this.maxPromptLength) {
                truncatedMessages.push(nonSystemMessages[i]);
            } else {
                // If this message has images and we're close to the limit, try to keep it anyway
                // by removing some older non-image messages
                if (hasImageContent(nonSystemMessages[i])) {
                    // Try to make room by removing the oldest non-image message
                    const oldestNonImageIndex = truncatedMessages.findIndex((msg, idx) => 
                        idx > 0 && !hasImageContent(msg) // Skip system message
                    );
                    if (oldestNonImageIndex > 0) {
                        truncatedMessages.splice(oldestNonImageIndex, 1);
                        // Try adding the image message again
                        const retestMessages = [...truncatedMessages, nonSystemMessages[i]];
                        const retestLength = JSON.stringify(retestMessages).length;
                        if (retestLength <= this.maxPromptLength) {
                            truncatedMessages.push(nonSystemMessages[i]);
                        }
                    }
                }
                break;
            }
        }
        
        // Reverse to maintain chronological order
        if (systemMessage) {
            this.messages = [systemMessage, ...truncatedMessages.slice(1).reverse()];
        } else {
            this.messages = truncatedMessages.reverse();
        }
        
        console.log(`📝 Truncated conversation from ${nonSystemMessages.length} to ${this.messages.length - (systemMessage ? 1 : 0)} messages`);
    }

    /**
     * Specialized truncation for conversations with images
     * Preserves all image messages and recent text messages
     */
    private truncateConversationHistoryForImages(): void {
        if (this.messages.length <= 1) {
            return; // Nothing to truncate
        }

        // Keep system message if it exists
        const systemMessage = this.messages.find(msg => msg.role === 'system');
        const nonSystemMessages = this.messages.filter(msg => msg.role !== 'system');
        
        // Separate image messages from text messages
        const hasImageContent = (msg: DialogEntry): boolean => {
            if (Array.isArray(msg.content)) {
                return msg.content.some(block => block.type === 'image_url');
            }
            if (typeof msg.content === 'string') {
                return msg.content.includes('data:image/') || msg.content.includes('base64');
            }
            return false;
        };
        
        const imageMessages = nonSystemMessages.filter(hasImageContent);
        const textMessages = nonSystemMessages.filter(msg => !hasImageContent(msg));
        
        // Start with system message and all image messages (preserve all images)
        const truncatedMessages: DialogEntry[] = systemMessage ? [systemMessage] : [];
        truncatedMessages.push(...imageMessages);
        
        // Add text messages from the end until we hit the limit
        for (let i = textMessages.length - 1; i >= 0; i--) {
            const testMessages = [...truncatedMessages, textMessages[i]];
            const testPromptLength = JSON.stringify(testMessages).length;
            
            if (testPromptLength <= this.maxPromptLength * 5) { // Use 5x limit for images
                truncatedMessages.push(textMessages[i]);
            } else {
                break; // Stop when we would exceed the limit
            }
        }
        
        // Sort by original order to maintain chronological sequence
        const allMessages = [...truncatedMessages];
        allMessages.sort((a, b) => {
            const aIndex = this.messages.indexOf(a);
            const bIndex = this.messages.indexOf(b);
            return aIndex - bIndex;
        });
        
        this.messages = allMessages;
        console.log(`📝 Image conversation truncated to ${this.messages.length} messages (${imageMessages.length} images preserved)`);
    }

    /**
     * Track token usage for a request
     */
    private trackTokenUsage(usage: TokenUsage, maxTokens: number): void {
        // Add to session total
        this.sessionUsage.add(usage);
        this.requestCount++;
        
        // Add to request history
        this.requestHistory.push({
            timestamp: new Date(),
            usage: new TokenUsage(usage),
            model: this.model,
            maxTokens,
            actualTokens: usage.total_tokens
        });
    }

    /**
     * Get raw session token usage (TokenUsage object)
     */
    getRawSessionUsage(): TokenUsage {
        return this.sessionUsage;
    }

    /**
     * Get session token usage summary
     */
    getSessionUsage(): {
        sessionDuration: string;
        requestCount: number;
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
        averageTokensPerRequest: number;
        tokensPerMinute: number;
        efficiencyRatio: number;
        cacheHitRatio: number;
        inputEfficiency: number;
        startTime: Date;
        model: string;
    } {
        const now = new Date();
        const duration = now.getTime() - this.sessionStartTime.getTime();
        const durationMinutes = duration / (1000 * 60);
        
        const totalMaxTokens = this.requestHistory.reduce((sum, req) => sum + req.maxTokens, 0);
        const efficiencyRatio = totalMaxTokens > 0 ? this.sessionUsage.total_tokens / totalMaxTokens : 0;
        
        const tokenBreakdown = this.sessionUsage.getTokenBreakdown();
        
        return {
            sessionDuration: this.formatDuration(duration),
            requestCount: this.requestCount,
            totalTokens: this.sessionUsage.total_tokens,
            promptTokens: this.sessionUsage.prompt_tokens,
            completionTokens: this.sessionUsage.completion_tokens,
            inputTokens: tokenBreakdown.input_tokens,
            outputTokens: tokenBreakdown.output_tokens,
            cachedInputTokens: tokenBreakdown.cached_input_tokens,
            averageTokensPerRequest: this.requestCount > 0 ? Math.round(this.sessionUsage.total_tokens / this.requestCount) : 0,
            tokensPerMinute: durationMinutes > 0 ? Math.round(this.sessionUsage.total_tokens / durationMinutes) : 0,
            efficiencyRatio,
            cacheHitRatio: tokenBreakdown.cache_hit_ratio,
            inputEfficiency: tokenBreakdown.input_efficiency,
            startTime: this.sessionStartTime,
            model: this.model
        };
    }

    /**
     * Get detailed request history
     */
    getRequestHistory(): Array<{
        timestamp: Date;
        model: string;
        maxTokens: number;
        actualTokens: number;
        promptTokens: number;
        completionTokens: number;
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
        efficiency: number;
        cacheHitRatio: number;
        inputEfficiency: number;
    }> {
        return this.requestHistory.map(req => {
            const tokenBreakdown = req.usage.getTokenBreakdown();
            return {
                timestamp: req.timestamp,
                model: req.model,
                maxTokens: req.maxTokens,
                actualTokens: req.usage.total_tokens,
                promptTokens: req.usage.prompt_tokens,
                completionTokens: req.usage.completion_tokens,
                inputTokens: tokenBreakdown.input_tokens,
                outputTokens: tokenBreakdown.output_tokens,
                cachedInputTokens: tokenBreakdown.cached_input_tokens,
                efficiency: req.maxTokens > 0 ? req.usage.total_tokens / req.maxTokens : 0,
                cacheHitRatio: tokenBreakdown.cache_hit_ratio,
                inputEfficiency: tokenBreakdown.input_efficiency
            };
        });
    }

    /**
     * Generate a session usage report
     */
    generateSessionReport(): string {
        const usage = this.getSessionUsage();
        const history = this.getRequestHistory();
        
        let report = `
# LLM Session Usage Report

## Session Summary
- **Model**: ${usage.model}
- **Duration**: ${usage.sessionDuration}
- **Total Requests**: ${usage.requestCount}
- **Total Tokens**: ${usage.totalTokens.toLocaleString()}
- **Prompt Tokens**: ${usage.promptTokens.toLocaleString()}
- **Completion Tokens**: ${usage.completionTokens.toLocaleString()}
- **Input Tokens**: ${usage.inputTokens.toLocaleString()}
- **Output Tokens**: ${usage.outputTokens.toLocaleString()}
- **Cached Input Tokens**: ${usage.cachedInputTokens.toLocaleString()}
- **Average Tokens/Request**: ${usage.averageTokensPerRequest}
- **Tokens/Minute**: ${usage.tokensPerMinute}
- **Efficiency Ratio**: ${(usage.efficiencyRatio * 100).toFixed(1)}%
- **Cache Hit Ratio**: ${(usage.cacheHitRatio * 100).toFixed(1)}%
- **Input Efficiency**: ${(usage.inputEfficiency * 100).toFixed(1)}%

## Request History
`;

        history.forEach((req, index) => {
            report += `
### Request ${index + 1}
- **Time**: ${req.timestamp.toISOString()}
- **Model**: ${req.model}
- **Max Tokens**: ${req.maxTokens}
- **Actual Tokens**: ${req.actualTokens}
- **Prompt Tokens**: ${req.promptTokens}
- **Completion Tokens**: ${req.completionTokens}
- **Input Tokens**: ${req.inputTokens}
- **Output Tokens**: ${req.outputTokens}
- **Cached Input Tokens**: ${req.cachedInputTokens}
- **Efficiency**: ${(req.efficiency * 100).toFixed(1)}%
- **Cache Hit Ratio**: ${(req.cacheHitRatio * 100).toFixed(1)}%
- **Input Efficiency**: ${(req.inputEfficiency * 100).toFixed(1)}%
`;
        });

        return report;
    }

    /**
     * Reset session tracking (useful for starting a new session)
     */
    resetSession(): void {
        this.sessionStartTime = new Date();
        this.sessionUsage = new TokenUsage();
        this.requestCount = 0;
        this.requestHistory = [];
    }

    /**
     * Format duration in milliseconds to human-readable format
     */
    private formatDuration(durationMs: number): string {
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }


}

export class LLMError extends Error {
    /**
     * @param {number} status
     * @param {string} message
     */
    constructor(status: number, message: string) {
        super(message);
        this.name = 'FetchError';
        this.status = status;
    }
    status = -1
}

/**
 *
 * @param script a full dialog. example:
 * const script = `
'user'
hello, how are you?

'system'
I'm all good. How are you?

'user'
'nice nice'
`;
 * @returns
 */
export function parseDialog(script: string, initialRole: DialogRole = 'user'): DialogEntry[] {
    const entries: DialogEntry[] = [];
    const lines = script.trim().split('\n');

    let currentRole = initialRole;
    let currentContent = '';

    for (const line of lines) {
        const trimmedLine = line.trim();
        let roleStr = trimmedLine.slice(1, -1)
        if (trimmedLine.startsWith("'") && trimmedLine.endsWith("'") && DialogRoles.includes(roleStr)) {
            // If there was an ongoing entry, push it to the entries array
            if (currentRole) {
                let roleContent = currentContent.trim()
                if (roleContent)
                    entries.push({ role: currentRole, content: roleContent });
            }
            // Get the role from the line
            currentRole = roleStr as DialogRole
            currentContent = ''; // Reset the current content
        } else {
            // Accumulate content for the current role
            currentContent += line + '\n'; // Add a newline if there's existing content
        }
    }

    // Push the last entry if exists
    if (currentRole) {
        entries.push({ role: currentRole, content: currentContent.trim() });
    }

    return entries;


}

