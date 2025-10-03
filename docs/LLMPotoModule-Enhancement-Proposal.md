# LLMPotoModule Enhancement Proposal

## Overview

This document proposes additional generic methods for the `LLMPotoModule` class that would be useful for normal web applications dealing with LLMs. These methods are designed to be generic, reusable, and leverage the existing user session management and cancellation-aware architecture.

## Current Class Analysis

The `LLMPotoModule` class currently provides:
- User-specific session management with model preferences
- Cancellation-aware LLM instances
- Model configuration and switching
- Retry mechanisms and concurrent execution
- Streaming support with async generators

## Proposed Methods

### 1. Text Processing & Analysis Methods

```typescript
/**
 * Analyze text sentiment, tone, or key topics
 * @param text The text to analyze
 * @param analysisType Type of analysis to perform
 * @returns Streaming analysis results
 */
async *analyzeText(text: string, analysisType: 'sentiment' | 'topics' | 'summary' | 'keywords'): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    const prompts = {
        sentiment: `Analyze the sentiment of the following text. Provide a sentiment score (-1 to 1) and brief explanation:`,
        topics: `Extract the main topics and themes from the following text:`,
        summary: `Provide a concise summary of the following text:`,
        keywords: `Extract the most important keywords and phrases from the following text:`
    };
    
    llm.system(prompts[analysisType]);
    llm.user(text);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Extract structured data from unstructured text
 * @param text The text to extract data from
 * @param schema JSON schema defining the expected structure
 * @returns Structured data matching the schema
 */
async extractStructuredData<T>(text: string, schema: JSONSchema): Promise<T> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Extract structured data from the following text according to the provided schema. Return only valid JSON that matches the schema exactly.`);
    llm.user(`Text: ${text}\n\nSchema: ${JSON.stringify(schema)}`);
    
    const response = await llm.requestCompletionJsonSchema_(schema);
    return JSON.parse(response.firstChoice) as T;
}

/**
 * Translate text between languages
 * @param text Text to translate
 * @param targetLanguage Target language code (e.g., 'es', 'fr', 'de')
 * @param sourceLanguage Source language code (optional, auto-detect if not provided)
 * @returns Streaming translation results
 */
async *translateText(text: string, targetLanguage: string, sourceLanguage?: string): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    const source = sourceLanguage ? ` from ${sourceLanguage}` : '';
    llm.system(`Translate the following text${source} to ${targetLanguage}. Provide only the translation without explanations.`);
    llm.user(text);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Summarize long text content
 * @param text Text to summarize
 * @param maxLength Maximum length of summary (optional)
 * @returns Streaming summary
 */
async *summarizeText(text: string, maxLength?: number): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    const lengthInstruction = maxLength ? ` Keep the summary under ${maxLength} words.` : '';
    llm.system(`Summarize the following text concisely.${lengthInstruction} Focus on the main points and key information.`);
    llm.user(text);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Classify text type and content category
 * @param text Text to classify
 * @param possibleTypes Array of possible text types to choose from (optional)
 * @returns Classification result with confidence score
 */
async classifyTextType(text: string, possibleTypes?: string[]): Promise<{
    type: string;
    confidence: number;
    reasoning: string;
    alternativeTypes?: Array<{type: string, confidence: number}>;
}> {
    const llm = await this.getUserPreferredLLM();
    
    const defaultTypes = [
        'product description', 'job posting', 'market analysis', 'news article', 
        'blog post', 'academic paper', 'technical documentation', 'email', 
        'social media post', 'review', 'advertisement', 'legal document',
        'financial report', 'user manual', 'press release', 'research paper',
        'product review', 'tutorial', 'announcement', 'proposal'
    ];
    
    const typesToUse = possibleTypes || defaultTypes;
    const typesList = typesToUse.join(', ');
    
    llm.system(`Classify the following text into one of these categories: ${typesList}. 
    Provide your classification with a confidence score (0-100) and brief reasoning. 
    Also suggest 2-3 alternative classifications if applicable.`);
    llm.user(text);
    
    const response = await llm.requestCompletion_();
    const result = JSON.parse(response.firstChoice);
    
    return {
        type: result.type || 'unknown',
        confidence: result.confidence || 0,
        reasoning: result.reasoning || '',
        alternativeTypes: result.alternativeTypes || []
    };
}
```

### 2. Content Generation Methods

```typescript
/**
 * Generate content based on templates and variables
 * @param template Template string with {{variable}} placeholders
 * @param variables Object containing variable values
 * @returns Streaming generated content
 */
async *generateContent(template: string, variables: Record<string, any>): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    const filledTemplate = Object.entries(variables).reduce((str, [key, value]) => 
        str.replace(new RegExp(`{{${key}}}`, 'g'), String(value)), template);
    
    llm.system(`Generate content based on the following template and context. Be creative and engaging.`);
    llm.user(filledTemplate);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Generate multiple variations of content
 * @param prompt Base prompt for content generation
 * @param count Number of variations to generate
 * @returns Array of generated content variations
 */
