export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface ChatResponse {
    type: 'content' | 'done' | 'error';
    content?: string;
    finishReason?: string;
    error?: string;
    timestamp: string;
}
export interface ModelInfo {
    name: string;
    model: string;
    isDefault: boolean;
}
//# sourceMappingURL=types.d.ts.map