// Example: Using Poto Framework client
// In a real project, you would use: import { PotoClient } from 'poto';
import { PotoClient } from '../../src/web/rpc/PotoClient';
import { MyModule } from './server';
async function main() {
    const client = new PotoClient('http://localhost:3000');
    const myModule = client.getProxy(MyModule.name);
    try {
        // Call regular method
        const result = await myModule.getHello_();
        console.log('Result:', result);
        // Call streaming method
        console.log('Streaming results:');
        for await (const chunk of myModule.getStream_()) {
            console.log('Received:', chunk);
        }
    }
    catch (error) {
        console.error('Error:', error);
    }
}
main();
//# sourceMappingURL=client.js.map