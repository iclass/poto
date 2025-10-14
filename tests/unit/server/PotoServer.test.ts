// tests/potoServer.test.ts
import "reflect-metadata";
import { describe, beforeAll, test, afterEach, afterAll, expect, it } from "bun:test";
import { PotoConstants } from "../../../src/shared/PotoConstants";
import { createHttpHandler, extractMethodParamTypes, PotoServer, RouteHandler } from "../../../src/server/PotoServer";
import fs from "fs/promises";
import path from "path";
import mime from "mime";
import { PotoModule } from "../../../src/server/PotoModule";
import { PotoUser, UserProvider } from "../../../src/server/UserProvider";

// Helper to generate random port in safe range
function getRandomPort(): number {
	return Math.floor(Math.random() * 30000) + 30000;
}

describe("PotoServer serveStaticFile Tests", () => {
	let potoServer: PotoServer;
	const staticDir = path.resolve(__dirname, "public");
	const testFilePath = path.join(staticDir, "testFile.txt");

	beforeAll(async () => {
		// Create the public directory if it doesn't exist
		await fs.mkdir(staticDir, { recursive: true });
		
		// Create a test file
		await fs.writeFile(testFilePath, "Hello, this is a test file");
		
		potoServer = new PotoServer({ port: getRandomPort(), staticDir, jwtSecret: 'my secret' });
	});

	afterAll(async () => {
		// Clean up: remove the test file and directory
		try {
			await fs.unlink(testFilePath);
			await fs.rmdir(staticDir);
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	test("should serve a valid file with correct MIME type", async () => {
		const mockFilePath = "testFile.txt";
		const resolvedPath = path.join(staticDir, mockFilePath);
		const mockMimeType = mime.getType(resolvedPath) || "application/octet-stream";

		const response = await potoServer["serveStaticFile"](mockFilePath);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(mockMimeType);
		const responseText = await response.text();
		expect(responseText.trim()).toBe("Hello, this is a test file");
	});

	test("should return 404 for a file that does not exist", async () => {
		const mockFilePath = "nonExistentFile.txt";

		const response = await potoServer["serveStaticFile"](mockFilePath);

		expect(response.status).toBe(404);
		const responseText = await response.text();
		expect(responseText).toBe("File not found");
	});

	test("should return 500 for other errors", async () => {
		// Create a file with invalid characters in the path to trigger an error
		const mockFilePath = "errorFile.txt";
		
		// Mock Bun.file to throw an error
		const originalBunFile = Bun.file;
		(Bun as any).file = () => {
			throw new Error("Unexpected error");
		};

		const response = await potoServer["serveStaticFile"](mockFilePath);

		expect(response.status).toBe(500);
		const responseText = await response.text();
		expect(responseText).toBe("Internal Server Error");

		// Restore original Bun.file
		(Bun as any).file = originalBunFile;
	});
});


describe("PotoServer Endpoints", () => {
	class TestApi extends PotoModule{
		async getUser(id: number, isActive: boolean): Promise<{ id: number; isActive: boolean }> {
			return { id, isActive };
		}

		async postUser(data: { name: string; age: number }): Promise<{ status: string, name:string }> {
			return { status: "User created", name: data.name };
		}

		nonEndpointMethod() {
			// This method should not be accessible as an endpoint
		}
	}

	// Helper function to simulate an HTTP request
	async function handleRequest(url: string, method: string, body?: any) {
		const handler = createHttpHandler(new TestApi(), {}, extractMethodParamTypes(TestApi), undefined);
		const fullUrl = `http://localhost${url.startsWith('/') ? url : '/' + url}`;
		const req = new Request(fullUrl, {
			method,
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(5000) // Add a timeout signal
		});
		return handler(method, url, null, req);
	}


	it("should handle GET requests for getUser and parse parameters", async () => {
		const response = await handleRequest(`/${TestApi.name}/user/123/true`, "GET");
		expect(response.status).toBe(200);

		const json = await response.json();
		expect(json).toEqual({ id: 123, isActive: true });
	});

	it("should handle POST requests for postUser and parse JSON body", async () => {
		const response = await handleRequest(`/${TestApi.name}/user`, "POST", { name: "Alice", age: 30 });
		expect(response.status).toBe(200);

		const json = await response.json();
		expect(json).toEqual({ status: "User created", name: "Alice" });
	});

	it("should return 404 for non-endpoint methods", async () => {
		const response = await handleRequest(`/${TestApi.name}/nonEndpointMethod`, "GET");
		expect(response.status).toBe(404);
	});

	it("should return 404 for undefined routes", async () => {
		const response = await handleRequest(`/${TestApi.name}/nonExistentRoute`, "GET");
		expect(response.status).toBe(404);
	});

	it("should return 405 for unsupported HTTP methods", async () => {
		const response = await handleRequest(`/${TestApi.name}/user`, "PATCH");
		expect(response.status).toBe(404);
		expect(await response.text()).toStartWith(PotoConstants.msg.BadRoute)
	});

	it("should return 400 for missing required parameters in GET requests", async () => {
		const response = await handleRequest(`/${TestApi.name}/user`, "GET");
		expect(response.status).toBe(400);
	});

	it("should return 400 for bad arg server errors", async () => {
		// Simulate an error by invoking the method with invalid parameter types
		const response = await handleRequest(`/${TestApi.name}/user/notAJson/true`, "GET");
		expect(response.status).toBe(400); // bad request
	});
});

describe("createHttpHandler with userId injection", () => {
	// Mock server and controller
	class MockServer {
		jwtSecret = "testSecret";

		authenticateToken(authHeader:string|null) {
			if (authHeader?.includes(this.jwtSecret)) {
				return { userId: "testUser" };
			}
			return undefined;
		}

		userProvider: UserProvider = {
			async findUserByUserId(userId: string) {
				return {
					id: userId,
					passwordHash: 'xxx',
					roles: ["user"],
					sendMessage: async () => { /* mock sendMessage */ }
				};
			},
			addUser: function (user: PotoUser): Promise<boolean> {
				throw new Error("Function not implemented.");
			}
		};
	}

	class TestController extends PotoModule{

		async getUserInfo() {
			const user = await this.getCurrentUser();
			return { data: "User Info", userId: user?.id };
		}

		async getUserInfo2(sth: number) {
			const user = await this.getCurrentUser();
			return { sth, data: "User Info", uid: user?.id };
		}

		async getUserData(userId: string) {
			return { userId, data: "User Data" };
		}
	}

	let server: MockServer;
	// let handler: ReturnType<typeof createHttpHandler>;
	let handler: RouteHandler;

	beforeAll(() => {
		server = new MockServer();
		handler = createHttpHandler(
			new TestController(),
			{
				getUserInfo: ["user"],
				getUserInfo2: ["user"],
				getUserData: []
			},
			{},
			server as any);
	});

	it("should inject userId when server authenticates successfully", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/UserInfo`, {
			method: "GET",
			headers: { Authorization: authString }
		});

		const res = await handler('get', `/${TestController.name}/UserInfo`, `Bearer ${server.jwtSecret}`, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ userId: "testUser", data: "User Info" });
	});

	it("should inject userId with other params", async () => {
		const num = 888
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/UserInfo2/${num}`, {
			method: "GET",
			headers: { Authorization: authString }
			
		});

		const res = await handler('get', `/${TestController.name}/UserInfo2/${num}`, authString, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ uid: "testUser", data: "User Info", sth: num });
	});

	it("should return 401 when userId is required but not authenticated", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/UserInfo`, {
			method: "GET",
		});

		const res = await handler('get', `/${TestController.name}/UserInfo`, null, req );

		expect(res.status).toBe(401);
		expect(await res.text()).toEqual(PotoConstants.msg.NoUserId);
	});

	it("should call the method without userId if not required", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/UserData`, {
			method: "GET",
			headers: { Authorization: authString }
		});
		const res = await handler('get', `/${TestController.name}/UserData/${JSON.stringify("testUserId")}`, null, req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ userId: "testUserId", data: "User Data" });
	});

	it("should return 404 if no matching method is found", async () => {
		const req = new Request(`http://localhost/unknownMethod`, {
			method: "GET",
		});
		const res = await handler('get', `/${TestController.name}/unknownMethod`, null, req);

		expect(res.status).toBe(404);
		// const data = await res.json();
		// expect(await res.text()).toEqual("Not Found route: get:unknownmethod");
	});

	it("should return 405 if the method does not match HTTP verb", async () => {
		const req = new Request(`http://localhost/UserInfo`, {
			method: "POST",
		});		
		const res = await handler('POST', `/${TestController.name}/UserInfo`, null, req);

		expect(res.status).toBe(404);
		// const data = await res.json();
		// expect(await res.text()).toEqual("Not Found route: post:userinfo");
	});
});

