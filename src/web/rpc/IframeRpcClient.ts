export interface RpcRequest {
  _rpcId: string;
  _rpcType: 'request';
  method: string;
  args: any[];
  moduleName: string;
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

export class IframeRpcClient {
  private rpcIdCounter = 0;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void; timeout: NodeJS.Timeout }>();
  private defaultTimeout = 30000; // 30 seconds

  constructor() {
    this.setupMessageListener();
  }

  private setupMessageListener() {
    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as RpcMessage;
      
      if (!data || !data._rpcId || !data._rpcType) {
        return; // Not an RPC message
      }

      const pending = this.pendingRequests.get(data._rpcId);
      if (!pending) {
        return; // Unknown RPC ID
      }

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(data._rpcId);

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
  }

  private generateRpcId(): string {
    return `rpc-${Date.now()}-${++this.rpcIdCounter}`;
  }

  private sendRpcRequest(request: RpcRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request._rpcId);
        reject(new Error(`RPC timeout for method: ${request.method}`));
      }, this.defaultTimeout);

      this.pendingRequests.set(request._rpcId, { resolve, reject, timeout });
      
      window.parent.postMessage(request, '*');
    });
  }


  /**
   * Creates a proxy for parent methods calling chain (routed through parent)
   */
  getParentProxy<T extends object>(moduleName: string): T {
    return new Proxy({}, {
      get: (_, propKey: string) => {
        return async (...args: any[]) => {
          const request: RpcRequest = {
            _rpcId: this.generateRpcId(),
            _rpcType: 'request',
            method: propKey,
            args,
            moduleName: moduleName
          };
          
          return this.sendRpcRequest(request);
        };
      }
    }) as T;
  }

  /**
   * Sets the default timeout for RPC calls
   */
  setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Cleans up pending requests (useful for cleanup)
   */
  cleanup(): void {
    for (const [rpcId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client cleanup'));
    }
    this.pendingRequests.clear();
  }
} 