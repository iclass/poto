import { RequestContextManager } from "./RequestContextManager";

/**
 * Generic user session data structure
 * Can be extended for specific use cases
 */
export interface UserSessionData {
    userId: string;
    createdAt: Date;
    lastActivity: Date;
    currentConversationId?: string; // Track the current conversation ID
    [key: string]: any; // Allow arbitrary session data
}

/**
 * Abstract interface for user session storage
 * Implementations can use different backends (memory, Redis, database, etc.)
 * 
 * Note: Session providers should access request context via RequestContextManager
 * rather than receiving request parameters in method signatures
 */
export interface UserSessionProvider {
    /**
     * Get user session data
     * @param userId - The user's unique identifier
     * @returns Session data if exists, null otherwise
     */
    getSession(userId: string): Promise<UserSessionData | null>;

    /**
     * Create or update user session data
     * @param userId - The user's unique identifier
     * @param sessionData - The session data to store
     */
    setSession(userId: string, sessionData: UserSessionData): Promise<void>;

    /**
     * Delete user session data
     * @param userId - The user's unique identifier
     */
    deleteSession(userId: string): Promise<void>;

    /**
     * Check if a session exists for a user
     * @param userId - The user's unique identifier
     */
    hasSession(userId: string): Promise<boolean>;

    /**
     * Clean up old/expired sessions
     * @param maxAgeMs - Maximum age in milliseconds
     * @returns Number of sessions cleaned up
     */
    cleanupOldSessions(maxAgeMs: number): Promise<number>;

    /**
     * Get all active session user IDs
     * Useful for monitoring/debugging
     */
    getActiveSessions(): Promise<string[]>;

    /**
     * Get session statistics
     */
    getStats(): Promise<{ activeSessions: number; userIds: string[] }>;

    /**
     * Inject RequestContextManager for accessing request context
     * Called once during session provider initialization
     * @param contextManager - The RequestContextManager instance
     */
    setContextManager(contextManager: RequestContextManager): void;
}

/**
 * In-memory session provider for development and testing
 * Sessions are stored in memory and lost when server restarts
 */
export class InMemorySessionProvider implements UserSessionProvider {
    private sessions: Map<string, UserSessionData> = new Map();
    private contextManager: RequestContextManager | undefined;
    
    setContextManager(contextManager: any): void {
        this.contextManager = contextManager;
    }

    async getSession(userId: string): Promise<UserSessionData | null> {
        return this.sessions.get(userId) || null;
    }

    async setSession(userId: string, sessionData: UserSessionData): Promise<void> {
        this.sessions.set(userId, sessionData);
    }

    async deleteSession(userId: string): Promise<void> {
        this.sessions.delete(userId);
    }

    async hasSession(userId: string): Promise<boolean> {
        return this.sessions.has(userId);
    }

    async cleanupOldSessions(maxAgeMs: number): Promise<number> {
        const now = Date.now();
        let cleanedCount = 0;
        
        const entries = Array.from(this.sessions.entries());
        for (const [userId, session] of entries) {
            const age = now - session.lastActivity.getTime();
            if (age > maxAgeMs) {
                this.sessions.delete(userId);
                cleanedCount++;
            }
        }
        
        return cleanedCount;
    }

    async getActiveSessions(): Promise<string[]> {
        return Array.from(this.sessions.keys());
    }

    async getStats(): Promise<{ activeSessions: number; userIds: string[] }> {
        return {
            activeSessions: this.sessions.size,
            userIds: Array.from(this.sessions.keys())
        };
    }
}

/**
 * Redis-based session provider for production
 * Sessions are stored in Redis and persist across server restarts
 */
export class RedisSessionProvider implements UserSessionProvider {
    contextManager: RequestContextManager | undefined;
    
    setContextManager(contextManager: any): void {
        this.contextManager = contextManager;
    }

    async getSession(userId: string): Promise<UserSessionData | null> {
        // TODO: Implement Redis session retrieval
        throw new Error('RedisSessionProvider not implemented yet');
    }

    async setSession(userId: string, sessionData: UserSessionData): Promise<void> {
        // TODO: Implement Redis session storage
        throw new Error('RedisSessionProvider not implemented yet');
    }

    async deleteSession(userId: string): Promise<void> {
        // TODO: Implement Redis session deletion
        throw new Error('RedisSessionProvider not implemented yet');
    }

    async hasSession(userId: string): Promise<boolean> {
        // TODO: Implement Redis session check
        throw new Error('RedisSessionProvider not implemented yet');
    }

    async cleanupOldSessions(maxAgeMs: number): Promise<number> {
        // TODO: Implement Redis session cleanup
        throw new Error('RedisSessionProvider not implemented yet');
    }

    async getActiveSessions(): Promise<string[]> {
        // TODO: Implement Redis session enumeration
        throw new Error('RedisSessionProvider not implemented yet');
    }

    async getStats(): Promise<{ activeSessions: number; userIds: string[] }> {
        // TODO: Implement Redis session stats
        throw new Error('RedisSessionProvider not implemented yet');
    }
}