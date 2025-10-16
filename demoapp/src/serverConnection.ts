/**
 * Server Connection Manager
 * 
 * Centralized singleton for PotoClient and server module proxies.
 * Creates and manages the connection to the Poto server and provides access to RPC modules.
 * 
 * Usage:
 *   import { getPotoClient, getServerModule, initServerConnection } from './serverConnection';
 *   
 *   // Initialize once in your root component
 *   initServerConnection('http://localhost', 3100, 'DemoModule');
 *   
 *   // Use anywhere in your app
 *   const client = getPotoClient();
 *   const module = getServerModule();
 */

import { PotoClient } from "poto";
import type { DemoModule } from "./DemoModule";

// Module-level singleton instances
let potoClientInstance: PotoClient | undefined;
let serverModuleInstance: DemoModule | undefined;

/**
 * Initialize the server connection
 * Creates PotoClient and retrieves server module proxy
 * Should be called once during app initialization
 * 
 * @param host - Server host (e.g., 'http://localhost')
 * @param port - Server port (e.g., 3100)
 * @param moduleName - Name of the server module to proxy
 * @returns Object with client and module instances
 */
export function initServerConnection(
    host: string, 
    port: number, 
    moduleName: string
): { client: PotoClient; demoModule: DemoModule } {
    // Create PotoClient
    potoClientInstance = new PotoClient(`${host}:${port}`);
    
    // Get server module proxy
    serverModuleInstance = potoClientInstance.getProxy(moduleName) as DemoModule;
    
    console.log('✅ Server connection initialized (PotoClient + Server Module)');
    
    return {
        client: potoClientInstance,
        demoModule: serverModuleInstance
    };
}

/**
 * Get the PotoClient instance
 * @returns The PotoClient instance or undefined if not initialized
 */
export function getPotoClient(): PotoClient | undefined {
    return potoClientInstance;
}

/**
 * Get the server module proxy (DemoModule)
 * @returns The DemoModule instance or undefined if not initialized
 */
export function getServerModule(): DemoModule | undefined {
    return serverModuleInstance;
}

/**
 * Check if the server connection is ready
 */
export function isServerReady(): boolean {
    return potoClientInstance !== undefined && serverModuleInstance !== undefined;
}

/**
 * Clear the server connection (useful for cleanup/testing)
 * Should be called when the app is unmounting
 */
export function clearServerConnection(): void {
    // Unsubscribe client if it exists
    if (potoClientInstance) {
        potoClientInstance.unsubscribe();
    }
    
    potoClientInstance = undefined;
    serverModuleInstance = undefined;
    console.log('🧹 Server connection cleared');
}

// Backward compatibility exports (for gradual migration)
export const getDemoModule = getServerModule;

