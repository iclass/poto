/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Vanilla TypeScript/JavaScript Usage Examples
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * These examples show how to use ReactiveState.core.ts in vanilla TypeScript,
 * Node.js, or any JavaScript environment WITHOUT React.
 */

import { ReactiveState } from './ReactiveState.core';

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Simple Counter (Vanilla JS)
// ═══════════════════════════════════════════════════════════════════════════
function vanillaCounterExample() {
    // Create reactive state
    const counterState = new ReactiveState({
        count: 0,
        label: 'Counter'
    });
    
    // Get the reactive proxy
    const state = counterState.getState();
    
    // Subscribe to changes
    const unsubscribe = counterState.subscribe(() => {
        console.log(`State changed! Count: ${state.count}`);
        // Update DOM or trigger any side effect
        updateUI();
    });
    
    function updateUI() {
        // In browser: document.getElementById('counter').textContent = state.count;
        // In Node.js: Just log or use the value
        console.log(`UI Updated: ${state.label} = ${state.count}`);
    }
    
    // Make changes - automatically triggers subscribers
    state.count++; // Logs: "State changed! Count: 1"
    state.count++; // Logs: "State changed! Count: 2"
    state.label = 'My Counter'; // Logs: "State changed! Count: 2"
    
    // Cleanup
    // unsubscribe();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Node.js Backend State Management
// ═══════════════════════════════════════════════════════════════════════════
function backendStateExample() {
    // Server state management (no React!)
    const serverState = new ReactiveState({
        connections: 0,
        activeUsers: [] as string[],
        lastActivity: Date.now(),
        
        // Computed value
        get hasActiveUsers() {
            return this.activeUsers.length > 0;
        }
    });
    
    const state = serverState.getState();
    
    // Subscribe to connection changes
    serverState.subscribe(() => {
        console.log(`📊 Server stats: ${state.connections} connections, ${state.activeUsers.length} users`);
        
        // Could trigger alerts, update metrics, etc.
        if (state.connections > 1000) {
            console.log('⚠️  High connection count!');
        }
    });
    
    // Simulate server events
    state.connections++;
    state.activeUsers.push('user1');
    state.lastActivity = Date.now();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Batch Updates for Performance
// ═══════════════════════════════════════════════════════════════════════════
function batchUpdatesExample() {
    const manager = new ReactiveState({
        items: [] as string[],
        total: 0,
        processed: 0
    });
    
    const state = manager.getState();
    
    let renderCount = 0;
    manager.subscribe(() => {
        renderCount++;
        console.log(`Render #${renderCount}: ${state.processed}/${state.total}`);
    });
    
    // Without batching: 1000 renders!
    // for (let i = 0; i < 1000; i++) {
    //     state.items.push(`item-${i}`);
    //     state.processed++;
    // }
    
    // With batching: 1 render!
    manager.batch(() => {
        for (let i = 0; i < 1000; i++) {
            state.items.push(`item-${i}`);
            state.processed++;
        }
        state.total = 1000;
    });
    
    console.log(`Total renders: ${renderCount}`); // Just 1!
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Debouncing for High-Frequency Updates
// ═══════════════════════════════════════════════════════════════════════════
function debouncingExample() {
    const streamState = new ReactiveState({
        message: '',
        isStreaming: false
    });
    
    const state = streamState.getState();
    
    // Set debounce to 50ms - updates batched within this window
    streamState.setDebounce(50);
    
    streamState.subscribe(() => {
        console.log(`Message: ${state.message}`);
        // In real app: Update UI, send to WebSocket, etc.
    });
    
    // Simulate rapid updates (like streaming text)
    state.isStreaming = true;
    const tokens = ['Hello', ' ', 'world', '!', ' ', 'How', ' ', 'are', ' ', 'you', '?'];
    
    tokens.forEach((token, i) => {
        setTimeout(() => {
            state.message += token;
            
            if (i === tokens.length - 1) {
                state.isStreaming = false;
                streamState.flush(); // Force immediate update
            }
        }, i * 10);
    });
    
    // Result: Only a few updates instead of 11!
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Property Watchers
// ═══════════════════════════════════════════════════════════════════════════
function watchersExample() {
    const appState = new ReactiveState({
        theme: 'dark' as 'light' | 'dark',
        username: '',
        lastSaved: Date.now()
    });
    
    const state = appState.getState();
    
    // Watch specific properties
    const unwatchers = appState.watch({
        // Save theme to storage when it changes
        theme: (newTheme, oldTheme) => {
            console.log(`Theme changed: ${oldTheme} → ${newTheme}`);
            // localStorage.setItem('theme', newTheme);
        },
        
        // Debounced save for username
        username: {
            handler: (user) => {
                console.log(`Saving user: ${user}`);
                // api.saveUser(user);
            },
            debounce: 500, // Wait 500ms after last change
            immediate: false
        }
    });
    
    // Trigger watchers
    state.theme = 'light'; // Logs immediately
    state.username = 'j';   // Won't log yet
    state.username = 'jo';  // Won't log yet
    state.username = 'john'; // Logs after 500ms of no changes
    
    // Cleanup
    // Object.values(unwatchers).forEach(unwatch => unwatch());
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Computed Values (Getters)
// ═══════════════════════════════════════════════════════════════════════════
function computedValuesExample() {
    const userState = new ReactiveState({
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        
        // Computed values automatically update!
        get fullName() {
            return `${this.firstName} ${this.lastName}`;
        },
        
        get isAdult() {
            return this.age >= 18;
        },
        
        get greeting() {
            return `Hello, ${this.fullName}!`;
        }
    });
    
    const state = userState.getState();
    
    console.log(state.fullName); // "John Doe"
    console.log(state.greeting); // "Hello, John Doe!"
    
    // Change triggers automatic recomputation
    state.firstName = 'Jane';
    console.log(state.fullName); // "Jane Doe" - automatically updated!
    console.log(state.greeting); // "Hello, Jane Doe!" - also updated!
}

// ═══════════════════════════════════════════════════════════════════════════
// Run Examples (uncomment to try)
// ═══════════════════════════════════════════════════════════════════════════
export function runVanillaExamples() {
    console.log('\n=== Example 1: Simple Counter ===');
    vanillaCounterExample();
    
    console.log('\n=== Example 2: Backend State ===');
    backendStateExample();
    
    console.log('\n=== Example 3: Batch Updates ===');
    batchUpdatesExample();
    
    console.log('\n=== Example 4: Debouncing ===');
    debouncingExample();
    
    console.log('\n=== Example 5: Property Watchers ===');
    watchersExample();
    
    console.log('\n=== Example 6: Computed Values ===');
    computedValuesExample();
}

// For browser console:
// (window as any).runVanillaExamples = runVanillaExamples;

