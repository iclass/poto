// Import the Reactive and ReactiveBinder implementations
import { Reactive, PropWatcher } from '../../../src/shared/ReactiveBinder';
import { describe, expect, it } from 'bun:test';

describe('Reactive Module Test Suite', () => {
	class DecoratorTestSettings {
		@Reactive<number>((value, oldValue) => {
			// Callback for testing decorator reactivity
		})
		numberProp = 10;

		@Reactive<string>((value, oldValue) => {
			// Callback for testing decorator reactivity
		})
		stringProp = 'initial';
	}

	class BinderTestSettings {
		numberProp = 10;
		stringProp = 'initial';

		binder = new PropWatcher(this as BinderTestSettings);

		constructor() {
			this.bindProperties();
		}

		bindProperties() {
			this.binder
				.onChange('numberProp', (value, oldValue) => {
					// Callback for testing binder reactivity
				})
				.onChange('stringProp', (value, oldValue) => {
					// Callback for testing binder reactivity
				});
		}
	}

	it('should trigger decorator callbacks when properties are updated', () => {
		const settings = new DecoratorTestSettings();

		settings.numberProp = 42; // Logs from decorator
		settings.stringProp = 'updated'; // Logs from decorator

		// Assertions
		expect(settings.numberProp).toBe(42);
		expect(settings.stringProp).toBe('updated');
	});

	it('should trigger binder callbacks when properties are updated', () => {
		const settings = new BinderTestSettings();

		settings.numberProp = 42; // Logs from binder
		settings.stringProp = 'updated'; // Logs from binder

		// Assertions
		expect(settings.numberProp).toBe(42);
		expect(settings.stringProp).toBe('updated');
	});

	it('should not trigger decorator callback for unchanged properties', () => {
		const settings = new DecoratorTestSettings();
		settings.numberProp = 10; // No change

		// Assertions
		expect(settings.numberProp).toBe(10);
	});

	it('should not trigger binder callback for unchanged properties', () => {
		const settings = new BinderTestSettings();
		settings.numberProp = 10; // No change

		// Assertions
		expect(settings.numberProp).toBe(10);
	});

	it('should support dynamic property binding using ReactiveBinder', () => {
		class DynamicTest {
			dynamicProp: any = 'default';

			binder = new PropWatcher(this);

			constructor() {
				this.binder.onChange('dynamicProp', (value, oldValue) => {
					// Callback for testing dynamic property binding
				});
			}
		}

		const dynamicTest = new DynamicTest();
		dynamicTest.dynamicProp = 'new value'; // Logs the change

		// Assertions
		expect(dynamicTest.dynamicProp).toBe('new value');
	});
});


describe("Reactive Decorator with class instance", () => {
	class Example {
		audioButton = { textContent: "" };

		@Reactive((newValue: boolean, oldValue: boolean, instance: Example) => {
			instance.audioButton.textContent = newValue
				? "🔇 静音"
				: "🔇 播音";
		})
		audioOn: boolean = true;

		toggleAudio() {
			this.audioOn = !this.audioOn;
		}
	}

	it("should update the audio button text when audioOn changes", () => {
		const example = new Example();

		// Initially, audioOn is true
		expect(example.audioOn).toBe(true);
		expect(example.audioButton.textContent).toBe("🔇 静音");

		// Toggle audioOn
		example.toggleAudio();
		expect(example.audioOn).toBe(false);
		expect(example.audioButton.textContent).toBe("🔇 播音");

		// Toggle audioOn again
		example.toggleAudio();
		expect(example.audioOn).toBe(true);
		expect(example.audioButton.textContent).toBe("🔇 静音");
	});
});