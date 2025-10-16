/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState Core - Framework-Agnostic Reactive State Management
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Pure TypeScript/JavaScript reactive state implementation.
 * No framework dependencies - works anywhere:
 * - Vanilla TypeScript/JavaScript
 * - Node.js backend
 * - React (via ReactiveState.react.ts)
 * - Vue.js
 * - Svelte
 * - Angular
 * - Any JavaScript environment
 * 
 * @module ReactiveState.core
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Type Definitions for Property Watchers
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface WatchOptions {
    debounce?: number;   // Additional debounce on top of state debounce
    immediate?: boolean; // Call immediately with current value
}

export interface PropertyWatcher<T> {
    callback: (newValue: T, oldValue: T) => void;
    options: WatchOptions;
    debounceTimer?: NodeJS.Timeout;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState - Core Reactivity Engine with Performance Optimization
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This class implements the Observable/PubSub pattern using JavaScript Proxies
 * to intercept property assignments and notify subscribers automatically.
 * 
 * KEY CONCEPTS:
 * - Uses Proxy API to intercept reads (get) and writes (set)
 * - Publisher: Notifies all subscribers when state changes
 * - Subscriber: Listeners that want to be notified on changes
 * - NOT tied to any framework - pure JavaScript
 * 
 * COMPUTED VALUES:
 * Use getter functions to create derived state that auto-updates:
 * ```typescript
 * const state = {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   get fullName() {
 *     return `${this.firstName} ${this.lastName}`;
 *   }
 * };
 * const reactive = new ReactiveState(state);
 * const proxy = reactive.getState();
 * console.log(proxy.fullName); // "John Doe"
 * proxy.firstName = 'Jane';
 * console.log(proxy.fullName); // "Jane Doe" - automatically updated!
 * ```
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * Three built-in methods to control reactivity for streaming/bulk updates:
 * 
 * DEFAULT BEHAVIOR: 50ms debounce - smooth streaming UX
 * - Optimized for streaming scenarios (chat, AI responses, real-time updates)
 * - Creates nice "typing" effect without excessive notifications
 * - Set to 0 for immediate updates if needed (buttons, forms)
 * 
 * 1. batch() - Group multiple updates → single notification
 * 2. setDebounce() - Adjust delay for different scenarios
 * 3. flush() - Force immediate notification of pending changes
 * 
 * @template T - The type of the state object
 */
export class ReactiveState<T extends Record<string, any>> {
    // ═════════════════════════════════════════════════════════════════════════
    // INTERNAL STATE STORAGE
    // ═════════════════════════════════════════════════════════════════════════
    private state: T;
    
    // ═════════════════════════════════════════════════════════════════════════
    // SUBSCRIBER REGISTRY
    // ═════════════════════════════════════════════════════════════════════════
    private listeners: Set<() => void> = new Set();
    
    // ═════════════════════════════════════════════════════════════════════════
    // BATCHING & DEBOUNCING CONTROL
    // ═════════════════════════════════════════════════════════════════════════
    private isBatching: boolean = false;
    private debounceTimer: NodeJS.Timeout | null = null;
    private debounceDelay: number = 50;
    
    // ═════════════════════════════════════════════════════════════════════════
    // PROPERTY WATCHERS
    // ═════════════════════════════════════════════════════════════════════════
    private watchers: Map<string | symbol, Set<PropertyWatcher<any>>> = new Map();
    private lastValues: Map<string | symbol, any> = new Map();
    private watchManyInitialized: boolean = false;
    private readonly EMPTY_UNWATCHERS = Object.freeze({});
    
    // ═════════════════════════════════════════════════════════════════════════
    // THE REACTIVE PROXY
    // ═════════════════════════════════════════════════════════════════════════
    private proxy: T;

