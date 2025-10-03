# Generic Chat CLI

A clean, streaming chat CLI application that demonstrates the power of the PotoClient/PotoServer infrastructure with LLM streaming capabilities.

## Features

- 🚀 **Real-time streaming** - See AI responses as they're generated
- 💬 **Conversation history** - Maintains context across messages
- 🎯 **Clean architecture** - Uses PotoClient/PotoServer with async generators
- 🛠️ **Type-safe** - Full TypeScript support with end-to-end type safety
- 🔧 **Flexible** - Support for custom system prompts and LLM parameters
- 📝 **Interactive CLI** - Easy-to-use command-line interface

## Architecture

This application demonstrates the clean streaming capabilities of the Poto system with proper client/server separation:

```
Client (ChatClient) → PotoClient → PotoServer → LLM Class → OpenAI API
                    ↑                                    ↓
                    ← AsyncGenerator ← AsyncGenerator ← StreamingChunk
```

### Key Architectural Principles

1. **Client/Server Separation**: Client only imports shared types, never server implementation
2. **Type Safety**: Full TypeScript support with shared interfaces
3. **Clean Bundling**: Server code never gets bundled in client builds
4. **String-based Routing**: Client uses string route names instead of importing server modules

### Key Components

1. **ChatServer** (`server/ChatServer.ts`)
   - PotoModule that provides streaming chat endpoints
   - Uses LLM's `requestCompletionTextGenerator_()` for clean streaming
   - Supports conversation history and custom parameters

2. **ServerMain** (`server/ServerMain.ts`)
   - Sets up PotoServer with proper configuration
   - Registers the chat module
   - Handles graceful shutdown

3. **ChatClient** (`client/ChatClient.ts`)
   - Interactive console interface using readline
   - Connects to server via PotoClient using string route name
   - Handles streaming responses and conversation management
   - **Never imports server implementation**

4. **Shared Types** (`shared/types.ts`)
   - Common interfaces used by both client and server
   - Ensures type safety without bundling server code in client
   - Defines the contract between client and server

## Quick Start

### 1. Start the Server

```bash
# Terminal 1: Start the chat server
cd genericChatCli
bun run server
```

You should see:
```
🚀 Starting Generic Chat Server...
📡 Server starting on http://localhost:3000
💬 Chat endpoint: http://localhost:3000/chat
🔗 SSE endpoint: http://localhost:3000/subscribe

Press Ctrl+C to stop the server

PotoServer running on http://localhost:3000
✅ Server running on http://localhost:3000
```

### 2. Start the Client

```bash
# Terminal 2: Start the chat client
cd genericChatCli
bun run client
```

You should see:
```
🎯 Generic Chat CLI
📡 Connecting to: http://localhost:3000

🔌 Connecting to chat server...
✅ Connected to chat server!
🤖 AI Response: Hello! How can I help you today?

💬 Generic Chat CLI Started!
Type your messages and press Enter.
Type "quit", "exit", or "bye" to end the chat.
Type "clear" to clear conversation history.
Type "history" to see conversation history.
Type "system <prompt>" to set system prompt.
Type "help" for more commands.

> 
```

### 3. Start Chatting!

```
> Tell me a joke
👤 You: Tell me a joke
🤖 AI: Why don't scientists trust atoms? Because they make up everything! 😄

> system You are a helpful coding assistant. Provide code examples when relevant.
🎯 System prompt set: You are a helpful coding assistant. Provide code examples when relevant.

> Write a function to reverse a string
👤 You: Write a function to reverse a string
🤖 AI: Here's a function to reverse a string in JavaScript:

```javascript
function reverseString(str) {
    return str.split('').reverse().join('');
}

// Example usage:
console.log(reverseString("hello")); // "olleh"
```

You can also use a more efficient approach with a loop:

```javascript
function reverseString(str) {
    let reversed = '';
    for (let i = str.length - 1; i >= 0; i--) {
        reversed += str[i];
    }
    return reversed;
}
```

> quit
👋 Goodbye!
```

## Commands

- `quit`, `exit`, `bye` - End the chat session
- `clear` - Clear conversation history
- `history` - Show conversation history
- `system <prompt>` - Set a custom system prompt
- `help` - Show available commands

## Development

### Running with Custom Server URL

```bash
# Start client with custom server URL
bun run client http://localhost:8080
```

### Running Both Server and Client

```bash
# Run both server and client in parallel
bun run dev
```

### Manual Execution

```bash
# Start server manually
bun server/ServerMain.ts

# Start client manually
bun client/ChatClient.ts
```

## API Endpoints

The server provides these streaming endpoints:

- `POST /chat/chat_` - Simple chat with optional system prompt
- `POST /chat/chatWithHistory_` - Chat with conversation history
- `POST /chat/chatWithParams_` - Chat with custom LLM parameters

## Streaming Implementation

### Server-Side (Clean Async Generator)

```typescript
async *chat_(message: string, systemPrompt?: string, user?: PotoUser): AsyncGenerator<string> {
    const llm = LLM.newInstance();
    
    if (systemPrompt) {
        llm.system(systemPrompt);
    } else {
        llm.system("You are a helpful AI assistant.");
    }
    
    llm.user(message);

    // Clean streaming with generator
    const textGenerator = await llm.requestCompletionTextGenerator_();
    
    for await (const text of textGenerator) {
        yield text;
    }
}
```

### Client-Side (Natural Consumption)

```typescript
const responseGenerator = await this.proxy.chat_("Hello!");

for await (const text of responseGenerator) {
    process.stdout.write(text); // Real-time output
}
```

## Key Benefits

1. **End-to-End Type Safety**: Full TypeScript support from server to client
2. **Clean Code**: No manual stream management or resource cleanup
3. **Natural Async Patterns**: Simple `for await...of` loops
4. **Real-time Streaming**: Immediate delivery of AI responses
5. **Flexible Architecture**: Easy to extend with new features
6. **Error Handling**: Graceful error handling at all levels

## Dependencies

- **PotoClient/PotoServer**: RPC framework with streaming support
- **LLM Class**: OpenAI API integration with streaming generators
- **Bun**: Fast TypeScript runtime
- **Readline**: Console input/output handling

## Deployment Considerations

### Client/Server Separation

This application follows proper client/server separation patterns:

```typescript
// ✅ CORRECT: Client uses string route name
this.proxy = this.client.getProxy<ChatProxy>('chat');

// ❌ WRONG: Client imports server module
this.proxy = this.client.getProxy<ChatServerModule>(ChatServerModule.name);
```

**Benefits:**
- Server code never gets bundled in client builds
- Smaller client bundle size
- Better security (server implementation details not exposed)
- Cleaner architecture with proper separation of concerns

### Production Deployment

1. **Server**: Deploy `server/` and `shared/` to your server environment
2. **Client**: Deploy `client/` and `shared/` to client environment
3. **Types**: The `shared/types.ts` ensures type safety across environments

## Troubleshooting

### Connection Issues

1. Make sure the server is running (`bun run server`)
2. Check the server URL in the client
3. Verify network connectivity
4. Check console for error messages

### API Key Issues

Make sure your OpenAI API key is set in the environment:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

### Streaming Issues

If streaming doesn't work:
1. Check that the LLM class is properly configured
2. Verify OpenAI API quota and limits
3. Check network connectivity to OpenAI

This application demonstrates the clean, type-safe streaming capabilities of the Poto system, making it easy to build real-time chat applications with minimal boilerplate code.
