module.exports = {
	testEnvironment: 'miniflare',
	testMatch: [
		'<rootDir>/src/**/*.spec.ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/../tsconfig.cf.json',
			disableSourceMapSupport: true,
		}],
		'^.+\\.js$': ['babel-jest'],
	},
	collectCoverageFrom: [
		'src/**/*.ts',
	],
};
