import type { TussleStateService } from '@tussle/spec/interface/state';

export class TussleStateNamespace<T> implements TussleStateService<T> {
	public constructor (
		public readonly state: TussleStateService<T>,
		public readonly namespace: string,
		private readonly sep = '.'
	) {
	}

	private readonly ns_prefix = new RegExp(`^${this.namespace}${this.sep}`);

	private addNs(key: string) {
		return [this.namespace, key].join(this.sep);
	}

	private removeNs(key: string) {
		return key.replace(this.ns_prefix, '');
	}

	getItem(key: string) {
		key = this.addNs(key);
		const item = this.state.getItem(key);
		return item;
	}

	setItem(key: string, value: T) {
		key = this.addNs(key);
		return this.state.setItem(key, value);
	}

	removeItem(key: string) {
		key = this.addNs(key);
		return this.state.removeItem(key);
	}

	async key(nth: number) {
		const key = await this.state.key(nth);
		return key ? this.removeNs(key): null;
	}
}
