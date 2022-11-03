module.exports = {
	testEnvironment: 'miniflare',
	testMatch: [
		'<rootDir>/src/**/*.spec.*'
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
