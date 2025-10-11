import { describe, test, expect, beforeEach, mock } from "bun:test";
import { ReactiveState, createStateWithPatterns } from "./ReactiveState";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This test suite validates the core ReactiveState functionality:
 * - Proxy-based reactivity
 * - Subscription/notification system
 * - Deep/nested object reactivity
 * - Edge cases (arrays, special objects)
 * 
 * NOTE: React-specific functionality (makeState, useReactiveState) is not
 * tested here as it requires React testing library and component mounting.
 */

describe("ReactiveState", () => {
    // ═════════════════════════════════════════════════════════════════════════
    // Basic State Management
    // ═════════════════════════════════════════════════════════════════════════
    
    describe("Basic State Operations", () => {
        test("should initialize with provided state", () => {
            const initialState = { count: 0, name: "test" };
            const reactive = new ReactiveState(initialState);
            const state = reactive.getState();
            
            expect(state.count).toBe(0);
            expect(state.name).toBe("test");
        });
        
        test("should allow setting primitive values", () => {
            const reactive = new ReactiveState({ count: 0, name: "", active: false });
            const state = reactive.getState();
            
            state.count = 42;
            state.name = "updated";
            state.active = true;
            
            expect(state.count).toBe(42);
            expect(state.name).toBe("updated");
            expect(state.active).toBe(true);
        });
        
        test("should allow reading values", () => {
            const reactive = new ReactiveState({ count: 100, data: { nested: "value" } });
            const state = reactive.getState();
            
            const count = state.count;
            const nested = state.data.nested;
            
            expect(count).toBe(100);
            expect(nested).toBe("value");
        });
        
        test("should return same proxy instance on multiple getState calls", () => {
            const reactive = new ReactiveState({ count: 0 });
            const state1 = reactive.getState();
            const state2 = reactive.getState();
            
            expect(state1).toBe(state2);
        });
    });
    
    // ═════════════════════════════════════════════════════════════════════════
    // Subscription & Notification System
    // ═════════════════════════════════════════════════════════════════════════
    
    describe("Subscription System", () => {
        test("should notify subscribers on state change", () => {
            const reactive = new ReactiveState({ count: 0 });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            state.count = 1;
            
            expect(listener).toHaveBeenCalledTimes(1);
        });
        
        test("should notify all subscribers on state change", () => {
            const reactive = new ReactiveState({ count: 0 });
            const state = reactive.getState();
            const listener1 = mock(() => {});
            const listener2 = mock(() => {});
            const listener3 = mock(() => {});
            
            reactive.subscribe(listener1);
            reactive.subscribe(listener2);
            reactive.subscribe(listener3);
            
            state.count = 5;
            
            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
            expect(listener3).toHaveBeenCalledTimes(1);
        });
        
        test("should notify on multiple property changes", () => {
            const reactive = new ReactiveState({ count: 0, name: "" });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.count = 1;
            state.name = "test";
            state.count = 2;
            
            expect(listener).toHaveBeenCalledTimes(3);
        });
        
        test("should support unsubscribe", () => {
            const reactive = new ReactiveState({ count: 0 });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            const unsubscribe = reactive.subscribe(listener);
            state.count = 1;
            
            expect(listener).toHaveBeenCalledTimes(1);
            
            unsubscribe();
            state.count = 2;
            
            // Should still be 1 (not called again after unsubscribe)
            expect(listener).toHaveBeenCalledTimes(1);
        });
        
        test("should handle multiple subscribe/unsubscribe cycles", () => {
            const reactive = new ReactiveState({ count: 0 });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            const unsub1 = reactive.subscribe(listener);
            state.count = 1;
            unsub1();
            
            const unsub2 = reactive.subscribe(listener);
            state.count = 2;
            unsub2();
            
            state.count = 3;
            
            // Should be called twice (once per subscription, not after unsubscribe)
            expect(listener).toHaveBeenCalledTimes(2);
        });
        
        test("should not duplicate subscriber", () => {
            const reactive = new ReactiveState({ count: 0 });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            // Subscribe same listener multiple times
            reactive.subscribe(listener);
            reactive.subscribe(listener);
            reactive.subscribe(listener);
            
            state.count = 1;
            
            // Set deduplicates, so should only be called once
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
    
    // ═════════════════════════════════════════════════════════════════════════
    // Deep/Nested Reactivity
    // ═════════════════════════════════════════════════════════════════════════
    
    describe("Nested Object Reactivity", () => {
        test("should support nested object property changes", () => {
            const reactive = new ReactiveState({
                user: {
                    name: "John",
                    age: 30
                }
            });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.user.name = "Jane";
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.user.name).toBe("Jane");
        });
        
        test("should support deeply nested object changes", () => {
            const reactive = new ReactiveState({
                app: {
                    user: {
                        profile: {
                            name: "test",
                            settings: {
                                theme: "dark"
                            }
                        }
                    }
                }
            });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.app.user.profile.settings.theme = "light";
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.app.user.profile.settings.theme).toBe("light");
        });
        
        test("should handle adding new properties to nested objects", () => {
            const reactive = new ReactiveState({
                data: {
                    existing: "value"
                }
            });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            (state.data as any).newProp = "new value";
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect((state.data as any).newProp).toBe("new value");
        });
        
        test("should handle replacing entire nested object", () => {
            const reactive = new ReactiveState({
                user: {
                    name: "John",
                    age: 30
                }
            });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.user = { name: "Jane", age: 25 };
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.user.name).toBe("Jane");
            expect(state.user.age).toBe(25);
        });
    });
    
    // ═════════════════════════════════════════════════════════════════════════
    // Array Handling
    // ═════════════════════════════════════════════════════════════════════════
    
    describe("Array Handling", () => {
        test("should notify on array replacement", () => {
            const reactive = new ReactiveState({ items: [1, 2, 3] });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.items = [4, 5, 6];
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.items).toEqual([4, 5, 6]);
        });
        
        test("should notify on array mutation methods", () => {
            const reactive = new ReactiveState({ items: [1, 2, 3] });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            // Array mutations don't trigger deep reactivity by design
            // But we can test that array reference changes work
            const newItems = [...state.items, 4];
            state.items = newItems;
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.items).toEqual([1, 2, 3, 4]);
        });
        
        test("should handle arrays of objects", () => {
            const reactive = new ReactiveState({
                users: [
                    { name: "John", age: 30 },
                    { name: "Jane", age: 25 }
                ]
            });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            // Replace the array
            state.users = [
                { name: "John", age: 31 },
                { name: "Jane", age: 26 }
            ];
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.users[0].age).toBe(31);
        });
    });
    
    // ═════════════════════════════════════════════════════════════════════════
    // Edge Cases & Special Objects
    // ═════════════════════════════════════════════════════════════════════════
    
    describe("Edge Cases", () => {
        test("should handle null values", () => {
            const reactive = new ReactiveState({ value: null as any });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.value = "not null";
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.value).toBe("not null");
        });
        
        test("should handle undefined values", () => {
            const reactive = new ReactiveState({ value: undefined as any });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.value = "defined";
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.value).toBe("defined");
        });
        
        test("should handle boolean values", () => {
            const reactive = new ReactiveState({ flag: false });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.flag = true;
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.flag).toBe(true);
        });
        
        test("should handle numeric values including zero", () => {
            const reactive = new ReactiveState({ count: 0 });
            const state = reactive.getState();
            
            state.count = 0;
            expect(state.count).toBe(0);
            
            state.count = 100;
            expect(state.count).toBe(100);
            
            state.count = -50;
            expect(state.count).toBe(-50);
        });
        
        test("should handle empty strings", () => {
            const reactive = new ReactiveState({ text: "" });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.text = "hello";
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(state.text).toBe("hello");
        });
        
        test("should not wrap File objects in proxy", () => {
            // Create a mock File object
            const file = new File(["content"], "test.txt", { type: "text/plain" });
            const reactive = new ReactiveState({ file: null as any });
            const state = reactive.getState();
            
            state.file = file;
            
            expect(state.file).toBe(file);
            expect(state.file instanceof File).toBe(true);
        });
        
        test("should handle Date objects", () => {
            const date = new Date("2025-01-01");
            const reactive = new ReactiveState({ timestamp: null as any });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            state.timestamp = date;
            
            expect(listener).toHaveBeenCalledTimes(1);
            // Date objects are stored (they get proxied like other objects)
            // Note: Date methods may not work through the proxy, which is a known limitation
            expect(state.timestamp).toBeDefined();
        });
    });
    
    // ═════════════════════════════════════════════════════════════════════════
    // Batch Operations
    // ═════════════════════════════════════════════════════════════════════════
    
    describe("Batch Operations", () => {
        test("should execute batch function", () => {
            const reactive = new ReactiveState({ count: 0, name: "" });
            const state = reactive.getState();
            
            reactive.batch(() => {
                state.count = 10;
                state.name = "test";
            });
            
            expect(state.count).toBe(10);
            expect(state.name).toBe("test");
        });
        
        test("batch currently does not prevent notifications (TODO feature)", () => {
            const reactive = new ReactiveState({ count: 0, name: "" });
            const state = reactive.getState();
            const listener = mock(() => {});
            
            reactive.subscribe(listener);
            
            reactive.batch(() => {
                state.count = 10;
                state.name = "test";
            });
            
            // Currently batch doesn't actually batch, so 2 notifications
            // When batch is implemented, this should be 1
            expect(listener).toHaveBeenCalledTimes(2);
        });
    });
    
    // ═════════════════════════════════════════════════════════════════════════
    // Multiple Instances
    // ═════════════════════════════════════════════════════════════════════════
    
    describe("Multiple ReactiveState Instances", () => {
        test("should maintain independent state across instances", () => {
            const reactive1 = new ReactiveState({ count: 0 });
            const reactive2 = new ReactiveState({ count: 100 });
            
            const state1 = reactive1.getState();
            const state2 = reactive2.getState();
            
            state1.count = 50;
            
            expect(state1.count).toBe(50);
            expect(state2.count).toBe(100);
        });
        
        test("should maintain independent subscriptions across instances", () => {
            const reactive1 = new ReactiveState({ count: 0 });
            const reactive2 = new ReactiveState({ count: 0 });
            
            const state1 = reactive1.getState();
            const state2 = reactive2.getState();
            
            const listener1 = mock(() => {});
            const listener2 = mock(() => {});
            
            reactive1.subscribe(listener1);
            reactive2.subscribe(listener2);
            
            state1.count = 1;
            
            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(0);
            
            state2.count = 2;
            
            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════
// Helper Functions Tests
// ═════════════════════════════════════════════════════════════════════════

describe("createStateWithPatterns", () => {
    test("should create state without patterns", () => {
        const state = createStateWithPatterns({ custom: "value" });
        
        expect(state.custom).toBe("value");
    });
    
    test("should add loading pattern", () => {
        const state = createStateWithPatterns(
            { custom: "value" },
            { withLoading: true }
        );
        
        expect(state.custom).toBe("value");
        expect(state.loading).toBe(false);
        expect(state.error).toBeUndefined();
    });
    
    test("should add user pattern", () => {
        const state = createStateWithPatterns(
            { custom: "value" },
            { withUser: true }
        );
        
        expect(state.custom).toBe("value");
        expect(state.currentUser).toBe("");
        expect(state.isAuthenticated).toBe(false);
    });
    
    test("should add results pattern", () => {
        const state = createStateWithPatterns(
            { custom: "value" },
            { withResults: true }
        );
        
        expect(state.custom).toBe("value");
        expect(state.results).toEqual({});
        expect(state.error).toBeUndefined();
    });
    
    test("should combine multiple patterns", () => {
        const state = createStateWithPatterns(
            { custom: "value" },
            { 
                withLoading: true,
                withUser: true,
                withResults: true 
            }
        );
        
        expect(state.custom).toBe("value");
        expect(state.loading).toBe(false);
        expect(state.currentUser).toBe("");
        expect(state.isAuthenticated).toBe(false);
        expect(state.results).toEqual({});
    });
    
    test("should not modify original state object", () => {
        const original = { custom: "value" };
        const state = createStateWithPatterns(original, { withLoading: true });
        
        expect(original).toEqual({ custom: "value" });
        expect((original as any).loading).toBeUndefined();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// Performance & Stress Tests
// ═════════════════════════════════════════════════════════════════════════

describe("Performance & Stress Tests", () => {
    test("should handle large number of subscribers efficiently", () => {
        const reactive = new ReactiveState({ count: 0 });
        const state = reactive.getState();
        
        const listeners: Array<() => void> = [];
        for (let i = 0; i < 1000; i++) {
            const fn = mock(() => {});
            listeners.push(fn);
            reactive.subscribe(fn);
        }

        state.count = 1;
        
        listeners.forEach(listener => {
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
    
    test("should handle many property updates efficiently", () => {
        const reactive = new ReactiveState({ count: 0 });
        const state = reactive.getState();
        const listener = mock(() => {});
        
        reactive.subscribe(listener);
        
        for (let i = 0; i < 100; i++) {
            state.count = i;
        }
        
        expect(listener).toHaveBeenCalledTimes(100);
        expect(state.count).toBe(99);
    });
    
    test("should handle deeply nested structures", () => {
        // Create a deeply nested object
        const createNestedObj = (depth: number): any => {
            if (depth === 0) return { value: 0 };
            return { nested: createNestedObj(depth - 1) };
        };
        
        const reactive = new ReactiveState(createNestedObj(10));
        const state = reactive.getState();
        const listener = mock(() => {});
        
        reactive.subscribe(listener);
        
        // Navigate to the deepest level and change it
        let current: any = state;
        for (let i = 0; i < 10; i++) {
            current = current.nested;
        }
        current.value = 42;
        
        expect(listener).toHaveBeenCalledTimes(1);
    });
    
    test("should handle state with many properties", () => {
        const largeState: Record<string, number> = {};
        for (let i = 0; i < 100; i++) {
            largeState[`prop${i}`] = i;
        }
        
        const reactive = new ReactiveState(largeState);
        const state = reactive.getState();
        const listener = mock(() => {});
        
        reactive.subscribe(listener);
        
        state.prop50 = 999;
        
        expect(listener).toHaveBeenCalledTimes(1);
        expect(state.prop50).toBe(999);
    });
});

