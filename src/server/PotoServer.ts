import "reflect-metadata";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { serve } from "bun";
import path from "path";
import mime from "mime";
import { PotoConstants } from "../shared/PotoConstants";
import { PotoUser, UserProvider } from "./UserProvider";
import { getAllMethodsAndRoles } from "./serverDecorators";
import { MessagingClient, SseMessage } from "../shared/MessageClient";
import { PotoModule } from "./PotoModule";
import { EventStreamContentType } from "../shared/fetch-eventsource/fetch";
import { PotoRequestContext } from "./PotoRequestContext";
import { requestContextManager } from "./RequestContextManager";
import { UserSessionProvider, InMemorySessionProvider } from "./UserSessionProvider";
import { generatorToStream } from "../shared/CommonTypes";
import { parseTypedJson, stringifyTypedJson, stringifyTypedJsonAsync } from "../shared/TypedJsonUtils";

export type RouteHandler = (httpMethod: string, pathname: string, authHeader: string | null, req: Request) => Promise<Response>

type SignedUserId = { userId: string }

export type PotoServerDevelopment = 
	| boolean
	| {
		/**
		 * Enable Hot Module Replacement for routes (including React Fast Refresh, if React is in use)
		 *
		 * @default true if process.env.NODE_ENV !== 'production'
		 */
		hmr?: boolean;

		/**
		 * Enable console log streaming from browser to server
		 * @default false
		 */
		console?: boolean;

		/**
		 * Enable automatic workspace folders for Chrome DevTools
		 *
		 * This lets you persistently edit files in the browser.
		 * The response is a JSON object with the following shape:
		 * {
		 *   "workspace": {
		 *     "root": "<cwd>",
		 *     "uuid": "<uuid>"
		 *   }
		 * }
		 * For security reasons, if the remote socket address is not from localhost, 127.0.0.1, or ::1, the request is ignored.
		 * @default true
		 */
		chromeDevToolsAutomaticWorkspaceFolders?: boolean;
	};

export interface PotoServerConfig {
	port: number;
	staticDir: string;
	jwtSecret: string;
	// defaultFile?: string;
	routePrefix?: string;
	// the value of each route is a RouteValue type in Bun 
	routes?: Record<string, any>;
	development?: PotoServerDevelopment;
}

export class PotoServer {
	private routeHandlers: RouteHandler[] = [];
	private port: number;
	// Use ReturnType to infer the correct Server type from serve() function
	// This avoids direct dependency on the Server type which may vary across Bun/TypeScript versions
	public server?: ReturnType<typeof serve>;
	private staticDir: string;
	// private defaultFile: string;
	public jwtSecret: string;
	routePrefix: string;
	private debugMode: boolean = false;

	userProvider: UserProvider | undefined;
	sessionProvider: UserSessionProvider;

	subscriptions: Map<string, ReadableStreamDefaultController<any>> = new Map();
	private registeredClients: Map<string, MessagingClient> = new Map();
	private sseDisconnectHandler?: (userId: string) => Promise<void>;
	private chatModule?: any; // Reference to ChatServerModule for SSE events
	private loginHandler?: (userId: string) => Promise<void>; // Login callback handler

	private routes?: Record<string, any>;
	private development?: PotoServerDevelopment;

	constructor({ port, staticDir, jwtSecret, routePrefix = '', routes, development }: PotoServerConfig) {
		this.port = port;
		this.staticDir = staticDir;
		// this.defaultFile = defaultFile;
		this.jwtSecret = jwtSecret;
		this.routePrefix = routePrefix.startsWith('/') ? routePrefix.slice(1) : routePrefix
		this.routes = routes;
		this.development = development;

		// Set default in-memory session provider
		this.sessionProvider = new InMemorySessionProvider();

		this.sessionProvider.setContextManager(requestContextManager);
	}

	setUserProvider(provider: UserProvider) {
		this.userProvider = provider;
	}

	setSessionProvider(provider: UserSessionProvider) {
		this.sessionProvider = provider;
		
		provider.setContextManager(requestContextManager);

	}

	setDebugMode(debug: boolean) {
		this.debugMode = debug;
	}

