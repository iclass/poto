// Baseline test for localhost network throughput
// Tests raw HTTP streaming without RPC/serialization overhead

import path from "path";

function getRandomPort(): number {
    return Math.floor(Math.random() * 30000) + 30000;
}

async function runBaselineTest() {
    const testPort = getRandomPort();
    
    // Create a simple HTTP server that streams the video file
    const server = Bun.serve({
        port: testPort,
        async fetch(req) {
            const url = new URL(req.url);
            
            if (url.pathname === "/video") {
                const videoPath = path.resolve(__dirname, "../../demoapp/public/Barron_1100_words_HEVC_hw.mp4");
                const file = Bun.file(videoPath);
                
                return new Response(file.stream(), {
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Content-Length': file.size.toString()
                    }
                });
            }
            
            return new Response("OK");
        }
    });

    console.log(`Started baseline server on http://localhost:${testPort}`);
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const iterations = 5;
    const results: Array<{ throughputMBps: number; timeSeconds: number; bytes: number }> = [];
    
    console.log("\n🔬 Testing RAW HTTP streaming (no RPC overhead)...\n");
    
    for (let i = 1; i <= iterations; i++) {
        console.log(`📊 Iteration ${i}/${iterations}...`);
        
        const startTime = performance.now();
        const response = await fetch(`http://localhost:${testPort}/video`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const reader = response.body!.getReader();
        let totalBytes = 0;
        let chunks = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.length;
            chunks++;
        }
        
        const endTime = performance.now();
        const elapsedSeconds = (endTime - startTime) / 1000;
        const throughputMBps = (totalBytes / (1024 * 1024)) / elapsedSeconds;
        
        console.log(`  ✅ ${(totalBytes / (1024 * 1024)).toFixed(2)} MB in ${chunks} chunks`);
        console.log(`  ⏱️  ${elapsedSeconds.toFixed(3)}s → ${throughputMBps.toFixed(2)} MB/s`);
        
        results.push({ throughputMBps, timeSeconds: elapsedSeconds, bytes: totalBytes });
        
        if (i < iterations) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 RAW HTTP BASELINE RESULTS");
    console.log("=".repeat(60));
    
    const avgThroughput = results.reduce((sum, r) => sum + r.throughputMBps, 0) / results.length;
    const minThroughput = Math.min(...results.map(r => r.throughputMBps));
    const maxThroughput = Math.max(...results.map(r => r.throughputMBps));
    const stdDev = Math.sqrt(
        results.reduce((sum, r) => sum + Math.pow(r.throughputMBps - avgThroughput, 2), 0) / results.length
    );
    
    console.log(`\n📈 Throughput:`);
    console.log(`  Average: ${avgThroughput.toFixed(2)} MB/s`);
    console.log(`  Min:     ${minThroughput.toFixed(2)} MB/s`);
    console.log(`  Max:     ${maxThroughput.toFixed(2)} MB/s`);
    console.log(`  StdDev:  ${stdDev.toFixed(2)} MB/s`);
    console.log(`  Consistency: ${((1 - stdDev / avgThroughput) * 100).toFixed(1)}%`);
    
    console.log("\n" + "=".repeat(60));
    
    server.stop();
    console.log("\n✅ Baseline test complete\n");
    
    return avgThroughput;
}

async function main() {
    console.log("🔬 Localhost Network Baseline Test");
    console.log("=" .repeat(60));
    console.log("Testing raw HTTP streaming without RPC/serialization overhead");
    console.log("This establishes the baseline for localhost network performance");
    console.log("=" .repeat(60) + "\n");
    
    const rawThroughput = await runBaselineTest();
    
    console.log("💡 Comparison with RPC Streaming:");
    console.log("  Raw HTTP:        " + rawThroughput.toFixed(2) + " MB/s (baseline)");
    console.log("  RPC Streaming:   758.17 MB/s (from previous benchmark)");
    console.log("  Overhead:        " + ((1 - 758.17 / rawThroughput) * 100).toFixed(1) + "%");
    console.log("\n📝 Note: RPC adds serialization, SSE formatting, and protocol overhead");
}

main().catch(console.error);

