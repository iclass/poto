/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REAL JSX/TSX WITHOUT REACT! 🎉
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This file uses ACTUAL JSX syntax (<div>...</div>) without React dependency!
 * 
 * Configuration needed at the top of this file:
 */

/** @jsxImportSource ./ReactiveState.jsx */

import { createReactiveComponent, mount, $class, $if, $list } from './ReactiveState.jsx.js';

// ═══════════════════════════════════════════════════════════════════════════
// Example 1: Simple Counter with REAL JSX
// ═══════════════════════════════════════════════════════════════════════════

export const CounterComponent = createReactiveComponent({
    state: {
        count: 0,
        
        get doubled() {
            return this.count * 2;
        }
    },
    
    // ✨ REAL JSX - Not template literals!
    render: (state) => (
        <div class="counter-widget">
            <h3>🔢 Counter (Real JSX, No React!)</h3>
            <div class="display">
                <p>Count: <strong>{state.count}</strong></p>
                <p>Doubled: <strong>{state.doubled}</strong></p>
            </div>
            <div class="buttons">
                <button onclick={() => state.count--}>➖ Decrement</button>
                <button onclick={() => state.count = 0}>🔄 Reset</button>
                <button onclick={() => state.count++}>➕ Increment</button>
            </div>
        </div>
    )
});

// ═══════════════════════════════════════════════════════════════════════════
// Example 2: Todo List with Conditional Rendering
// ═══════════════════════════════════════════════════════════════════════════

interface Todo {
    id: number;
    text: string;
    done: boolean;
}

export const TodoListComponent = createReactiveComponent<{
    newTodo: string;
    todos: Todo[];
    filter: 'all' | 'active' | 'completed';
    activeCount: number;
    filteredTodos: Todo[];
}>({
    state: {
        newTodo: '',
        todos: [
            { id: 1, text: 'Learn ReactiveState JSX', done: false },
            { id: 2, text: 'Build app without React', done: false },
            { id: 3, text: 'Deploy to production', done: false }
        ],
        filter: 'all',
        
        get activeCount() {
            return this.todos.filter(t => !t.done).length;
        },
        
        get filteredTodos() {
            if (this.filter === 'active') return this.todos.filter(t => !t.done);
            if (this.filter === 'completed') return this.todos.filter(t => t.done);
            return this.todos;
        }
    },
    
    // ✨ REAL JSX with conditional rendering and lists!
    render: (state: {
        newTodo: string;
        todos: Todo[];
        filter: 'all' | 'active' | 'completed';
        activeCount: number;
        filteredTodos: Todo[];
    }) => (
        <div class="todo-app">
            <h3>📝 Todo List (Real JSX!)</h3>
            
            {/* Input form */}
            <div class="input-section">
                <input 
                    type="text"
                    placeholder="What needs to be done?"
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
                />
                <button onclick={() => {
                    if (state.newTodo.trim()) {
                        state.todos.push({
                            id: Date.now(),
                            text: state.newTodo,
                            done: false
                        });
                        state.newTodo = '';
                    }
                }}>
                    ➕ Add
                </button>
            </div>
            
            {/* Filter buttons */}
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
            <ul class="todo-list">
                {$list(state.filteredTodos, (todo: Todo) => (
                    <li key={todo.id} class={$class({ completed: todo.done })}>
                        <input 
                            type="checkbox"
                            checked={todo.done}
                            onchange={() => {
                                todo.done = !todo.done;
                            }}
                        />
                        <span class="todo-text">{todo.text}</span>
                        <button 
                            class="delete-btn"
                            onclick={() => {
                                state.todos = state.todos.filter((t: Todo) => t.id !== todo.id);
                            }}
                        >
                            🗑️
                        </button>
                    </li>
                ))}
            </ul>
            
            {/* Footer */}
            <div class="footer">
                <span>{state.activeCount} items left</span>
                {$if(
                    state.todos.length > 0,
                    () => (
                        <button onclick={() => {
                            state.todos = state.todos.filter((t: Todo) => !t.done);
                        }}>
                            Clear completed
                        </button>
                    )
                )}
            </div>
        </div>
    ),
    
    debounce: 50
});

// ═══════════════════════════════════════════════════════════════════════════
// Example 3: Form with Validation
// ═══════════════════════════════════════════════════════════════════════════

