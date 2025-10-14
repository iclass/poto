import { describe, beforeAll, test as it, expect } from "bun:test";
import { PotoModule } from "../../../src/server/PotoModule";
import { RouteHandler, createHttpHandler } from "../../../src/server/PotoServer";
import { UserProvider, PotoUser } from "../../../src/server/UserProvider";
import { PotoConstants } from "../../../src/shared/PotoConstants";

describe("PotoServer Streaming Methods", () => {
	class TestStreamingApi extends PotoModule {
		getRoute(): string {
			return "teststreaming";
		}
		async postCounterStream_(count: number): Promise<ReadableStream<Uint8Array>> {
			return new ReadableStream({
				start(controller) {
					let current = 1;
					const interval = setInterval(() => {
						if (current > count) {
							controller.close();
							clearInterval(interval);
							return;
						}

						const chunk = JSON.stringify({ number: current, timestamp: new Date().toISOString() });
						controller.enqueue(new TextEncoder().encode(chunk + '\n'));
						current++;
					}, 10); // Faster for testing
				}
			});
		}

		async postTextStream_(message: string): Promise<ReadableStream<Uint8Array>> {
			const words = message.split(' ');

			return new ReadableStream({
				start(controller) {
					let index = 0;
					const interval = setInterval(() => {
						if (index >= words.length) {
							controller.close();
							clearInterval(interval);
							return;
						}

						const chunk = JSON.stringify({ word: words[index], index });
						controller.enqueue(new TextEncoder().encode(chunk + '\n'));
						index++;
					}, 5); // Faster for testing
				}
			});
		}

		async postErrorStream_(shouldError: boolean): Promise<ReadableStream<Uint8Array>> {
			return new ReadableStream({
				start(controller) {
					if (shouldError) {
						controller.error(new Error("Stream error"));
						return;
					}

					controller.enqueue(new TextEncoder().encode(JSON.stringify({ message: "success" }) + '\n'));
					controller.close();
				}
			});
		}

		async postEmptyStream_(): Promise<ReadableStream<Uint8Array>> {
			return new ReadableStream({
				start(controller) {
					controller.close();
				}
			});
		}

		async postEcho_(message: string): Promise<string> {
			return `Echo: ${message}`;
		}
	}

	// Mock server and user for testing
	class MockStreamingServer {
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
					sendMessage: async () => { }
				};
			},
			addUser: function (user: PotoUser): Promise<boolean> {
				throw new Error("Function not implemented.");
			}
		};
	}

	let server: MockStreamingServer;
	let handler: RouteHandler;

	beforeAll(() => {
		server = new MockStreamingServer();
		handler = createHttpHandler(
			new TestStreamingApi(),
			{
				postCounterStream_: ["user"],
				postTextStream_: ["user"],
				postErrorStream_: ["user"],
				postEmptyStream_: ["user"],
				postEcho_: ["user"]
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

	it("should handle counter stream and return proper streaming format", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/CounterStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([3])
		});

		const res = await handler('POST', `/teststreaming/counterstream_`, authString, req);

	expect(res.status).toBe(200);
	expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
	expect(res.headers.get("Cache-Control")).toBe("no-cache");
		expect(res.headers.get("Connection")).toBe("keep-alive");

		const chunks = await consumeStream(res.body!);

		expect(chunks).toHaveLength(3);
		expect(chunks[0]).toEqual(expect.objectContaining({ number: 1 }));
		expect(chunks[1]).toEqual(expect.objectContaining({ number: 2 }));
		expect(chunks[2]).toEqual(expect.objectContaining({ number: 3 }));

		// Verify timestamps are present
		chunks.forEach(chunk => {
			expect(chunk).toHaveProperty('timestamp');
			expect(new Date(chunk.timestamp)).toBeInstanceOf(Date);
		});
	});

	it("should handle text stream and return word chunks", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const message = "Hello world test";
		const req = new Request(`http://localhost/TextStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([message])
		});

		const res = await handler('POST', `/teststreaming/textstream_`, authString, req);

	expect(res.status).toBe(200);
	expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

	const chunks = await consumeStream(res.body!);

		expect(chunks).toHaveLength(3);
		expect(chunks[0]).toEqual({ word: "Hello", index: 0 });
		expect(chunks[1]).toEqual({ word: "world", index: 1 });
		expect(chunks[2]).toEqual({ word: "test", index: 2 });
	});

	it("should handle empty stream correctly", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/EmptyStream`, {
			method: "POST",
			headers: { Authorization: authString }
		});

		const res = await handler('POST', `/teststreaming/emptystream_`, authString, req);

	expect(res.status).toBe(200);
	expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

	const chunks = await consumeStream(res.body!);
		expect(chunks).toHaveLength(0);
	});

	it("should handle stream errors gracefully", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/ErrorStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([true])
		});

	const res = await handler('POST', `/teststreaming/errorstream_`, authString, req);

	expect(res.status).toBe(200);
	expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

	// The stream should error out, but the response itself should be successful
		// The error will be propagated through the stream
		const reader = res.body!.getReader();
		try {
			await reader.read();
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
		} finally {
			reader.releaseLock();
		}
	});

	it("should handle successful error stream", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/ErrorStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([false])
		});

		const res = await handler('POST', `/teststreaming/errorstream_`, authString, req);

	expect(res.status).toBe(200);
	expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

	const chunks = await consumeStream(res.body!);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toEqual({ message: "success" });
	});

	it("should return 401 for streaming methods without authentication", async () => {
		const req = new Request(`http://localhost/CounterStream`, {
			method: "POST",
			body: JSON.stringify([3])
		});

		const res = await handler('POST', `/teststreaming/counterstream_`, null, req);

		expect(res.status).toBe(401);
		expect(await res.text()).toEqual(PotoConstants.msg.NoUserId);
	});

	it("should handle regular non-streaming methods normally", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/Echo`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify(["test message"])
		});

		const res = await handler('POST', `/teststreaming/echo_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe(PotoConstants.appJson);

		const data = await res.json();
		expect(data).toBe("Echo: test message");
	});

	it("should handle large streaming responses", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/CounterStream`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([10])
		});

		const res = await handler('POST', `/teststreaming/counterstream_`, authString, req);

	expect(res.status).toBe(200);
	expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

	const chunks = await consumeStream(res.body!);

		expect(chunks).toHaveLength(10);
		for (let i = 0; i < 10; i++) {
			expect(chunks[i]).toEqual(expect.objectContaining({ number: i + 1 }));
		}
	});

	it("should handle concurrent streaming requests", async () => {
		const authString = `Bearer ${server.jwtSecret}`;

		// Create multiple concurrent requests
		const requests = Array.from({ length: 3 }, (_, i) => {
			const req = new Request(`http://localhost/counterstream_`, {
				method: "POST",
				headers: { Authorization: authString },
				body: JSON.stringify([2])
			});
			return handler('POST', `/teststreaming/counterstream_`, authString, req);
		});

		const responses = await Promise.all(requests);

		// All responses should be successful
		responses.forEach(res => {
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
	});

		// Verify each stream has correct data
		for (const res of responses) {
			const chunks = await consumeStream(res.body!);
			expect(chunks).toHaveLength(2);
			expect(chunks[0]).toEqual(expect.objectContaining({ number: 1 }));
			expect(chunks[1]).toEqual(expect.objectContaining({ number: 2 }));
		}
	});
});
