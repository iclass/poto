import { describe, beforeAll, afterAll, beforeEach, test as it, expect } from "bun:test";
import path from "path";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { ContextIsolationTestModule } from "./ContextIsolationTestModule";

// Helper to generate random port in safe range
function getRandomPort(): number {
    // Use range 30000-60000 to avoid well-known and registered ports
    return Math.floor(Math.random() * 30000) + 30000;
}

describe("Context Isolation Tests", () => {
    // Increase timeout for CI environment
    const timeout = process.env.CI ? 30000 : 10000; // 30s in CI, 10s locally
    let server: PotoServer;
    let client: PotoClient; // This will be created per-test in beforeEach
    let serverUrl: string;
    const testPort = getRandomPort(); // Use random port to avoid conflicts

    function createTestClient(): PotoClient {
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        return new PotoClient(serverUrl, mockStorage);
    }

    beforeAll(async () => {
        console.log(`Starting server on port ${testPort} (CI: ${process.env.CI})`);

        // Create and start the server
        server = new PotoServer({
            port: testPort,
            staticDir: path.resolve(__dirname, "../../../public"),
            jwtSecret: "e2e-test-secret"
        });

        // Set up user provider
        server.setUserProvider({
            async findUserByUserId(userId: string) {
                return new PotoUser(userId, "hash", ["user"]);
            },
            async addUser(user: PotoUser): Promise<boolean> {
                return true;
            }
        } as UserProvider);

        // Add the context isolation test module
        server.addModule(new ContextIsolationTestModule());

        // Start the server using the run() method
        server.run();

        // Use the assigned test port
        serverUrl = `http://localhost:${testPort}`;
        console.log(`Server URL: ${serverUrl}`);

        // Wait for server to start with retry logic
        let retries = 0;
        const maxRetries = process.env.CI ? 20 : 10; // More retries in CI
        const retryDelay = process.env.CI ? 500 : 200; // Longer delay in CI

        console.log(`Waiting for server to start (max ${maxRetries} attempts, ${retryDelay}ms delay)`);

        while (retries < maxRetries) {
            try {
                // Try to connect to the server
                const response = await fetch(serverUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000) // 2 second timeout
                });

                if (response.ok || response.status === 404) { // 404 is fine, means server is running
                    console.log(`Server started successfully on ${serverUrl} after ${retries + 1} attempts`);
                    break;
                }
            } catch (error) {
                console.log(`Attempt ${retries + 1}/${maxRetries} failed: ${error}`);
                // Server not ready yet, continue waiting
                if (retries === maxRetries - 1) {
                    console.error(`Server failed to start after ${maxRetries} attempts`);
                    console.error(`Final error: ${error}`);
                    throw new Error(`Server failed to start after ${maxRetries} attempts: ${error}`);
                }
            }

            retries++;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        // Client will be created per-test in beforeEach for better isolation
        console.log("Server ready, client will be created per-test");
    });

    afterAll(async () => {
        // Clean up server to prevent port conflicts and resource leaks
        if (server?.server) {
            server.server.stop();
            console.log("Context Isolation test server stopped");
        }
    });

    beforeEach(async () => {
        // Add small delay to prevent test interference
        await new Promise(resolve => setTimeout(resolve, 10));

        // Create a fresh client for each test to prevent concurrent test interference
        client = createTestClient();

        // Login as visitor for each test
        try {
            await client.loginAsVisitor();
        } catch (error) {
            console.warn("Login failed, continuing without auth:", error);
        }
    });

    function makeContextIsolationProxy(theClient: PotoClient) {
        return theClient.getProxy<ContextIsolationTestModule>(ContextIsolationTestModule.name);
    }

    it("should isolate user contexts in AsyncLocalStorage", async () => {
        const contextIsolationProxy = makeContextIsolationProxy(client);
        const contextIsolationProxy2 = makeContextIsolationProxy(client); // Create a second proxy for a different user


        // Test generator method
        const gen1 = await contextIsolationProxy.postContextIsolationGenerator_(100);
        const chunks1: any[] = [];
        for await (const chunk of gen1) {
            chunks1.push(chunk);
        }

        // Test generator method for a different user
        const gen2 = await contextIsolationProxy2.postContextIsolationGenerator_(100);
        const chunks2: any[] = [];
        for await (const chunk of gen2) {
            chunks2.push(chunk);
        }

        // Verify that chunks from different users are isolated
        expect(chunks1.length).toBeGreaterThan(0); // 1 iteration for 100ms (50ms delay + timing)
        expect(chunks2.length).toBeGreaterThan(0); // 1 iteration for 100ms (50ms delay + timing)


        // Check user IDs - both should be the same since they're from the same client
        expect(chunks1[0].userId).toBe(client.userId);
        expect(chunks2[0].userId).toBe(client.userId);

        // Check request IDs - these should be different
        expect(chunks1[0].requestId).not.toBe(chunks2[0].requestId);
    });

    it("should isolate request context in AsyncLocalStorage", async () => {
        const contextIsolationProxy = makeContextIsolationProxy(client);
        const contextIsolationProxy2 = makeContextIsolationProxy(client); // Create a second proxy for a different user


        // Test generator method
        const gen1 = await contextIsolationProxy.postContextIsolationGenerator_(100);
        const chunks1: any[] = [];
        for await (const chunk of gen1) {
            chunks1.push(chunk);
        }

        // Test generator method for a different user
        const gen2 = await contextIsolationProxy2.postContextIsolationGenerator_(100);
        const chunks2: any[] = [];
        for await (const chunk of gen2) {
            chunks2.push(chunk);
        }

        // Verify that chunks from different requests are isolated
        expect(chunks1.length).toBeGreaterThan(0); // 1 iteration for 100ms (50ms delay + timing)
        expect(chunks2.length).toBeGreaterThan(0); // 1 iteration for 100ms (50ms delay + timing)


        // Check request IDs
        expect(chunks1[0].requestId).toBeDefined();
        expect(chunks2[0].requestId).toBeDefined();
        expect(chunks1[0].requestId).not.toBe(chunks2[0].requestId); // Should be different requests
    });

    it("should isolate long-running operations in AsyncLocalStorage", async () => {
        const contextIsolationProxy = makeContextIsolationProxy(client);
        const contextIsolationProxy2 = makeContextIsolationProxy(client); // Create a second proxy for a different user


        // Test long-running generator
        const gen1 = await contextIsolationProxy.postLongRunningWithContext_(5);
        const chunks1: any[] = [];
        for await (const chunk of gen1) {
            chunks1.push(chunk);
        }

        // Test long-running generator for a different user
        const gen2 = await contextIsolationProxy2.postLongRunningWithContext_(5);
        const chunks2: any[] = [];
        for await (const chunk of gen2) {
            chunks2.push(chunk);
        }

        // Verify that long-running operations are isolated
        expect(chunks1).toHaveLength(5); // 5 steps
        expect(chunks2).toHaveLength(5); // 5 steps


        // Check user IDs - both should be the same since they're from the same client
        expect(chunks1[0].userId).toBe(client.userId);
        expect(chunks2[0].userId).toBe(client.userId);

        // Check request IDs - these should be different
        expect(chunks1[0].requestId).not.toBe(chunks2[0].requestId);

        // Check context validity
        expect(chunks1[0].contextValid).toBe(true);
        expect(chunks2[0].contextValid).toBe(true); // Should be true for both
    });

    it("should isolate ReadableStream methods in AsyncLocalStorage", async () => {
        const contextIsolationProxy = makeContextIsolationProxy(client);
        const contextIsolationProxy2 = makeContextIsolationProxy(client); // Create a second proxy for a different user


        // Test ReadableStream method
        const stream1 = await contextIsolationProxy.postContextStream_("Hello world");
        const chunks1: any[] = [];
        const reader1 = stream1.getReader();
        try {
            while (true) {
                const { done, value } = await reader1.read();
                if (done) break;
                const text = new TextDecoder().decode(value);
                const lines = text.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        chunks1.push(data);
                    }
                }
            }
        } finally {
            reader1.releaseLock();
        }

        // Test ReadableStream method for a different user
        const stream2 = await contextIsolationProxy2.postContextStream_("Hello world");
        const chunks2: any[] = [];
        const reader2 = stream2.getReader();
        try {
            while (true) {
                const { done, value } = await reader2.read();
                if (done) break;
                const text = new TextDecoder().decode(value);
                const lines = text.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        chunks2.push(data);
                    }
                }
            }
        } finally {
            reader2.releaseLock();
        }

        // Verify that ReadableStream methods are isolated
        expect(chunks1).toHaveLength(4); // 4 chunks for "Hello world" (2 words + start + complete)
        expect(chunks2).toHaveLength(4); // 4 chunks for "Hello world" (2 words + start + complete)


        // Check user IDs - both should be the same since they're from the same client
        expect(chunks1[0].userId).toBe(client.userId);
        expect(chunks2[0].userId).toBe(client.userId);

        // Check request IDs - these should be different
        expect(chunks1[0].requestId).toBeDefined();
        expect(chunks2[0].requestId).toBeDefined();
        expect(chunks1[0].requestId).not.toBe(chunks2[0].requestId); // Should be different requests
    });

    it("should isolate concurrent users with different user IDs", async () => {
        // Create multiple clients with different user IDs
        const mockStorage1 = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        const mockStorage2 = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };

        const client1 = new PotoClient(serverUrl, mockStorage1);
        const client2 = new PotoClient(serverUrl, mockStorage2);

        await client1.loginAsVisitor();
        await client2.loginAsVisitor();

        const proxy1 = makeContextIsolationProxy(client1);
        const proxy2 = makeContextIsolationProxy(client2);

        // Verify different user IDs
        expect(client1.userId).not.toBe(client2.userId);

        // Test concurrent context info requests
        const [info1, info2] = await Promise.all([
            proxy1.postContextInfo_(),
            proxy2.postContextInfo_()
        ]);

        // Verify context isolation
        expect(info1.userId!).toBe(client1.userId!);
        expect(info2.userId!).toBe(client2.userId!);
        expect(info1.userId!).not.toBe(info2.userId!);
        expect(info1.requestId).not.toBe(info2.requestId);
    });

    it("should handle multiple concurrent long-running operations with context isolation", async () => {
        // Create multiple clients
        const clients = Array.from({ length: 3 }, (_, i) => {
            const mockStorage = {
                getItem: (key: string): string | null => null,
                setItem: (key: string, value: string): void => { },
                removeItem: (key: string): void => { }
            };
            return new PotoClient(serverUrl, mockStorage);
        });

        // Login all clients - the server now handles race conditions properly
        await Promise.all(clients.map(client => client.loginAsVisitor()));

        // Verify all have different user IDs
        const userIds = clients.map(client => client.userId);
        const uniqueUserIds = new Set(userIds);
        expect(uniqueUserIds.size).toBe(3);

        // Create proxies for all clients
        const proxies = clients.map(client => makeContextIsolationProxy(client));

        // Start concurrent long-running operations
        const operations = proxies.map(async (proxy, index) => {
            const gen = await proxy.postLongRunningWithContext_(3);
            const chunks: any[] = [];
            for await (const chunk of gen) {
                chunks.push(chunk);
            }
            return { index, chunks };
        });

        const results = await Promise.all(operations);

        // Verify all operations completed successfully
        results.forEach((result, index) => {
            expect(result.chunks).toHaveLength(3);

            // Verify context validity for each step
            result.chunks.forEach(chunk => {
                expect(chunk.contextValid).toBe(true);
                expect(chunk.userId).toBe(clients[index].userId);
            });
        });

        // Verify different request IDs
        const requestIds = results.map(result => result.chunks[0].requestId);
        const uniqueRequestIds = new Set(requestIds);
        expect(uniqueRequestIds.size).toBe(3);
    });

    it("should maintain context isolation during mixed generator and regular method calls", async () => {
        const contextIsolationProxy = makeContextIsolationProxy(client);

        // Test regular method
        const contextInfo = await contextIsolationProxy.postContextInfo_();
        expect(contextInfo.userId).toBe(client.userId!);

        // Test generator method
        const gen = await contextIsolationProxy.postContextIsolationGenerator_(200);
        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        // Verify context consistency
        expect(chunks).toHaveLength(4); // 4 iterations for 200ms
        chunks.forEach(chunk => {
            expect(chunk.userId!).toBe(client.userId);
            expect(chunk.userId!).toBe(contextInfo.userId!);
        });
    });

    it("should handle context isolation with rapid concurrent requests", async () => {
        const contextIsolationProxy = makeContextIsolationProxy(client);

        // Create many rapid concurrent requests
        const requests = Array.from({ length: 10 }, async (_, index) => {
            const gen = await contextIsolationProxy.postContextIsolationGenerator_(50);
            const chunks: any[] = [];
            for await (const chunk of gen) {
                chunks.push(chunk);
            }
            return { index, chunks };
        });

        const results = await Promise.all(requests);

        // Verify all requests completed successfully
        results.forEach((result, index) => {
            expect(result.chunks.length).toBeGreaterThan(0); // 1 iteration for 50ms
            expect(result.chunks[0].userId).toBe(client.userId);
        });

        // Verify different request IDs
        const requestIds = results.map(result => result.chunks[0].requestId);
        const uniqueRequestIds = new Set(requestIds);
        expect(uniqueRequestIds.size).toBe(10);
    });

    it("should verify AsyncLocalStorage cleanup after request completion", async () => {
        const contextIsolationProxy = makeContextIsolationProxy(client);

        // Get initial active request count
        const initialActiveRequests = await contextIsolationProxy.getActiveRequests_();
        const initialCount = initialActiveRequests.count;

        // Start a generator that tracks active requests
        const gen = await contextIsolationProxy.postContextIsolationGenerator_(100);
        const chunks: any[] = [];

        // Read a few chunks to see active request tracking
        let chunkCount = 0;
        for await (const chunk of gen) {
            chunks.push(chunk);
            chunkCount++;
            if (chunkCount >= 2) break; // Only read 2 chunks
        }

        // Verify active request count increased during execution
        expect(chunks[0].activeRequestCount).toBeGreaterThan(initialCount);

        // Complete the generator
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        // Get final active request count
        const finalActiveRequests = await contextIsolationProxy.getActiveRequests_();
        const finalCount = finalActiveRequests.count;

        // Verify cleanup (count should be back to initial or lower)
        expect(finalCount).toBeLessThanOrEqual(initialCount + 1); // Allow for this request
    });
});
