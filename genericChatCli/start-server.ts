import { startServer as serverMain } from "./server/ServerMain";

console.log("🚀 Starting Generic Chat Server...");
console.log("📡 Server will be available at http://localhost:3799");
console.log("💬 Chat endpoint: http://localhost:3799/chat");
console.log("🔗 SSE endpoint: http://localhost:3799/subscribe");
console.log("");
console.log("Press Ctrl+C to stop the server");
console.log("");

// Start the server
serverMain().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
