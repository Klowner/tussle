const {
  defineConfig,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const rxjs = require("eslint-plugin-rxjs-x");
const promise = require("eslint-plugin-promise");

const {
  join,
} = require("path");

module.exports = defineConfig([
  tsPlugin.configs["flat/recommended"],
  promise.configs["flat/recommended"],
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,

      parserOptions: {
        project: join(__dirname, "./packages/tsconfig.settings.json"),
      },
    },

    plugins: {
      rxjs: rxjs.default || rxjs,
    },

    rules: {
      "semi": 1,
      "@typescript-eslint/no-deprecated": "warn",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					"argsIgnorePattern": "^_"
				}
			],
      "rxjs/no-async-subscribe": "error",
      "rxjs/no-floating-observables": "error",
      "rxjs/no-ignored-subscription": "error",
      "rxjs/no-nested-subscribe": "error",
    },
  },
]);

