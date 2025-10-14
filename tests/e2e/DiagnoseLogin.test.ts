import { describe, beforeAll, afterAll, test as it, expect } from "bun:test";
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";

/**
 * Diagnose exactly what happens during concurrent logins
 */
describe("Diagnose Login Issues", () => {
    let server: { server: ReturnType<typeof PotoServer.prototype.run> };
    let serverUrl: string;
    const testPort = Math.floor(Math.random() * 30000) + 30000;
    
    const loginAttempts: string[] = [];
    const findUserCalls: string[] = [];

    function createTestClient(): PotoClient {
        const mockStorage = {
            getItem: (key: string): string | null => {
                console.log(`[Storage] getItem('${key}')`);
                return null;
            },
            setItem: (key: string, value: string): void => {
                console.log(`[Storage] setItem('${key}', '${value.substring(0, 20)}...')`);
            },
            removeItem: (key: string): void => {
                console.log(`[Storage] removeItem('${key}')`);
            }
        };
        return new PotoClient(serverUrl, mockStorage);
    }

    beforeAll(async () => {
        serverUrl = `http://localhost:${testPort}`;

        server = new PotoServer({
            port: testPort,
            staticDir: "./public",
            jwtSecret: "diagnose-test-secret"
        });

        server.setUserProvider({
            async findUserByUserId(userId: string) {
                findUserCalls.push(userId);
                console.log(`[UserProvider] findUserByUserId('${userId}') - call #${findUserCalls.length}`);
                return new PotoUser(userId, "hash", ["user"]);
            },
            async addUser(user: PotoUser): Promise<boolean> {
                loginAttempts.push(user.id);
                console.log(`[UserProvider] addUser('${user.id}') - attempt #${loginAttempts.length}`);
                return true;
            }
        } as UserProvider);

        server.run();
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`Diagnose Server running on ${serverUrl}`);
    });

    afterAll(() => {
        if (server?.server) {
            server.server.stop();
        }
    });

    it("should diagnose 10 concurrent logins", async () => {
        const clients: PotoClient[] = [];

        console.log("\n=== Creating 10 clients ===");
        for (let i = 0; i < 10; i++) {
            clients.push(createTestClient());
        }

        console.log("\n=== Starting concurrent logins ===");
        const startTime = Date.now();
        
        const results = await Promise.allSettled(
            clients.map((client, i) => 
                client.loginAsVisitor().then(() => {
                    console.log(`[Client ${i}] Login succeeded: userId=${client.userId}`);
                    return client;
                }).catch(error => {
                    console.error(`[Client ${i}] Login failed:`, error.message);
                    throw error;
                })
            )
        );

        const elapsed = Date.now() - startTime;
        console.log(`\n=== Login completed in ${elapsed}ms ===`);

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected');

        console.log(`\nResults: ${successes}/10 succeeded`);
        console.log(`Total addUser calls: ${loginAttempts.length}`);
        console.log(`Total findUser calls: ${findUserCalls.length}`);

        if (failures.length > 0) {
            console.log("\nFailures:");
            failures.forEach((f, i) => {
                console.log(`  ${i + 1}. ${f.reason?.message || f.reason}`);
            });
        }

        // Check for duplicates
        const uniqueUsers = new Set(loginAttempts);
        console.log(`\nUnique visitor IDs created: ${uniqueUsers.size}/${loginAttempts.length}`);

        expect(successes).toBe(10);
    }, 30000);
});

