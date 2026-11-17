import {defineConfig} from 'rolldown';
import {dts} from 'rolldown-plugin-dts';
import packageJSON from './package.json' with {type: 'json'};

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
    },
    {
        input: {index: 'src/index.ts'},
        output: {
            dir: 'dist',
            format: 'esm'
        },
        external: Object.keys(packageJSON.dependencies),
        plugins: [dts({dtsOnly: true})]
    }
]);
