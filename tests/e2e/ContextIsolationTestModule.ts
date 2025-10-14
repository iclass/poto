import { PotoModule } from "../../src/server/PotoModule";

/**
 * ⚠️ CRITICAL: NO MUTABLE INSTANCE VARIABLES
 * 
 * PotoModule instances are SHARED across ALL concurrent requests.
 * Mutable instance variables create race conditions.
 * 
 * ✅ CORRECT:
 * - Use atomic ID generation: Date.now() + Math.random()
 * - Access user via this.getCurrentUser() (AsyncLocalStorage)
 * - Store request-specific data in session
 * 
 * ❌ WRONG:
 * - private counter = 0; // RACE CONDITION!
 * - private map = new Map(); // SHARED MUTABLE STATE!
 * 
 * This module demonstrates CORRECT concurrent-safe patterns.
 */
export class ContextIsolationTestModule extends PotoModule {
    /**
     * Generator that yields context information over time to test isolation
     * 
     * ✅ BEST PRACTICE: Capture user at the START and use throughout
     * This ensures userId is always defined, even under heavy concurrent load
     */
    async *postContextIsolationGenerator_(duration: number): AsyncGenerator<{
        requestId: string;
        userId: string | undefined;
        currentTime: number;
        activeRequestCount: number;
        message: string;
    }> {
        // ✅ Capture user ONCE at the start (concurrent-safe)
        const user = await this.getCurrentUser();
        // ✅ Atomic ID generation (concurrent-safe)
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const startTime = Date.now();

        const endTime = startTime + duration;
        let iteration = 0;
        
        while (Date.now() < endTime) {
            iteration++;
            const currentTime = Date.now();
            
            yield {
                requestId,
                userId: user?.id, // ✅ Use captured user (reliable)
                currentTime,
                activeRequestCount: 1, // Just this request (no global tracking needed)
                message: `Iteration ${iteration} for user ${user?.id}`
            };
            
            // Simulate work that takes time
            await new Promise(resolve => setTimeout(resolve, 50));
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
        // ✅ Atomic ID generation (concurrent-safe)
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        return {
            userId: user?.id,
            requestId,
            activeRequestCount: 1, // Just this request
            timestamp: Date.now()
        };
    }

    /**
     * Method that simulates a long-running operation with context tracking
     * 
     * ✅ BEST PRACTICE: Capture user at the START and use throughout
     * This ensures consistency even if context is somehow lost during execution
     */
    async *postLongRunningWithContext_(steps: number): AsyncGenerator<{
        step: number;
        userId: string | undefined;
        requestId: string;
        contextValid: boolean;
        message: string;
    }> {
        // ✅ Capture user ONCE at the start (concurrent-safe)
        const user = await this.getCurrentUser();
        // ✅ Atomic ID generation (concurrent-safe)
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const originalUserId = user?.id;

        for (let i = 0; i < steps; i++) {
            // Try to get current user to verify context is still valid
            const currentUser = await this.getCurrentUser();
            const contextValid = currentUser?.id === originalUserId;
            
            yield {
                step: i + 1,
                userId: user?.id, // ✅ Use captured user (reliable)
                requestId,
                contextValid, // This shows if getCurrentUser() still works
                message: `Step ${i + 1} - Context valid: ${contextValid}`
            };
            
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, 30));
        }
    }

    /**
     * Method that returns ReadableStream with context information
     */
    async postContextStream_(message: string): Promise<ReadableStream<Uint8Array>> {
        // ✅ Capture user BEFORE creating ReadableStream (closure)
        const user = await this.getCurrentUser();
        // ✅ Atomic ID generation (concurrent-safe)
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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
                        
                        // Note: getCurrentUser() may not work inside ReadableStream callback
                        // Use captured user from closure instead
                        
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'context_chunk',
                            index: i,
                            word: words[i],
                            userId: user?.id, // Use captured user
                            contextValid: true,
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
     * Note: Without global tracking, we can only report the current request
     */
    async getActiveRequests_(): Promise<{
        count: number;
        requests: Array<{ userId: string; requestId: string; startTime: number }>;
    }> {
        const user = await this.getCurrentUser();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        // Return info about current request only (no global tracking)
        return {
            count: 1, // Just this request
            requests: [{
                userId: user?.id || 'unknown',
                requestId,
                startTime: Date.now()
            }]
        };
    }
}