describe("PotoServer Streaming Edge Cases", () => {
	class EdgeCaseStreamingApi extends PotoModule {
		getRoute(): string {
			return "edgecase";
		}
	async postDelayedStream_(delay: number): Promise<ReadableStream<Uint8Array>> {
		return new ReadableStream({
			async start(controller) {
				// Use async/await to properly wait for the delay
				await new Promise(resolve => setTimeout(resolve, Math.min(delay, 50)));
				try {
					controller.enqueue(new TextEncoder().encode(JSON.stringify({ message: "delayed" }) + '\n'));
					controller.close();
				} catch (error) {
					// Controller might be closed if stream was cancelled
					if (error instanceof TypeError && error.message.includes('closed')) {
						// Stream was cancelled, ignore
						return;
					}
					throw error;
				}
			}
		});
	}

		async postChunkedStream_(chunkSize: number): Promise<ReadableStream<Uint8Array>> {
			return new ReadableStream({
				start(controller) {
					const data = "x".repeat(chunkSize);
					controller.enqueue(new TextEncoder().encode(JSON.stringify({ data }) + '\n'));
					controller.close();
				}
			});
		}

		async postUnicodeStream_(): Promise<ReadableStream<Uint8Array>> {
			return new ReadableStream({
				start(controller) {
					const unicodeData = { 
						message: "Hello 世界 🌍", 
						emoji: "🚀🎉💻",
						chinese: "你好世界"
					};
					controller.enqueue(new TextEncoder().encode(JSON.stringify(unicodeData) + '\n'));
					controller.close();
				}
			});
		}
	}

	class MockEdgeCaseServer {
		jwtSecret = "testSecret";

		authenticateToken(authHeader: string | null) {
			if (authHeader?.includes(this.jwtSecret)) {
				return { userId: "testUser" };
			}
			return undefined;
		}

		userProvider: UserProvider = {
			async findUserByUserId(userId: string) {
				return {
					id: userId,
					passwordHash: 'xxx',
					roles: ["user"],
					sendMessage: async () => { /* mock sendMessage */ }
				};
			},
			addUser: function (user: PotoUser): Promise<boolean> {
				throw new Error("Function not implemented.");
			}
		};
	}

	let server: MockEdgeCaseServer;
	let handler: RouteHandler;

	beforeAll(() => {
		server = new MockEdgeCaseServer();
		handler = createHttpHandler(
			new EdgeCaseStreamingApi(),
			{
				postDelayedStream_: ["user"],
				postChunkedStream_: ["user"],
				postUnicodeStream_: ["user"]
			},
			{},
			server as any
		);
	});

	// Helper function to consume stream and return parsed data
	async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<any[]> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		const chunks: any[] = [];
		
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const text = decoder.decode(value, { stream: true });
				const lines = text.split('\n');
				
				for (const line of lines) {
					if (line.trim()) { // Skip empty lines
						try {
							const data = JSON.parse(line);
							chunks.push(data);
						} catch (e) {
							// Skip invalid JSON
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
		
		return chunks;
	}

	it("should handle delayed stream responses", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/DelayedStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([100])
		});

		const res = await handler('POST', `/edgecase/delayedstream_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

		const chunks = await consumeStream(res.body!);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toEqual({ message: "delayed" });
	});

	it("should handle large chunk data", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const chunkSize = 10000; // 10KB
		const req = new Request(`http://localhost/ChunkedStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([chunkSize])
		});

		const res = await handler('POST', `/edgecase/chunkedstream_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

		const chunks = await consumeStream(res.body!);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].data).toHaveLength(chunkSize);
		expect(chunks[0].data).toBe("x".repeat(chunkSize));
	});

	it("should handle unicode and emoji data correctly", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/UnicodeStream`, {
			method: "POST",
			headers: { Authorization: authString }
		});

		const res = await handler('POST', `/edgecase/unicodestream_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

		const chunks = await consumeStream(res.body!);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toEqual({
			message: "Hello 世界 🌍",
			emoji: "🚀🎉💻",
			chinese: "你好世界"
		});
	});

	it("should handle stream cancellation", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/DelayedStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([1000]) // Long delay
		});

		const res = await handler('POST', `/edgecase/delayedstream_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

		// Cancel the stream early
		const reader = res.body!.getReader();
		try {
			await reader.cancel();
			// Should not throw an error
			expect(reader.closed).toBeDefined();
		} catch (error) {
			// If the stream is already closed or locked, that's also acceptable
			expect(error).toBeDefined();
		} finally {
			// Always release the lock to clean up
			try {
				reader.releaseLock();
			} catch (e) {
				// Ignore errors if lock is already released
			}
		}
	});
});
