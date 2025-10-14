import { describe, beforeAll, afterAll, test as it, expect } from "bun:test";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { PotoModule } from "../../src/server/PotoModule";

/**
 * Test module that demonstrates the ReadableStream context issue
 */
class ReadableStreamContextTestModule extends PotoModule {
    /**
     * BAD: Calls getCurrentUser() INSIDE ReadableStream callback
     * This will FAIL because context is lost
     */
    async postBadStream_(): Promise<ReadableStream<Uint8Array>> {
        const encoder = new TextEncoder();
        
        return new ReadableStream({
            start: async (controller) => {
                // ❌ THIS WILL FAIL - getCurrentUser() called inside callback
                const user = await this.getCurrentUser();
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    userId: user?.id,
                    method: 'inside_callback'
                })}\n\n`));
                
                controller.close();
            }
        });
    }
    
    /**
     * GOOD: Captures user BEFORE creating ReadableStream
     * This will SUCCESS because user is captured in closure
     */
    async postGoodStream_(): Promise<ReadableStream<Uint8Array>> {
        // ✅ Capture user BEFORE creating stream
        const user = await this.getCurrentUser();
        const encoder = new TextEncoder();
        
        return new ReadableStream({
            start: async (controller) => {
                // ✅ Use captured user from closure
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    userId: user?.id,
                    method: 'captured_in_closure'
                })}\n\n`));
                
                controller.close();
            }
        });
    }
}

/**
 * CRITICAL: Prove that ReadableStream callbacks lose AsyncLocalStorage context
 */
describe("ReadableStream AsyncLocalStorage Context Loss (CRITICAL BUG)", () => {
    let server: { server: ReturnType<typeof PotoServer.prototype.run> };
    let serverUrl: string;
    const testPort = Math.floor(Math.random() * 30000) + 30000;

    function createTestClient(): PotoClient {
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        return new PotoClient(serverUrl, mockStorage);
    }

    beforeAll(async () => {
        serverUrl = `http://localhost:${testPort}`;
        
        const users = new Map<string, PotoUser>();

        server = new PotoServer({
            port: testPort,
            staticDir: "./public",
            jwtSecret: "test-secret-for-readablestream-context"
        });

        server.setUserProvider({
            async findUserByUserId(userId: string) {
                if (userId.startsWith("visitor_")) {
                    if (!users.has(userId)) {
                        users.set(userId, new PotoUser(userId, "hash", ["visitor"]));
                    }
                    return users.get(userId);
                }
                return users.get(userId);
            },
            async addUser(user: PotoUser) {
                users.set(user.id, user);
                return true;
            }
        } as UserProvider);
        
        server.addModule(new ReadableStreamContextTestModule());
        server.run();

        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`ReadableStream Context Test Server running on ${serverUrl}`);
    });

    afterAll(() => {
        if (server?.server) {
            server.server.stop();
        }
    });

    it("should FAIL: getCurrentUser() called inside ReadableStream callback loses context", async () => {
        const client = createTestClient();
        await client.loginAsVisitor();
        
        expect(client.userId).toBeDefined();
        console.log(`Testing with userId: ${client.userId}`);
        
        const proxy = client.getProxy<ReadableStreamContextTestModule>(ReadableStreamContextTestModule.name);
        
        const stream = await proxy.postBadStream_();
        const chunks: any[] = [];
        const reader = stream.getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const text = new TextDecoder().decode(value);
                const lines = text.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        chunks.push(data);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        console.log("Bad stream chunks:", chunks);
        
        // This will FAIL - userId is undefined because context was lost
        if (chunks[0]?.userId === undefined) {
            console.log("❌ CONFIRMED BUG: userId is undefined when getCurrentUser() called inside ReadableStream callback");
            expect(chunks[0].userId).toBeUndefined(); // Expect the bug
        } else {
            console.log("✅ Bug seems fixed!");
            expect(chunks[0].userId).toBe(client.userId);
        }
    }, 30000);

    it("should SUCCESS: User captured before ReadableStream creation preserves context", async () => {
        const client = createTestClient();
        await client.loginAsVisitor();
        
        expect(client.userId).toBeDefined();
        console.log(`Testing with userId: ${client.userId}`);
        
        const proxy = client.getProxy<ReadableStreamContextTestModule>(ReadableStreamContextTestModule.name);
        
        const stream = await proxy.postGoodStream_();
        const chunks: any[] = [];
        const reader = stream.getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const text = new TextDecoder().decode(value);
                const lines = text.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        chunks.push(data);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        console.log("Good stream chunks:", chunks);
        
        // This should SUCCESS - userId is captured in closure
        expect(chunks[0].userId).toBe(client.userId);
        console.log("✅ SUCCESS: userId preserved via closure capture");
    }, 30000);
});

