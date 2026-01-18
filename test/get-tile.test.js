
import {test, expect} from 'vitest';
import fs from 'fs';

import geojsonvt from '../src/index.js';

const square = [{
    geometry: [[[-64, 4160], [-64, -64], [4160, -64], [4160, 4160], [-64, 4160]]],
    type: 3,
    tags: {name: 'Pennsylvania', density: 284.3},
    id: '42'
}];

test('getTile: us-states.json', () => {
    const log = console.log;

    console.log = function () {};
    const index = geojsonvt(getJSON('us-states.json'), {debug: 2});

    expect(index.getTile(7, 37, 48).features).toEqual(getJSON('us-states-z7-37-48.json'), 'z7-37-48');
    expect(index.getTile('7', '37', '48').features).toEqual(getJSON('us-states-z7-37-48.json'), 'z, x, y as strings');

    expect(index.getTile(9, 148, 192).features).toEqual(square, 'z9-148-192 (clipped square)');

    expect(index.getTile(11, 800, 400)).toBe(null, 'non-existing tile');
    expect(index.getTile(-5, 123.25, 400.25)).toBe(null, 'invalid tile');
    expect(index.getTile(25, 200, 200)).toBe(null, 'invalid tile');

    console.log = log;

    expect(index.total).toBe(37);
});

test('getTile: unbuffered tile left/right edges', () => {
    const index = geojsonvt({
        type: 'LineString',
        coordinates: [[0, 90], [0, -90]]
    }, {
        buffer: 0
    });

    expect(index.getTile(2, 1, 1)).toBe(null);
    expect(index.getTile(2, 2, 1).features).toEqual([{geometry: [[[0, 0], [0, 4096]]], type: 2, tags: null}]);
});

test('getTile: unbuffered tile top/bottom edges', () => {
    const index = geojsonvt({
        type: 'LineString',
        coordinates: [[-90, 66.51326044311188], [90, 66.51326044311188]]
    }, {
        buffer: 0
    });

    expect(index.getTile(2, 1, 0).features).toEqual([{geometry: [[[0, 4096], [4096, 4096]]], type: 2, tags: null}]);
    expect(index.getTile(2, 1, 1).features).toEqual([]);
});

test('getTile: polygon clipping on the boundary', () => {
    const index = geojsonvt({
        type: 'Polygon',
        coordinates: [[
            [42.1875, 57.32652122521708],
            [47.8125, 57.32652122521708],
            [47.8125, 54.16243396806781],
            [42.1875, 54.16243396806781],
            [42.1875, 57.32652122521708]
        ]]
    }, {
        buffer: 1024
    });

    expect(index.getTile(5, 19, 9).features).toEqual([{
        geometry: [[[3072, 3072], [5120, 3072], [5120, 5120], [3072, 5120], [3072, 3072]]],
        type: 3,
        tags: null
    }]);
});

function getJSON(name) {
    return JSON.parse(fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
}
