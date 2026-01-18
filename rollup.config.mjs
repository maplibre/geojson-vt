import terser from '@rollup/plugin-terser';

const config = (file, plugins) => ({
    input: 'src/index.js',
    output: {
        name: 'geojsonvt',
        format: 'umd',
        indent: false,
        file
    },
    plugins
});

export default [
    config('dist/geojson-vt-dev.js', []),
    config('dist/geojson-vt.js', [terser()]),
    {
        input: 'src/index.js',
        output: {
            format: 'esm',
            file: 'dist/geojson-vt.mjs'
        },
        plugins: []
    }
];
