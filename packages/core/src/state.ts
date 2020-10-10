import type { TussleStateService } from '@tussle/spec/interface/state';

type SuperReturnType<T, U extends keyof TussleStateService<T>> = ReturnType<TussleStateService<T>[U]>;

class TussleStateNamespace<T> implements TussleStateService<T> {
  public constructor (
    public readonly state: TussleStateService<T>,
    public readonly namespace: string,
    private readonly sep = '.'
  ) {}

  private addNs(key: string): string {
    return [this.namespace, key].join(this.sep);
  }

  getItem(key: string): SuperReturnType<T, 'getItem'> {
    key = this.addNs(key);
    const item = this.state.getItem(key);
    item.then((item) => {
      if (!item) {
        console.error('MISSING', key);
      }
    });
    return item;
  }

  setItem(key: string, value: T): SuperReturnType<T, 'setItem'> {
    key = this.addNs(key);
    return this.state.setItem(key, value);
  }

  removeItem(key: string): SuperReturnType<T, 'removeItem'> {
    key = this.addNs(key);
    return this.state.removeItem(key);
  }

  key(nth: number): SuperReturnType<T, 'key'> {
    return this.state.key(nth); // can't namespace this easily
  }
}

export {
  TussleStateNamespace,
};
