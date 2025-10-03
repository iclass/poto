/**
 * Type-safe RPC Client for iframe communication
 * Provides a clean, minimal API with full TypeScript support
 *
 * Usage:
 *   const client = newRpcClient<MyApi>();
 *   await client.someMethod(...args);
 *
 * Optionally, you can specify a modulePrefix to restrict to server-side methods only:
 *   const serverClient = newRpcClient<MyServerApi>({ modulePrefix: 'myModule' });
 */
// Module-level cache for idempotent client creation 
const _rpcClientCache = new Map<string, any>();
const defaultTimeout = 5000; // 5 seconds

/**
 * Create a new RPC client for a given module name
 * @param moduleName - The name of the module to create a client for, only for server-side methods
 * @returns A proxy that implements the interface T
 */
export function newRpcClient<T>(moduleName: string = ''): T {
  if (_rpcClientCache.has(moduleName)) {
    return _rpcClientCache.get(moduleName);
  }
  const client = newClient<T>(moduleName);
  _rpcClientCache.set(moduleName, client);
  return client;
}

const pendingRequests = new Map<string, {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeoutId: number;
}>();
const rpcIdCounter = { value: 0 };

function newClient<T>(moduleName: string, timeout: number = defaultTimeout): T {
  
  // Setup message listener once
  if (!window.__rpcListenerSetup) {
    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as RpcMessage;
      if (!data || !data._rpcId || !data._rpcType) {
        return;
      }
      const pending = pendingRequests.get(data._rpcId);
      if (!pending) {
        return;
      }
      window.clearTimeout(pending.timeoutId);
      pendingRequests.delete(data._rpcId);
      if (data._rpcType === 'response') {
        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data.result);
        }
      } else if (data._rpcType === 'error') {
        pending.reject(new Error(data.error));
      }
    });
    (window as any).__rpcListenerSetup = true;
  }


  // Create the proxy
  return new Proxy({}, {
    get: (_, propKey: string) => {
      return async (...args: any[]) => {
        const request: RpcRequest = {
          _rpcId: `rpc-${Date.now()}-${++rpcIdCounter.value}`,
          _rpcType: 'request',
          method: propKey,
          args,
          moduleName
        };
        return ((request: RpcRequest): Promise<any> => {
          return new Promise((resolve, reject) => {
            const timeoutId = window.setTimeout(() => {
              pendingRequests.delete(request._rpcId);
              reject(new Error(`RPC timeout for method: ${request.method}`));
            }, timeout);
            pendingRequests.set(request._rpcId, { resolve, reject, timeoutId });
            window.parent.postMessage(request, '*');
          });
        })(request);
      };
    }
  }) as T;
}

/**
 * Utility type to create a parent RPC client with specific timeout
 * not really implemented yet
 */
export function createParentRpcClientWithTimeout<T extends object>(
  timeout: number,
  moduleName: string
): T {
  const client = newRpcClient<T>(moduleName);
  // Note: In a more sophisticated implementation, you could store timeout per client
  return client;
}

// Type definitions for RPC messages
export interface RpcRequest {
  _rpcId: string;
  _rpcType: 'request';
  method: string;
  args: any[];
  moduleName: string; // important for server-side methods
}

export interface RpcResponse {
  _rpcId: string;
  _rpcType: 'response';
  result?: any;
  error?: string;
}

export interface RpcError {
  _rpcId: string;
  _rpcType: 'error';
  error: string;
  details?: any;
}

export type RpcMessage = RpcRequest | RpcResponse | RpcError;


// Extend Window interface to avoid TypeScript errors
declare global {
  interface Window {
    __rpcListenerSetup?: boolean;
  }
} 