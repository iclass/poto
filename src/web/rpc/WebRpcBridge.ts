import { RpcRequest, RpcResponse, RpcError, RpcMessage } from "./RpcClient";
import { PotoClient } from "./PotoClient";

const DEFAULT_FRAMENAME = 'default-iframe';

/**
 * ParentRpcBridge is a class that bridges the communication between the parent window and the iframe.
 * It is used to handle the RPC requests from the iframe and the parent window.
 * It is also used to handle the RPC responses from the iframe and the parent window.
 * It is also used to handle the RPC errors from the iframe and the parent window.
 */
export class WebRpcBridge {
  private potoClient: PotoClient;
  private serverProxies = new Map<string, any>();
  private parentProxy: any;
  private iframeHandlers = new Map<string, any>(); // handler module per iframe
  private globalIframeHandler: any = null; // global handler module

  constructor(baseUrl: string) {
    if (!baseUrl) {
      throw new Error("ParentRpcBridge: baseUrl must be defined");
    }
    this.potoClient = new PotoClient(baseUrl);
    this.setupParentProxy();
    this.setupMessageListener();
  }

  /**
   * Register a handler module (object) for a specific iframe
   */
  registerIframeHandler(handler: any, iframeId: string = DEFAULT_FRAMENAME): void {
    this.iframeHandlers.set(iframeId, handler);
  }

  /**
   * Register a global handler module (object) for all iframes
   */
  registerGlobalIframeHandler(handler: any): void {
    this.globalIframeHandler = handler;
  }

  /**
   * Unregister a handler for a specific iframe
   */
  unregisterIframeHandler(iframeId: string): void {
    this.iframeHandlers.delete(iframeId);
  }

  /**
   * Unregister the global handler
   */
  unregisterGlobalIframeHandler(): void {
    this.globalIframeHandler = null;
  }

  /**
   * Get all registered handlers for debugging
   */
  getIframeHandlers(): { global: any, iframeSpecific: Record<string, any> } {
    const iframeSpecific: Record<string, any> = {};
    for (const [iframeId, handler] of this.iframeHandlers.entries()) {
      iframeSpecific[iframeId] = handler;
    }
    return { global: this.globalIframeHandler, iframeSpecific };
  }

  private setupParentProxy() {
    this.parentProxy = new Proxy({}, {
      get: (target, propKey: string) => {
        return async (...args: any[]) => {
          switch (propKey) {
            case 'getParentInfo':
              return {
                parentUrl: window.location.href,
                timestamp: Date.now(),
                userAgent: navigator.userAgent.substring(0, 50) + '...',
                viewport: {
                  width: window.innerWidth,
                  height: window.innerHeight
                }
              };
            case 'getUserPreferences':
              return {
                theme: localStorage.getItem('theme') || 'light',
                language: localStorage.getItem('language') || 'en',
                userId: localStorage.getItem('userId') || 'anonymous'
              };
            case 'showNotification':
              const [message, type = 'info'] = args;
              console.log(`[Parent Notification] ${type.toUpperCase()}: ${message}`);
              return { success: true, message: 'Notification logged' };
            case 'triggerParentAction':
              const [action] = args;
              switch (action) {
                case 'changeTheme':
                  const currentTheme = localStorage.getItem('theme') || 'light';
                  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                  localStorage.setItem('theme', newTheme);
                  document.body.style.backgroundColor = newTheme === 'dark' ? '#333' : '#f5f5f5';
                  return { success: true, newTheme };
                case 'showAlert':
                  alert('Alert triggered from iframe!');
                  return { success: true };
                default:
                  return { success: false, error: 'Unknown action' };
              }
            case 'navigateParent':
              const [url] = args;
              window.location.href = url;
              return { success: true };
            case 'getParentState':
              return {
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                viewport: {
                  width: window.innerWidth,
                  height: window.innerHeight
                },
                location: {
                  href: window.location.href,
                  origin: window.location.origin,
                  pathname: window.location.pathname
                }
              };
            case 'setLocalStorage':
              const [key, value] = args;
              localStorage.setItem(key, value);
              return { success: true };
            case 'getLocalStorage':
              const [storageKey] = args;
              return localStorage.getItem(storageKey);
            case 'removeLocalStorage':
              const [removeKey] = args;
              localStorage.removeItem(removeKey);
              return { success: true };
            case 'getCookies':
              return document.cookie;
            case 'setCookie':
              const [cookieName, cookieValue, options = {}] = args;
              let cookieString = `${cookieName}=${cookieValue}`;
              if (options.expires) cookieString += `; expires=${options.expires}`;
              if (options.path) cookieString += `; path=${options.path}`;
              document.cookie = cookieString;
              return { success: true };
            case 'getWindowSize':
              return {
                width: window.innerWidth,
                height: window.innerHeight,
                outerWidth: window.outerWidth,
                outerHeight: window.outerHeight
              };
            case 'scrollParent':
              const [x, y] = args;
              window.scrollTo(x, y);
              return { success: true };
            case 'focusParent':
              window.focus();
              return { success: true };
            case 'reloadParent':
              window.location.reload();
              return { success: true };
            default:
              if (typeof (window as any)[propKey] === 'function') {
                try {
                  const result = await (window as any)[propKey](...args);
                  return result;
                } catch (error) {
                  throw new Error(`Failed to execute window method ${propKey}: ${error}`);
                }
              } else {
                if (propKey in window) {
                  return (window as any)[propKey];
                }
                // Instead of throwing, return undefined to allow fallback to server proxy
                return undefined;
              }
          }
        };
      }
    });
  }

