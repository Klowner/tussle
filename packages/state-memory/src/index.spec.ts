import type { TestRecord } from '@tussle/spec/test/state';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStateMemory } from './index';

function runStorageTest<T extends TussleStateService<TestRecord>>(
  name: string,
  create: () => T,
): void {
  stateSpecConformanceTests(name, create);
}

runStorageTest(
  require('../package.json').name,
  () => new TussleStateMemory<TestRecord>(),
);
