import type { TussleStateService } from '@tussle/core/src/state.interface';

class TussleStateMemory<T> implements TussleStateService<T> {
  private readonly state: Record<string, T> = {};

  public getItem(key: string): Promise<T> {
    return Promise.resolve(this.state[key]);
  }

  public setItem(key: string, value: T): Promise<void> {
    this.state[key] = value;
    return Promise.resolve();
  }

  public removeItem(key: string): Promise<T> {
    const item = this.state[key];
    delete this.state[key];
    return Promise.resolve(item);
  }

  public key(nth: number): Promise<string | null> {
    return Promise.resolve(Object.keys(this.state)[nth]);
  }
}

export default TussleStateMemory;
export { TussleStateMemory };
