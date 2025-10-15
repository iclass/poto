import { useRef, useState, useEffect } from "react";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Type Definitions for Property Watchers
 * ═══════════════════════════════════════════════════════════════════════════
 */
interface WatchOptions {
    debounce?: number;   // Additional debounce on top of state debounce
    immediate?: boolean; // Call immediately with current value
}

interface PropertyWatcher<T> {
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
 * - Subscriber: Components that want to re-render on changes
 * - NOT tied to React - pure JavaScript that could work with any framework
 * 
 * COMPUTED VALUES (NEW):
 * Use getter functions to create derived state that auto-updates:
 * ```typescript
 * const $ = makeState({
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   // Computed value - auto-updates when dependencies change
 *   get fullName() {
 *     return `${this.firstName} ${this.lastName}`;
 *   }
 * });
 * 
 * console.log($.fullName); // "John Doe"
 * $.firstName = 'Jane';
 * console.log($.fullName); // "Jane Doe" - automatically updated!
 * ```
 * 
 * PERFORMANCE OPTIMIZATIONS (NEW):
 * Three built-in methods to control reactivity for streaming/bulk updates:
 * 
 * DEFAULT BEHAVIOR: 50ms debounce - smooth streaming UX
 * - Optimized for streaming scenarios (chat, AI responses, real-time updates)
 * - Creates nice "typing" effect without excessive re-renders
 * - Set to 0 for immediate updates if needed (buttons, forms)
 * 
 * 1. batch() - Group multiple updates → single render
 *    Example: Processing 100 items → 1 render instead of 100
 * 
 * 2. setDebounce() - Adjust delay for different scenarios
 *    Example: Set to 0ms for immediate, 16ms for frame-sync, 100ms+ for high-frequency
 * 
 * 3. flush() - Force immediate render of pending changes
 *    Example: Stream ends → show final state immediately
 * 
 * DEBOUNCE VALUES FOR DIFFERENT SCENARIOS:
 * - 0ms   = Immediate updates - best for buttons, forms, clicks
 * - 16ms  = Frame-rate sync - prevents jank, feels instant
 * - 50ms  = Smooth streaming (DEFAULT) - nice "typing" effect
 * - 100ms = Search-as-you-type, autocomplete
 * - 200ms = High-frequency sensors, WebSocket streams
 * 
 * USAGE IN COMPONENTS:
 * ```typescript
 * // ════════════════════════════════════════════════════════════════
 * // BASIC USAGE - 50ms debounce for smooth streaming
 * // ════════════════════════════════════════════════════════════════
 * const $ = makeState({ count: 0, name: '' });
 * $.count++; // Updates smoothly within 50ms
 * 
 * // ════════════════════════════════════════════════════════════════
 * // COMPUTED VALUES - Derived state that auto-updates!
 * // ════════════════════════════════════════════════════════════════
 * const $ = makeState({
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   age: 30,
 *   items: ['a', 'b', 'c'],
 *   
 *   // Simple computed value
 *   get fullName() {
 *     return `${this.firstName} ${this.lastName}`;
 *   },
 *   
 *   // Computed from primitive
 *   get isAdult() {
 *     return this.age >= 18;
 *   },
 *   
 *   // Computed from other computed value
 *   get greeting() {
 *     return `Hello, ${this.fullName}!`;
 *   },
 *   
 *   // Computed from array
 *   get itemCount() {
 *     return this.items.length;
 *   }
 * });
 * 
 * console.log($.fullName);  // "John Doe"
 * $.firstName = 'Jane';
 * console.log($.fullName);  // "Jane Doe" - automatically updated!
 * 
 * // ════════════════════════════════════════════════════════════════
 * // DEBOUNCE CONTROL
 * // ════════════════════════════════════════════════════════════════
 * $.$setDebounce(0);   // Immediate updates for forms/buttons
 * $.$setDebounce(16);  // Frame-rate sync (no jank)
 * 
 * // ════════════════════════════════════════════════════════════════
 * // BATCHING - Multiple updates, single render
 * // ════════════════════════════════════════════════════════════════
 * $.$batch(() => {
 *   $.count = 100;
 *   $.name = 'John';
 *   $.active = true;
 * }); // Single re-render
 * ```
 * 
 * WHEN TO USE OPTIMIZATIONS:
 * - NO optimization needed: Small updates (1-3 properties), infrequent changes
 * - Use batch(): Related bulk updates, complex state transitions
 * - Use debounce(): Streaming data, rapid user input, high-frequency updates
 * - Use both: Real-time monitoring with frequent data bursts
 * 
 * @template T - The type of the state object
 */
export class ReactiveState<T extends Record<string, any>> {
    // ═════════════════════════════════════════════════════════════════════════
    // INTERNAL STATE STORAGE
    // ═════════════════════════════════════════════════════════════════════════
    // The actual state object - this is what stores the real data
    // Users never access this directly - they always go through the proxy
    private state: T;
    
    // ═════════════════════════════════════════════════════════════════════════
    // SUBSCRIBER REGISTRY
    // ═════════════════════════════════════════════════════════════════════════
    // Set of callback functions to call when state changes
    // Using Set instead of Array for:
    // - O(1) add/remove operations
    // - Automatic deduplication (same listener won't be added twice)
    // - Order preservation (though order doesn't matter here)
    private listeners: Set<() => void> = new Set();
    
    // ═════════════════════════════════════════════════════════════════════════
    // BATCHING & DEBOUNCING CONTROL
    // ═════════════════════════════════════════════════════════════════════════
    // Controls for optimizing multiple rapid state changes
    // Default: 50ms - smooth streaming UX with nice "typing" effect
    // Set to 0 for immediate updates, 16ms for frame-sync, 100ms+ for high-frequency
    private isBatching: boolean = false;
    private debounceTimer: NodeJS.Timeout | null = null;
    private debounceDelay: number = 50;
    
