// Simple pool class constructor takes a factory function which returns new
// items for the pool when the pool underflows.  After using a pool item,
// release() it back to the pool.
// 
export class Pool<T> {
  private readonly items: T[] = [];

  constructor(private readonly alloc: () => Promise<T>) {}

  async acquire(): Promise<T> {
    const item = this.items.pop();
    if (item) {
      return Promise.resolve(item);
    }
    return this.alloc();
  }

  release(item: T): void {
    this.items.push(item);
  }
}
