
import {test, expect} from 'vitest';
import {clip} from './clip';
import type { GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiPointFeature } from './definitions';

const geom1 = [0,0,0,50,0,0,50,10,0,20,10,0,20,20,0,30,20,0,30,30,0,50,30,0,50,40,0,25,40,0,25,50,0,0,50,0,0,60,0,25,60,0];
const geom2 = [0,0,0,50,0,0,50,10,0,0,10,0];

/**
 * The coordinates of a feature with one ring, which has its number of positions and its size before it.
 */
function ring(points: number[], size = 0): Float64Array {
    return new Float64Array([points.length / 3, size, ...points]);
}

/**
 * The rings of a feature, each as its `x, y, z` values.
 */
function rings(feature: GeoJSONVTInternalFeature): number[][] {
    const geometry = (feature as GeoJSONVTInternalLineStringFeature).geometry;
    const result: number[][] = [];
    for (let i = 0; i < geometry.length; i += 2 + geometry[i] * 3) {
        result.push(Array.from(geometry.subarray(i + 2, i + 2 + geometry[i] * 3)));
    }
    return result;
}

test('clips polylines', () => {

    const clipped = clip([
        {geometry: ring(geom1), type: 'LineString', tags: { "1": 1}, minX: 0, minY: 0, maxX: 50, maxY: 60, offset: 0},
        {geometry: ring(geom2), type: 'LineString', tags: { "2": 2}, minX: 0, minY: 0, maxX: 50, maxY: 10, offset: 0}
    ], 1, 10, 40, 0, -Infinity, Infinity, {});

    expect(clipped).toMatchObject([
        {id: null, type: 'MultiLineString', tags: {"1": 1}, minX: 10, minY: 0, maxX: 40, maxY: 60},
        {id: null, type: 'MultiLineString', tags: {"2": 2}, minX: 10, minY: 0, maxX: 40, maxY: 10}
    ]);
    expect(rings(clipped[0])).toEqual([
        [10,0,1,40,0,1],
        [40,10,1,20,10,0,20,20,0,30,20,0,30,30,0,40,30,1],
        [40,40,1,25,40,0,25,50,0,10,50,1],
        [10,60,1,25,60,0]
    ]);
    expect(rings(clipped[1])).toEqual([
        [10,0,1,40,0,1],
        [40,10,1,10,10,1]
    ]);
});

test('clips lines with line metrics on', () => {

    const points = geom1.slice();
    let size = 0;
    for (let i = 0; i < points.length - 3; i += 3) {
        const dx = points[i + 3] - points[i];
        const dy = points[i + 4] - points[i + 1];
        size += Math.sqrt(dx * dx + dy * dy);
    }

    const clipped = clip([{id: 1, geometry: ring(points, size), type: 'LineString', tags: {}, minX: 0, minY: 0, maxX: 50, maxY: 60, offset: 0, start: 0, end: size, size}],
        1, 10, 40, 0, -Infinity, Infinity, {lineMetrics: true});

    expect(
        clipped.map(f => [(f as GeoJSONVTInternalLineStringFeature).start, (f as GeoJSONVTInternalLineStringFeature).end])).toEqual(
        [[10, 40], [70, 130], [160, 200], [230, 245]]
    );
});

function closed(geometry: number[]): Float64Array {
    return ring(geometry.concat(geometry.slice(0, 3)));
}

test('clips polygons', () => {

    const clipped = clip([
        {geometry: closed(geom1), type: 'Polygon', tags: {"1": 1}, minX: 0, minY: 0, maxX: 50, maxY: 60, offset: 0},
        {geometry: closed(geom2), type: 'Polygon', tags: {"2": 2}, minX: 0, minY: 0, maxX: 50, maxY: 10, offset: 0}
    ], 1, 10, 40, 0, -Infinity, Infinity, {});

    expect(clipped).toMatchObject([
        {id: null, type: 'Polygon', tags: {"1": 1}, minX: 10, minY: 0, maxX: 40, maxY: 60},
        {id: null, type: 'Polygon', tags: {"2": 2}, minX: 10, minY: 0, maxX: 40, maxY: 10}
    ]);
    expect(rings(clipped[0])).toEqual([[10,0,1,40,0,1,40,10,1,20,10,0,20,20,0,30,20,0,30,30,0,40,30,1,40,40,1,25,40,0,25,50,0,10,50,1,10,60,1,25,60,0,10,24,1,10,0,1]]);
    expect(rings(clipped[1])).toEqual([[10,0,1,40,0,1,40,10,1,10,10,1,10,0,1]]);
});

test('clips points', () => {

    const clipped = clip([
        {geometry: new Float64Array(geom1), type: 'MultiPoint', tags: {"1": 1}, minX: 0, minY: 0, maxX: 50, maxY: 60, offset: 0},
        {geometry: new Float64Array(geom2), type: 'MultiPoint', tags: {"2": 2}, minX: 0, minY: 0, maxX: 50, maxY: 10, offset: 0}
    ], 1, 10, 40, 0, -Infinity, Infinity, {});

    expect(clipped).toMatchObject([{id: null, type: 'MultiPoint', tags: {"1": 1}, minX: 20, minY: 10, maxX: 30, maxY: 60}]);
    expect(Array.from((clipped[0] as GeoJSONVTInternalMultiPointFeature).geometry)).toEqual([20,10,0,20,20,0,30,20,0,30,30,0,25,40,0,25,50,0,25,60,0]);
});
