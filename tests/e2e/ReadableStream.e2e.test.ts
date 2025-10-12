import { describe, beforeAll, afterAll, beforeEach, test as it, expect } from "bun:test";
import path from "path";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { TestGeneratorModule } from "./TestGeneratorModule";

// Helper to generate random port in safe range
function getRandomPort(): number {
    // Use range 30000-60000 to avoid well-known and registered ports
    return Math.floor(Math.random() * 30000) + 30000;
}

describe("ReadableStream Method Tests", () => {
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

        // Add the test generator module
        server.addModule(new TestGeneratorModule());

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

        // Create mock storage for testing
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        client = new PotoClient(serverUrl, mockStorage);
        console.log("Client created successfully");
    });

    afterAll(async () => {
        // Clean up server to prevent port conflicts and resource leaks
        if (server?.server) {
            server.server.stop();
            console.log("ReadableStream test server stopped");
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
