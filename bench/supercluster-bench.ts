/*
 * Memory and speed benchmark for clustering.
 * Run with `tsx --expose-gc bench/supercluster-bench.ts`, a few times, and compare medians.
 *
 * alloc: held plus the bytes freed by GC during the build
 * peak: largest used heap seen before a GC during the build
 * held: heap and external memory left after the input is released
 */

import v8 from 'v8';
import {Supercluster} from '../src';

declare const global: typeof globalThis & { gc: () => void };

type GCStatistics = {
    beforeGC: {heapStatistics: {usedHeapSize: number}};
    afterGC: {heapStatistics: {usedHeapSize: number}};
};

const N = 1_000_000;

const points: GeoJSON.Feature<GeoJSON.Point, {index: number}>[] = [];
for (let i = 0; i < N; i++) {
    points.push({
        type: 'Feature',
        properties: {index: i},
        geometry: {
            type: 'Point',
            coordinates: [
                -180 + 360 * Math.random(),
                -80 + 160 * Math.random()
            ]
        }
    });
}

function settle() {
    for (let i = 0; i < 8; i++) global.gc();
}

function snap(): number {
    const m = process.memoryUsage();
    return m.heapUsed + m.external;
}

function fmt(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    if (Math.abs(mb) < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(Math.abs(mb) < 100 ? 1 : 0)} MB`;
}

settle();
const baseline = snap();

const profiler = new v8.GCProfiler();
profiler.start();
const index = new Supercluster({log: true, maxZoom: 17});
index.load(points);
points.length = 0;
const statistics = profiler.stop().statistics as GCStatistics[];
const external = process.memoryUsage().external;

let freed = 0;
let peakHeap = 0;
for (const {beforeGC, afterGC} of statistics) {
    const before = beforeGC.heapStatistics.usedHeapSize;
    const after = afterGC.heapStatistics.usedHeapSize;
    if (before > after) freed += before - after;
    if (before > peakHeap) peakHeap = before;
}

settle();
const held = snap() - baseline;

console.log(`\nalloc: ${fmt(held + freed)}`);
console.log(`peak:  ${fmt(peakHeap + external - baseline)}`);
console.log(`held:  ${fmt(held)}`);

index.getClusters([-180, -90, 180, 90], 0).map(f => JSON.stringify(f.properties));
