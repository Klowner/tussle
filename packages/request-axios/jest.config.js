module.exports = {
	testEnvironment: 'node',
	testMatch: [
		'**/*.spec.ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/../tsconfig.json',
		}],
	},
	collectCoverageFrom: [
		'**/*.ts',
	],
};