	/**
	 * Set handler for SSE disconnect events
	 */
	setSseDisconnectHandler(handler: (userId: string) => Promise<void>) {
		this.sseDisconnectHandler = handler;
	}

	/**
	 * Set chat module reference for SSE events
	 */
	setChatModule(chatModule: any) {
		this.chatModule = chatModule;
	}

	/**
	 * Set login handler for successful logins
	 */
	setLoginHandler(handler: (userId: string) => Promise<void>) {
		this.loginHandler = handler;
	}

	/**
	 * Notify modules about SSE connection
	 */
	private notifySseConnect(userId: string) {
		if (this.chatModule && typeof this.chatModule.onSseConnect === 'function') {
			this.chatModule.onSseConnect(userId);
		}
	}

	registerSseWorker(client: MessagingClient): void {
		const clientId = client.getClientId();
		this.registeredClients.set(clientId, client);
	}

	// handlers: Record<string, RouteHandler> = {}

	// Updated 'use' method to accept only instances, not constructors
	addModule(module: PotoModule): void {

		// Runtime check to ensure the argument is not a function
		if (typeof module === 'function') {
			throw new Error("Invalid argument: Expected an instance of a class, but received a constructor function.");
		}

		// Inject the server's session provider into the module
		module.sessionProvider = this.sessionProvider;

		// Extract the constructor from the instance's prototype
		const classType = Object.getPrototypeOf(module).constructor

		// Pre-compute parameter types for all methods using the class constructor

		// Pre-compute and store route handlers for this business object
		const routeHandler = createHttpHandler(
			module,
			getAllMethodsAndRoles(classType),
			extractMethodParamTypes(classType),
			this
		)

		this.routeHandlers.push(routeHandler);
		// this.handlers[module.getRoute()] = routeHandler
	}

