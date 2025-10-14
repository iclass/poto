import { describe, beforeAll, afterAll, beforeEach, test as it, expect } from "bun:test";
import path from "path";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { ContextIsolationTestModule } from "./ContextIsolationTestModule";
import { TestGeneratorModule } from "./TestGeneratorModule";

// Helper to generate random port in safe range
function getRandomPort(): number {
    // Use range 30000-60000 to avoid well-known and registered ports
    return Math.floor(Math.random() * 30000) + 30000;
}

describe("Mock LLM Streaming Tests", () => {
    // Increase timeout for CI environment
    const timeout = process.env.CI ? 30000 : 10000; // 30s in CI, 10s locally
    let server: PotoServer;
    let serverUrl: string;
    const testPort = getRandomPort(); // Use random port to avoid conflicts

    function makeProxy(theClient: PotoClient) {
        return theClient.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
    }

    function makeContextIsolationProxy(theClient: PotoClient) {
        return theClient.getProxy<ContextIsolationTestModule>(ContextIsolationTestModule.name);
    }
    
    async function createTestClient(): Promise<PotoClient> {
        const mockStorage = {
            getItem: (key: string): string | null => null,
            setItem: (key: string, value: string): void => { },
            removeItem: (key: string): void => { }
        };
        const client = new PotoClient(serverUrl, mockStorage);
        await client.loginAsVisitor();
        if (!client.userId) {
            throw new Error("Login succeeded but userId is undefined - critical failure");
        }
        return client;
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

        // Add the context isolation test module
        server.addModule(new ContextIsolationTestModule());

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
                    throw new Error(`Server failed to start after ${maxRetries} attempts: ${error}`);
                }
            }

            retries++;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        // Client will be created per-test in beforeEach for better isolation
    });

    afterAll(async () => {
        // Clean up server to prevent port conflicts and resource leaks
        if (server?.server) {
            server.server.stop();
        }
    });

    

        it("should stream mock LLM responses end-to-end", async () => {
            const client = await createTestClient();
            const testGeneratorProxy = makeProxy(client);

            const gen = await testGeneratorProxy.postLlmStream_("Tell me a story about a cat");
            expect(typeof gen[Symbol.asyncIterator]).toBe('function');

            const chunks: any[] = [];
            let fullContent = '';

            for await (const chunk of gen) {
                chunks.push(chunk);

                if (chunk.type === 'content' && chunk.content) {
                    fullContent += chunk.content;
                }

                // Verify chunk structure
                expect(chunk).toHaveProperty('type');
                expect(chunk).toHaveProperty('timestamp');
                expect(chunk).toHaveProperty('userId');
                if (client.userId) {
                    expect(chunk.userId).toBe(client.userId);
                }

                if (chunk.type === 'content') {
                    expect(chunk).toHaveProperty('content');
                    expect(typeof chunk.content).toBe('string');
                }

                if (chunk.type === 'done') {
                    expect(chunk).toHaveProperty('finishReason');
                    expect(chunk.finishReason).toBe('stop');
                    break;
                }
            }

            // Verify we got a response
            expect(chunks.length).toBeGreaterThan(0);
            expect(fullContent.length).toBeGreaterThan(0);
            expect(fullContent.toLowerCase()).toContain('cat');

            // Verify we got a done message
            const doneChunk = chunks.find(chunk => chunk.type === 'done');
            expect(doneChunk).toBeDefined();
        });

        it("should stream mock LLM responses with progress tracking", async () => {
            const client = await createTestClient();
            const testGeneratorProxy = makeProxy(client);

            const gen = await testGeneratorProxy.postLlmStreamWithProgress_("Explain quantum computing");
            expect(typeof gen[Symbol.asyncIterator]).toBe('function');

            const chunks: any[] = [];
            let contentChunks = 0;
            let progressChunks = 0;
            let completeChunk = null as any;

            for await (const chunk of gen) {
                chunks.push(chunk);

                switch (chunk.type) {
                    case 'content':
                        contentChunks++;
                        expect(chunk).toHaveProperty('content');
                        expect(typeof chunk.content).toBe('string');
                        break;
                    case 'progress':
                        progressChunks++;
                        expect(chunk).toHaveProperty('progress');
                        expect(chunk).toHaveProperty('chunksReceived');
                        expect(chunk).toHaveProperty('contentLength');
                        expect(typeof chunk.progress).toBe('number');
                        expect(chunk.progress).toBeGreaterThanOrEqual(0);
                        expect(chunk.progress).toBeLessThanOrEqual(100);
                        break;
                    case 'complete':
                        completeChunk = chunk;
                        expect(chunk).toHaveProperty('totalChunks');
                        expect(chunk).toHaveProperty('finalContentLength');
                        break;
                }

                if (chunk.type === 'complete') break;
            }

            // Verify we got progress updates and content
            expect(progressChunks).toBeGreaterThan(0);
            expect(contentChunks).toBeGreaterThan(0);
            expect(completeChunk).toBeDefined();
            expect(chunks.length).toBeGreaterThan(3); // At least content + progress + complete


            // Verify progress increases
            const progressChunksArray = chunks.filter(chunk => chunk.type === 'progress');
            for (let i = 1; i < progressChunksArray.length; i++) {
                expect(progressChunksArray[i].progress).toBeGreaterThanOrEqual(progressChunksArray[i - 1].progress);
            }
        });

        it("should handle different prompt types in mock LLM", async () => {
            const client = await createTestClient();
            const testGeneratorProxy = makeProxy(client);

            // Test different prompt types
            const prompts = [
                "hello",
                "Tell me a story",
                "Show me some code",
                "What's the answer to life?",
                "How's the weather?"
            ];

            for (const prompt of prompts) {
                const gen = await testGeneratorProxy.postLlmStream_(prompt);
                const chunks: any[] = [];
                let fullContent = '';

                for await (const chunk of gen) {
                    chunks.push(chunk);
                    if (chunk.type === 'content') {
                        fullContent += chunk.content;
                    }
                    if (chunk.type === 'done') break;
                }

                expect(chunks.length).toBeGreaterThan(0);
                expect(fullContent.length).toBeGreaterThan(0);

                // Verify we got a done message
                const doneChunk = chunks.find(chunk => chunk.type === 'done');
                expect(doneChunk).toBeDefined();
                expect(doneChunk.finishReason).toBe('stop');
            }
        });

        it("should handle concurrent mock LLM streaming requests", async () => {
            const client = await createTestClient();
            const testGeneratorProxy = makeProxy(client);

            // Create multiple concurrent LLM requests with staggered start times
            const requests = Array.from({ length: 3 }, async (_, index) => {
                // Stagger the requests slightly to reduce race conditions
                await new Promise(resolve => setTimeout(resolve, index * 50));

                const gen = await testGeneratorProxy.postLlmStream_(`Request ${index + 1}`);
                const chunks: any[] = [];
                let content = '';

                // Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM stream timeout')), 10000)
                );

                const processStream = async () => {
                    for await (const chunk of gen) {
                        chunks.push(chunk);
                        if (chunk.type === 'content') {
                            content += chunk.content;
                        }
                        if (chunk.type === 'done') break;
                    }
                };

                try {
                    await Promise.race([processStream(), timeout]);
                } catch (error) {
                    // If timeout occurs, we still want to return what we got
                }

                return { chunks, content };
            });

            const results = await Promise.all(requests);

            // All results should be successful
            results.forEach((result, index) => {
                expect(result.chunks.length).toBeGreaterThan(0);
                expect(result.content.length).toBeGreaterThan(0);
                expect(typeof result.content).toBe('string');

                const doneChunk = result.chunks.find(chunk => chunk.type === 'done');
                expect(doneChunk).toBeDefined();
                expect(doneChunk.finishReason).toBe('stop');
            });
        });

        it("should verify real-time streaming behavior in mock LLM", async () => {
            const client = await createTestClient();
            const testGeneratorProxy = makeProxy(client);

            const startTime = Date.now();
            const gen = await testGeneratorProxy.postLlmStream_("Test real-time streaming");

            const chunks: any[] = [];
            const chunkTimes: number[] = [];

            for await (const chunk of gen) {
                chunks.push(chunk);
                chunkTimes.push(Date.now() - startTime);

                if (chunk.type === 'done') break;
            }

            const endTime = Date.now() - startTime;

            // Verify streaming took some time (not all at once)
            expect(endTime).toBeGreaterThan(100); // Should take at least 100ms


            // Verify chunks arrived over time (not all at the same time)
            const contentChunks = chunks.filter(chunk => chunk.type === 'content');
            expect(contentChunks.length).toBeGreaterThan(1);

            // Verify timestamps are sequential
            for (let i = 1; i < chunks.length; i++) {
                const prevTime = new Date(chunks[i - 1].timestamp).getTime();
                const currTime = new Date(chunks[i].timestamp).getTime();
                expect(currTime).toBeGreaterThanOrEqual(prevTime);
            }
        });


});
