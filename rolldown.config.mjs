import {defineConfig} from 'rolldown';

const umd = (file, minify) => ({
    input: 'src/index.ts',
    output: {
        name: 'geojsonvt',
        format: 'umd',
        file,
        minify
    }
});

export default defineConfig([
    umd('dist/geojson-vt-dev.js', false),
    umd('dist/geojson-vt.js', true),
    {
        input: 'src/index.ts',
        output: {
            format: 'esm',
            file: 'dist/geojson-vt.mjs',
            sourcemap: true
        }
    }
]);