    constructor(initialState: T) {
        this.state = initialState;
        this.proxy = this.createProxy(this.state) as T;
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * PROXY FACTORY - The Heart of Reactivity
     * ═════════════════════════════════════════════════════════════════════════
     */
    private createProxy(target: any, path: string = ''): any {
        return new Proxy(target, {
            set: (obj, prop, value) => {
                const fullPath = path ? `${path}.${String(prop)}` : String(prop);
                obj[prop] = value;
                this.notifyListeners();
                return true;
            },
            
            get: (obj, prop, receiver) => {
                // Handle computed values (getters)
                const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
                if (descriptor && descriptor.get) {
                    return descriptor.get.call(receiver);
                }
                
                const value = obj[prop];
                
                // Deep reactivity for nested objects
                if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof File)) {
                    return this.createProxy(value, path ? `${path}.${String(prop)}` : String(prop));
                }
                
                return value;
            }
        });
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * SUBSCRIBE - Register a listener for state changes
     * ═════════════════════════════════════════════════════════════════════════
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * NOTIFY LISTENERS - Broadcast changes to all subscribers
     * ═════════════════════════════════════════════════════════════════════════
     */
    private notifyListeners(): void {
        if (this.isBatching) {
            return;
        }
        
        if (this.debounceDelay > 0) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
                this.listeners.forEach(listener => listener());
                this.notifyWatchers();
            }, this.debounceDelay);
            return;
        }
        
        this.listeners.forEach(listener => listener());
        this.notifyWatchers();
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * NOTIFY WATCHERS - Call property-specific watchers
     * ═════════════════════════════════════════════════════════════════════════
     */
    private notifyWatchers(): void {
        this.watchers.forEach((watcherSet, property) => {
            const currentValue = this.state[property as keyof T];
            const lastValue = this.lastValues.get(property);
            
            if (currentValue !== lastValue) {
                this.lastValues.set(property, currentValue);
                
                watcherSet.forEach(watcher => {
                    const { callback, options, debounceTimer } = watcher;
                    
                    if (options.debounce && options.debounce > 0) {
                        if (debounceTimer) {
                            clearTimeout(debounceTimer);
                        }
                        watcher.debounceTimer = setTimeout(() => {
                            callback(currentValue, lastValue);
                        }, options.debounce);
                    } else {
                        callback(currentValue, lastValue);
                    }
                });
            }
        });
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * GET STATE - Return the reactive proxy
     * ═════════════════════════════════════════════════════════════════════════
     */
    getState(): T {
        return this.proxy;
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * BATCH UPDATES - Group multiple state changes together
     * ═════════════════════════════════════════════════════════════════════════
     */
    batch(updates: () => void): void {
        this.isBatching = true;
        try {
            updates();
        } finally {
            this.isBatching = false;
            this.notifyListeners();
        }
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * SET DEBOUNCE - Configure debounced notifications
     * ═════════════════════════════════════════════════════════════════════════
     */
    setDebounce(delayMs: number): void {
        this.debounceDelay = delayMs;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * FLUSH - Force immediate notification
     * ═════════════════════════════════════════════════════════════════════════
     */
    flush(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
            this.listeners.forEach(listener => listener());
            this.notifyWatchers();
        }
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * WATCH - Watch properties for changes (idempotent)
     * ═════════════════════════════════════════════════════════════════════════
     */
    watch<K extends keyof T>(
        watchMap: {
            [P in K]: 
                | ((newValue: T[P], oldValue: T[P]) => void)
                | {
                    handler: (newValue: T[P], oldValue: T[P]) => void;
                    debounce?: number;
                    immediate?: boolean;
                  }
        }
    ): Record<K, () => void> {
        if (this.watchManyInitialized) {
            return this.EMPTY_UNWATCHERS as Record<K, () => void>;
        }
        
        this.watchManyInitialized = true;
        const unwatchers = {} as Record<K, () => void>;
        
        for (const [property, config] of Object.entries(watchMap) as Array<[K, any]>) {
            if (typeof config === 'function') {
                unwatchers[property] = this.watchSingle(property, config);
            } else {
                unwatchers[property] = this.watchSingle(
                    property,
                    config.handler,
                    {
                        debounce: config.debounce,
                        immediate: config.immediate
                    }
                );
            }
        }
        
        return unwatchers;
    }

    /**
     * Watch a single property
     */
    private watchSingle<K extends keyof T>(
        property: K,
        callback: (newValue: T[K], oldValue: T[K]) => void,
        options: WatchOptions = {}
    ): () => void {
        if (!this.watchers.has(property as string | symbol)) {
            this.watchers.set(property as string | symbol, new Set());
            this.lastValues.set(property as string | symbol, this.state[property]);
        }
        
        const watcher: PropertyWatcher<T[K]> = { callback, options };
        const watcherSet = this.watchers.get(property as string | symbol)!;
        watcherSet.add(watcher);
        
        if (options.immediate) {
            const currentValue = this.state[property];
            callback(currentValue, currentValue);
        }
        
        return () => {
            watcherSet.delete(watcher);
            if (watcherSet.size === 0) {
                this.watchers.delete(property as string | symbol);
                this.lastValues.delete(property as string | symbol);
            }
            if (watcher.debounceTimer) {
                clearTimeout(watcher.debounceTimer);
            }
        };
    }
}

