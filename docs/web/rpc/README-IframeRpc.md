# Iframe RPC System

## Overview

The Iframe RPC System provides a type-safe, multi-hop RPC mechanism that allows iframe content to communicate with both the parent window and HTTP servers through a unified proxy interface.

## Architecture

```
┌─────────────────┐    Window Messages    ┌─────────────────┐    HTTP Requests    ┌─────────────────┐
│   Iframe        │ ◄────────────────────► │   Parent        │ ◄─────────────────► │   HTTP Server   │
│   Content       │                       │   Window        │                     │                 │
│                 │                       │                 │                     │                 │
│ IframeRpcClient │                       │ ParentRpcBridge │                     │                 │
│ + Proxy         │                       │ + PotoClient    │                     │                 │
└─────────────────┘                       └─────────────────┘                     └─────────────────┘
```

### Components

1. **IframeRpcClient** - Runs in iframe, creates proxies for parent and server methods
2. **ParentRpcBridge** - Runs in parent window, handles routing and HTTP communication
3. **IframeRpcFactory** - Factory for creating type-safe proxies
4. **Message Protocol** - Standardized RPC message format

## Quick Start

### Minimal Setup with newRpcClient (Recommended)

```typescript
import { newRpcClient } from './RpcClient';

// Define your API interface
interface ParentAPI {
  getUserPreferences(): Promise<{ theme: string; language: string }>;
  showNotification(message: string, type?: string): Promise<void>;
}

// Create a type-safe client for all available methods (parent, global, server)
const client = newRpcClient<ParentAPI>();

// Usage
const prefs = await client.getUserPreferences();
await client.showNotification('Hello!', 'success');

// Optionally, restrict to a specific server module
interface ServerAPI {
  getServerInfo(): Promise<any>;
  processData(data: any): Promise<any>;
}
const server = newRpcClient<ServerAPI>({ modulePrefix: 'DemoServer' });
const info = await server.getServerInfo();
```

### 2. Iframe Client Setup

```typescript
import { createIframeRpcFactory } from './shared/IframeRpcFactory';
import type { AiSliderServer } from '../server/AiSlider';

// Create RPC factory
const rpcFactory = createIframeRpcFactory();

// Create proxies
const parentProxy = rpcFactory.createParentProxy<{
  getUserPreferences(): Promise<{ theme: string; language: string }>;
  showNotification(message: string): Promise<void>;
}>();

const aiSliderServer = rpcFactory.createServerProxy<AiSliderServer>('AiSliderServer');

// Use the proxies
const prefs = await parentProxy.getUserPreferences();
const result = await aiSliderServer.postSpeakTo_('Hello', { slideNo: 1 });
```

## Message Protocol

### RPC Request
```typescript
interface RpcRequest {
  _rpcId: string;           // Unique request ID
  _rpcType: 'request';      // Message type
  _rpcTarget: 'parent' | 'server'; // Target for the call
  method: string;           // Method name to call
  args: any[];             // Method arguments
  modulePrefix?: string;    // Server module prefix (for server calls)
}
```

### RPC Response
```typescript
interface RpcResponse {
  _rpcId: string;           // Matches request ID
  _rpcType: 'response';     // Message type
  result?: any;             // Return value
  error?: string;           // Error message (if any)
}
```

### RPC Error
```typescript
interface RpcError {
  _rpcId: string;           // Matches request ID
  _rpcType: 'error';        // Message type
  error: string;            // Error message
  details?: any;            // Additional error details
}
```

## Features

### Type Safety
- Full TypeScript support with generics
- Compile-time method checking
- IntelliSense support for all methods

### Error Handling
- Automatic timeout handling (default: 30s)
- Detailed error messages
- Request cleanup on errors

### Performance
- Request deduplication
- Automatic cleanup of pending requests
- Efficient message routing

### Flexibility
- Support for both parent and server calls
- Customizable timeouts
- Easy integration with existing code

## Integration Patterns

### 1. Replace Direct PotoClient Usage

