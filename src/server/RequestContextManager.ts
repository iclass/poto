import { AsyncLocalStorage } from 'async_hooks';
import { PotoRequestContext } from './PotoRequestContext';

/**
 * Global request context manager using AsyncLocalStorage
 * Provides request-scoped context isolation in concurrent environments
 * No parameter pollution - context is available anywhere in the request chain
 */
export class RequestContextManager {
    private static instance: RequestContextManager;
    private asyncLocalStorage: AsyncLocalStorage<PotoRequestContext>;

    /**
     * singleton constructor
     */
    private constructor() {
        this.asyncLocalStorage = new AsyncLocalStorage<PotoRequestContext>();
    }

    static getInstance(): RequestContextManager {
        if (!RequestContextManager.instance) {
            RequestContextManager.instance = new RequestContextManager();
        }
        return RequestContextManager.instance;
    }

    /**
     * Run a function with request context (used by PotoServer)
     */
    runWithContext<T>(context: PotoRequestContext, fn: () => Promise<T>): Promise<T> {
        return this.asyncLocalStorage.run(context, fn);
    }

    /**
     * Get the current request context (used by PotoModule)
     */
    getCurrentContext(): PotoRequestContext | undefined {
        return this.asyncLocalStorage.getStore();
    }

    /**
     * Check if we're currently in a request context
     */
    hasContext(): boolean {
        return this.asyncLocalStorage.getStore() !== undefined;
    }
}

// Export singleton instance
export const requestContextManager = RequestContextManager.getInstance();
