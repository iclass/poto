/**
 * Example: How to use Poto interfaces when consuming as an external package
 * 
 * This demonstrates the proper way to import and use TypeScript interfaces
 * from the Poto framework when it's distributed as an npm package.
 */

// ✅ CORRECT: Import runtime classes and values
import { 
    PotoServer, 
    PotoClient, 
    PotoModule,
    InMemorySessionProvider,
    RedisSessionProvider,
    PotoUser,
    DialogRoles
} from 'poto';

// ✅ CORRECT: Import types and interfaces for TypeScript type checking
import type {
    UserSessionProvider,
    UserSessionData,
    UserProvider,
    DialogEntry,
    DialogRole,
    OpenAIContentBlock,
    JSONSchema,
    LLMSessionData
} from 'poto';

/**
 * Example: Creating a custom session provider
 * This shows how to implement the UserSessionProvider interface
 */
export class CustomSessionProvider implements UserSessionProvider {
    private sessions: Map<string, UserSessionData> = new Map();
    private contextManager: any;

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
 * Example: Creating a custom user provider
 */
export class CustomUserProvider implements UserProvider {
    private users: Map<string, PotoUser> = new Map();

    async findUserByUserId(uid: string): Promise<PotoUser> {
        const user = this.users.get(uid);
        if (!user) {
            throw new Error(`User not found: ${uid}`);
        }
        return user;
    }

    async addUser(user: PotoUser): Promise<boolean> {
        try {
            this.users.set(user.id, user);
            return true;
        } catch (error) {
            console.error('Failed to add user:', error);
            return false;
        }
    }
}

/**
 * Example: Working with dialog entries
 */
export function createDialogEntry(role: DialogRole, content: string): DialogEntry {
    return {
        role,
        content
    };
}

/**
 * Example: Working with JSON Schema
 */
export function createUserSchema(): JSONSchema {
    return {
        type: 'object',
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            age: { type: 'number', minimum: 0 }
        },
        required: ['id', 'name', 'email']
    };
}

/**
 * Example: Creating a Poto module with proper typing
 */
export class MyCustomModule extends PotoModule {
    constructor() {
        super('MyCustomModule');
    }

    // This method would be available via RPC
    async getUserSession(userId: string): Promise<UserSessionData | null> {
        // Implementation here
        return null;
    }

    // This method would be available via RPC
    async createDialog(role: DialogRole, content: string): Promise<DialogEntry> {
        return createDialogEntry(role, content);
    }
}

/**
 * Example: Setting up a Poto server with custom providers
 */
export async function setupPotoServer() {
    const server = new PotoServer();
    
    // Use built-in session providers
    const sessionProvider = new InMemorySessionProvider();
    // or: const sessionProvider = new RedisSessionProvider();
    
    // Use custom providers
    const userProvider = new CustomUserProvider();
    const customSessionProvider = new CustomSessionProvider();
    
    // Register your custom module
    const myModule = new MyCustomModule();
    server.registerModule(myModule);
    
    return server;
}

/**
 * Example: Using PotoClient with proper typing
 */
export async function setupPotoClient(serverUrl: string) {
    const client = new PotoClient(serverUrl);
    
    // The client methods are properly typed
    await client.login({ username: 'user1', password: 'password' });
    
    // Get a typed proxy to your module
    const myModuleProxy = client.getProxy<MyCustomModule>('MyCustomModule');
    
    // These calls are type-safe
    const session = await myModuleProxy.getUserSession('user1');
    const dialog = await myModuleProxy.createDialog('user', 'Hello world!');
    
    return { client, myModuleProxy };
}
