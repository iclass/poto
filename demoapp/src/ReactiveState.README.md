# ReactiveState - Framework-Agnostic Reactive State Management

## 📦 Architecture

ReactiveState is now split into **framework-agnostic core** and **framework-specific adapters**:

```
ReactiveState/
├── ReactiveState.core.ts          ← Framework-agnostic (pure TypeScript)
├── ReactiveState.react.ts         ← React adapter (hooks, components)
├── ReactiveState.ts               ← Unified exports (backward compatible)
└── ReactiveState.vanilla.example.ts ← Usage examples
```

## ✨ Key Benefits

### 1. **Zero Dependencies in Core**
The core `ReactiveState` class has **no React dependency**. It's pure TypeScript using only native JavaScript features:
- Proxy API for reactivity
- Set/Map for subscribers
- setTimeout for debouncing
- No external dependencies!

### 2. **Use Anywhere**
```typescript
// ✅ React
import { makeReactiveState } from './ReactiveState';

// ✅ Vanilla TypeScript/JavaScript
import { ReactiveState } from './ReactiveState.core';

// ✅ Node.js Backend
import { ReactiveState } from './ReactiveState.core';

// ✅ Vue/Svelte/Angular (create your adapter)
import { ReactiveState } from './ReactiveState.core';
```

### 3. **Smaller Bundles**
Import only what you need:
```typescript
// React projects: ~15KB (includes React hooks)
import { makeReactiveState } from './ReactiveState.react';

// Vanilla projects: ~5KB (core only, no React)
import { ReactiveState } from './ReactiveState.core';
```

### 4. **Better Testing**
Test core logic without React infrastructure:
```typescript
import { ReactiveState } from './ReactiveState.core';

// Pure unit tests, no React testing library needed!
const state = new ReactiveState({ count: 0 });
state.getState().count++;
```

## 📚 Usage Examples

### React (Existing Code Works!)
```typescript
import { makeReactiveState } from './ReactiveState';

function MyComponent() {
  const $ = makeReactiveState({ count: 0 })
    .$initialize(() => {
      $.count = loadFromStorage();
    })
    .$withWatch({
      count: (c) => saveToStorage(c)
    })
    .$onUnmount(() => cleanup());
  
  return <button onClick={() => $.count++}>{$.count}</button>;
}
```

### Vanilla TypeScript
```typescript
import { ReactiveState } from './ReactiveState.core';

const counter = new ReactiveState({ count: 0 });
const state = counter.getState();

// Subscribe to changes
counter.subscribe(() => {
  console.log(`Count: ${state.count}`);
  updateDOM();
});

// Make changes
state.count++; // Automatically triggers subscriber
```

### Node.js Backend
```typescript
import { ReactiveState } from './ReactiveState.core';

const serverState = new ReactiveState({
  connections: 0,
  activeUsers: [],
  
  get hasActiveUsers() {
    return this.activeUsers.length > 0;
  }
});

const state = serverState.getState();

serverState.subscribe(() => {
  console.log(`📊 ${state.connections} connections`);
  if (state.connections > 1000) {
    sendAlert('High load!');
  }
});

// Handle events
state.connections++;
state.activeUsers.push('user1');
```

## 🎯 When to Use Each Module

### Use `ReactiveState.core.ts` when:
- ✅ Building vanilla TypeScript/JavaScript apps
- ✅ Node.js backend state management
- ✅ Creating adapters for Vue/Svelte/Angular
- ✅ Testing core logic without React
- ✅ You want zero dependencies

### Use `ReactiveState.react.ts` when:
- ✅ Building React applications
- ✅ You need hooks (`makeReactiveState`, `useReactiveState`)
- ✅ Using React class components
- ✅ You want React lifecycle integration

### Use `ReactiveState.ts` (barrel export) when:
- ✅ You want backward compatibility
- ✅ Migrating existing code (no changes needed!)
- ✅ You don't care about tree-shaking

## 🔧 API Reference

### Core API (`ReactiveState.core.ts`)

```typescript
class ReactiveState<T> {
  constructor(initialState: T)
  
  // Subscribe to all changes
  subscribe(listener: () => void): () => void
  
  // Get the reactive proxy
  getState(): T
  
  // Performance optimizations
  batch(updates: () => void): void
  setDebounce(delayMs: number): void
  flush(): void
  
  // Property watchers
  watch<K>(watchMap: {...}): Record<K, () => void>
}
```

### React API (`ReactiveState.react.ts`)

```typescript
// Function components (with hooks)
function makeReactiveState<T>(initialState: T | (() => T)): T & StateControls<T>
function useReactiveState<T>(initialState: T): T & StateControls<T>

// Class components (no hooks)
function makeReactiveStateForClass<T>(initialState: T): T & { _subscribe, _cleanup }

// Base class
class ReactiveComponent<P, S> extends Component<P, S> {
  // All properties become reactive automatically!
}

// Control methods (added to state)
type StateControls<T> = {
  $batch: (updates: () => void) => void
  $setDebounce: (delayMs: number) => void
  $flush: () => void
  $watch: <K>(watchMap: {...}) => Record<K, () => void>
  $withWatch: <K>(watchMap: {...}) => T & StateControls<T>
  $onUnmount: (cleanup: () => void) => T & StateControls<T>
  $initialize: (initializer: () => void) => T & StateControls<T>
}
```

## 🚀 Migration Guide

### From Old ReactiveState to New

**No changes needed!** The unified export maintains backward compatibility:

```typescript
// This still works exactly as before:
import { makeReactiveState } from './ReactiveState';

const $ = makeReactiveState({ count: 0 });
```

### To Framework-Agnostic Core

If you want to use in vanilla TypeScript:

```typescript
// Change from:
import { makeReactiveState } from './ReactiveState';

// To:
import { ReactiveState } from './ReactiveState.core';

// Then use directly:
const manager = new ReactiveState({ count: 0 });
const state = manager.getState();
```

## 🎨 Creating Custom Adapters

Want to use with Vue/Svelte/Angular? Create your own adapter:

```typescript
// ReactiveState.vue.ts
import { ref, onUnmounted, watchEffect } from 'vue';
import { ReactiveState } from './ReactiveState.core';

export function useReactiveState<T>(initialState: T) {
  const manager = new ReactiveState(initialState);
  const state = manager.getState();
  const trigger = ref(0);
  
  const unsubscribe = manager.subscribe(() => {
    trigger.value++; // Trigger Vue reactivity
  });
  
  onUnmounted(() => unsubscribe());
  
  return state;
}
```

## 📖 See Also

- `ReactiveState.vanilla.example.ts` - Complete vanilla usage examples
- `ReactiveState.core.ts` - Core implementation
- `ReactiveState.react.ts` - React adapter implementation

## 💡 Industry Pattern

This architecture matches how popular libraries are structured:

- **MobX**: `mobx` (core) + `mobx-react`
- **Zustand**: vanilla store + React hooks
- **Valtio**: `valtio` (core) + `valtio/react`
- **Jotai**: atoms (core) + React hooks

Now you can use ReactiveState anywhere! 🎉

