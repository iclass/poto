import { PotoConstants } from "../../shared/PotoConstants.js";
import { MessagingClient, SseMessage } from "../../shared/MessageClient.js";
import { EventStreamContentType, fetchEventSource } from "../../shared/fetch-eventsource/fetch";
import { parseTypedJson, stringifyTypedJson, stringifyTypedJsonAsync } from "../../shared/TypedJsonUtils.js";

export interface PotoClientStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export class PotoClient {

	baseUrl: string; // with '/' removed
	// subscriptions: Map<string, AbortController> = new Map()
	userId: string | undefined;
	token: string | undefined

	sseAborController:AbortController | undefined

	// Request cancellation control
	private currentRequestAbortController: AbortController | null = null;
	private autoCancelPreviousRequests: boolean = true;
	private activeRequestCount: number = 0;
	
	// Per-request abort controller tracking for concurrent safety
	private requestAbortControllers: Map<number, AbortController> = new Map();
	private nextRequestId: number = 0;

	/**
	 * Storage mechanism for credentials (default: window.localStorage if available).
	 */
	storage: PotoClientStorage;

	/**
	 * Callback function to check if verbose mode is enabled
	 */
	private verboseCallback?: () => boolean;

	/**
	 * Constructs a new PotoClient instance.
	 * @param baseUrl - The base URL for the POTO server. 
	 * 	it can be a full http requst base, 
	 *  or a root path for the current host of a web page.
	 *  or falsy value, in which case the default route prefix for the server is used.
	 * e.g.: 'http://server.com', 'http://server.com/api', or simply '/api'. Use '/' for current host without any root prefi, or '' for the default route prefix.
	 * @param storage - Optional storage object (must implement getItem, setItem, removeItem). Defaults to window.localStorage if available, otherwise throws if not provided in non-browser.
	 */
	constructor(baseUrl: string, storage?: PotoClientStorage) {
		// use the route prefix by default, which is the default route prefix for the server
		if (!baseUrl) baseUrl = PotoConstants.routePrefix;

		if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
		this.baseUrl = baseUrl;
		if (storage) {
			this.storage = storage;
		} else if (typeof window !== 'undefined' && window.localStorage) {
			this.storage = window.localStorage;
		} else {
			throw new Error('No storage provided and localStorage is not available.');
		}
	}

	setUserId(userId: string) {
		this.userId = userId
	}

	/**
	 * Enable or disable automatic cancellation of previous requests
	 * @param enabled - Whether to automatically cancel previous requests when new ones are made
	 */
	setAutoCancelPreviousRequests(enabled: boolean): void {
		this.autoCancelPreviousRequests = enabled;
	}

	/**
	 * Manually cancel the current request if any
	 */
	cancelCurrentRequest(): void {
		if (this.currentRequestAbortController) {
			try {
				this.currentRequestAbortController.abort();
			} catch (_e) {
				// Some runtimes may throw a DOMException when aborting; ignore
			} finally {
				this.currentRequestAbortController = null;
			}
		}
	}

	/**
	 * Cancel all active requests (useful for cleanup/teardown)
	 */
	cancelAllRequests(): void {
		for (const [requestId, controller] of this.requestAbortControllers.entries()) {
			try {
				controller.abort();
			} catch (_e) {
				// Ignore abort errors
			}
		}
		this.requestAbortControllers.clear();
		this.currentRequestAbortController = null;
	}

	/**
	 * Get whether automatic cancellation is enabled
	 */
	isAutoCancelEnabled(): boolean {
		return this.autoCancelPreviousRequests;
	}

	/**
	 * Set the verbose callback function to check if verbose mode is enabled
	 */
	setVerboseCallback(callback: () => boolean): void {
		this.verboseCallback = callback;
	}

	sendMessage(recipientId: string, msg: string, payload: object): Promise<void> {
		if (!this.userId) throw "cannot sendmessage without a user id"

		const fullMsg = new SseMessage(
			this.userId + ':' + new Date().toISOString(),
			this.userId,
			recipientId,
			msg,
			payload
		)
		return this.publishMessage(fullMsg)
	}

