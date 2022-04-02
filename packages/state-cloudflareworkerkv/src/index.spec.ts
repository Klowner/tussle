import { StateTestRecord } from '@tussle/spec';
import type { TussleStateService } from '@tussle/spec/interface/state';
import { stateServiceTests as stateSpecConformanceTests } from '@tussle/spec';
import { KVNamespaceTussle, TussleStateCloudflareWorkerKV } from './index';

class KVNamespaceMock implements KVNamespaceTussle {
  private readonly store: Record<string, string> = {};

  async put(
    key: string,
    value: string
  ): Promise<void> {
    this.store[key] = value;
  }

  async get(
    key: string,
  ): Promise<string|null> {
    return this.store[key] || null;
  }

  async delete(
    key: string,
  ): Promise<void> {
    delete this.store[key];
  }

  async list(
    options?: {
      prefix?: string;
      limit?: number;
      cursor?: string;
    }
  ) {
    const start = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const limit = options?.limit || 1000;
    const allKeys = Object.keys(this.store);
    const keys = allKeys.slice(start, start + limit);
    const cursor = (start + 1000).toString();
    const list_complete = allKeys.length <= start+limit;

    return {
      keys: keys.map(name => ({ name })),
      list_complete,
      cursor,
    };
  }
}


function runStateTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void {
  stateSpecConformanceTests(name, create);
}

runStateTest(
  '@tussle/state-cloudflareworkerskv',
  async () => new TussleStateCloudflareWorkerKV<StateTestRecord>(
    new KVNamespaceMock(),
  ),
);
