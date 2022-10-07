module.exports = {
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
				diagnostics: {
					ignoreCodes: ['TS151001'],
				},
				tsconfig: './packages/tsconfig.json',
			},
		],
	},
};
