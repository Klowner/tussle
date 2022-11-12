module.exports = {
	testEnvironment: 'miniflare',
	testEnvironmentOptions: {
		compatibilityFlags: [
			"streams_enable_constructors", // https://developers.cloudflare.com/workers/platform/changelog/#2021-12-10
		],
	},
	testMatch: [
		'<rootDir>/src/**/*.spec.ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/../tsconfig.cf.json',
		}],
		'^.+\\.js$': ['babel-jest'],
	},
	transformIgnorePatterns: [
		'node_modules/(?!nanoid)/'
	],
	collectCoverageFrom: [
		'src/**/*.ts',
	],
};
