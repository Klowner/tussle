import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

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
