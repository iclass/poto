import { useRef, useState, useEffect } from "react";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState - Core Reactivity Engine
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This class implements the Observable/PubSub pattern using JavaScript Proxies
 * to intercept property assignments and notify subscribers automatically.
 * 
 * Key Concepts:
 * - Uses Proxy API to intercept reads (get) and writes (set)
 * - Publisher: Notifies all subscribers when state changes
 * - Subscriber: Components that want to re-render on changes
 * - NOT tied to React - pure JavaScript that could work with any framework
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
            // This is where deep reactivity happens!
            // When you read a nested object, we wrap it in a proxy too
            get: (obj, prop) => {
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
                //
                // LIMITATION: Arrays are not deeply reactive in this implementation
                // $.items[0].name = 'x' won't trigger updates
                // But $.items = [...] will work
                if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof File)) {
                    return this.createProxy(value, path ? `${path}.${String(prop)}` : String(prop));
                }
                
                // For primitives and special objects, just return as-is
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
     * For most component-local state, this is perfectly fine!
     */
    private notifyListeners() {
        this.listeners.forEach(listener => listener());
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
     * FUTURE ENHANCEMENT: Currently this just executes immediately
     * 
     * Could be enhanced to:
     * 1. Disable notifications during the batch function
     * 2. Execute all updates
     * 3. Notify listeners once at the end
     * 
     * Benefits:
     * - Reduce number of re-renders
     * - Better performance for bulk updates
     * 
     * Example usage:
     * $.batch(() => {
     *   $.count = 1;
     *   $.name = 'John';
     *   $.active = true;
     * }); // Only one re-render instead of three
     * 
     * @param updates - Function containing multiple state updates
     */
    batch(updates: () => void) {
        // TODO: Implement actual batching
        // For now, just execute - each update still triggers a re-render
        updates();
    }
}

/**
 * Type for state initialization result
 */
type StateInitResult<T> = T | { state: T; cleanup?: () => void };

/**
 * Type for state initializer function
 */
type StateInitializer<T> = () => StateInitResult<T>;

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
 *   const appState: AppState = makeState<AppState>({
 *     loading: false,
 *     user: '',
 *     data: []
 *   });
 * 
 *   // Direct assignment triggers UI updates automatically!
 *   appState.loading = true;
 *   appState.user = 'john';
 *   appState.data = [1, 2, 3];
 * 
 *   return <div>{appState.user}</div>;
 * }
 * 
 * // Lazy initialization example:
 * function MyComponent() {
 *   const appState = makeState(() => ({
 *     client: new ExpensiveClient(),
 *     connection: createConnection()
 *   }));
 * }
 * 
 * // With cleanup example:
 * function MyComponent() {
 *   const appState = makeState(() => {
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
): T {
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
    // RETURN THE REACTIVE PROXY
    // ═══════════════════════════════════════════════════════════════════════════
    // This returns the same proxy object on every render (referential equality)
    // - First render: Creates and returns proxy
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
    return stateManager.current.getState();
}

/**
 * Alternative API for creating reactive state with a custom hook pattern
 * 
 * @template T - The type of the state object
 * @param initialState - The initial state values
 * @returns A reactive state object
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const state = useReactiveState({
 *     loading: false,
 *     user: ''
 *   });
 * 
 *   state.loading = true; // Triggers re-render
 * }
 * ```
 */
export function useReactiveState<T extends Record<string, any>>(initialState: T): T {
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
