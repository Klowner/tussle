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

  public async getOrCreate(key: string, create: () => Promise<T>): Promise<T> {
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

  public getItem(key: string): T | null {
    const now = this.now();
    const hit = this.cache[key];
    this.asyncGarbageCollect(now);
    if (hit) {
      hit.atime = now;
      return hit.data;
    }
    return null;
  }

  public setItem(key: string, data: T): T;
  public setItem(key: string, data: null): null;
  public setItem(key: string, data: T | null): T | null {
    const now = this.now();
    if (data) {
      this.cache[key] = {
        atime: now,
        data,
      };
    } else {
      delete this.cache[key];
    }
    return data;
  }

  private garbageCollect(): void {
    const now = this.now();
    const { ttl, cache } = this;
    for (const key in cache) {
      if (isExpired(now, cache[key].atime, ttl)) {
        delete cache[key];
      }
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