    // ═════════════════════════════════════════════════════════════════════════
    // PROPERTY WATCHERS
    // ═════════════════════════════════════════════════════════════════════════
    // Map of property names to their watchers
    // Watchers are called AFTER the debounce/batch (when UI updates)
    private watchers: Map<string | symbol, Set<PropertyWatcher<any>>> = new Map();
    // Store last values for comparison
    private lastValues: Map<string | symbol, any> = new Map();
    // Track if watchMany was already called (idempotent guard)
    private watchManyInitialized: boolean = false;
    
    // ═════════════════════════════════════════════════════════════════════════
    // THE REACTIVE PROXY
    // ═════════════════════════════════════════════════════════════════════════
    // This is what users interact with
    // All property access/assignment goes through this proxy
    // The proxy intercepts operations and adds reactive behavior
    private proxy: T;

    constructor(initialState: T) {
        this.state = initialState;
        // Create the proxy wrapper around our state
        this.proxy = this.createProxy(this.state) as T;
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * PROXY FACTORY - The Heart of Reactivity
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Creates a JavaScript Proxy that intercepts property operations:
     * - get: When reading properties ($.count)
     * - set: When writing properties ($.count = 5)
     * 
     * NUANCE: This creates nested proxies for deep reactivity
     * Example: $.user.name = 'John' will trigger updates even though
     * 'user' is a nested object
     * 
     * @param target - The object to wrap with a proxy
     * @param path - The current path for debugging (e.g., 'user.profile.name')
     * @returns A proxy object that triggers updates on property changes
     */
    private createProxy(target: any, path: string = ''): any {
        return new Proxy(target, {
            // ═════════════════════════════════════════════════════════════════
            // SET TRAP - Intercepts property assignments
            // ═════════════════════════════════════════════════════════════════
            // Called whenever: proxy.someProperty = newValue
            // 
            // Parameters:
            // - obj: The target object being modified
            // - prop: The property name being set
            // - value: The new value being assigned
            //
            // CRITICAL: Must return true to indicate success
            set: (obj, prop, value) => {
                const fullPath = path ? `${path}.${String(prop)}` : String(prop);
                
                // ═════════════════════════════════════════════════════════════
                // STEP 1: Actually update the value
                // ═════════════════════════════════════════════════════════════
                // This is the "normal" assignment that would happen anyway
                obj[prop] = value;
                
                // ═════════════════════════════════════════════════════════════
                // STEP 2: Notify all subscribers
                // ═════════════════════════════════════════════════════════════
                // This is the "reactive" part - tell everyone who cares
                // In React components, this triggers forceUpdate()
                this.notifyListeners();
                
                // ═════════════════════════════════════════════════════════════
                // STEP 3: Debug logging
                // ═════════════════════════════════════════════════════════════
                // Helps track state changes during development
                // Could be disabled in production for performance
                // console.log(`🔄 State updated: ${fullPath} = ${JSON.stringify(value)}`);
                
                // Must return true to indicate the set operation succeeded
                return true;
            },
            
            // ═════════════════════════════════════════════════════════════════
            // GET TRAP - Intercepts property reads
            // ═════════════════════════════════════════════════════════════════
            // Called whenever: proxy.someProperty
            // 
            // This is where deep reactivity AND computed values happen!
            // - Nested objects get wrapped in proxies for deep reactivity
            // - Getter functions (computed values) are called with proper context
            get: (obj, prop, receiver) => {
                // ═════════════════════════════════════════════════════════════
                // COMPUTED VALUES - Check if this is a getter function
                // ═════════════════════════════════════════════════════════════
                // Getters are defined as: get propertyName() { return ... }
                // We need to detect them and call them with the proxy as 'this'
                // so that accessing this.firstName inside the getter goes through
                // the proxy and maintains reactivity
                const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
                if (descriptor && descriptor.get) {
                    // Call the getter with the receiver (proxy) as 'this'
                    // This ensures computed values access other reactive properties
                    return descriptor.get.call(receiver);
                }
                
                const value = obj[prop];
                
                // ═════════════════════════════════════════════════════════════
                // DEEP REACTIVITY - Wrap nested objects in proxies
                // ═════════════════════════════════════════════════════════════
                // If the value is an object, create a nested proxy
                // This allows: $.user.name = 'John' to trigger updates
                //
                // We check for:
                // - value exists and is an object
                // - NOT an array (arrays need special handling we don't do yet)
                // - NOT a File (DOM objects shouldn't be proxied)
                // - NOT a function (functions should not be proxied)
                //
                // LIMITATION: Arrays are not deeply reactive in this implementation
                // $.items[0].name = 'x' won't trigger updates
                // But $.items = [...] will work
                if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof File)) {
                    return this.createProxy(value, path ? `${path}.${String(prop)}` : String(prop));
                }
                
                // For primitives, functions, and special objects, just return as-is
                return value;
            }
        });
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * SUBSCRIBE - Register a listener for state changes
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * This is called by makeState() to connect React components to state changes
     * 
     * Flow:
     * 1. Component calls makeState()
     * 2. makeState() calls subscribe(forceUpdate)
     * 3. When state changes, forceUpdate() is called
     * 4. Component re-renders
     * 
     * @param listener - Function to call when state changes (typically forceUpdate)
     * @returns Unsubscribe function - call this to stop listening
     */
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        
        // Return cleanup function (closure captures listener reference)
        // Calling this function removes the listener from the Set
        // IMPORTANT: This prevents memory leaks when components unmount
        return () => this.listeners.delete(listener);
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * NOTIFY LISTENERS - Broadcast changes to all subscribers
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Called internally by the 'set' trap whenever state changes
     * 
     * NUANCE: This notifies ALL listeners on ANY change
     * - No fine-grained updates (unlike Valtio)
     * - Every subscribed component re-renders
     * - Simple but less optimized for large apps
     * 
     * OPTIMIZATION: Respects batching and debouncing
     * - If batching is enabled, notifications are suppressed until batch ends
     * - If debouncing is enabled, notifications are delayed and coalesced
     * - Property watchers are called AFTER the debounce (when UI updates)
     * 
     * For most component-local state, this is perfectly fine!
     */
    private notifyListeners() {
        // Skip notifications during batching
        if (this.isBatching) {
            return;
        }
        
        // If debouncing is enabled, delay the notification
        if (this.debounceDelay > 0) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
                // Notify UI listeners
                this.listeners.forEach(listener => listener());
                // Notify property watchers (after debounce)
                this.notifyWatchers();
            }, this.debounceDelay);
            return;
        }
        
        // Immediate notification
        this.listeners.forEach(listener => listener());
        this.notifyWatchers();
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * NOTIFY WATCHERS - Call property-specific watchers
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Called after the state debounce, when UI actually updates
     * Checks each watched property and calls callbacks if value changed
     */
    private notifyWatchers() {
        this.watchers.forEach((watcherSet, property) => {
            const currentValue = this.state[property as keyof T];
            const lastValue = this.lastValues.get(property);
            
            // Only notify if value actually changed
            if (currentValue !== lastValue) {
                this.lastValues.set(property, currentValue);
                
                // Call all watchers for this property
                watcherSet.forEach(watcher => {
                    const { callback, options, debounceTimer } = watcher;
                    
                    // Apply watcher-specific debounce if specified
                    if (options.debounce && options.debounce > 0) {
                        if (debounceTimer) {
                            clearTimeout(debounceTimer);
                        }
                        watcher.debounceTimer = setTimeout(() => {
                            callback(currentValue, lastValue);
                        }, options.debounce);
                    } else {
                        // Call immediately (respects state debounce already)
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
     * 
     * Returns the proxy object that users interact with
     * 
     * IMPORTANT: Always returns the SAME proxy instance
     * - Referential equality is maintained
     * - Components can safely use it in dependencies
     * - React won't see it as a "new" object on each render
     * 
     * @returns The reactive state proxy
     */
    getState(): T {
        return this.proxy;
    }

    /**
     * ═════════════════════════════════════════════════════════════════════════
     * BATCH UPDATES - Group multiple state changes together
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Temporarily disables notifications during a function execution.
     * All state changes are applied, but listeners are only notified once at the end.
     * 
     * Benefits:
     * - Reduce number of re-renders
     * - Better performance for bulk updates
     * - Perfect for processing streaming data
     * 
     * Example usage:
     * stateManager.batch(() => {
     *   $.count = 1;
     *   $.name = 'John';
     *   $.active = true;
     * }); // Only one re-render instead of three
     * 
     * Example with streaming data:
     * stateManager.batch(() => {
     *   streamedChunks.forEach(chunk => {
     *     $.message += chunk; // Many updates
     *   });
     * }); // Only one re-render at the end
     * 
     * @param updates - Function containing multiple state updates
     */
    batch(updates: () => void) {
        // Set batching flag to suppress notifications
        this.isBatching = true;
        
        try {
            // Execute all the updates
            updates();
        } finally {
            // Always reset the flag, even if updates() throws
            this.isBatching = false;
            
            // Now notify listeners once for all the changes
            this.notifyListeners();
        }
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * SET DEBOUNCE - Configure debounced notifications for optimal UX
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Controls how long to wait after state changes before triggering UI updates.
     * Default is 50ms - optimized for smooth streaming with nice "typing" effect.
     * 
     * Change to 0ms for immediate updates (buttons, forms) or higher for
     * more aggressive batching of high-frequency updates.
     * 
     * UX GUIDELINES:
     * - 0ms = Immediate, best for buttons/forms/direct user input
     * - 16ms = Frame-rate sync, prevents jank
     * - 50ms (default) = Smooth streaming text, nice "typing" effect
     * - 100ms = Search-as-you-type, autocomplete
     * - 200ms = High-frequency sensors/real-time data
     * 
     * Example usage:
     * // Default is 50ms (smooth streaming)
     * 
     * // Change to immediate for forms
     * stateManager.setDebounce(0);
     * 
     * // Or keep default for streaming
     * // Rapid changes trigger one render after 50ms of silence
     * $.text += 'a'; // Starts timer
     * $.text += 'b'; // Resets timer
     * $.text += 'c'; // Resets timer
     * // ... 50ms passes with no changes
     * // NOW the UI updates once with all changes
     * 
     * @param delayMs - Delay in milliseconds (default is 50ms)
     */
    setDebounce(delayMs: number) {
        this.debounceDelay = delayMs;
        
        // Clear any existing timer when changing debounce settings
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * FLUSH - Force immediate notification
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * If there's a pending debounced notification, execute it immediately.
     * Useful when you want to ensure the UI is updated right away.
     * 
     * Example:
     * stateManager.setDebounce(1000);
     * $.text += 'streaming...';
     * // Want to show final state immediately when stream ends:
     * stateManager.flush();
     */
    flush() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
            this.listeners.forEach(listener => listener());
            this.notifyWatchers();
        }
    }
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * WATCH - Watch a specific property for changes
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Set up a callback that's called when a specific property changes.
     * Watchers are called AFTER the state debounce (when UI updates), not on
     * every raw assignment.
     * 
     * RESPECTS STATE DEBOUNCE:
     * - If state has 50ms debounce, watcher is called after that 50ms
     * - Can add additional watcher-specific debounce on top
     * - Ensures watchers fire when UI actually updates
     * 
     * TYPE-SAFE:
     * - Property name has autocomplete
     * - Callback parameters are automatically typed
     * - TypeScript catches property name typos
     * 
     * Example usage:
     * ```typescript
     * const $ = makeState({ 
     *   theme: 'dark',
     *   userId: '',
     *   count: 0
     * });
     * 
     * // Watch single property (respects 50ms state debounce)
     * $.$watch('theme', (newTheme, oldTheme) => {
     *   // newTheme and oldTheme are typed as string
     *   localStorage.setItem('theme', newTheme);
     *   console.log(`Theme changed: ${oldTheme} → ${newTheme}`);
     * });
     * 
     * // With additional watcher-specific debounce
     * $.$watch('userId', (user) => {
     *   // Called after 50ms state debounce + 500ms watcher debounce
     *   api.saveUser(user);
     * }, { debounce: 500 });
     * 
     * // Call immediately with current value
     * $.$watch('count', (count) => {
     *   console.log('Count:', count);
     * }, { immediate: true });
     * ```
     * 
     * @param property - Property name to watch (type-safe, autocomplete)
     * @param callback - Called when property changes (typed parameters)
     * @param options - Optional configuration
     * @returns Unwatch function - call to stop watching
     */
    /**
     * Watch properties for changes - convenient for initialization!
     * 
     * IDEMPOTENT: Can be called multiple times, but only the first call has effect.
     * This allows you to call it directly in component body without guards!
     * 
     * FLEXIBLE SYNTAX: Use simple function OR full config object:
     * 
     * @example
     * ```typescript
     * const $ = makeState({ ... });
     * 
     * $.watch({
     *   // ✅ Simple syntax - just the handler function
     *   currentUser: (user, prev) => localStorage.setItem('user', user || ''),
     *   
     *   // ✅ Full syntax - with options
     *   messageInput: {
     *     handler: (msg) => saveDraft(msg),
     *     debounce: 500,
     *     immediate: true
     *   }
     * });
     * 
     * // Even if component re-renders and this code runs again,
     * // watchers are only set up once (automatic re-entry protection)
     * ```
     */
    watch<K extends keyof T>(
        watchMap: {
            [P in K]: 
                | ((newValue: T[P], oldValue: T[P]) => void)  // Simple: just function
                | {                                              // Full: config object
                    handler: (newValue: T[P], oldValue: T[P]) => void;
                    debounce?: number;
                    immediate?: boolean;
                  }
        }
    ): Record<K, () => void> {
        // ═════════════════════════════════════════════════════════════════════════
        // IDEMPOTENT GUARD - Only initialize watchers once
        // ═════════════════════════════════════════════════════════════════════════
        // This makes $.watch() safe to call in component body without useEffect
        // First call: Sets up watchers and returns unwatcher functions
        // Subsequent calls: Returns empty object, no-op
        if (this.watchManyInitialized) {
            console.log('⚠️  $.watch() already called - skipping duplicate setup');
            return {} as Record<K, () => void>;
        }
        
        this.watchManyInitialized = true;
        const unwatchers = {} as Record<K, () => void>;
        
        for (const [property, config] of Object.entries(watchMap) as Array<[K, any]>) {
            // Support both syntaxes:
            // 1. Simple: property: (val) => { ... }
            // 2. Full:   property: { handler: (val) => { ... }, debounce: 500 }
            
            if (typeof config === 'function') {
                // Simple syntax - just a function
                unwatchers[property] = this.watchSingle(property, config);
            } else {
                // Full syntax - object with handler and options
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
     * Internal method: Watch a single property
     */
    private watchSingle<K extends keyof T>(
        property: K,
        callback: (newValue: T[K], oldValue: T[K]) => void,
        options: WatchOptions = {}
    ): () => void {
        // Initialize watcher set for this property if needed
        if (!this.watchers.has(property as string | symbol)) {
            this.watchers.set(property as string | symbol, new Set());
            // Store initial value
            this.lastValues.set(property as string | symbol, this.state[property]);
        }
        
        // Create watcher object
        const watcher: PropertyWatcher<T[K]> = {
            callback,
            options
        };
        
        // Add to watchers
        const watcherSet = this.watchers.get(property as string | symbol)!;
        watcherSet.add(watcher);
        
        // Call immediately if requested
        if (options.immediate) {
            const currentValue = this.state[property];
            callback(currentValue, currentValue);
        }
        
        // Return unwatch function
        return () => {
            watcherSet.delete(watcher);
            // Clean up if no more watchers for this property
            if (watcherSet.size === 0) {
                this.watchers.delete(property as string | symbol);
                this.lastValues.delete(property as string | symbol);
            }
            // Clear any pending debounce timer
            if (watcher.debounceTimer) {
                clearTimeout(watcher.debounceTimer);
            }
        };
    }
}

/**
 * Type for state initialization result
 */
type StateInitResult<T> = T | {
    state: T;
    cleanup?: () => void;
};

/**
 * Type for state initializer function
 */
type StateInitializer<T> = () => StateInitResult<T>;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * StateControls - Performance Optimization Methods
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * These methods are automatically attached to every state object returned by
 * makeState() or useReactiveState(). They help optimize performance when
 * dealing with streaming data or bulk updates.
 * 
 * REAL-WORLD PATTERNS:
 * 
 * 1. STREAMING CHAT RESPONSES:
 * ```typescript
 * const $ = makeState({ message: '', isStreaming: false });
 * 
 * useEffect(() => {
 *   $.$setDebounce(50); // Update UI every 50ms instead of every token
 * }, []);
 * 
 * async function streamResponse(tokens: string[]) {
 *   $.isStreaming = true;
 *   for (const token of tokens) {
 *     $.message += token; // Doesn't immediately render!
 *     await sleep(10);
 *   }
 *   $.isStreaming = false;
 *   $.$flush(); // Force final render immediately
 * }
 * // Result: 5-10 smooth updates instead of 100+ renders
 * ```
 * 
 * 2. BULK DATA PROCESSING:
 * ```typescript
 * const $ = makeState({ items: [], count: 0 });
 * 
 * function processBatch(data: Item[]) {
 *   $.$batch(() => {
 *     data.forEach(item => {
 *       $.items.push(item);
 *       $.count++;
 *     });
 *   }); // Only one render for the entire batch
 * }
 * ```
 * 
 * 3. TEMPORARILY DISABLE UPDATES:
 * ```typescript
 * const $ = makeState({ rows: [] });
 * 
 * function loadHugeDataset() {
 *   $.$setDebounce(999999); // Effectively disable updates
 *   
 *   $.$batch(() => {
 *     for (let i = 0; i < 10000; i++) {
 *       $.rows.push(createRow(i));
 *     }
 *   });
 *   
 *   $.$setDebounce(0); // Re-enable
 *   $.$flush(); // Show final result
 * }
 * ```
 * 
 * 4. COMBINING BATCH + DEBOUNCE:
 * ```typescript
 * const $ = makeState({ metrics: [], alerts: [] });
 * 
 * useEffect(() => {
 *   $.$setDebounce(200); // Max 5 updates/sec
 * }, []);
 * 
 * function onDataBurst(metrics: Metric[], alerts: Alert[]) {
 *   $.$batch(() => {
 *     $.metrics.push(...metrics);
 *     $.alerts.push(...alerts);
 *   }); // Batched + debounced = super efficient!
 * }
 * ```
 * 
 * DEBOUNCE VALUES FOR GOOD UX (User Experience Guidelines):
 * - 0ms   = Immediate updates - buttons, forms, direct user input
 * - 16ms  = Frame-rate sync - prevents jank, still feels instant
 * - 50ms  = Smooth streaming (DEFAULT) - nice "typing" effect
 * - 100ms = Search-as-you-type, autocomplete
 * - 200ms = High-frequency sensors, WebSocket streams
 * 
 * PERFORMANCE TIPS:
 * - Default 50ms works great for most streaming scenarios
 * - Use $setDebounce(0) for immediate updates (buttons, forms)
 * - Use $batch() for related bulk updates
 * - Combine batch + debounce for maximum efficiency
 * 
 * IMPORTANT NOTES:
 * - DEFAULT: 50ms - optimized for smooth streaming UX
 * - Debouncing delays UI updates, NOT state changes (state updates immediately)
 * - Timers are automatically cleaned up on component unmount
 * - Each makeState() instance has independent settings
 * - Set to 0 for immediate updates when needed
 */
export type StateControls<T = any> = {
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * $batch() - Group multiple state changes into a single render cycle
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Temporarily disables notifications during the update function.
     * All state changes apply immediately, but listeners are notified once at the end.
     * 
     * @param updates - Function containing multiple state updates
     * 
     * @example
     * // ❌ Without batching: 3 separate re-renders
     * $.count = 10;
     * $.name = 'John';
     * $.active = true;
     * 
     * // ✅ With batching: 1 re-render
     * $.$batch(() => {
     *   $.count = 10;
     *   $.name = 'John';
     *   $.active = true;
     * });
     */
    $batch: (updates: () => void) => void;
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * $setDebounce() - Configure debounce delay for different use cases
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Controls how long to wait after state changes before updating the UI.
     * Default is 50ms - optimized for smooth streaming with nice "typing" effect.
     * 
     * @param delayMs - Delay in milliseconds (default is 50ms)
     * 
     * RECOMMENDED VALUES FOR GOOD UX:
     * - 0ms   = Immediate updates - buttons, forms, clicks, direct input
     * - 16ms  = Frame-rate sync - prevents jank, still feels instant
     * - 50ms  = Smooth streaming (DEFAULT) - nice "typing" effect
     * - 100ms = Search-as-you-type, autocomplete
     * - 200ms = High-frequency sensors, real-time data streams
     * 
     * @example
     * // DEFAULT: 50ms (smooth streaming)
     * const $ = makeState({ message: '' });
     * // Already has 50ms debounce - no need to set
     * 
     * // Change to immediate for forms/buttons
     * $.$setDebounce(0);
     * $.count++; // Renders immediately
     * 
     * // Keep default for streaming
     * for (const token of tokens) {
     *   $.message += token; // Updates smoothly every 50ms
     * }
     * 
     * // How debounce works:
     * $.text += 'a'; // Starts 50ms timer
     * $.text += 'b'; // Resets timer to 50ms
     * $.text += 'c'; // Resets timer to 50ms
     * // ... 50ms passes with no changes
     * // NOW UI updates once with "abc"
     */
    $setDebounce: (delayMs: number) => void;
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * $flush() - Force immediate notification of pending changes
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * If there's a pending debounced notification, execute it immediately.
     * Useful when you want to ensure the UI is updated right away.
     * 
     * @example
     * $.$setDebounce(1000);
     * $.text += 'streaming...';
     * // Want to show final state immediately when stream ends:
     * $.$flush();
     */
    $flush: () => void;
    
    /**
     * ═════════════════════════════════════════════════════════════════════════
     * $watch() - Watch a specific property for changes (TYPE-SAFE!)
     * ═════════════════════════════════════════════════════════════════════════
     * 
     * Set up a callback that's called when a specific property changes.
     * 
     * RESPECTS STATE DEBOUNCE:
     * - Watchers are called AFTER the state debounce (when UI updates)
     * - If state has 50ms debounce, watcher fires after that 50ms
     * - Can add additional watcher-specific debounce on top
     * 
     * TYPE-SAFE:
     * - Property names have autocomplete
     * - Callback parameters are automatically typed
     * - TypeScript catches typos and type errors
     * 
     * USE CASES:
     * - Persist specific properties to localStorage
     * - Sync with server when data changes
     * - Analytics tracking
     * - Side effects on specific state changes
     * 
     * @param property - Property name to watch (autocomplete!)
     * @param callback - Called when property changes (typed!)
     * @param options - Optional configuration
     * @returns Unwatch function - call to stop watching
     * 
     * @example
     * const $ = makeState({ 
     *   theme: 'dark', 
     *   userId: '',
     *   count: 0 
     * });
     * 
     * // Watch with autocomplete and type safety
     * $.$watch('theme', (newTheme, oldTheme) => {
     *   // newTheme and oldTheme are typed as string
     *   localStorage.setItem('theme', newTheme);
     *   console.log(`${oldTheme} → ${newTheme}`);
     * });
     * 
     * // Additional watcher-specific debounce
     * $.$watch('userId', (user) => {
     *   api.saveUser(user); // Debounced save
     * }, { debounce: 500 });
     * 
     * // Unwatch when done
     * const unwatch = $.$watch('count', (count) => {
     *   console.log('Count:', count);
     * });
     * unwatch(); // Stop watching
     */
    /**
     * Watch properties for changes - convenient API for initialization
     * 
     * FLEXIBLE SYNTAX: Use simple function OR full config:
     * IDEMPOTENT: Safe to call multiple times (only first call has effect)
     * 
     * @example
     * ```typescript
     * const unwatchers = $.watch({
     *   // Simple syntax
     *   currentUser: (user) => saveUser(user),
     *   
     *   // Full syntax with options
     *   messageInput: {
     *     handler: (msg) => saveDraft(msg),
     *     debounce: 500
     *   }
     * });
     * ```
     */
    $watch: <K extends keyof T>(
        watchMap: {
            [P in K]: 
                | ((newValue: T[P], oldValue: T[P]) => void)
                | {
                    handler: (newValue: T[P], oldValue: T[P]) => void;
                    debounce?: number;
                    immediate?: boolean;
                  }
        }
    ) => Record<K, () => void>;
};

/**
 * Clean API function that wraps all the React boilerplate for reactive state
 * 
 * This function creates a reactive state object that automatically triggers
 * UI updates when properties are assigned. It handles all the React hooks
 * internally (useRef, useState, useEffect) so you don't have to.
 * 
 * @template T - The type of the state object
 * @param initialState - The initial state values or a function that returns them (for lazy initialization)
 * @returns A reactive state object that triggers UI updates on property changes
 * 
 * @example
 * ```typescript
 * interface AppState {
 *   loading: boolean;
 *   user: string;
 *   data: any[];
 * }
 * 
 * function MyComponent() {
 *   const $ = makeState<AppState>({
 *     loading: false,
 *     user: '',
 *     data: []
 *   });
 * 
 *   // Direct assignment triggers UI updates automatically!
 *   $.loading = true;
 *   $.user = 'john';
 *   $.data = [1, 2, 3];
 * 
 *   return <div>{$.user}</div>;
 * }
 * 
 * // Batch updates example (one re-render instead of three):
 * function MyComponent() {
 *   const $ = makeState({ count: 0, name: '', active: false });
 *   
 *   const handleBulkUpdate = () => {
 *     $.$batch(() => {
 *       $.count = 1;
 *       $.name = 'John';
 *       $.active = true;
 *     });
 *   };
 * }
 * 
 * // Debounce streaming updates:
 * function StreamingComponent() {
 *   const $ = makeState({ text: '' });
 *   
 *   useEffect(() => {
 *     // Set 100ms debounce for streaming updates
 *     $.$setDebounce(100);
 *     
 *     // Simulate streaming data
 *     const stream = connectToStream();
 *     stream.on('chunk', (chunk) => {
 *       $.text += chunk; // Won't render on every chunk!
 *     });
 *     
 *     stream.on('end', () => {
 *       $.$flush(); // Force immediate render of final state
 *     });
 *   }, []);
 * }
 * 
 * // With cleanup example:
 * function MyComponent() {
 *   const $ = makeState(() => {
 *     const client = new PotoClient('http://localhost:3000');
 *     return {
 *       state: { client, isConnected: true },
 *       cleanup: () => {
 *         client.disconnect();
 *         console.log('🧹 Cleaned up client');
 *       }
 *     };
 *   });
 * }
 * ```
 */
export function makeState<T extends Record<string, any>>(
    initialState: T | StateInitializer<T>
): T & StateControls<T> {
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: This function MUST be called inside a React component function
    // ═══════════════════════════════════════════════════════════════════════════
    // It uses React hooks (useRef, useState, useEffect) internally, which means:
    // ❌ Cannot be called at module level (outside components)
    // ❌ Cannot be called conditionally (if/else)
    // ❌ Cannot be called in loops
    // ✅ Must be called at top level of component function, consistently
    
    // ═══════════════════════════════════════════════════════════════════════════
    // LAZY INITIALIZATION PATTERN
    // ═══════════════════════════════════════════════════════════════════════════
    // useRef persists the ReactiveState instance across re-renders
    // - Initial value: null
    // - After first render: ReactiveState instance
    // - On subsequent renders: Same ReactiveState instance (not recreated!)
    //
    // Why useRef instead of useState?
    // - useState would trigger re-render when setting initial value
    // - useRef is perfect for "instance variables" that don't need to trigger renders
    // - The ReactiveState instance itself never changes, only its internal state does
    const stateManager = useRef<ReactiveState<T> | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION GUARD - Runs only on FIRST render
    // ═══════════════════════════════════════════════════════════════════════════
    // This if-block only executes once when stateManager.current is null
    // On subsequent re-renders, this block is skipped entirely
    //
    // NUANCE: This runs during render phase, NOT in useEffect!
    // - Pro: State is available immediately on first render
    // - Con: Must not have side effects (per React rules)
    // - Safe here: We're just creating objects, not doing I/O
    if (!stateManager.current) {
        let state: T;
        
        // ═════════════════════════════════════════════════════════════════════════
        // PATTERN 1: Function-based initialization (lazy init + optional cleanup)
        // ═════════════════════════════════════════════════════════════════════════
        if (typeof initialState === 'function') {
            // Call the initializer function
            // This is where expensive operations happen (creating clients, connections, etc.)
            const result = (initialState as StateInitializer<T>)();
            
            // ═════════════════════════════════════════════════════════════════════
            // PATTERN 1A: Object with 'state' and optional 'cleanup'
            // ═════════════════════════════════════════════════════════════════════
            // Example: { state: {...}, cleanup: () => {...} }
            // This pattern enables resource cleanup on unmount
            if (result && typeof result === 'object' && 'state' in result) {
                state = result.state;
                cleanupRef.current = result.cleanup || null;
            } 
            // ═════════════════════════════════════════════════════════════════════
            // PATTERN 1B: Direct state object return
            // ═════════════════════════════════════════════════════════════════════
            // Example: () => ({ count: 0 })
            // No cleanup needed, simpler pattern
            else {
                state = result as T;
            }
        } 
        // ═════════════════════════════════════════════════════════════════════════
        // PATTERN 2: Direct object initialization (no function)
        // ═════════════════════════════════════════════════════════════════════════
        // Example: { count: 0 }
        // Simplest pattern, no lazy initialization
        else {
            state = initialState;
        }
        
        // Create the ReactiveState instance with proxy-based reactivity
        // This is the "magic" - any property assignment will notify subscribers
        stateManager.current = new ReactiveState<T>(state);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RE-RENDER TRIGGER MECHANISM
    // ═══════════════════════════════════════════════════════════════════════════
    // useState with ignored first value (we only need the setter)
    // - We don't care about the state value itself ({})
    // - We only use forceUpdate to trigger re-renders
    // - Calling forceUpdate({}) with a new object triggers React's re-render
    //
    // Why this works:
    // - React compares state values with Object.is()
    // - {} !== {} (different object references)
    // - So forceUpdate({}) always triggers a re-render
    const [, forceUpdate] = useState({});
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTION LIFECYCLE - Connect state changes to React re-renders
    // ═══════════════════════════════════════════════════════════════════════════
    // This useEffect runs ONCE after component mounts (empty dependency array [])
    //
    // Flow:
    // 1. Component mounts
    // 2. useEffect runs, subscribes to state changes
    // 3. State changes ($.prop = value)
    // 4. ReactiveState notifies subscribers
    // 5. forceUpdate({}) is called
    // 6. React re-renders component
    // 7. Component reads latest state values
    //
    // IMPORTANT: The empty [] dependency array means this effect:
    // ✅ Runs ONCE on mount
    // ✅ Returns cleanup function that runs ONCE on unmount
    // ❌ NEVER runs again during component lifetime
    useEffect(() => {
        // Subscribe to any state changes
        // When state changes, forceUpdate is called, triggering re-render
        const unsubscribe = stateManager.current!.subscribe(() => {
            forceUpdate({});
        });
        
        // ═════════════════════════════════════════════════════════════════════════
        // CLEANUP FUNCTION - Runs when component unmounts
        // ═════════════════════════════════════════════════════════════════════════
        // This function is called by React when:
        // - Component unmounts (removed from DOM)
        // - Component is destroyed (parent re-renders without this child)
        //
        // Cleanup order:
        // 1. unsubscribe() - Stop listening to state changes
        //    (prevents memory leaks from orphaned listeners)
        // 2. cleanupRef.current() - User-provided cleanup
        //    (close connections, cancel subscriptions, free resources)
        return () => {
            unsubscribe();
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, []); // Empty array = run once on mount, cleanup once on unmount

    // ═══════════════════════════════════════════════════════════════════════════
    // RETURN THE REACTIVE PROXY WITH CONTROL METHODS
    // ═══════════════════════════════════════════════════════════════════════════
    // This returns the same proxy object on every render (referential equality)
    // - First render: Creates and returns proxy with attached control methods
    // - Subsequent renders: Returns same proxy (no recreation)
    //
    // The proxy intercepts property assignments:
    // $.count = 5  →  Proxy's 'set' trap  →  Notify subscribers  →  forceUpdate()
    //
    // NUANCE: The proxy object reference never changes, but the underlying
    // state values DO change. This is safe because:
    // - React re-renders when forceUpdate() is called
    // - On re-render, component reads current values from proxy
    // - React doesn't need to detect changes itself (we handle that)
    const state = stateManager.current.getState() as any;
    
    // Attach control methods to the proxy (only once, first time)
    if (!state.$batch) {
        state.$batch = (updates: () => void) => stateManager.current!.batch(updates);
        state.$setDebounce = (delayMs: number) => stateManager.current!.setDebounce(delayMs);
        state.$flush = () => stateManager.current!.flush();
        state.$watch = <K extends keyof T>(
            watchMap: {
                [P in K]: 
                    | ((newValue: T[P], oldValue: T[P]) => void)
                    | {
                        handler: (newValue: T[P], oldValue: T[P]) => void;
                        debounce?: number;
                        immediate?: boolean;
                      }
            }
        ) => stateManager.current!.watch(watchMap);
    }
    
    return state as T & StateControls<T>;
}

/**
 * Alternative API for creating reactive state with a custom hook pattern
 * 
 * @template T - The type of the state object
 * @param initialState - The initial state values
 * @returns A reactive state object with control methods
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const $ = useReactiveState({
 *     loading: false,
 *     user: ''
 *   });
 * 
 *   $.loading = true; // Triggers re-render
 *   
 *   // Use control methods for optimization
 *   $.$setDebounce(100); // Debounce updates
 *   $.$batch(() => {
 *     $.loading = true;
 *     $.user = 'John';
 *   }); // Batch multiple updates
 * }
 * ```
 */
export function useReactiveState<T extends Record<string, any>>(initialState: T): T & StateControls<T> {
    return makeState(initialState);
}

/**
 * Utility type for creating state interfaces with common patterns
 */
export type StateWithLoading = {
    loading: boolean;
    error?: string;
};

export type StateWithUser = {
    currentUser: string;
    isAuthenticated: boolean;
};

export type StateWithResults<T = any> = {
    results: T;
    error?: string;
};

/**
 * Helper function to create a state object with common patterns
 * 
 * @param baseState - Base state object
 * @param options - Options for common state patterns
 * @returns Enhanced state object with common patterns
 */
export function createStateWithPatterns<T extends Record<string, any>>(
    baseState: T,
    options: {
        withLoading?: boolean;
        withUser?: boolean;
        withResults?: boolean;
    } = {}
): T & Partial<StateWithLoading & StateWithUser & StateWithResults> {
    const enhancedState = { ...baseState };
    
    if (options.withLoading) {
        (enhancedState as any).loading = false;
        (enhancedState as any).error = undefined;
    }
    
    if (options.withUser) {
        (enhancedState as any).currentUser = '';
        (enhancedState as any).isAuthenticated = false;
    }
    
    if (options.withResults) {
        (enhancedState as any).results = {};
        (enhancedState as any).error = undefined;
    }
    
    return enhancedState as T & Partial<StateWithLoading & StateWithUser & StateWithResults>;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * makeStateForClass - Reactive State for Class Components
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Creates a reactive state object that works with React class components.
 * Unlike makeState(), this doesn't use hooks, so it's compatible with classes.
 * 
 * Usage Pattern:
 * ```typescript
 * class MyComponent extends Component {
 *     private $ = makeStateForClass({
 *         loading: false,
 *         count: 0
 *     });
 * 
 *     private unsubscribe?: () => void;
 * 
 *     constructor(props: any) {
 *         super(props);
 *         // Subscribe to changes - triggers forceUpdate on state changes
 *         this.unsubscribe = this.$._subscribe(() => this.forceUpdate());
 *     }
 * 
 *     componentWillUnmount() {
 *         this.unsubscribe?.();
 *     }
 * 
 *     handleClick = () => {
 *         this.$.count++; // Auto re-renders! No setState needed!
 *     }
 * 
 *     render() {
 *         return <div onClick={this.handleClick}>{this.$.count}</div>;
 *     }
 * }
 * ```
 * 
 * @template T - The type of the state object
 * @param initialState - The initial state values (can be a plain object or factory function)
 * @returns A reactive state proxy with _subscribe method
 */
export function makeStateForClass<T extends Record<string, any>>(
    initialState: T | (() => { state: T; cleanup?: () => void })
): T & { _subscribe: (callback: () => void) => () => void; _cleanup?: () => void } {
    // ═════════════════════════════════════════════════════════════════════════
    // HANDLE FACTORY FUNCTION (like frontend3's lazy initialization pattern)
    // ═════════════════════════════════════════════════════════════════════════
    // If initialState is a function, call it to get the actual state + cleanup
    let actualState: T;
    let cleanupFn: (() => void) | undefined;
    
    if (typeof initialState === 'function') {
        const result = initialState();
        actualState = result.state;
        cleanupFn = result.cleanup;
    } else {
        actualState = initialState;
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // CREATE THE REACTIVE STATE MANAGER
    // ═════════════════════════════════════════════════════════════════════════
    const manager = new ReactiveState(actualState);
    const proxy = manager.getState();
    
    // ═════════════════════════════════════════════════════════════════════════
    // ATTACH HIDDEN METHODS TO PROXY
    // ═════════════════════════════════════════════════════════════════════════
    // _subscribe: Used in constructor to connect state changes to forceUpdate()
    // _cleanup: User-provided cleanup function (if any)
    (proxy as any)._subscribe = (callback: () => void) => {
        return manager.subscribe(callback);
    };
    
    if (cleanupFn) {
        (proxy as any)._cleanup = cleanupFn;
    }
    
    return proxy as T & { _subscribe: (callback: () => void) => () => void; _cleanup?: () => void };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveComponent - Base Class for Reactive React Components
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * A React Component base class that makes ALL properties reactive automatically.
 * Just extend this class and define properties normally - they become reactive!
 * 
 * Usage Pattern:
 * ```typescript
 * import { ReactiveComponent } from './ReactiveState';
 * 
 * class MyCounter extends ReactiveComponent {
 *     // Just declare properties - they become reactive automatically!
 *     count = 0;
 *     message = 'Hello';
 *     loading = false;
 * 
 *     // Methods work normally
 *     increment = () => {
 *         this.count++; // Auto re-renders! No setState needed!
 *     }
 * 
 *     render() {
 *         return <div onClick={this.increment}>{this.count}</div>;
 *     }
 * }
 * ```
 * 
 * How it works:
 * - The constructor returns a Proxy wrapper around `this`
 * - All property assignments are intercepted
 * - Changes trigger forceUpdate() automatically
 * - Pure TypeScript feel - just regular class properties!
 */

import { Component } from 'react';

export class ReactiveComponent<P = {}, S = {}> extends Component<P, S> {
    private _reactiveStateManager?: ReactiveState<any>;
    private _unsubscribe?: () => void;

    constructor(props: P) {
        super(props);
        
        // We'll set up reactivity in a moment, after the subclass constructor runs
        // and initializes all properties
    }

    componentDidMount() {
        // ═════════════════════════════════════════════════════════════════════
        // SET UP REACTIVITY AFTER COMPONENT MOUNTS
        // ═════════════════════════════════════════════════════════════════════
        // At this point, all class properties have been initialized
        // We can now collect them and make them reactive
        
        // Collect all own properties (excluding React/Component internals)
        const reactiveProps: Record<string, any> = {};
        const prototype = Object.getPrototypeOf(this);
        
        // Get all property names defined on the instance
        Object.getOwnPropertyNames(this).forEach(key => {
            // Skip private properties, React internals, and methods
            if (!key.startsWith('_') && 
                key !== 'props' && 
                key !== 'context' && 
                key !== 'refs' &&
                key !== 'updater' &&
                key !== 'state' &&
                typeof (this as any)[key] !== 'function') {
                reactiveProps[key] = (this as any)[key];
            }
        });

        // Create reactive state manager
        this._reactiveStateManager = new ReactiveState(reactiveProps);
        const proxy = this._reactiveStateManager.getState();
        
        // Subscribe to changes
        this._unsubscribe = this._reactiveStateManager.subscribe(() => {
            this.forceUpdate();
        });
        
        // Replace instance properties with proxy getters/setters
        Object.keys(reactiveProps).forEach(key => {
            Object.defineProperty(this, key, {
                get() {
                    return proxy[key];
                },
                set(value) {
                    proxy[key] = value;
                },
                enumerable: true,
                configurable: true
            });
        });
    }

    componentWillUnmount() {
        // Clean up subscription
        if (this._unsubscribe) {
            this._unsubscribe();
        }
    }
}
