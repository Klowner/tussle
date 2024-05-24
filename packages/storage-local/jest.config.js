module.exports = {
	testEnvironment: 'node',
	testEnvironmentOptions: {
	},
	testMatch: [
		'<rootDir>/src/**/*.spec.ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/../tsconfig.json',
			disableSourceMapSupport: true,
		}],
		'^.+\\.js$': ['babel-jest'],
	},
	collectCoverageFrom: [
		'src/**/*.ts',
	]
};