async generateVariations(prompt: string, count: number): Promise<string[]> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Generate ${count} different variations of content based on the prompt. Each variation should be unique but address the same request.`);
    llm.user(prompt);
    
    const response = await llm.requestCompletion_();
    const content = response.firstChoice;
    
    // Split variations (assuming they're separated by newlines or numbered)
    return content.split('\n').filter(line => line.trim()).slice(0, count);
}

/**
 * Generate content with specific style or tone
 * @param prompt Base prompt for content generation
 * @param style Desired style or tone
 * @returns Streaming styled content
 */
async *generateStyledContent(prompt: string, style: 'formal' | 'casual' | 'technical' | 'creative'): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    const styleInstructions = {
        formal: 'Use formal, professional language with proper grammar and structure.',
        casual: 'Use casual, conversational language that is friendly and approachable.',
        technical: 'Use technical, precise language with appropriate terminology and detail.',
        creative: 'Use creative, engaging language with vivid descriptions and imaginative elements.'
    };
    
    llm.system(`Generate content in a ${style} style. ${styleInstructions[style]}`);
    llm.user(prompt);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}
```

### 3. Conversation & Chat Methods

```typescript
/**
 * Simple chat with context awareness
 * @param message User message
 * @param context Optional context information
 * @returns Streaming chat response
 */
async *chat(message: string, context?: string): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system("You are a helpful AI assistant. Provide clear, accurate, and helpful responses.");
    
    if (context) {
        llm.user(`Context: ${context}\n\nMessage: ${message}`);
    } else {
        llm.user(message);
    }
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Multi-turn conversation with memory
 * @param messages Array of conversation messages
 * @returns Streaming conversation response
 */
async *conversation(messages: Array<{role: 'user' | 'assistant', content: string}>): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system("You are a helpful AI assistant. Continue the conversation naturally based on the provided history.");
    
    // Load conversation history
    for (const msg of messages) {
        if (msg.role === 'user') {
            llm.user(msg.content);
        } else {
            llm.assistant(msg.content);
        }
    }
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Chat with specific persona or character
 * @param message User message
 * @param persona Description of the persona to adopt
 * @returns Streaming persona-based response
 */
async *chatWithPersona(message: string, persona: string): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`You are ${persona}. Respond in character and maintain this persona throughout the conversation.`);
    llm.user(message);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}
```


### 4. Data Processing Methods

```typescript
/**
 * Process and clean data
 * @param data Array of data items to process
 * @param instructions Instructions for processing
 * @returns Streaming processed data
 */
async *processData(data: any[], instructions: string): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Process the following data according to the instructions. Provide the processed results in a clear format.`);
    llm.user(`Data: ${JSON.stringify(data)}\n\nInstructions: ${instructions}`);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Convert data between formats
 * @param data Data to convert
 * @param fromFormat Source format
 * @param toFormat Target format
 * @returns Streaming converted data
 */
async *convertData(data: any, fromFormat: string, toFormat: string): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Convert the following data from ${fromFormat} to ${toFormat} format. Maintain data integrity and structure.`);
    llm.user(JSON.stringify(data));
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Validate data against schema
 * @param data Data to validate
 * @param schema JSON schema for validation
 * @returns Validation results
 */
async validateData(data: any, schema: JSONSchema): Promise<{valid: boolean, errors: string[]}> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Validate the following data against the provided schema. Return a JSON object with 'valid' boolean and 'errors' array.`);
    llm.user(`Data: ${JSON.stringify(data)}\n\nSchema: ${JSON.stringify(schema)}`);
    
    const response = await llm.requestCompletion_();
    return JSON.parse(response.firstChoice);
}
```

### 5. Search & Retrieval Methods

```typescript
/**
 * Semantic search through documents
 * @param query Search query
 * @param documents Array of documents to search
 * @returns Streaming search results
 */
async *semanticSearch(query: string, documents: string[]): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Perform semantic search through the provided documents. Find the most relevant content for the query and explain why it's relevant.`);
    llm.user(`Query: ${query}\n\nDocuments:\n${documents.map((doc, i) => `${i + 1}. ${doc}`).join('\n')}`);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Answer questions based on context
 * @param question Question to answer
 * @param context Context information
 * @returns Streaming answer
 */
