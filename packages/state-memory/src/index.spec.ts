import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStateMemory } from './index';

function runStorageTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => T,
): void {
  stateSpecConformanceTests(name, create);
}

runStorageTest(
  '@tussle/state-memory',
  () => new TussleStateMemory<StateTestRecord>(),
);
