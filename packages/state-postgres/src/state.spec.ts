import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStatePostgres } from './state';
import { Pool } from 'pg';

function runStateTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void {
  stateSpecConformanceTests(name, create);
}

const pool = new Pool({
  max: 1,
  connectionString: (
    process.env['POSTGRES_CONNECT_STRING'] ||
    'postgresql://postgres:postgres@localhost/tussle_test'
  ),
});

runStateTest(
  '@tussle/state-memory',
  async () => new TussleStatePostgres<StateTestRecord>({
    table: 'tussle_state',
    pool: () => pool,
  }),
);
