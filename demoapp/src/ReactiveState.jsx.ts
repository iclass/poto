/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ReactiveState JSX Factory - Use JSX WITHOUT React!
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This module enables JSX/TSX syntax without React dependency.
 * 
 * USAGE:
 * ```tsx
 * // At top of your .tsx file:
 * import { jsx } from './ReactiveState.jsx';
 * 
 * // Configure TypeScript (per-file or tsconfig.json):
 * // @jsxImportSource ./ReactiveState.jsx
 * 
 * // Now use JSX without React!
 * const element = <div class="app">Hello {name}</div>;
 * ```
 * 
 * FEATURES:
 * - ✅ Full JSX/TSX syntax support
 * - ✅ Zero React dependency
 * - ✅ Reactive data binding
 * - ✅ Component support
 * - ✅ Event handlers
 * - ✅ Conditional rendering
 * - ✅ List rendering
 * 
 * @module ReactiveState.jsx
 */

import { ReactiveState } from './ReactiveState.core';

// ═══════════════════════════════════════════════════════════════════════════
// JSX Types
// ═══════════════════════════════════════════════════════════════════════════

export namespace JSX {
    export interface IntrinsicElements {
        [elemName: string]: any;
    }
    
    export interface Element {
        type: string | Function;
        props: any;
        children: any[];
    }
    
