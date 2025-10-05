/**
 * the headmatters of an actor, to be used in the slides frontmatter of the first page
 */

export class ActorHeadmatters {
	name!: string;
	role?: 'teacher' | 'assistant';
	voiceOpts?: {
		voiceId: string;
		rate: string;
		pitch: string;
	};
	guide: string = '';
	enabled: boolean = true;
	muted: boolean = false;

	constructor(headmatters: Record<string, any>) {
		Object.assign(this, headmatters);
	}
}

export type NavStateQuick = {
	editorShown: boolean;
	courseId: string;
	courseDeckFileName: string;
	// these propers are udated from slidev
	slideNo: number; // 1-based
	clicks: number;
	totalClicks: number;
	hasNext: boolean;
	hasPrev: boolean;
	// the last narrated paragraph id, 0 based
	lastParagraphId: number | undefined
	revision: string // the revision of the course . probably shouldbe the revision of the current page
	dialogs: DialogEntry[];
	salt: string;
	title?: string
	temperature?: number
	slideHtmlContent?: string
};

export const DialogRoles = ['system', 'user', 'assistant']

export type DialogRole = 'system' | 'user' | 'assistant'

export type OpenAIContentBlock = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export type DialogEntry = {
	role: DialogRole;
	content: string | OpenAIContentBlock[];
}

export type Dialogs = DialogEntry[]

/**
 * Shared type for exchanging audio+metadata with the server API (frontend/backend)
 */
export interface AudioCacheMeta {
	version?: number;
	audio: string | ArrayBuffer; // base64-encoded audio or ArrayBuffer
	words?: string[];
	wtimes?: number[];
	wdurations?: number[];
	visemes?: string[];
	vtimes?: number[];
	vdurations?: number[];
	// markers?: string[];
	mtimes?: number[];
	emojis?: string[];
	emojisTimes?: number[];
	emojisMap?: Record<string, any>;
}

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

// Re-export SimpleStreamPacket for convenience
export { SimpleStreamPacket } from './SimpleStreamPacket';
