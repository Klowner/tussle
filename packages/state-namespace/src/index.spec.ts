import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateServiceTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStateNamespace } from './index';
import { TussleStateMemory } from '@tussle/state-memory';

function runStateTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void {
  stateSpecConformanceTests(name, create);
}

runStateTest(
  '@tussle/state-namespace',
	async () => new TussleStateNamespace(
		new TussleStateMemory<StateTestRecord>(),
		'my-namespace',
	),
);
