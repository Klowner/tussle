import {BehaviorSubject, filter, firstValueFrom, map, take} from 'rxjs';

export class Stepper {
	private readonly step = new BehaviorSubject(0);

	async advance(count: number): Promise<void> {
		this.step.next(this.step.value + count);
		return this.wait(true).then(() => new Promise((res) => {
			setTimeout(() => res(undefined), 0);
		}));
	}

	readonly wait = (() => {
		let currentStep = 0;
		return (skipIncrement = false): Promise<void> => {
			if (!skipIncrement) {
				currentStep++;
			}
			const step = currentStep;
			return firstValueFrom(this.step.pipe(
				filter(s => s >= step),
				take(1),
				map(() => undefined),
			));
		}
	})();
}

