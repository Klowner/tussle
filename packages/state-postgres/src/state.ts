import type { TussleStateService } from '@tussle/core/src/state.interface';
import { TTLCache } from '@tussle/core';
import { Pool } from 'pg';

/*
CREATE TABLE tussle_state (
  key TEXT NOT NULL PRIMARY KEY,
  value JSON NOT NULL,
);
*/

export interface TussleStatePostgresConfig {
  pool: () => Pool;
  table: string;
}

const defaultConfig: Partial<TussleStatePostgresConfig> = {
  table: 'tussle_state',
};

class TussleStatePostgres<T> implements TussleStateService<T> {
  private readonly pool: Pool;
  private readonly cache: TTLCache<T>;

  public constructor(private readonly config: TussleStatePostgresConfig) {
    this.config = {
      ...defaultConfig,
      ...config,
    };

    this.pool = this.config.pool();
    this.cache = new TTLCache<T>(30 * 1000);
  }

  public async getItem(key: string): Promise<T | null> {
    const cached = this.cache.getItem(key);
    const { table } = this.config;
    const res = await this.pool.query<{ value: T }>(
      `SELECT value FROM ${table} WHERE key = $1`,
      [
        key,
      ],
    );
    const result = res.rowCount ? res.rows[0].value : cached;
    console.log('GETITEM', result);
    return result;
  }

  public async setItem(key: string, value: T): Promise<void> {
    const { table } = this.config;
    this.cache.setItem(key, value);
    await this.pool.query<{ value: T }>(
      `INSERT INTO ${table} (key, value) VALUES ($1, $2) ` +
      'ON CONFLICT (key) DO UPDATE SET value = $2',
      [
        key,
        value,
      ],
    );
  }

  public async removeItem(key: string): Promise<T | null> {
    const { table } = this.config;
    this.cache.setItem(key, null);
    const res = await this.pool.query<{ value: T }>(
      `DELETE FROM ${table} WHERE key = $1 RETURNING value`,
      [
        key,
      ]
    );
    return res.rowCount ? res.rows[0].value : null;
  }

  public async key(nth: number): Promise<string | null> {
    const { table } = this.config;
    const res = await this.pool.query(
      `SELECT key FROM ${table} LIMIT 1 OFFSET $1::integer`,
      [
        nth,
      ],
    );
    return res.rows[0];
  }
}

export default TussleStatePostgres;
export { TussleStatePostgres };
