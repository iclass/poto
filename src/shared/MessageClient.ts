
export interface MessagingClient {
	receiveMessage(msg: SseMessage): Promise<SseMessage | undefined>;
	getClientId(): string;
}

export class SseMessage {
	constructor(
		public messageId: string,
		public senderId: string,
		public recipientId: string,
		public message: string,
		public payload?: object, // json
		public replyTo?: string, // previous meessae id to reply to 
	) { }
}

export type SseDispatcher = (msg: SseMessage) => void

// General-purpose window messaging RPC utility
let _rpcId = 0
export function windowRpc<T = any>(type: string, payload?: any, timeout = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const rpcId = `rpc-${Date.now()}-${_rpcId++}`
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error('windowRpc timeout'))
    }, timeout)
    function handler(event: MessageEvent) {
      if (event.data && event.data.__windowRpc && event.data.rpcId === rpcId) {
        clearTimeout(timer)
        window.removeEventListener('message', handler)
        resolve(event.data.payload)
      }
    }
    window.addEventListener('message', handler)
    window.postMessage({ __windowRpc: true, rpcId, type, payload }, '*')
  })
}
