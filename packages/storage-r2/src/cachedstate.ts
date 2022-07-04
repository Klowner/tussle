import type {TTLCache} from "@tussle/core";
import type {TussleStateService} from "@tussle/spec/interface/state";

class TussleCachedState<T extends { location: string }> {
  constructor(
    readonly state: TussleStateService<T>,
    readonly cache: TTLCache<T>
  ) {}

  async getState(location: string): Promise<T | null> {
    // First attempt to read the state from the in-memory
    // cache and then fall-back to the state store, caching
    // the result (if present) before it is returned.
    const state = this.cache.getItem(location);
    if (!state) {
      const storedState = await this.state.getItem(location);
      if (storedState) {
        // backfill the local cache for subsequent reads
        return this.cache.setItem(location, storedState);
      }
    }
    return state;
  }

  async setState<R extends T>(state: R): Promise<R>;
  async setState<R extends T>(state: T | R): Promise<T | R> {
    return this.cache.setItem(state.location, state);
  }

  async commitState<R extends T>(state: R): Promise<R>;
  async commitState<R extends T>(state: T | R): Promise<T | R> {
    await this.setState(state);
    await this.state.setItem(state.location, state);
    return state;
  }
}

export {TussleCachedState};
