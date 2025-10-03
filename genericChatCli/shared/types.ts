// Shared types for the chat system
// These are used by both client and server without bundling server implementation

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string; // ISO string timestamp for eviction
}

export interface ChatResponse {
    type: 'content' | 'done' | 'error';
    content?: string;
    finishReason?: string;
    error?: string;
    timestamp: string;
}


// Model information interface
export interface ModelInfo {
    name: string;
    model: string;
    isDefault: boolean;
}
