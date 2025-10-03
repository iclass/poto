// Minimal AiSliderIframeClient for iframe demo
// This provides a clean, minimal interface for iframe RPC functionality

import { newRpcClient } from '../src/web/rpc/RpcClient';

// Import types only for server and parent modules just for type safety
import type { DemoServerModule } from './DemoServerModule';
import type {  DemoParentModule } from './parent';

// Global state
let server: DemoServerModule;
let logElement: HTMLElement | null = null;
let statusElement: HTMLElement | null = null;
let resultContainer: HTMLElement | null = null;

// Utility functions
function log(message: string, type: string = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    if (logElement) {
        logElement.innerHTML += logEntry + '\n';
        logElement.scrollTop = logElement.scrollHeight;
    }
    console.log(logEntry);
}

function updateStatus(message: string, type: string = 'info') {
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }
}

function showResult(title: string, data: any) {
    if (!resultContainer) return;
    
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result';
    resultDiv.innerHTML = `<strong>${title}:</strong>\n${JSON.stringify(data, null, 2)}`;
    resultContainer.appendChild(resultDiv);
    
    // Remove old results after 5 seconds
    // setTimeout(() => {
    //     if (resultDiv.parentNode) {
    //         resultDiv.parentNode.removeChild(resultDiv);
    //     }
    // }, 5000);
}

// Initialize RPC client
async function initRpcClient() {
    try {
        log('Creating type-safe RPC clients...');
        
        // Create type-safe server client
        server = newRpcClient<DemoServerModule>('DemoServerModule'); // Name required for server-side methods

        // Test the connection
        const serverInfo = await server.getServerInfo();
        log('Server info received successfully');
        showResult('Server Info', serverInfo);

        const parentClient = newRpcClient<DemoParentModule>(); // Name not required for parent-side methods
        log('parentClient created');
        const parentInfo = await parentClient.getParentInfo();
        log('parentInfo', JSON.stringify(parentInfo, null, 2));
        showResult('Parent Info', parentInfo);

        log('Type-safe RPC clients initialized successfully');
        updateStatus('RPC Client ready - waiting for parent...', 'info');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error initializing RPC client: ${errorMessage}`, 'error');
        updateStatus(`Error: ${errorMessage}`, 'error');
    }
}

// Test functions
async function testServerMethod() {
    try {
        log('Calling server method: postEcho');
        const result = await server.postEcho('Hello from iframe!');
        log('Echo received successfully');
        showResult('Echo', result);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error calling server method: ${errorMessage}`, 'error');
        showResult('Error', { error: errorMessage });
    }
}

function clearLog() {
    if (logElement) {
        logElement.innerHTML = '';
    }
    if (resultContainer) {
        resultContainer.innerHTML = '';
    }
    log('Log cleared');
}

// Initialize when DOM is ready
function initializeIframeClient() {
    logElement = document.getElementById('log');
    statusElement = document.getElementById('status');
    resultContainer = document.getElementById('result-container');
    
    if (!logElement || !statusElement || !resultContainer) {
        console.error('Required DOM elements not found');
        return;
    }

    // Initialize RPC client
    initRpcClient();

    // Add event listeners for buttons
    document.getElementById('btn-server')?.addEventListener('click', testServerMethod);
    document.getElementById('btn-clear')?.addEventListener('click', clearLog);
}

// Auto-initialize when this module is imported
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIframeClient);
} else {
    initializeIframeClient();
}

// Export functions for manual use if needed
export {
    initializeIframeClient,
    testServerMethod,
    clearLog
}; 