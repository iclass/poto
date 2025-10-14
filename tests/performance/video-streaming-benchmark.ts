// Video streaming benchmark - tests real MP4 file streaming
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
    console.log(`Starting video streaming benchmark on port ${testPort}`);

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

    // Check if video file exists
    const videoPath = path.resolve(__dirname, "../../demoapp/public/Barron_1100_words_HEVC_hw.mp4");
    try {
        const file = Bun.file(videoPath);
        const fileSize = file.size;
        console.log(`\n📹 Video file found: ${(fileSize / (1024 * 1024)).toFixed(2)} MB\n`);
    } catch (error) {
        console.error("❌ Video file not found:", videoPath);
        if (server.server) {
            server.server.stop();
        }
        return;
    }

    // Create client
    const mockStorage = {
        getItem: (key: string): string | null => null,
        setItem: (key: string, value: string): void => { },
        removeItem: (key: string): void => { }
    };
    const client = new PotoClient(serverUrl, mockStorage);
    await client.loginAsVisitor();

    console.log("🚀 Running video streaming benchmark...\n");

    // Run multiple iterations to get average performance
    const iterations = 5;
    const results: Array<{
        iteration: number;
        bytesReceived: number;
        chunks: number;
        timeSeconds: number;
        throughputMBps: number;
    }> = [];

    for (let i = 1; i <= iterations; i++) {
        console.log(`\n📊 Iteration ${i}/${iterations}...`);

        const proxy = client.getProxy<TestGeneratorModule>(TestGeneratorModule.name);
        const startTime = performance.now();

        const stream = await proxy.getVideoStream();

        let chunkCount = 0;
        let totalBytesReceived = 0;
        let minChunkSize = Infinity;
        let maxChunkSize = 0;
        const reader = stream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunkCount++;
                totalBytesReceived += value.length;
                minChunkSize = Math.min(minChunkSize, value.length);
                maxChunkSize = Math.max(maxChunkSize, value.length);
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
        console.log(`  📦 Chunk sizes: min=${(minChunkSize / 1024).toFixed(2)} KB, max=${(maxChunkSize / 1024).toFixed(2)} KB, avg=${(totalBytesReceived / chunkCount / 1024).toFixed(2)} KB`);

        results.push({
            iteration: i,
            bytesReceived: totalBytesReceived,
            chunks: chunkCount,
            timeSeconds: elapsedSeconds,
            throughputMBps
        });

        // Small delay between iterations
        if (i < iterations) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Calculate statistics
    console.log("\n" + "=".repeat(60));
    console.log("📊 BENCHMARK SUMMARY");
    console.log("=".repeat(60));

    const avgThroughput = results.reduce((sum, r) => sum + r.throughputMBps, 0) / results.length;
    const minThroughput = Math.min(...results.map(r => r.throughputMBps));
    const maxThroughput = Math.max(...results.map(r => r.throughputMBps));
    const avgTime = results.reduce((sum, r) => sum + r.timeSeconds, 0) / results.length;
    const avgBytes = results.reduce((sum, r) => sum + r.bytesReceived, 0) / results.length;
    const avgChunks = results.reduce((sum, r) => sum + r.chunks, 0) / results.length;

    // Calculate standard deviation of throughput
    const variance = results.reduce((sum, r) => sum + Math.pow(r.throughputMBps - avgThroughput, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);

    console.log(`\n📈 Performance Metrics (${iterations} iterations):`);
    console.log(`  Average Throughput: ${avgThroughput.toFixed(2)} MB/s`);
    console.log(`  Min Throughput:     ${minThroughput.toFixed(2)} MB/s`);
    console.log(`  Max Throughput:     ${maxThroughput.toFixed(2)} MB/s`);
    console.log(`  Std Deviation:      ${stdDev.toFixed(2)} MB/s`);
    console.log(`  Consistency:        ${((1 - stdDev / avgThroughput) * 100).toFixed(1)}%`);
    
    console.log(`\n⏱️  Timing:`);
    console.log(`  Average Time:       ${avgTime.toFixed(3)} seconds`);
    
    console.log(`\n📦 Data Transfer:`);
    console.log(`  Average Size:       ${(avgBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  Average Chunks:     ${Math.round(avgChunks)} chunks`);
    console.log(`  Avg Chunk Size:     ${(avgBytes / avgChunks / 1024).toFixed(2)} KB`);

    console.log("\n" + "=".repeat(60));

    // Performance analysis
    console.log("\n💡 Analysis:");
    if (avgThroughput > 100) {
        console.log("  ⚡ Excellent performance! Streaming is highly efficient.");
    } else if (avgThroughput > 50) {
        console.log("  ✅ Good performance. Streaming is working well.");
    } else if (avgThroughput > 20) {
        console.log("  ⚠️  Moderate performance. Consider optimization.");
    } else {
        console.log("  ⚠️  Low performance. Investigate bottlenecks.");
    }

    if (stdDev / avgThroughput < 0.1) {
        console.log("  📊 Very consistent performance across iterations.");
    } else if (stdDev / avgThroughput < 0.2) {
        console.log("  📊 Reasonably consistent performance.");
    } else {
        console.log("  📊 Performance varies significantly between runs.");
    }

    // Cleanup
    if (server.server) {
        server.server.stop();
        console.log("\n✅ Benchmark complete, server stopped");
    }
}

runBenchmark().catch(console.error);