**Before:**
```typescript
import { PotoClient } from './PotoClient';

const client = new PotoClient(PotoConstants.routePrefix);
const teacher = client.getProxy<AiSliderServer>('AiSliderServer');
```

**After:**
```typescript
import { createIframeRpcFactory } from './IframeRpcFactory';

const rpcFactory = createIframeRpcFactory();
const teacher = rpcFactory.createServerProxy<AiSliderServer>('AiSliderServer');
```

### 2. Add Parent Window Communication

```typescript
// Define parent API interface
interface ParentAPI {
  getTheme(): Promise<'light' | 'dark'>;
  setTheme(theme: 'light' | 'dark'): Promise<void>;
  showToast(message: string): Promise<void>;
}

// Create typed proxy
const parentProxy = rpcFactory.createParentProxy<ParentAPI>();

// Use with full type safety
const theme = await parentProxy.getTheme();
await parentProxy.showToast('Theme changed!');
```

### 3. Mixed Parent and Server Calls

```typescript
// Get user preferences from parent
const prefs = await parentProxy.getUserPreferences();

// Use preferences in server call
const result = await aiSliderServer.postSpeakTo_(
  'Hello', 
  { 
    slideNo: 1, 
    language: prefs.language 
  }
);
```

## Advanced Usage

### Custom Timeouts

```typescript
const rpcFactory = createIframeRpcFactory();
rpcFactory.setTimeout(60000); // 60 seconds
```

### Cleanup

```typescript
// Clean up when component unmounts
rpcFactory.cleanup();
```

### Error Handling

```typescript
try {
  const result = await serverProxy.someMethod();
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Request timed out');
  } else {
    console.error('RPC error:', error);
  }
}
```

### Concurrent Requests

```typescript
// Multiple concurrent calls are supported
const [result1, result2] = await Promise.all([
  serverProxy.method1(),
  serverProxy.method2()
]);
```

## Security Considerations

1. **Origin Validation** - Always validate message origins in production
2. **Method Whitelisting** - Only expose necessary parent methods
3. **Input Validation** - Validate all arguments before processing
4. **Error Sanitization** - Don't expose sensitive error details

## Migration Guide

### From Direct PotoClient

1. Replace `new PotoClient()` with `createIframeRpcFactory()`
2. Replace `client.getProxy<T>()` with `rpcFactory.createServerProxy<T>()`
3. Add cleanup calls where appropriate
4. Update error handling for RPC-specific errors

### From Window Messaging

1. Replace custom message handling with RPC proxies
2. Define TypeScript interfaces for better type safety
3. Use the standardized message protocol
4. Leverage automatic error handling and timeouts

## Troubleshooting

### Common Issues

1. **Timeout Errors** - Increase timeout or check network connectivity
2. **Method Not Found** - Verify method names and module prefixes
3. **Type Errors** - Ensure TypeScript interfaces match server/parent APIs
4. **Memory Leaks** - Always call `cleanup()` when done

### Debug Mode

```typescript
// Enable debug logging
const rpcFactory = createIframeRpcFactory();
rpcFactory.getClient().setTimeout(30000);

// Check pending requests
console.log('Pending requests:', rpcFactory.getClient().pendingRequests);
```

## API Reference

### IframeRpcFactory

- `createParentProxy<T>()` - Create parent window proxy
- `createServerProxy<T>(modulePrefix)` - Create server proxy
- `setTimeout(timeout)` - Set default timeout
- `cleanup()` - Clean up resources
- `getClient()` - Get underlying client

### ParentRpcBridge

- `registerParentMethod(name, handler)` - Register parent method
- `registerParentMethods(handlers)` - Register multiple methods
- `getPotoClient()` - Get underlying PotoClient
- `getServerProxy<T>(modulePrefix)` - Get server proxy directly
- `cleanup()` - Clean up resources

### IframeRpcClient

- `getParentProxy<T>()` - Get parent proxy
- `getServerProxy<T>(modulePrefix)` - Get server proxy
- `setTimeout(timeout)` - Set timeout
- `cleanup()` - Clean up 