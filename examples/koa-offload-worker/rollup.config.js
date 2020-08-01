import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: './main.ts',
    output: {
        file: './bundle.js',
        format: 'cjs',
    },
    plugins: [
        typescript(),
        resolve({
            browser: true,
        }),
        commonjs(),
    ],
}
