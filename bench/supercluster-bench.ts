
import v8 from 'v8';
import geojsonvt from '../src';

const points: GeoJSON.Feature<GeoJSON.Point, {index: number}>[] = [];
for (let i = 0; i < 1000000; i++) {
    points.push({
        type: 'Feature',
        properties: {
            index: i
        },
        geometry: {
            type: 'Point',
            coordinates: [
                -180 + 360 * Math.random(),
                -80 + 160 * Math.random()
            ]
        }
    });
}

declare const global: typeof globalThis & { gc: () => void };

global.gc();
const size = v8.getHeapStatistics().used_heap_size;

const index = new geojsonvt.Supercluster({
    log: true,
    maxZoom: 6,
    // map: props => ({sum: props.index}),
    // reduce: (accumulated, props) => { accumulated.sum += props.sum; }
})
index.load(points);

global.gc();
console.log(`memory used: ${Math.round((v8.getHeapStatistics().used_heap_size - size) / 1024)} KB`);

index.getClusters([-180, -90, 180, 90], 0).map(f => JSON.stringify(f.tags));
