
import {test, expect} from 'vitest';
import {clip} from './clip';
import type { SliceArray } from './definitions';

const geom1 = [0,0,0,50,0,0,50,10,0,20,10,0,20,20,0,30,20,0,30,30,0,50,30,0,50,40,0,25,40,0,25,50,0,0,50,0,0,60,0,25,60,0];
const geom2 = [0,0,0,50,0,0,50,10,0,0,10,0];

test('clips polylines', () => {

    const clipped = clip([
        {geometry: {points: geom1}, type: 'LineString', tags: { "1": 1}, minX: 0, minY: 0, maxX: 50, maxY: 60},
        {geometry: {points: geom2}, type: 'LineString', tags: { "2": 2}, minX: 0, minY: 0, maxX: 50, maxY: 10}
    ], 1, 10, 40, 0, -Infinity, Infinity, {});

    const expected = [
        {id: null as string, type: 'MultiLineString', geometry: [
            {points: [10,0,1,40,0,1]},
            {points: [40,10,1,20,10,0,20,20,0,30,20,0,30,30,0,40,30,1]},
            {points: [40,40,1,25,40,0,25,50,0,10,50,1]},
            {points: [10,60,1,25,60,0]}], tags: {"1": 1}, minX: 10, minY: 0, maxX: 40, maxY: 60},
        {id: null as string, type: 'MultiLineString', geometry: [
            {points: [10,0,1,40,0,1]},
            {points: [40,10,1,10,10,1]}], tags: {"2": 2}, minX: 10, minY: 0, maxX: 40, maxY: 10}
    ];

    expect(JSON.stringify(clipped)).toEqual(JSON.stringify(expected));
});

test('clips lines with line metrics on', () => {

    const points = geom1.slice();
    let size = 0;
    for (let i = 0; i < points.length - 3; i += 3) {
        const dx = points[i + 3] - points[i];
        const dy = points[i + 4] - points[i + 1];
        size += Math.sqrt(dx * dx + dy * dy);
    }
    const geom: SliceArray = {points, size, start: 0, end: size};

    const clipped = clip([{id: 1, geometry: geom, type: 'LineString', tags: {}, minX: 0, minY: 0, maxX: 50, maxY: 60}],
        1, 10, 40, 0, -Infinity, Infinity, {lineMetrics: true});

    expect(
        clipped.map(f => [(f.geometry as SliceArray).start, (f.geometry as SliceArray).end])).toEqual(
        [[10, 40], [70, 130], [160, 200], [230, 245]]
    );
});

function closed(geometry: number[]): SliceArray[] {
    return [{points: geometry.concat(geometry.slice(0, 3))}];
}

test('clips polygons', () => {

    const clipped = clip([
        {geometry: closed(geom1), type: 'Polygon', tags: {"1": 1}, minX: 0, minY: 0, maxX: 50, maxY: 60},
        {geometry: closed(geom2), type: 'Polygon', tags: {"2": 2}, minX: 0, minY: 0, maxX: 50, maxY: 10}
    ], 1, 10, 40, 0, -Infinity, Infinity, {});

    const expected = [
        {id: null as string, type: 'Polygon', geometry: [{points: [10,0,1,40,0,1,40,10,1,20,10,0,20,20,0,30,20,0,30,30,0,40,30,1,40,40,1,25,40,0,25,50,0,10,50,1,10,60,1,25,60,0,10,24,1,10,0,1]}], tags: {"1": 1}, minX: 10, minY: 0, maxX: 40, maxY: 60},
        {id: null as string, type: 'Polygon', geometry: [{points: [10,0,1,40,0,1,40,10,1,10,10,1,10,0,1]}], tags: {"2": 2}, minX: 10, minY: 0, maxX: 40, maxY: 10}
    ];

    expect(JSON.stringify(clipped)).toEqual(JSON.stringify(expected));
});

test('clips points', () => {

    const clipped = clip([
        {geometry: geom1, type: 'MultiPoint', tags: {"1": 1}, minX: 0, minY: 0, maxX: 50, maxY: 60},
        {geometry: geom2, type: 'MultiPoint', tags: {"2": 2}, minX: 0, minY: 0, maxX: 50, maxY: 10}
    ], 1, 10, 40, 0, -Infinity, Infinity, {});

    expect(clipped).toEqual([{id: null, type: 'MultiPoint',
        geometry: [20,10,0,20,20,0,30,20,0,30,30,0,25,40,0,25,50,0,25,60,0], tags: {"1": 1}, minX: 20, minY: 10, maxX: 30, maxY: 60}]);
});
