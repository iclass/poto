/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState React Adapter
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * React-specific wrappers around the framework-agnostic ReactiveState core.
 * Provides hooks and class-based APIs for React components.
 * 
 * @module ReactiveState.react
 */

import { useRef, useState, useEffect, Component } from "react";
import { ReactiveState, WatchOptions } from "./ReactiveState.core";

/**
 * Type for state initialization result
 * 
 * @deprecated The { state, cleanup } pattern is deprecated. Use $onUnmount() instead.
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
 * StateControls - Control Methods for Reactive State
 * ═══════════════════════════════════════════════════════════════════════════
 */
export type StateControls<T = any> = {
    $batch: (updates: () => void) => void;
    $setDebounce: (delayMs: number) => void;
    $flush: () => void;
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
    $withWatch: <K extends keyof T>(
        watchMap: {
            [P in K]: 
                | ((newValue: T[P], oldValue: T[P]) => void)
                | {
                    handler: (newValue: T[P], oldValue: T[P]) => void;
                    debounce?: number;
                    immediate?: boolean;
                  }
        }
    ) => T & StateControls<T>;
    $onUnmount: (cleanup: () => void) => T & StateControls<T>;
    $initialize: (initializer: () => void) => T & StateControls<T>;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * makeReactiveState - React Hook for Reactive State
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Creates a reactive state object that automatically triggers React re-renders
 * when properties are assigned. Handles all React lifecycle internally.
 * 
 * @template T - The type of the state object
 * @param initialState - Initial state values or factory function
 * @returns Reactive state object with control methods
 * 
 * @example
 * ```typescript
 * const $ = makeReactiveState({ count: 0, name: '' })
 *   .$initialize(() => {
 *     $.count = loadFromStorage();
 *   })
 *   .$withWatch({
 *     count: (c) => saveToStorage(c)
 *   })
 *   .$onUnmount(() => cleanup());
 * 
 * $.count++; // Auto re-renders!
 * ```
 */
export function makeReactiveState<T extends Record<string, any>>(
    initialState: T | StateInitializer<T>
): T & StateControls<T> {
    const stateManager = useRef<ReactiveState<T> | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    
    if (!stateManager.current) {
        let state: T;
        
        if (typeof initialState === 'function') {
            const result = (initialState as StateInitializer<T>)();
            
            if (result && typeof result === 'object' && 'state' in result) {
                state = result.state;
                cleanupRef.current = result.cleanup || null;
            } else {
                state = result as T;
            }
        } else {
            state = initialState;
        }
        
        stateManager.current = new ReactiveState<T>(state);
    }
    
    const [, forceUpdate] = useState({});
    
    useEffect(() => {
        const unsubscribe = stateManager.current!.subscribe(() => {
            forceUpdate({});
        });
        
        return () => {
            unsubscribe();
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, []);

    const state = stateManager.current.getState() as any;
    
    // Attach control methods (only once)
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
        
        state.$withWatch = <K extends keyof T>(
            watchMap: {
                [P in K]: 
                    | ((newValue: T[P], oldValue: T[P]) => void)
                    | {
                        handler: (newValue: T[P], oldValue: T[P]) => void;
                        debounce?: number;
                        immediate?: boolean;
                      }
            }
        ) => {
            stateManager.current!.watch(watchMap);
            return state as T & StateControls<T>;
        };
        
        state.$onUnmount = (cleanup: () => void) => {
            if (!(stateManager.current as any).cleanupInitialized) {
                cleanupRef.current = cleanup;
                (stateManager.current as any).cleanupInitialized = true;
            }
            return state as T & StateControls<T>;
        };
        
        state.$initialize = (initializer: () => void) => {
            if (!(stateManager.current as any).initializerExecuted) {
                initializer();
                (stateManager.current as any).initializerExecuted = true;
            }
            return state as T & StateControls<T>;
        };
    }
    
    return state as T & StateControls<T>;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * useReactiveState - Alternative Hook API
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function useReactiveState<T extends Record<string, any>>(initialState: T): T & StateControls<T> {
    return makeReactiveState(initialState);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * makeReactiveStateForClass - For React Class Components
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Creates reactive state that works with React class components (no hooks).
 * 
 * @example
 * ```typescript
 * class MyComponent extends Component {
 *   private $ = makeReactiveStateForClass({ count: 0 });
 *   private unsubscribe?: () => void;
 *   
 *   constructor(props: any) {
 *     super(props);
 *     this.unsubscribe = this.$._subscribe(() => this.forceUpdate());
 *   }
 *   
 *   componentWillUnmount() {
 *     this.unsubscribe?.();
 *   }
 *   
 *   render() {
 *     return <button onClick={() => this.$.count++}>{this.$.count}</button>;
 *   }
 * }
 * ```
 */
export function makeReactiveStateForClass<T extends Record<string, any>>(
    initialState: T | (() => { state: T; cleanup?: () => void })
): T & { _subscribe: (callback: () => void) => () => void; _cleanup?: () => void } {
    let actualState: T;
    let cleanupFn: (() => void) | undefined;
    
    if (typeof initialState === 'function') {
        const result = initialState();
        actualState = result.state;
        cleanupFn = result.cleanup;
    } else {
        actualState = initialState;
    }
    
    const manager = new ReactiveState(actualState);
    const proxy = manager.getState();
    
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
 * 
 * @example
 * ```typescript
 * class MyCounter extends ReactiveComponent {
 *   count = 0;
 *   
 *   increment = () => {
 *     this.count++; // Auto re-renders!
 *   }
 *   
 *   render() {
 *     return <button onClick={this.increment}>{this.count}</button>;
 *   }
 * }
 * ```
 */
export class ReactiveComponent<P = {}, S = {}> extends Component<P, S> {
    private _reactiveStateManager?: ReactiveState<any>;
    private _unsubscribe?: () => void;

    constructor(props: P) {
        super(props);
    }

    componentDidMount() {
        const reactiveProps: Record<string, any> = {};
        
        Object.getOwnPropertyNames(this).forEach(key => {
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

        this._reactiveStateManager = new ReactiveState(reactiveProps);
        const proxy = this._reactiveStateManager.getState();
        
        this._unsubscribe = this._reactiveStateManager.subscribe(() => {
            this.forceUpdate();
        });
        
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
        if (this._unsubscribe) {
            this._unsubscribe();
        }
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Utility Types
 * ═══════════════════════════════════════════════════════════════════════════
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
 * Helper function to create state with common patterns
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

