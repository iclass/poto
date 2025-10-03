import { PotoUser } from "./UserProvider";

/**
 * Request-scoped context that provides access to request-aware services
 * This avoids polluting business method signatures with transport-level concerns
 */
export class PotoRequestContext {
    private _abortSignal?: AbortSignal;
    private _user?: PotoUser;
    private _request?: Request;
    private _responseHeaders: Headers;

    constructor(abortSignal?: AbortSignal, user?: PotoUser, request?: Request) {
        this._abortSignal = abortSignal;
        this._user = user;
        this._request = request;
        this._responseHeaders = new Headers();
    }

    /**
     * Get the current request's user
     */
    get user(): PotoUser | undefined {
        return this._user;
    }

    /**
     * Get the current request object
     */
    get request(): Request | undefined {
        return this._request;
    }

    /**
     * Check if the current request has been cancelled
     */
    get isCancelled(): boolean {
        return this._abortSignal?.aborted ?? false;
    }

    /**
     * Get the abort signal for this request
     * Useful for custom cancellation implementations
     */
    get abortSignal(): AbortSignal | undefined {
        return this._abortSignal;
    }

    /**
     * Get the response headers for this request
     * Used by session providers to set cookies
     */
    get responseHeaders(): Headers {
        return this._responseHeaders;
    }

    /**
     * Create a child context (useful for delegation)
     */
    createChild(user?: PotoUser): PotoRequestContext {
        return new PotoRequestContext(this._abortSignal, user || this._user, this._request);
    }

    /**
     * Execute a function with cancellation support
     * Throws an error if the request was cancelled
     */
    async withCancellation<T>(operation: () => Promise<T>): Promise<T> {
        if (this.isCancelled) {
            throw new Error('Request already cancelled');
        }

        // Set up a promise that rejects if cancelled
        const abortPromise = new Promise<never>((_, reject) => {
            this._abortSignal?.addEventListener('abort', () => {
                reject(new Error('Request cancelled by client'));
            });
        });

        // Race the operation against cancellation
        return Promise.race([operation(), abortPromise]);
    }
}
