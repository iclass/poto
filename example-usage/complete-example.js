// Complete example showing all available Poto Framework imports
// In a real project, you would use: import { PotoServer, PotoClient, ... } from 'poto';
import { PotoServer } from '../src/server/PotoServer';
import { PotoClient } from '../src/web/rpc/PotoClient';
import { PotoModule } from '../src/server/PotoModule';
import { LLMPotoModule } from '../src/llms/LLMPotoModule';
import { LLM } from '../src/llms/llm';
import { PotoUser } from '../src/server/UserProvider';
// Example server setup
class MyModule extends PotoModule {
    async getHello_() {
        return "Hello from Poto!";
    }
}
class MyLLMModule extends LLMPotoModule {
    async getAIResponse_(prompt) {
        // In a real implementation, you would use the protected getUserPreferredLLM method
        // For this example, we'll create a simple LLM instance
        const llm = new LLM('gpt-3.5-turbo', 'your-api-key', 'https://api.openai.com/v1/chat/completions');
        llm.user(prompt);
        const response = await llm.requestCompletion_();
        return response.choices[0].message.content || "No response";
    }
}
// Server setup
const server = new PotoServer({
    port: 3000,
    jwtSecret: 'your-secret-key',
    staticDir: './public'
});
// Add modules
server.addModule(new MyModule());
server.addModule(new MyLLMModule());
// Set up user provider
server.setUserProvider({
    async findUserByUserId(userId) {
        return new PotoUser(userId, "hashed-password", ["user"]);
    },
    async addUser(user) {
        return true;
    }
});
// Start server
server.run();
// Client setup
const client = new PotoClient('http://localhost:3000');
const myModule = client.getProxy(MyModule.name);
const myLLMModule = client.getProxy(MyLLMModule.name);
// Use the modules
async function example() {
    try {
        // Regular method call
        const greeting = await myModule.getHello_();
        console.log(greeting);
        // LLM method call
        const aiResponse = await myLLMModule.getAIResponse_("What is the meaning of life?");
        console.log(aiResponse);
    }
    catch (error) {
        console.error('Error:', error);
    }
}
example();
//# sourceMappingURL=complete-example.js.map