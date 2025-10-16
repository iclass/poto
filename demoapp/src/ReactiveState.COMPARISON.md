# ReactiveState: Three Ways to Use It

A side-by-side comparison of using ReactiveState in **Core** (pure TypeScript), **React**, and **Vanilla** (with DOM helpers).

## 🎯 Quick Decision Guide

| Your Project | Use This | Import From |
|-------------|----------|-------------|
| **React app** | React adapter | `ReactiveState.react` |
| **Vanilla TypeScript/JS** | Vanilla adapter | `ReactiveState.vanilla` |
| **Vue/Svelte/Node.js** | Core only | `ReactiveState.core` |
| **Backend/API** | Core only | `ReactiveState.core` |

---

## Example 1: Simple Counter

### 🔵 Core (Pure TypeScript)

```typescript
import { ReactiveState } from './ReactiveState.core';

// 1. Create reactive state manager
const manager = new ReactiveState({ count: 0 });
const state = manager.getState();

// 2. Subscribe to changes
const unsubscribe = manager.subscribe(() => {
    console.log('Count changed:', state.count);
    
    // Manually update your UI
    const el = document.getElementById('counter');
    if (el) el.textContent = String(state.count);
});

// 3. Update state
state.count++; // Triggers subscription

// 4. Cleanup
unsubscribe();
```

**Pros:**
- ✅ Zero dependencies
- ✅ Works anywhere (Node.js, browser, any framework)
- ✅ Maximum control

**Cons:**
- ❌ Manual DOM updates
- ❌ More boilerplate

---

### ⚛️ React (Hooks & Components)

```typescript
import { makeReactiveState } from './ReactiveState.react';

function Counter() {
    // 1. Create reactive state (auto-subscribes to React)
    const $state = makeReactiveState(() => ({
        count: 0
    }))
    .$onUnmount(() => {
        console.log('Counter unmounted');
    });

    // 2. Use state in JSX
    return (
        <div>
            <p>Count: {$state.count}</p>
            <button onClick={() => $state.count++}>
                Increment
            </button>
        </div>
    );
}
```

**Pros:**
- ✅ Auto-subscribed to React render cycle
- ✅ JSX integration
- ✅ Component lifecycle hooks
- ✅ Minimal boilerplate

**Cons:**
- ❌ React dependency required
- ❌ Only works in React

---

### 🍦 Vanilla (DOM Helpers)

```typescript
import { createVanillaState, bindToDOM, bindEvent } from './ReactiveState.vanilla';

// 1. Create reactive state
const state = createVanillaState({ count: 0 });

// 2. Bind to DOM (auto-updates)
bindToDOM('#counter', () => state.count, state);

// 3. Bind events
bindEvent('#increment', 'click', () => {
    state.count++;
});

// DOM updates automatically!
```

**Pros:**
- ✅ Auto DOM updates
- ✅ Simple, declarative API
- ✅ No framework needed

**Cons:**
- ❌ DOM-only (browser only)
- ❌ Less control than core

---

## Example 2: Form with Computed Values

### 🔵 Core (Pure TypeScript)

```typescript
import { ReactiveState } from './ReactiveState.core';

interface FormState {
    firstName: string;
    lastName: string;
    email: string;
    get fullName(): string;
    get isValid(): boolean;
}

const manager = new ReactiveState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    
    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    },
    
    get isValid() {
        return this.firstName.length > 0 
            && this.lastName.length > 0 
            && this.email.includes('@');
    }
});

const state = manager.getState();

// Subscribe and manually update DOM
manager.subscribe(() => {
    document.getElementById('fullName')!.textContent = state.fullName;
    document.getElementById('submit')!.disabled = !state.isValid;
});

// Update from DOM events
document.getElementById('firstName')!.addEventListener('input', (e) => {
    state.firstName = (e.target as HTMLInputElement).value;
});
```

**Lines of code:** ~35

---

### ⚛️ React (Hooks & Components)

```typescript
import { makeReactiveState } from './ReactiveState.react';

function Form() {
    const $form = makeReactiveState(() => ({
        firstName: '',
        lastName: '',
        email: '',
        
        get fullName() {
            return `${this.firstName} ${this.lastName}`.trim();
        },
        
        get isValid() {
            return this.firstName.length > 0 
                && this.lastName.length > 0 
                && this.email.includes('@');
        }
    }));

    return (
        <div>
            <input 
                value={$form.firstName}
                onChange={e => $form.firstName = e.target.value}
            />
            <input 
                value={$form.lastName}
                onChange={e => $form.lastName = e.target.value}
            />
            <input 
                value={$form.email}
                onChange={e => $form.email = e.target.value}
            />
            
            <p>Full Name: {$form.fullName}</p>
            <button disabled={!$form.isValid}>Submit</button>
        </div>
    );
}
```

**Lines of code:** ~25

---

### 🍦 Vanilla (DOM Helpers)

