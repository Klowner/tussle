import type { TussleStateService } from '@tussle/spec/interface/state';

class TussleStateMemory<T> implements TussleStateService<T> {
  private readonly state: Record<string, T> = {};

  public getItem(key: string): Promise<T | null> {
    return Promise.resolve(this.state[key] || null);
  }

  public setItem(key: string, value: T): Promise<void> {
    this.state[key] = value;
    return Promise.resolve();
  }

  public removeItem(key: string): Promise<T | null> {
    const item = this.state[key] || null;
    delete this.state[key];
    return Promise.resolve(item);
  }

  public key(nth: number): Promise<string | null> {
    return Promise.resolve(Object.keys(this.state)[nth] || null);
  }
}

export default TussleStateMemory;
export { TussleStateMemory };
