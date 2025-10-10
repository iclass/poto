import { PotoClient } from 'poto';
import { Constants, ServerInfo } from './demoConsts';
import type { DemoModule } from './DemoModule';
import * as fs from 'fs/promises';
class DemoClient {
    private client: PotoClient;
    private demoModule: DemoModule;

    constructor(serverUrl: string = 'http://localhost:3001') {
        // Create in-memory storage for Node.js environment
        const memoryStorage = {
            data: new Map<string, string>(),
            getItem(key: string): string | null {
                return this.data.get(key) || null;
            },
            setItem(key: string, value: string): void {
                this.data.set(key, value);
            },
            removeItem(key: string): void {
                this.data.delete(key);
            }
        };

        this.client = new PotoClient(serverUrl, memoryStorage);
        this.demoModule = this.client.getProxy<DemoModule>(Constants.serverModuleName);
    }

    async runDemo(): Promise<void> {
        try {
            console.log('🔌 Connecting to Poto Demo Server...');

            // Step 1: Login as demo user
            console.log('👤 Logging in as demo user...');
            await this.client.login({ username: Constants.demoUser, password: Constants.demoPassword });
            console.log('✅ Successfully logged in!');
            console.log('');

            // Step 2: Get greeting
            console.log('📝 Getting greeting from server...');
            const greeting = await this.demoModule.hello_();
            console.log('📨 Server response:', greeting);
            console.log('');

            // Step 3: Send a message
            console.log('💬 Sending a message to server...');
            const message = 'Hello from the demo client!';
            const echo = await this.demoModule.postMessage_(message);
            console.log('📨 Server echo:', echo);
            console.log('');

            // Step 4: Get server info
            console.log('ℹ️  Getting server information...');
            const serverInfo: ServerInfo = await this.demoModule.getServerInfo();
            console.log('📊 Server info:', serverInfo);
            console.log('');

            // Step 6: Test async generator (streaming) - temporarily disabled
            console.log('🌊 Testing async generator (streaming)...');
            const stream = await this.demoModule.testStream(2);
            for await (const item of stream) {
                console.log('📨 Stream item:', item);
            }
            console.log('');

            // Test image size binary parameter passing
            console.log('🖼️  Testing binary parameter (image upload)...');
            // Load ai-genie.png from disk
            let imageBuffer: Uint8Array = await fs.readFile('./src/ai-genie.png');

            if (imageBuffer) {
                console.log(`📊 Image buffer size: ${imageBuffer.length} bytes (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
                // console.log(`📊 Base64 encoded size would be: ~${Math.ceil(imageBuffer.length * 4 / 3)} bytes (${(Math.ceil(imageBuffer.length * 4 / 3) / 1024).toFixed(1)} KB)`);

                console.log('➡️  Sending ai-genie.png to server for image size...');
                // Assume API: getImageSize(image: Uint8Array): Promise<{ width: number, height: number }>
                const resp = await this.demoModule.getImageSize(imageBuffer);
                console.log('📐 Server returned image size:', resp);
            } else {
                console.log('⚠️  Could not find "ai-genie.png" in the src directory. Skipping image size binary param test.');
            }

            // Test admin method: try as demo user, then log in as admin and try again

            // Check if the admin-only method exists (let's call it 'getAdminSecret')
            console.log('🔒 Attempting to call admin-only method as demo user...');
            try {
                const adminData = await this.demoModule.getAdminSecret();
                console.log('❗ Unexpectedly succeeded as demo user:', adminData);
            } catch (err) {
                console.log('✅ Correctly failed as demo user:', err?.message || err);
            }

            // Now log in as admin and try again
            console.log('');
            console.log('🔑 Logging in as admin...');

            // Log out (unsubscribe) or clear token if needed
            await this.client.login({ username: Constants.adminUser, password: Constants.adminPassword });
            console.log('✅ Successfully logged in as admin!');

            console.log('🔒 Attempting to call admin-only method as admin...');
            try {
                const adminData = await this.demoModule.getAdminSecret();
                console.log('✅ Successfully called admin-only method as admin:', adminData);
            } catch (err) {
                console.log('❌ Failed as admin (unexpected):', err?.message || err);
            }
            console.log('');



            console.log('✅ Demo completed with basic RPC functionality!');
            console.log('');

            console.log('🎉 Demo completed successfully!');
            console.log('📋 Summary of what was demonstrated:');
            console.log('  • Server connection and authentication');
            console.log('  • Basic RPC method calls');
            console.log('  • Async generator streaming');
            console.log('  • Type-safe client-server communication');

        } catch (error) {
            console.error('❌ Demo failed:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        this.client.unsubscribe();
        console.log('🔌 Disconnected from server');
    }
}

// Main function to run the demo
async function main() {
    const client = new DemoClient();

    try {
        await client.runDemo();
    } catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    } finally {
        await client.disconnect();
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
