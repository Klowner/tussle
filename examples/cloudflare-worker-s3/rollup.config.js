import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { string } from 'rollup-plugin-string';
import json from "@rollup/plugin-json";
import { uglify } from "rollup-plugin-uglify";

const client = {
    input: './client.js',
    output: {
        file: './client-bundle.js',
        format: 'cjs',
    },
    plugins: [
        resolve({
            browser: true,
        }),
        commonjs({
            transformMixedEsModules: true,
        }),
    ],
}

const worker = {
    input: './worker.js',
    output: {
        dir: './dist',
        format: 'cjs',
        sourcemap: true,
    },
    plugins: [
        string({
            include: ["**/*.html", "client-bundle.js"],
        }),
        resolve({
            preferBuiltins: true,
            browser: true,
            jsnext: true,
            // mainFields: ['module', 'main', 'browser'],
        }),
        commonjs({
            transformMixedEsModules: true,
            // ignoreDynamicRequires: true,
        }),
        json(),
        uglify(),
    ],
}

export default [
    client,
    worker,
];
