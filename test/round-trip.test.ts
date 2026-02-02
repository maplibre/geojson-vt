
import {test, expect} from 'vitest';
import {defaultOptions} from '../src/geojsonvt';
import {convertToGeoJSON} from '../src/deconvert';
import {convertToInternal} from '../src/convert';

const options = {...defaultOptions, updateable: true};

function checkCoord(actual: number[], expected: number[]) {
    expect(actual[0]).toBeCloseTo(expected[0], 10);
    expect(actual[1]).toBeCloseTo(expected[1], 10);
}

test('round trip: Point', () => {
    const coords = [10, 20];
    const input: GeoJSON.Feature = {type: 'Feature', geometry: {type: 'Point', coordinates: coords}, properties: {}};

    const internal = convertToInternal(input, options);
    const output = convertToGeoJSON(internal) as GeoJSON.FeatureCollection;

    const out = output.features[0].geometry as GeoJSON.Point;
    checkCoord(out.coordinates, coords);
});

test('round trip: MultiPoint', () => {
    const coords = [[0, 0], [5, 5], [-10, 45]];
    const input: GeoJSON.Feature = {type: 'Feature', geometry: {type: 'MultiPoint', coordinates: coords}, properties: {}};

    const internal = convertToInternal(input, options);
    const output = convertToGeoJSON(internal) as GeoJSON.FeatureCollection;

    const out = output.features[0].geometry as GeoJSON.MultiPoint;
    for (let i = 0; i < coords.length; i++) checkCoord(out.coordinates[i], coords[i]);
});

test('round trip: LineString', () => {
    const coords = [[0, 0], [10, 10], [20, -5]];
    const input: GeoJSON.Feature = {type: 'Feature', geometry: {type: 'LineString', coordinates: coords}, properties: {}};

    const internal = convertToInternal(input, options);
    const output = convertToGeoJSON(internal) as GeoJSON.FeatureCollection;

    const out = output.features[0].geometry as GeoJSON.LineString;
    for (let i = 0; i < coords.length; i++) checkCoord(out.coordinates[i], coords[i]);
});

test('round trip: MultiLineString', () => {
    const coords = [[[0, 0], [1, 1]], [[2, 2], [3, 3], [4, 4]]];
    const input: GeoJSON.Feature = {type: 'Feature', geometry: {type: 'MultiLineString', coordinates: coords}, properties: {}};

    const internal = convertToInternal(input, options);
    const output = convertToGeoJSON(internal) as GeoJSON.FeatureCollection;

    const out = output.features[0].geometry as GeoJSON.MultiLineString;
    for (let i = 0; i < coords.length; i++) {
        for (let j = 0; j < coords[i].length; j++) checkCoord(out.coordinates[i][j], coords[i][j]);
    }
});

test('round trip: Polygon', () => {
    const coords = [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]];
    const input: GeoJSON.Feature = {type: 'Feature', geometry: {type: 'Polygon', coordinates: coords}, properties: {}};

    const internal = convertToInternal(input, options);
    const output = convertToGeoJSON(internal) as GeoJSON.FeatureCollection;

    const out = output.features[0].geometry as GeoJSON.Polygon;
    for (let i = 0; i < coords.length; i++) {
        for (let j = 0; j < coords[i].length; j++) checkCoord(out.coordinates[i][j], coords[i][j]);
    }
});

test('round trip: MultiPolygon', () => {
    const coords = [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]]];
    const input: GeoJSON.Feature = {type: 'Feature', geometry: {type: 'MultiPolygon', coordinates: coords}, properties: {}};

    const internal = convertToInternal(input, options);
    const output = convertToGeoJSON(internal) as GeoJSON.FeatureCollection;

    const out = output.features[0].geometry as GeoJSON.MultiPolygon;
    for (let i = 0; i < coords.length; i++) {
        for (let j = 0; j < coords[i].length; j++) {
            for (let k = 0; k < coords[i][j].length; k++) checkCoord(out.coordinates[i][j][k], coords[i][j][k]);
        }
    }
});

test('round trip: preserves feature id and properties', () => {
    const input: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {type: 'Feature', id: 'test-id', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {a: 1, b: 'two', c: null}}
        ]
    };

    const internal = convertToInternal(input, options);
    const output = convertToGeoJSON(internal) as GeoJSON.FeatureCollection;

    expect(output.features[0].id).toBe('test-id');
    expect(output.features[0].properties).toEqual({a: 1, b: 'two', c: null});
});
