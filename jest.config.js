module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
  ],
  testMatch: [
    "**/*.spec.ts",
  ],
  globals: {
    'ts-jest': {
      tsConfig: './packages/tsconfig.json',
    },
  },
};
