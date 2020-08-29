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
            mainFields: ['module', 'main', 'browser'],
        }),
        commonjs(),
    ],
}

export default [
    client,
    worker,
];
