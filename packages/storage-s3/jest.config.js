module.exports = {
	testEnvironment: 'node',
	testMatch: [
		'<rootDir>/src/**/*.spec.ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/../tsconfig.cf.json',
		}],
	},
	collectCoverageFrom: [
		'src/**/*.ts',
	],
};
