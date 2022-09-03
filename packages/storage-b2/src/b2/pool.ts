// Simple pool class constructor takes a factory function which returns new
// items for the pool when the pool underflows.  After using a pool item,
// release() it back to the pool.

export type PoolType<T> = T extends Pool<infer U> ? U : never;

export type Releasable<T> = T & { release: (keep?: boolean) => void };

export class Pool<T extends Record<string, unknown>> {
  constructor(
    private readonly alloc: () => Promise<T>,
    private readonly items: T[] = []
  ) {}

  public async acquire(): Promise<T> {
    const item = this.items.pop();
    if (item) {
      return Promise.resolve(item);
    }
    return this.alloc();
  }

  public async acquireReleasable(): Promise<Releasable<T>> {
    const item = await this.acquire();
    return Object.assign(item, {
      release: (keep = false): void => {
        keep && this.release(item);
      }
    });
  }

  public release(item: T): void {
    this.items.push(item);
  }

  toJSON(): T[] {
    return this.items;
  }
}
