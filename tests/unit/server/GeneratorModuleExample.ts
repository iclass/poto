import { PotoModule } from "../../../src/server/PotoModule";
import { PotoUser } from "../../../src/server/UserProvider";

export class GeneratorModuleExample extends PotoModule {
	getRoute(): string {
		return "generator-example";
	}

	/**
	 * Example 1: Simple generator method - no manual ReadableStream creation needed!
	 */
	async *postCounter_(count: number) {
		for (let i = 1; i <= count; i++) {
			yield { number: i, timestamp: new Date().toISOString() };
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	}

	/**
	 * Example 2: Generator with progress tracking
	 */
	async *postProgress_(steps: number) {
		for (let i = 0; i < steps; i++) {
			const progress = Math.round(((i + 1) / steps) * 100);
			
			yield {
				type: "progress",
				step: i + 1,
				total: steps,
				progress,
				message: `Processing step ${i + 1} of ${steps}`
			};
			
			// Simulate work
			await new Promise(resolve => setTimeout(resolve, 200));
		}
		
		yield {
			type: "complete",
			message: "All steps completed successfully!"
		};
	}

	/**
	 * Example 3: Generator with error handling
	 */
	async *postWithError_(shouldError: boolean) {
		yield { type: "start", message: "Starting operation..." };
		
		if (shouldError) {
			throw new Error("Simulated error occurred");
		}
		
		yield { type: "success", message: "Operation completed successfully" };
	}

	/**
	 * Example 4: Generator with conditional logic
	 */
	async *postConditional_(condition: string) {
		yield { type: "start", condition };
		
		switch (condition) {
			case "fast":
				for (let i = 0; i < 3; i++) {
					yield { type: "data", value: i, speed: "fast" };
					await new Promise(resolve => setTimeout(resolve, 50));
				}
				break;
				
			case "slow":
				for (let i = 0; i < 5; i++) {
					yield { type: "data", value: i, speed: "slow" };
					await new Promise(resolve => setTimeout(resolve, 300));
				}
				break;
				
			default:
				yield { type: "error", message: "Unknown condition" };
				return;
		}
		
		yield { type: "complete", condition };
	}

	/**
	 * Example 5: Generator with external data processing
	 */
	async *postDataProcess_(data: string[]) {
		yield { type: "start", itemCount: data.length };
		
		for (let i = 0; i < data.length; i++) {
			const item = data[i];
			
			// Process each item
			const processed = item.toUpperCase();
			
			yield {
				type: "item",
				index: i,
				original: item,
				processed,
				progress: Math.round(((i + 1) / data.length) * 100)
			};
			
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		
		yield { type: "complete", processedCount: data.length };
	}

	/**
	 * Example 6: Generator with SSE formatting (custom format)
	 */
	async *postCustomFormat_(message: string) {
		const words = message.split(' ');
		
		for (let i = 0; i < words.length; i++) {
			yield {
				event: "word",
				data: words[i],
				index: i,
				total: words.length
			};
			
			await new Promise(resolve => setTimeout(resolve, 150));
		}
		
		yield {
			event: "complete",
			data: `Processed ${words.length} words`
		};
	}

	/**
	 * Example 7: Regular non-generator method for comparison
	 */
	async postEcho_(message: string): Promise<string> {
		return `Echo: ${message}`;
	}
}
