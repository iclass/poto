# Using Poto as an External Package

This guide explains how to properly use Poto when it's distributed as an npm package and consumed by external applications.

## Key Concepts

### Runtime vs Compile-time Exports

When Poto is used as an external package, there are two types of exports:

1. **Runtime exports**: Classes, functions, and constants that exist in the compiled JavaScript
2. **Type-only exports**: TypeScript interfaces and types that only exist during compilation

## Importing Runtime Values

Use regular `import` statements for classes, functions, and constants:

```typescript
import { 
    PotoServer, 
    PotoClient, 
    PotoModule,
    InMemorySessionProvider,
    RedisSessionProvider,
    PotoUser,
    DialogRoles
} from 'poto';
```

## Importing Types and Interfaces

Use `import type` for TypeScript interfaces and types:

```typescript
import type {
    UserSessionProvider,
    UserSessionData,
    UserProvider,
    DialogEntry,
    DialogRole,
    OpenAIContentBlock,
    JSONSchema,
    LLMSessionData
} from 'poto';
```

## Why This Matters

### The Problem
If you try to import interfaces with regular `import` statements:

```typescript
// ❌ WRONG - This will cause runtime errors
import { UserSessionProvider } from 'poto';
```

You'll get errors like:
```
SyntaxError: export 'UserSessionProvider' not found in './server/UserSessionProvider'
```

### The Solution
Use `import type` for interfaces and types:

```typescript
// ✅ CORRECT - This works for TypeScript type checking
import type { UserSessionProvider } from 'poto';
```

## Practical Examples

### Creating a Custom Session Provider

```typescript
import type { UserSessionProvider, UserSessionData } from 'poto';
import { InMemorySessionProvider } from 'poto';

export class CustomSessionProvider implements UserSessionProvider {
    private sessions: Map<string, UserSessionData> = new Map();
    
    async getSession(userId: string): Promise<UserSessionData | null> {
        return this.sessions.get(userId) || null;
    }
    
    // ... implement other interface methods
}
```

### Working with Dialog Types

```typescript
import type { DialogEntry, DialogRole } from 'poto';

function createMessage(role: DialogRole, content: string): DialogEntry {
    return { role, content };
}
```

### Using JSON Schema Types

```typescript
import type { JSONSchema } from 'poto';

const userSchema: JSONSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        name: { type: 'string' }
    },
    required: ['id', 'name']
};
```

## Available Exports

### Runtime Exports (use regular `import`)
- `PotoServer` - Main server class
- `PotoClient` - Client for connecting to server
- `PotoModule` - Base class for creating modules
- `InMemorySessionProvider` - In-memory session storage
- `RedisSessionProvider` - Redis session storage
- `PotoUser` - User class
- `DialogRoles` - Array of valid dialog roles
- `JsonSchemaFormat` - JSON Schema validation class
- `PotoConstants` - Framework constants
- `BunCookieSessionProvider` - Cookie-based session provider

### Type-Only Exports (use `import type`)
- `UserSessionProvider` - Interface for session providers
- `UserSessionData` - Session data structure
- `UserProvider` - Interface for user providers
- `DialogEntry` - Dialog message structure
- `DialogRole` - Valid dialog roles
- `OpenAIContentBlock` - OpenAI content block structure
- `JSONSchema` - JSON Schema type definition
- `LLMSessionData` - LLM session data structure

## Best Practices

1. **Always use `import type` for interfaces and types**
2. **Use regular `import` for classes, functions, and constants**
3. **Check the TypeScript compiler output** - if something isn't in the compiled `.js` file, it's a type-only export
4. **Use your IDE's autocomplete** - it will show you which exports are available and their types

## Troubleshooting

### "Export not found" errors
If you get errors like `export 'SomeInterface' not found`, you're probably trying to import an interface with a regular `import` statement. Use `import type` instead.

### Type checking issues
Make sure you're importing the correct types. Use your IDE's "Go to Definition" feature to see what's available in each module.

### Runtime vs Compile-time
Remember: interfaces and types only exist during TypeScript compilation. They don't exist in the compiled JavaScript, so they can't be imported at runtime.
