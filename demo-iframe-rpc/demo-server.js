import { PotoServer } from "../src/server/PotoServer";
import { PotoUser } from "../src/server/UserProvider";
import { DemoServerModule } from "./DemoServerModule";
// Import the demo HTML files
import parent from './parent.html';
import iframe from './iframe.html';
import { DEMO_BASE } from "./demotypes";
const routes = {
    '/': parent,
    '/iframe.html': iframe,
};
/**
 * Demo user provider for testing
 */
export class DemoUserProvider {
    userDB = {};
    constructor() { }
    static async create() {
        const provider = new DemoUserProvider();
        const demoUser = new PotoUser('demo', '', ['user']);
        await provider.addUser(demoUser);
        return provider;
    }
    async findUserByUserId(uid) {
        let user = this.userDB[uid];
        if (!user && uid.startsWith('visitor_')) {
            // Create a minimal visitor user on the fly
            user = new PotoUser(uid, '', ['visitor']);
            this.userDB[uid] = user;
        }
        return user;
    }
    async addUser(user) {
        if (this.userDB[user.id])
            return false;
        this.userDB[user.id] = user;
        return true;
    }
}
/**
 * Demo server setup
 */
async function setupDemoServer() {
    console.log('🚀 Starting Iframe RPC Demo Server...');
    // Create the server
    const server = new PotoServer({
        port: 3001, // Use different port for demo
        staticDir: "demo-iframe-rpc",
        jwtSecret: "demo_secret_key",
        routePrefix: DEMO_BASE,
        routes,
        development: {
            hmr: true,
            console: true,
        },
    });
    // Set up user provider
    const userProvider = await DemoUserProvider.create();
    server.setUserProvider(userProvider);
    // Add demo server module
    server.addModule(new DemoServerModule());
    // Start the server
    server.run();
    console.log('✅ Demo server running on http://localhost:3001');
    console.log('📖 Demo page: http://localhost:3001/');
    console.log('🔧 API endpoint: http://localhost:3001/api/');
}
// Run the demo server
setupDemoServer().catch(console.error);
//# sourceMappingURL=demo-server.js.map