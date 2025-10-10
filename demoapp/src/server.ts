import { 
    PotoServer, 
    PotoModule, 
    PotoUser, 
    UserProvider,
    BunCookieSessionProvider
} from 'poto';

import { roles } from 'poto/dist/server/serverDecorators';
import { Constants } from './demoConsts';

export type GenData = {
    step: number;
    total: number;
    message: string;
    timestamp: string;
    user: string;
}

// Simple demo module with basic functionality
export class DemoModule extends PotoModule {
    getRoute(): string {
        return Constants.serverModuleName;
    }

    // Simple greeting method
    async getHello_(): Promise<string> {
        const user = this.getCurrentUser();
        return `Hello ${user?.id || 'anonymous'}! Welcome to the Poto demo.`;
    }

    // Simple message method
    async postMessage_(message: string): Promise<string> {
        const user = this.getCurrentUser();
        return `Echo: ${message} (from ${user?.id || 'anonymous'})`;
    }

    // Simple method that returns a string (for testing)
    async testSimpleCall(count: number): Promise<string> {
        const user = this.getCurrentUser();
        const userId = user?.id || 'anonymous';
        
        return `Stream test for ${count} items (user: ${userId})`;
    }

    // Async generator method for streaming data
    async *testStream(count: number): AsyncGenerator<GenData> {
        const user = this.getCurrentUser();
        const userId = user?.id || 'anonymous';
        
        for (let i = 1; i <= count; i++) {
            yield {
                step: i,
                total: count,
                message: `Processing step ${i} of ${count}`,
                timestamp: new Date().toISOString(),
                user: userId
            };
            
            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        yield {
            step: count + 1,
            total: count,
            message: 'Stream completed successfully!',
            timestamp: new Date().toISOString(),
            user: userId
        };
    }

    // Method to get server info
    async getServerInfo(): Promise<object> {
        const user = this.getCurrentUser();
        return {
            serverName: 'Poto Demo Server',
            version: '1.0.2',
            user: user?.id || 'anonymous',
            timestamp: new Date().toISOString(),
            features: ['RPC', 'Streaming', 'Authentication', 'Session Management']
        };
    }

    // Admin-only method that requires admin role
    @roles(Constants.roles.admin)
    async getAdminSecret(): Promise<object> {
        const user = this.getCurrentUser();
        return {
            secret: 'This is a top-secret admin-only message!',
            adminUser: user?.id || 'unknown',
            timestamp: new Date().toISOString(),
            clearance: 'TOP SECRET',
            message: 'Only users with admin role can access this data.'
        };
    }
}

// Simple in-memory user provider for demo
class DemoUserProvider implements UserProvider {
    private users = new Map<string, PotoUser>();
    private initialized = false;


    public async findUserByUserId(userId: string): Promise<PotoUser | undefined> {
        return this.users.get(userId);
    }

    public async addUser(user: PotoUser): Promise<boolean> {
        this.users.set(user.id, user);
        return true;
    }
}

// Initialize and start the server
async function startServer() {
    // Create and configure the server
    const server = new PotoServer({
        port: 3001,
        jwtSecret: 'demo-secret-key',
        staticDir: '', // No static files for this demo
    });


    // Set up session provider
    const sessionProvider = new BunCookieSessionProvider('demo-session-secret');
    server.setSessionProvider(sessionProvider);

    // Set up user provider
    const userProvider = new DemoUserProvider();
    // add test users
    await userProvider.addUser(new PotoUser(Constants.demoUser, await Bun.password.hash(Constants.demoPassword), [Constants.roles.user]));
    await userProvider.addUser(new PotoUser(Constants.adminUser, await Bun.password.hash(Constants.adminPassword), [Constants.roles.user, Constants.roles.admin]));

    server.setUserProvider(userProvider);

    // Add the demo module
    server.addModule(new DemoModule());

    // Start the server
    console.log('🚀 Starting Poto Demo Server...');
    console.log('📡 Server will be available at: http://localhost:3001');
    console.log('👤 Demo users: demo/demo123, admin/admin123');
    console.log('');

    server.run();
}

// Start the server
startServer().catch(console.error);
