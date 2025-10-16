/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Frontend Entry Point for MyAppVanilla
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This demonstrates using REAL JSX syntax without React!
 * 
 * @jsxImportSource ./ReactiveState.jsx
 */

import { initMyAppVanilla } from './MyAppVanilla';
import './styles.css';

// Initialize the vanilla JSX app
function start() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🎯 MyAppVanilla - Real JSX Without React!');
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ Using real JSX syntax: <div>...</div>');
    console.log('✅ NOT using template literals!');
    console.log('✅ Zero React dependency');
    console.log('✅ Custom JSX factory');
    console.log('✅ ~9KB bundle size');
    console.log('═══════════════════════════════════════════════════');
    
    const instance = initMyAppVanilla();
    
    // Hot module reloading support
    if (import.meta.hot) {
        import.meta.hot.data.appInstance = instance;
        import.meta.hot.accept(() => {
            console.log('🔥 Hot module reloading for MyAppVanilla');
            // Re-initialize the app
            initMyAppVanilla();
        });
    }
}

// Check if DOM is already loaded, otherwise wait for it
if (document.readyState === 'loading') {
    // Still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', start);
} else {
    // DOM already loaded, start immediately
    start();
}

