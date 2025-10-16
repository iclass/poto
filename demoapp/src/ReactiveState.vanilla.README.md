# ReactiveState Vanilla TypeScript Adapter

**Full-featured reactive state management for vanilla TypeScript/JavaScript** - Zero framework dependencies, pure TypeScript reactivity.

## 🎯 Overview

The Vanilla adapter provides a **delightful developer experience** for building reactive applications without any framework. It's perfect for:

- ✅ **Vanilla TypeScript** projects
- ✅ **Progressive enhancement** of existing sites
- ✅ **Lightweight web apps** without build complexity
- ✅ **Prototyping** without framework setup
- ✅ **Learning** reactive patterns
- ✅ **Backend/Node.js** applications with UI needs

## 🚀 Quick Start

```typescript
import { createVanillaState, bindToDOM, bindEvent } from './ReactiveState.vanilla';

// Create reactive state
const state = createVanillaState({
    count: 0
});

// Bind to DOM - auto-updates!
bindToDOM('#counter', () => state.count, state);

// Bind events
bindEvent('#increment', 'click', () => {
    state.count++; // DOM updates automatically!
});
```

## 📦 What's Included

### Core Functions

| Function | Purpose | Use Case |
|----------|---------|----------|
| `createVanillaState()` | Create reactive state | Main state management |
| `bindToDOM()` | Bind state to DOM elements | Display values |
| `renderTemplate()` | Render HTML templates | Complex UI |
| `bindEvent()` | Attach event handlers | User interactions |
| `bindFormInput()` | Two-way form binding | Input fields |
| `bindVisibility()` | Conditional rendering | Show/hide elements |
| `renderList()` | Render lists efficiently | Dynamic lists |
| `createComponent()` | Component pattern | Reusable components |

## 📚 API Reference

### 1. `createVanillaState<T>(initialState, options?)`

Create reactive state with automatic DOM updates.

```typescript
const state = createVanillaState({
    count: 0,
    message: 'Hello',
    
    // Computed values - auto-update!
    get summary() {
        return `${this.message}: ${this.count}`;
    }
}, {
    debounce: 100,        // Debounce rapid updates (optional)
    onUpdate: () => {}    // Global update callback (optional)
});

state.count++; // Triggers reactivity!
```

**Options:**
- `debounce`: Milliseconds to debounce updates (for streaming data)
- `onUpdate`: Called on every state change

### 2. `bindToDOM(selector, getValue, state, options?)`

Bind state to a DOM element - auto-updates when state changes.

```typescript
const state = createVanillaState({ name: 'John' });

// Text content (default)
bindToDOM('#name', () => state.name, state);

// HTML content
bindToDOM('#html', () => `<b>${state.name}</b>`, state, { 
    html: true 
});

// Attribute
bindToDOM('#link', () => state.url, state, { 
    attribute: 'href' 
});
```

**Options:**
- `html`: Set innerHTML instead of textContent
- `attribute`: Set attribute instead of content

**Returns:** Unsubscribe function

### 3. `renderTemplate(selector, state, template, options?)`

Render HTML templates that auto-update.

```typescript
const state = createVanillaState({
    items: ['Apple', 'Banana'],
    title: 'My List'
});

const unrender = renderTemplate('#app', state, (s) => `
    <h1>${s.title}</h1>
    <ul>
        ${s.items.map(item => `<li>${item}</li>`).join('')}
    </ul>
`, {
    debounce: 50  // Optional: debounce rapid updates
});

state.items.push('Orange'); // Template re-renders!
```

**Options:**
- `debounce`: Milliseconds to debounce re-renders

**Returns:** Unsubscribe function

### 4. `bindEvent(selector, event, handler)`

Bind events to state updates.

```typescript
const state = createVanillaState({ count: 0 });

bindEvent('#increment', 'click', () => {
    state.count++;
});

bindEvent('#name-input', 'input', (e) => {
    state.name = e.target.value;
});
```

**Returns:** Unsubscribe function

### 5. `bindFormInput(selector, state, property)`

Two-way binding for form inputs.

