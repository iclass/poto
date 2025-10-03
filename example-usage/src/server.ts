// Example: Using Poto Framework as a remote dependency
// In a real project, you would use: import { PotoServer, PotoModule } from 'poto';
import { PotoServer } from '../../src/server/PotoServer';
import { PotoModule } from '../../src/server/PotoModule';

// Your custom module
export class MyModule extends PotoModule {
    async getHello_(): Promise<string> {
        return "Hello from Poto Framework!";
    }
    
    async *getStream_(): AsyncGenerator<{ message: string; timestamp: string }> {
        for (let i = 0; i < 5; i++) {
            yield {
                message: `Stream message ${i + 1}`,
                timestamp: new Date().toISOString()
            };
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Create and start server
const server = new PotoServer({
    port: 3000,
    jwtSecret: 'your-secret-key',
    staticDir: './public'
});

server.addModule(new MyModule());
server.run();

console.log('🚀 Server running on http://localhost:3000');
