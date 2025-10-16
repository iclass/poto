# ReactiveState JSX - Real TSX Without React! 🎉

**Use REAL JSX/TSX syntax (`<div>...</div>`) without any React dependency!**

---

## 🎯 The Problem

You want to write this:

```tsx
const element = <div class="app">Hello {name}</div>;
```

But this requires React, right? **WRONG!** ✨

---

## ✅ The Solution

ReactiveState provides a **custom JSX factory** that lets you use **real JSX syntax** without React!

### Real JSX Example (No React!):

```tsx
/** @jsxImportSource ./ReactiveState.jsx */

import { createReactiveComponent } from './ReactiveState.jsx';

export const Counter = createReactiveComponent({
    state: { count: 0 },
    
    // ✨ REAL JSX - Not template literals!
    render: (state) => (
        <div class="counter">
            <p>Count: {state.count}</p>
            <button onclick={() => state.count++}>
                Increment
            </button>
        </div>
    )
});

// Mount it
Counter.mount('#app');
```

**This is REAL JSX:**
- ✅ `<div>...</div>` syntax
- ✅ Zero React dependency
- ✅ Reactive state updates
- ✅ ~8KB bundle size

---

## 🚀 Quick Start

### Step 1: Add JSX Pragma

At the **top of your `.tsx` file**, add:

```tsx
/** @jsxImportSource ./ReactiveState.jsx */
```

This tells TypeScript to use our custom JSX factory instead of React.

### Step 2: Import JSX Helpers

```tsx
import { createReactiveComponent, mount } from './ReactiveState.jsx';
```

### Step 3: Write Real JSX!

```tsx
export const MyComponent = createReactiveComponent({
    state: {
        name: 'World'
    },
    
    render: (state) => (
        <div>
            <h1>Hello {state.name}!</h1>
            <button onclick={() => state.name = 'React-free World'}>
                Click me
            </button>
        </div>
    )
});
```

### Step 4: Mount & Enjoy

```tsx
MyComponent.mount('#app');
```

**That's it! Real JSX without React!** ✨

---

## 📚 API Reference

### `createReactiveComponent<T>(options)`

Create a reactive component with JSX rendering.

```tsx
const MyComponent = createReactiveComponent({
    // Initial state
    state: {
        count: 0,
        
        // Computed values
        get doubled() {
            return this.count * 2;
        }
    },
    
    // Render function (returns JSX!)
    render: (state) => (
        <div>
            <p>Count: {state.count}</p>
            <p>Doubled: {state.doubled}</p>
        </div>
    ),
    
    // Optional: lifecycle hooks
    onMount: (container, state) => {
        console.log('Component mounted!');
    },
    
    onUnmount: () => {
        console.log('Component unmounted!');
    },
    
    // Optional: debounce rapid updates
    debounce: 50
});

// Mount to DOM
const instance = MyComponent.mount('#app');

// Access state
console.log(instance.state.count);

// Manual update
instance.update();

// Cleanup
instance.unmount();
```

### `mount(jsx, container)`

Mount a JSX element directly to DOM:

```tsx
const element = (
    <div>
        <h1>Hello World!</h1>
    </div>
);

mount(element, '#app');
// or
mount(element, document.getElementById('app'));
```

### JSX Helpers

#### `$class(classMap)`

Dynamic class binding:

```tsx
<div class={$class({ 
    active: state.isActive,
    disabled: !state.enabled,
    'large-text': state.size === 'large'
})} />

// Renders: class="active large-text" (if conditions are true)
```

#### `$if(condition, thenFn, elseFn?)`

Conditional rendering:

```tsx
{$if(
    state.isLoggedIn,
    () => <div>Welcome back!</div>,
    () => <div>Please log in</div>
)}
```

#### `$list(items, renderFn)`

List rendering:

```tsx
<ul>
    {$list(state.todos, (todo, index) => (
        <li key={todo.id}>
            {index + 1}. {todo.text}
        </li>
    ))}
</ul>
```

#### `$style(styleMap)`

Dynamic styles:

```tsx
<div style={$style({
    color: state.color,
    display: state.visible ? 'block' : 'none',
    fontSize: `${state.size}px`
})} />
```

---

## 🎨 Complete Examples

### Example 1: Counter

```tsx
/** @jsxImportSource ./ReactiveState.jsx */

import { createReactiveComponent } from './ReactiveState.jsx';

export const Counter = createReactiveComponent({
    state: { count: 0 },
    
    render: (state) => (
        <div class="counter">
            <h2>Counter</h2>
            <p>Count: <strong>{state.count}</strong></p>
            <button onclick={() => state.count--}>-</button>
            <button onclick={() => state.count++}>+</button>
        </div>
    )
});

Counter.mount('#app');
```

