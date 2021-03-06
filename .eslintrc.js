const { join } = require('path');
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    project: join(__dirname, './packages/tsconfig.settings.json'),
  },
  plugins: ['rxjs'],
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'semi': 1,
    'rxjs/no-async-subscribe': 'error',
    'rxjs/no-ignored-observable': 'error',
    'rxjs/no-ignored-subscription': 'error',
    'rxjs/no-nested-subscribe': 'error',
  },
};
