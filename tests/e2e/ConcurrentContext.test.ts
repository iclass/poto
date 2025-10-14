import { describe, beforeAll, afterAll, test as it, expect } from "bun:test";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { TestGeneratorModule } from "./TestGeneratorModule";

/**
 * CRITICAL: Test context isolation during concurrent method execution
 * After login succeeds, does context persist correctly during RPC calls?
 */
describe("Concurrent Context Isolation (CRITICAL)", () => {
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
        
        // Create simple in-memory user provider
        const users = new Map<string, PotoUser>();

        server = new PotoServer({
            port: testPort,
            staticDir: "./public",
            jwtSecret: "test-secret-key-for-concurrent-context-tests"
        });

        server.setUserProvider({
            async findUserByUserId(userId: string) {
                // Auto-create visitor users
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
        
        // Add test module
        server.addModule(new TestGeneratorModule());
        
        server.run();

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`Concurrent Context Test Server running on ${serverUrl}`);
    });

    afterAll(() => {
        if (server?.server) {
            server.server.stop();
            console.log("Concurrent Context Test Server stopped");
        }
    });

    it("should preserve userId in 10 concurrent method calls from same client", async () => {
        const client = createTestClient();
        await client.loginAsVisitor();
        
        expect(client.userId).toBeDefined();
        const expectedUserId = client.userId;
        
        const proxy = client.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
        
        // Make 10 concurrent calls
        const promises = Array.from({ length: 10 }, () => 
            proxy.postRegularMethod_("test")
        );
        
        const results = await Promise.all(promises);
        
        // Verify ALL results include the correct userId
        for (const result of results) {
            expect(result).toContain(expectedUserId);
        }
        
        console.log(`✅ All 10 concurrent calls preserved userId: ${expectedUserId}`);
    }, 30000);

    it("should preserve userId in 50 concurrent generator calls from same client", async () => {
        const client = createTestClient();
        await client.loginAsVisitor();
        
        expect(client.userId).toBeDefined();
        const expectedUserId = client.userId;
        
        const proxy = client.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
        
        // Make 50 concurrent generator calls
        const promises = Array.from({ length: 50 }, async () => {
            const gen = await proxy.postSimpleGenerator_(3);
            const chunks: any[] = [];
            for await (const chunk of gen) {
                chunks.push(chunk);
            }
            return chunks;
        });
        
        const allChunks = await Promise.all(promises);
        
        // Verify ALL chunks have the correct userId
        let totalChunks = 0;
        for (const chunks of allChunks) {
            for (const chunk of chunks) {
                expect(chunk.userId).toBe(expectedUserId);
                totalChunks++;
            }
        }
        
        console.log(`✅ All ${totalChunks} chunks from 50 concurrent generators preserved userId: ${expectedUserId}`);
    }, 30000);

    it("should isolate userId across 20 concurrent clients", async () => {
        const concurrentClients = 20;
        const clients: PotoClient[] = [];
        
        // Create and login all clients
        for (let i = 0; i < concurrentClients; i++) {
            const client = createTestClient();
            await client.loginAsVisitor();
            expect(client.userId).toBeDefined();
            clients.push(client);
        }
        
        // Each client makes a call - all simultaneously
        const promises = clients.map(client => {
            const proxy = client.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
            return proxy.postRegularMethod_("test").then(result => ({
                clientUserId: client.userId,
                resultUserId: result.match(/user: ([^)]+)/)?.[1]
            }));
        });
        
        const results = await Promise.all(promises);
        
        // Verify each result matches its client's userId
        let matchCount = 0;
        let mismatchCount = 0;
        for (const { clientUserId, resultUserId } of results) {
            if (clientUserId === resultUserId) {
                matchCount++;
            } else {
                mismatchCount++;
                console.log(`❌ MISMATCH: client=${clientUserId}, result=${resultUserId}`);
            }
        }
        
        console.log(`Context isolation: ${matchCount}/${concurrentClients} matched (${mismatchCount} mismatches)`);
        expect(mismatchCount).toBe(0);
    }, 30000);

    it("should handle 100 concurrent calls from 10 different clients", async () => {
        const numClients = 10;
        const callsPerClient = 10;
        const clients: PotoClient[] = [];
        
        // Create and login all clients
        for (let i = 0; i < numClients; i++) {
            const client = createTestClient();
            await client.loginAsVisitor();
            expect(client.userId).toBeDefined();
            clients.push(client);
        }
        
        // Each client makes multiple calls - all simultaneously (100 total concurrent calls)
        const allPromises = clients.flatMap(client => {
            const proxy = client.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
            return Array.from({ length: callsPerClient }, () =>
                proxy.postRegularMethod_("test").then(result => ({
                    clientUserId: client.userId,
                    resultUserId: result.match(/user: ([^)]+)/)?.[1]
                }))
            );
        });
        
        const results = await Promise.all(allPromises);
        
        // Verify each result matches its client's userId
        let matchCount = 0;
        let mismatchCount = 0;
        const mismatches: string[] = [];
        
        for (const { clientUserId, resultUserId } of results) {
            if (clientUserId === resultUserId) {
                matchCount++;
            } else {
                mismatchCount++;
                mismatches.push(`client=${clientUserId}, result=${resultUserId}`);
            }
        }
        
        if (mismatchCount > 0) {
            console.log(`❌ ${mismatchCount} MISMATCHES:`, mismatches.slice(0, 10));
        }
        
        console.log(`Context isolation: ${matchCount}/${allPromises.length} matched`);
        expect(matchCount).toBe(allPromises.length);
    }, 30000);
});

