import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateServiceTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStateMemoryTTL } from './index';

function runStateTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void {
  stateSpecConformanceTests(name, create);
}

runStateTest(
  '@tussle/state-memory-ttl',
  async () => new TussleStateMemoryTTL<StateTestRecord>(),
);
