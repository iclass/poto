import { PotoModule } from "../src/server/PotoModule";
/**
 * Demo server module for testing iframe RPC
 */
export declare class DemoServerModule extends PotoModule {
    /**
     * Get server information
     */
    getServerInfo(): Promise<{
        serverName: string;
        timestamp: number;
        uptime: number;
        version: string;
        features: string[];
    }>;
    /**
     * Process data sent from iframe
     */
    processData(data: any): Promise<{
        processed: boolean;
        receivedAt: number;
        dataSize: number;
        message: string;
        echo: any;
    }>;
    /**
     * Simple echo method
     */
    postEcho(message: string): Promise<{
        original: string;
        echoed: string;
        timestamp: number;
    }>;
    /**
     * Get server statistics
     */
    getStats(): Promise<{
        requests: number;
        memory: NodeJS.MemoryUsage;
        platform: NodeJS.Platform;
        nodeVersion: string;
    }>;
    /**
     * Test method with parameters
     */
    testMethod(param1: string, param2: number, param3: boolean): Promise<{
        param1: string;
        param2: number;
        param3: boolean;
        result: string;
        timestamp: number;
    }>;
}
//# sourceMappingURL=DemoServerModule.d.ts.map