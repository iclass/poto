import {
    PotoServer,
    PotoUser,
    BunCookieSessionProvider
} from 'poto';

import { DemoModule } from './DemoModule';
import { DemoUserProvider } from './DemoUserProvider';
import { Constants } from './demoConsts';
import indexhtml from '../public/index.html';

// Initialize and start the server
async function startServer() {
    // Create and configure the server
    const server = new PotoServer({
        port: Constants.port,
        jwtSecret: 'demo-secret-key',
        staticDir: '/public', // Serve static files from current directory
        routes: {
            '/': indexhtml
        },
        development: {
            // Enable Hot Module Reloading
            hmr: true,
    
            // Echo console logs from the browser to the terminal
            console: true,
        },    
    });


    // Set up session provider
    server.setSessionProvider(new BunCookieSessionProvider('demo-session-secret'));
    server.addModule(new DemoModule());
    server.setUserProvider((await DemoUserProvider.create()));

    // Add the demo module

    // Start the server
    console.log('🚀 Starting Poto Demo Server...');
    console.log('📡 Server will be available at: http://localhost:3001');
    console.log('👤 Demo users: demo/demo123, admin/admin123');
    console.log('');

    server.run();
}

// Start the server
startServer().catch(console.error);
