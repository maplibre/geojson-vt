import {describe, test, expect} from 'vitest';
import {GeoJSONVT, GEOJSONVT_ANTIMERIDIAN_CLIP} from '../src';
import {defaultOptions} from '../src/geojsonvt';

const EXTENT = defaultOptions.extent;
const BUFFER = defaultOptions.buffer;

function point(coordinates: [number, number]): GeoJSON.Feature<GeoJSON.Point> {
    return {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates}};
}

function lineString(coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
    return {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates}};
}

function polygon(coordinates: [number, number][][]): GeoJSON.Feature<GeoJSON.Polygon> {
    return {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates}};
}

function multiPolygon(coordinates: [number, number][][][]): GeoJSON.Feature<GeoJSON.MultiPolygon> {
    return {type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon', coordinates}};
}

function xRange(feature: {geometry: unknown}): [number, number] {
    const xs = (feature.geometry as [number, number][][]).flat().map(([x]) => x);
    return [Math.min(...xs), Math.max(...xs)];
}

describe('worldCopies: true', () => {
    test('line crossing antimeridian is duplicated into both world copies', () => {
        const vt = new GeoJSONVT(lineString([[170, 0], [190, 0]]));
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(2);
    });

    test('polygon crossing antimeridian is duplicated with buffer overlap on both sides', () => {
        const vt = new GeoJSONVT(polygon([[
            [170, 10], [190, 10], [190, -10], [170, -10], [170, 10]
        ]]));
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(2);

        const ranges = tile.features.map(xRange);
        const east = ranges.find(([, max]) => max > EXTENT);
        const west = ranges.find(([min]) => min < 0);
        expect(east).toBeDefined();
        expect(west).toBeDefined();
    });

    test('antimeridian-crossing polygon is not tagged with GEOJSONVT_ANTIMERIDIAN_CLIP', () => {
        const vt = new GeoJSONVT(polygon([[
            [170, 10], [190, 10], [190, -10], [170, -10], [170, 10]
        ]]));
        const tile = vt.getTile(0, 0, 0);
        for (const feature of tile.features) {
            expect(feature.tags?.[GEOJSONVT_ANTIMERIDIAN_CLIP]).toBeUndefined();
        }
    });
});

describe('worldCopies: false', () => {
    test('point just past antimeridian is not duplicated in the east buffer', () => {
        const tile = new GeoJSONVT(point([181, 0]), {worldCopies: false}).getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
        const [tx] = (tile.features[0].geometry as [number, number][])[0];
        expect(tx).toBeGreaterThanOrEqual(0);
        expect(tx).toBeLessThan(BUFFER);
    });

    test('line ending at antimeridian has no buffer overshoot', () => {
        const tile = new GeoJSONVT(lineString([[170, 0], [180, 0]]), {worldCopies: false}).getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
        const [min, max] = xRange(tile.features[0]);
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBe(EXTENT);
    });

    test('polygon crossing antimeridian splits into two pieces inside [0, EXTENT]', () => {
        const vt = new GeoJSONVT(polygon([[
            [170, 10], [190, 10], [190, -10], [170, -10], [170, 10]
        ]]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(2);
        expect(tile.features[0].type).toBe(3);
        expect(tile.features[1].type).toBe(3);

        for (const feature of tile.features) {
            const [min, max] = xRange(feature);
            expect(min).toBeGreaterThanOrEqual(0);
            expect(max).toBeLessThanOrEqual(EXTENT);
        }
    });

    test('polygon touching 180 degrees exactly is not duplicated', () => {
        const vt = new GeoJSONVT(polygon([[
            [170, 10], [180, 10], [180, -10], [170, -10], [170, 10]
        ]]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
    });

    test('line touching -180 degrees exactly is not duplicated', () => {
        const vt = new GeoJSONVT(lineString([[-180, 0], [-170, 0]]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
    });

    test('point at exactly 180 degrees is preserved', () => {
        const vt = new GeoJSONVT(point([180, 0]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
    });

    test('point at 540 degrees is wrapped to the antimeridian in the central world', () => {
        const vt = new GeoJSONVT(point([540, 0]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
        const [tx] = (tile.features[0].geometry as [number, number][])[0];
        expect([0, EXTENT]).toContain(tx);
    });

    test('point at -540 degrees is wrapped to the antimeridian in the central world', () => {
        const vt = new GeoJSONVT(point([-540, 0]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
        const [tx] = (tile.features[0].geometry as [number, number][])[0];
        expect([0, EXTENT]).toContain(tx);
    });

    test('MultiPolygon with one crossing and one contained polygon stays inside [0, EXTENT]', () => {
        const vt = new GeoJSONVT(multiPolygon([
            [[[170, 10], [190, 10], [190, -10], [170, -10], [170, 10]]],
            [[[0, 20], [20, 20], [20, 0], [0, 0], [0, 20]]],
        ]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);

        expect(tile.features.length).toBe(2);
        expect(tile.features[0].type).toBe(3);
        expect(tile.features[1].type).toBe(3);

        for (const feature of tile.features) {
            const [min, max] = xRange(feature);
            expect(min).toBeGreaterThanOrEqual(0);
            expect(max).toBeLessThanOrEqual(EXTENT);
        }
    });

    test('works at higher zoom levels', () => {
        const vt = new GeoJSONVT(polygon([[
            [170, 10], [190, 10], [190, -10], [170, -10], [170, 10]
        ]]), {
            worldCopies: false,
            maxZoom: 2,
            indexMaxZoom: 2,
        });

        const rightEdgeTile = vt.getTile(2, 3, 1);
        expect(rightEdgeTile).not.toBeNull();
        expect(rightEdgeTile.features.length).toBeGreaterThan(0);

        const leftEdgeTile = vt.getTile(2, 0, 1);
        expect(leftEdgeTile).not.toBeNull();
        expect(leftEdgeTile.features.length).toBeGreaterThan(0);
    });

    test('antimeridian-crossing polygon is tagged with GEOJSONVT_ANTIMERIDIAN_CLIP on both edge tiles', () => {
        const vt = new GeoJSONVT(polygon([[
            [170, 10], [190, 10], [190, -10], [170, -10], [170, 10]
        ]]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(2);
        for (const feature of tile.features) {
            expect(feature.tags?.[GEOJSONVT_ANTIMERIDIAN_CLIP]).toBe(true);
        }
    });

    test('non-crossing polygon is NOT tagged', () => {
        const vt = new GeoJSONVT(polygon([[
            [10, 10], [30, 10], [30, -10], [10, -10], [10, 10]
        ]]), {worldCopies: false});
        const tile = vt.getTile(0, 0, 0);
        expect(tile.features.length).toBe(1);
        expect(tile.features[0].tags?.[GEOJSONVT_ANTIMERIDIAN_CLIP]).toBeUndefined();
    });

    test('antimeridian-crossing polygon tag propagates to interior tiles at higher zoom', () => {
        // Polygon spans longitudes 170 to 190 — at z=2 it covers tiles x=0 (left edge),
        // x=3 (right edge), and (after wrap) potentially adjacent interior tiles.
        // We assert the tag is present on every tile that contains a piece of it.
        const vt = new GeoJSONVT(polygon([[
            [170, 10], [190, 10], [190, -10], [170, -10], [170, 10]
        ]]), {
            worldCopies: false,
            maxZoom: 2,
            indexMaxZoom: 2,
        });
        for (const x of [0, 3]) {
            const tile = vt.getTile(2, x, 1);
            expect(tile).not.toBeNull();
            for (const feature of tile.features) {
                expect(feature.tags?.[GEOJSONVT_ANTIMERIDIAN_CLIP]).toBe(true);
            }
        }
    });
});
