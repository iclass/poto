# Session Storage Architecture

This document describes the pluggable session storage architecture that supports scalable deployments.

## Architecture Overview

The session storage system is designed with three layers:

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (ChatServerModule, other modules)      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      LLMPotoModule (LLM-specific)       │
│   - Model preferences                   │
│   - LLM session data                    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│       PotoModule (Generic sessions)      │
│   - Session management API              │
│   - User session access                 │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   UserSessionProvider (Interface)       │
│   - Pluggable implementations           │
└─────────────────────────────────────────┘
                  ↓
      ┌───────────┴───────────┐
      ↓                       ↓
┌──────────────┐    ┌──────────────────┐
│  In-Memory   │    │  Redis/Database  │
│  (dev/demo)  │    │  (production)    │
└──────────────┘    └──────────────────┘
```

## Components

### 1. UserSessionProvider (Interface)

Abstract interface for session storage implementations.

```typescript
interface UserSessionProvider {
    getSession(userId: string): Promise<UserSessionData | null>;
    setSession(userId: string, sessionData: UserSessionData): Promise<void>;
    deleteSession(userId: string): Promise<void>;
    hasSession(userId: string): Promise<boolean>;
    cleanupOldSessions(maxAgeMs: number): Promise<number>;
    getActiveSessions(): Promise<string[]>;
    getStats(): Promise<{ activeSessions: number; userIds: string[] }>;
}
```

### 2. InMemorySessionProvider (Default)

Simple in-memory implementation for:
- Single-instance deployments
- Development environments
- Testing

**Limitations:**
- Not shared across server instances
- Lost on server restart
- Not suitable for horizontal scaling

### 3. RedisSessionProvider (Production)

Redis-based implementation for:
- Multi-instance deployments
- Horizontal scaling
- Session persistence
- Automatic TTL/expiration

**Benefits:**
- Shared across all server instances
- Persists across restarts
- High performance
- Built-in expiration

### 4. PotoModule (Base Session Management)

Provides generic session management for all modules:

```typescript
// Get/create session
const session = await this.getUserSession();

// Update session
await this.updateUserSession((session) => {
    session.someField = "value";
});

// Delete session
await this.deleteUserSession();

// Get stats
const stats = await this.getSessionStats();
```

### 5. LLMPotoModule (LLM-Specific)

Extends base sessions with LLM-specific data:

```typescript
interface LLMSessionData extends UserSessionData {
    currentModelName: string;
}

// LLM-specific methods
await this.updateUserModel('llm2');
const model = await this.getUserModel();
```

## Configuration

### Development (Default)

Uses in-memory sessions automatically:

```typescript
// No configuration needed
// InMemorySessionProvider is the default
```

### Production (Redis)

Set session provider at application startup:

```typescript
import { PotoModule } from './server/PotoModule';
import { RedisSessionProvider } from './server/UserSessionProvider';

// Initialize Redis session provider
const redisProvider = new RedisSessionProvider('redis://localhost:6379');
PotoModule.setSessionProvider(redisProvider);

// Now all modules use Redis for sessions
```

### Production (Custom)

Implement your own session provider:

```typescript
import { UserSessionProvider, UserSessionData } from './server/UserSessionProvider';

class MyDatabaseSessionProvider implements UserSessionProvider {
    async getSession(userId: string): Promise<UserSessionData | null> {
        // Query your database
        return await db.sessions.findOne({ userId });
    }

    async setSession(userId: string, sessionData: UserSessionData): Promise<void> {
        // Save to your database
        await db.sessions.upsert({ userId }, sessionData);
    }

    // ... implement other methods
}

// Use it
const dbProvider = new MyDatabaseSessionProvider();
PotoModule.setSessionProvider(dbProvider);
```

## Deployment Scenarios

### Scenario 1: Single Instance (Development)

```
┌─────────────┐
│   Server    │
│  (in-memory)│
└─────────────┘
```

**Configuration:** None needed (default)

**Use case:** Local development, testing

### Scenario 2: Multiple Instances (Production)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Server 1   │    │  Server 2   │    │  Server 3   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                   │
       └──────────────────┼───────────────────┘
                          │
                    ┌─────┴─────┐
                    │   Redis   │
                    └───────────┘
```

**Configuration:**
```typescript
PotoModule.setSessionProvider(
    new RedisSessionProvider('redis://redis:6379')
);
```

**Use case:** Production with load balancing

