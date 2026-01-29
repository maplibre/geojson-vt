
import {test, expect} from 'vitest';
import fs from 'fs';
import {geoJSONToTile} from '../src/geoJSONToTile';

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

test('geoJSONToTile: wrap features across the antimeridian', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {name: 'test'},
            geometry: {
                type: 'LineString',
                coordinates: [[-200, 0], [200, 0]]
            }
        }]
    };

    const tileWithoutWrap = geoJSONToTile(geojson, 0, 0, 0, {wrap: false, clip: true});
    expect(tileWithoutWrap.features).toEqual([{
        type: 2,
        tags: {name: 'test'},
        geometry: [[[-64, 2048], [4160, 2048]]]
    }]);

    const tileWithWrap = geoJSONToTile(geojson, 0, 0, 0, {wrap: true, clip: true});
    expect(tileWithWrap.features).toEqual([
        {type: 2, tags: {name: 'test'}, geometry: [[[3868, 2048], [4160, 2048]]]},
        {type: 2, tags: {name: 'test'}, geometry: [[[-64, 2048], [4160, 2048]]]},
        {type: 2, tags: {name: 'test'}, geometry: [[[-64, 2048], [228, 2048]]]}
    ]);
});

test('geoJSONToTile: shouldWrap duplicates features that extend beyond world bounds', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {name: 'test'},
            geometry: {
                type: 'LineString',
                coordinates: [[-200, 0], [-170, 0]]
            }
        }]
    };

    const tileWithoutWrap = geoJSONToTile(geojson, 0, 0, 0, {wrap: false, clip: false});
    expect(tileWithoutWrap.features).toEqual([{
        type: 2,
        tags: {name: 'test'},
        geometry: [[[-228, 2048], [114, 2048]]]
    }]);

    const tileWithWrap = geoJSONToTile(geojson, 0, 0, 0, {wrap: true, clip: false});
    expect(tileWithWrap.features).toEqual([
        {type: 2, tags: {name: 'test'}, geometry: [[[3868, 2048], [4160, 2048]]]},
        {type: 2, tags: {name: 'test'}, geometry: [[[-64, 2048], [114, 2048]]]}
    ]);
});

test('geoJSONToTile: clips geometries outside the tile', () => {
    const geojson = getJSON('us-states.json');

    const tile1 = geoJSONToTile(geojson, 7, 37, 48, {clip: true});
    expect(tile1.features).toEqual(getJSON('us-states-z7-37-48.json'));

    const tile2 = geoJSONToTile(geojson, 9, 148, 192, {clip: true});
    expect(tile2.features).toEqual(square);

    expect(geoJSONToTile(geojson, 11, 800, 400, {clip: true})).toBeNull();
    expect(geoJSONToTile(geojson, -5, 123.25, 400.25, {clip: true})).toBeNull();
    expect(geoJSONToTile(geojson, 25, 200, 200, {clip: true})).toBeNull();
});

function getJSON(name: string) {
    return JSON.parse(fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf-8'));
}
