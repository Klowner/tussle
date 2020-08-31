export type TTLCacheType<T> = T extends TTLCache<infer U> ? U : never;

interface TTLCacheItem<T> {
  atime: number;
  data: T;
}

export class TTLCache<T> {
  constructor(
    private readonly ttl = 10 * 60 * 1000,
    private readonly garbageCollectionInterval = 5 * 60 * 1000,
    private readonly cache: Record<string, TTLCacheItem<T>> = {},
    private readonly now: () => number = () => Date.now(),
  ) {
    setInterval(
      () => this.garbageCollect(),
      this.garbageCollectionInterval
    );
  }

  public async getOrCreate(key: string, create: () => Promise<T>): Promise<T> {
    const hit = this.cache[key];
    const now = this.now();
    if (!hit) {
      const created = await create();
      return (this.cache[key] = {
        atime: now,
        data: created,
      }).data;
    }
    hit.atime = now;
    return hit.data;
  }

  private garbageCollect(): void {
    const now = this.now();
    const { ttl, cache } = this;
    for (const key in cache) {
      if (now - cache[key].atime > ttl) {
        delete cache[key];
      }
    }
  }
}
