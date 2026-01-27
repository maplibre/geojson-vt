import {test, expect} from 'vitest';
import {readFileSync} from 'fs';
import {Supercluster} from './supercluster';
import type {ClusterProperties} from './supercluster';
import type {GeoJSONVTTile} from './transform';

const places = JSON.parse(readFileSync(new URL('../test/fixtures/places.json', import.meta.url), 'utf-8')) as GeoJSON.FeatureCollection<GeoJSON.Point>;
const placesTile = JSON.parse(readFileSync(new URL('../test/fixtures/places-z0-0-0.json', import.meta.url), 'utf-8')) as GeoJSONVTTile;
const placesTileMin5 = JSON.parse(readFileSync(new URL('../test/fixtures/places-z0-0-0-min5.json', import.meta.url), 'utf-8')) as GeoJSONVTTile;

test('generates clusters properly', () => {
    const index = new Supercluster().load(places.features);
    const tile = index.getTile(0, 0, 0);
    expect(tile?.features).toEqual(placesTile.features);
});

test('supports minPoints option', () => {
    const index = new Supercluster({minPoints: 5}).load(places.features);
    const tile = index.getTile(0, 0, 0);
    expect(tile?.features).toEqual(placesTileMin5.features);
});

test('returns children of a cluster', () => {
    const index = new Supercluster().load(places.features);
    const childCounts = index.getChildren(164).map(p => (p.properties as ClusterProperties)?.point_count || 1);
    expect(childCounts).toEqual([6, 7, 2, 1]);
});

test('returns leaves of a cluster', () => {
    const index = new Supercluster().load(places.features);
    const leafNames = index.getLeaves(164, 10, 5).map(p => (p.properties as {name: string} | null)?.name);
    expect(leafNames).toEqual([
        'Niagara Falls',
        'Cape San Blas',
        'Cape Sable',
        'Cape Canaveral',
        'San  Salvador',
        'Cabo Gracias a Dios',
        'I. de Cozumel',
        'Grand Cayman',
        'Miquelon',
        'Cape Bauld'
    ]);
});

test('generates unique ids with generateId option', () => {
    const index = new Supercluster({generateId: true}).load(places.features);
    const tile = index.getTile(0, 0, 0)!;
    const ids = tile.features.filter(f => !(f.tags as ClusterProperties)?.cluster).map(f => f.id);
    expect(ids).toEqual([12, 20, 21, 22, 24, 28, 30, 62, 81, 118, 119, 125, 81, 118]);
});

test('getLeaves handles null-property features', () => {
    const index = new Supercluster().load(places.features.concat([{
        type: 'Feature',
        properties: null,
        geometry: {
            type: 'Point',
            coordinates: [-79.04411780507252, 43.08771393436908]
        }
    }]));
    const leaves = index.getLeaves(165, 1, 6);
    expect(leaves[0].properties).toBe(null);
});

test('returns cluster expansion zoom', () => {
    const index = new Supercluster().load(places.features);
    expect(index.getClusterExpansionZoom(164)).toBe(1);
    expect(index.getClusterExpansionZoom(196)).toBe(1);
    expect(index.getClusterExpansionZoom(581)).toBe(2);
    expect(index.getClusterExpansionZoom(1157)).toBe(2);
    expect(index.getClusterExpansionZoom(4134)).toBe(3);
});

test('returns cluster expansion zoom for maxZoom', () => {
    const index = new Supercluster({
        radius: 60,
        extent: 256,
        maxZoom: 4,
    }).load(places.features);

    expect(index.getClusterExpansionZoom(2504)).toBe(5);
});

test('aggregates cluster properties with reduce', () => {
    const index = new Supercluster({
        map: (props) => ({sum: (props as {scalerank: number})?.scalerank}),
        reduce: (a, b) => { (a as {sum: number}).sum += (b as {sum: number}).sum; },
        radius: 100
    }).load(places.features);

    expect(index.getTile(1, 0, 0)!.features.map(f => (f.tags as {sum?: number})?.sum).filter(Boolean)).toEqual(
        [146, 84, 63, 23, 34, 12, 19, 29, 8, 8, 80, 35]);
    expect(index.getTile(0, 0, 0)!.features.map(f => (f.tags as {sum?: number})?.sum).filter(Boolean)).toEqual(
        [298, 122, 12, 36, 98, 7, 24, 8, 125, 98, 125, 12, 36, 8]);
});

test('returns clusters when query crosses international dateline', () => {
    const index = new Supercluster().load([
        {
            type: 'Feature',
            properties: null,
            geometry: {
                type: 'Point',
                coordinates: [-178.989, 0]
            }
        }, {
            type: 'Feature',
            properties: null,
            geometry: {
                type: 'Point',
                coordinates: [-178.990, 0]
            }
        }, {
            type: 'Feature',
            properties: null,
            geometry: {
                type: 'Point',
                coordinates: [-178.991, 0]
            }
        }, {
            type: 'Feature',
            properties: null,
            geometry: {
                type: 'Point',
                coordinates: [-178.992, 0]
            }
        }
    ]);

    const nonCrossing = index.getClusters([-179, -10, -177, 10], 1);
    const crossing = index.getClusters([179, -10, -177, 10], 1);

    expect(nonCrossing.length).toBeGreaterThan(0);
    expect(crossing.length).toBeGreaterThan(0);
    expect(nonCrossing.length).toBe(crossing.length);
});

test('does not crash on weird bbox values', () => {
    const index = new Supercluster().load(places.features);
    expect(index.getClusters([129.426390, -103.720017, -445.930843, 114.518236], 1).length).toBe(26);
    expect(index.getClusters([112.207836, -84.578666, -463.149397, 120.169159], 1).length).toBe(27);
    expect(index.getClusters([129.886277, -82.332680, -445.470956, 120.390930], 1).length).toBe(26);
    expect(index.getClusters([458.220043, -84.239039, -117.137190, 120.206585], 1).length).toBe(25);
    expect(index.getClusters([456.713058, -80.354196, -118.644175, 120.539148], 1).length).toBe(25);
    expect(index.getClusters([453.105328, -75.857422, -122.251904, 120.732760], 1).length).toBe(25);
    expect(index.getClusters([-180, -90, 180, 90], 1).length).toBe(61);
});

test('does not crash on non-integer zoom values', () => {
    const index = new Supercluster().load(places.features);
    expect(index.getClusters([179, -10, -177, 10], 1.25)).toBeTruthy();
});

test('makes sure same-location points are clustered', () => {
    const index = new Supercluster({
        maxZoom: 20,
        extent: 8192,
        radius: 16
    }).load([
        {type: 'Feature', properties: null, geometry: {type: 'Point', coordinates: [-1.426798, 53.943034]}},
        {type: 'Feature', properties: null, geometry: {type: 'Point', coordinates: [-1.426798, 53.943034]}}
    ]);

    expect(index.trees[20].ids.length).toBe(1);
});

test('makes sure unclustered point coords are not rounded', () => {
    const index = new Supercluster({maxZoom: 19}).load([
        {type: 'Feature', properties: null, geometry: {type: 'Point', coordinates: [173.19150559062456, -41.340357424709275]}}
    ]);

    expect(index.getTile(20, 1028744, 656754)!.features[0].geometry[0]).toEqual([421, 281]);
});

test('does not throw on zero items', () => {
    expect(() => {
        const index = new Supercluster().load([]);
        expect(index.getClusters([-180, -85, 180, 85], 0)).toEqual([]);
    }).not.toThrow();
});