### Example 2: Todo List with Filters

```tsx
/** @jsxImportSource ./ReactiveState.jsx */

import { createReactiveComponent, $class, $list, $if } from './ReactiveState.jsx';

interface Todo {
    id: number;
    text: string;
    done: boolean;
}

export const TodoList = createReactiveComponent<{
    newTodo: string;
    todos: Todo[];
    filter: 'all' | 'active' | 'completed';
    filteredTodos: Todo[];
}>({
    state: {
        newTodo: '',
        todos: [],
        filter: 'all',
        
        get filteredTodos() {
            if (this.filter === 'active') return this.todos.filter(t => !t.done);
            if (this.filter === 'completed') return this.todos.filter(t => t.done);
            return this.todos;
        }
    },
    
    render: (state) => (
        <div class="todo-app">
            <h2>Todo List</h2>
            
            {/* Input */}
            <input 
                type="text"
                value={state.newTodo}
                oninput={(e: Event) => {
                    state.newTodo = (e.target as HTMLInputElement).value;
                }}
                onkeypress={(e: KeyboardEvent) => {
                    if (e.key === 'Enter' && state.newTodo.trim()) {
                        state.todos.push({
                            id: Date.now(),
                            text: state.newTodo,
                            done: false
                        });
                        state.newTodo = '';
                    }
                }}
                placeholder="What needs to be done?"
            />
            
            {/* Filters */}
            <div class="filters">
                <button 
                    class={$class({ active: state.filter === 'all' })}
                    onclick={() => state.filter = 'all'}
                >
                    All
                </button>
                <button 
                    class={$class({ active: state.filter === 'active' })}
                    onclick={() => state.filter = 'active'}
                >
                    Active
                </button>
                <button 
                    class={$class({ active: state.filter === 'completed' })}
                    onclick={() => state.filter = 'completed'}
                >
                    Completed
                </button>
            </div>
            
            {/* Todo list */}
            <ul>
                {$list(state.filteredTodos, (todo) => (
                    <li key={todo.id} class={$class({ done: todo.done })}>
                        <input 
                            type="checkbox"
                            checked={todo.done}
                            onchange={() => todo.done = !todo.done}
                        />
                        <span>{todo.text}</span>
                        <button onclick={() => {
                            state.todos = state.todos.filter(t => t.id !== todo.id);
                        }}>
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
});
```

### Example 3: Form with Validation

```tsx
/** @jsxImportSource ./ReactiveState.jsx */

import { createReactiveComponent, $class, $if } from './ReactiveState.jsx';

export const LoginForm = createReactiveComponent({
    state: {
        username: '',
        password: '',
        submitted: false,
        
        get isValid() {
            return this.username.length >= 3 && this.password.length >= 6;
        },
        
        get errors() {
            if (!this.submitted) return [];
            const errs = [];
            if (this.username.length < 3) errs.push('Username too short');
            if (this.password.length < 6) errs.push('Password too short');
            return errs;
        }
    },
    
    render: (state) => (
        <form onsubmit={(e: Event) => {
            e.preventDefault();
            state.submitted = true;
            if (state.isValid) {
                alert('Logged in!');
            }
        }}>
            <h2>Login</h2>
            
            <input 
                type="text"
                value={state.username}
                oninput={(e: Event) => {
                    state.username = (e.target as HTMLInputElement).value;
                }}
                placeholder="Username"
                class={$class({ error: state.submitted && state.username.length < 3 })}
            />
            
            <input 
                type="password"
                value={state.password}
                oninput={(e: Event) => {
                    state.password = (e.target as HTMLInputElement).value;
                }}
                placeholder="Password"
                class={$class({ error: state.submitted && state.password.length < 6 })}
            />
            
            {$if(
                state.errors.length > 0,
                () => (
                    <ul class="errors">
                        {$list(state.errors, (error) => (
                            <li key={error}>{error}</li>
                        ))}
                    </ul>
                )
            )}
            
            <button type="submit" disabled={state.submitted && !state.isValid}>
                Login
            </button>
        </form>
    )
});
```

---

## ⚙️ Configuration

### Per-File Configuration (Recommended)

Add to the **top of each `.tsx` file**:

```tsx
/** @jsxImportSource ./ReactiveState.jsx */
```

### Project-Wide Configuration

