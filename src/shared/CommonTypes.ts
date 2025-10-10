/**
 * the headmatters of an actor, to be used in the slides frontmatter of the first page
 */

export const DialogRoles = ['system', 'user', 'assistant']

export type DialogRole = 'system' | 'user' | 'assistant'

export type OpenAIContentBlock = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export type DialogEntry = {
	role: DialogRole;
	content: string | OpenAIContentBlock[];
}

export type Dialogs = DialogEntry[]


/**
 * Converts an async generator to a ReadableStream<Uint8Array>
 * Optimized for real-time streaming with minimal buffering.
 * This allows writing streaming methods using async generators instead of manual ReadableStream creation
 */
export function generatorToStream<T>(
	generator: AsyncGenerator<T>,
	encoder: (item: T) => Uint8Array = (item) => new TextEncoder().encode(JSON.stringify(item) + '\n')
): ReadableStream<Uint8Array> {
	return new ReadableStream({
		async start(controller) {
			try {
				for await (const item of generator) {
					controller.enqueue(encoder(item));
				}
				// console.debug(`✅ AsyncGenerator stream completed successfully`, {
				// 	timestamp: new Date().toISOString(),
				// 	streamType: 'generator'
				// });
				controller.close();
			} catch (error) {
				// Only call controller.error if the controller isn't already closed
				try {
					controller.error(error);
				} catch (controllerError) {
					// ignore errors during cancellation
				}
			}
		},
		async cancel(reason) {
			try {
				if (typeof (generator as any).return === 'function') {
					await (generator as any).return(undefined);
				}
			} catch (error) {
				// ignore errors during cancellation
			}
		}
	});
}

/**
 * Converts an async generator to a ReadableStream<Uint8Array> with SSE formatting
 * Automatically wraps each item in SSE format: "data: {...}\n\n"
 */
export function generatorToSseStream<T>(
	generator: AsyncGenerator<T>
): ReadableStream<Uint8Array> {
	return generatorToStream(generator, (item) => 
		new TextEncoder().encode(`data: ${JSON.stringify(item)}\n\n`)
	);
}

// Re-export DataPacket for convenience
export { DataPacket } from './DataPacket';
