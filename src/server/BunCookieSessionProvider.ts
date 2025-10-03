import * as crypto from 'crypto';
import { UserSessionProvider, UserSessionData } from './UserSessionProvider';
import { requestContextManager } from './RequestContextManager';
import { parseTypedJson } from '../shared/TypedJsonUtils';

/**
 * Bun-compatible cookie-based session provider
 * Works with Bun's serve() function and Web API Request/Response objects
 * 
 * This provider is STATELESS - all request-specific data is accessed via RequestContextManager
 */
export class BunCookieSessionProvider implements UserSessionProvider {
    private static readonly COOKIE_NAME = 'poto_session';
    private static readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
    
    private encryptionKey: Buffer;
    private signingKey: Buffer;
    private contextManager: any; // RequestContextManager instance
    
    constructor(secretKey: string) {
        // Derive encryption and signing keys from secret
        this.encryptionKey = crypto.scryptSync(secretKey, 'encryption-salt', 32);
        this.signingKey = crypto.scryptSync(secretKey, 'signing-salt', 32);
    }

    /**
     * Inject RequestContextManager for accessing request context
     */
    setContextManager(contextManager: any): void {
        this.contextManager = contextManager;
    }


    /**
     * Encrypt and sign session data
     */
    private encryptSession(data: UserSessionData): string {
        const payload = JSON.stringify(data);
        
        // Generate random IV for encryption
        const iv = crypto.randomBytes(16);
        
        // Encrypt with AES-256-GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(payload, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // Get authentication tag
        const authTag = cipher.getAuthTag();
        
        // Combine: iv:authTag:encrypted
        const combined = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
        
        // Sign the entire thing with HMAC
        const hmac = crypto.createHmac('sha256', this.signingKey);
        hmac.update(combined);
        const signature = hmac.digest('base64');
        
        // Final format: signature:iv:authTag:encrypted
        return `${signature}:${combined}`;
    }

    /**
     * Verify signature and decrypt session data
     */
    private decryptSession(encryptedData: string): UserSessionData | null {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 4) {
                return null;
            }

            const [signature, ivBase64, authTagBase64, encrypted] = parts;
            const combined = `${ivBase64}:${authTagBase64}:${encrypted}`;

            // Verify HMAC signature
            const hmac = crypto.createHmac('sha256', this.signingKey);
            hmac.update(combined);
            const expectedSignature = hmac.digest('base64');

            if (signature !== expectedSignature) {
                console.warn('Session signature verification failed');
                return null;
            }

            // Decrypt
            const iv = Buffer.from(ivBase64, 'base64');
            const authTag = Buffer.from(authTagBase64, 'base64');

            const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            const data = parseTypedJson(decrypted);

            // Verify timestamps
            const lastActivity = new Date(data.lastActivity);
            const age = Date.now() - lastActivity.getTime();

            if (age > BunCookieSessionProvider.MAX_AGE_MS) {
                console.warn('Session expired');
                return null;
            }

            // Reconstitute Date objects
            data.createdAt = new Date(data.createdAt);
            data.lastActivity = new Date(data.lastActivity);

            return data;
        } catch (error) {
            console.warn('Session decryption failed:', error);
            return null;
        }
    }

    /**
     * Read session from cookie
     */
    async getSession(userId: string): Promise<UserSessionData | null> {
        // Get request from context manager
        const context = this.contextManager?.getCurrentContext();
        const request = context?.request;
        
        if (!request) {
            console.warn('No request context available for reading session cookie');
            return null;
        }

        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = this.parseCookies(cookieHeader);
        const sessionCookie = cookies[BunCookieSessionProvider.COOKIE_NAME];

        if (!sessionCookie) {
            return null;
        }

        const session = this.decryptSession(sessionCookie);
        
        // Verify userId matches
        if (session && session.userId !== userId) {
            console.warn('Session userId mismatch');
            return null;
        }

        return session;
    }

    /**
     * Write session to cookie
     */
    async setSession(userId: string, sessionData: UserSessionData): Promise<void> {
        const encrypted = this.encryptSession(sessionData);
        
        // Get response headers from context manager
        const context = this.contextManager?.getCurrentContext();
        if (!context) {
            console.warn('No request context available for setting session cookie - session will not be persisted');
            return; // Gracefully handle missing context
        }
        
        // Set cookie with security flags
        const maxAge = Math.floor(BunCookieSessionProvider.MAX_AGE_MS / 1000); // seconds
        const cookieValue = [
            `${BunCookieSessionProvider.COOKIE_NAME}=${encrypted}`,
            `Max-Age=${maxAge}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Strict',
            // 'Secure', // Enable in production with HTTPS
        ].join('; ');

        context.responseHeaders.set('Set-Cookie', cookieValue);
    }

    /**
     * Delete session cookie
     */
    async deleteSession(userId: string): Promise<void> {
        // Get response headers from context manager
        const context = this.contextManager?.getCurrentContext();
        if (!context) {
            console.warn('No request context available for deleting session cookie');
            return; // Gracefully handle missing context
        }
        
        // Set expired cookie to delete it
        const cookieValue = [
            `${BunCookieSessionProvider.COOKIE_NAME}=`,
            'Max-Age=0',
            'Path=/',
        ].join('; ');

        context.responseHeaders.set('Set-Cookie', cookieValue);
    }

    /**
     * Check if session exists in cookie
     */
    async hasSession(userId: string): Promise<boolean> {
        const session = await this.getSession(userId);
        return session !== null;
    }

    /**
     * Cleanup is automatic with cookie expiration
     */
    async cleanupOldSessions(maxAgeMs: number): Promise<number> {
        // Cookies expire automatically on client side
        return 0;
    }

    /**
     * Cannot enumerate all sessions with cookie-based storage
     */
    async getActiveSessions(): Promise<string[]> {
        // Not possible with cookie-based sessions
        return [];
    }

    /**
     * Cannot get global stats with cookie-based storage
     */
    async getStats(): Promise<{ activeSessions: number; userIds: string[] }> {
        // Not possible with cookie-based sessions
        return { activeSessions: 0, userIds: [] };
    }

    /**
     * Parse cookie header into key-value pairs
     */
    private parseCookies(cookieHeader: string): Record<string, string> {
        const cookies: Record<string, string> = {};
        
        cookieHeader.split(';').forEach(cookie => {
            const [key, ...valueParts] = cookie.split('=');
            if (key) {
                const trimmedKey = key.trim();
                const value = valueParts.join('=').trim();
                cookies[trimmedKey] = decodeURIComponent(value);
            }
        });

        return cookies;
    }
}