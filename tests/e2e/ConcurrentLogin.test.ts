import { describe, beforeAll, afterAll, test as it, expect } from "bun:test";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";

/**
 * CRITICAL: Test concurrent login and context isolation
 * This is the foundation of the architecture and must be rock-solid
 */
describe("Concurrent Login & Context Isolation (CRITICAL)", () => {
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
        users.set("testuser1", new PotoUser("testuser1", await Bun.password.hash("pass1"), ["user"]));
        users.set("testuser2", new PotoUser("testuser2", await Bun.password.hash("pass2"), ["user"]));

        server = new PotoServer({
            port: testPort,
            staticDir: "./public",
            jwtSecret: "test-secret-key-for-concurrent-login-tests"
        });

        server.setUserProvider({
            async findUserByUserId(userId: string) {
                return users.get(userId);
            },
            async addUser(user: PotoUser) {
                users.set(user.id, user);
                return true;
            }
        } as UserProvider);
        
        server.run();

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`Concurrent Login Test Server running on ${serverUrl}`);
    });

    afterAll(() => {
        if (server?.server) {
            server.server.stop();
            console.log("Concurrent Login Test Server stopped");
        }
    });

    it("should handle 10 concurrent visitor logins successfully", async () => {
        const concurrentLogins = 10;
        const clients: PotoClient[] = [];
        
        // Create all clients
        for (let i = 0; i < concurrentLogins; i++) {
            clients.push(createTestClient());
        }

        // Login all clients SIMULTANEOUSLY
        const loginPromises = clients.map(client => client.loginAsVisitor());
        await Promise.all(loginPromises);

        // Verify ALL clients got unique userId and token
        const userIds = new Set<string>();
        for (let i = 0; i < concurrentLogins; i++) {
            expect(clients[i].userId).toBeDefined();
            expect(clients[i].token).toBeDefined();
            expect(clients[i].userId).toStartWith("visitor_");
            
            // Ensure unique visitor IDs
            expect(userIds.has(clients[i].userId!)).toBe(false);
            userIds.add(clients[i].userId!);
        }

        console.log(`✅ All ${concurrentLogins} concurrent logins succeeded with unique IDs`);
    }, 30000);

    it("should handle 50 concurrent visitor logins successfully", async () => {
        const concurrentLogins = 50;
        const clients: PotoClient[] = [];
        
        // Create all clients
        for (let i = 0; i < concurrentLogins; i++) {
            clients.push(createTestClient());
        }

        // Login all clients SIMULTANEOUSLY
        const loginPromises = clients.map(client => client.loginAsVisitor());
        await Promise.all(loginPromises);

        // Verify ALL clients got unique userId and token
        const userIds = new Set<string>();
        for (let i = 0; i < concurrentLogins; i++) {
            expect(clients[i].userId).toBeDefined();
            expect(clients[i].token).toBeDefined();
            expect(clients[i].userId).toStartWith("visitor_");
            
            // Ensure unique visitor IDs
            expect(userIds.has(clients[i].userId!)).toBe(false);
            userIds.add(clients[i].userId!);
        }

        console.log(`✅ All ${concurrentLogins} concurrent logins succeeded with unique IDs`);
    }, 30000);

    it("should handle 100 concurrent visitor logins successfully", async () => {
        const concurrentLogins = 100;
        const clients: PotoClient[] = [];
        
        // Create all clients
        for (let i = 0; i < concurrentLogins; i++) {
            clients.push(createTestClient());
        }

        // Login all clients SIMULTANEOUSLY
        const loginPromises = clients.map(client => client.loginAsVisitor());
        const results = await Promise.allSettled(loginPromises);

        // Count successes
        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected');
        
        console.log(`Concurrent logins: ${successes}/${concurrentLogins} succeeded`);
        
        if (failures.length > 0) {
            console.log(`Failures:`, failures.map(f => f.reason.message));
        }

        // Verify all successful clients got unique userId and token
        const userIds = new Set<string>();
        let successCount = 0;
        for (let i = 0; i < concurrentLogins; i++) {
            if (clients[i].userId && clients[i].token) {
                expect(clients[i].userId).toStartWith("visitor_");
                expect(userIds.has(clients[i].userId!)).toBe(false);
                userIds.add(clients[i].userId!);
                successCount++;
            }
        }

        // Expect at least 95% success rate
        expect(successCount).toBeGreaterThanOrEqual(concurrentLogins * 0.95);
        console.log(`✅ ${successCount}/${concurrentLogins} concurrent logins succeeded (${(successCount/concurrentLogins*100).toFixed(1)}%)`);
    }, 30000);

    it("should handle concurrent named user logins successfully", async () => {
        const concurrentLogins = 20;
        const clients: PotoClient[] = [];
        
        // Create all clients
        for (let i = 0; i < concurrentLogins; i++) {
            clients.push(createTestClient());
        }

        // Half login as testuser1, half as testuser2
        const loginPromises = clients.map((client, i) => {
            const username = i % 2 === 0 ? "testuser1" : "testuser2";
            const password = i % 2 === 0 ? "pass1" : "pass2";
            return client.login({ username, password });
        });

        await Promise.all(loginPromises);

        // Verify ALL clients got correct userId
        for (let i = 0; i < concurrentLogins; i++) {
            expect(clients[i].userId).toBeDefined();
            expect(clients[i].token).toBeDefined();
            
            const expectedUserId = i % 2 === 0 ? "testuser1" : "testuser2";
            expect(clients[i].userId).toBe(expectedUserId);
        }

        console.log(`✅ All ${concurrentLogins} concurrent named user logins succeeded`);
    }, 30000);
});

