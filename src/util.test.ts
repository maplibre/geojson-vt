import { test, expect } from 'vitest';
import { toGeoJSONPoints } from './util';
import type { GeoJSONVTInternalFeature } from './definitions';

test('toGeoJSONPoints converts point features to GeoJSON', () => {
    const features: GeoJSONVTInternalFeature[] = [
        {
            type: 'Point',
            id: 'point1',
            geometry: [0.5, 0.5, 0], // lng=0, lat=0
            tags: { name: 'Origin' },
            minX: 0.5,
            minY: 0.5,
            maxX: 0.5,
            maxY: 0.5
        }
    ];

    const result = toGeoJSONPoints(features);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Feature');
    expect(result[0].id).toBe('point1');
    expect(result[0].properties).toEqual({ name: 'Origin' });
    expect(result[0].geometry.type).toBe('Point');
    expect(result[0].geometry.coordinates[0]).toBeCloseTo(0, 5);
    expect(result[0].geometry.coordinates[1]).toBeCloseTo(0, 5);
});

test('toGeoJSONPoints skips non-point features', () => {
    const features: GeoJSONVTInternalFeature[] = [
        {
            type: 'Point',
            id: 1,
            geometry: [0.5, 0.5, 0],
            tags: null,
            minX: 0.5,
            minY: 0.5,
            maxX: 0.5,
            maxY: 0.5
        },
        {
            type: 'LineString',
            id: 2,
            geometry: [0, 0, 0, 1, 1, 0],
            tags: null,
            minX: 0,
            minY: 0,
            maxX: 1,
            maxY: 1
        }
    ];

    const result = toGeoJSONPoints(features);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
});

test('toGeoJSONPoints handles features without id', () => {
    const features: GeoJSONVTInternalFeature[] = [
        {
            type: 'Point',
            geometry: [0.5, 0.5, 0],
            tags: { test: true },
            minX: 0.5,
            minY: 0.5,
            maxX: 0.5,
            maxY: 0.5
        }
    ];

    const result = toGeoJSONPoints(features);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBeUndefined();
    expect(result[0].properties).toEqual({ test: true });
});
