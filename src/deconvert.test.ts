import {test, expect} from 'vitest';
import {deconvert} from './deconvert';
import {GeoJSONVT} from './geojsonvt';
import type { GeoJSONVTInternalFeature } from './definitions';

test('deconvert: returns empty FeatureCollection for empty source', () => {
    const result = deconvert([]);
    expect(result).toEqual({type: 'FeatureCollection', features: []});
});

test('deconvert: returns empty FeatureCollection for null/undefined source', () => {
    const result = deconvert(null as unknown as GeoJSONVTInternalFeature[]);
    expect(result).toEqual({type: 'FeatureCollection', features: []});
});

test('deconvert: converts Point feature', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'Point',
        id: 'point1',
        geometry: [0.5, 0.5, 0], // projected coordinates (0,0 in lng/lat)
        tags: {name: 'Test Point'},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.5,
        maxY: 0.5
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.type).toBe('FeatureCollection');
    expect(result.features.length).toBe(1);
    expect(result.features[0].type).toBe('Feature');
    expect(result.features[0].id).toBe('point1');
    expect(result.features[0].properties).toEqual({name: 'Test Point'});
    expect(result.features[0].geometry.type).toBe('Point');

    const coords = (result.features[0].geometry as GeoJSON.Point).coordinates;
    expect(coords[0]).toBeCloseTo(0, 5); // longitude
    expect(coords[1]).toBeCloseTo(0, 5); // latitude
});

test('deconvert: converts MultiPoint feature', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'MultiPoint',
        id: 'multipoint1',
        geometry: [0.5, 0.5, 0, 0.525, 0.5, 0], // two points
        tags: {},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.525,
        maxY: 0.5
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].geometry.type).toBe('MultiPoint');
    const coords = (result.features[0].geometry as GeoJSON.MultiPoint).coordinates;
    expect(coords.length).toBe(2);
    expect(coords[0][0]).toBeCloseTo(0, 5);
    expect(coords[1][0]).toBeCloseTo(9, 0); // ~9 degrees longitude
});

test('deconvert: converts LineString feature', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'LineString',
        id: 'line1',
        geometry: [0.5, 0.5, 0, 0.525, 0.5, 0, 0.525, 0.525, 0],
        tags: {highway: 'primary'},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.525,
        maxY: 0.525
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].geometry.type).toBe('LineString');
    expect(result.features[0].properties).toEqual({highway: 'primary'});
    const coords = (result.features[0].geometry as GeoJSON.LineString).coordinates;
    expect(coords.length).toBe(3);
});

test('deconvert: converts MultiLineString feature', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'MultiLineString',
        id: 'multiline1',
        geometry: [
            [0.5, 0.5, 0, 0.525, 0.5, 0],
            [0.55, 0.55, 0, 0.575, 0.55, 0]
        ],
        tags: {},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.575,
        maxY: 0.55
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].geometry.type).toBe('MultiLineString');
    const coords = (result.features[0].geometry as GeoJSON.MultiLineString).coordinates;
    expect(coords.length).toBe(2);
    expect(coords[0].length).toBe(2);
    expect(coords[1].length).toBe(2);
});

test('deconvert: converts Polygon feature', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'Polygon',
        id: 'polygon1',
        geometry: [
            [0.5, 0.5, 0, 0.55, 0.5, 0, 0.55, 0.55, 0, 0.5, 0.55, 0, 0.5, 0.5, 0] // outer ring
        ],
        tags: {landuse: 'residential'},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.55,
        maxY: 0.55
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].geometry.type).toBe('Polygon');
    expect(result.features[0].properties).toEqual({landuse: 'residential'});
    const coords = (result.features[0].geometry as GeoJSON.Polygon).coordinates;
    expect(coords.length).toBe(1); // one ring
    expect(coords[0].length).toBe(5); // 5 points (closed ring)
});

test('deconvert: converts Polygon with hole', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'Polygon',
        id: 'polygon-with-hole',
        geometry: [
            [0.5, 0.5, 0, 0.6, 0.5, 0, 0.6, 0.6, 0, 0.5, 0.6, 0, 0.5, 0.5, 0], // outer ring
            [0.52, 0.52, 0, 0.58, 0.52, 0, 0.58, 0.58, 0, 0.52, 0.58, 0, 0.52, 0.52, 0] // hole
        ],
        tags: {},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.6,
        maxY: 0.6
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].geometry.type).toBe('Polygon');
    const coords = (result.features[0].geometry as GeoJSON.Polygon).coordinates;
    expect(coords.length).toBe(2); // outer ring + hole
});

test('deconvert: converts MultiPolygon feature', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'MultiPolygon',
        id: 'multipolygon1',
        geometry: [
            [[0.5, 0.5, 0, 0.52, 0.5, 0, 0.52, 0.52, 0, 0.5, 0.52, 0, 0.5, 0.5, 0]],
            [[0.55, 0.55, 0, 0.57, 0.55, 0, 0.57, 0.57, 0, 0.55, 0.57, 0, 0.55, 0.55, 0]]
        ],
        tags: {},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.57,
        maxY: 0.57
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].geometry.type).toBe('MultiPolygon');
    const coords = (result.features[0].geometry as GeoJSON.MultiPolygon).coordinates;
    expect(coords.length).toBe(2); // two polygons
    expect(coords[0].length).toBe(1); // first polygon has one ring
    expect(coords[1].length).toBe(1); // second polygon has one ring
});

