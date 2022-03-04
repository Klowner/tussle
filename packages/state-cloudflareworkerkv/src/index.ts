/// <reference types="@cloudflare/workers-types" />
import type { TussleStateService } from '@tussle/spec/interface/state';

type PromiseType<T> = T extends PromiseLike<infer U> ? U : T;
export type KVListResult = PromiseType<ReturnType<KVNamespace['list']>>;
const KEY_LIST_LIMIT = 1000;

export interface KVNamespaceTussle extends Pick<KVNamespace, 'put'|'delete'|'list'> {
  get(key: string): PromiseLike<string|null>;
}

class TussleStateCloudflareWorkersKV<T> implements TussleStateService<T> {
  constructor (
    private readonly ns: KVNamespaceTussle,
    private readonly options?: {
      expirationTtl?: number;
      expiration?: number;
    }
  ) {
    this.options = this.options || {};
  }

  async getItem(
    key: string,
  ): Promise<T|null> {
    const value = await this.ns.get(key);
    if (value) {
      return JSON.parse(value);
    }
    return null;
  }

  async setItem(
    key: string,
    value: T|string,
  ): Promise<void> {
    let val: string;
    if (typeof value === 'string') {
      val = value;
    } else {
      val = JSON.stringify(value);
    }
    await this.ns.put(key, val, this.options);
    this.invalidateCache();
  }

  async removeItem(
    key: string,
  ): Promise<T|null> {
    const item = await this.getItem(key);
    await this.ns.delete(key);
    this.invalidateCache();
    return item;
  }

  // since key() operates on singular keys, and KV.list() returns up to 1000
  // keys per call (and requires pagination to go beyond that), we store the
  // last result here in hopes that sequential calls to key() can avoid calls
  // to KV.list() for each individual lookup.
  private lastList: {
    result: KVListResult;
    offset: number;
  }|undefined;

  private keyListGet(
    nth: number
  ): string|null {
    const last = this.lastList;
    if (
      last
      && nth >= last.offset
      && nth < last.offset + Math.min(last.result.keys.length, KEY_LIST_LIMIT)
    ) {
      return last.result.keys[nth].name;
    }
    return null;
  }

  private async keyListSeek(
    nth: number
  ): Promise<void> {
    let page = this.lastList;
    // If we don't have a page, or the page is beyond the desired span, rewind
    // to the beginning page so we can seek forward.
    if (
      !page // no page
      || page.offset >= nth // page offset is beyond desired key number
    ) {
      page = {
        result: await this.ns.list({
          limit: KEY_LIST_LIMIT,
        }),
        offset: 0,
      };
    }

    // If the current list is before the target key,
    // advance forward, page by page (1000 at a time),
    // until we get to the range we want.
    while (
      page
      && (page.offset + KEY_LIST_LIMIT) < nth
      && !page.result.list_complete
    ) {
      page = {
        result: await this.ns.list({
          limit: KEY_LIST_LIMIT,
          cursor: page.result.cursor,
        }),
        offset: page.offset + KEY_LIST_LIMIT,
      };
    }

    // Update the cached page
    this.lastList = page;
  }

  private invalidateCache(): void {
    this.lastList = undefined;
  }

  async key(
    nth: number,
  ): Promise<string | null> {
    await this.keyListSeek(nth);
    return this.keyListGet(nth);
  }
}

export default TussleStateCloudflareWorkersKV;
export { TussleStateCloudflareWorkersKV };