  private setupMessageListener() {
    window.addEventListener('message', async (event: MessageEvent) => {
      const data = event.data as RpcMessage;
      if (!data || !data._rpcId || data._rpcType !== 'request') {
        return; // Not an RPC request
      }
      try {
        const result = await this.handleRpcRequestCascaded(data, event);
        const response: RpcResponse = {
          _rpcId: data._rpcId,
          _rpcType: 'response',
          result
        };
        event.source?.postMessage(response, '*' as any);
      } catch (error) {
        const errorResponse: RpcError = {
          _rpcId: data._rpcId,
          _rpcType: 'error',
          error: error instanceof Error ? error.message : String(error),
          details: error
        };
        event.source?.postMessage(errorResponse, '*' as any);
      }
    });
  }

  /**
   * Unified cascaded fallback handler for RPC requests.
   * Order: iframe-specific handler -> global handler -> parent proxy -> server proxy (if modulePrefix)
   */
  private async handleRpcRequestCascaded(request: RpcRequest, event: MessageEvent): Promise<any> {
    const method = request.method;
    const args = request.args || [];
    const iframeId = this.identifyIframeSource(event);
    // 1. Try iframe-specific handler
    if (iframeId) {
      const handler = this.iframeHandlers.get(iframeId);
      if (handler && typeof handler[method] === 'function') {
        return await handler[method](...args);
      }
    }
    else {
      console.error('[ParentRpcBridge] SHOULD NOT HAPPEN: No iframeId identified for event, method:', method);
    }

    // 2. Try global handler
    if (this.globalIframeHandler && typeof this.globalIframeHandler[method] === 'function') {
      return await this.globalIframeHandler[method](...args);
    }
    // 3. Try parent proxy
    const parentMethod = (this.parentProxy as any)[method];
    if (typeof parentMethod === 'function') {
      const result = await parentMethod(...args);
      if (typeof result !== 'undefined') {
        return result;
      }
    }
    // 4. Try server proxy if modulePrefix is provided
    if (request.moduleName) {
      let serverProxy = this.serverProxies.get(request.moduleName);
      if (!serverProxy) {
        serverProxy = this.potoClient.getProxy(request.moduleName);
        this.serverProxies.set(request.moduleName, serverProxy);
      }
      const serverMethod = serverProxy[method];
      if (typeof serverMethod === 'function') {
        return await serverMethod(...args);
      }
    }
    // If all fail, throw error
    console.error(`[ParentRpcBridge] RPC method not found in any handler: ${method}`);
    throw new Error(`RPC method not found in any handler: ${method}`);
  }

  private identifyIframeSource(event: MessageEvent): string | null {
    if (event.source && event.source !== window) {
      const iframes = document.querySelectorAll('iframe');
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        if (iframe.contentWindow === event.source) {
          return DEFAULT_FRAMENAME;
          // return iframe.id || iframe.name || iframe.src || DEFAULT_FRAMENAME;
        }
      }
    }
    // const data = event.data as any;
    // if (data && data._iframeId) {
    //   return data._iframeId;
    // }
    // if (event.origin) {
    //   return `iframe-${event.origin.replace(/[^a-zA-Z0-9]/g, '-')}`;
    // }
    return null;
  }

  getPotoClient(): PotoClient {
    return this.potoClient;
  }

  getServerProxy<T extends object>(modulePrefix: string): T {
    return this.potoClient.getProxy<T>(modulePrefix);
  }

  cleanup(): void {
    this.serverProxies.clear();
    this.iframeHandlers.clear();
    this.globalIframeHandler = null;
  }
} 