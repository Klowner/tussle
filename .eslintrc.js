module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'no-unused-vars': ['error', { args: 'none' }],
  },
}
