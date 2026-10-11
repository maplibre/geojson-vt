import {test, expect} from 'vitest';
import {GeoJSONVT} from '.';

test('publicly exposed cluster methods: getClusterExpansionZoom, getClusterChildren, getClusterLeaves', () => {
    const points = {
        type: 'FeatureCollection' as const,
        features: Array.from({length: 20}, (_, i) => ({
            type: 'Feature' as const,
            geometry: {type: 'Point' as const, coordinates: [i * 0.0001, i * 0.0001]},
            properties: {name: `Point ${i}`}
        }))
    };

    const index = new GeoJSONVT(points, {
        updateable: true,
        cluster: true,
        clusterOptions: {radius: 100}
    });

    const tile = index.getTile(0, 0, 0);
    const cluster = tile.features.find(f => (f.tags as {cluster?: boolean})?.cluster);
    const clusterId = (cluster.tags as {cluster_id: number}).cluster_id;

    expect(index.getClusterExpansionZoom(clusterId)).toBeGreaterThan(0);
    expect(index.getClusterChildren(clusterId).length).toBeGreaterThan(0);
    expect(index.getClusterLeaves(clusterId, 5, 0).length).toBeLessThanOrEqual(5);
});

test('publicly exposed cluster methods: return undefined when clustering is disabled', () => {
    const index = new GeoJSONVT({type: 'FeatureCollection', features: []}, {
        updateable: true,
        cluster: false,
        clusterOptions: {radius: 100}
    });

    expect(index.getClusterExpansionZoom(123)).toBeNull();
    expect(index.getClusterChildren(123)).toBeNull();
    expect(index.getClusterLeaves(123, 10, 0)).toBeNull();
});
test('wrapWorld: false leaves out features east of the world instead of wrapping them around to the west', () => {
    const data = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'inside', geometry: {type: 'Point' as const, coordinates: [0, 0]}, properties: {}},
            {type: 'Feature' as const, id: 'east', geometry: {type: 'Point' as const, coordinates: [270, 0]}, properties: {}}
        ]
    };

    const index = new GeoJSONVT(data, {wrapWorld: false});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['inside']);
});

test('wrapWorld: false leaves out features north of the world instead of clamping them onto its top edge', () => {
    const data = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'inside', geometry: {type: 'Point' as const, coordinates: [0, 0]}, properties: {}},
            {type: 'Feature' as const, id: 'north', geometry: {type: 'Point' as const, coordinates: [0, 89]}, properties: {}}
        ]
    };

    const index = new GeoJSONVT(data, {wrapWorld: false});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['inside']);
});

test('wrapWorld: false cuts a line that leaves the world at its edge', () => {
    const line = {type: 'LineString' as const, coordinates: [[90, 0], [270, 0]]};

    const index = new GeoJSONVT(line, {wrapWorld: false, buffer: 0});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.geometry)).toEqual([[[[3072, 2048], [4096, 2048]]]]);
});

test('wrapWorld: false keeps a feature outside the world, so an update can move it in', () => {
    const outside = {type: 'Feature' as const, id: 'p', geometry: {type: 'Point' as const, coordinates: [270, 0]}, properties: {name: 'p'}};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [outside]}, {wrapWorld: false, updateable: true});

    index.updateData({update: [{id: 'p', newGeometry: {type: 'Point', coordinates: [0, 0]}}]});

    expect(index.getTile(0, 0, 0).features[0].tags).toEqual({name: 'p'});
});
