import { PotoClientWithProxy } from '../src/web/rpc/PotoClientWithProxy';
import { DEMO_BASE } from './demotypes';

// Global variables for demo
export let demoBridge: PotoClientWithProxy | null = null;
export let logElement: HTMLElement | null = null;
export let statusElement: HTMLElement | null = null;

export function log(message: string, type: string = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    if (logElement) {
        logElement.innerHTML += logEntry + '\n';
        logElement.scrollTop = logElement.scrollHeight;
    }
    console.log(logEntry);
}

export function updateStatus(message: string, type: string = 'info') {
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }
}

export class DemoParentModule {
    async getParentInfo() {
        return {
            parentUrl: window.location.href,
            time: new Date().toISOString()
        }
    }
}

// Initialize the RPC bridge
export async function initRpcBridge() {
    try {
        log('🌉 Creating dynamic ParentRpcBridge...');


        demoBridge = new PotoClientWithProxy(DEMO_BASE);
        demoBridge.setUserId('parent');

        demoBridge.registerIframeHandler(new DemoParentModule());

        log('✅ Dynamic ParentRpcBridge initialized successfully');
        updateStatus('🌉 Dynamic RPC Bridge ready - any method call supported', 'success');


    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`❌ Error initializing RPC bridge: ${errorMessage}`, 'error');
        updateStatus(`Error: ${errorMessage}`, 'error');
    }
}

// Initialize when DOM is ready
export function initializeParentClient() {
    logElement = document.getElementById('log');
    statusElement = document.getElementById('status');
    
    if (!logElement || !statusElement) {
        console.error('Required DOM elements not found');
        return;
    }

    // Make clearParentLog available globally
    (window as any).clearParentLog = clearParentLog;

    // Initialize when page loads
    document.addEventListener('DOMContentLoaded', initRpcBridge);
}

// Function to clear the parent log
export function clearParentLog() {
    if (logElement) {
        logElement.innerHTML = '';
    }
    log('🧹 Parent log cleared');
} 

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeParentClient);
} else {
    initializeParentClient();
}
