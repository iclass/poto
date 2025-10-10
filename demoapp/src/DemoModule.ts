import { PotoModule, roles } from 'poto';
import { Constants } from './demoConsts';
import { GenData, ServerInfo } from './demoConsts';

// Simple demo module with basic functionality
export class DemoModule extends PotoModule {
    getRoute(): string {
        return Constants.serverModuleName;
    }


    // Simple greeting method
    async hello_(): Promise<string> {
        // Option 1: Use cleaner setSession helper method
        await this.setSessionValue(Constants.sessionKey, 'test session data');

        const user = this.getCurrentUser();
        return `Hello ${user?.id || 'anonymous'}! Welcome to the Poto demo.`;
    }

    // Simple message method
    async postMessage_(message: string): Promise<string> {
        const user = this.getCurrentUser();
        return `Echo: ${message} (from ${user?.id || 'anonymous'}), with session data: ${(await this.getSessionValue(Constants.sessionKey))}`;
    }


    // Async generator method for streaming data
    async *testStream(count: number): AsyncGenerator<GenData> {
        const user = this.getCurrentUser();
        const userId = user?.id;

        for (let i = 1; i <= count; i++) {
            yield {
                step: i,
                total: count,
                message: `Processing step ${i} of ${count}`,
                timestamp: new Date().toISOString(),
                user: userId || 'not logged in'
            };

            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        yield {
            step: count + 1,
            total: count,
            message: 'Stream completed successfully!',
            timestamp: new Date().toISOString(),
            user: userId || 'not logged in'
        };
    }

    // Method to get server info
    async getServerInfo(): Promise<ServerInfo> {
        const user = this.getCurrentUser();
        return {
            serverName: 'Poto Demo Server',
            version: '1.0.2',
            user: user?.id || 'anonymous',
            timestamp: new Date().toISOString(),
            features: ['RPC', 'Streaming', 'Authentication', 'Session Management']
        };
    }

    // Admin-only method that requires admin role
    @roles(Constants.roles.admin)
    async getAdminSecret(): Promise<object> {
        const user = this.getCurrentUser();
        return {
            secret: 'This is a top-secret admin-only message!',
            adminUser: user?.id || 'unknown',
            timestamp: new Date().toISOString(),
            clearance: 'TOP SECRET',
            message: 'Only users with admin role can access this data.'
        };
    }
}
