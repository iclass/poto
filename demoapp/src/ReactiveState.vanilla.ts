/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState Vanilla TypeScript Adapter
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Full-featured vanilla TypeScript/JavaScript adapter with:
 * - Simple API for creating reactive state
 * - Automatic DOM binding and updates
 * - Template rendering with auto-refresh
 * - Event binding helpers
 * - Component-like pattern (without framework overhead)
 * 
 * Perfect for:
 * - Vanilla TypeScript projects
 * - Progressive enhancement
 * - Lightweight web apps
 * - Learning reactive patterns
 * - Prototyping without framework setup
 * 
 * @module ReactiveState.vanilla
 */

import { ReactiveState } from './ReactiveState.core';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Simple API - Create reactive state with minimal boilerplate
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({ count: 0 });
 * 
 * state.count++; // Just works!
 * ```
 */
export function createReactiveState<T extends Record<string, any>>(
    initialState: T,
    onUpdate?: () => void
): T {
    const manager = new ReactiveState(initialState);
    const state = manager.getState();
    
    if (onUpdate) {
        manager.subscribe(onUpdate);
    }
    
    return state;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOM Binding - Automatically update DOM when state changes
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({ count: 0 });
 * 
 * bindToDOM('#counter', () => state.count);
 * bindToDOM('#message', () => `Count is ${state.count}`);
 * 
 * state.count++; // DOM auto-updates!
 * ```
 */
