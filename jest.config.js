module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	collectCoverageFrom: [
		'packages/*/src/**/*.ts',
	],
	testMatch: [
		"**/*.spec.ts",
	],
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: './packages/tsconfig.json',
			},
		],
	},
	globals: {
		diagnostics: {
			ignoreCodes: ['TS151001'],
		},
	},
};
