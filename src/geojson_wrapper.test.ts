import {describe, test, expect} from 'vitest';
import {GeoJSONWrapper, GEOJSON_TILE_LAYER_NAME, type VectorTileLike} from './geojson_wrapper';
import {type GeoJSONVTFeature} from './transform';
import geojsonvt from './index';

describe('geojsonwrapper', () => {
    test('linestring', () => {
        const features: GeoJSONVTFeature[] = [{
            type: 2,
            geometry: [[[0, 0], [10, 10]]],
            tags: {hello: 'world'}
        }];

        // Note: @types/geojson-vt doesn't look right here
        const wrap = new GeoJSONWrapper(features);
        const feature = wrap.feature(0);

        expect(feature).toBeTruthy();
        expect(feature.loadGeometry()).toEqual([[{x: 0, y: 0}, {x: 10, y: 10}]]);
        expect(feature.type).toBe(2);
        expect(feature.properties).toEqual({hello: 'world'});

    });

    test('point', () => {
        const features: GeoJSONVTFeature[] = [{
            type: 1,
            geometry: [[0, 1]],
            tags: {}
        }];

        const wrap = new GeoJSONWrapper(features);
        const feature = wrap.feature(0);
        expect(feature.loadGeometry()).toEqual([[{x: 0, y: 1}]]);
    });

    test('feature with string id', () => {
        const features: GeoJSONVTFeature[] = [{
            id: '42',
            type: 1,
            geometry: [[0, 0]],
            tags: {}
        }];

        const wrap = new GeoJSONWrapper(features);
        const feature = wrap.feature(0);
        expect(feature.id).toBe(42);
    });

    test('feature with numeric id', () => {
        const features: GeoJSONVTFeature[] = [{
            id: 123,
            type: 1,
            geometry: [[0, 0]],
            tags: {}
        }];

        const wrap = new GeoJSONWrapper(features);
        const feature = wrap.feature(0);
        expect(feature.id).toBe(123);
    });

    test('feature with NaN id is undefined', () => {
        const features: GeoJSONVTFeature[] = [{
            id: NaN,
            type: 1,
            geometry: [[0, 0]],
            tags: {}
        }];

        const wrap = new GeoJSONWrapper(features);
        const feature = wrap.feature(0);
        expect(feature.id).toBeUndefined();
    });

    test('getTile with vectortilejs format', () => {
        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {name: 'test'},
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                }
            }]
        };

        const index = geojsonvt(geojson, {format: 'vectortilejs', extent: 8192});
        const tile = index.getTile(0, 0, 0) as VectorTileLike;
        const layer = tile.layers[GEOJSON_TILE_LAYER_NAME];

        expect(tile).toBeTruthy();
        expect(tile).toHaveProperty('layers');
        expect(layer).toBeDefined();
        expect(layer.version).toBe(2);
        expect(layer.extent).toBe(8192);
    });
});
