import { PotoModule } from "../src/server/PotoModule";
/**
 * Demo server module for testing iframe RPC
 */
export class DemoServerModule extends PotoModule {
    /**
     * Get server information
     */
    async getServerInfo() {
        return {
            serverName: 'DemoServer',
            timestamp: Date.now(),
            uptime: process.uptime(),
            version: '1.0.1',
            features: ['RPC', 'Iframe Communication', 'HTTP Bridge']
        };
    }
    /**
     * Process data sent from iframe
     */
    async processData(data) {
        console.log('DemoServer received data:', data);
        return {
            processed: true,
            receivedAt: Date.now(),
            dataSize: JSON.stringify(data).length,
            message: 'Data processed successfully by DemoServer',
            echo: data
        };
    }
    /**
     * Simple echo method
     */
    async postEcho(message) {
        return {
            original: message,
            echoed: 'echo - ' + message,
            timestamp: Date.now()
        };
    }
    /**
     * Get server statistics
     */
    async getStats() {
        return {
            requests: Math.floor(Math.random() * 1000),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version
        };
    }
    /**
     * Test method with parameters
     */
    async testMethod(param1, param2, param3) {
        return {
            param1,
            param2,
            param3,
            result: `Processed: ${param1} (${param2}) - ${param3}`,
            timestamp: Date.now()
        };
    }
}
//# sourceMappingURL=DemoServerModule.js.map