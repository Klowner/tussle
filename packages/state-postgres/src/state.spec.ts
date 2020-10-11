import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateServiceTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStatePostgres } from './state';
import { Pool } from 'pg';

const pool = new Pool({
  max: 1,
  connectionString: (
    process.env['POSTGRES_CONNECT_STRING'] ||
    'postgresql://postgres:postgres@localhost'
  ),
});

afterAll(async () => {
  await pool.query('TRUNCATE tussle_state;');
  await pool.end();
});

function runStateTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void {
  stateSpecConformanceTests(name, create);
}

runStateTest(
  '@tussle/state-postgres',
  async () => {
    await pool.query('TRUNCATE tussle_state;');
    return new TussleStatePostgres<StateTestRecord>({
      table: 'tussle_state',
      pool: () => pool,
    });
  },
);
