# Poto Framework Demo Application

This is a minimal demonstration of the Poto framework that showcases the basic client-server communication over HTTP with authentication, RPC calls, and streaming functionality.

## 🎯 What This Demo Shows

- **Server Setup**: Creating a PotoServer with authentication and session management
- **Client Connection**: Connecting to the server and authenticating
- **RPC Calls**: Making type-safe remote procedure calls
- **Session Management**: User authentication and session handling
- **Streaming**: Async generator methods (currently disabled due to package compatibility)

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime installed
- Access to the Poto framework (this demo uses the local framework)

### Installation

1. **Install dependencies**:

**Note:**: see the `package.json` for how to declare Poto as a dependency

   ```bash
   cd demoapp
   bun install
   ```

2. **Run the complete demo**:
   ```bash
   bun run server
   ```

   then in another console:

   ```bash
   bun run client
   ```



This will automatically:
- Start the demo server
- Wait for it to be ready
- Run the client demo
- Clean up processes

## 📁 Project Structure

```
demoapp/
├── package.json          # Project configuration
├── README.md            # This file
└── src/
    ├── server.ts        # Demo server with PotoServer
    ├── client.ts        # Demo client with PotoClient
    └── run-demo.ts      # Complete demo runner
```

## 🔧 Manual Testing

You can also run the server and client separately:

### Start the Server
```bash
bun run server
```

The server will start on `http://localhost:3000` with:
- Demo users: `demo/demo123` and `admin/admin123`
- Session management with cookies
- JWT authentication

### Run the Client
```bash
bun run client
```

The client will:
1. Connect to the server
2. Login as the demo user
3. Make various RPC calls
4. Test streaming functionality
5. Display results

## 📋 Demo Features

### Server Features (`src/server.ts`)

- **DemoModule**: A simple PotoModule with various methods
- **Authentication**: JWT-based authentication with demo users
- **Session Management**: Cookie-based session storage
- **RPC Methods**:
  - `getHello_()`: Simple greeting
  - `postMessage_(message)`: Echo service
  - `getServerInfo_()`: Server information
  - `postStream_(count)`: Async generator for streaming

### Client Features (`src/client.ts`)

- **PotoClient**: Type-safe RPC client
- **Authentication**: Login with demo credentials
- **Streaming**: Consuming async generator streams
- **Error Handling**: Proper error handling and cleanup

### Async Generator Example

The demo includes a streaming method that yields data progressively:

```typescript
async *postStream_(count: number, user: PotoUser) {
    for (let i = 1; i <= count; i++) {
        yield {
            step: i,
            total: count,
            message: `Processing step ${i} of ${count}`,
            timestamp: new Date().toISOString(),
            user: user.userId
        };
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}
```

## 🎨 Expected Output

When you run the demo, you should see output like:

```
🎯 Poto Framework Demo
====================

🚀 Starting demo server...
📡 Server: 🚀 Starting Poto Demo Server...
📡 Server: 📡 Server will be available at: http://localhost:3001
📡 Server: 👤 Demo users: demo/demo123, admin/admin123

🔌 Starting client demo...

🔌 Connecting to Poto Demo Server...
👤 Logging in as demo user...
✅ Successfully logged in!

📝 Getting greeting from server...
📨 Server response: Hello anonymous! Welcome to the Poto demo.

💬 Sending a message to server...
📨 Server echo: Echo: Hello from the demo client! (from anonymous)

ℹ️  Getting server information...
📊 Server info: {
  "serverName": "Poto Demo Server",
  "version": "1.0.0",
  "user": "anonymous",
  "timestamp": "2025-10-10T03:41:37.517Z",
  "features": ["RPC", "Streaming", "Authentication", "Session Management"]
}

🧪 Testing simple method...
📨 Stream test result: Stream test for 5 items (user: anonymous)

🌊 Testing async generator (streaming)...
⚠️  Streaming temporarily disabled due to compatibility issues
✅ Demo completed with basic RPC functionality!

🎉 Demo completed successfully!
```

## 🔍 Key Concepts Demonstrated

1. **Type Safety**: The client uses TypeScript interfaces to ensure type-safe RPC calls
2. **Authentication**: JWT-based authentication with user management
3. **Session Management**: Cookie-based session storage
4. **Streaming**: Real-time data streaming using async generators
5. **Error Handling**: Proper error handling and resource cleanup
6. **Modularity**: Clean separation between server modules and client code

## 🛠️ Customization

You can easily extend this demo by:

- Adding more methods to the `DemoModule`
- Creating additional modules
- Implementing more complex authentication logic
- Adding database integration
- Creating more sophisticated streaming scenarios

## 📚 Next Steps

After running this demo, you can:

1. Explore the main Poto framework documentation
2. Look at the `genericChatCli` example for a more complex application
3. Build your own Poto-based application
4. Contribute to the Poto framework

## 🤝 Support

For questions or issues with this demo or the Poto framework, please refer to the main project documentation or create an issue in the repository.
