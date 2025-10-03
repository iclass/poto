#!/usr/bin/env bun

/**
 * Cross-platform port cleanup utility
 * Kills processes running on a specific port
 */

import { $ } from "bun";

const PORT = process.argv[2] || "3799";

console.log(`🧹 Cleaning up port ${PORT}...`);

try {
    // Try to find and kill processes on the port
    if (process.platform === "win32") {
        // Windows: use netstat and taskkill
        const netstatOutput = await $`netstat -ano | findstr :${PORT}`.text();
        if (netstatOutput.trim()) {
            const lines = netstatOutput.trim().split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    const pid = parts[4];
                    if (pid && pid !== '0') {
                        console.log(`🔪 Killing process ${pid} on port ${PORT}`);
                        await $`taskkill /F /PID ${pid}`.quiet();
                    }
                }
            }
        }
    } else {
        // Unix-like systems (macOS, Linux): use lsof
        try {
            const lsofOutput = await $`lsof -ti:${PORT}`.text();
            if (lsofOutput.trim()) {
                const pids = lsofOutput.trim().split('\n').filter(pid => pid.trim());
                for (const pid of pids) {
                    if (pid.trim()) {
                        console.log(`🔪 Killing process ${pid} on port ${PORT}`);
                        await $`kill -9 ${pid}`.quiet();
                    }
                }
            }
        } catch (error) {
            // lsof might not be available, try alternative approach
            console.log(`⚠️  lsof not available, trying alternative method...`);
            try {
                // Try using netstat on Unix systems
                const netstatOutput = await $`netstat -tulpn | grep :${PORT}`.text();
                if (netstatOutput.trim()) {
                    const lines = netstatOutput.trim().split('\n');
                    for (const line of lines) {
                        const match = line.match(/\s+(\d+)\/.*$/);
                        if (match && match[1]) {
                            const pid = match[1];
                            console.log(`🔪 Killing process ${pid} on port ${PORT}`);
                            await $`kill -9 ${pid}`.quiet();
                        }
                    }
                }
            } catch (altError) {
                console.log(`⚠️  Could not find processes on port ${PORT} (this is normal if port is free)`);
            }
        }
    }
    
    console.log(`✅ Port ${PORT} cleanup completed`);
} catch (error) {
    console.log(`⚠️  Port cleanup completed (some processes may not have been found)`);
}

// Small delay to ensure processes are fully terminated
await new Promise(resolve => setTimeout(resolve, 100));
