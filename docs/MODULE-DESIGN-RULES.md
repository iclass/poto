# PotoModule Design Rules for Concurrent Safety

## Critical Rule: NO MUTABLE INSTANCE STATE

### ❌ **NEVER DO THIS**

```typescript
export class BadModule extends PotoModule {
    private requestCounter = 0;  // ❌ RACE CONDITION!
    private activeRequests = new Map<string, any>();  // ❌ SHARED STATE!
    
    async myMethod_() {
        const requestId = `req_${++this.requestCounter}`;  // ❌ NOT ATOMIC!
        this.activeRequests.set(requestId, {});  // ❌ CONCURRENT MUTATION!
    }
}
```

**Why this fails:**
- Module instances are shared across ALL concurrent requests
- `++this.requestCounter` is a read-modify-write (NOT atomic)
- Multiple requests can read the same value before any writes
- `Map` mutations without synchronization cause race conditions

**Under concurrent load:**
```
Request A: reads counter=5
Request B: reads counter=5  ← Both read same value!
Request A: writes counter=6
Request B: writes counter=6  ← Overwrites A's write!
Both get: req_6             ← COLLISION!
```

---

## ✅ **CORRECT PATTERNS**

### Pattern 1: Use AsyncLocalStorage Context

```typescript
export class GoodModule extends PotoModule {
    async myMethod_() {
        // ✅ Get user from AsyncLocalStorage context (isolated per request)
        const user = this.getCurrentUser();
        
        // ✅ Each request has its own isolated context
        return `User: ${user?.id}`;
    }
}
```

### Pattern 2: Use Session Storage (Request-Scoped)

```typescript
export class GoodModule extends PotoModule {
    async myMethod_() {
        // ✅ Session storage is request-scoped via AsyncLocalStorage
        await this.setSessionValue('key', 'value');
        const value = await this.getSessionValue('key');
        
        return value;
    }
}
```

### Pattern 3: Generate Atomic IDs

```typescript
export class GoodModule extends PotoModule {
    async myMethod_() {
        // ✅ Use timestamp + random for unique IDs (atomic)
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        
        return requestId;
    }
}
```

### Pattern 4: Use Immutable Instance State

```typescript
export class GoodModule extends PotoModule {
    // ✅ Immutable configuration is safe
    private readonly MAX_RETRIES = 3;
    private readonly TIMEOUT_MS = 5000;
    
    async myMethod_() {
        // Safe to read immutable values
        for (let i = 0; i < this.MAX_RETRIES; i++) {
            // ...
        }
    }
}
```

---

## 🔍 **How to Detect Violations**

### Red Flags:
1. ❌ `private counter = 0` - mutable number
2. ❌ `private map = new Map()` - mutable collection
3. ❌ `++this.anything` - increment operation
4. ❌ `this.array.push()` - array mutation
5. ❌ `this.object.property = value` - object mutation

### Safe Patterns:
1. ✅ `private readonly CONFIG = {...}` - immutable config
2. ✅ `const user = this.getCurrentUser()` - context access
3. ✅ `await this.setSessionValue()` - session storage
4. ✅ Local variables in method scope - request-scoped
5. ✅ `Date.now()` or `Math.random()` - atomic operations

---

## 🧪 **Testing for Concurrency Safety**

### Good Test Pattern:
```typescript
it("should handle 100 concurrent requests", async () => {
    const promises = Array.from({ length: 100 }, () => 
        proxy.myMethod_()
    );
    
    const results = await Promise.all(promises);
    
    // Verify no collisions or race conditions
    const unique = new Set(results);
    expect(unique.size).toBe(100);  // All unique
});
```

### What to Test:
- ✅ ID uniqueness under concurrent load
- ✅ User isolation across concurrent clients
- ✅ Session isolation across concurrent requests
- ✅ No data leaks between requests

---

## 📊 **Real-World Example**

### Before (Buggy):
```typescript
export class ChatModule extends PotoModule {
    private messageCounter = 0;  // ❌ RACE CONDITION!
    
    async sendMessage_(text: string) {
        const msgId = ++this.messageCounter;  // ❌ NOT ATOMIC!
        return { id: msgId, text };
    }
}

// Under load: Multiple messages get same ID!
```

### After (Fixed):
```typescript
export class ChatModule extends PotoModule {
    async sendMessage_(text: string) {
        // ✅ Atomic ID generation
        const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        
        // ✅ Use session to track user's messages
        await this.setSessionValue('lastMessageId', msgId);
        
        return { id: msgId, text };
    }
}

// Under load: All messages get unique IDs ✅
```

---

## 🚀 **Production Checklist**

Before deploying a PotoModule:

- [ ] No mutable instance variables
- [ ] No `++`, `--`, or compound assignments on instance state
- [ ] No `.push()`, `.set()`, `.delete()` on instance collections
- [ ] User context accessed via `getCurrentUser()` only
- [ ] Session data stored via `setSessionValue()` / `getSessionValue()`
- [ ] Concurrent safety tested with 100+ simultaneous requests
- [ ] ID generation uses atomic methods (timestamp + random)

---

## 📚 **Reference Implementation**

See `tests/e2e/TestGeneratorModule.ts` for a production-ready module with:
- ✅ Zero mutable instance state
- ✅ 100% concurrent safety
- ✅ Proper context isolation
- ✅ Tested with 100+ concurrent requests

**Anti-Pattern Reference:**
See `tests/e2e/ContextIsolationTestModule.ts` (lines 8-9) for what NOT to do:
```typescript
private requestCounter = 0;  // ❌ DON'T DO THIS
private activeRequests = new Map();  // ❌ DON'T DO THIS
```

---

## 🎯 **Summary**

**Golden Rule**: **PotoModule instances are SHARED** across all concurrent requests.  
**Never** store mutable state in instance variables.  
**Always** use AsyncLocalStorage context or session storage for request-specific data.

Following these rules ensures your application is **100% concurrent-safe** and **production-ready**.

