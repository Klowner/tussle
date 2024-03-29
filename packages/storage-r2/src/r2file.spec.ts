import { selectPartRanges } from "./r2file";
import type { Part } from "./r2file";

function mockFile(parts: Readonly<Part[]>) {
	return {
		size: parts.reduce((size, part) => part.size + size, 0),
		parts,
	};
}

describe('R2File', () => {
	describe('selectPartRanges with odd sized chunks', () => {
		const parts: Readonly<Part[]> = [
			{key: '0001', size: 0 },
			{key: '0002', size: 1000 },
			{key: '0003', size: 2000 },
			{key: '0004', size: 5000 },
			{key: '0005', size: 1000 },
			{key: '0006', size: 0 },
			{key: '0007', size: 10000 },
		];

		test('first byte begins in second record', () => {
			const selected = selectPartRanges(mockFile(parts), 0, 1);
			expect(selected).toEqual([
				{ part: parts[1], range: { offset: 0, length: 1 }},
			]);
		});

		test('record 6 should be completed skipped because it contains no bytes', () => {
			const selected = selectPartRanges(mockFile(parts), 8000, 1200);
			expect(selected).toEqual([
				{ part: parts[4] },
				{ part: parts[6], range: { length: 200, offset: 0 }},
			]);
		});
	});

	describe('selectPartRanges', () => {

		const parts: Readonly<Part[]> = [
			{key: '0001', size: 1000 },
			{key: '0002', size: 1000 },
			{key: '0003', size: 1000 },
			{key: '0004', size: 1000 },
			{key: '0005', size: 1000 },
			{key: '0006', size: 1000 },
			{key: '0007', size: 1000 },
			{key: '0008', size: 1000 },
		];

		test('range matching first part should return unranged first part', () => {
			const selected = selectPartRanges(mockFile(parts), 0, 1000);
			expect(selected).toEqual([
				{ part: parts[0] },
			]);
		});

		test('range matching subsection of first part', () => {
			const selected = selectPartRanges(mockFile(parts), 10, 500);
			expect(selected).toEqual([
				{ part: parts[0], range: { offset: 10, length: 500 }},
			]);
		});

		test('range matching subsection of farther part', () => {
			const selected = selectPartRanges(mockFile(parts), 2500, 500);
			expect(selected).toEqual([
				{ part: parts[2], range: { offset: 500, length: 500 }},
			]);
		});

		test('range straddling two end points with full segments between', () => {
			const selected = selectPartRanges(mockFile(parts), 2500, 3000);
			expect(selected).toEqual([
				{ part: parts[2], range: { offset: 500, length: 500 }},
				{ part: parts[3], },
				{ part: parts[4], },
				{ part: parts[5], range: { offset: 0, length: 500 }},
			]);
		});

		test('range encompassing entire file', () => {
			const selected = selectPartRanges(mockFile(parts), 0, 1000 * parts.length);
			expect(selected).toEqual([
				{ part: parts[0], },
				{ part: parts[1], },
				{ part: parts[2], },
				{ part: parts[3], },
				{ part: parts[4], },
				{ part: parts[5], },
				{ part: parts[6], },
				{ part: parts[7], },
			]);
		});

		test('range extending beyond end of file should truncate request length', () => {
			const selected = selectPartRanges(mockFile(parts), 0, 1000 * (parts.length + 1));
			expect(selected).toEqual([
				{ part: parts[0], },
				{ part: parts[1], },
				{ part: parts[2], },
				{ part: parts[3], },
				{ part: parts[4], },
				{ part: parts[5], },
				{ part: parts[6], },
				{ part: parts[7], },
			]);
		});
	});
});