export const LoginFormComponent = createReactiveComponent({
    state: {
        username: '',
        password: '',
        showPassword: false,
        submitted: false,
        
        get usernameError() {
            if (!this.submitted) return '';
            return this.username.length < 3 ? 'Username must be at least 3 characters' : '';
        },
        
        get passwordError() {
            if (!this.submitted) return '';
            return this.password.length < 6 ? 'Password must be at least 6 characters' : '';
        },
        
        get isValid() {
            return this.username.length >= 3 && this.password.length >= 6;
        }
    },
    
    // ✨ REAL JSX with conditional rendering!
    render: (state) => (
        <div class="login-form">
            <h3>🔐 Login Form (Real JSX!)</h3>
            
            <form onsubmit={(e: Event) => {
                e.preventDefault();
                state.submitted = true;
                if (state.isValid) {
                    alert(`Logged in as: ${state.username}`);
                }
            }}>
                {/* Username field */}
                <div class="form-group">
                    <label>Username:</label>
                    <input 
                        type="text"
                        value={state.username}
                        oninput={(e: Event) => {
                            state.username = (e.target as HTMLInputElement).value;
                        }}
                        class={$class({ error: !!state.usernameError })}
                    />
                    {$if(
                        !!state.usernameError,
                        () => <span class="error-message">{state.usernameError}</span>
                    )}
                </div>
                
                {/* Password field */}
                <div class="form-group">
                    <label>Password:</label>
                    <div class="password-wrapper">
                        <input 
                            type={state.showPassword ? 'text' : 'password'}
                            value={state.password}
                            oninput={(e: Event) => {
                                state.password = (e.target as HTMLInputElement).value;
                            }}
                            class={$class({ error: !!state.passwordError })}
                        />
                        <button 
                            type="button"
                            onclick={() => state.showPassword = !state.showPassword}
                        >
                            {state.showPassword ? '🙈' : '👁️'}
                        </button>
                    </div>
                    {$if(
                        !!state.passwordError,
                        () => <span class="error-message">{state.passwordError}</span>
                    )}
                </div>
                
                {/* Submit button */}
                <button 
                    type="submit"
                    disabled={state.submitted && !state.isValid}
                >
                    Login
                </button>
            </form>
            
            <p class="jsx-info">✅ This is REAL JSX without React!</p>
        </div>
    )
});

// ═══════════════════════════════════════════════════════════════════════════
// Example 4: Dashboard with Dynamic Styles
// ═══════════════════════════════════════════════════════════════════════════

export const DashboardComponent = createReactiveComponent({
    state: {
        users: 142,
        revenue: 54320,
        orders: 89,
        isLoading: false,
        
        get revenuePerUser() {
            return this.users > 0 ? (this.revenue / this.users).toFixed(2) : '0.00';
        },
        
        get statusColor() {
            if (this.users > 150) return 'green';
            if (this.users > 100) return 'orange';
            return 'red';
        }
    },
    
    // ✨ REAL JSX with dynamic styles!
    render: (state) => (
        <div class="dashboard">
            <h3>📊 Dashboard (Real JSX!)</h3>
            
            <div class="stats-grid">
                {/* Users stat */}
                <div class="stat-card" style={{ borderColor: state.statusColor }}>
                    <div class="stat-value">{state.users}</div>
                    <div class="stat-label">Users</div>
                </div>
                
                {/* Revenue stat */}
                <div class="stat-card">
                    <div class="stat-value">${state.revenue.toLocaleString()}</div>
                    <div class="stat-label">Revenue</div>
                </div>
                
                {/* Orders stat */}
                <div class="stat-card">
                    <div class="stat-value">{state.orders}</div>
                    <div class="stat-label">Orders</div>
                </div>
                
                {/* ARPU stat */}
                <div class="stat-card">
                    <div class="stat-value">${state.revenuePerUser}</div>
                    <div class="stat-label">Revenue/User</div>
                </div>
            </div>
            
            <div class="actions">
                <button onclick={() => {
                    state.isLoading = true;
                    setTimeout(() => {
                        state.users += Math.floor(Math.random() * 20);
                        state.revenue += Math.floor(Math.random() * 5000);
                        state.orders += Math.floor(Math.random() * 10);
                        state.isLoading = false;
                    }, 1000);
                }}>
                    {state.isLoading ? '⏳ Loading...' : '🔄 Refresh Data'}
                </button>
            </div>
        </div>
    )
});

// ═══════════════════════════════════════════════════════════════════════════
// Example 5: Pure JSX Element (not a component)
// ═══════════════════════════════════════════════════════════════════════════

export function renderStaticHeader() {
    const header = (
        <div class="header">
            <h1>🎯 ReactiveState JSX - No React Required!</h1>
            <p>This is <strong>REAL JSX</strong> syntax, not template literals!</p>
            <ul>
                <li>✅ Real JSX/TSX syntax</li>
                <li>✅ Zero React dependency</li>
                <li>✅ Reactive state updates</li>
                <li>✅ ~8KB bundle size</li>
            </ul>
        </div>
    );
    
    mount(header, '#header');
}

// ═══════════════════════════════════════════════════════════════════════════
// Initialize all examples
// ═══════════════════════════════════════════════════════════════════════════

export function initAllExamples() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 ReactiveState JSX Examples');
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ Using REAL JSX syntax: <div>...</div>');
    console.log('✅ NOT using template literals!');
    console.log('✅ Zero React dependency!');
    console.log('═══════════════════════════════════════════════════');
    
    // Render static header
    renderStaticHeader();
    
    // Mount reactive components
    const counter = CounterComponent.mount('#counter-app');
    const todoList = TodoListComponent.mount('#todo-app');
    const loginForm = LoginFormComponent.mount('#login-app');
    const dashboard = DashboardComponent.mount('#dashboard-app');
    
    console.log('✅ All components mounted with REAL JSX!');
    
    return {
        counter,
        todoList,
        loginForm,
        dashboard
    };
}

// Auto-initialize if running in browser
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        initAllExamples();
    });
}