```typescript
const state = createVanillaState({
    username: '',
    email: ''
});

// Typing updates state, state updates input
bindFormInput('#username', state, 'username');
bindFormInput('#email', state, 'email');

// Use state anywhere
console.log(state.username); // Current input value
```

**Returns:** Unsubscribe function

### 6. `bindVisibility(selector, state, condition)`

Show/hide elements based on state.

```typescript
const state = createVanillaState({ isLoggedIn: false });

bindVisibility('#login-form', state, () => !state.isLoggedIn);
bindVisibility('#dashboard', state, () => state.isLoggedIn);

state.isLoggedIn = true; // Shows dashboard, hides login
```

**Returns:** Unsubscribe function

### 7. `renderList(selector, items, itemTemplate, state?)`

Efficiently render lists.

```typescript
const state = createVanillaState({
    todos: [
        { id: 1, text: 'Learn', done: false },
        { id: 2, text: 'Build', done: false }
    ]
});

renderList('#todos', state.todos, (todo, index) => `
    <li class="${todo.done ? 'done' : ''}">
        ${index + 1}. ${todo.text}
    </li>
`, state);

state.todos.push({ id: 3, text: 'Deploy', done: false });
// List auto-updates!
```

**Returns:** Unsubscribe function

### 8. `createComponent(definition)`

Create reusable components with encapsulated state and logic.

```typescript
const Counter = createComponent({
    // Component state
    state: {
        count: 0,
        
        // Computed values
        get doubled() {
            return this.count * 2;
        }
    },
    
    // HTML template
    template: (s) => `
        <div>
            <p>Count: ${s.count} (Doubled: ${s.doubled})</p>
            <button data-action="increment">+1</button>
            <button data-action="decrement">-1</button>
        </div>
    `,
    
    // Component methods
    methods: {
        increment(state) {
            state.count++;
        },
        decrement(state) {
            state.count--;
        }
    },
    
    // Mount lifecycle - bind events
    mount(container, state) {
        container.querySelectorAll('[data-action]').forEach(el => {
            const action = el.getAttribute('data-action');
            el.addEventListener('click', () => {
                this.methods[action](state);
            });
        });
    },
    
    // Unmount lifecycle - cleanup
    unmount() {
        console.log('Component unmounted');
    },
    
    // Optional: debounce updates
    debounce: 50
});

// Mount component
const instance = Counter.mount('#app');

// Access component state
console.log(instance.state.count);

// Manually trigger re-render
instance.update();

// Cleanup
instance.unmount();
```

**Component Definition:**
- `state`: Initial state object
- `template`: Function returning HTML string
- `methods`: Component methods (can mutate state)
- `mount`: Lifecycle hook for event binding
- `unmount`: Lifecycle hook for cleanup
- `debounce`: Debounce template re-renders

**Returns:** Component factory with `.mount(selector)` method

## 💡 Complete Examples

### Example 1: Simple Counter

```typescript
import { createVanillaState, bindToDOM, bindEvent } from './ReactiveState.vanilla';

const state = createVanillaState({ count: 0 });

bindToDOM('#counter', () => state.count, state);
bindEvent('#increment', 'click', () => state.count++);
bindEvent('#decrement', 'click', () => state.count--);
```

### Example 2: Todo App Component

