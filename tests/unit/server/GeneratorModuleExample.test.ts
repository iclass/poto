import { describe, it, expect, beforeEach } from "bun:test";
import { PotoServer } from "../../../src/server/PotoServer";
import { GeneratorModuleExample } from "./GeneratorModuleExample";
import { PotoUser, UserProvider } from "../../../src/server/UserProvider";

// Helper to generate random port in safe range
function getRandomPort(): number {
	return Math.floor(Math.random() * 30000) + 30000;
}

describe("PotoServer Generator Method Support", () => {
	let server: PotoServer;
	let handler: any;

	beforeEach(() => {
		server = new PotoServer({
			port: getRandomPort(),
			staticDir: "./public",
			jwtSecret: "testSecret"
		});

		// Mock user provider
		server.setUserProvider({
			async findUserByUserId(userId: string) {
				return new PotoUser(userId, "hash", ["user"]);
			},
			async addUser(user: PotoUser): Promise<boolean> {
				return true;
			}
		});

		// Add the generator module
		server.addModule(new GeneratorModuleExample());
	});

	// Helper function to consume stream and return parsed data
	async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<any[]> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		const chunks: any[] = [];
		let buffer = '';
		
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const text = decoder.decode(value, { stream: true });
				buffer += text;
				
				// Process complete JSON objects from buffer
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep incomplete line in buffer
				
				for (const line of lines) {
					const trimmedLine = line.trim();
					if (trimmedLine) {
						try {
							const data = JSON.parse(trimmedLine);
							chunks.push(data);
						} catch (e) {
							// Skip invalid JSON
						}
					}
				}
			}
			
			// Process any remaining data in buffer
			if (buffer.trim()) {
				try {
					const data = JSON.parse(buffer.trim());
					chunks.push(data);
				} catch (e) {
					// Skip invalid JSON
				}
			}
		} finally {
			reader.releaseLock();
		}
		
		return chunks;
	}

	it("should handle simple generator method", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/Counter`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([3])
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/counter_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");

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

	it("should handle generator with progress tracking", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/Progress`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([3])
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/progress_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");

		const chunks = await consumeStream(res.body!);
		
		expect(chunks).toHaveLength(4); // 3 progress + 1 complete
		
		// Check progress chunks
		for (let i = 0; i < 3; i++) {
			expect(chunks[i]).toEqual(expect.objectContaining({
				type: "progress",
				step: i + 1,
				total: 3,
				progress: Math.round(((i + 1) / 3) * 100)
			}));
		}
		
		// Check completion chunk
		expect(chunks[3]).toEqual(expect.objectContaining({
			type: "complete",
			message: "All steps completed successfully!"
		}));
	});

	it("should handle generator with error handling", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/WithError`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([true]) // shouldError = true
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/witherror_`, authString, req);

		// The error should be handled gracefully and still return a stream
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");

		// The stream should contain the start message before the error occurs
		// Note: The error will be thrown during stream consumption, which is expected behavior
		try {
			const chunks = await consumeStream(res.body!);
			expect(chunks.length).toBeGreaterThan(0);
			
			// Should have the start message before the error
			expect(chunks[0]).toEqual(expect.objectContaining({
				type: "start",
				message: "Starting operation..."
			}));
		} catch (error) {
			// The error is expected to be thrown during stream consumption
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain("Simulated error occurred");
		}
	});

	it("should handle generator without error", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/WithError`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([false]) // shouldError = false
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/witherror_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");

		const chunks = await consumeStream(res.body!);
		
		expect(chunks).toHaveLength(2); // start + success
		expect(chunks[0]).toEqual(expect.objectContaining({
			type: "start",
			message: "Starting operation..."
		}));
		expect(chunks[1]).toEqual(expect.objectContaining({
			type: "success",
			message: "Operation completed successfully"
		}));
	});

	it("should handle generator with conditional logic", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/Conditional`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify(["fast"])
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/conditional_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");

		const chunks = await consumeStream(res.body!);
		
		expect(chunks).toHaveLength(5); // 1 start + 3 data + 1 complete
		
		expect(chunks[0]).toEqual(expect.objectContaining({
			type: "start",
			condition: "fast"
		}));
		
		// Check data chunks
		for (let i = 1; i <= 3; i++) {
			expect(chunks[i]).toEqual(expect.objectContaining({
				type: "data",
				value: i - 1,
				speed: "fast"
			}));
		}
		
		expect(chunks[4]).toEqual(expect.objectContaining({
			type: "complete",
			condition: "fast"
		}));
	});

	it("should handle generator with data processing", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const data = ["hello", "world", "test"];
		const req = new Request(`http://localhost/DataProcess`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify([data])
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/dataprocess_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");

		const chunks = await consumeStream(res.body!);
		
		expect(chunks).toHaveLength(5); // 1 start + 3 items + 1 complete
		
		expect(chunks[0]).toEqual(expect.objectContaining({
			type: "start",
			itemCount: 3
		}));
		
		// Check item chunks
		expect(chunks[1]).toEqual(expect.objectContaining({
			type: "item",
			index: 0,
			original: "hello",
			processed: "HELLO",
			progress: 33
		}));
		
		expect(chunks[2]).toEqual(expect.objectContaining({
			type: "item",
			index: 1,
			original: "world",
			processed: "WORLD",
			progress: 67
		}));
		
		expect(chunks[3]).toEqual(expect.objectContaining({
			type: "item",
			index: 2,
			original: "test",
			processed: "TEST",
			progress: 100
		}));
		
		expect(chunks[4]).toEqual(expect.objectContaining({
			type: "complete",
			processedCount: 3
		}));
	});

	it("should handle regular non-generator method normally", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/Echo`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify(["Hello World"])
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/echo_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/json");

		const data = await res.json();
		expect(data).toBe("Echo: Hello World");
	});

	it("should handle generator with custom SSE format", async () => {
		const authString = `Bearer ${server.jwtSecret}`;
		const req = new Request(`http://localhost/CustomFormat`, {
			method: "POST",
			headers: { Authorization: authString },
			body: JSON.stringify(["Hello World Test"])
		});

		const res = await server["routeHandlers"][0]('POST', `/generator-example/customformat_`, authString, req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/event-stream");

		const chunks = await consumeStream(res.body!);
		
		expect(chunks).toHaveLength(4); // 3 words + 1 complete
		
		// Check word chunks
		expect(chunks[0]).toEqual(expect.objectContaining({
			event: "word",
			data: "Hello",
			index: 0,
			total: 3
		}));
		
		expect(chunks[1]).toEqual(expect.objectContaining({
			event: "word",
			data: "World",
			index: 1,
			total: 3
		}));
		
		expect(chunks[2]).toEqual(expect.objectContaining({
			event: "word",
			data: "Test",
			index: 2,
			total: 3
		}));
		
		expect(chunks[3]).toEqual(expect.objectContaining({
			event: "complete",
			data: "Processed 3 words"
		}));
	});
});
