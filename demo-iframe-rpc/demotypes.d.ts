/**
 * Type definitions for the clean RPC approach
 * Define your interfaces once, use them everywhere with full type safety
 */
export declare const DEMO_BASE = "RPC_DEMO";
export interface ParentInfo {
    windowId: string;
    url: string;
    title: string;
    timestamp: number;
}
export interface UserPreferences {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
}
export interface ServerInfo {
    serverName: string;
    timestamp: number;
    uptime: number;
    version: string;
    features: string[];
}
export interface ProcessedData {
    processed: boolean;
    receivedAt: number;
    dataSize: number;
    message: string;
    echo: any;
}
export interface EchoResponse {
    original: string;
    echoed: string;
    timestamp: number;
}
export interface ServerStats {
    requests: number;
    memory: NodeJS.MemoryUsage;
    platform: string;
    nodeVersion: string;
}
export interface TestResult {
    param1: string;
    param2: number;
    param3: boolean;
    result: string;
    timestamp: number;
}
//# sourceMappingURL=demotypes.d.ts.map