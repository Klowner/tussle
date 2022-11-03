module.exports = {
	testEnvironment: 'node',
	testMatch: [
		'<rootDir>/src/**/*.spec.ts'
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
		'src/**/*.ts',
	],
};
