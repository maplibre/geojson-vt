
import {test, expect} from 'vitest';
import {featureToGeoJSON, unprojectX, unprojectY} from './deconvert';
import {projectX, projectY} from './convert';
import type {GeoJSONVTInternalFeature} from './definitions';

test('project/unproject roundtrip retains precision', () => {
    const coords = [
        {lng: 0, lat: 0},
        {lng: 90, lat: 45.0564839289},
        {lng: -90, lat: -45.0564839289},
        {lng: 180, lat: 85.0511287798},
        {lng: -180, lat: -85.0511287798},
        {lng: 45.1234567895, lat: 23.5456789012},
        {lng: -123.9876543210, lat: -67.8901234564},
        {lng: 0.0000000001, lat: 0.0000000001},
        {lng: 179.9999999999, lat: 85},
        {lng: -179.9999999999, lat: -85}
    ];

    for (const {lng, lat} of coords) {
        expect(unprojectX(projectX(lng))).toBeCloseTo(lng, 10);
        expect(unprojectY(projectY(lat))).toBeCloseTo(lat, 10);
    }
});

test('featureToGeoJSON: converts Point geometry', () => {
    const feature: GeoJSONVTInternalFeature = {
        type: 'Point',
        id: 'point1',
        geometry: [0.5, 0.5, 0],
        tags: {name: 'Test Point'},
        minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5
    };

    const result = featureToGeoJSON(feature);

    expect(result.type).toBe('Feature');
    expect(result.geometry.type).toBe('Point');
    expect((result.geometry as GeoJSON.Point).coordinates).toEqual([0, 0]);
    expect(result.id).toBe('point1');
    expect(result.properties).toEqual({name: 'Test Point'});
});

test('featureToGeoJSON: converts MultiPoint geometry', () => {
    const feature: GeoJSONVTInternalFeature = {
        type: 'MultiPoint',
        id: 'multipoint1',
        geometry: [0.5, 0.5, 0, 0.525, 0.5, 0],
        tags: {},
        minX: 0.5, minY: 0.5, maxX: 0.525, maxY: 0.5
    };

    const result = featureToGeoJSON(feature);

    expect(result.geometry.type).toBe('MultiPoint');
    expect((result.geometry as GeoJSON.MultiPoint).coordinates.length).toBe(2);
});

test('featureToGeoJSON: converts LineString geometry', () => {
    const feature: GeoJSONVTInternalFeature = {
        type: 'LineString',
        id: 'line1',
        geometry: [0.5, 0.5, 0, 0.525, 0.5, 0, 0.525, 0.525, 0],
        tags: {highway: 'primary'},
        minX: 0.5, minY: 0.5, maxX: 0.525, maxY: 0.525
    };

    const result = featureToGeoJSON(feature);

    expect(result.geometry.type).toBe('LineString');
    expect((result.geometry as GeoJSON.LineString).coordinates.length).toBe(3);
});

test('featureToGeoJSON: converts MultiLineString geometry', () => {
    const feature: GeoJSONVTInternalFeature = {
        type: 'MultiLineString',
        id: 'multiline1',
        geometry: [
            [0.5, 0.5, 0, 0.525, 0.5, 0],
            [0.55, 0.55, 0, 0.575, 0.55, 0]
        ],
        tags: {},
        minX: 0.5, minY: 0.5, maxX: 0.575, maxY: 0.55
    };

    const result = featureToGeoJSON(feature);

    expect(result.geometry.type).toBe('MultiLineString');
    expect((result.geometry as GeoJSON.MultiLineString).coordinates.length).toBe(2);
});

test('featureToGeoJSON: converts Polygon geometry', () => {
    const feature: GeoJSONVTInternalFeature = {
        type: 'Polygon',
        id: 'polygon1',
        geometry: [
            [0.5, 0.5, 0, 0.6, 0.5, 0, 0.6, 0.6, 0, 0.5, 0.6, 0, 0.5, 0.5, 0],
            [0.52, 0.52, 0, 0.58, 0.52, 0, 0.58, 0.58, 0, 0.52, 0.58, 0, 0.52, 0.52, 0]
        ],
        tags: {landuse: 'residential'},
        minX: 0.5, minY: 0.5, maxX: 0.6, maxY: 0.6
    };

    const result = featureToGeoJSON(feature);

    expect(result.geometry.type).toBe('Polygon');
    expect((result.geometry as GeoJSON.Polygon).coordinates.length).toBe(2);
});

test('featureToGeoJSON: converts MultiPolygon geometry', () => {
    const feature: GeoJSONVTInternalFeature = {
        type: 'MultiPolygon',
        id: 'multipolygon1',
        geometry: [
            [[0.5, 0.5, 0, 0.52, 0.5, 0, 0.52, 0.52, 0, 0.5, 0.52, 0, 0.5, 0.5, 0]],
            [[0.55, 0.55, 0, 0.57, 0.55, 0, 0.57, 0.57, 0, 0.55, 0.57, 0, 0.55, 0.55, 0]]
        ],
        tags: {},
        minX: 0.5, minY: 0.5, maxX: 0.57, maxY: 0.57
    };

    const result = featureToGeoJSON(feature);

    expect(result.geometry.type).toBe('MultiPolygon');
    expect((result.geometry as GeoJSON.MultiPolygon).coordinates.length).toBe(2);
});

test('featureToGeoJSON: handles various id types', () => {
    const noId: GeoJSONVTInternalFeature = {type: 'Point', geometry: [0.5, 0.5, 0], tags: {}, minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5};
    const stringId: GeoJSONVTInternalFeature = {type: 'Point', id: 'string-id', geometry: [0.5, 0.5, 0], tags: {}, minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5};
    const numberId: GeoJSONVTInternalFeature = {type: 'Point', id: 42, geometry: [0.5, 0.5, 0], tags: {}, minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5};

    expect(featureToGeoJSON(noId).id).toBeUndefined();
    expect(featureToGeoJSON(stringId).id).toBe('string-id');
    expect(featureToGeoJSON(numberId).id).toBe(42);
});

test('featureToGeoJSON: correctly unprojects known coordinates', () => {
    const feature: GeoJSONVTInternalFeature = {
        type: 'MultiPoint',
        geometry: [0.5, 0.5, 0, 0, 0.5, 0, 1, 0.5, 0],
        tags: {},
        minX: 0, minY: 0.5, maxX: 1, maxY: 0.5
    };

    const result = featureToGeoJSON(feature);
    const coords = (result.geometry as GeoJSON.MultiPoint).coordinates;

    expect(coords[0]).toEqual([0, 0]);
    expect(coords[1]).toEqual([-180, 0]);
    expect(coords[2]).toEqual([180, 0]);
});
