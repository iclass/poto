import { ChatClient } from "./client/ChatClient";

console.log("🚀 Starting Generic Chat Client...");
console.log("📱 Client will connect to http://localhost:3799");
console.log("💬 Type your messages and press Enter to send");
console.log("🔧 Use /help for available commands");
console.log("");

// Wait for server to be ready
async function waitForServer(serverUrl: string, maxAttempts: number = 30, delayMs: number = 1000): Promise<void> {
    console.log("⏳ Waiting for server to be ready...");
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(`${serverUrl}/chat`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000) // 2 second timeout per request
            });
            
            // Server is responding (even if it returns 404, it means server is up)
            console.log("✅ Server is ready!");
            return;
        } catch (error) {
            if (attempt < maxAttempts) {
                console.log(`🔄 Attempt ${attempt}/${maxAttempts} - Server not ready yet, retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.log("❌ Server did not become ready within the timeout period");
                throw new Error(`Server at ${serverUrl} is not responding after ${maxAttempts} attempts`);
            }
        }
    }
}

// Start the client with server readiness check
async function startClientWithServerCheck() {
    const serverUrl = 'http://localhost:3799';
    
    try {
        await waitForServer(serverUrl);
        
        // Small additional delay to ensure server is fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("🚀 Starting chat client...");
        const client = new ChatClient(serverUrl);
        await client.startChat();
    } catch (error) {
        console.error('❌ Failed to start client:', error);
        process.exit(1);
    }
}

startClientWithServerCheck();
