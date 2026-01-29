
import {test, expect} from 'vitest';
import fs from 'fs';

import {geoJSONToTile} from '../src/geojsonvt';

const square = [{
    geometry: [[[4160, -64], [4160, 4160], [-64, 4160], [-64, -64], [4160, -64]]],
    type: 3,
    tags: {name: 'Pennsylvania', density: 284.3},
    id: '42'
}];

test('geoJSONToTile: converts all geometries to a single vector tile', () => {
    const geojson = getJSON('single-tile.json');
    const tile = geoJSONToTile(geojson, 12, 1171, 1566);

    expect(tile.features.length).toBe(1);
    expect(tile.features[0].tags.name).toBe('P Street Northwest - Massachusetts Avenue Northwest');
});

test('geoJSONToTile: clips geometries outside the tile', () => {
    const geojson = getJSON('us-states.json');

    const tile1 = geoJSONToTile(geojson, 7, 37, 48, {}, false, true);
    expect(tile1.features).toEqual(getJSON('us-states-z7-37-48.json'));

    const tile2 = geoJSONToTile(geojson, 9, 148, 192, {}, false, true);
    expect(tile2.features).toEqual(square);

    expect(geoJSONToTile(geojson, 11, 800, 400, {}, false, true)).toBeNull();
    expect(geoJSONToTile(geojson, -5, 123.25, 400.25, {}, false, true)).toBeNull();
    expect(geoJSONToTile(geojson, 25, 200, 200, {}, false, true)).toBeNull();
});

function getJSON(name: string) {
    return JSON.parse(fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf-8'));
}
