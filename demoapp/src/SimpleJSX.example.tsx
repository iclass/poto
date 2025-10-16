/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Simple Example: REAL JSX WITHOUT REACT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This file demonstrates the difference between:
 * - ❌ Template literals (not JSX)
 * - ✅ Real JSX syntax (without React)
 */

/** @jsxImportSource ./ReactiveState.jsx */

import { createReactiveComponent, mount } from './ReactiveState.jsx.js';

// ═══════════════════════════════════════════════════════════════════════════
// ❌ WRONG: Template Literals (Not JSX!)
// ═══════════════════════════════════════════════════════════════════════════

export function wrongWay_TemplateLiterals() {
    const count = 0;
    
    // This is a STRING, not JSX!
    const htmlString = `
        <div class="counter">
            <p>Count: ${count}</p>
            <button>Click</button>
        </div>
    `;
    
    // Must manually inject into DOM
    const container = document.getElementById('app');
    if (container) {
        container.innerHTML = htmlString;
    }
    
    // Problems:
    // - Not type-safe
    // - Manual DOM manipulation
    // - No event binding
    // - Not reactive
}

// ═══════════════════════════════════════════════════════════════════════════
// ✅ CORRECT: Real JSX (Without React!)
// ═══════════════════════════════════════════════════════════════════════════

export const Counter = createReactiveComponent({
    state: {
        count: 0,
    },
    
    // ✨ THIS IS REAL JSX SYNTAX!
    render: (state) => (
        <div class="counter">
            <p>Count: {state.count}</p>
            <button onclick={() => state.count++}>
                Click Me!
            </button>
        </div>
    )
});

// Mount it
export function initCounter() {
    Counter.mount('#app');
}

// Benefits:
// - ✅ Type-safe
// - ✅ Auto DOM rendering
// - ✅ Event binding works
// - ✅ Reactive updates
// - ✅ Zero React dependency!

// ═══════════════════════════════════════════════════════════════════════════
// Example 2: Static JSX Element
// ═══════════════════════════════════════════════════════════════════════════

export function renderStaticElement() {
    // ✨ REAL JSX - just like React!
    const element = (
        <div class="welcome">
            <h1>Hello, JSX!</h1>
            <p>This is <strong>real JSX</strong> without React!</p>
            <ul>
                <li>✅ Real JSX syntax</li>
                <li>✅ Zero React dependency</li>
                <li>✅ Type-safe</li>
            </ul>
        </div>
    );
    
    // Mount to DOM
    mount(element, '#app');
}

// ═══════════════════════════════════════════════════════════════════════════
// The Key Difference
// ═══════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════');
console.log('Understanding the Difference:');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('❌ Template Literal:');
console.log('   const html = `<div>${value}</div>`;');
console.log('   - This is a STRING');
console.log('   - Not JSX!');
console.log('');
console.log('✅ Real JSX:');
console.log('   const element = <div>{value}</div>;');
console.log('   - This is JSX syntax');
console.log('   - Compiled to: jsx("div", {}, value)');
console.log('   - No React needed!');
console.log('');
console.log('═══════════════════════════════════════════════════');

// ═══════════════════════════════════════════════════════════════════════════
// How TypeScript Processes This File
// ═══════════════════════════════════════════════════════════════════════════

/**
 * When TypeScript compiles this file:
 * 
 * 1. It sees: @jsxImportSource ./ReactiveState.jsx
 * 2. It transforms JSX syntax to function calls:
 *    
 *    <div class="app">Hello</div>
 *    ↓
 *    jsx('div', { class: 'app' }, 'Hello')
 * 
 * 3. Our jsx() function creates a VNode
 * 4. render() converts VNode to real DOM
 * 5. State changes trigger re-renders
 * 
 * Result: JSX without React! ✨
 */

