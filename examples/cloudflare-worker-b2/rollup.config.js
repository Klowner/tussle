import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { string } from 'rollup-plugin-string';

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
        commonjs(),
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
    ],
}

export default [
    client,
    worker,
];
