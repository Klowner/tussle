"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stateTests = void 0;
const exampleRecords = [
    {
        id: 42,
        name: '🦄unicorn',
        data: {
            rainbow: '🐬dolphin',
            description: [
                'good strings goOd sTrings',
                '👀👌👀👌👀',
                'good strings',
                '✔✔if i do ƽaү so my self 💯',
                '(chorus: ʳᶦᵍʰᵗ ᵗʰᵉʳᵉ) mMMMMᎷМ💯 👌',
            ],
            '🥞': 'pancakey',
        },
    },
    {
        id: 9000,
        name: 'toot toot',
        data: null,
    }
];
function stateTests(name, create) {
    describe(`${name} - state service specification conformance`, () => {
        describe('setItem()', () => {
            let state;
            beforeEach(() => __awaiter(this, void 0, void 0, function* () {
                state = yield create();
            }));
            test('replaces existing items with an identical key', () => __awaiter(this, void 0, void 0, function* () {
                yield state.setItem('alpha', exampleRecords[1]);
                const result1 = yield state.getItem('alpha');
                expect(result1).toEqual(exampleRecords[1]);
                yield state.setItem('alpha', exampleRecords[0]);
                const result2 = yield state.getItem('alpha');
                expect(result2).toEqual(exampleRecords[0]);
            }));
        });
        describe('getItem()', () => {
            let state;
            beforeEach(() => __awaiter(this, void 0, void 0, function* () {
                state = yield create();
            }));
            test('returns null when item is not found', () => __awaiter(this, void 0, void 0, function* () {
                const result = yield state.getItem('alpha');
                expect(result).toBe(null);
            }));
            test('returns original item', () => __awaiter(this, void 0, void 0, function* () {
                const original = exampleRecords[0];
                yield state.setItem('alpha', Object.assign({}, original));
                const result = yield state.getItem('alpha');
                expect(result).toEqual(original);
            }));
        });
        describe('removeItem()', () => {
            let state;
            beforeEach(() => __awaiter(this, void 0, void 0, function* () {
                state = yield create();
            }));
            test('returns removed item', () => __awaiter(this, void 0, void 0, function* () {
                const original = exampleRecords[0];
                // set two items
                yield state.setItem('alpha', original);
                yield state.setItem('beta', original);
                // remove one
                const removed = yield state.removeItem('alpha');
                expect(removed).toEqual(original);
                // ensure the other is still there
                const other = yield state.getItem('beta');
                expect(other).toEqual(original);
            }));
            test('returns null if no match was found for removal', () => __awaiter(this, void 0, void 0, function* () {
                yield state.removeItem('alpha');
                const gone = yield state.removeItem('alpha');
                expect(gone).toBeNull();
            }));
        });
        describe('key()', () => {
            let state;
            beforeEach(() => __awaiter(this, void 0, void 0, function* () {
                state = yield create();
            }));
            test('returns nth key in no particular order', () => __awaiter(this, void 0, void 0, function* () {
                const originalKeys = ['alpha', 'beta'];
                yield state.setItem('alpha', exampleRecords[0]);
                yield state.setItem('beta', exampleRecords[1]);
                const keys = [
                    yield state.key(0),
                    yield state.key(1),
                ];
                expect(keys).toEqual(originalKeys);
            }));
        });
    });
}
exports.stateTests = stateTests;