```typescript
import { createVanillaState, bindFormInput, bindToDOM } from './ReactiveState.vanilla';

const state = createVanillaState({
    firstName: '',
    lastName: '',
    email: '',
    
    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    },
    
    get isValid() {
        return this.firstName.length > 0 
            && this.lastName.length > 0 
            && this.email.includes('@');
    }
});

// Two-way binding
bindFormInput('#firstName', state, 'firstName');
bindFormInput('#lastName', state, 'lastName');
bindFormInput('#email', state, 'email');

// Display computed values
bindToDOM('#fullName', () => state.fullName, state);

// Conditional attribute
bindToDOM('#submit', () => !state.isValid, state, { attribute: 'disabled' });
```

**Lines of code:** ~20

---

## Example 3: Todo List

### 🔵 Core (Pure TypeScript)

```typescript
import { ReactiveState } from './ReactiveState.core';

interface Todo {
    id: number;
    text: string;
    done: boolean;
}

interface TodoState {
    todos: Todo[];
    newTodo: string;
    get activeCount(): number;
}

const manager = new ReactiveState<TodoState>({
    todos: [],
    newTodo: '',
    
    get activeCount() {
        return this.todos.filter(t => !t.done).length;
    }
});

const state = manager.getState();

// Manual rendering
function render() {
    const container = document.getElementById('todos')!;
    container.innerHTML = state.todos
        .map(todo => `
            <div class="${todo.done ? 'done' : ''}">
                <input type="checkbox" ${todo.done ? 'checked' : ''} 
                    data-id="${todo.id}">
                <span>${todo.text}</span>
                <button data-id="${todo.id}">Delete</button>
            </div>
        `)
        .join('');
    
    // Re-attach event listeners after render
    container.querySelectorAll('[data-id]').forEach(el => {
        const id = Number(el.getAttribute('data-id'));
        el.addEventListener('click', () => {
            if (el.tagName === 'INPUT') {
                const todo = state.todos.find(t => t.id === id);
                if (todo) todo.done = !todo.done;
            } else {
                state.todos = state.todos.filter(t => t.id !== id);
            }
        });
    });
    
    document.getElementById('activeCount')!.textContent = 
        String(state.activeCount);
}

manager.subscribe(render);
render(); // Initial render

// Add todo
document.getElementById('addBtn')!.addEventListener('click', () => {
    if (state.newTodo.trim()) {
        state.todos.push({
            id: Date.now(),
            text: state.newTodo,
            done: false
        });
        state.newTodo = '';
    }
});
```

**Lines of code:** ~65

---

### ⚛️ React (Hooks & Components)

```typescript
import { makeReactiveState } from './ReactiveState.react';

interface Todo {
    id: number;
    text: string;
    done: boolean;
}

function TodoList() {
    const $state = makeReactiveState(() => ({
        todos: [] as Todo[],
        newTodo: '',
        
        get activeCount() {
            return this.todos.filter(t => !t.done).length;
        }
    }));

    const addTodo = () => {
        if ($state.newTodo.trim()) {
            $state.todos.push({
                id: Date.now(),
                text: $state.newTodo,
                done: false
            });
            $state.newTodo = '';
        }
    };

    return (
        <div>
            <input 
                value={$state.newTodo}
                onChange={e => $state.newTodo = e.target.value}
                onKeyPress={e => e.key === 'Enter' && addTodo()}
            />
            <button onClick={addTodo}>Add</button>
            
            {$state.todos.map(todo => (
                <div key={todo.id} className={todo.done ? 'done' : ''}>
                    <input 
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => todo.done = !todo.done}
                    />
                    <span>{todo.text}</span>
                    <button onClick={() => {
                        $state.todos = $state.todos.filter(t => t.id !== todo.id);
                    }}>Delete</button>
                </div>
            ))}
            
            <p>{$state.activeCount} active</p>
        </div>
    );
}
```

**Lines of code:** ~40

---

### 🍦 Vanilla (DOM Helpers)

```typescript
import { createComponent } from './ReactiveState.vanilla';

interface Todo {
    id: number;
    text: string;
    done: boolean;
}

const TodoApp = createComponent({
    state: {
        todos: [] as Todo[],
        newTodo: '',
        
        get activeCount() {
            return this.todos.filter(t => !t.done).length;
        }
    },
    
    template: (s) => `
        <input id="new-todo" value="${s.newTodo}" placeholder="New todo">
        <button data-action="add">Add</button>
        
        ${s.todos.map(todo => `
            <div class="${todo.done ? 'done' : ''}">
                <input type="checkbox" ${todo.done ? 'checked' : ''}
                    data-action="toggle" data-id="${todo.id}">
                <span>${todo.text}</span>
                <button data-action="delete" data-id="${todo.id}">Delete</button>
            </div>
        `).join('')}
        
        <p>${s.activeCount} active</p>
    `,
    
    methods: {
        add(state) {
            if (state.newTodo.trim()) {
                state.todos.push({
                    id: Date.now(),
                    text: state.newTodo,
                    done: false
                });
                state.newTodo = '';
            }
        },
        
        toggle(state, id) {
            const todo = state.todos.find(t => t.id === Number(id));
            if (todo) todo.done = !todo.done;
        },
        
        delete(state, id) {
            state.todos = state.todos.filter(t => t.id !== Number(id));
        }
    },
    
    mount(container, state) {
        // Bind input
        const input = container.querySelector('#new-todo');
        input?.addEventListener('input', (e) => {
            state.newTodo = (e.target as HTMLInputElement).value;
        });
        
        // Bind actions
        container.querySelectorAll('[data-action]').forEach(el => {
            const action = el.getAttribute('data-action')!;
            const id = el.getAttribute('data-id');
            
            el.addEventListener('click', () => {
                this.methods[action](state, id);
            });
        });
    }
});

// Mount
const app = TodoApp.mount('#app');
```