test('deconvert: handles feature without id', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'Point',
        geometry: [0.5, 0.5, 0],
        tags: {},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.5,
        maxY: 0.5
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].id).toBeUndefined();
});

test('deconvert: handles numeric id', () => {
    const source: GeoJSONVTInternalFeature[] = [{
        type: 'Point',
        id: 42,
        geometry: [0.5, 0.5, 0],
        tags: {},
        minX: 0.5,
        minY: 0.5,
        maxX: 0.5,
        maxY: 0.5
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features[0].id).toBe(42);
});

test('deconvert: converts multiple features', () => {
    const source: GeoJSONVTInternalFeature[] = [
        {
            type: 'Point',
            id: 'point1',
            geometry: [0.5, 0.5, 0],
            tags: {type: 'point'},
            minX: 0.5,
            minY: 0.5,
            maxX: 0.5,
            maxY: 0.5
        },
        {
            type: 'LineString',
            id: 'line1',
            geometry: [0.5, 0.5, 0, 0.6, 0.6, 0],
            tags: {type: 'line'},
            minX: 0.5,
            minY: 0.5,
            maxX: 0.6,
            maxY: 0.6
        }
    ];

    const result = deconvert(source) as GeoJSON.FeatureCollection;

    expect(result.features.length).toBe(2);
    expect(result.features[0].geometry.type).toBe('Point');
    expect(result.features[1].geometry.type).toBe('LineString');
});

test('deconvert: correctly unprojects coordinates', () => {
    // Test specific known coordinates
    // (0.5, 0.5) in projected space should be (0, 0) in lng/lat
    // (0, 0.5) should be (-180, 0)
    // (1, 0.5) should be (180, 0)

    const source: GeoJSONVTInternalFeature[] = [{
        type: 'MultiPoint',
        geometry: [
            0.5, 0.5, 0,   // (0, 0)
            0, 0.5, 0,     // (-180, 0)
            1, 0.5, 0      // (180, 0)
        ],
        tags: {},
        minX: 0,
        minY: 0.5,
        maxX: 1,
        maxY: 0.5
    }];

    const result = deconvert(source) as GeoJSON.FeatureCollection;
    const coords = (result.features[0].geometry as GeoJSON.MultiPoint).coordinates;

    expect(coords[0][0]).toBeCloseTo(0, 5);
    expect(coords[0][1]).toBeCloseTo(0, 5);
    expect(coords[1][0]).toBeCloseTo(-180, 5);
    expect(coords[1][1]).toBeCloseTo(0, 5);
    expect(coords[2][0]).toBeCloseTo(180, 5);
    expect(coords[2][1]).toBeCloseTo(0, 5);
});

test('GeoJSONVT.getData: returns source data as GeoJSON', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                id: 'point1',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {name: 'Test'}
            }
        ]
    };

    const index = new GeoJSONVT(geojson, {updateable: true});
    const result = index.getData() as GeoJSON.FeatureCollection;

    expect(result.type).toBe('FeatureCollection');
    expect(result.features.length).toBe(1);
    expect(result.features[0].id).toBe('point1');
    expect(result.features[0].geometry.type).toBe('Point');
    expect(result.features[0].properties).toEqual({name: 'Test'});
});

test('GeoJSONVT.getData: returns empty FeatureCollection when updateable is false', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(geojson, {updateable: false});
    const result = index.getData() as GeoJSON.FeatureCollection;

    expect(result).toEqual({type: 'FeatureCollection', features: []});
});

test('GeoJSONVT.getFeatureById: returns feature by string id', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                id: 'feature-1',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {name: 'First'}
            },
            {
                type: 'Feature',
                id: 'feature-2',
                geometry: {type: 'Point', coordinates: [10, 10]},
                properties: {name: 'Second'}
            }
        ]
    };

    const index = new GeoJSONVT(geojson, {updateable: true});
    const feature = index.getFeatureById('feature-2');

    expect(feature).not.toBeNull();
    expect(feature!.id).toBe('feature-2');
    expect(feature!.properties).toEqual({name: 'Second'});
});

test('GeoJSONVT.getFeatureById: returns feature by numeric id', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                id: 1,
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {name: 'First'}
            },
            {
                type: 'Feature',
                id: 2,
                geometry: {type: 'Point', coordinates: [10, 10]},
                properties: {name: 'Second'}
            }
        ]
    };

    const index = new GeoJSONVT(geojson, {updateable: true});
    const feature = index.getFeatureById(1);

    expect(feature).not.toBeNull();
    expect(feature!.id).toBe(1);
    expect(feature!.properties).toEqual({name: 'First'});
});

test('GeoJSONVT.getFeatureById: returns null for non-existent id', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                id: 'feature-1',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(geojson, {updateable: true});
    const feature = index.getFeatureById('non-existent');

    expect(feature).toBeNull();
});

test('GeoJSONVT.getFeatureById: returns null when updateable is false', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                id: 'feature-1',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(geojson, {updateable: false});
    const feature = index.getFeatureById('feature-1');

    expect(feature).toBeNull();
});
