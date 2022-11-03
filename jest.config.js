module.exports = {
	verbose: true,
	projects: [
		{
			transform: {
				'^.+\\.ts$': [
					'ts-jest',
					{
						diagnostics: {
							ignoreCodes: ['TS151001'],
						},
						tsconfig: './packages/tsconfig.json',
					},
				]
			},
			testEnvironment: 'node',
			testMatch: [
				'<rootDir>/packages/core/**/*.spec.ts',
				'<rootDir>/packages/middleware-koa/**/*.spec.ts',
				'<rootDir>/packages/request-axios/**/*.spec.ts',
				'<rootDir>/packages/spec/**/*.spec.ts',
				'<rootDir>/packages/state-memory-ttl/**/*.spec.ts',
				'<rootDir>/packages/state-memory/**/*.spec.ts',
				'<rootDir>/packages/state-postgres/**/*.spec.ts',
				'<rootDir>/packages/storage-b2/**/*.spec.ts',
				'<rootDir>/packages/storage-s3/**/*.spec.ts',
			],
		},
		{
			transform: {
				'^.+\\.js$': 'babel-jest',
				'^.+\\.ts$': [
					'ts-jest',
					{
						diagnostics: {
							ignoreCodes: ['TS151001'],
						},
						tsconfig: './packages/tsconfig.cf.json',
					},
				],
			},
			transformIgnorePatterns: [
				'node_modules/(?!nanoid/*)',
			],
			testEnvironment: 'miniflare',
			testMatch: [
				'<rootDir>/packages/middleware-cloudflareworker/src/**/*.spec.ts',
				'<rootDir>/packages/request-cloudflareworker/src/**/*.spec.ts',
				'<rootDir>/packages/state-cloudflareworkerkv/src/**/*.spec.ts',
				'<rootDir>/packages/storage-r2/src/**/*.spec.ts',
			],
		}
	],
	collectCoverageFrom: [
		'packages/*/src/**/*.ts',
		'!**/*.spec.ts',
	],
};