export function bindToDOM<T extends Record<string, any>>(
    selector: string,
    getValue: () => any,
    state: T,
    options: {
        attribute?: string;
        html?: boolean;
        debounce?: number;
    } = {}
): () => void {
    const element = document.querySelector(selector);
    if (!element) {
        console.warn(`Element not found: ${selector}`);
        return () => {};
    }
    
    // Find the ReactiveState manager from the state proxy
    const manager = (state as any).__reactiveManager as ReactiveState<T>;
    if (!manager) {
        console.warn('State is not reactive. Use createReactiveState()');
        return () => {};
    }
    
    const update = () => {
        const value = getValue();
        
        if (options.attribute) {
            element.setAttribute(options.attribute, String(value));
        } else if (options.html) {
            element.innerHTML = String(value);
        } else {
            element.textContent = String(value);
        }
    };
    
    // Initial render
    update();
    
    // Subscribe to changes
    return manager.subscribe(update);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Template Rendering - Render templates that auto-update
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({
 *   items: ['a', 'b', 'c'],
 *   title: 'My List'
 * });
 * 
 * const unrender = renderTemplate('#app', state, (s) => `
 *   <h1>${s.title}</h1>
 *   <ul>
 *     ${s.items.map(item => `<li>${item}</li>`).join('')}
 *   </ul>
 * `);
 * 
 * state.items.push('d'); // Template re-renders automatically!
 * ```
 */
export function renderTemplate<T extends Record<string, any>>(
    selector: string,
    state: T,
    template: (state: T) => string,
    options: {
        debounce?: number;
    } = {}
): () => void {
    const container = document.querySelector(selector);
    if (!container) {
        console.warn(`Container not found: ${selector}`);
        return () => {};
    }
    
    const manager = (state as any).__reactiveManager as ReactiveState<T>;
    if (!manager) {
        console.warn('State is not reactive. Use createReactiveState()');
        return () => {};
    }
    
    if (options.debounce) {
        manager.setDebounce(options.debounce);
    }
    
    const render = () => {
        container.innerHTML = template(state);
    };
    
    // Initial render
    render();
    
    // Subscribe to changes
    return manager.subscribe(render);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Event Binding - Bind events to state updates
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({ count: 0 });
 * 
 * bindEvent('#increment', 'click', () => {
 *   state.count++;
 * });
 * ```
 */
export function bindEvent(
    selector: string,
    event: string,
    handler: (e: Event) => void
): () => void {
    const element = document.querySelector(selector);
    if (!element) {
        console.warn(`Element not found: ${selector}`);
        return () => {};
    }
    
    element.addEventListener(event, handler);
    
    return () => element.removeEventListener(event, handler);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Component Pattern - Create reusable components
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const Counter = createComponent({
 *   state: { count: 0 },
 *   
 *   template: (s) => `
 *     <div>
 *       <p>Count: ${s.count}</p>
 *       <button data-action="increment">+</button>
 *       <button data-action="decrement">-</button>
 *     </div>
 *   `,
 *   
 *   methods: {
 *     increment: (state) => { state.count++; },
 *     decrement: (state) => { state.count--; }
 *   },
 *   
 *   mount(container, state) {
 *     // Auto-bind data-action attributes
 *     container.querySelectorAll('[data-action]').forEach(el => {
 *       const action = el.getAttribute('data-action')!;
 *       el.addEventListener('click', () => this.methods[action](state));
 *     });
 *   }
 * });
 * 
 * const instance = Counter.mount('#app');
 * ```
 */
export interface ComponentDefinition<T extends Record<string, any>> {
    state: T;
    template: (state: T) => string;
    methods?: Record<string, (state: T, ...args: any[]) => void>;
    mount?: (container: Element, state: T) => void;
    unmount?: () => void;
    debounce?: number;
}

export interface ComponentInstance<T extends Record<string, any>> {
    state: T;
    update: () => void;
    unmount: () => void;
}

export function createComponent<T extends Record<string, any>>(
    definition: ComponentDefinition<T>
) {
    return {
        mount(selector: string): ComponentInstance<T> {
            const container = document.querySelector(selector);
            if (!container) {
                throw new Error(`Container not found: ${selector}`);
            }
            
            // Create reactive state with internal manager reference
            const manager = new ReactiveState(definition.state);
            const state = manager.getState();
            
            // Store manager reference for later access
            (state as any).__reactiveManager = manager;
            
            if (definition.debounce) {
                manager.setDebounce(definition.debounce);
            }
            
            const render = () => {
                container.innerHTML = definition.template(state);
                
                // Re-bind events after each render
                if (definition.mount) {
                    definition.mount(container, state);
                }
            };
            
            // Initial render
            render();
            
            // Subscribe to changes
            const unsubscribe = manager.subscribe(render);
            
            return {
                state,
                update: render,
                unmount: () => {
                    unsubscribe();
                    if (definition.unmount) {
                        definition.unmount();
                    }
                }
            };
        }
    };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Computed Helper - Create computed values that auto-update
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Note: Use native getters in state for computed values:
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   
 *   // Computed value - auto-updates!
 *   get fullName() {
 *     return `${this.firstName} ${this.lastName}`;
 *   }
 * });
 * 
 * console.log(state.fullName); // "John Doe"
 * state.firstName = 'Jane';
 * console.log(state.fullName); // "Jane Doe" - automatic!
 * ```
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Form Binding - Two-way binding for form inputs
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({ name: '', email: '' });
 * 
 * bindFormInput('#name', state, 'name');
 * bindFormInput('#email', state, 'email');
 * 
 * // Typing in input auto-updates state
 * // Changing state auto-updates input
 * ```
 */
export function bindFormInput<T extends Record<string, any>, K extends keyof T>(
    selector: string,
    state: T,
    property: K
): () => void {
    const input = document.querySelector(selector) as HTMLInputElement;
    if (!input) {
        console.warn(`Input not found: ${selector}`);
        return () => {};
    }
    
    const manager = (state as any).__reactiveManager as ReactiveState<T>;
    if (!manager) {
        console.warn('State is not reactive. Use createReactiveState()');
        return () => {};
    }
    
    // Set initial value
    input.value = String(state[property]);
    
    // Input → State
    const handleInput = () => {
        (state as any)[property] = input.value;
    };
    input.addEventListener('input', handleInput);
    
    // State → Input
    const unsubscribe = manager.subscribe(() => {
        if (input.value !== String(state[property])) {
            input.value = String(state[property]);
        }
    });
    
    return () => {
        input.removeEventListener('input', handleInput);
        unsubscribe();
    };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * List Rendering - Efficiently render lists
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({
 *   todos: [
 *     { id: 1, text: 'Learn reactive state', done: false },
 *     { id: 2, text: 'Build app', done: false }
 *   ]
 * });
 * 
 * renderList('#todos', state.todos, (todo) => `
 *   <li>
 *     <input type="checkbox" ${todo.done ? 'checked' : ''}>
 *     ${todo.text}
 *   </li>
 * `);
 * 
 * state.todos.push({ id: 3, text: 'Deploy', done: false });
 * // List auto-updates!
 * ```
 */
export function renderList<T extends Record<string, any>, Item>(
    selector: string,
    items: Item[],
    itemTemplate: (item: Item, index: number) => string,
    state?: T
): () => void {
    const container = document.querySelector(selector);
    if (!container) {
        console.warn(`Container not found: ${selector}`);
        return () => {};
    }
    
    if (!state) {
        // One-time render
        container.innerHTML = items.map((item, i) => itemTemplate(item, i)).join('');
        return () => {};
    }
    
    const manager = (state as any).__reactiveManager as ReactiveState<T>;
    if (!manager) {
        console.warn('State is not reactive. Use createReactiveState()');
        return () => {};
    }
    
    const render = () => {
        container.innerHTML = items.map((item, i) => itemTemplate(item, i)).join('');
    };
    
    // Initial render
    render();
    
    // Subscribe to changes
    return manager.subscribe(render);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Conditional Rendering - Show/hide based on state
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({ isLoggedIn: false });
 * 
 * bindVisibility('#login-form', state, () => !state.isLoggedIn);
 * bindVisibility('#dashboard', state, () => state.isLoggedIn);
 * 
 * state.isLoggedIn = true; // Shows dashboard, hides login
 * ```
 */
export function bindVisibility<T extends Record<string, any>>(
    selector: string,
    state: T,
    condition: () => boolean
): () => void {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
        console.warn(`Element not found: ${selector}`);
        return () => {};
    }
    
    const manager = (state as any).__reactiveManager as ReactiveState<T>;
    if (!manager) {
        console.warn('State is not reactive. Use createReactiveState()');
        return () => {};
    }
    
    const update = () => {
        element.style.display = condition() ? '' : 'none';
    };
    
    // Initial update
    update();
    
    // Subscribe to changes
    return manager.subscribe(update);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Enhanced createReactiveState with manager reference
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function createVanillaState<T extends Record<string, any>>(
    initialState: T,
    options: {
        debounce?: number;
        onUpdate?: () => void;
    } = {}
): T {
    const manager = new ReactiveState(initialState);
    const state = manager.getState();
    
    // Store manager reference for helper functions
    (state as any).__reactiveManager = manager;
    
    if (options.debounce) {
        manager.setDebounce(options.debounce);
    }
    
    if (options.onUpdate) {
        manager.subscribe(options.onUpdate);
    }
    
    return state;
}

