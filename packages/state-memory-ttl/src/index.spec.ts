import { StateTestRecord } from '@tussle/spec';
import { TussleStateService } from '@tussle/spec/interface/state';
import { stateServiceTests as stateSpecConformanceTests } from '@tussle/spec';
import { TussleStateMemoryTTL } from './index';

function runStateTest<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void {
  stateSpecConformanceTests(name, create);
	test('special onRelease handler is called on cleanup', async () => {
		const state = new TussleStateMemoryTTL<StateTestRecord>(0);
		state.onRelease = jest.fn();
		state.setItem('cat', {
			id: 0,
			name: 'cat',
			data: null,
		});

		state.garbageCollect();
		expect(state.onRelease).toHaveBeenCalled();
	});
}

runStateTest(
  '@tussle/state-memory-ttl',
  async () => new TussleStateMemoryTTL<StateTestRecord>(),
);
