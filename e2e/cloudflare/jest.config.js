module.exports = {
	testEnvironment: 'miniflare',
	testEnvironmentOptions: {
		compatibilityFlags: [
			"streams_enable_constructors",
		],
	},
	testMatch: [
		'<rootDir>/**/*.spec.ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/tsconfig.json',
			disableSourceMapSupport: true,
		}],
		'^.+\\.js$': ['babel-jest'],
	},
};
