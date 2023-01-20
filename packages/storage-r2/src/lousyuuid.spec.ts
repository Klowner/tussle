import { lousyUUID } from './lousyuuid';
describe("LousyUUID (terrible UUID generator)", () => {
	it('should generate unique strings (32 characters by default)', () => {
		const result = lousyUUID();
		expect(result).toHaveLength(32);
	});

	it('should produce strings that are sufficiently unique for our purposes', () => {
		const results = (<number[]>new Array(1024)).fill(0).map(() => lousyUUID(16));
		for (let i = 0; i < results.length; i++) {
			const element = results[i];
			const resultsWithoutElement = results.filter(v => v !== element);
			expect(resultsWithoutElement).not.toContain(element);
		}
	});
});
