
import {test, expect} from 'vitest';
import fs from 'fs';

import {GeoJSONVT, type GeoJSONVTOptions, type GeoJSONVTInternalTileFeature } from '../src';

testTiles('us-states.json', 'us-states-tiles.json', {indexMaxZoom: 7, indexMaxPoints: 200});
testTiles('dateline.json', 'dateline-tiles.json', {indexMaxZoom: 0, indexMaxPoints: 10000});
testTiles('dateline.json', 'dateline-metrics-tiles.json', {indexMaxZoom: 0, indexMaxPoints: 10000, lineMetrics: true});
testTiles('feature.json', 'feature-tiles.json', {indexMaxZoom: 0, indexMaxPoints: 10000});
testTiles('collection.json', 'collection-tiles.json', {indexMaxZoom: 0, indexMaxPoints: 10000});
testTiles('single-geom.json', 'single-geom-tiles.json', {indexMaxZoom: 0, indexMaxPoints: 10000});
testTiles('ids.json', 'ids-promote-id-tiles.json', {indexMaxZoom: 0, promoteId: 'prop0'});
testTiles('ids.json', 'ids-generate-id-tiles.json', {indexMaxZoom: 0, generateId: true});

test('throws on invalid GeoJSON type', () => {
    expect(() => {
        genTiles({type: 'Pologon', coordinates:[[-0.26,51.45],[-0.26,51.45]]} as unknown as GeoJSON.GeoJSON);
    }).toThrow();
});

function testTiles(inputFile: string, expectedFile: string, options: GeoJSONVTOptions) {
    test(`full tiling test: ${  expectedFile.replace('-tiles.json', '')}`, () => {
        const tiles = genTiles(getJSON(inputFile), options);
        // fs.writeFileSync(path.join(__dirname, '/fixtures/' + expectedFile), JSON.stringify(tiles));
        expect(tiles).toEqual(getJSON(expectedFile));
    });
}

test('empty geojson', () => {
    expect({}).toEqual(genTiles(getJSON('empty.json')));
});

test('null geometry', () => {
    // should ignore features with null geometry
    expect({}).toEqual(genTiles(getJSON('feature-null-geometry.json')));
});

test('empty coordinates', () => {
    // should ignore features with empty coordinates
    expect({}).toEqual(genTiles(getJSON('empty-coords.json')));
});

function getJSON(name: string) {
    return JSON.parse(fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf-8'));
}

function genTiles(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    const index = new GeoJSONVT(data, Object.assign({
        indexMaxZoom: 0,
        indexMaxPoints: 10000
    }, options));

    const output: Record<string, GeoJSONVTInternalTileFeature[]> = {};

    for (const id in index.tiles) {
        const tile = index.tiles[id];
        const z = tile.z;
        output[`z${z}-${tile.x}-${tile.y}`] = index.getTile(z, tile.x, tile.y).features;
    }

    return output;
}
