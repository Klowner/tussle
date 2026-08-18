const {
    defineConfig,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const rxjs = require("eslint-plugin-rxjs");
const deprecation = require("eslint-plugin-deprecation");
const promise = require("eslint-plugin-promise");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

const {
    join,
} = require("path");

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2020,

        parserOptions: {
            project: join(__dirname, "./packages/tsconfig.settings.json"),
        },
    },

    plugins: {
        rxjs,
        deprecation,
        promise,
    },

    extends: compat.extends("plugin:@typescript-eslint/recommended", "plugin:promise/recommended"),

    rules: {
        "semi": 1,
        "deprecation/deprecation": "warn",
        "rxjs/no-async-subscribe": "error",
        "rxjs/no-ignored-observable": "error",
        "rxjs/no-ignored-subscription": "error",
        "rxjs/no-nested-subscribe": "error",
    },
}]);
