import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStatePostgres } from './state';
import { Pool } from 'pg';

function runStorageTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => T,
): void {
  stateSpecConformanceTests(name, create);
}

declare const POSTGRES_CONNECT_STRING: string;

const pool = new Pool({
  max: 1,
  connectionString: POSTGRES_CONNECT_STRING,
});

runStorageTest(
  '@tussle/state-memory',
  () => new TussleStatePostgres<StateTestRecord>({
    table: 'tussle_state',
    pool: async () => {
      await pool.query('TRUNCATE tussle_state;');
      return pool;
    }
  }),
);
