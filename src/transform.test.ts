import {expect, test} from 'vitest';
import {GeoJSONVT} from '.';
import {transformTile} from './transform';

test('quantization preserves shell and hole winding without changing ordinary or collapsed rings', () => {
    const outer = [[100, 100], [900, 100], [900, 900], [100, 900], [100, 100]];
    const hole = [[400, 400], [400, 600], [600, 600], [600, 400], [400, 400]];
    // Signed area changes from -5 to +25 when these positions are rounded.
    const thinHole = [[200.1, 200.1], [250.1, 200.4], [300.1, 200.6], [200.1, 200.1]];
    const roundedThinHole = [[200, 200], [300, 201], [250, 200], [200, 200]];
    const collapsed = [[200.1, 300.1], [250.1, 300.2], [300.1, 300.1], [200.1, 300.1]];
    const thinShell = thinHole.slice().reverse().map(([x, y]) => [x + 2000, y]);
    const roundedThinShell = roundedThinHole.slice().reverse().map(([x, y]) => [x + 2000, y]);
    const unitSquare = (ring: number[][]) => ring.map(([x, y]) => [(4800 + x / 8192) / (1 << 13), (3000 + y / 8192) / (1 << 13)]);
    const data: GeoJSON.MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [[outer, thinHole, hole, collapsed].map(unitSquare), [unitSquare(thinShell)]]
    };
    const index = new GeoJSONVT(data, {coordinates: 'unitSquare', wrap: false, extent: 8192, tolerance: 0});

    expect(index.getTile(13, 4800, 3000).features[0].geometry).toEqual([
        outer, roundedThinHole, hole,
        [[200, 300], [250, 300], [300, 300], [200, 300]], roundedThinShell
    ]);
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