	/**
	 * Login explicitly with user credentials and retrieve a user ID and JWT token from the server.
	 * @param credentials - The login credentials, typically including username and password.
	 * @returns Resolves when the user is successfully logged in.
	 * @throws If the login fails.
	 */
async login(credentials: { username: string; password: string }): Promise<void> {
	const url = `${this.baseUrl}/${PotoConstants.loginUrlPath}`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": PotoConstants.appJson },
		body: stringifyTypedJson(credentials),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Login failed: ${errorText}`);
	}

	const responseText = await response.text();
	const data = parseTypedJson(responseText);  // Use TypedJSON parser to match server format
	
	// Defensive: Verify response structure
	if (!data || typeof data !== 'object') {
		throw new Error(`Login returned invalid data: ${responseText}`);
	}
	if (!data.userId || !data.token) {
		throw new Error(`Login missing userId or token. Response: ${JSON.stringify(data)}`);
	}
	
	this.userId = data.userId;
	this.token = data.token;
}

	/**
	 * Logs in as a visitor and retrieves a visitor ID and JWT token from the server.
	 * @returns Resolves when the visitor is successfully logged in.
	 * @throws If the login fails.
	 */
	async loginAsVisitor(): Promise<void> {
		const VISITOR_ID = "visitorId";
		const PASSWORD = "visitorPassword";
		// Check for stored credentials in storage
		const storedVisitorId = this.storage.getItem(VISITOR_ID);
		const storedPassword = this.storage.getItem(PASSWORD);

		if (storedVisitorId && storedPassword) {
			try {
				// Attempt login with stored credentials
				await this.login({ username: storedVisitorId, password: storedPassword });
				return;
		} catch (error) {
			// Clear invalid stored credentials and fall through to re-registration
			this.storage.removeItem("visitorId");
			this.storage.removeItem("visitorPassword");
		}
	}

	// Proceed with visitor registration if no valid credentials are found
	const url = `${this.baseUrl}/${PotoConstants.registerAsTourist}`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": PotoConstants.appJson },
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Visitor login failed: ${errorText}`);
	}

	const responseText = await response.text();
	const data = parseTypedJson(responseText);  // Use TypedJSON parser to match server format
	
	// Defensive: Verify response structure
	if (!data || typeof data !== 'object') {
		throw new Error(`Visitor registration returned invalid data: ${responseText}`);
	}
	if (!data.userId || !data.token) {
		throw new Error(`Visitor registration missing userId or token. Response: ${JSON.stringify(data)}`);
	}
	
	this.userId = data.userId;
	this.token = data.token;

	// Store the visitor credentials in storage
	this.storage.setItem(VISITOR_ID, data.userId);
	this.storage.setItem(PASSWORD, data.pw || "");
}

	/**
	 * Subscribes to server-sent events
	 * @param onMessage - Callback function to handle incoming messages.
	 * @returns The EventSource instance for the subscription.
	 */
	subscribeSSE(msgClient: MessagingClient): Promise<void> {

		const controller = new AbortController(); // Create an AbortController
		const signal = controller.signal; // Get the signal to pass to the fetch

		const headers = {} as any
		if (this.token) {
			headers[PotoConstants.Authorization] = `Bearer ${this.token}`;
		}

		return new Promise<void>((resolve, reject) => {
			fetchEventSource(this.baseUrl + '/' + PotoConstants.subscribe, {
				// method: 'GET',
				signal: signal, // Pass the signal to allow abortion of the request
				...(Object.keys(headers).length > 0 && { headers: { ...headers } }),
				// headers: {
				// 	'Content-Type': EventStreamContentType,
				// },
				onopen: async (response) => {
					if (response.ok && response.headers.get('content-type') === EventStreamContentType) {
						this.sseAborController = controller
						resolve()
						return; // everything's good
					} else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
						console.debug({ response })
						// client-side errors are usually non-retriable:
						// throw new FatalError();
						reject(response)
					} else {
						console.debug({ response })
						reject(response)
						// throw new RetriableError();
					}
				},
				onmessage: (event) => {
					try {
						if (event.data) {
							const message = parseTypedJson(event.data) as SseMessage;
							msgClient.receiveMessage(message);
						}
					} catch (error) {
						console.error("Failed to parse message: ", event.data, error);
					}

				},
				onerror: (err) => {
					console.debug('sse:', { err })
					console.error("EventSource encountered an error, closing connection.");
					controller.abort()
					this.sseAborController = undefined
					reject(err)
				}
			});
		})

	}

	/**
	 * Unsubscribes from server-sent events for a specific user. A brute disconnect for now
	 */
	unsubscribe(): void {
		this.sseAborController?.abort()
	}

	/**
	 * Publishes a message to the server.
	 * @param sseMessage - The message to publish.
	 * @throws If the publish fails.
	 */
	async publishMessage(sseMessage: SseMessage): Promise<void> {
		const url = `${this.baseUrl}/${PotoConstants.publish}`;
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": PotoConstants.appJson },
			body: stringifyTypedJson(sseMessage),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Publish failed: ${errorText}`);
		}
	}

	/**
	 * Reconnects the subscription for a specific user.
	 * @param messenger - Callback function to handle incoming messages.
	 * @returns The new EventSource instance for the subscription.
	 */
	async reconnect(messenger: MessagingClient): Promise<void> {
		console.log(`Reconnecting sse`);
		this.unsubscribe();
		return this.subscribeSSE(messenger);
	}

	/**
	 * Sets the authentication token for subsequent requests.
	 * @param token - The authentication token.
	 */
	setAuthToken(token: string): void {
		this.token = token;
	}

	/**
	 * Publishes a message to the server with authentication.
	 * @param sseMessage - The message to publish.
	 * @throws If the publish fails.
	 */
	async publishMessageWithAuth(sseMessage: SseMessage): Promise<void> {
		const url = `${this.baseUrl}/${PotoConstants.publish}`;
		const headers: Record<string, string> = { "Content-Type": PotoConstants.appJson };
		if (this.token) {
			headers[PotoConstants.Authorization] = `Bearer ${this.token}`;
		}

		const response = await fetch(url, {
			method: "POST",
			headers,
			body: stringifyTypedJson(sseMessage),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Publish failed: ${errorText}`);
		}
	}

	/**
	 * Fetches a static file from the server's public directory.
	 * @param filePath - The relative path to the static file within the server's `public` directory.
	 * @returns The file content and MIME type.
	 * @throws If the file cannot be retrieved.
	 */
	async getStaticFile(filePath: string): Promise<{ content: ArrayBuffer | string; contentType: string }> {
		const url = `${this.baseUrl}/public/${encodeURIComponent(filePath)}`;

		// Perform the fetch request to retrieve the static file
		const response = await fetch(url, { method: "GET" });
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Error ${response.status}: ${errorText}`);
		}

		// Get content type from headers
		const contentType = response.headers.get("Content-Type") || "application/octet-stream";

		// Determine the response type based on content type
		if (contentType.startsWith("text/")) {
			// Text file (e.g., HTML, CSS, JS, plain text)
			const content = await response.text();
			return { content, contentType };
		} else {
			// Binary file (e.g., images, PDFs)
			const content = await response.arrayBuffer();
			return { content, contentType };
		}
	}

	/**
	 * Consumes a ReadableStream and yields its chunks as an async generator.
	 * @param stream - The ReadableStream to consume
	 * @returns An async generator that yields stream chunks
	 */
	async *consumeStream<T>(stream: ReadableStream<T>): AsyncGenerator<T> {
		const reader = stream.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				yield value;
			}
		} finally {
			// Some runtimes may not implement releaseLock or may throw; guard it
			try {
				if (reader && typeof (reader as any).releaseLock === 'function') {
					(reader as any).releaseLock();
				}
			} catch (_e) {
				// ignore
			}
		}
	}

	/**
	 * Consumes a text stream and yields decoded text chunks.
	 * @param stream - The ReadableStream to consume
	 * @returns An async generator that yields text chunks
	 */
	async *consumeTextStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				yield decoder.decode(value, { stream: true });
			}
		} finally {
			try {
				if (reader && typeof (reader as any).releaseLock === 'function') {
					(reader as any).releaseLock();
				}
			} catch (_e) {}
		}
	}

	/**
	 * Consumes a plain JSON stream and yields parsed data objects in real-time.
	 * Optimized for minimal buffering to ensure immediate delivery of LLM tokens.
	 * @param stream - The ReadableStream to consume
	 * @returns An async generator that yields parsed data objects
	 */
	async *consumeJsonStream<T = any>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const text = decoder.decode(value, { stream: true });
				buffer += text;
				
				// Process complete JSON objects immediately
				while (true) {
					const newlineIndex = buffer.indexOf('\n');
					if (newlineIndex === -1) break; // No complete lines
					
					// Extract complete line
					const completeLine = buffer.substring(0, newlineIndex);
					buffer = buffer.substring(newlineIndex + 1);
					
					const trimmedLine = completeLine.trim();
					if (trimmedLine) {
						try {
							const data = parseTypedJson(trimmedLine);
							yield data;
						} catch (error) {
							// If JSON parsing fails, yield the raw string (for text streaming)
							yield trimmedLine as T;
						}
					}
				}
			}
			
			// Process any remaining data in buffer
			if (buffer.trim()) {
				try {
					const data = parseTypedJson(buffer.trim());
					yield data;
				} catch (error) {
					// Only log if it's not just whitespace or empty
					if (buffer.trim().length > 0) {
						console.error('Error parsing final JSON from stream:', error, 'Buffer:', buffer.trim());
					}
				}
			}
		} finally {
			try {
				if (reader && typeof (reader as any).releaseLock === 'function') {
					(reader as any).releaseLock();
				}
			} catch (_e) {}
		}
	}

	/**
	 * Converts a ReadableStream to an AsyncGenerator for end-to-end type safety.
	 * This allows generator methods to return AsyncGenerator directly instead of ReadableStream.
	 * @param stream - The ReadableStream to convert
	 * @returns An AsyncGenerator that yields the same data
	 */
	private async *streamToGenerator<T = any>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T> {
		yield* this.consumeJsonStream<T>(stream);
	}

	/**
	 * Generates a dynamic client proxy for making HTTP requests to server methods using RPC-style naming.
	 * @typeParam T - The type of the POTO instance that defines the server methods.
	 * @param modulePrefix the prefix for a specific module handler registered in the server. see {@link PotoModule}
	 * @returns A proxy object that handles method calls and routes them as HTTP requests
	 * to the server, translating method names into HTTP requests and arguments into URL paths,
	 * query parameters, or JSON payloads.
	 * 
	 * The proxy automatically detects generator methods based on server metadata and converts
	 * ReadableStream responses to AsyncGenerator for end-to-end type safety.
	 * @throws If the request fails.
	 */
	getProxy<T extends object>(modulePrefix:string): T {
		return new Proxy({}, {
			get: (_, propKey: string) => {
				return async (...args: any[]) => {
					// console.dir({args})
					const methodMatch = propKey.match(/^(get|post|put|delete)(.+)$/i);
					let httpMethod: string;
					let routePath: string;
					
					if (methodMatch) {
						// Method starts with HTTP verb - use the existing convention
						httpMethod = methodMatch[1].toLowerCase();
						routePath = methodMatch[2].replace(/\$/g, '/').toLowerCase();
						
						// Force POST method for GET/DELETE methods that have arguments
						// This prevents URL length issues when arguments are serialized in the URL path
						if (args.length > 0 && (httpMethod === 'get' || httpMethod === 'delete')) {
							httpMethod = 'post';
							// Keep the full method name for POST requests to maintain server-side routing
							routePath = propKey.replace(/\$/g, '/').toLowerCase();
						}
					} else {
						// Method doesn't start with HTTP verb - use POST as default
						httpMethod = "post";
						routePath = propKey.replace(/\$/g, '/').toLowerCase();
					}
					modulePrefix && (routePath = modulePrefix + '/' + routePath)
					let url = `${this.baseUrl}/${routePath}`;


					// Only add headers if necessary
					const headers: Record<string, string> = {};

					if (this.token) {
						headers[PotoConstants.Authorization] = `Bearer ${this.token}`;
					}

					if (httpMethod === "post" || httpMethod === "put") {
						headers["Content-Type"] = PotoConstants.appJson;
					}

					// Include cookies for session management
					// Note: In Node.js environment, we need to handle cookies manually
					// since fetch() doesn't automatically include cookies like browsers do
					if (typeof window === 'undefined' && this.storage) {
						// Node.js environment - check for stored cookies
						const storedCookies = this.storage.getItem('http_cookies');
						if (storedCookies) {
							headers['Cookie'] = storedCookies;
						}
					}


			// Handle automatic cancellation of previous requests
			let signal: AbortSignal | undefined;
			let requestArgs = args;
			
			// Assign unique request ID for concurrent safety
			const requestId = this.nextRequestId++;
			
			// Check if user explicitly passed an AbortSignal
			if (args.length > 0 && args[args.length - 1] instanceof AbortSignal) {
				signal = args[args.length - 1] as AbortSignal;
				requestArgs = args.slice(0, -1);
			} else {
				// CONCURRENT-SAFE: Create abort controller for each request
				// Never cancel other requests when running concurrently
				const abortController = new AbortController();
				this.requestAbortControllers.set(requestId, abortController);
				signal = abortController.signal;
				
				// Only store as "current" for manual cancellation via cancelCurrentRequest()
				// But NEVER auto-cancel when there are other active requests
				if (this.autoCancelPreviousRequests && this.activeRequestCount === 0) {
					// Safe to set as current since no other requests are active
					this.currentRequestAbortController = abortController;
				}
			}

				let options: RequestInit = {
					method: httpMethod.toUpperCase(),
					...(Object.keys(headers).length > 0 ? { headers } : {}),
					...(signal && { signal })
				};

				if (httpMethod === "get" || httpMethod === "delete") {
					// Append each argument as a JSON-encoded path segment in the URL
					requestArgs.forEach((arg) => {
						const jsonArg = stringifyTypedJson(arg);
						url += `/${encodeURIComponent(jsonArg)}`;
					});
				} else if (httpMethod === "post" || httpMethod === "put") {
					// Check if any argument contains Blobs
					const hasBlobs = this._containsBlobs(requestArgs);
					if (hasBlobs) {
						// Use async serialization for Blobs
						const argsString = await stringifyTypedJsonAsync(requestArgs);
						options.body = argsString;
					} else {
						// Use sync serialization for non-Blob data
						const argsString = stringifyTypedJson(requestArgs);
						options.body = argsString;
					}
				}

				// Track request start
				this.activeRequestCount++;
				
				// Log HTTP request if verbose mode is enabled
				if (this.verboseCallback && this.verboseCallback()) {
					console.log(`>> [${this.userId || 'anonymous'}] ${httpMethod.toUpperCase()} ${url}`);
					if (options.body) {
						console.log(`   Body: ${options.body}`);
					}
					if (Object.keys(headers).length > 0) {
						console.log(`   Headers: ${JSON.stringify(headers, null, 2)}`);
					}
				}
				
			let response: Response;
			try {
				response = await fetch(url, options);

						// Log HTTP response if verbose mode is enabled
						if (this.verboseCallback && this.verboseCallback()) {
							console.log(`<< [${this.userId || 'anonymous'}] ${httpMethod.toUpperCase()} ${url} ${response.status}`);
							const responseHeaders: Record<string, string> = {};
							response.headers.forEach((value, key) => {
								responseHeaders[key] = value;
							});
							if (Object.keys(responseHeaders).length > 0) {
								console.log(`   Response Headers: ${JSON.stringify(responseHeaders, null, 2)}`);
							}
						}

						// Handle cookies from response (for session management)
						if (typeof window === 'undefined' && this.storage) {
							// Node.js environment - store cookies from response
							const setCookieHeader = response.headers.get('Set-Cookie');
							if (setCookieHeader) {
								// Store the cookie for future requests
								this.storage.setItem('http_cookies', setCookieHeader);
							}
						}

						if (!response.ok) {
							const errorText = await response.text();
							throw { status: response.status, text: errorText };
						}
				} finally {
					// Track request completion
					this.activeRequestCount--;
					// Clean up per-request abort controller
					this.requestAbortControllers.delete(requestId);
				}

					const contentType = response.headers.get("Content-Type") || PotoConstants.appJson;
					if (response.status === 204) { // no content, void return type in the endpoint method
						return;
					}
					
					// Check if this is a streaming response (SSE)
					if (contentType.includes("text/event-stream")) {
						const stream = response.body as ReadableStream<Uint8Array>;
						
						// If it's a generator method, convert to AsyncGenerator for type safety
						if (response.headers.get("X-Response-Type") === "generator") {
							return this.streamToGenerator(stream);
						}
						
						// For regular ReadableStream methods, return the stream directly
						return stream;
					}
					
					// Check if this is a pure binary streaming response (video, audio, etc.)
					if (contentType.startsWith("video/") || 
					    contentType.startsWith("audio/") || 
					    contentType.includes("application/octet-stream")) {
						// Return the stream directly for pure binary streaming (no buffering)
						return response.body as ReadableStream<Uint8Array>;
					}
					
			if (contentType.includes(PotoConstants.appJson)) {
				const jsonText = await response.text();
				const result = parseTypedJson(jsonText);
				return result;
				} else if (contentType.startsWith("text/")) {
					return response.text();
				} else {
					return response.arrayBuffer();
				}
				};
			},
		}) as T;
	}

	/**
	 * Check if any argument contains Blobs
	 */
	private _containsBlobs(args: any[]): boolean {
		return args.some(arg => this._hasBlob(arg));
	}

	/**
	 * Recursively check if an object contains Blobs or binary data
	 * 
	 * Detects Blobs, ArrayBuffers, and TypedArrays to trigger async serialization
	 * with native base64 encoding (40-50% faster in browsers).
	 */
	private _hasBlob(obj: any, depth: number = 0, maxDepth: number = 10): boolean {
		if (depth > maxDepth) return false;
		
		// Always use async for Blobs
		if (obj instanceof Blob) return true;
		
		// 🚀 CRITICAL: Check for ArrayBuffer and TypedArrays BEFORE checking generic objects
		// Otherwise Object.values() will iterate through millions of array elements!
		if (obj instanceof ArrayBuffer) {
			// In browsers with FileReader, use async for native encoding
			return typeof FileReader !== 'undefined';
		}
		if (ArrayBuffer.isView(obj)) {
			// In browsers with FileReader, use async for native encoding  
			return typeof FileReader !== 'undefined';
		}
		
		// Skip known non-binary types BEFORE recursion
		if (obj instanceof Date || obj instanceof RegExp || obj instanceof Map || obj instanceof Set) {
			return false;
		}
		
		if (Array.isArray(obj)) {
			return obj.some(item => this._hasBlob(item, depth + 1, maxDepth));
		}
		
		if (obj && typeof obj === 'object') {
			return Object.values(obj).some(value => this._hasBlob(value, depth + 1, maxDepth));
		}
		
		return false;
	}
}
