import {describe, expect, test} from 'vitest';
import {GeoJSONVT, geoJSONToTile} from '.';
import {transformTile} from './transform';
import type {GeoJSONToTileOptions} from './definitions';

const options: GeoJSONToTileOptions = {coordinates: 'unitSquare', wrap: false, extent: 8192, tolerance: 0};
const outer = [[100, 100], [900, 100], [900, 900], [100, 900], [100, 100]];
const hole = [[400, 400], [400, 600], [600, 600], [600, 400], [400, 400]];
// Signed area changes from -5 to +25 when these positions are rounded.
const thinHole = [[200.1, 200.1], [250.1, 200.4], [300.1, 200.6], [200.1, 200.1]];
const roundedThinHole = [[200, 200], [300, 201], [250, 200], [200, 200]];
const generators = [
    {name: 'GeoJSONVT.getTile', tile: (data: GeoJSON.GeoJSON, z: number, x: number, y: number) => new GeoJSONVT(data, options).getTile(z, x, y)},
    {name: 'geoJSONToTile', tile: (data: GeoJSON.GeoJSON, z: number, x: number, y: number) => geoJSONToTile(data, z, x, y, options)}
].flatMap(generator => [
    {...generator, z: 0, x: 0, y: 0},
    {...generator, z: 13, x: 4800, y: 3000}
]);

describe.each(generators)('$name at zoom $z preserves polygon winding during quantization', ({tile: generateTile, z, x, y}) => {
    const tile = (data: GeoJSON.GeoJSON) => generateTile(data, z, x, y);
    const unitSquare = (ring: number[][]) => ring.map(([px, py]) => [(x + px / 8192) / (1 << z), (y + py / 8192) / (1 << z)]);

    test('keeps a narrow hole distinct from its shell and subsequent holes', () => {
        const data: GeoJSON.Polygon = {type: 'Polygon', coordinates: [outer, thinHole, hole].map(unitSquare)};

        expect(tile(data).features[0].geometry).toEqual([outer, roundedThinHole, hole]);
    });

    test('preserves a narrow exterior ring whose winding would flip', () => {
        const data: GeoJSON.Polygon = {type: 'Polygon', coordinates: [unitSquare(thinHole.slice().reverse())]};

        expect(tile(data).features[0].geometry).toEqual([roundedThinHole.slice().reverse()]);
    });

    test('leaves ordinary exterior and interior rings unchanged', () => {
        const data: GeoJSON.Polygon = {type: 'Polygon', coordinates: [outer, hole].map(unitSquare)};

        expect(tile(data).features[0].geometry).toEqual([outer, hole]);
    });

    test('preserves shells and holes in separate parts of a MultiPolygon', () => {
        const shiftedOuter = outer.map(([x, y]) => [x + 2000, y]);
        const shiftedHole = hole.map(([x, y]) => [x + 2000, y]);
        const data: GeoJSON.MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [[outer, thinHole, hole].map(unitSquare), [shiftedOuter, shiftedHole].map(unitSquare)]
        };

        expect(tile(data).features[0].geometry).toEqual([outer, roundedThinHole, hole, shiftedOuter, shiftedHole]);
    });

    test('retains collapsed holes without changing other rings', () => {
        const collapsed = [[200.1, 200.1], [250.1, 200.2], [300.1, 200.1], [200.1, 200.1]];
        const data: GeoJSON.Polygon = {type: 'Polygon', coordinates: [outer, collapsed, hole].map(unitSquare)};

        expect(tile(data).features[0].geometry).toEqual([outer, [[200, 200], [250, 200], [300, 200], [200, 200]], hole]);
    });

    test('does not reverse line strings when rounding changes their signed area', () => {
        const data: GeoJSON.LineString = {type: 'LineString', coordinates: unitSquare(thinHole)};

        expect(tile(data).features[0].geometry).toEqual([[[200, 200], [250, 200], [300, 201], [200, 200]]]);
    });
});

test('transformTile retains empty polygon rings', () => {
    const tile = transformTile({
        transformed: false,
        source: null,
        x: 0, y: 0, z: 0,
        features: [{type: 3, tags: null, geometry: [[]]}]
    }, 8192);

    expect(tile.features[0].geometry).toEqual([[]]);
});
