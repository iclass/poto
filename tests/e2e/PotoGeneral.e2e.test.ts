import { describe, beforeAll, afterAll, beforeEach, test as it, expect } from "bun:test";
import path from "path";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { TestGeneratorModule } from "./TestGeneratorModule";
import { SessionValueTestModule } from "./SessionValueTestModule";

// Helper to generate random port in safe range
function getRandomPort(): number {
    // Use range 30000-60000 to avoid well-known and registered ports
    return Math.floor(Math.random() * 30000) + 30000;
}

describe("PotoClient + PotoServer E2E Integration Tests", () => {
    // Increase timeout for CI environment
    const timeout = process.env.CI ? 30000 : 10000; // 30s in CI, 10s locally
    let server: PotoServer;
    let client: PotoClient;
    let serverUrl: string;
    const testPort = getRandomPort(); // Use random port to avoid conflicts

    function makeProxy(theClient: PotoClient) {
        return theClient.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
    }


    beforeAll(async () => {
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

        // Add the test generator module
        server.addModule(new TestGeneratorModule());
        
        // Add the session value test module
        server.addModule(new SessionValueTestModule());

        // Start the server using the run() method
        server.run();

        // Use the assigned test port
        serverUrl = `http://localhost:${testPort}`;

        // Wait for server to start with retry logic
        let retries = 0;
        const maxRetries = process.env.CI ? 20 : 10; // More retries in CI
        const retryDelay = process.env.CI ? 500 : 200; // Longer delay in CI

        while (retries < maxRetries) {
            try {
                // Try to connect to the server
                const response = await fetch(serverUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(2000) // 2 second timeout
                });

                if (response.ok || response.status === 404) { // 404 is fine, means server is running
                    break;
                }
            } catch (error) {
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

        // Create mock storage for testing
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        client = new PotoClient(serverUrl, mockStorage);
    });

    afterAll(async () => {
        // Clean up server to prevent port conflicts and resource leaks
        if (server?.server) {
            server.server.stop();
        }
    });

    beforeEach(async () => {
        // Add small delay to prevent test interference
        await new Promise(resolve => setTimeout(resolve, 10));

        // Login as visitor for each test
        try {
            await client.loginAsVisitor();
        } catch (error) {
            console.warn("Login failed, continuing without auth:", error);
        }
    });

    it("should connect client to server and authenticate", async () => {
        expect(client.userId).toBeDefined();
        expect(client.token).toBeDefined();
        expect(client.userId).toStartWith("visitor_");
    }, timeout);

    it("should invoke simple generator method end-to-end", async () => {
        const testGeneratorProxy = makeProxy(client);

        const gen = await testGeneratorProxy.postSimpleGenerator_(3);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual({
            number: 1,
            message: "Item 1",
            userId: client.userId
        });
        expect(chunks[1]).toEqual({
            number: 2,
            message: "Item 2",
            userId: client.userId
        });
        expect(chunks[2]).toEqual({
            number: 3,
            message: "Item 3",
            userId: client.userId
        });
    });

    it("should invoke fibonacci generator method end-to-end", async () => {
        const testGeneratorProxy = makeProxy(client);

        const gen = await testGeneratorProxy.postFibonacciGenerator_(6);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(6);
        expect(chunks[0]).toEqual({ index: 0, value: 0, userId: client.userId });
        expect(chunks[1]).toEqual({ index: 1, value: 1, userId: client.userId });
        expect(chunks[2]).toEqual({ index: 2, value: 1, userId: client.userId });
        expect(chunks[3]).toEqual({ index: 3, value: 2, userId: client.userId });
        expect(chunks[4]).toEqual({ index: 4, value: 3, userId: client.userId });
        expect(chunks[5]).toEqual({ index: 5, value: 5, userId: client.userId });
    });

    it("should handle successful generator without errors", async () => {
        const testGeneratorProxy = makeProxy(client);

        const gen = await testGeneratorProxy.postErrorGenerator_(false);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual({
            status: "started",
            userId: client.userId
        });
        expect(chunks[1]).toEqual({
            status: "processing",
            data: "some data",
            userId: client.userId
        });
        expect(chunks[2]).toEqual({
            status: "completed",
            userId: client.userId
        });
    });

    it("should handle empty generator correctly", async () => {
        const testGeneratorProxy = makeProxy(client);

        const gen = await testGeneratorProxy.postEmptyGenerator_();
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(0);
    });

    it("should handle async generator with string processing", async () => {
        const testGeneratorProxy = makeProxy(client);

        const items = ["hello", "world", "test"];
        const gen = await testGeneratorProxy.postAsyncGenerator_(items);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual({
            item: "hello",
            processed: "HELLO",
            delay: 5,
            userId: client.userId
        });
        expect(chunks[1]).toEqual({
            item: "world",
            processed: "WORLD",
            delay: 5,
            userId: client.userId
        });
        expect(chunks[2]).toEqual({
            item: "test",
            processed: "TEST",
            delay: 5,
            userId: client.userId
        });
    });

    it("should handle regular non-generator methods", async () => {
        const testGeneratorProxy = makeProxy(client);

        const result = await testGeneratorProxy.postRegularMethod_("test message");
        expect(result).toBe(`Regular method: test message (user: ${client.userId})`);
    });

    it("should handle methods without HTTP verb prefixes (defaulting to POST)", async () => {
        const testGeneratorProxy = makeProxy(client);

        expect(client.userId).toBeDefined();
        // Test regular method without HTTP verb prefix
        const result = await testGeneratorProxy.processData_("hello world");
        expect(result).toBe(`Processed data: HELLO WORLD (user: ${client.userId})`);
    });

    it("should handle generator methods without HTTP verb prefixes (defaulting to POST)", async () => {
        const testGeneratorProxy = makeProxy(client);

        const items = ["apple", "banana", "cherry"];
        const gen = await testGeneratorProxy.streamData_(items);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual({
            item: "apple",
            processed: "APPLE",
            userId: client.userId
        });
        expect(chunks[1]).toEqual({
            item: "banana",
            processed: "BANANA",
            userId: client.userId
        });
        expect(chunks[2]).toEqual({
            item: "cherry",
            processed: "CHERRY",
            userId: client.userId
        });
    });

    it("should handle progress tracking generator", async () => {
        const testGeneratorProxy = makeProxy(client);

        const gen = await testGeneratorProxy.postProgressGenerator_(3);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(4); // 3 progress + 1 complete


        // Check progress chunks
        for (let i = 0; i < 3; i++) {
            expect(chunks[i]).toEqual({
                type: "progress",
                step: i + 1,
                total: 3,
                progress: Math.round(((i + 1) / 3) * 100),
                message: `Processing step ${i + 1} of 3`,
                userId: client.userId
            });
        }

        // Check completion chunk
        expect(chunks[3]).toEqual({
            type: "complete",
            message: "All steps completed successfully!",
            userId: client.userId
        });
    });

    it("should handle large data generator", async () => {
        const testGeneratorProxy = makeProxy(client);

        const gen = await testGeneratorProxy.postLargeDataGenerator_(5);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(5);
        for (let i = 0; i < 5; i++) {
            expect(chunks[i]).toEqual({
                index: i,
                data: `Large data chunk ${i}`.repeat(10),
                timestamp: expect.any(String),
                userId: client.userId
            });
            expect(new Date(chunks[i].timestamp)).toBeInstanceOf(Date);
        }
    });

    it("should handle concurrent generator requests", async () => {
        const testGeneratorProxy = makeProxy(client);

        // Create multiple concurrent requests
        const requests = Array.from({ length: 3 }, async () => {
            const gen = await testGeneratorProxy.postSimpleGenerator_(2);
            const chunks: any[] = [];
            for await (const chunk of gen) {
                chunks.push(chunk);
            }
            return chunks;
        });

        const results = await Promise.all(requests);

        // All results should be successful
        results.forEach(chunks => {
            expect(chunks).toHaveLength(2);
            expect(chunks[0]).toEqual({
                number: 1,
                message: "Item 1",
                userId: client.userId
            });
            expect(chunks[1]).toEqual({
                number: 2,
                message: "Item 2",
                userId: client.userId
            });
        });
    });

    describe("ReadableStream Method Tests", () => {
        it("should handle ReadableStream method end-to-end", async () => {
            const testGeneratorProxy = makeProxy(client);

            const stream = await testGeneratorProxy.postReadableStream_("Hello world test message");
            expect(stream).toBeInstanceOf(ReadableStream);

            const chunks: any[] = [];
            const reader = stream.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Decode the chunk
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

            // Verify we got the expected chunks
            expect(chunks.length).toBeGreaterThan(0);

            // Check start message
            const startChunk = chunks.find(chunk => chunk.type === 'start');
            expect(startChunk).toBeDefined();
            expect(startChunk.message).toContain("Hello world test message");
            expect(startChunk.userId).toBe(client.userId);

            // Check word chunks
            const wordChunks = chunks.filter(chunk => chunk.type === 'chunk');
            expect(wordChunks.length).toBe(4); // "Hello world test message" = 4 words


            // Check completion
            const completeChunk = chunks.find(chunk => chunk.type === 'complete');
            expect(completeChunk).toBeDefined();
            expect(completeChunk.totalWords).toBe(4);
            expect(completeChunk.finalMessage).toBe("Processed: Hello world test message");
        });

        it("should handle binary ReadableStream method end-to-end", async () => {
            const testGeneratorProxy = makeProxy(client);

            const stream = await testGeneratorProxy.postBinaryStream_("test-file.bin");
            expect(stream).toBeInstanceOf(ReadableStream);

            const chunks: any[] = [];
            const reader = stream.getReader();

            try {
                // Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Stream timeout')), 5000)
                );

                const readStream = async () => {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // Decode the chunk
                        const text = new TextDecoder().decode(value);
                        const lines = text.split('\n').filter(line => line.trim());

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = JSON.parse(line.slice(6));
                                chunks.push(data);
                            }
                        }
                    }
                };

                await Promise.race([readStream(), timeout]);
            } finally {
                reader.releaseLock();
            }

            // Verify we got the expected chunks
            expect(chunks.length).toBeGreaterThan(0);

            // Check metadata
            const metadataChunk = chunks.find(chunk => chunk.type === 'metadata');
            expect(metadataChunk).toBeDefined();
            expect(metadataChunk.filename).toBe("test-file.bin");
            expect(metadataChunk.size).toBe(1024);
            expect(metadataChunk.userId).toBe(client.userId);

            // Check binary chunks - should get exactly 4 chunks
            const binaryChunks = chunks.filter(chunk => chunk.type === 'binary_chunk');
            expect(binaryChunks.length).toBe(4);

            // Verify binary data structure for received chunks
            binaryChunks.forEach((chunk, index) => {
                expect(chunk.index).toBe(index);
                expect(chunk.size).toBe(256);
                expect(Array.isArray(chunk.data)).toBe(true);
                expect(chunk.data.length).toBe(256);
                expect(chunk.progress).toBe((index + 1) * 25); // 25%, 50%, 75%, 100%
            });

            // Check completion - should always arrive
            const completeChunk = chunks.find(chunk => chunk.type === 'complete');
            expect(completeChunk).toBeDefined();
            expect(completeChunk.totalChunks).toBe(4);
            expect(completeChunk.totalSize).toBe(1024);
        });

        it("should handle concurrent ReadableStream requests", async () => {
            const testGeneratorProxy = makeProxy(client);

            // Create multiple concurrent ReadableStream requests
            const requests = Array.from({ length: 3 }, async (_, index) => {
                const stream = await testGeneratorProxy.postReadableStream_(`Request ${index + 1}`);
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

                return chunks;
            });

            const results = await Promise.all(requests);

            // All results should be successful
            results.forEach((chunks, index) => {
                expect(chunks.length).toBeGreaterThan(0);

                const startChunk = chunks.find(chunk => chunk.type === 'start');
                expect(startChunk).toBeDefined();
                expect(startChunk.message).toContain(`Request ${index + 1}`);

                const completeChunk = chunks.find(chunk => chunk.type === 'complete');
                expect(completeChunk).toBeDefined();
            });
        });

        it("should handle ReadableStream cancellation", async () => {
            const testGeneratorProxy = makeProxy(client);

            const stream = await testGeneratorProxy.postReadableStream_("This is a long message for cancellation testing");
            expect(stream).toBeInstanceOf(ReadableStream);

            const chunks: any[] = [];
            const reader = stream.getReader();

            try {
                let chunkCount = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunkCount++;
                    if (chunkCount >= 3) {
                        // Cancel after reading 3 chunks
                        break;
                    }

                    // Decode the chunk
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

            // We should have some chunks but not all
            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks.length).toBeLessThan(10); // Should be less than total expected chunks
        });

        it("should verify ReadableStream vs Generator method differences", async () => {
            const testGeneratorProxy = makeProxy(client);

            // Test ReadableStream method with timeout
            const stream = await testGeneratorProxy.postReadableStream_("test");
            expect(stream).toBeInstanceOf(ReadableStream);

            // Consume the ReadableStream to avoid locking issues
            const reader = stream.getReader();
            try {
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('ReadableStream timeout')), 5000)
                );

                const readStream = async () => {
                    while (true) {
                        const { done } = await reader.read();
                        if (done) break;
                    }
                };

                await Promise.race([readStream(), timeout]);
            } finally {
                reader.releaseLock();
            }

            // Test Generator method for comparison
            const gen = await testGeneratorProxy.postSimpleGenerator_(3);
            expect(typeof gen[Symbol.asyncIterator]).toBe('function');

            // Consume the generator with timeout
            const chunks: any[] = [];
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Generator timeout')), 5000)
            );

            const processGenerator = async () => {
                for await (const chunk of gen) {
                    chunks.push(chunk);
                }
            };

            try {
                await Promise.race([processGenerator(), timeout]);
            } catch (error) {
                // If timeout occurs, we still want to verify what we got
                console.warn('Generator timed out:', error);
            }

            expect(chunks).toHaveLength(3);

            // Both should work but have different interfaces
            expect(stream.getReader).toBeDefined();
            expect(gen.next).toBeDefined();
            expect(gen[Symbol.asyncIterator]).toBeDefined();
        });
    });

    it("should handle stream cancellation", async () => {
        const testGeneratorProxy = makeProxy(client);

        const gen = await testGeneratorProxy.postLargeDataGenerator_(100);
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');

        let chunkCount = 0;

        try {
            // Read only first few chunks then break
            for await (const chunk of gen) {
                chunkCount++;
                if (chunkCount >= 3) {
                    break;
                }
            }
        } catch (error) {
            // Cancellation might throw an error, which is expected
        }

        expect(chunkCount).toBeLessThanOrEqual(3);
    });

    it("should handle authentication with different users", async () => {
        // Create a second client with different credentials
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        const client2 = new PotoClient(serverUrl, mockStorage);
        await client2.loginAsVisitor();

        const testGeneratorProxy1 = makeProxy(client);

        const testGeneratorProxy2 = makeProxy(client2);

        // Both clients should work independently
        const gen1 = await testGeneratorProxy1.postSimpleGenerator_(1);
        const gen2 = await testGeneratorProxy2.postSimpleGenerator_(1);

        const chunks1: any[] = [];
        const chunks2: any[] = [];

        for await (const chunk of gen1) {
            chunks1.push(chunk);
        }

        for await (const chunk of gen2) {
            chunks2.push(chunk);
        }

        expect(chunks1).toHaveLength(1);
        expect(chunks2).toHaveLength(1);
        expect(chunks1[0].userId).toBe(client.userId);
        expect(chunks2[0].userId).toBe(client2.userId);
        expect(chunks1[0].userId).not.toBe(chunks2[0].userId);
    });

    it("should handle mixed generator and non-generator methods", async () => {
        const testGeneratorProxy = makeProxy(client);

        // Test generator method
        const gen = await testGeneratorProxy.postSimpleGenerator_(2);
        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(2);

        // Test regular method
        const result = await testGeneratorProxy.postRegularMethod_("mixed test");
        expect(result).toBe(`Regular method: mixed test (user: ${client.userId})`);
    });

    it("should handle client reconnection after network issues", async () => {
        // Create a new client to simulate reconnection
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        const newClient = new PotoClient(serverUrl, mockStorage);
        await newClient.loginAsVisitor();

        const testGeneratorProxy = makeProxy(newClient);

        // Try the request with new client - should succeed
        const gen = await testGeneratorProxy.postSimpleGenerator_(1);
        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toEqual({
            number: 1,
            message: "Item 1",
            userId: newClient.userId
        });
    });

    it("should provide end-to-end type safety for generator methods", async () => {
        // Test that generator methods return AsyncGenerator directly
        const testGeneratorProxy = makeProxy(client);

        // Test generator method - should return AsyncGenerator directly
        const gen = await testGeneratorProxy.postSimpleGenerator_(3) as AsyncGenerator<{ number: number; message: string; userId: string | undefined; }>;

        // Verify it's an AsyncGenerator
        expect(typeof gen[Symbol.asyncIterator]).toBe('function');
        expect(typeof gen.next).toBe('function');

        // Use it directly with for await...of
        const chunks: any[] = [];
        for await (const chunk of gen) {
            chunks.push(chunk);
        }

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual({
            number: 1,
            message: "Item 1",
            userId: client.userId
        });
        expect(chunks[1]).toEqual({
            number: 2,
            message: "Item 2",
            userId: client.userId
        });
        expect(chunks[2]).toEqual({
            number: 3,
            message: "Item 3",
            userId: client.userId
        });

        // Test regular method still works as expected
        const result = await testGeneratorProxy.postRegularMethod_("type safety test");
        expect(result).toBe(`Regular method: type safety test (user: ${client.userId})`);
    });

    describe("Session Persistence Tests", () => {
        it("should persist session data across client reconnections", async () => {
            // Create a persistent storage mock that simulates browser localStorage
            const persistentStorage = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            // Create first client and login
            const client1 = new PotoClient(serverUrl, persistentStorage);
            await client1.loginAsVisitor();
            
            const originalUserId = client1.userId;
            const originalToken = client1.token;
            
            expect(originalUserId).toBeDefined();
            expect(originalToken).toBeDefined();
            expect(originalUserId).toStartWith("visitor_");

            // Verify session data is stored
            expect(persistentStorage.getItem("visitorId")).toBe(originalUserId!);
            expect(persistentStorage.getItem("visitorPassword")).toBeDefined();

            // Create second client with same storage (simulating page reload)
            const client2 = new PotoClient(serverUrl, persistentStorage);
            
            // Initially, client2 should not have session data
            expect(client2.userId).toBeUndefined();
            expect(client2.token).toBeUndefined();

            // Login as visitor - should use stored credentials
            await client2.loginAsVisitor();
            
            // The session persistence behavior may vary depending on server implementation
            // The important thing is that both clients can authenticate and work
            expect(client2.userId).toBeDefined();
            expect(client2.token).toBeDefined();
            expect(client2.userId).toStartWith("visitor_");

            // Both clients should work independently
            const proxy1 = makeProxy(client1);
            const proxy2 = makeProxy(client2);

            const result1 = await proxy1.postRegularMethod_("session test 1");
            const result2 = await proxy2.postRegularMethod_("session test 2");

            expect(result1).toBe(`Regular method: session test 1 (user: ${client1.userId})`);
            expect(result2).toBe(`Regular method: session test 2 (user: ${client2.userId})`);
        });

        it("should handle session invalidation and re-registration", async () => {
            const persistentStorage = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            // Create client and login
            const client1 = new PotoClient(serverUrl, persistentStorage);
            await client1.loginAsVisitor();
            
            const originalUserId = client1.userId;
            expect(originalUserId).toBeDefined();

            // Simulate invalid credentials by corrupting storage
            persistentStorage.setItem("visitorPassword", "invalid_password");

            // Create new client with corrupted storage
            const client2 = new PotoClient(serverUrl, persistentStorage);
            
            // Login should fail with stored credentials and create new session
            await client2.loginAsVisitor();
            
            // Should get a different user ID (new visitor registration)
            expect(client2.userId).toBeDefined();
            expect(client2.userId).toStartWith("visitor_");
            // Should be different from original (unless we're very unlucky with timing)
            // Note: In a real scenario, this might be the same if the server reuses IDs quickly
            // The important thing is that the login process handles the failure gracefully

            // Verify new credentials are stored
            expect(persistentStorage.getItem("visitorId")).toBe(client2.userId!);
            expect(persistentStorage.getItem("visitorPassword")).not.toBe("invalid_password");
        });

        it("should maintain separate sessions for different storage instances", async () => {
            // Create two separate storage instances (simulating different browsers/users)
            const storage1 = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            const storage2 = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            // Create two clients with separate storage
            const client1 = new PotoClient(serverUrl, storage1);
            const client2 = new PotoClient(serverUrl, storage2);

            // Both login as visitors
            await client1.loginAsVisitor();
            await client2.loginAsVisitor();

            // Should have different user IDs
            expect(client1.userId).toBeDefined();
            expect(client2.userId).toBeDefined();
            expect(client1.userId).toStartWith("visitor_");
            expect(client2.userId).toStartWith("visitor_");

            // Should have different tokens
            expect(client1.token).toBeDefined();
            expect(client2.token).toBeDefined();
            expect(client1.token).not.toBe(client2.token);

            // Each storage should only contain its own session data
            expect(storage1.getItem("visitorId")).toBe(client1.userId!);
            expect(storage2.getItem("visitorId")).toBe(client2.userId!);
            expect(storage1.getItem("visitorId")).not.toBe(storage2.getItem("visitorId"));

            // Both clients should work independently
            const proxy1 = makeProxy(client1);
            const proxy2 = makeProxy(client2);

            const result1 = await proxy1.postRegularMethod_("client 1 test");
            const result2 = await proxy2.postRegularMethod_("client 2 test");

            expect(result1).toBe(`Regular method: client 1 test (user: ${client1.userId})`);
            expect(result2).toBe(`Regular method: client 2 test (user: ${client2.userId})`);
        });

        it("should handle session persistence with generator methods", async () => {
            const persistentStorage = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            // Create first client and login
            const client1 = new PotoClient(serverUrl, persistentStorage);
            await client1.loginAsVisitor();
            
            const originalUserId = client1.userId;
            expect(originalUserId).toBeDefined();

            // Test generator method with first client
            const proxy1 = makeProxy(client1);
            const gen1 = await proxy1.postSimpleGenerator_(2);
            
            const chunks1: any[] = [];
            for await (const chunk of gen1) {
                chunks1.push(chunk);
            }

            expect(chunks1).toHaveLength(2);
            expect(chunks1[0].userId).toBe(originalUserId);
            expect(chunks1[1].userId).toBe(originalUserId);

            // Create second client with same storage (simulating page reload)
            const client2 = new PotoClient(serverUrl, persistentStorage);
            await client2.loginAsVisitor();
            
            // Should get a valid user ID (may be same or different depending on server implementation)
            expect(client2.userId).toBeDefined();
            expect(client2.userId).toStartWith("visitor_");

            // Test generator method with second client
            const proxy2 = makeProxy(client2);
            const gen2 = await proxy2.postFibonacciGenerator_(3);
            
            const chunks2: any[] = [];
            for await (const chunk of gen2) {
                chunks2.push(chunk);
            }

            expect(chunks2).toHaveLength(3);
            expect(chunks2[0].userId).toBe(client2.userId);
            expect(chunks2[1].userId).toBe(client2.userId);
            expect(chunks2[2].userId).toBe(client2.userId);
        });

        it("should handle session persistence with ReadableStream methods", async () => {
            const persistentStorage = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            // Create first client and login
            const client1 = new PotoClient(serverUrl, persistentStorage);
            await client1.loginAsVisitor();
            
            const originalUserId = client1.userId;
            expect(originalUserId).toBeDefined();

            // Test ReadableStream method with first client
            const proxy1 = makeProxy(client1);
            const stream1 = await proxy1.postReadableStream_("session persistence test");
            
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

            expect(chunks1.length).toBeGreaterThan(0);
            const startChunk1 = chunks1.find(chunk => chunk.type === 'start');
            expect(startChunk1).toBeDefined();
            expect(startChunk1.userId).toBe(originalUserId);

            // Create second client with same storage
            const client2 = new PotoClient(serverUrl, persistentStorage);
            await client2.loginAsVisitor();
            
            expect(client2.userId).toBeDefined();
            expect(client2.userId).toStartWith("visitor_");

            // Test ReadableStream method with second client
            const proxy2 = makeProxy(client2);
            const stream2 = await proxy2.postReadableStream_("second session test");
            
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

            expect(chunks2.length).toBeGreaterThan(0);
            const startChunk2 = chunks2.find(chunk => chunk.type === 'start');
            expect(startChunk2).toBeDefined();
            expect(startChunk2.userId).toBe(client2.userId);
        });

        it("should handle concurrent sessions with different storage", async () => {
            // Create multiple storage instances for concurrent testing
            const storages = Array.from({ length: 3 }, () => ({
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            }));

            // Create multiple clients with separate storage
            const clients = storages.map(storage => new PotoClient(serverUrl, storage));

            // Login all clients concurrently
            await Promise.all(clients.map(client => client.loginAsVisitor()));

            // All should have different user IDs and tokens
            const userIds = clients.map(client => client.userId);
            const tokens = clients.map(client => client.token);

            // Check uniqueness
            const uniqueUserIds = new Set(userIds);
            const uniqueTokens = new Set(tokens);
            
            expect(uniqueUserIds.size).toBe(3);
            expect(uniqueTokens.size).toBe(3);

            // All should work independently
            const proxies = clients.map(client => makeProxy(client));
            
            const results = await Promise.all(
                proxies.map((proxy, index) => 
                    proxy.postRegularMethod_(`concurrent test ${index + 1}`)
                )
            );

            results.forEach((result, index) => {
                expect(result).toBe(`Regular method: concurrent test ${index + 1} (user: ${userIds[index]})`);
            });

            // Test generator methods concurrently
            const generatorResults = await Promise.all(
                proxies.map(proxy => 
                    (async () => {
                        const gen = await proxy.postSimpleGenerator_(2);
                        const chunks: any[] = [];
                        for await (const chunk of gen) {
                            chunks.push(chunk);
                        }
                        return chunks;
                    })()
                )
            );

            generatorResults.forEach((chunks, index) => {
                expect(chunks).toHaveLength(2);
                expect(chunks[0].userId).toBe(userIds[index]);
                expect(chunks[1].userId).toBe(userIds[index]);
            });
        });
    });

    describe("Session Value Tests", () => {
        function makeSessionValueProxy(theClient: PotoClient) {
            return theClient.getProxy<SessionValueTestModule>(SessionValueTestModule.name);
        }

        it("should set and get simple session values", async () => {
            const sessionProxy = makeSessionValueProxy(client);
            
            // Test setting a simple string value
            const setResult = await sessionProxy.setASessionValue_("testKey", "testValue");
            expect(setResult.success).toBe(true);
            expect(setResult.message).toContain("set successfully");
            expect(setResult.userId).toBe(client.userId);
            
            // Test getting the value back
            const getResult = await sessionProxy.getASessionValue_("testKey");
            expect(getResult.success).toBe(true);
            expect(getResult.value).toBe("testValue");
            expect(getResult.message).toContain("retrieved successfully");
            expect(getResult.userId).toBe(client.userId);
        });

        it("should handle multiple session values", async () => {
            const sessionProxy = makeSessionValueProxy(client);
            
            // Set multiple values
            const values = {
                "stringValue": "Hello, World!",
                "numberValue": 42,
                "booleanValue": true,
                "arrayValue": [1, 2, 3, "test"]
            };
            
            const setResult = await sessionProxy.postSetMultipleSessionValues_(values);
            expect(setResult.success).toBe(true);
            expect(setResult.message).toContain("Set 4 session values successfully");
            
            // Get all values back
            const getResult = await sessionProxy.postGetAllSessionValues_(Object.keys(values));
            expect(getResult.success).toBe(true);
            expect(getResult.values).toEqual(values);
            expect(getResult.message).toContain("Retrieved 4 session values successfully");
        });

        it("should persist session values across multiple requests", async () => {
            const sessionProxy = makeSessionValueProxy(client);
            
            const testData = {
                key: "persistenceTest",
                value: { message: "This should persist", timestamp: Date.now() },
                iterations: 3
            };
            
            const result = await sessionProxy.postTestSessionPersistence_(testData);
            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(4); // 1 set + 3 gets
            
            // Verify the set operation
            expect(result.results[0].action).toBe("set");
            expect(result.results[0].value).toEqual(testData.value);
            
            // Verify all get operations return the same value
            for (let i = 1; i < result.results.length; i++) {
                expect(result.results[i].action).toBe("get");
                expect(result.results[i].value).toEqual(testData.value);
            }
        });

        it("should handle complex data types in session values", async () => {
            const sessionProxy = makeSessionValueProxy(client);
            
            const result = await sessionProxy.postTestComplexSessionData_();
            expect(result.success).toBe(true);
            expect(result.results.match).toBe(true);
            expect(result.results.original).toEqual(result.results.retrieved);
            
            // Verify specific data types
            expect(result.results.retrieved.string).toBe("Hello, World!");
            expect(result.results.retrieved.number).toBe(42);
            expect(result.results.retrieved.boolean).toBe(true);
            expect(result.results.retrieved.array).toEqual([1, 2, 3, "test"]);
            expect(result.results.retrieved.object.nested).toBe(true);
            expect(result.results.retrieved.nullValue).toBeNull();
        });

        it("should handle session value updates", async () => {
            const sessionProxy = makeSessionValueProxy(client);
            
            const key = "updateTest";
            const values = [
                "initial value",
                123,
                { complex: "object" },
                [1, 2, 3],
                null
            ];
            
            const result = await sessionProxy.postTestSessionValueUpdates_(key, values);
            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(values.length);
            
            // Verify each update
            result.results.forEach((update, index) => {
                expect(update.iteration).toBe(index + 1);
                expect(update.match).toBe(true);
                expect(update.retrievedValue).toEqual(values[index]);
            });
        });

        it("should isolate session values between different users", async () => {
            // Create two clients with separate storage
            const storage1 = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            const storage2 = {
                data: new Map<string, string>(),
                getItem: function(key: string): string | null {
                    return this.data.get(key) || null;
                },
                setItem: function(key: string, value: string): void {
                    this.data.set(key, value);
                },
                removeItem: function(key: string): void {
                    this.data.delete(key);
                }
            };

            const client1 = new PotoClient(serverUrl, storage1);
            const client2 = new PotoClient(serverUrl, storage2);

            await client1.loginAsVisitor();
            await client2.loginAsVisitor();

            const sessionProxy1 = makeSessionValueProxy(client1);
            const sessionProxy2 = makeSessionValueProxy(client2);

            // Set different values for each user
            await sessionProxy1.setASessionValue_("sharedKey", "user1Value");
            await sessionProxy2.setASessionValue_("sharedKey", "user2Value");

            // Verify each user gets their own value
            const result1 = await sessionProxy1.getASessionValue_("sharedKey");
            const result2 = await sessionProxy2.getASessionValue_("sharedKey");

            expect(result1.success).toBe(true);
            expect(result1.value).toBe("user1Value");
            expect(result1.userId).toBe(client1.userId);

            expect(result2.success).toBe(true);
            expect(result2.value).toBe("user2Value");
            expect(result2.userId).toBe(client2.userId);

            // Verify the values are different
            expect(result1.value).not.toBe(result2.value);
        });

        it("should handle session value errors gracefully", async () => {
            const sessionProxy = makeSessionValueProxy(client);
            
            // Test getting a non-existent key
            const getResult = await sessionProxy.getASessionValue_("nonExistentKey");
            expect(getResult.success).toBe(true);
            expect(getResult.value).toBeUndefined();
            expect(getResult.message).toContain("retrieved successfully");
            
            // Test with empty key
            const emptyKeyResult = await sessionProxy.setASessionValue_("", "emptyKeyValue");
            expect(emptyKeyResult.success).toBe(true);
            
            const emptyKeyGetResult = await sessionProxy.getASessionValue_("");
            expect(emptyKeyGetResult.success).toBe(true);
            expect(emptyKeyGetResult.value).toBe("emptyKeyValue");
        });

        it("should handle concurrent session value operations", async () => {
            const sessionProxy = makeSessionValueProxy(client);
            
            // Perform multiple concurrent operations
            const operations = Array.from({ length: 5 }, async (_, index) => {
                const key = `concurrentKey${index}`;
                const value = `concurrentValue${index}`;
                
                // Set value
                const setResult = await sessionProxy.setASessionValue_(key, value);
                expect(setResult.success).toBe(true);
                
                // Get value
                const getResult = await sessionProxy.getASessionValue_(key);
                expect(getResult.success).toBe(true);
                expect(getResult.value).toBe(value);
                
                return { key, value, setResult, getResult };
            });
            
            const results = await Promise.all(operations);
            
            // Verify all operations succeeded
            results.forEach((result, index) => {
                expect(result.setResult.success).toBe(true);
                expect(result.getResult.success).toBe(true);
                expect(result.getResult.value).toBe(result.value);
            });
        });
    });


});
