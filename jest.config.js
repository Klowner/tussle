const transformTypescript = {
	'^.+\\.ts$': [
		'ts-jest',
		{
			diagnostics: {
				ignoreCodes: ['TS151001'],
			},
			tsconfig: './packages/tsconfig.json',
		},
	],
};

module.exports = {
	verbose: true,
	projects: [
		{
			transform: transformTypescript,
			testEnvironment: 'node',
			testMatch: [
				'<rootDir>/packages/core/**/*.spec.ts',
				'<rootDir>/packages/spec/**/*.spec.ts',
				'<rootDir>/packages/middleware-koa/**/*.spec.ts',
				'<rootDir>/packages/request-axios/**/*.spec.ts',
				'<rootDir>/packages/state-memory/**/*.spec.ts',
				'<rootDir>/packages/state-memory-ttl/**/*.spec.ts',
				'<rootDir>/packages/state-postgres/**/*.spec.ts',
			],
		},
		{
			transform: transformTypescript,
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
	],
};
