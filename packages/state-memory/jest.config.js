module.exports = {
	testEnvironment: 'node',
	testMatch: [
		'**/*.spec.ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/../tsconfig.json',
		}],
		// '^.+\\.js$': ['babel-jest'],
	},
	transformIgnorePatterns: [
		// 'node_modules/(?!nanoid)/'
	],
	collectCoverageFrom: [
		'**/*.ts',
	],
};
