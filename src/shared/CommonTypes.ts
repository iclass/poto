/**
 * the headmatters of an actor, to be used in the slides frontmatter of the first page
 */

import { stringifyTypedJsonAsync, stringifyTypedJson } from './TypedJsonUtils';

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
 * Now supports async encoding for proper TypedJSON serialization of binary data
 */
export function generatorToStream<T>(
	generator: AsyncGenerator<T>,
	encoder?: (item: T) => Uint8Array | Promise<Uint8Array>
): ReadableStream<Uint8Array> {
	// Detect environment for sync vs async encoding
	const isBunOrNode = typeof process !== 'undefined' && (process?.versions?.node || process?.versions?.bun);
	const hasBuffer = typeof Buffer !== 'undefined';
	const canUseSyncEncoding = isBunOrNode && hasBuffer;
	
	return new ReadableStream({
		async start(controller) {
			try {
				// Optimized encoder with type detection
				let cachedEncoder: ((item: T) => Uint8Array | Promise<Uint8Array>) | null = null;
				let isFirstItem = true;
				
				for await (const item of generator) {
					// Use custom encoder if provided
					if (encoder) {
						const encoded = await encoder(item);
						controller.enqueue(encoded);
						continue;
					}
					
					// Auto-detect and cache encoder on first item for better performance
					if (isFirstItem) {
						isFirstItem = false;
						
						// Check if we can use sync fast path
						if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
							// Fast path for primitives - pure JSON
							cachedEncoder = (i: T) => new TextEncoder().encode(JSON.stringify(i) + '\n');
						} else if (item && typeof item === 'object' && 
								   !(item instanceof Date) && 
								   !(item instanceof RegExp) &&
								   !(item instanceof Map) &&
								   !(item instanceof Set) &&
								   !(item instanceof ArrayBuffer) &&
								   !(item instanceof Blob) &&
								   !ArrayBuffer.isView(item)) {
							// Fast path for simple objects (no special types)
							cachedEncoder = (i: T) => new TextEncoder().encode(JSON.stringify(i) + '\n');
						} else if (canUseSyncEncoding && !(item instanceof Blob)) {
							// 🚀 FAST: Sync encoding for binary types in Bun/Node (Buffer is available)
							// Only Blob needs async, ArrayBuffer/TypedArray can use sync
							cachedEncoder = (i: T) => new TextEncoder().encode(stringifyTypedJson(i) + '\n');
						} else {
							// Slow path for Blob or browser binary types - use async TypedJSON
							cachedEncoder = async (i: T) => new TextEncoder().encode(await stringifyTypedJsonAsync(i) + '\n');
						}
					}
					
					if (cachedEncoder) {
						const encoded = await cachedEncoder(item);
						controller.enqueue(encoded);
					} else {
						// Fallback (should never reach here)
						const encoded = new TextEncoder().encode(canUseSyncEncoding ? stringifyTypedJson(item) : await stringifyTypedJsonAsync(item) + '\n');
						controller.enqueue(encoded);
					}
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
 * Now uses TypedJSON serialization for proper binary data handling
 */
export function generatorToSseStream<T>(
	generator: AsyncGenerator<T>
): ReadableStream<Uint8Array> {
	return generatorToStream(generator, async (item) => 
		new TextEncoder().encode(`data: ${await stringifyTypedJsonAsync(item)}\n\n`)
	);
}

// Re-export DataPacket for convenience
export { DataPacket } from './DataPacket';
