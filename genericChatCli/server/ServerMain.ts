import { 
    PotoServer, 
    PotoUser, 
    BunCookieSessionProvider ,
    UserProvider
} from "../../src/index";

import { getAppEnv } from "../../src/AppEnv"
import { ChatServerModule } from "./ChatServerModule";
import { $ } from "bun"
import { port } from "../client/ChatClient";

export async function startServer() {
    console.log("🚀 Starting Generic Chat Server...");
    
    // Get server configuration first
    const host = getAppEnv('HOST') || 'localhost';
    
    
    // Create PotoServer instance with proper configuration
    // Use consistent JWT secret with main server
    // the base is the route prefix defined in the PotoConstants
    const server = new PotoServer({
        port: port,
        staticDir: '', // Disable static file serving for now
        jwtSecret: getAppEnv('JWT_SECRET') || 'my_secret_key',
    });
    
    // Enable debug mode for request/response logging
    const debugMode = getAppEnv('DEBUG') === 'true' || getAppEnv('DEBUG') === '1' || true; // Always enable debug mode
    if (debugMode) {
        server.setDebugMode(true);
        console.log("🐛 Debug mode enabled - request/response logging active");
    }
    // Setup cookie-based session provider
    const sessionSecret = getAppEnv('SESSION_SECRET') || getAppEnv('JWT_SECRET') || 'my_poto_jwt_secret_key';
    const cookieProvider = new BunCookieSessionProvider(sessionSecret);
    server.setSessionProvider(cookieProvider);
    
    console.log("🍪 Using cookie-based session storage");
    
    // Create a simple user provider for chat
    const userProvider = new class implements UserProvider {
        private userDB: Record<string, PotoUser> = {};
        
        async findUserByUserId(uid: string): Promise<PotoUser> {
            let user = this.userDB[uid];
            
            if (!user && uid.startsWith('visitor_')) {
                // Create a visitor user on the fly (like main server)
                user = new PotoUser(uid, '', ['visitor']);
                this.userDB[uid] = user;
            } else if (!user) {
                // Create a regular user on the fly
                user = new PotoUser(uid, '', ['user']);
                this.userDB[uid] = user;
            }
            return user;
        }
        async addUser(user: PotoUser): Promise<boolean> {
            if (this.userDB[user.id]) return false;
            this.userDB[user.id] = user;
            return true;
        }
    };

    userProvider.addUser(new PotoUser('u1', await Bun.password.hash('u1'), ['user']));
    userProvider.addUser(new PotoUser('u2', await Bun.password.hash('u2'), ['user']));
    userProvider.addUser(new PotoUser('u3', await Bun.password.hash('u3'), ['user']));
    userProvider.addUser(new PotoUser('u44', await Bun.password.hash('u44'), ['user']));
    userProvider.addUser(new PotoUser('a1', await Bun.password.hash('a1'), ['admin']));
    
    server.setUserProvider(userProvider);
    
    // Create chat module instance
    const chatModule = new ChatServerModule();
    
    // Register the chat module (session provider will be injected at runtime)
    server.addModule(chatModule);
    
    // Set chat module reference for SSE events
    server.setChatModule(chatModule);
    
    // Integrate login handler with dialog archiving
    server.setLoginHandler(async (userId: string) => {
        try {
            await chatModule.onLogin(userId);
        } catch (error) {
            console.error(`❌ Failed to handle login for user ${userId}:`, error);
        }
    });
    
    
    console.log(`📡 Server starting on http://${host}:${port}`);
    console.log(`💬 Chat endpoint: http://${host}:${port}/chat`);
    console.log(`🔗 SSE endpoint: http://${host}:${port}/subscribe`);
    console.log("");
    console.log("Press Ctrl+C to stop the server");
    console.log("");
    
    // Start the server
    server.run();
    
    console.log(`✅ Server running on http://${host}:${port}`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
});

// // Start the server
// main().catch((error) => {
//     console.error('❌ Failed to start server:', error);
//     process.exit(1);
// });
