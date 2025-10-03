import { EventStreamContentType, fetchEventSource } from "./fetch";

// Import Bun's HTTP module
import { serve } from "bun";

function handleSubscribe(req: Request): Response {
	
	return new Response(
		new ReadableStream(
			{
				start(controller) {
					controller.enqueue(": heartbeat\n\n"); // Comment line in SSE format
					const heartbeatInterval = setInterval(() => {
						controller.enqueue(": heartbeat\n\n"); // Comment line in SSE format
					}, 3000);
	
					req.signal.onabort = () => {
						clearInterval(heartbeatInterval); // Clear the interval to avoid memory leaks
						controller.close();
					}
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
}

// SSE handler function
function sse(req: Request): Response {
	const { signal } = req;
	return new Response(
		new ReadableStream({
			start(controller) {
				const interval = setInterval(() => {
					controller.enqueue(`data: ${JSON.stringify({ time: new Date().toISOString(), clientId: req.headers.get("client-id") || "unknown" })}\n\n`);
				}, 1000);

				signal.onabort = () => {
					clearInterval(interval);
					controller.close();
				};
			}
		}),
		{
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
			}
		}
	);
}

// Create the SSE server
serve({
	fetch: async (req: Request): Promise<Response> => {
		const { pathname } = new URL(req.url);
		if (pathname === "/sse") {
			// return sse(req);
			return handleSubscribe(req);
		}
		return new Response("Not Found", { status: 404 });
	},
	port: 3888,
	idleTimeout: 5  // the max time Bun allowed is 255 secs
});

console.log("SSE server running at http://localhost:3888/sse");

const headers = {};

(
	async () => {
		const p = new Promise<void>((resolve, reject) => {
			fetchEventSource('http://localhost:3888/sse', {
				...(Object.keys(headers).length > 0 && { headers: { ...headers } }),
				onopen: async (response) => {
					if (response.ok) {
						console.debug('sse connected')
						resolve()
						return; // everything's good
					} else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
						console.debug({ response })
						// client-side errors are usually non-retriable:
						throw 'FatalError()'
					} else {
						console.debug({ response })
						throw 'RetriableError()'
					}
				},
				onmessage: (event) => {
					try {
						if (event.data) {
							const message = JSON.parse(event.data)
							console.debug({ message })
						}
					} catch (error) {
						console.error("Failed to parse message: ", event.data, error);
					}

				},
				onerror: (err) => {
					console.debug('sse:', { err })
					console.error("EventSource encountered an error, closing connection.");
				}
			})


		})

		console.debug('await ...')
		await p
		console.debug('running')
	}
)()