```typescript
const TodoApp = createComponent({
    state: {
        newTodo: '',
        todos: [],
        
        get activeCount() {
            return this.todos.filter(t => !t.done).length;
        }
    },
    
    template: (s) => `
        <input id="new-todo" value="${s.newTodo}" placeholder="New todo">
        <button data-action="add">Add</button>
        
        ${s.todos.map(todo => `
            <div class="todo ${todo.done ? 'done' : ''}">
                <input type="checkbox" 
                    ${todo.done ? 'checked' : ''}
                    data-action="toggle" 
                    data-id="${todo.id}">
                <span>${todo.text}</span>
                <button data-action="delete" data-id="${todo.id}">×</button>
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
            state.newTodo = e.target.value;
        });
        
        // Bind action buttons
        container.querySelectorAll('[data-action]').forEach(el => {
            const action = el.getAttribute('data-action');
            const id = el.getAttribute('data-id');
            
            el.addEventListener('click', () => {
                this.methods[action](state, id);
            });
        });
    }
});

const app = TodoApp.mount('#app');
```

### Example 3: Form with Validation

```typescript
const state = createVanillaState({
    username: '',
    email: '',
    password: '',
    
    get isValid() {
        return this.username.length >= 3 
            && this.email.includes('@')
            && this.password.length >= 8;
    },
    
    get errors() {
        const errs = [];
        if (this.username && this.username.length < 3) {
            errs.push('Username must be 3+ characters');
        }
        if (this.email && !this.email.includes('@')) {
            errs.push('Email must be valid');
        }
        if (this.password && this.password.length < 8) {
            errs.push('Password must be 8+ characters');
        }
        return errs;
    }
});

// Two-way binding
bindFormInput('#username', state, 'username');
bindFormInput('#email', state, 'email');
bindFormInput('#password', state, 'password');

// Show/hide submit button
bindVisibility('#submit', state, () => state.isValid);

// Show errors
renderTemplate('#errors', state, (s) => `
    ${s.errors.map(err => `<p class="error">${err}</p>`).join('')}
`);
```

### Example 4: Real-time Dashboard

```typescript
const state = createVanillaState({
    users: 0,
    messages: 0,
    revenue: 0,
    
    get revenuePerUser() {
        return this.users > 0 ? (this.revenue / this.users).toFixed(2) : '0.00';
    }
}, {
    debounce: 100  // Debounce rapid updates
});

// Bind individual stats
bindToDOM('#users', () => state.users.toLocaleString(), state);
bindToDOM('#messages', () => state.messages.toLocaleString(), state);
bindToDOM('#revenue', () => `$${state.revenue.toFixed(2)}`, state);
bindToDOM('#arpu', () => `$${state.revenuePerUser}`, state);

// Simulate streaming updates
setInterval(() => {
    state.users += Math.floor(Math.random() * 10);
    state.messages += Math.floor(Math.random() * 50);
    state.revenue += Math.random() * 100;
}, 100);
```

### Example 5: Conditional UI

```typescript
const state = createVanillaState({
    isLoggedIn: false,
    username: '',
    role: 'guest',
    
    get isAdmin() {
        return this.role === 'admin';
    }
});

// Conditional rendering
bindVisibility('#login-form', state, () => !state.isLoggedIn);
bindVisibility('#dashboard', state, () => state.isLoggedIn);
bindVisibility('#admin-panel', state, () => state.isLoggedIn && state.isAdmin);

// Dynamic content
bindToDOM('#welcome', () => `Welcome, ${state.username}!`, state);

// Login handler
bindEvent('#login-btn', 'click', async () => {
    // Simulate API call
    state.isLoggedIn = true;
    state.username = 'John Doe';
    state.role = 'admin';
});
```

## 🎨 Computed Values

Use native getters for computed values - they auto-update!

```typescript
const state = createVanillaState({
    firstName: 'John',
    lastName: 'Doe',
    
    // Computed - auto-updates when firstName/lastName change
    get fullName() {
        return `${this.firstName} ${this.lastName}`;
    },
    
    items: [1, 2, 3],
    
    // Computed from arrays
    get total() {
        return this.items.reduce((sum, n) => sum + n, 0);
    }
});

bindToDOM('#name', () => state.fullName, state);

state.firstName = 'Jane'; // fullName updates, DOM updates!
```

## ⚡ Performance: Debouncing

For streaming data or rapid updates, use debouncing:

```typescript
const state = createVanillaState({
    stream: []
}, {
    debounce: 100  // Wait 100ms before updating DOM
});

// Rapid updates are batched
for (let i = 0; i < 1000; i++) {
    state.stream.push(i); // Only re-renders once after 100ms!
}
```

## 🧹 Cleanup

All binding functions return an unsubscribe function:

```typescript
const unsubscribe1 = bindToDOM('#counter', () => state.count, state);
const unsubscribe2 = bindEvent('#btn', 'click', handler);

// Later: cleanup
unsubscribe1();
unsubscribe2();

// Or for components
const component = Counter.mount('#app');
component.unmount(); // Automatic cleanup
```

## 🆚 Comparison

| Feature | ReactiveState Vanilla | Alpine.js | Petite-Vue | jQuery |
|---------|----------------------|-----------|------------|--------|
| **Bundle Size** | ~5KB | ~15KB | ~6KB | ~30KB |
| **TypeScript** | ✅ First-class | ❌ | ❌ | ❌ |
| **Framework-agnostic** | ✅ | ✅ | ❌ (Vue) | ✅ |
| **Reactive Core** | ✅ | ✅ | ✅ | ❌ |
| **Component Pattern** | ✅ | ✅ | ✅ | ❌ |
| **No Build Step** | ✅ | ✅ | ✅ | ✅ |
| **Computed Values** | ✅ Native | ✅ | ✅ | ❌ |

## 📖 Best Practices

### 1. Initialize state early
```typescript
// ✅ Good: Initialize at module level
const state = createVanillaState({ count: 0 });

// ❌ Avoid: Creating state in functions (unless intentional)
function handler() {
    const state = createVanillaState({ count: 0 }); // New state every call!
}
```

### 2. Use computed getters
```typescript
// ✅ Good: Computed values auto-update
const state = createVanillaState({
    items: [],
    get total() { return this.items.length; }
});

// ❌ Avoid: Manual updates
let total = state.items.length; // Stale value!
```

### 3. Clean up subscriptions
```typescript
// ✅ Good: Store and call unsubscribe
const unsub = bindToDOM('#el', () => state.value, state);
window.addEventListener('beforeunload', () => unsub());

// ✅ Better: Use components (auto cleanup)
const component = Counter.mount('#app');
```

### 4. Debounce streaming data
```typescript
// ✅ Good: Debounce rapid updates
const state = createVanillaState({ stream: [] }, { debounce: 100 });

// ❌ Avoid: Re-rendering on every update
const state = createVanillaState({ stream: [] }); // 1000 renders!
for (let i = 0; i < 1000; i++) state.stream.push(i);
```

## 🎯 Use Cases

### Perfect For:
- 📝 **Admin panels** - Lightweight, no framework needed
- 🔧 **Dashboards** - Real-time data visualization
- 📊 **Forms** - Two-way binding, validation
- 🎮 **Interactive demos** - Quick prototypes
- 🌐 **Progressive enhancement** - Add reactivity to existing sites
- 🎓 **Learning** - Understand reactive patterns

### Not Ideal For:
- 🏢 **Large SPAs** - Consider React/Vue for complex routing
- 📱 **Mobile apps** - Use React Native/Flutter
- 🎨 **Design systems** - Framework components are better

## 🚀 Getting Started

1. **Copy files:**
   - `ReactiveState.core.ts` (framework-agnostic core)
   - `ReactiveState.vanilla.ts` (vanilla adapter)

2. **Import and use:**
   ```typescript
   import { createVanillaState } from './ReactiveState.vanilla';
   
   const state = createVanillaState({ count: 0 });
   ```

3. **See `vanilla-demo.html` for complete examples!**

## 📦 Zero Dependencies

The vanilla adapter has **ZERO dependencies**:
- ✅ Pure TypeScript
- ✅ Native Proxy API
- ✅ Standard DOM APIs
- ✅ Works in all modern browsers
- ✅ No build step required (but TypeScript compilation recommended)

## 🎉 Summary

ReactiveState Vanilla gives you **React-like reactivity** without the framework overhead. It's:

- 🚀 **Fast** - Direct DOM updates, no virtual DOM
- 🪶 **Lightweight** - ~5KB core
- 💪 **Powerful** - Full reactive system
- 🎯 **Simple** - Minimal API surface
- 🔧 **Flexible** - Use as much or as little as you need

**Perfect for vanilla TypeScript projects!** 🎯

