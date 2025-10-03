export class PropWatcher<T extends object> {
	private subscribers = new Map<keyof T, Set<(value: any, oldValue: any) => void>>();
	private updating = new Set<keyof T>();

	constructor(private target: T) { }

	/**
	 * add a call back to a value update on the key. 
	 * there can be multiple listeners for the key
	 * 
	 * @param property 
	 * @param callback 
	 * @param newValue, optional
	 * @returns 
	 */
	onChange<K extends keyof T>(
		property: K,
		callback: (newValue: T[K], oldValue: T[K]) => void,
		newValue: any  = undefined
	): this {
		let initialValue = this.target[property]
		if (!this.subscribers.has(property)) {
			this.subscribers.set(property, new Set());
			Object.defineProperty(this.target, property, {
				get: () => initialValue,
				set: (value: T[K]) => {
					if (initialValue !== value && !this.updating.has(property)) {
						this.updating.add(property);
						const oldValue = initialValue;
						(this.subscribers.get(property) ?? []).forEach((cb) => cb(value, oldValue));
						this.updating.delete(property);
					}
					initialValue = value;
				},
				configurable: true,
			});
		}

		this.subscribers.get(property)!.add(callback);
		// bran: make an initial call anyway
		callback((newValue != undefined ? newValue : initialValue), initialValue)
		return this;
	}
}

//// decorator implementation

type Subscriber<T> = (newValue: T, oldValue: T, instance: any) => void;

/**
 * TODO: not quite working on the browser end yet!
 * 
 * @param onChange 
 * @returns 
 */
export function Reactive<T>(onChange?: Subscriber<T>): PropertyDecorator {
	return function (target: Object, propertyKey: string | symbol): void {
		let value: T;
		const subscribers = new Set<Subscriber<T>>();
		const updating = new Set<string | symbol>();

		if (onChange) {
			subscribers.add(onChange);
		}

		Object.defineProperty(target, propertyKey, {
			get() {
				return value;
			},
			set(newValue: T) {
				if (value !== newValue && !updating.has(propertyKey)) {
					const oldValue = value;
					updating.add(propertyKey);
					value = newValue;
					// Pass the enclosing instance (`this`) to the subscribers
					subscribers.forEach((subscriber) => subscriber(newValue, oldValue, this));
					updating.delete(propertyKey);
				}
			},
			enumerable: true,
			configurable: true,
		});

		// Ensure a shared subscriber map is present
		if (!target.hasOwnProperty('__reactiveSubscribers__')) {
			Object.defineProperty(target, '__reactiveSubscribers__', {
				value: new Map<string | symbol, Set<Subscriber<any>>>(),
				enumerable: false,
				writable: true,
				configurable: true,
			});
		}

		const reactiveSubscribers = (target as any)['__reactiveSubscribers__'];
		if (!reactiveSubscribers.has(propertyKey)) {
			reactiveSubscribers.set(propertyKey, subscribers);
		}
	};
}

export function addSubscriber<T>(
	target: any,
	propertyKey: string | symbol,
	callback: Subscriber<T>
): void {
	const reactiveSubscribers = target['__reactiveSubscribers__'];
	if (reactiveSubscribers && reactiveSubscribers.has(propertyKey)) {
		reactiveSubscribers.get(propertyKey).add(callback);
	}
}
