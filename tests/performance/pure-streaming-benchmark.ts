// Pure streaming benchmark without test framework overhead
import { PotoServer } from "../../src/server/PotoServer";
import { PotoUser, UserProvider } from "../../src/server/UserProvider";
import { PotoClient } from "../../src/web/rpc/PotoClient";
import { TestGeneratorModule } from "../e2e/TestGeneratorModule";
import path from "path";

// Helper to generate random port in safe range
function getRandomPort(): number {
    return Math.floor(Math.random() * 30000) + 30000;
}

async function runBenchmark() {
    const testPort = getRandomPort();
    console.log(`Starting benchmark on port ${testPort}`);

    // Create and start the server
    const server = new PotoServer({
        port: testPort,
        staticDir: path.resolve(__dirname, "../../../public"),
        jwtSecret: "benchmark-secret"
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

    // Start the server
    server.run();

    const serverUrl = `http://localhost:${testPort}`;

    // Wait for server to start
    let retries = 0;
    while (retries < 10) {
        try {
            const response = await fetch(serverUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            if (response.ok || response.status === 404) {
                console.log(`Server started on ${serverUrl}`);
                break;
            }
        } catch (error) {
            if (retries === 9) {
                throw new Error(`Server failed to start: ${error}`);
            }
        }
        retries++;
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Create client
    const mockStorage = {
        getItem: (key: string): string | null => null,
        setItem: (key: string, value: string): void => { },
        removeItem: (key: string): void => { }
    };
    const client = new PotoClient(serverUrl, mockStorage);
    await client.loginAsVisitor();

    console.log("\n🚀 Running pure streaming benchmark...\n");

    // Run benchmark with different sizes
    const testCases = [
        { size: 10 * 1024 * 1024, chunkSize: 40_000, name: "10 MB" },  // 10 MB
        { size: 50 * 1024 * 1024, chunkSize: 40_000, name: "50 MB" },  // 50 MB
        { size: 100 * 1024 * 1024, chunkSize: 40_000, name: "100 MB" } // 100 MB
    ];

    for (const testCase of testCases) {
        const totalChunks = Math.ceil(testCase.size / testCase.chunkSize);
        
        console.log(`\n📊 Testing ${testCase.name} (${totalChunks} chunks of ${testCase.chunkSize} bytes)...`);
        
        const proxy = client.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
        const startTime = performance.now();
        
        const stream = await proxy.postPureBinaryStream_("video", testCase.chunkSize, totalChunks);
        
        let chunkCount = 0;
        let totalBytesReceived = 0;
        const reader = stream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunkCount++;
                totalBytesReceived += value.length;
            }
        } finally {
            reader.releaseLock();
        }

        const endTime = performance.now();
        const elapsedSeconds = (endTime - startTime) / 1000;
        const totalMB = totalBytesReceived / (1024 * 1024);
        const throughputMBps = totalMB / elapsedSeconds;

        console.log(`  ✅ Received: ${totalMB.toFixed(2)} MB in ${chunkCount} chunks`);
        console.log(`  ⏱️  Time: ${elapsedSeconds.toFixed(3)} seconds`);
        console.log(`  🚀 Throughput: ${throughputMBps.toFixed(2)} MB/s`);
    }

    // Cleanup
    if (server.server) {
        server.server.stop();
        console.log("\n✅ Benchmark complete, server stopped");
    }
}

runBenchmark().catch(console.error);