	private async serveStaticFile(filePath: string, req: Request): Promise<Response> {
		try {
			// SECURITY: Detect path traversal attempts BEFORE normalization
			// Block any path containing ../ or ..\ patterns
			if (filePath.includes('..')) {
				console.warn(`⚠️ Path traversal attempt blocked: ${filePath}`);
				return new Response("Forbidden", { status: 403 });
			}
			
			// SECURITY: Normalize and validate path to prevent directory traversal attacks
			const normalizedPath = path.normalize(filePath);
			const resolvedPath = path.resolve(this.staticDir, normalizedPath);
			const staticDirResolved = path.resolve(this.staticDir);
			
			// SECURITY: Double-check that resolved path is within staticDir
			// This catches any edge cases that might bypass the initial check
			if (!resolvedPath.startsWith(staticDirResolved + path.sep) && resolvedPath !== staticDirResolved) {
				console.warn(`⚠️ Path traversal attempt blocked (post-resolution): ${filePath}`);
				return new Response("Forbidden", { status: 403 });
			}
			
			const file = Bun.file(resolvedPath);
			
			// SECURITY: Proper file existence check (handles empty files correctly)
			const exists = await file.exists();
			if (!exists) {
				return new Response("File not found", { status: 404 });
			}
			
			const contentType = mime.getType(resolvedPath) || "application/octet-stream";
			
			// Generate ETag based on file size and last modified time
			const etag = `"${file.size}-${file.lastModified}"`;
			
			// PERFORMANCE: Check If-None-Match header for conditional requests
			// Return 304 Not Modified if ETag matches (saves bandwidth)
			const ifNoneMatch = req.headers.get("If-None-Match");
			if (ifNoneMatch === etag) {
				return new Response(null, {
					status: 304,
					headers: {
						"ETag": etag,
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			}
			
			// PERFORMANCE: Add caching headers for better client-side caching
			// Static assets can be cached aggressively since they don't change
			const headers: HeadersInit = {
				"Content-Type": contentType,
				// Cache for 1 year for immutable assets (adjust max-age as needed)
				"Cache-Control": "public, max-age=31536000, immutable",
				// Simple ETag based on file size and last modified time
				"ETag": etag,
			};
			
			return new Response(file, {
				status: 200,
				headers,
			});
		} catch (error) {
			console.error("Static file serving error:", error);
			if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
				return new Response("File not found", { status: 404 });
			}
			return new Response("Internal Server Error", { status: 500 });
		}
	}

	private isStaticFileRequest(pathname: string, method: string): boolean {
		const staticExtensions = [
			".js",
			".ts",
			".tsx",
			".css",
			".html",
			".png",
			".jpg",
			".gif",
			".ico",
			'.webp',
			'.map',
			'.txt',
			'.svg',
			'.glsl',
			'.mp3',
			'.wav',
			'.vrm',
			'.mp4',
			'.glb',
			'.onnx',
			'.wasm',
			'.gltf',
			'.gltf.json',
			'.gltf.bin',
			'.gltf.bin.gz',
			'.gltf.bin.gz.br',
			'.gltf.bin.gz.br.gz',
		];
		// const pathname = url.pathname;

		if (pathname === "/") return true;
		if (method !== "GET") return false;
		return staticExtensions.some(ext => pathname.endsWith(ext));
	}

	async handleLogin(json: { username: string, password: string }): Promise<Response> {
		try {
			// console.debug('handle login', json)
			if (!this.userProvider) {
				console.debug('user provider not defined')
				return new Response("user provider not defined", { status: 500 });
			}

			const { username, password } = json
			const user: PotoUser | undefined = await this.userProvider.findUserByUserId(username);
			// console.debug('user found', user)
			if (!user) {
				console.debug('login failed: user not found', { username });
				return new Response("Invalid credentials", { status: 401 });
			}
			if (!(await Bun.password.verify(password, user.passwordHash))) {
				console.debug('login failed: wrong password', { username });
				return new Response("Invalid credentials", { status: 401 });
			}
			
			// Call login handler if set (for dialog archiving, session management, etc.)
			if (this.loginHandler) {
				try {
					await this.loginHandler(user.id);
				} catch (error) {
					console.error(`❌ Login handler failed for user ${user.id}:`, error);
					// Don't fail the login, just log the error
				}
			}
			
			const token = jwt.sign({ userId: user.id } as SignedUserId, this.jwtSecret, { expiresIn: 60 * 60 });
			return new Response(stringifyTypedJson({ token, userId: user.id }), { status: 200, headers: { "Content-Type": PotoConstants.appJson } });
		} catch (error) {
			// Login verification failed (e.g., invalid password format)
			return new Response("Internal Server Error", { status: 500 });
		}
	}

	VISITOR_ID_PREFIX = 'visitor_'

	async handleRegisterAsVisitor(): Promise<Response> {
		try {
			// Fix race condition: Add random suffix to ensure unique IDs
			const timestamp = Date.now();
			const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 random chars
			const visitorId = `${this.VISITOR_ID_PREFIX}${timestamp}_${randomSuffix}`;
			const pw = Math.random() + ''
			this.userProvider?.addUser(new PotoUser(visitorId, await Bun.password.hash(pw), ['visitor']))
			const token = jwt.sign({ userId: visitorId } as SignedUserId, this.jwtSecret, { expiresIn: 60 * 60 });
			return new Response(
				stringifyTypedJson({
					token,
					userId: visitorId,
					pw: pw
				}),
				{
					status: 200,
					headers: { "Content-Type": PotoConstants.appJson }
				});
		} catch (error) {
			console.error("Register as visitor error:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	}

	async handlePublish(msg: SseMessage): Promise<Response> {
		try {
			// Check if the recipient is a registered in-process client
			const client = this.registeredClients.get(msg.recipientId);
			if (client) {
				// Pass the message to the in-process client and let it handle the response
				client.receiveMessage(msg).then(reply => {
					if (reply) {
						// Once the response is ready, push it to subscribers (i.e., the original sender)
						const subscriber = this.subscriptions.get(reply.recipientId);
						if (subscriber) {
							subscriber.enqueue(`data: ${stringifyTypedJson(reply)}\n\n`);
						}
					}
					else {
						// read but no response
					}
				}).catch(error => {
					// console.debug(`💥 Client messaging error detected`, {
					// 	recipientId: msg.recipientId,
					// 	senderId: msg.senderId,
					// 	message: msg.message,
					// 	timestamp: new Date().toISOString(),
					// 	error: error.message
					// });
					console.error("Error handling in-process client response:", error);
				});
				// acknowledge right away
				return new Response("Message received", { status: 200 });
			}
			else {
				// console.debug(`👻 Message to unknown recipient detected`, {
				// 	recipientId: msg.recipientId,
				// 	senderId: msg.senderId,
				// 	message: msg.message,
				// 	timestamp: new Date().toISOString(),
				// 	registeredClients: Array.from(this.registeredClients.keys()),
				// 	activeSubscriptions: Array.from(this.subscriptions.keys())
				// });
				return new Response("unknown recipient: " + msg.recipientId, { status: 400 });
			}

			// Immediate response to indicate that the message has been received for processing
		} catch (error) {
			console.error("Publish error:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	}

	/**
	 * to estalish persistent streaming connection
	 * @param req
	 * @returns
	 */

	handleSubscribe(req: Request): Response {
		const authHeader = req.headers.get(PotoConstants.Authorization);
		
		try {
			const suid = this.authenticateToken(authHeader);
			const userId = suid.userId

			return new Response(
				new ReadableStream(
					{
						start: (controller) => {
							controller.enqueue(": heartbeat\n\n"); // Comment line in SSE format to keep alive
							const heartbeatInterval = setInterval(() => {
								controller.enqueue(": heartbeat\n\n"); // Comment line in SSE format
							}, 8000); // bun by default timeout conections in 10 seconds

							this.subscriptions.set(userId, controller)
							
							// Notify modules about SSE connection
							this.notifySseConnect(userId)
							// in case the network connection is broken
							req.signal.addEventListener("abort", async () => {
								// console.debug(`🔌 Client disruption detected for user: ${userId}`, {
								// 	userId,
								// 	subscriptionCount: this.subscriptions.size,
								// 	timestamp: new Date().toISOString(),
								// 	reason: 'Connection aborted'
								// });
								
								// Call custom SSE disconnect handler if set
								if (this.sseDisconnectHandler) {
									try {
										await this.sseDisconnectHandler(userId);
									} catch (error) {
										console.error(`❌ SSE disconnect handler failed for user ${userId}:`, error);
									}
								}
								
								this.subscriptions.delete(userId)
								clearInterval(heartbeatInterval); // Clear the interval to avoid memory leaks
								controller.close();
								// console.debug(`🧹 Cleaned up subscription for user: ${userId}`, {
								// 	remainingSubscriptions: this.subscriptions.size
								// });
							});
						}
					}
				),

				{
					status: 200,
					headers: {
						"Content-Type": EventStreamContentType,
						"Cache-Control": "no-cache",
						"Connection": "keep-alive",
					},
				}
			);
		} catch (error) {
			return new Response((error as Error).message, { status: 401 });
		}
	}

	authenticateToken(authHeader: string | null): SignedUserId {
		if (!authHeader) throw new Error("No Authorization header found");
		const token = authHeader && authHeader.split(" ")[1];

		if (!token) throw new Error("No token found in Authorization header");

		try {
			const decoded = jwt.verify(token, this.jwtSecret) as SignedUserId;
			return decoded;
		} catch (error) {
			throw new Error("Invalid or expired token: " + error);
		}
	}

	/**
	 * consider using start(), since run sounds like it will block the main thread
	 */
	run(): void {
		this.server = serve({
			routes: this.routes,
			port: this.port,
			development: this.development,
			fetch: async (req: Request): Promise<Response> => {
				const url = new URL(req.url);

				// Request context will be set up later in the request handler

				// Handle CORS preflight requests
				let pathname = url.pathname;
				const corsHeaders = {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Max-Age": "86400"
				}
				if (req.method === "OPTIONS") {
					// Allow all origins, methods, and headers for development; adjust as needed for production
					return new Response(null, {
						status: 204,
						headers: corsHeaders
					});
				}

				if (pathname.endsWith('.html')) console.clear()

				if (this.debugMode) {
					// Extract user ID from auth header for logging
					let userId = 'anonymous';
					const authHeader = req.headers.get('authorization');
					if (authHeader) {
						try {
							const authData = this.authenticateToken(authHeader);
							userId = authData.userId;
						} catch (error) {
							// Invalid token, keep as anonymous
							return new Response("Unauthorized: Invalid or expired token", { status: 401 });
						}
					}
					console.debug(`>> [${userId}]`, req.method, pathname);
				}

				if (this.isStaticFileRequest(pathname, req.method)) {
					const filePath = pathname.slice(1);
					const r = await this.serveStaticFile(filePath, req);
					return r
				}

				if (!pathname.startsWith('/' + this.routePrefix)) {
					return new Response("url not for this Handler, because it does not match the route prefix: " + this.routePrefix, { status: 404 });
				}
				else if (this.routePrefix) {
					// remove the base part of the url
					pathname = pathname.slice(this.routePrefix.length + 1) || '/'
				}


				let response: Response = new Response("Handler Not Found", { status: 404 });
				const method = req.method;

				if (pathname === `/${PotoConstants.loginUrlPath}` && method === "POST") {
					const body = await req.json();
					response = await this.handleLogin(body);
				} else if (pathname === `/${PotoConstants.registerAsTourist}` && method === "POST") {
					response = await this.handleRegisterAsVisitor();
				} else if (pathname === `/${PotoConstants.publish}` && method === "POST") {
					const body = await req.json();
					response = await this.handlePublish(body);
				} else if (pathname.startsWith(`/${PotoConstants.subscribe}`) && method === "GET") {
					response = this.handleSubscribe(req);
				}
				else {
					const authHeader = req.headers.get(PotoConstants.Authorization);
					for (const handler of this.routeHandlers) {
						const result = await handler(method, pathname, authHeader, req);
						if (result.status !== 404) {
							response = result;
							break;
						}
					}
					// console.warn(`No handler found for ${pathname}. Is the handler module installed?`);
				}

				if (this.debugMode) {
					// Extract user ID from auth header for response logging
					let userId = 'anonymous';
					const authHeader = req.headers.get('authorization');
					if (authHeader) {
						try {
							const authData = this.authenticateToken(authHeader);
							userId = authData.userId;
						} catch (error) {
							// If token is invalid, return 401 immediately (force client to login)
							return new Response("Unauthorized: Invalid or expired token", { status: 401 });
							// Invalid token, keep as anonymous
						}
					}
					console.debug(`<< [${userId}]`, req.method, url.pathname, response.status);
				}
				// Always add CORS headers to all responses
				const newHeaders = new Headers(response.headers);
				for (const [k, v] of Object.entries(corsHeaders)) {
					newHeaders.set(k, v);
				}

				// Session headers are now handled in the createHttpHandler function

				// clone the response since the headers are immutable
				response = new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: newHeaders
				});
				return response;
			},
			error(e) {
				const response = new Response("Internal Server Error", { status: 500 });
				console.error(`<< Server Error:`, e);
				return response
			},
		});
		console.log(`PotoServer running on http://localhost:${this.port}`);

	}
}

export function extractMethodParamTypes<T>(classType: new (...args: any[]) => T): Record<string, any[]> {
	const methodParamTypes = {} as any
	const methodNames = Object.getOwnPropertyNames(classType.prototype).filter(method => method !== 'constructor');
	methodNames.forEach(methodName => {
		methodParamTypes[methodName] = Reflect.getMetadata("design:paramtypes", classType.prototype, methodName);
	});
	return methodParamTypes
}

export function createHttpHandler<T extends PotoModule>(
	instance: T,
	methodRoles: Record<string, string[]>,
	methodParamTypes: Record<string, any[]>,
	server: PotoServer | undefined
): RouteHandler {

	// Get all methods from the entire prototype chain (including inherited methods)
	const getAllMethods = (obj: any): string[] => {
		const methods: string[] = [];
		let current = obj;

		while (current && current !== Object.prototype) {
			const ownMethods = Object.getOwnPropertyNames(current)
				.filter(name => name !== 'constructor' && typeof current[name] === 'function');
			methods.push(...ownMethods);
			current = Object.getPrototypeOf(current);
		}

		return methods;
	};

	const urlToMethodMap = getAllMethods(Object.getPrototypeOf(instance))
		.filter(method => typeof (instance as any)[method] === "function")
		.reduce((map, methodName) => {
			const httpVerb = methodName.match(/^(get|post|put|delete)/i)?.[0]?.toLowerCase();
			if (httpVerb) {
				// Method starts with HTTP verb - use the existing convention
				const methodNoun = methodName.slice(httpVerb.length).toLowerCase();
				map[makeKey(httpVerb, methodNoun)] = methodName;
				// Also add the full method name as a valid key for more lenient lookup
				map[makeKey(httpVerb, methodName.toLowerCase())] = methodName;
			} else {
				// Method doesn't start with HTTP verb - use POST as default
				const methodNoun = methodName.toLowerCase();
				map[makeKey("post", methodNoun)] = methodName;
				// Also add the full method name as a valid key for more lenient lookup
				map[makeKey("post", methodName.toLowerCase())] = methodName;
			}
			return map;
		}, {} as Record<string, string>
		);

	return async (httpMethod: string, pathname: string, authHeader: string | null, req: Request): Promise<Response> => {
		const pathSegments = pathname.split("/").filter(Boolean);

		if (pathSegments[0] != instance.getRoute()) {
			return new Response(`Not Found: module prefix does not match this module: ${pathSegments[0]} vs ${instance.getRoute()}`, { status: 404 });
		}
		else {
			pathSegments.shift()
		}

		httpMethod = httpMethod.toLowerCase();

		if (pathSegments.length === 0) {
			return new Response("Not Found: no endpoint to call", { status: 404 });
		}

		const routeKey = makeKey(httpMethod, pathSegments[0].toLowerCase())
		let methodName = urlToMethodMap[routeKey];

		// If method not found and this is a POST request, try to find the original GET method
		// This handles cases where arguments force a GET method to use POST
		// The client keeps the full method name when forcing POST, so we need to look for it
		if (!methodName && httpMethod === 'post') {
			const routeMethodName = pathSegments[0].toLowerCase();
			// Check if this looks like a GET method that was forced to POST
			if (routeMethodName.startsWith('get') || routeMethodName.startsWith('delete')) {
				// First try to find the method as a GET method with the full name
				const getRouteKey = makeKey('get', routeMethodName);
				methodName = urlToMethodMap[getRouteKey];
				
				// If still not found, try to find it as a POST method with the full name
				// This handles cases where the method was originally registered as POST
				if (!methodName) {
					const postRouteKey = makeKey('post', routeMethodName);
					methodName = urlToMethodMap[postRouteKey];
				}
			}
		}

		if (!methodName) {
			return new Response(`${PotoConstants.msg.BadRoute} ${routeKey}`, { status: 404 });
		}

		let userId: string | undefined;
		let user: PotoUser | undefined

		if (server) {
			try {
				const authData = server.authenticateToken(authHeader);
				userId = authData.userId;
			} catch (error) {
				// If authentication fails and userId is required, return 401
				const accessRoles = methodRoles[methodName];
				if (accessRoles && accessRoles.length > 0) {
					return new Response(PotoConstants.msg.NoUserId, { status: 401 });
				}
			}

			userId && (user = await server.userProvider?.findUserByUserId(userId))

			const accessRoles = methodRoles[methodName];
			if (accessRoles && accessRoles.length > 0) {
				if (!userId) {
					return new Response(PotoConstants.msg.NoUserId, { status: 401 });
				}

				const userRoles = user?.roles;
				const hasCommonRole = userRoles && accessRoles.some((role) => userRoles.includes(role));
				if (!hasCommonRole) {
					return new Response(`Roles required: ${accessRoles} for ${methodName}`, { status: 403 });
				}
			}
		}

		try {
			const paramTypes = methodParamTypes[methodName];

			let args = await extractArgs(httpMethod, pathSegments, req)

			if (args instanceof Response) return args

			const paramCheckResult = verifyArgTypes(args, paramTypes);

			if (paramCheckResult) return paramCheckResult;

			// If no parameter types metadata is available, try to validate using function analysis
			if (!paramTypes) {
				const method = (instance as any)[methodName];
				if (method && typeof method === 'function') {
					const methodString = method.toString();
					// Extract parameter names from function signature
					const paramMatch = methodString.match(/\(([^)]*)\)/);
					if (paramMatch && paramMatch[1].trim()) {
						const paramNames = paramMatch[1].split(',').map((p: string) => p.trim()).filter((p: string) => p);
						const expectedParamCount = paramNames.length;
						const actualParamCount = args.length;
						
						// If we have fewer parameters than expected
						if (actualParamCount < expectedParamCount) {
							return new Response(
								stringifyTypedJson({ error: `Expected ${expectedParamCount} parameters, but got ${actualParamCount}.` }),
								{ status: 400, headers: { "Content-Type": PotoConstants.appJson } }
							);
						}
					}
				}
			}

			// No more parameter injection - context is available via AsyncLocalStorage

			// Set up request context for this execution chain
			const context = new PotoRequestContext(req.signal, user, req);

			// Inject session provider into the module instance before method execution
			if (server?.sessionProvider) {
				instance.sessionProvider = server.sessionProvider;
			}


			// *** here we go! Execute within request context for concurrency isolation
			let result = await requestContextManager.runWithContext(context, async () => {
				const methodResult = (instance as any)[methodName](...args);

				// If it's an async generator, return it directly without awaiting
				if (methodResult && typeof methodResult[Symbol.asyncIterator] === 'function') {
					return methodResult;
				}

				// For regular async methods, await the result
				return await methodResult;
			});

			// Collect session headers from request context after execution
			const sessionHeaders = new Headers();
			if (context.responseHeaders) {
				context.responseHeaders.forEach((value, key) => {
					sessionHeaders.set(key, value);
				});
			}

			if (result === undefined) {
				return new Response(null, {
					status: 204,
					headers: sessionHeaders
				});
			}


			// Check if result is a ReadableStream (generic binary streaming)
			if (result instanceof ReadableStream) {
				// ReadableStream defaults to binary/octet-stream
				// For structured data streaming, use AsyncGenerator instead (which converts to SSE)
				
				// Merge session headers with stream headers
				const streamHeaders = new Headers({
					"Content-Type": "application/octet-stream",
					"Cache-Control": "no-cache",
					"Connection": "keep-alive",
				});
				sessionHeaders.forEach((value, key) => {
					streamHeaders.set(key, value);
				});

				return new Response(result, {
					status: 200,
					headers: streamHeaders,
				});
			}

			// Check if result is an AsyncGenerator (generator method)
			if (result && typeof result === 'object' && typeof result.next === 'function' && typeof result[Symbol.asyncIterator] === 'function') {
				// Convert generator to ReadableStream using our utility
				// console.debug(`🎬 Starting AsyncGenerator stream`, {
				// 	timestamp: new Date().toISOString(),
				// 	streamType: 'AsyncGenerator',
				// 	userId: userId,
				// 	methodName: methodName
				// });

				// Create the stream within the same AsyncLocalStorage context to preserve context
				const stream = await requestContextManager.runWithContext(context, async () => {
					return generatorToStream(result);
				});

				// Merge session headers with generator headers
				const generatorHeaders = new Headers({
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					"Connection": "keep-alive",
					"X-Response-Type": "generator", // Metadata indicating this is a generator method
					"Access-Control-Expose-Headers": "X-Response-Type", // Expose custom header to client
				});
				sessionHeaders.forEach((value, key) => {
					generatorHeaders.set(key, value);
				});

				return new Response(stream, {
					status: 200,
					headers: generatorHeaders,
				});
			}

			// Regular JSON response
			const jsonHeaders = new Headers({ "Content-Type": PotoConstants.appJson });
			sessionHeaders.forEach((value, key) => {
				jsonHeaders.set(key, value);
			});

			// Check if result contains Blobs
			const hasBlobs = _containsBlobs([result]);
			if (hasBlobs) {
				// Use async serialization for Blobs
				const jsonString = await stringifyTypedJsonAsync(result);
				return new Response(jsonString, {
					status: 200,
					headers: jsonHeaders,
				});
			} else {
				// Use sync serialization for non-Blob data
				return new Response(stringifyTypedJson(result), {
					status: 200,
					headers: jsonHeaders,
				});
			}
		} catch (error: any) {
			if (error.status && error.message) {
				return new Response(stringifyTypedJson({ error: error.message }), {
					status: error.status,
					headers: { "Content-Type": PotoConstants.appJson }
				});
			}
			console.error(`Error processing ${methodName}:`, error);
			return new Response("Internal Server Error", { status: 500 });
		}
	};

	function makeKey(httpVerb: string, methodNoun: string) {
		return `${httpVerb}:${methodNoun}`;
	}
}

function verifyArgTypes(params: any[], paramTypes: any[]): Response | undefined {
	if (!paramTypes) {
		// If no parameter types metadata is available, we can't validate
		// This happens when decorator metadata is not available
		return;
	}

	const expectedParamCount = paramTypes.length

	if (params.length !== expectedParamCount) {
		return new Response(
			stringifyTypedJson({ error: `Expected ${expectedParamCount} parameters, but got ${params.length}.` }),
			{ status: 400, headers: { "Content-Type": PotoConstants.appJson } }
		);
	}

	for (let i = 0; i < paramTypes.length; i++) {
		const expectedType = paramTypes[i];
		const param = params[i];

		if (!isValidType(param, expectedType)) {
			return new Response(
				stringifyTypedJson({ error: `Parameter '${param}' is not of type '${expectedType.name}'.` }),
				{ status: 400, headers: { "Content-Type": PotoConstants.appJson } }
			);
		}
	}
}

function isValidType(param: any, expectedType: any): boolean {
	// Handle specific primitive types explicitly
	if (expectedType === Number) {
		return typeof param === 'number' && !isNaN(param);
	} else if (expectedType === String) {
		return typeof param === 'string';
	} else if (expectedType === Boolean) {
		return typeof param === 'boolean';
	}

	// Handle arrays and objects with specific checks
	if (expectedType === Array) {
		return Array.isArray(param);
	}
	if (expectedType === Object) {
		return typeof param === "object" && param !== null && !Array.isArray(param);
	}

	// Handle class instances (custom or built-in like Date)
	if (typeof expectedType === "function") {
		return param instanceof expectedType;
	}

	// This line could handle unexpected cases or future extensions
	return false;
}

export async function extractArgs(httpMethod: string, pathSegments: string[], req: Request): Promise<any[] | Response> {
	let params: any[] = [];

	if (httpMethod === "get" || httpMethod === "delete") {
		try {
			params = pathSegments.slice(1).map(decodeURIComponent).map(
				p => parseTypedJson(p)
			);
		}
		catch (err) {
			return new Response(PotoConstants.msg.NotJson, { status: 400 });
		}
	} else if (httpMethod === "post" || httpMethod === "put") {
		try {
			// Optimized: Get raw JSON text and parse once instead of double parsing
			// Old: req.json() → JSON.stringify() → parseTypedJson()  (2x parse + 1x stringify!)
			// New: req.text() → parseTypedJson()  (1x parse only!)
			const bodyText = await req.text();
			
			if (!bodyText) {
				params = [];
			} else {
				// Parse directly from JSON string - parseTypedJson handles both regular JSON and TypedJSON
				const deserializedBody = parseTypedJson(bodyText);
				params = Array.isArray(deserializedBody) ? deserializedBody : [deserializedBody];
			}
		} catch (err) {
			// Handle case where body is empty or invalid JSON
			params = [];
		}
	}

	return params
}

/**
 * Check if any argument contains Blobs
 */
function _containsBlobs(args: any[]): boolean {
	return args.some(arg => _hasBlob(arg));
}

/**
 * Recursively check if an object contains Blobs or binary data
 * 
 * Detects Blobs, ArrayBuffers, and TypedArrays to trigger async serialization
 * with native base64 encoding (much faster!).
 */
function _hasBlob(obj: any, depth: number = 0, maxDepth: number = 10): boolean {
	if (depth > maxDepth) return false;
	
	// Always use async for Blobs
	if (obj instanceof Blob) return true;
	
	// Use async for binary data to leverage native Buffer.toString('base64')
	// This provides much faster base64 encoding compared to JavaScript loops
	if (obj instanceof ArrayBuffer) return true;
	if (ArrayBuffer.isView(obj)) return true;  // Detects Uint8Array, Int16Array, etc.
	
	if (Array.isArray(obj)) {
		return obj.some(item => _hasBlob(item, depth + 1, maxDepth));
	}
	
	if (obj && typeof obj === 'object') {
		// Skip Date, RegExp, Map, Set - they don't contain binary data
		if (obj instanceof Date || obj instanceof RegExp || obj instanceof Map || obj instanceof Set) {
			return false;
		}
		return Object.values(obj).some(value => _hasBlob(value, depth + 1, maxDepth));
	}
	
	return false;
}
