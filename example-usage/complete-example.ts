// Complete example showing all available Poto Framework imports
// In a real project, you would use: import { PotoServer, PotoClient, ... } from 'poto';
import { PotoServer } from '../src/server/PotoServer';
import { PotoClient } from '../src/web/rpc/PotoClient';
import { PotoModule } from '../src/server/PotoModule';
import { LLMPotoModule } from '../src/llms/LLMPotoModule';
import { LLM } from '../src/llms/llm';
import { LLMConfig } from '../src/llms/LLMConfig';
import { PotoUser } from '../src/server/UserProvider';
import { UserProvider } from '../src/server/UserProvider';
import { UserSessionProvider } from '../src/server/UserSessionProvider';
import { UserSessionData } from '../src/server/UserSessionProvider';
import { LLMSessionData } from '../src/llms/LLMPotoModule';
import { PotoRequestContext } from '../src/server/PotoRequestContext';
import { DialogEntry, DialogRole } from '../src/shared/CommonTypes';
import { JSONSchema } from '../src/shared/JSONSchema';

// Example server setup
class MyModule extends PotoModule {
    async getHello_(): Promise<string> {
        return "Hello from Poto!";
    }
}

class MyLLMModule extends LLMPotoModule {
    async getAIResponse_(prompt: string): Promise<string> {
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
    async findUserByUserId(userId: string) {
        return new PotoUser(userId, "hashed-password", ["user"]);
    },
    async addUser(user: PotoUser): Promise<boolean> {
        return true;
    }
} as UserProvider);

// Start server
server.run();

// Client setup
const client = new PotoClient('http://localhost:3000');
const myModule = client.getProxy<MyModule>(MyModule.name);
const myLLMModule = client.getProxy<MyLLMModule>(MyLLMModule.name);

// Use the modules
async function example() {
    try {
        // Regular method call
        const greeting = await myModule.getHello_();
        console.log(greeting);
        
        // LLM method call
        const aiResponse = await myLLMModule.getAIResponse_("What is the meaning of life?");
        console.log(aiResponse);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

example();