    export interface ElementChildrenAttribute {
        children: {};
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Virtual Node (VNode)
// ═══════════════════════════════════════════════════════════════════════════

export interface VNode {
    type: string | Function;
    props: Record<string, any>;
    children: VNode[];
    key?: string | number;
}

// ═══════════════════════════════════════════════════════════════════════════
// JSX Factory Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * JSX factory function - converts JSX to virtual nodes
 * This is called by TypeScript when it transpiles JSX
 */
export function jsx(
    type: string | Function,
    props: any,
    key?: string | number
): VNode {
    const { children, ...restProps } = props || {};
    
    // Normalize children and filter out invalid values (null, undefined, boolean)
    const normalizedChildren = Array.isArray(children) ? children : children != null ? [children] : [];
    const validChildren = normalizedChildren.filter(child => 
        child != null && typeof child !== 'boolean'
    );
    
    return {
        type,
        props: restProps,
        children: validChildren,
        key
    };
}

/**
 * JSX fragment support
 */
export function Fragment(props: { children?: any[] }): VNode {
    // Filter out null, undefined, and booleans from children
    const validChildren = (props.children || []).filter(child => 
        child != null && typeof child !== 'boolean'
    );
    
    return {
        type: 'fragment',
        props: {},
        children: validChildren
    };
}

// Alias for compatibility
export const jsxs = jsx;
export const jsxDEV = jsx;

// ═══════════════════════════════════════════════════════════════════════════
// Render VNode to Real DOM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert VNode to real DOM element
 */
export function render(vnode: VNode | string | number | boolean | null | undefined): Node | null {
    // Handle null/undefined/boolean (React-style: these render nothing)
    if (vnode == null || typeof vnode === 'boolean') {
        return null;
    }
    
    // Handle primitives (text nodes)
    if (typeof vnode === 'string' || typeof vnode === 'number') {
        return document.createTextNode(String(vnode));
    }
    
    // Handle fragments
    if (vnode.type === 'fragment' || vnode.type === Fragment) {
        const fragment = document.createDocumentFragment();
        vnode.children.forEach(child => {
            const childNode = render(child);
            if (childNode) fragment.appendChild(childNode);
        });
        return fragment;
    }
    
    // Handle function components
    if (typeof vnode.type === 'function') {
        const componentVNode = vnode.type({ ...vnode.props, children: vnode.children });
        return render(componentVNode);
    }
    
    // Handle regular elements
    const element = document.createElement(vnode.type as string);
    
    // Set attributes
    Object.entries(vnode.props).forEach(([key, value]) => {
        setAttribute(element, key, value);
    });
    
    // Append children
    vnode.children.forEach(child => {
        const childNode = render(child);
        if (childNode) element.appendChild(childNode);
    });
    
    return element;
}

/**
 * Set attribute on element (handles special cases)
 */
function setAttribute(element: HTMLElement, key: string, value: any) {
    // Skip null/undefined
    if (value == null) return;
    
    // Handle event listeners
    if (key.startsWith('on') && typeof value === 'function') {
        const event = key.substring(2).toLowerCase();
        element.addEventListener(event, value);
        return;
    }
    
    // Handle class/className
    if (key === 'className' || key === 'class') {
        if (typeof value === 'string') {
            element.className = value;
        } else if (typeof value === 'object') {
            // Handle class object: { 'active': true, 'disabled': false }
            Object.entries(value).forEach(([cls, enabled]) => {
                if (enabled) element.classList.add(cls);
            });
        }
        return;
    }
    
    // Handle style
    if (key === 'style' && typeof value === 'object') {
        Object.entries(value).forEach(([prop, val]) => {
            (element.style as any)[prop] = val;
        });
        return;
    }
    
    // Handle refs
    if (key === 'ref' && typeof value === 'object' && 'current' in value) {
        value.current = element;
        return;
    }
    
    // Handle boolean attributes
    if (typeof value === 'boolean') {
        if (value) {
            element.setAttribute(key, '');
        }
        return;
    }
    
    // Default: set as string attribute
    element.setAttribute(key, String(value));
}

// ═══════════════════════════════════════════════════════════════════════════
// Mount JSX to DOM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mount JSX element to DOM container
 */
export function mount(vnode: VNode, container: HTMLElement | string) {
    const target = typeof container === 'string' 
        ? document.querySelector(container)
        : container;
    
    if (!target) {
        console.error('Mount target not found:', container);
        return null;
    }
    
    const element = render(vnode);
    if (element) {
        target.innerHTML = '';
        target.appendChild(element);
    }
    
    return element;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reactive JSX Components
// ═══════════════════════════════════════════════════════════════════════════

export interface ReactiveComponentOptions<T extends Record<string, any>> {
    state: T;
    render: (state: T) => VNode;
    onMount?: (container: HTMLElement, state: T) => void;
    onUnmount?: () => void;
    debounce?: number;
}

/**
 * Create reactive component with JSX
 */
export function createReactiveComponent<T extends Record<string, any>>(
    options: ReactiveComponentOptions<T>
) {
    return {
        mount(selector: string) {
            const container = document.querySelector(selector) as HTMLElement;
            if (!container) {
                throw new Error(`Container not found: ${selector}`);
            }
            
            // Create reactive state
            const manager = new ReactiveState(options.state);
            const state = manager.getState();
            
            if (options.debounce) {
                manager.setDebounce(options.debounce);
            }
            
            // Track if component has been mounted (for onMount hook)
            let isMounted = false;
            
            // Render function
            const renderComponent = () => {
                const vnode = options.render(state);
                mount(vnode, container);
                
                // Call onMount ONLY on first render
                if (!isMounted && options.onMount) {
                    options.onMount(container, state);
                    isMounted = true;
                }
            };
            
            // Initial render
            renderComponent();
            
            // Subscribe to changes (for subsequent re-renders)
            const unsubscribe = manager.subscribe(renderComponent);
            
            return {
                state,
                update: renderComponent,
                unmount: () => {
                    unsubscribe();
                    if (options.onUnmount) {
                        options.onUnmount();
                    }
                }
            };
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Reactive attribute binding
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create reactive text binding
 * 
 * @example
 * <div>{$text(() => state.count)}</div>
 */
export function $text(getValue: () => any): string {
    return String(getValue());
}

/**
 * Create reactive class binding
 * 
 * @example
 * <div class={$class({ active: state.isActive, disabled: !state.enabled })} />
 */
export function $class(classMap: Record<string, boolean>): string {
    return Object.entries(classMap)
        .filter(([_, enabled]) => enabled)
        .map(([className]) => className)
        .join(' ');
}

/**
 * Create reactive style binding
 * 
 * @example
 * <div style={$style({ color: state.color, display: state.visible ? 'block' : 'none' })} />
 */
export function $style(styleMap: Record<string, any>): Record<string, any> {
    return styleMap;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Conditional rendering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Conditional rendering helper
 * 
 * @example
 * {$if(state.isLoggedIn, () => <div>Welcome!</div>, () => <div>Login</div>)}
 */
export function $if(
    condition: boolean,
    thenFn: () => VNode,
    elseFn?: () => VNode
): VNode | null {
    return condition ? thenFn() : (elseFn ? elseFn() : null);
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: List rendering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List rendering helper
 * 
 * @example
 * {$list(state.items, (item, i) => <li key={i}>{item.name}</li>)}
 */
export function $list<T>(
    items: T[],
    renderItem: (item: T, index: number) => VNode
): VNode[] {
    return items.map((item, index) => renderItem(item, index));
}

// ═══════════════════════════════════════════════════════════════════════════
// Export runtime for JSX
// ═══════════════════════════════════════════════════════════════════════════

export const jsxRuntime = {
    jsx,
    jsxs,
    jsxDEV,
    Fragment
};

// ═══════════════════════════════════════════════════════════════════════════
// Default exports for convenience
// ═══════════════════════════════════════════════════════════════════════════

export default {
    jsx,
    jsxs,
    Fragment,
    mount,
    render,
    createReactiveComponent,
    $class,
    $if,
    $list,
    $style,
    $text
};

// ═══════════════════════════════════════════════════════════════════════════
// Type declarations for better IDE support
// ═══════════════════════════════════════════════════════════════════════════

// Base HTML attributes (using native HTML attribute names, not React's camelCase)
export interface HTMLAttributes {
    // Standard attributes
    id?: string;
    class?: string;  // Note: 'class', not 'className'!
    style?: any;
    title?: string;
    
    // Events (lowercase, like native HTML)
    onclick?: (event: MouseEvent) => void;
    onchange?: (event: Event) => void;
    oninput?: (event: Event) => void;
    onsubmit?: (event: Event) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onkeypress?: (event: KeyboardEvent) => void;
    onkeyup?: (event: KeyboardEvent) => void;
    onfocus?: (event: FocusEvent) => void;
    onblur?: (event: FocusEvent) => void;
    
    // Common attributes
    children?: any;
    key?: string | number;
    ref?: any;
    
    // Allow any other attributes
    [key: string]: any;
}

// Input-specific attributes
export interface InputAttributes extends HTMLAttributes {
    type?: string;
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    checked?: boolean;
    name?: string;
}

// Button-specific attributes
export interface ButtonAttributes extends HTMLAttributes {
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
}

// Form-specific attributes
export interface FormAttributes extends HTMLAttributes {
    action?: string;
    method?: string;
}

declare global {
    namespace JSX {
        interface Element extends VNode {}
        
        interface IntrinsicElements {
            // HTML Elements with native attribute names
            div: HTMLAttributes;
            span: HTMLAttributes;
            p: HTMLAttributes;
            a: HTMLAttributes & { href?: string; target?: string };
            button: ButtonAttributes;
            input: InputAttributes;
            textarea: HTMLAttributes & { value?: string; placeholder?: string };
            select: HTMLAttributes & { value?: string };
            option: HTMLAttributes & { value?: string };
            form: FormAttributes;
            label: HTMLAttributes & { for?: string };
            h1: HTMLAttributes;
            h2: HTMLAttributes;
            h3: HTMLAttributes;
            h4: HTMLAttributes;
            h5: HTMLAttributes;
            h6: HTMLAttributes;
            ul: HTMLAttributes;
            ol: HTMLAttributes;
            li: HTMLAttributes;
            table: HTMLAttributes;
            thead: HTMLAttributes;
            tbody: HTMLAttributes;
            tr: HTMLAttributes;
            th: HTMLAttributes;
            td: HTMLAttributes;
            img: HTMLAttributes & { src?: string; alt?: string };
            video: HTMLAttributes & { src?: string };
            audio: HTMLAttributes & { src?: string };
            canvas: HTMLAttributes & { width?: number; height?: number };
            svg: HTMLAttributes;
            
            // Allow any element
            [elemName: string]: any;
        }
        
        interface ElementChildrenAttribute {
            children: {};
        }
    }
}

