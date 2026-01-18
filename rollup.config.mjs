import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const config = (file, plugins) => ({
    input: 'src/index.ts',
    output: {
        name: 'geojsonvt',
        format: 'umd',
        indent: false,
        file
    },
    plugins
});

export default [
    config('dist/geojson-vt-dev.js', [typescript()]),
    config('dist/geojson-vt.js', [typescript(), terser()]),
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/geojson-vt.mjs', 
            format: 'esm',
            indent: false
        },
        plugins: [typescript()]
    }
];
