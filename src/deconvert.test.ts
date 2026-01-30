
import {test, expect} from 'vitest';
import {deconvert, unprojectX, unprojectY} from './deconvert';
import {projectX, projectY} from './convert';
import {GeoJSONVT} from './geojsonvt';
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

test('deconvert: returns empty FeatureCollection for empty/null source', () => {
    expect(deconvert([])).toEqual({type: 'FeatureCollection', features: []});
    expect(deconvert(null as unknown as GeoJSONVTInternalFeature[])).toEqual({type: 'FeatureCollection', features: []});
});

test('deconvert: converts all geometry types', () => {
    const source: GeoJSONVTInternalFeature[] = [
        {
            type: 'Point',
            id: 'point1',
            geometry: [0.5, 0.5, 0],
            tags: {name: 'Test Point'},
            minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5
        },
        {
            type: 'MultiPoint',
            id: 'multipoint1',
            geometry: [0.5, 0.5, 0, 0.525, 0.5, 0],
            tags: {},
            minX: 0.5, minY: 0.5, maxX: 0.525, maxY: 0.5
        },
        {
            type: 'LineString',
            id: 'line1',
            geometry: [0.5, 0.5, 0, 0.525, 0.5, 0, 0.525, 0.525, 0],
            tags: {highway: 'primary'},
            minX: 0.5, minY: 0.5, maxX: 0.525, maxY: 0.525
        },
        {
            type: 'MultiLineString',
            id: 'multiline1',
            geometry: [
                [0.5, 0.5, 0, 0.525, 0.5, 0],
                [0.55, 0.55, 0, 0.575, 0.55, 0]
            ],
            tags: {},
            minX: 0.5, minY: 0.5, maxX: 0.575, maxY: 0.55
        },
        {
            type: 'Polygon',
            id: 'polygon1',
            geometry: [
                [0.5, 0.5, 0, 0.6, 0.5, 0, 0.6, 0.6, 0, 0.5, 0.6, 0, 0.5, 0.5, 0],
                [0.52, 0.52, 0, 0.58, 0.52, 0, 0.58, 0.58, 0, 0.52, 0.58, 0, 0.52, 0.52, 0]
            ],
            tags: {landuse: 'residential'},
            minX: 0.5, minY: 0.5, maxX: 0.6, maxY: 0.6
        },
        {
            type: 'MultiPolygon',
            id: 'multipolygon1',
            geometry: [
                [[0.5, 0.5, 0, 0.52, 0.5, 0, 0.52, 0.52, 0, 0.5, 0.52, 0, 0.5, 0.5, 0]],
                [[0.55, 0.55, 0, 0.57, 0.55, 0, 0.57, 0.57, 0, 0.55, 0.57, 0, 0.55, 0.55, 0]]
            ],
            tags: {},
            minX: 0.5, minY: 0.5, maxX: 0.57, maxY: 0.57
        }
    ];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.type).toBe('FeatureCollection');
    expect(result.features.length).toBe(6);

    expect(result.features[0].geometry.type).toBe('Point');
    expect(result.features[0].id).toBe('point1');
    expect(result.features[0].properties).toEqual({name: 'Test Point'});

    expect(result.features[1].geometry.type).toBe('MultiPoint');
    expect((result.features[1].geometry as GeoJSON.MultiPoint).coordinates.length).toBe(2);

    expect(result.features[2].geometry.type).toBe('LineString');
    expect((result.features[2].geometry as GeoJSON.LineString).coordinates.length).toBe(3);

    expect(result.features[3].geometry.type).toBe('MultiLineString');
    expect((result.features[3].geometry as GeoJSON.MultiLineString).coordinates.length).toBe(2);

    expect(result.features[4].geometry.type).toBe('Polygon');
    expect((result.features[4].geometry as GeoJSON.Polygon).coordinates.length).toBe(2);

    expect(result.features[5].geometry.type).toBe('MultiPolygon');
    expect((result.features[5].geometry as GeoJSON.MultiPolygon).coordinates.length).toBe(2);
});

test('deconvert: handles various id types', () => {
    const source: GeoJSONVTInternalFeature[] = [
        {type: 'Point', geometry: [0.5, 0.5, 0], tags: {}, minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5},
        {type: 'Point', id: 'string-id', geometry: [0.5, 0.5, 0], tags: {}, minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5},
        {type: 'Point', id: 42, geometry: [0.5, 0.5, 0], tags: {}, minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5}
    ];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].id).toBeUndefined();
    expect(result.features[1].id).toBe('string-id');
    expect(result.features[2].id).toBe(42);
});

test('deconvert: correctly unprojects known coordinates', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'MultiPoint',
        geometry: [0.5, 0.5, 0, 0, 0.5, 0, 1, 0.5, 0],
        tags: {},
        minX: 0, minY: 0.5, maxX: 1, maxY: 0.5
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;
    const coords = (result.features[0].geometry as GeoJSON.MultiPoint).coordinates;

    expect(coords[0]).toEqual([0, 0]);
    expect(coords[1]).toEqual([-180, 0]);
    expect(coords[2]).toEqual([180, 0]);
});

test('GeoJSONVT.getData: returns source data when updateable', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            id: 'point1',
            geometry: {type: 'Point', coordinates: [0, 0]},
            properties: {name: 'Test'}
        }]
    };

    const updateable = new GeoJSONVT(geojson, {updateable: true});
    const result = updateable.getData() as GeoJSON.FeatureCollection;

    expect(result.type).toBe('FeatureCollection');
    expect(result.features.length).toBe(1);
    expect(result.features[0].id).toBe('point1');

    const notUpdateable = new GeoJSONVT(geojson, {updateable: false});
    expect(notUpdateable.getData()).toEqual({type: 'FeatureCollection', features: []});
});

test('GeoJSONVT.getFeatureById: returns feature by id when updateable', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {type: 'Feature', id: 'string-id', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {name: 'First'}},
            {type: 'Feature', id: 1, geometry: {type: 'Point', coordinates: [10, 10]}, properties: {name: 'Second'}}
        ]
    };

    const index = new GeoJSONVT(geojson, {updateable: true});

    const byString = index.getFeatureById('string-id');
    expect(byString).not.toBeNull();
    expect(byString.id).toBe('string-id');
    expect(byString.properties).toEqual({name: 'First'});

    const byNumber = index.getFeatureById(1);
    expect(byNumber).not.toBeNull();
    expect(byNumber.id).toBe(1);

    expect(index.getFeatureById('non-existent')).toBeNull();

    const notUpdateable = new GeoJSONVT(geojson, {updateable: false});
    expect(notUpdateable.getFeatureById('string-id')).toBeNull();
});
