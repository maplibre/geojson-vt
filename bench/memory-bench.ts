/*
 * Simulates the behavior of Maplibre using Geojson-vt to load a geojson layer
 * And measure the memory
 */

import {readFileSync} from 'fs';
import v8 from 'v8';
import {GeoJSONVT} from '../src';

console.log('\nMemory benchmark:');

// USA GeoJson from https://eric.clst.org/tech/usgeojson/
const geojsonData: GeoJSON.FeatureCollection = JSON.parse(readFileSync(new URL('assets/gz_2010_us_outline_500k.json', import.meta.url), 'utf8'));
console.log(`  Loaded ${geojsonData.features.length} features`);

// options:
const geojsonVtOptions = {
    buffer: 2048,
    extent: 8192,
    generateId: false,
    lineMetrics: false,
    maxZoom: 18,
    tolerance: 6
};


declare const global: typeof globalThis & { gc: () => void };

global.gc();
const indices = [];
const size = v8.getHeapStatistics().used_heap_size;
for (let i=0; i<500; ++i){
    indices.push(new GeoJSONVT(geojsonData, geojsonVtOptions));
}
global.gc();

console.log(`  Memory used: ${Math.round((v8.getHeapStatistics().used_heap_size - size) / 1024)} KB`);
