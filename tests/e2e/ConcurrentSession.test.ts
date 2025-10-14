import { describe, beforeAll, afterAll, test as it, expect } from "bun:test";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { SessionValueTestModule } from "./SessionValueTestModule";

/**
 * CRITICAL: Test session management under concurrent load
 * Session operations rely on AsyncLocalStorage context
 */
describe("Concurrent Session Management (CRITICAL)", () => {
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
            jwtSecret: "test-secret-key-for-concurrent-session-tests"
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
        
        // Add session test module
        server.addModule(new SessionValueTestModule());
        
        server.run();

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`Concurrent Session Test Server running on ${serverUrl}`);
    });

    afterAll(() => {
        if (server?.server) {
            server.server.stop();
            console.log("Concurrent Session Test Server stopped");
        }
    });

    it("should handle 20 concurrent session write operations from single client", async () => {
        const client = createTestClient();
        await client.loginAsVisitor();
        
        expect(client.userId).toBeDefined();
        console.log(`Testing with userId: ${client.userId}`);
        
        const proxy = client.getProxy<SessionValueTestModule>(SessionValueTestModule.name);
        
        // Write 20 different session values concurrently
        const promises = Array.from({ length: 20 }, (_, i) => 
            proxy.setASessionValue_(`key_${i}`, `value_${i}`)
        );
        
        const results = await Promise.all(promises);
        
        // Verify ALL writes succeeded
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < results.length; i++) {
            if (results[i].success) {
                successCount++;
            } else {
                failureCount++;
                console.log(`❌ Write ${i} failed: ${results[i].message}`);
            }
        }
        
        console.log(`Session writes: ${successCount}/20 succeeded (${failureCount} failures)`);
        expect(failureCount).toBe(0);
        
        // Verify we can read back all values
        const readPromises = Array.from({ length: 20 }, (_, i) =>
            proxy.getASessionValue_(`key_${i}`)
        );
        
        const readResults = await Promise.all(readPromises);
        
        let readSuccessCount = 0;
        for (let i = 0; i < readResults.length; i++) {
            if (readResults[i].success && readResults[i].value === `value_${i}`) {
                readSuccessCount++;
            } else {
                console.log(`❌ Read ${i} failed or mismatched: ${JSON.stringify(readResults[i])}`);
            }
        }
        
        console.log(`Session reads: ${readSuccessCount}/20 correct`);
        expect(readSuccessCount).toBe(20);
    }, 30000);

    it("should isolate sessions across 10 concurrent clients", async () => {
        const numClients = 10;
        const clients: PotoClient[] = [];
        
        // Create and login all clients
        for (let i = 0; i < numClients; i++) {
            const client = createTestClient();
            await client.loginAsVisitor();
            expect(client.userId).toBeDefined();
            clients.push(client);
        }
        
        console.log(`Created ${numClients} clients with unique user IDs`);
        
        // Each client writes its own session value concurrently
        const writePromises = clients.map((client, i) => {
            const proxy = client.getProxy<SessionValueTestModule>(SessionValueTestModule.name);
            return proxy.setASessionValue_("clientIndex", `client_${i}`).then(result => ({
                clientIndex: i,
                userId: client.userId,
                writeSuccess: result.success
            }));
        });
        
        const writeResults = await Promise.all(writePromises);
        
        // Verify all writes succeeded
        const writeFailures = writeResults.filter(r => !r.writeSuccess);
        if (writeFailures.length > 0) {
            console.log(`❌ Write failures:`, writeFailures);
        }
        expect(writeFailures.length).toBe(0);
        
        // Each client reads back its own session value concurrently
        const readPromises = clients.map((client, i) => {
            const proxy = client.getProxy<SessionValueTestModule>(SessionValueTestModule.name);
            return proxy.getASessionValue_("clientIndex").then(result => ({
                clientIndex: i,
                userId: client.userId,
                readSuccess: result.success,
                value: result.value,
                expectedValue: `client_${i}`
            }));
        });
        
        const readResults = await Promise.all(readPromises);
        
        // Verify each client got its OWN value (session isolation)
        let isolationFailures = 0;
        for (const result of readResults) {
            if (!result.readSuccess) {
                console.log(`❌ Read failed for client ${result.clientIndex}`);
                isolationFailures++;
            } else if (result.value !== result.expectedValue) {
                console.log(`❌ Session leak! Client ${result.clientIndex} (${result.userId}) expected "${result.expectedValue}" but got "${result.value}"`);
                isolationFailures++;
            }
        }
        
        console.log(`Session isolation: ${numClients - isolationFailures}/${numClients} correct (${isolationFailures} failures)`);
        expect(isolationFailures).toBe(0);
    }, 30000);

    it("should handle 100 concurrent session operations from 10 clients", async () => {
        const numClients = 10;
        const opsPerClient = 10;
        const clients: PotoClient[] = [];
        
        // Create and login all clients
        for (let i = 0; i < numClients; i++) {
            const client = createTestClient();
            await client.loginAsVisitor();
            expect(client.userId).toBeDefined();
            clients.push(client);
        }
        
        // Each client does multiple write operations concurrently (100 total ops)
        const allWritePromises = clients.flatMap((client, clientIdx) => {
            const proxy = client.getProxy<SessionValueTestModule>(SessionValueTestModule.name);
            return Array.from({ length: opsPerClient }, (_, opIdx) =>
                proxy.setASessionValue_(`key_${opIdx}`, `client_${clientIdx}_value_${opIdx}`).then(result => ({
                    clientIdx,
                    opIdx,
                    userId: client.userId,
                    success: result.success
                }))
            );
        });
        
        const writeResults = await Promise.all(allWritePromises);
        
        const writeFailures = writeResults.filter(r => !r.success);
        if (writeFailures.length > 0) {
            console.log(`❌ ${writeFailures.length} write failures`);
        }
        expect(writeFailures.length).toBe(0);
        
        // Each client reads back its own values concurrently
        const allReadPromises = clients.flatMap((client, clientIdx) => {
            const proxy = client.getProxy<SessionValueTestModule>(SessionValueTestModule.name);
            return Array.from({ length: opsPerClient }, (_, opIdx) =>
                proxy.getASessionValue_(`key_${opIdx}`).then(result => ({
                    clientIdx,
                    opIdx,
                    userId: client.userId,
                    success: result.success,
                    value: result.value,
                    expected: `client_${clientIdx}_value_${opIdx}`
                }))
            );
        });
        
        const readResults = await Promise.all(allReadPromises);
        
        let mismatchCount = 0;
        const mismatches: any[] = [];
        
        for (const result of readResults) {
            if (!result.success || result.value !== result.expected) {
                mismatchCount++;
                if (mismatches.length < 10) {
                    mismatches.push(result);
                }
            }
        }
        
        if (mismatchCount > 0) {
            console.log(`❌ ${mismatchCount} session mismatches:`, mismatches);
        }
        
        console.log(`Session operations: ${allReadPromises.length - mismatchCount}/${allReadPromises.length} correct`);
        expect(mismatchCount).toBe(0);
    }, 30000);
});