async *answerQuestion(question: string, context: string): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Answer the question based on the provided context. If the answer cannot be found in the context, say so clearly.`);
    llm.user(`Context: ${context}\n\nQuestion: ${question}`);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}

/**
 * Extract relevant information from documents
 * @param query Information to extract
 * @param documents Documents to search
 * @returns Streaming extracted information
 */
async *extractInformation(query: string, documents: string[]): AsyncGenerator<string> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Extract relevant information from the documents based on the query. Provide specific details and citations.`);
    llm.user(`Query: ${query}\n\nDocuments:\n${documents.map((doc, i) => `${i + 1}. ${doc}`).join('\n')}`);
    
    for await (const chunk of await llm.requestCompletionTextGenerator_()) {
        yield chunk;
    }
}
```

### 6. Utility & Helper Methods

```typescript
/**
 * Batch process multiple items
 * @param items Array of items to process
 * @param processor Function to process each item
 * @returns Array of processed results
 */
async batchProcess<T, R>(items: T[], processor: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    
    for (const item of items) {
        if (await this.isRequestCancelled()) {
            throw new Error('Request cancelled during batch processing');
        }
        
        try {
            const result = await processor(item);
            results.push(result);
        } catch (error) {
            console.error(`Error processing item:`, error);
            // Continue with next item or throw based on requirements
        }
    }
    
    return results;
}

/**
 * Get usage statistics and costs
 * @returns Usage statistics
 */
async getUsageStats(): Promise<{
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    averageResponseTime: number;
}> {
    const llm = await this.getUserPreferredLLM();
    const sessionUsage = llm.getSessionUsage();
    
    // Calculate estimated cost (this would need to be configured per model)
    const costPerToken = 0.0001; // Example rate
    const totalCost = sessionUsage.totalTokens * costPerToken;
    
    return {
        totalTokens: sessionUsage.totalTokens,
        totalCost,
        requestCount: sessionUsage.requestCount,
        averageResponseTime: 0 // Would need to track this separately
    };
}

/**
 * Health check for LLM service
 * @returns Health status
 */
