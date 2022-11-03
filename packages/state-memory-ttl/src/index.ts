import type { TussleStateService } from '@tussle/spec/interface/state';
import {TTLCache} from "@tussle/core";

interface TTLCacheItem<T> {
	atime: number;
	data: T;
}

class TussleStateMemoryTTL<T> implements TussleStateService<T> {
	private readonly cache: TTLCache<T>;

	constructor(
		ttl?: number,
		garbageCollectionInterval?: number,
		cache?: Record<string, TTLCacheItem<T>>,
		now?: () => number,
	) {
		this.cache = new TTLCache(
			ttl, garbageCollectionInterval, cache, now);
		this.cache.onRelease = (key, data) => {
			this.onRelease(key, data);
		};
	}

  async getItem(key: string): Promise<T | null> {
		return this.cache.getItem(key);
  }

  async setItem(key: string, value: T): Promise<void> {
		this.cache.setItem(key, value);
  }

  async removeItem(key: string): Promise<T | null> {
		return this.cache.removeItem(key);
  }

  async key(nth: number): Promise<string | null> {
		return this.cache.key(nth);
  }

	onRelease(_key: string, _data: T): void { /* NOOP */ }

	garbageCollect() {
		return this.cache.garbageCollect();
	}
}

export default TussleStateMemoryTTL;
export { TussleStateMemoryTTL };
