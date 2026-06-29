import {test, expect, describe} from 'vitest';
import {convertToInternal} from './convert';
import {defaultOptions} from './geojsonvt';

/**
 * Wraps a geometry in `depth` nested GeometryCollections.
 */
function nestGeometryCollections(depth: number, inner: GeoJSON.Geometry): GeoJSON.Geometry {
    let geometry = inner;
    for (let i = 0; i < depth; i++) {
        geometry = {type: 'GeometryCollection', geometries: [geometry]};
    }
    return geometry;
}

const point: GeoJSON.Point = {type: 'Point', coordinates: [0, 0]};

function feature(geometry: GeoJSON.Geometry): GeoJSON.Feature {
    return {type: 'Feature', geometry, properties: null};
}
describe('convertToInternal', () => {
    test('converts a geometry nested in GeometryCollections', () => {
        const features = convertToInternal(feature(nestGeometryCollections(3, point)), defaultOptions);

        expect(features).toHaveLength(1);
        expect(features[0].type).toBe('Point');
    });

    test('allows nesting up to the supported depth', () => {
        const features = convertToInternal(feature(nestGeometryCollections(1024, point)), defaultOptions);

        expect(features).toHaveLength(1);
        expect(features[0].type).toBe('Point');
    });

    test('throws when GeometryCollection nesting exceeds the supported depth', () => {
        expect(() => convertToInternal(feature(nestGeometryCollections(1025, point)), defaultOptions))
            .toThrow('GeometryCollection nesting exceeds supported depth: 1024');
    });
})