async healthCheck(): Promise<{status: 'healthy' | 'degraded' | 'unhealthy', details: string}> {
    try {
        const llm = await this.getUserPreferredLLM();
        llm.system("Respond with 'OK' if you can process requests.");
        llm.user("Health check");
        
        const response = await llm.requestCompletion_(10); // Very short response
        const content = response.firstChoice.trim().toLowerCase();
        
        if (content.includes('ok') || content.includes('healthy')) {
            return { status: 'healthy', details: 'LLM service is responding normally' };
        } else {
            return { status: 'degraded', details: 'LLM service responded but may have issues' };
        }
    } catch (error) {
        return { 
            status: 'unhealthy', 
            details: `LLM service error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
    }
}

/**
 * Rate limiting and throttling
 * @param request Function to execute
 * @param maxConcurrent Maximum concurrent requests
 * @returns Throttled request result
 */
async *throttledRequest<T>(request: () => Promise<T>, maxConcurrent: number): AsyncGenerator<T> {
    // This would need to be implemented with a proper rate limiter
    // For now, this is a placeholder implementation
    const result = await request();
    yield result;
}
```

### 7. Advanced Features

```typescript
/**
 * Chain multiple LLM operations
 * @param operations Array of operations to chain
 * @returns Streaming results from each operation
 */
async *chainOperations(operations: Array<{
    name: string;
    prompt: string;
    input?: any;
}>): AsyncGenerator<{operation: string, result: string}> {
    for (const op of operations) {
        const llm = await this.getUserPreferredLLM();
        
        llm.system(`Execute the following operation: ${op.name}`);
        llm.user(op.prompt);
        
        let result = '';
        for await (const chunk of await llm.requestCompletionTextGenerator_()) {
            result += chunk;
        }
        
        yield { operation: op.name, result };
    }
}

/**
 * Compare multiple responses
 * @param prompt Base prompt
 * @param variations Number of variations to generate
 * @returns Comparison results
 */
async compareResponses(prompt: string, variations: number): Promise<{
    responses: string[];
    comparison: string;
    recommendation: string;
}> {
    const responses: string[] = [];
    
    // Generate multiple responses
    for (let i = 0; i < variations; i++) {
        const llm = await this.getUserPreferredLLM();
        llm.system("Provide a helpful response to the user's request.");
        llm.user(prompt);
        
        const response = await llm.requestCompletion_();
        responses.push(response.firstChoice);
    }
    
    // Compare responses
    const llm = await this.getUserPreferredLLM();
    llm.system("Compare the following responses and provide analysis and recommendations.");
    llm.user(`Prompt: ${prompt}\n\nResponses:\n${responses.map((r, i) => `${i + 1}. ${r}`).join('\n\n')}`);
    
    const comparison = await llm.requestCompletion_();
    
    return {
        responses,
        comparison: comparison.firstChoice,
        recommendation: "Use the response that best fits your specific use case."
    };
}

/**
 * Generate with retry and fallback
 * @param prompt Base prompt
 * @param fallbackModels Array of fallback model names
 * @returns Streaming response with fallback support
 */
async *generateWithFallback(prompt: string, fallbackModels: string[]): AsyncGenerator<string> {
    let lastError: Error | null = null;
    
    try {
        const llm = await this.getUserPreferredLLM();
        llm.user(prompt);
        
        for await (const chunk of await llm.requestCompletionTextGenerator_()) {
            yield chunk;
        }
    } catch (error) {
        lastError = error as Error;
        
        // Try fallback models
        for (const modelName of fallbackModels) {
            try {
                await this.updateUserModel(modelName);
                const llm = await this.getUserPreferredLLM();
                llm.user(prompt);
                
                for await (const chunk of await llm.requestCompletionTextGenerator_()) {
                    yield chunk;
                }
                return; // Success with fallback
            } catch (fallbackError) {
                console.warn(`Fallback model ${modelName} also failed:`, fallbackError);
            }
        }
        
        // All models failed
        yield `Error: All models failed. Last error: ${lastError.message}`;
    }
}
```

### 8. Configuration & Management

```typescript
/**
 * Set custom parameters for specific operations
 * @param operation Operation name
 * @param params Parameters to set
 */
async setOperationParams(operation: string, params: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}): Promise<void> {
    // This would store operation-specific parameters in session data
    await this.updateUserSession((session) => {
        if (!session.operationParams) {
            session.operationParams = {};
        }
        session.operationParams[operation] = params;
    });
}

/**
 * Get available operations and their descriptions
 * @returns Array of available operations
 */
async getAvailableOperations(): Promise<Array<{
    name: string;
    description: string;
    parameters: string[];
}>> {
    return [
        { name: 'analyzeText', description: 'Analyze text for sentiment, topics, or keywords', parameters: ['text', 'analysisType'] },
        { name: 'translateText', description: 'Translate text between languages', parameters: ['text', 'targetLanguage', 'sourceLanguage'] },
        { name: 'classifyTextType', description: 'Classify text into specific types like product description, job posting, etc.', parameters: ['text', 'possibleTypes'] },
        { name: 'chat', description: 'Simple chat with context awareness', parameters: ['message', 'context'] },
        { name: 'summarizeText', description: 'Summarize long text content', parameters: ['text', 'maxLength'] },
        // Add more operations as needed
    ];
}

/**
 * Test LLM response quality
 * @param prompt Prompt to test
 * @param expectedCriteria Expected quality criteria
 * @returns Quality assessment
 */
async testQuality(prompt: string, expectedCriteria: string[]): Promise<{
    score: number;
    feedback: string;
    suggestions: string[];
}> {
    const llm = await this.getUserPreferredLLM();
    
    llm.system(`Evaluate the quality of the following response based on these criteria: ${expectedCriteria.join(', ')}. Provide a score (0-100), feedback, and suggestions.`);
    llm.user(prompt);
    
    const response = await llm.requestCompletion_();
    const result = JSON.parse(response.firstChoice);
    
    return {
        score: result.score || 0,
        feedback: result.feedback || '',
        suggestions: result.suggestions || []
    };
}
```

## Implementation Notes

### Key Benefits

1. **Generic & Reusable**: All methods work across different web application domains
2. **User-Session Aware**: Automatically use user's preferred model and settings
3. **Cancellation-Safe**: All methods respect request cancellation
4. **Streaming Support**: Most methods return generators for real-time responses
5. **Error Handling**: Built-in retry and fallback mechanisms
6. **Type-Safe**: Full TypeScript support with proper interfaces
7. **Configurable**: Easy to customize for specific use cases

### Integration with Existing Architecture

- All methods leverage the existing `getUserPreferredLLM()` method
- User session management is automatically handled
- Cancellation awareness is built-in through the existing infrastructure
- Model switching and configuration work seamlessly
- Retry mechanisms use the existing `withLLMRetry()` method

### Usage Examples

```typescript
// Text analysis
for await (const analysis of await myModule.analyzeText("This is great!", "sentiment")) {
    console.log(analysis);
}

// Text classification
const classification = await myModule.classifyTextType("We are hiring a Senior Developer...");
console.log(`Type: ${classification.type}, Confidence: ${classification.confidence}%`);

// Multi-turn conversation
const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
];
for await (const response of await myModule.conversation(messages)) {
    console.log(response);
}

// Batch processing
const results = await myModule.batchProcess(
    ['text1', 'text2', 'text3'],
    async (text) => {
        // Process each text item
        return await myModule.summarizeText(text);
    }
);
```

## Conclusion

These proposed methods would significantly enhance the `LLMPotoModule` class by providing a comprehensive set of generic, useful operations for web applications dealing with LLMs. The methods maintain the existing architecture while adding powerful new capabilities that cover the most common use cases in LLM-powered web applications.
