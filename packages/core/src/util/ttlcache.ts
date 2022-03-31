export type TTLCacheType<T> = T extends TTLCache<infer U> ? U : never;

interface TTLCacheItem<T> {
  atime: number;
  data: T;
}

// Initially I just used a setInterval() to periodically perform
// garbage collection, but some environments such as Cloudflare
// don't allow certain API calls outside of request contexts.

const isExpired = (now: number, lastAccess: number, ttl: number): boolean =>
  now - lastAccess >= ttl;

export class TTLCache<T> {
  private lastGarbageCollection: number;

  constructor(
    private readonly ttl = 10 * 60 * 1000,
    private readonly garbageCollectionInterval = 5 * 60 * 1000,
    private readonly cache: Record<string, TTLCacheItem<T>> = {},
    private readonly now: () => number = () => Date.now(),
  ) {
    this.lastGarbageCollection = this.now();
  }

  onRelease(_key: string, _data: T): void { /* NOOP */ }

  async getOrCreate(key: string, create: () => Promise<T>): Promise<T> {
    const hit = this.cache[key];
    const now = this.now();
    this.asyncGarbageCollect(now);
    if (!hit) {
      const created = await create();
      return this.setItem(key, created);
    }
    hit.atime = now;
    return hit.data;
  }

  getItem(key: string): T | null {
    const now = this.now();
    const hit = this.cache[key];
    this.asyncGarbageCollect(now);
    if (hit) {
      hit.atime = now;
      return hit.data;
    }
    return null;
  }

  setItem(key: string, data: T): T;
  setItem(key: string, data: null): null;
  setItem(key: string, data: T | null): T | null {
    const now = this.now();
    if (data) {
      this.cache[key] = {
        atime: now,
        data,
      };
    } else {
      this.release(key);
    }
    return data;
  }

  removeItem(key: string): T | null {
    const hit = this.cache[key];
    if (hit) {
      delete this.cache[key];
    }
    return hit.data;
  }

  key(nth: number): string | null {
    return Object.keys(this.cache)[nth] || null;
  }

  private garbageCollect(): void {
    const now = this.now();
    const { ttl, cache } = this;
    for (const key in cache) {
      if (isExpired(now, cache[key].atime, ttl)) {
        this.release(key);
      }
    }
  }

  private release(key: string): void {
    const item = this.cache[key];
    if (item) {
      if (this.onRelease) {
        this.onRelease(key, item.data);
      }
      delete this.cache[key];
    }
  }

  private asyncGarbageCollect(now: number, force = false): void {
    if (force || isExpired(now, this.lastGarbageCollection, this.garbageCollectionInterval)) {
      this.lastGarbageCollection = now;
      new Promise(() => {
        this.garbageCollect();
      });
    }
  }
}
