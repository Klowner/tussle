import type { TussleStateService } from '@tussle/spec/interface/state';

class TussleStateMemory<T> implements TussleStateService<T> {
	private readonly state = new Map<string, T>();

	getItem(key: string): Promise<T | null> {
		return Promise.resolve(this.state.get(key) || null);
	}

	setItem(key: string, value: T): Promise<void> {
		this.state.set(key, value);
		return Promise.resolve();
	}

	removeItem(key: string): Promise<T | null> {
		const item = this.state.get(key) || null;
		this.state.delete(key);
		return Promise.resolve(item);
	}

	key(nth: number): Promise<string | null> {
		return Promise.resolve([...this.state.keys()][nth] || null);
	}

	clear(): void {
		this.state.clear();
	}
}

export default TussleStateMemory;
export { TussleStateMemory };
