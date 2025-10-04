# User Session Management

This document explains how user-specific session data is managed in the Generic Chat CLI.

## Architecture Overview

The `LLMPotoModule` base class provides user-specific session management that is inherited by all LLM-based modules. This ensures that shared module instances don't create conflicts between different users.

### Inheritance Hierarchy
```
PotoModule
    └── LLMPotoModule (session management + LLM preferences)
            └── ChatServerModule (chat-specific configuration)
```

## Session Flow

### 1. User Makes Request
```
Client → Server → ChatServerModule.chatWithHistory()
```

### 2. Session Retrieval
```typescript
// Business method calls getLLM()
const llm = await this.getLLM();

// getLLM() retrieves user-specific model
const userModelName = await this.getUserModel();

// getUserModel() accesses user session
const session = await this.getUserSession();

// getUserSession() gets current user
const user = await this.getCurrentUser();
```

### 3. LLM Configuration
```typescript
// User-specific model configuration is applied
const config = LLMConfig.getConfig(userModelName);
llm = await this.getLLMWithConfig(config.model, config.apiKey, config.endPoint);
```

## Session Data Structure

```typescript
interface UserSessionData {
    currentModelName: string;  // User's selected model
    lastActivity: Date;        // Last request timestamp
}
```

## Key Components

### Session Store
```typescript
private userSessions: Map<string, UserSessionData> = new Map();
```
- Keyed by user ID
- Each user gets isolated session data
- Automatically created on first access

### Session Methods

#### `getUserSession()` - Private
- Retrieves or creates user session
- Uses `getCurrentUser()` to get user context
- Updates `lastActivity` timestamp
- Returns user's session data

#### `updateUserModel(modelName)` - Private
- Updates user's current model preference
- Called by `setModel()` public method

#### `getUserModel()` - Private
- Returns user's current model name
- Used by `getLLM()` to configure LLM

#### `cleanupOldSessions(maxAgeHours)` - Private
- Removes inactive sessions (default 24 hours)
- For memory management
- Can be called periodically

#### `getSessionStats()` - Public
- Returns session statistics
- Useful for monitoring/debugging

## Business Method Integration

All business methods that need LLM access use the same pattern:

```typescript
async *someBusinessMethod(...args): AsyncGenerator<string> {
    try {
        // This call automatically uses user-specific session data
        const llm = await this.getLLM();
        
        // Configure LLM for this specific request
        llm.clearFormat();
        llm.system("system prompt");
        llm.user(message);
        
        // Generate response
        for await (const text of await llm.requestCompletionTextGenerator_()) {
            yield text;
        }
    } catch (error) {
        yield `Error: ${error.message}`;
    }
}
```

### Methods Using User Sessions

1. **`postChat()`** - Simple streaming chat
2. **`chatWithHistory()`** - Chat with conversation history
3. **`postChatWithHistoryAndUser()`** - Chat with user context
4. **`chatNonStreaming()`** - Non-streaming chat
5. **`postChatWithParams()`** - Chat with custom parameters

All these methods call `getLLM()`, which automatically:
- Retrieves user's session data
- Applies user's model preference
- Returns properly configured LLM instance

## User Actions

### Setting Model
```typescript
// Client calls:
await chatServerModuleProxy.setModel('llm2');

// Server updates user's session:
async setModel(modelName: string): Promise<boolean> {
    await this.updateUserModel(modelName);
    return true;
}
```

### Getting Current Model
```typescript
// Client calls:
const modelInfo = await chatServerModuleProxy.getCurrentModel();

// Server retrieves from user's session:
async getCurrentModel(): Promise<ModelInfo> {
    const userModelName = await this.getUserModel();
    // ... returns model info
}
```

## Benefits

### ✅ **Isolated User State**
- Each user has their own preferences
- No interference between concurrent users
- Thread-safe operation

### ✅ **Automatic Management**
- Sessions created automatically on first access
- Last activity tracked automatically
- Clean separation of concerns

### ✅ **Scalable Design**
- Supports unlimited concurrent users
- Memory-efficient with cleanup
- No database required for sessions

### ✅ **Simple API**
- Business methods don't need to manage sessions
- `getLLM()` handles all session logic
- Transparent to callers

## Example: Multiple Users

```typescript
// User Alice (ID: user_alice)
// Session: { currentModelName: 'llm1', lastActivity: ... }
// Her requests use GPT-4

// User Bob (ID: user_bob) 
// Session: { currentModelName: 'llm2', lastActivity: ... }
// His requests use Doubao

// Both can use the same server instance simultaneously
// Their sessions are completely isolated
```

## Session Lifecycle

1. **Creation**: First request from user creates session
2. **Updates**: Each request updates `lastActivity`
3. **Model Changes**: User can change model via `setModel()`
4. **Cleanup**: Old sessions can be cleaned up (optional)
5. **Isolation**: Different users never see each other's data

## Memory Management

Sessions are kept in memory for performance. For production:

1. **Cleanup Strategy**: Call `cleanupOldSessions()` periodically
2. **Session Limit**: Consider max session count
3. **Persistence**: For long-term storage, consider Redis/database
4. **Monitoring**: Use `getSessionStats()` to track usage

## Technical Details

### Thread Safety
- Each user ID maps to unique session
- Map operations are synchronous
- No race conditions with async operations

### Request Context
- Uses AsyncLocalStorage for user context
- User ID available via `getCurrentUser()`
- Automatic context propagation

### Error Handling
- Missing user throws clear error
- Invalid model falls back to default
- Session errors don't break requests

## Summary

The user session system provides:
- **Per-user state management**
- **Transparent integration** with business methods
- **Scalable architecture** for multiple users
- **Clean separation** of concerns
- **Simple API** for developers

All user-specific preferences are automatically managed through the session store, ensuring that the shared ChatServerModule instance works correctly for all concurrent users.
