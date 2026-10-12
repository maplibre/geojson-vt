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
test('worldCoordinates leaves out features east of the world instead of wrapping them around to the west', () => {
    const data = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'inside', geometry: {type: 'Point' as const, coordinates: [0.5, 0.5]}, properties: {}},
            {type: 'Feature' as const, id: 'east', geometry: {type: 'Point' as const, coordinates: [1.25, 0.5]}, properties: {}}
        ]
    };

    const index = new GeoJSONVT(data, {worldCoordinates: true});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['inside']);
});

test('worldCoordinates leaves out features north of the world instead of clamping them onto its top edge', () => {
    const data = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'inside', geometry: {type: 'Point' as const, coordinates: [0.5, 0.5]}, properties: {}},
            {type: 'Feature' as const, id: 'north', geometry: {type: 'Point' as const, coordinates: [0.5, -0.25]}, properties: {}}
        ]
    };

    const index = new GeoJSONVT(data, {worldCoordinates: true});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['inside']);
});

test('worldCoordinates cuts a line that leaves the world at its edge', () => {
    const line = {type: 'LineString' as const, coordinates: [[0.75, 0.5], [1.25, 0.5]]};

    const index = new GeoJSONVT(line, {worldCoordinates: true, buffer: 0});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.geometry)).toEqual([[[[3072, 2048], [4096, 2048]]]]);
});

test('worldCoordinates cuts a line from three worlds north where it crosses the top of the buffer', () => {
    const line = {type: 'LineString' as const, coordinates: [[0.25, -3], [0.75, 0.5]]};

    const index = new GeoJSONVT(line, {worldCoordinates: true});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.geometry)).toEqual([[[[2770, -64], [3072, 2048]]]]);
});

test('worldCoordinates keeps a feature outside the world, so an update can move it in', () => {
    const outside = {type: 'Feature' as const, id: 'p', geometry: {type: 'Point' as const, coordinates: [1.25, 0.5]}, properties: {name: 'p'}};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [outside]}, {worldCoordinates: true, updateable: true});

    index.updateData({update: [{id: 'p', newGeometry: {type: 'Point', coordinates: [0.5, 0.5]}}]});

    expect(index.getTile(0, 0, 0).features[0].tags).toEqual({name: 'p'});
});

test('worldCoordinates returns the data in world coordinates', () => {
    const point = {type: 'Feature' as const, id: 'p', geometry: {type: 'Point' as const, coordinates: [0.25, 0.75]}, properties: {}};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [point]}, {worldCoordinates: true, updateable: true});

    expect(index.getData()).toEqual({type: 'FeatureCollection', features: [point]});
});

test('worldCoordinates hands the update filter features in world coordinates', () => {
    const point = {type: 'Feature' as const, id: 'p', geometry: {type: 'Point' as const, coordinates: [0.25, 0.75]}, properties: {}};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [point]}, {worldCoordinates: true, updateable: true});
    const filtered: GeoJSON.Geometry[] = [];

    index.updateData({add: [{...point, id: 'q'}]}, feature => {
        filtered.push(feature.geometry);
        return true;
    });

    expect(filtered).toContainEqual({type: 'Point', coordinates: [0.25, 0.75]});
});

test('worldCoordinates leaves points outside the world out of the clusters', () => {
    const data = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'inside', geometry: {type: 'Point' as const, coordinates: [0.99, 0.5]}, properties: {}},
            {type: 'Feature' as const, id: 'outside', geometry: {type: 'Point' as const, coordinates: [1.03, 0.5]}, properties: {}}
        ]
    };

    const index = new GeoJSONVT(data, {worldCoordinates: true, cluster: true});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.geometry)).toEqual([[[507, 256]]]);
});

test('worldCoordinates keeps a point at one edge out of the clustered tile at the other edge', () => {
    const nearEastEdge = {type: 'Point' as const, coordinates: [0.999, 0.5]};

    const index = new GeoJSONVT(nearEastEdge, {worldCoordinates: true, cluster: true});

    expect(index.getTile(0, 0, 0).features).toHaveLength(1);
});

test('worldCoordinates returns cluster children and leaves in world coordinates', () => {
    const points = {
        type: 'FeatureCollection' as const,
        features: Array.from({length: 20}, (_, i) => ({
            type: 'Feature' as const,
            geometry: {type: 'Point' as const, coordinates: [0.5 + i * 0.000001, 0.5]},
            properties: {name: `Point ${i}`}
        }))
    };
    const index = new GeoJSONVT(points, {worldCoordinates: true, cluster: true, clusterOptions: {radius: 100}});
    const cluster = index.getTile(0, 0, 0).features.find(f => (f.tags as {cluster?: boolean})?.cluster);
    const clusterId = (cluster.tags as {cluster_id: number}).cluster_id;

    const childPositions = index.getClusterChildren(clusterId).map(child => (child.geometry as GeoJSON.Point).coordinates);
    const leafPositions = index.getClusterLeaves(clusterId, 20, 0).map(leaf => (leaf.geometry as GeoJSON.Point).coordinates);

    expect(childPositions.every(([x, y]) => Math.abs(x - 0.50001) < 0.00001 && y === 0.5)).toBe(true);
    expect(leafPositions).toEqual(expect.arrayContaining(points.features.map(point => point.geometry.coordinates)));
});

test('worldCoordinates returns no tile for a column outside the world', () => {
    const inTopLeftTile = {type: 'Point' as const, coordinates: [0.25, 0.25]};

    const index = new GeoJSONVT(inTopLeftTile, {worldCoordinates: true});

    expect(index.getTile(1, 2, 0)).toBeNull();
});

const weightedPoints = {
    type: 'FeatureCollection' as const,
    features: [[0, 1], [0.01, 2], [100, 10], [100.01, 20]].map(([lng, weight]) => ({
        type: 'Feature' as const,
        geometry: {type: 'Point' as const, coordinates: [lng, 0]},
        properties: {weight}
    }))
};

const sumWeights = {
    map: (props: GeoJSON.GeoJsonProperties) => ({sum: (props as {weight: number}).weight}),
    reduce: (a: Record<string, unknown>, b: Record<string, unknown>) => { (a as {sum: number}).sum += (b as {sum: number}).sum; }
};

test('updateClusterOptions aggregates cluster properties when it adds a reduce function', () => {
    const index = new GeoJSONVT(weightedPoints, {
        updateable: true,
        cluster: true,
        clusterOptions: {maxZoom: 2}
    });

    index.updateClusterOptions(true, {maxZoom: 2, ...sumWeights});

    expect(index.getTile(0, 0, 0).features.map(f => (f.tags as {sum?: number}).sum)).toEqual([3, 30]);
});

test('updateClusterOptions stops aggregating cluster properties when it removes the reduce function', () => {
    const index = new GeoJSONVT(weightedPoints, {
        updateable: true,
        cluster: true,
        clusterOptions: {maxZoom: 2, ...sumWeights}
    });

    index.updateClusterOptions(true, {maxZoom: 2});

    expect(index.getTile(0, 0, 0).features.map(f => (f.tags as {sum?: number}).sum)).toEqual([undefined, undefined]);
});