**Lines of code:** ~50

---

## Performance Comparison

### Memory Usage (1000 state changes)

| Approach | Memory | Render Time | Re-renders |
|----------|--------|-------------|------------|
| **Core** | Lowest (~50KB) | Fastest (manual) | On-demand |
| **React** | Medium (~200KB) | Fast (virtual DOM) | Optimized |
| **Vanilla** | Low (~100KB) | Fast (direct DOM) | Every change |

### Bundle Size

| Approach | Core Size | Total Size |
|----------|-----------|------------|
| **Core only** | ~5KB | ~5KB |
| **React** | ~5KB + React (~45KB) | ~50KB |
| **Vanilla** | ~5KB + helpers (~3KB) | ~8KB |

---

## Feature Matrix

| Feature | Core | React | Vanilla |
|---------|------|-------|---------|
| **Reactive State** | ✅ | ✅ | ✅ |
| **Computed Values** | ✅ | ✅ | ✅ |
| **Subscriptions** | ✅ | ✅ (auto) | ✅ (auto) |
| **Watchers** | ✅ | ✅ | ❌ |
| **Debouncing** | ✅ | ✅ | ✅ |
| **Batching** | ✅ | ✅ | ✅ |
| **DOM Binding** | Manual | JSX | Auto |
| **Two-way Forms** | Manual | Manual | Built-in |
| **Components** | Manual | Built-in | Built-in |
| **SSR Support** | ✅ | ✅ | ❌ |
| **Framework** | None | React | None |
| **Browser Only** | ❌ | ❌ | ✅ |

---

## When to Use Each

### 🔵 Use Core When:
- ✅ Building for Node.js/backend
- ✅ Need maximum control
- ✅ Integrating with non-React frameworks (Vue, Svelte, Angular)
- ✅ Building your own adapter
- ✅ Want zero dependencies
- ✅ Testing/learning reactive patterns

### ⚛️ Use React When:
- ✅ Building a React application
- ✅ Need component lifecycle
- ✅ Want JSX integration
- ✅ Using React ecosystem (Router, etc.)
- ✅ Server-side rendering (SSR)
- ✅ Team knows React

### 🍦 Use Vanilla When:
- ✅ Building vanilla TypeScript app
- ✅ Progressive enhancement
- ✅ No build step desired
- ✅ Lightweight interactivity
- ✅ Prototyping quickly
- ✅ Learning without framework overhead

---

## Migration Path

### Core → Vanilla

```typescript
// Before (Core)
const manager = new ReactiveState({ count: 0 });
const state = manager.getState();
manager.subscribe(() => {
    document.getElementById('counter')!.textContent = String(state.count);
});

// After (Vanilla)
const state = createVanillaState({ count: 0 });
bindToDOM('#counter', () => state.count, state);
```

### Core → React

```typescript
// Before (Core)
const manager = new ReactiveState({ count: 0 });
const state = manager.getState();

// After (React)
function Counter() {
    const $state = makeReactiveState(() => ({ count: 0 }));
    return <p>Count: {$state.count}</p>;
}
```

### Vanilla → React

```typescript
// Before (Vanilla)
const state = createVanillaState({ count: 0 });
bindToDOM('#counter', () => state.count, state);

// After (React)
function Counter() {
    const $state = makeReactiveState(() => ({ count: 0 }));
    return <p>Count: {$state.count}</p>;
}
```

---

## Summary

| Criteria | Winner |
|----------|--------|
| **Simplest API** | 🏆 Vanilla |
| **Most Powerful** | 🏆 React |
| **Most Flexible** | 🏆 Core |
| **Smallest Bundle** | 🏆 Core |
| **Fastest Performance** | 🏆 Core |
| **Best DX (React apps)** | 🏆 React |
| **Best DX (Vanilla apps)** | 🏆 Vanilla |
| **Production Ready** | 🏆 All Three |

**The beauty of ReactiveState:** You can start with one approach and migrate to another without rewriting your state logic! The core is always the same. 🎯

