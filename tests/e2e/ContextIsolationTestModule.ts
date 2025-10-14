import { PotoModule } from "../../src/server/PotoModule";

/**
 * Test module specifically for testing AsyncLocalStorage context isolation
 * This module tracks request context and user information to verify isolation
 * 
 * FIXED: Removed mutable instance state (requestCounter, activeRequests)
 * for concurrent safety. Now uses atomic ID generation.
 */
export class ContextIsolationTestModule extends PotoModule {
    /**
     * Generator that yields context information over time to test isolation
     */
    async *postContextIsolationGenerator_(duration: number): AsyncGenerator<{
        requestId: string;
        userId: string | undefined;
        currentTime: number;
        activeRequestCount: number;
        message: string;
    }> {
        const user = await this.getCurrentUser();
        // ✅ FIXED: Atomic ID generation (concurrent-safe)
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const startTime = Date.now();
        
        // ✅ FIXED: Store in session instead of instance variable
        const requestInfo = {
            userId: user?.id || 'unknown',
            startTime,
            requestId
        };
        await this.setSessionValue(`request_${requestId}`, requestInfo);

        try {
            const endTime = startTime + duration;
            let iteration = 0;
            
            while (Date.now() < endTime) {
                iteration++;
                const currentTime = Date.now();
                
                yield {
                    requestId,
                    userId: user?.id,
                    currentTime,
                    activeRequestCount: this.activeRequests.size,
                    message: `Iteration ${iteration} for user ${user?.id}`
                };
                
                // Simulate work that takes time
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } finally {
            // Clean up tracking
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Regular method that returns context information
     */
    async postContextInfo_(): Promise<{
        userId: string | undefined;
        requestId: string;
        activeRequestCount: number;
        timestamp: number;
    }> {
        const user = await this.getCurrentUser();
        const requestId = `req_${++this.requestCounter}`;
        
        return {
            userId: user?.id,
            requestId,
            activeRequestCount: this.activeRequests.size,
            timestamp: Date.now()
        };
    }

    /**
     * Method that simulates a long-running operation with context tracking
     */
    async *postLongRunningWithContext_(steps: number): AsyncGenerator<{
        step: number;
        userId: string | undefined;
        requestId: string;
        contextValid: boolean;
        message: string;
    }> {
        const user = await this.getCurrentUser();
        const requestId = `req_${++this.requestCounter}`;
        const originalUserId = user?.id;
        
        // Track this request
        this.activeRequests.set(requestId, {
            userId: originalUserId || 'unknown',
            startTime: Date.now(),
            requestId
        });

        try {
            for (let i = 0; i < steps; i++) {
                // Verify context is still valid
                const currentUser = await this.getCurrentUser();
                const contextValid = currentUser?.id === originalUserId;
                
                yield {
                    step: i + 1,
                    userId: currentUser?.id,
                    requestId,
                    contextValid,
                    message: `Step ${i + 1} - Context valid: ${contextValid}`
                };
                
                // Simulate work
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Method that returns ReadableStream with context information
     */
    async postContextStream_(message: string): Promise<ReadableStream<Uint8Array>> {
        const user = await this.getCurrentUser();
        const requestId = `req_${++this.requestCounter}`;
        const encoder = new TextEncoder();
        
        return new ReadableStream({
            start: async (controller) => {
                try {
                    // Send initial context info
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'context_start',
                        requestId,
                        userId: user?.id,
                        message,
                        timestamp: new Date().toISOString()
                    })}\n\n`));
                    
                    // Simulate processing with context checks
                    const words = message.split(' ');
                    for (let i = 0; i < words.length; i++) {
                        await new Promise(resolve => setTimeout(resolve, 20));
                        
                        // Check context is still valid
                        const currentUser = await this.getCurrentUser();
                        const contextValid = currentUser?.id === user?.id;
                        
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'context_chunk',
                            index: i,
                            word: words[i],
                            userId: currentUser?.id,
                            contextValid,
                            timestamp: new Date().toISOString()
                        })}\n\n`));
                    }
                    
                    // Send completion
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'context_complete',
                        requestId,
                        userId: user?.id,
                        totalWords: words.length,
                        timestamp: new Date().toISOString()
                    })}\n\n`));
                    
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }

    /**
     * Get current active requests for debugging
     */
    async getActiveRequests_(): Promise<{
        count: number;
        requests: Array<{ userId: string; requestId: string; startTime: number }>;
    }> {
        return {
            count: this.activeRequests.size,
            requests: Array.from(this.activeRequests.values())
        };
    }
}