### Scenario 3: Kubernetes with Redis Cluster

```
┌─────────────────────────────────────────┐
│           Kubernetes Cluster            │
│                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │ Pod 1  │  │ Pod 2  │  │ Pod 3  │   │
│  └────┬───┘  └────┬───┘  └────┬───┘   │
│       └───────────┼───────────┘        │
│                   │                    │
│            ┌──────┴──────┐             │
│            │ Redis Cluster│             │
│            └──────────────┘             │
└─────────────────────────────────────────┘
```

**Configuration:**
```typescript
PotoModule.setSessionProvider(
    new RedisSessionProvider(process.env.REDIS_URL)
);
```

## Session Data Flow

### Write Operation

1. User makes request → Server identifies user
2. Module calls `updateUserSession()`
3. PotoModule updates session data
4. Session provider writes to storage (Redis/Memory/DB)

### Read Operation

1. Module calls `getUserSession()`
2. PotoModule checks session provider
3. Session provider reads from storage
4. Session data returned to module

### Cross-Instance Consistency

With Redis (or similar):
```
User → Server 1 → Redis (write: model = llm2)
User → Server 2 → Redis (read: model = llm2) ✓
```

Session changes are immediately visible across all instances.

## Extension Examples

### Adding Custom Session Fields

```typescript
// In your module
interface MySessionData extends LLMSessionData {
    customField: string;
    anotherField: number;
}

class MyModule extends LLMPotoModule {
    protected createDefaultSessionData(userId: string): MySessionData {
        return {
            ...super.createDefaultSessionData(userId),
            customField: "default",
            anotherField: 0
        };
    }

    async myMethod() {
        const session = await this.getUserSession() as MySessionData;
        console.log(session.customField);
    }
}
```

### Implementing Database Session Provider

```typescript
class PostgresSessionProvider implements UserSessionProvider {
    constructor(private pool: Pool) {}

    async getSession(userId: string): Promise<UserSessionData | null> {
        const result = await this.pool.query(
            'SELECT data FROM sessions WHERE user_id = $1',
            [userId]
        );
        return result.rows[0]?.data || null;
    }

    async setSession(userId: string, data: UserSessionData): Promise<void> {
        await this.pool.query(
            `INSERT INTO sessions (user_id, data, updated_at) 
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) 
             DO UPDATE SET data = $2, updated_at = NOW()`,
            [userId, JSON.stringify(data)]
        );
    }

    // ... other methods
}
```

## Best Practices

### 1. Choose Right Provider

- **Development**: `InMemorySessionProvider` (default)
- **Single instance**: `InMemorySessionProvider`
- **Multiple instances**: `RedisSessionProvider`
- **Heavy persistence needs**: Custom database provider

### 2. Session Cleanup

```typescript
// Schedule cleanup (for any provider)
setInterval(async () => {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cleaned = await sessionProvider.cleanupOldSessions(maxAge);
    console.log(`Cleaned ${cleaned} old sessions`);
}, 60 * 60 * 1000); // Every hour
```

### 3. Monitoring

```typescript
// Monitor session stats
setInterval(async () => {
    const stats = await module.getSessionStats();
    console.log(`Active sessions: ${stats.activeSessions}`);
    metrics.gauge('sessions.active', stats.activeSessions);
}, 60 * 1000); // Every minute
```

### 4. Error Handling

```typescript
try {
    await this.updateUserSession((session) => {
        session.field = value;
    });
} catch (error) {
    logger.error('Session update failed:', error);
    // Handle gracefully - maybe use default values
}
```

## Migration Guide

### From In-Memory to Redis

1. **Install Redis client**:
   ```bash
   npm install redis
   ```

2. **Implement RedisSessionProvider**:
   ```typescript
   // See UserSessionProvider.ts for structure
   ```

3. **Update startup code**:
   ```typescript
   PotoModule.setSessionProvider(
       new RedisSessionProvider(redisUrl)
   );
   ```

4. **Deploy**: Sessions will automatically use Redis

### Zero-Downtime Migration

1. Deploy with Redis provider
2. Old sessions in memory expire naturally
3. New sessions use Redis
4. No data migration needed (stateless design)

## Summary

- **Pluggable architecture**: Easy to swap implementations
- **Scalable**: Supports single and multi-instance deployments
- **Flexible**: Can use memory, Redis, database, or custom
- **Simple API**: Modules don't worry about storage details
- **Production-ready**: Designed for horizontal scaling
