import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStateMemory } from './index';

function runStateTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void {
  stateSpecConformanceTests(name, create);
}

runStateTest(
  '@tussle/state-memory',
  async () => new TussleStateMemory<StateTestRecord>(),
);