Create `tsconfig.jsx.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "./src/ReactiveState.jsx",
    // ... other options
  }
}
```

Compile with:

```bash
tsc --project tsconfig.jsx.json
```

---

## 🆚 Comparison: Template Literals vs Real JSX

### ❌ Template Literals (Not JSX):

```tsx
// This is a STRING, not JSX
const html = `
    <div class="app">
        <p>Count: ${count}</p>
    </div>
`;

// Must manually inject into DOM
element.innerHTML = html;
```

**Problems:**
- Not type-safe
- No JSX syntax
- Manual DOM manipulation
- No component abstraction

### ✅ Real JSX with ReactiveState:

```tsx
/** @jsxImportSource ./ReactiveState.jsx */

// This is REAL JSX (VNode tree)
const element = (
    <div class="app">
        <p>Count: {count}</p>
    </div>
);

// Auto-rendered and type-safe
mount(element, '#app');
```

**Benefits:**
- ✅ Type-safe
- ✅ Real JSX syntax
- ✅ Auto DOM rendering
- ✅ Component abstraction
- ✅ Zero React dependency

---

## 📦 How It Works

### 1. JSX Transpilation

TypeScript transpiles JSX to function calls:

```tsx
// Your code:
<div class="app">Hello</div>

// Transpiled to:
jsx('div', { class: 'app' }, 'Hello')
```

### 2. Custom JSX Factory

Our `jsx()` function creates Virtual Nodes:

```typescript
export function jsx(type, props, ...children) {
    return { type, props, children };
}
```

### 3. Render to DOM

Our `render()` function converts VNodes to real DOM:

```typescript
export function render(vnode) {
    const element = document.createElement(vnode.type);
    // ... set props, append children
    return element;
}
```

### 4. Reactive Updates

State changes trigger re-renders:

```typescript
state.count++; // → triggers render() → updates DOM
```

---

## 🎯 Use Cases

### Perfect For:

- ✅ **React-like** development without React
- ✅ **Progressive enhancement** of existing sites
- ✅ **Lightweight SPAs** without framework overhead
- ✅ **Prototyping** with familiar JSX syntax
- ✅ **Learning** reactive patterns
- ✅ **Small projects** where React is overkill

### Not Ideal For:

- ❌ Large SPAs with complex routing (use React/Vue)
- ❌ SSR-heavy applications
- ❌ Projects already using React

---

## 📊 Bundle Size

```
ReactiveState JSX:
  • ReactiveState.core: ~5KB
  • ReactiveState.jsx: ~4KB
  • Total: ~9KB

React:
  • React: ~45KB
  • React-DOM: ~130KB
  • Total: ~175KB

Savings: 95% smaller! 🎉
```

---

## ✨ Key Differences from React

| Feature | ReactiveState JSX | React JSX |
|---------|------------------|-----------|
| **Syntax** | Same JSX | Same JSX |
| **Dependency** | None | React required |
| **Bundle Size** | ~9KB | ~175KB |
| **Virtual DOM** | Simple VNode | Full Virtual DOM |
| **Hooks** | Not needed | useState, useEffect, etc. |
| **Re-rendering** | Full component | Reconciliation |
| **Learning Curve** | Minimal | Moderate |

---

## 🎉 Summary

**Question:** How to use TSX/JSX syntax without React dependency?

**Answer:** Use ReactiveState JSX! ✅

### What You Get:

1. ✅ **Real JSX syntax** - `<div>...</div>`, not template literals
2. ✅ **Zero React dependency** - Pure TypeScript
3. ✅ **Tiny bundle** - ~9KB total
4. ✅ **Reactive updates** - Auto DOM updates
5. ✅ **Type-safe** - Full TypeScript support
6. ✅ **Easy to use** - Familiar JSX patterns

### How to Start:

```tsx
/** @jsxImportSource ./ReactiveState.jsx */

import { createReactiveComponent } from './ReactiveState.jsx';

const App = createReactiveComponent({
    state: { message: 'Hello JSX without React!' },
    render: (s) => <div>{s.message}</div>
});

App.mount('#app');
```

**See `ReactiveJSX.demo.tsx` for complete examples!** 🚀

---

## 📁 Files

- `ReactiveState.jsx.ts` - JSX factory implementation
- `ReactiveJSX.demo.tsx` - Complete working examples
- `jsx-demo.html` - Live demo page
- `tsconfig.jsx.json` - TypeScript configuration
- `ReactiveState.JSX.README.md` - This documentation

**Start building with real JSX today - no React required!** 🎯

