import type { TussleStateService } from './state.interface';

class TussleStateNamespace<T> implements TussleStateService<T> {
  public constructor (
    public readonly state: TussleStateService<unknown>,
    public readonly namespace: string,
    private readonly sep = '.'
  ) {}

  private addNs(key: string): string {
    return [this.namespace, key].join(this.sep);
  }

  getItem(key: string): Promise<T | undefined> {
    key = this.addNs(key);
    return this.state.getItem(key) as Promise<T | undefined>;
  }

  setItem(key: string, value: T): Promise<void> {
    key = this.addNs(key);
    return this.state.setItem(key, value);
  }

  removeItem(key: string): Promise<T> {
    key = this.addNs(key);
    return this.state.removeItem(key) as Promise<T>;
  }

  key(nth: number): Promise<string | undefined> {
    return this.state.key(nth); // can't namespace this easily
  }
}

export {
  TussleStateNamespace,
};
