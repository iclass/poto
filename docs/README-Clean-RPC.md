# 🚀 Clean RPC Client Architecture

This document explains the new minimal, type-safe RPC approach that eliminates boilerplate code while providing full TypeScript support.

## 🎯 The Problem

The original RPC implementation was verbose and required lots of boilerplate:

```typescript
// Old approach - lots of setup code
const rpcFactory = createIframeRpcFactory();
const parentProxy = rpcFactory.createParentProxy<ParentAPI>();
const serverProxy = rpcFactory.createServerProxy<ServerAPI>('DemoServer');

// Usage
const result = await parentProxy.getParentInfo();
```

## ✨ The Solution

The new approach is minimal and type-safe:

```typescript
// New approach - minimal setup
const parent = createRpcClient<ParentAPI>('parent');
const server = createRpcClient<ServerAPI>('server', 'DemoServer');

// Usage - full type safety and IntelliSense
const result = await parent.getParentInfo();
```

## 📝 How to Use

### 1. Define Your Interfaces

Create type definitions for your APIs:

```typescript
// types.ts
export interface ParentAPI {
  getParentInfo(): Promise<ParentInfo>;
  showNotification(message: string, type: string): Promise<void>;
  getUserPreferences(): Promise<UserPreferences>;
}

export interface ServerAPI {
  getServerInfo(): Promise<ServerInfo>;
  processData(data: any): Promise<ProcessedData>;
}
```

### 2. Create Type-Safe Clients

```typescript
import { createRpcClient } from '../src/shared/RpcClient';
import { ParentAPI, ServerAPI } from './types';

const parent = createRpcClient<ParentAPI>('parent');
const server = createRpcClient<ServerAPI>('server', 'DemoServer');
```

### 3. Use with Full Type Safety

```typescript
// Full IntelliSense support!
const info = await parent.getParentInfo();
await parent.showNotification('Hello!', 'success');
const serverInfo = await server.getServerInfo();

// TypeScript enforces parameter types
const result = await server.testMethod(
  'string param',  // ✅ TypeScript enforces string
  123,             // ✅ TypeScript enforces number
  true             // ✅ TypeScript enforces boolean
);
```

## 🎯 Benefits

### Minimal Boilerplate
- **Old:** ~50 lines of setup code
- **New:** ~5 lines of setup code

### Full Type Safety
- ✅ Compile-time type checking
- ✅ IntelliSense support
- ✅ Parameter validation
- ✅ Return type inference

### Clean API
- No factory classes
- No complex setup
- Direct interface implementation
- Easy to understand and maintain

### Easy Testing
```typescript
// Mock for testing
const mockParent: ParentAPI = {
  getParentInfo: jest.fn().mockResolvedValue(mockParentInfo),
  showNotification: jest.fn().mockResolvedValue(undefined),
  getUserPreferences: jest.fn().mockResolvedValue(mockPreferences)
};
```

## 🔧 Advanced Usage

### Batch Operations
```typescript
const [parentInfo, serverInfo, stats] = await Promise.all([
  parent.getParentInfo(),
  server.getServerInfo(),
  server.getStats()
]);
```

### Conditional Calls
```typescript
const parentInfo = await parent.getParentInfo();
if (parentInfo.url.includes('localhost')) {
  await parent.showNotification('Development mode', 'info');
}
```

### Error Handling
```typescript
try {
  const result = await server.processData(data);
  console.log('Success:', result);
} catch (error) {
  console.error('RPC failed:', error.message);
}
```

## 📊 Comparison

| Aspect | Old Approach | New Approach |
|--------|-------------|--------------|
| Setup Code | ~50 lines | ~5 lines |
| Type Safety | Manual | Automatic |
| IntelliSense | Limited | Full |
| Testing | Complex | Simple |
| Maintenance | High | Low |

## 🚀 Migration Guide

### From Old to New

1. **Replace factory setup:**
   ```typescript
   // Old
   const rpcFactory = createIframeRpcFactory();
   const parentProxy = rpcFactory.createParentProxy<ParentAPI>();
   
   // New
   const parent = createRpcClient<ParentAPI>('parent');
   ```

2. **Update method calls:**
   ```typescript
   // Old
   const result = await parentProxy.getParentInfo();
   
   // New
   const result = await parent.getParentInfo();
   ```

3. **Remove factory references:**
   ```typescript
   // Old
   rpcFactory.setTimeout(5000);
   rpcFactory.cleanup();
   
   // New - no cleanup needed, automatic
   ```

## 🎉 Result

You can now write clean, type-safe RPC code like this:

```typescript
// Define interfaces once
interface MyAPI {
  getData(): Promise<Data>;
  saveData(data: Data): Promise<void>;
}

// Create client
const api = createRpcClient<MyAPI>('server', 'MyModule');

// Use with full type safety
const data = await api.getData();
await api.saveData(data);
```

That's it! No boilerplate, no complex setup, just clean, type-safe RPC calls. 