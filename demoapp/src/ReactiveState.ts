/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState - Unified Export (Backward Compatibility)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This is the main entry point that re-exports everything for backward compatibility.
 * 
 * ARCHITECTURE:
 * - ReactiveState.core.ts   → Framework-agnostic core (pure TypeScript)
 * - ReactiveState.react.ts  → React-specific adapters (hooks, class components)
 * - ReactiveState.ts        → Unified exports (this file)
 * 
 * USAGE:
 * ```typescript
 * // React projects (existing imports continue to work):
 * import { makeReactiveState, useReactiveState } from './ReactiveState';
 * 
 * // Vanilla TypeScript/JavaScript projects:
 * import { createVanillaState, bindToDOM } from './ReactiveState.vanilla';
 * // Or use core directly:
 * import { ReactiveState } from './ReactiveState.core';
 * 
 * // Vue/Svelte/Angular (create your own adapter):
 * import { ReactiveState } from './ReactiveState.core';
 * ```
 * 
 * @module ReactiveState
 */

// ═══════════════════════════════════════════════════════════════════════════
// Export Core (Framework-Agnostic)
// ═══════════════════════════════════════════════════════════════════════════
export {
    ReactiveState,
    type WatchOptions,
    type PropertyWatcher,
} from './ReactiveState.core';

// ═══════════════════════════════════════════════════════════════════════════
// Export React Adapters
// ═══════════════════════════════════════════════════════════════════════════
export {
    makeReactiveState,
    useReactiveState,
    makeReactiveStateForClass,
    ReactiveComponent,
    type StateControls,
    type StateWithLoading,
    type StateWithUser,
    type StateWithResults,
    createStateWithPatterns,
} from './ReactiveState.react';

// ═══════════════════════════════════════════════════════════════════════════
// Export Vanilla TypeScript Adapter
// ═══════════════════════════════════════════════════════════════════════════
export {
    createVanillaState,
    createReactiveState,
    bindToDOM,
    renderTemplate,
    bindEvent,
    bindFormInput,
    bindVisibility,
    renderList,
    createComponent,
    type ComponentDefinition,
    type ComponentInstance,
} from './ReactiveState.vanilla';
