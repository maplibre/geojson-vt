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

test('worldCoordinates cuts a line at the buffer around the world instead of wrapping or clamping it', () => {
    const fromThreeWorldsNorthToEast = {type: 'LineString' as const, coordinates: [[0.25, -3], [0.75, 0.5], [1.25, 0.5]]};

    const index = new GeoJSONVT(fromThreeWorldsNorthToEast, {worldCoordinates: true});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.geometry)).toEqual([[[[2770, -64], [3072, 2048], [4160, 2048]]]]);
});

test('worldCoordinates cuts the top tile at the world again on update, so a feature can move in from outside', () => {
    const movingIn = {type: 'Feature' as const, id: 'moving in', geometry: {type: 'Point' as const, coordinates: [1.25, 0.5]}, properties: {}};
    const stayingOut = {type: 'Feature' as const, id: 'staying out', geometry: {type: 'Point' as const, coordinates: [1.5, 0.5]}, properties: {}};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [movingIn, stayingOut]}, {worldCoordinates: true, updateable: true});

    index.updateData({update: [{id: 'moving in', newGeometry: {type: 'Point', coordinates: [0.5, 0.5]}}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['moving in']);
});

test('worldCoordinates returns the data in world coordinates', () => {
    const features: GeoJSON.Feature[] = [
        {type: 'Feature', id: 'point', geometry: {type: 'Point', coordinates: [0.25, 0.75]}, properties: {}},
        {type: 'Feature', id: 'multi point', geometry: {type: 'MultiPoint', coordinates: [[0.25, 0.75], [0.5, 0.5]]}, properties: {}},
        {type: 'Feature', id: 'line', geometry: {type: 'LineString', coordinates: [[0.25, 0.75], [0.5, 0.5]]}, properties: {}},
        {type: 'Feature', id: 'multi line', geometry: {type: 'MultiLineString', coordinates: [[[0.25, 0.75], [0.5, 0.5]], [[0.5, 0.25], [0.75, 0.25]]]}, properties: {}},
        {type: 'Feature', id: 'polygon', geometry: {type: 'Polygon', coordinates: [[[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.25]]]}, properties: {}},
        {type: 'Feature', id: 'multi polygon', geometry: {type: 'MultiPolygon', coordinates: [[[[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.25]]]]}, properties: {}}
    ];
    const index = new GeoJSONVT({type: 'FeatureCollection', features}, {worldCoordinates: true, updateable: true});

    expect(index.getData()).toEqual({type: 'FeatureCollection', features});
});

test('worldCoordinates keeps a MultiLineString it splits for lineMetrics in world coordinates', () => {
    const multiLine = {type: 'MultiLineString' as const, coordinates: [[[0.25, 0.75], [0.5, 0.5]], [[0.5, 0.25], [0.75, 0.25]]]};
    const index = new GeoJSONVT(multiLine, {worldCoordinates: true, lineMetrics: true, updateable: true});

    expect(index.getData()).toEqual({type: 'FeatureCollection', features: [
        {type: 'Feature', geometry: {type: 'LineString', coordinates: [[0.25, 0.75], [0.5, 0.5]]}},
        {type: 'Feature', geometry: {type: 'LineString', coordinates: [[0.5, 0.25], [0.75, 0.25]]}}
    ]});
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
            {type: 'Feature' as const, id: 'east', geometry: {type: 'Point' as const, coordinates: [1.03, 0.5]}, properties: {}},
            {type: 'Feature' as const, id: 'north', geometry: {type: 'Point' as const, coordinates: [0.5, -0.03]}, properties: {}}
        ]
    };

    const index = new GeoJSONVT(data, {worldCoordinates: true, cluster: true});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.geometry)).toEqual([[[507, 256]]]);
});

test('worldCoordinates keeps points at either edge out of the clustered tile at the other edge', () => {
    const data = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'west', geometry: {type: 'Point' as const, coordinates: [0.001, 0.5]}, properties: {}},
            {type: 'Feature' as const, id: 'east', geometry: {type: 'Point' as const, coordinates: [0.999, 0.5]}, properties: {}}
        ]
    };

    const index = new GeoJSONVT(data, {worldCoordinates: true, cluster: true});

    expect(index.getTile(0, 0, 0).features).toHaveLength(2);
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

test('worldCoordinates returns no tile for a column on either side of the world', () => {
    const inTheTwoTopTiles = {type: 'MultiPoint' as const, coordinates: [[0.25, 0.25], [0.75, 0.25]]};

    const index = new GeoJSONVT(inTheTwoTopTiles, {worldCoordinates: true});

    expect([index.getTile(1, -1, 0), index.getTile(1, 2, 0)]).toEqual([null, null]);
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

test('skips an empty polygon of a MultiPolygon', () => {
    const multiPolygon = {
        type: 'MultiPolygon' as const,
        coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 0]]], []]
    };

    const index = new GeoJSONVT(multiPolygon, {maxZoom: 5});

    expect(index.getTile(0, 0, 0).features[0].geometry).toEqual([[[2048, 2048], [2162, 1934], [2162, 2048], [2048, 2048]]]);
});

test('leaves out a MultiPolygon that has only empty polygons', () => {
    const multiPolygon = {
        type: 'MultiPolygon' as const,
        coordinates: [[]] as GeoJSON.Position[][][]
    };

    const index = new GeoJSONVT(multiPolygon, {updateable: true});

    expect(index.getData()).toEqual({type: 'FeatureCollection', features: []});
});

test('updateData draws a feature again when an update gives back the coordinates an earlier one took away', () => {
    const line = {type: 'Feature' as const, id: 'line', properties: {name: 'line'}, geometry: {type: 'LineString' as const, coordinates: [[0, 0], [10, 10]]}};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [line]}, {updateable: true});

    index.updateData({update: [{id: 'line', newGeometry: {type: 'LineString', coordinates: []}}]});
    index.updateData({update: [{id: 'line', newGeometry: line.geometry}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.tags)).toEqual([{name: 'line'}]);
});

test('updateData draws a feature loaded without a geometry once an update gives it one', () => {
    const later: GeoJSON.Feature = {type: 'Feature', id: 'later', properties: {name: 'later'}, geometry: null};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [later]}, {updateable: true});

    index.updateData({update: [{id: 'later', newGeometry: {type: 'Point', coordinates: [10, 10]}}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.tags)).toEqual([{name: 'later'}]);
});

test('updateData draws a feature added without coordinates once an update gives it some', () => {
    const index = new GeoJSONVT({type: 'FeatureCollection', features: []}, {updateable: true});

    index.updateData({add: [{type: 'Feature', id: 'added', properties: {name: 'added'}, geometry: {type: 'Polygon', coordinates: []}}]});
    index.updateData({update: [{id: 'added', newGeometry: {type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]]}}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.tags)).toEqual([{name: 'added'}]);
});

test('updateData leaves a feature without a geometry removed when an update gives it one', () => {
    const kept = {type: 'Feature' as const, id: 'kept', properties: {}, geometry: {type: 'Point' as const, coordinates: [0, 0]}};
    const removed: GeoJSON.Feature = {type: 'Feature', id: 'removed', properties: {}, geometry: null};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [kept, removed]}, {updateable: true});

    index.updateData({remove: ['removed']});
    index.updateData({update: [{id: 'removed', newGeometry: {type: 'Point', coordinates: [10, 10]}}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['kept']);
});

test('updateData leaves a feature without a geometry removed by removeAll when an update gives it one', () => {
    const kept = {type: 'Feature' as const, id: 'kept', properties: {}, geometry: {type: 'Point' as const, coordinates: [0, 0]}};
    const removed: GeoJSON.Feature = {type: 'Feature', id: 'removed', properties: {}, geometry: null};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [removed]}, {updateable: true});

    index.updateData({removeAll: true, add: [kept]});
    index.updateData({update: [{id: 'removed', newGeometry: {type: 'Point', coordinates: [10, 10]}}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['kept']);
});

test('updateData keeps the property changes made to a feature while it has no geometry', () => {
    const renamed: GeoJSON.Feature = {type: 'Feature', id: 'renamed', properties: {name: 'before'}, geometry: null};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [renamed]}, {updateable: true});

    index.updateData({update: [{id: 'renamed', addOrUpdateProperties: [{key: 'name', value: 'after'}]}]});
    index.updateData({update: [{id: 'renamed', newGeometry: {type: 'Point', coordinates: [10, 10]}}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.tags)).toEqual([{name: 'after'}]);
});

test('updateData does not bring back a feature the update filter took out after an update gave it a geometry', () => {
    const kept = {type: 'Feature' as const, id: 'kept', properties: {}, geometry: {type: 'Point' as const, coordinates: [0, 0]}};
    const hidden: GeoJSON.Feature = {type: 'Feature', id: 'hidden', properties: {hidden: true}, geometry: null};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [kept, hidden]}, {updateable: true});

    index.updateData({update: [{id: 'hidden', newGeometry: {type: 'Point', coordinates: [10, 10]}}]}, feature => !feature.properties.hidden);
    index.updateData({update: [{id: 'hidden', newGeometry: {type: 'Point', coordinates: [20, 20]}}]});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.id)).toEqual(['kept']);
});

test('updateData does not bring back a feature the update filter took out while it had no coordinates', () => {
    const point = {type: 'Feature' as const, id: 'point', properties: {keep: true}, geometry: {type: 'Point' as const, coordinates: [0, 0]}};
    const index = new GeoJSONVT({type: 'FeatureCollection', features: [point]}, {updateable: true});
    const keepIfMarked = (feature: GeoJSON.Feature) => feature.properties?.keep === true;

    index.updateData({update: [{id: 'point', newGeometry: {type: 'Point', coordinates: []}, addOrUpdateProperties: [{key: 'keep', value: false}]}]}, keepIfMarked);
    index.updateData({update: [{id: 'point', newGeometry: {type: 'Point', coordinates: [10, 10]}, addOrUpdateProperties: [{key: 'keep', value: true}]}]}, keepIfMarked);

    expect(index.getData()).toEqual({type: 'FeatureCollection', features: []});
});

test('updateData draws a bare geometry loaded without coordinates once an update gives it some', () => {
    const index = new GeoJSONVT({type: 'LineString', coordinates: []}, {updateable: true, generateId: true});

    index.updateData({update: [{id: 0, newGeometry: {type: 'LineString', coordinates: [[0, 0], [10, 10]]}}]});

    expect(index.getTile(0, 0, 0)?.features.map(feature => feature.id)).toEqual([0]);
});

test('keeps the corner of a polygon whose vertex lies on the left edge of a tile', () => {
    const polygon = {
        type: 'Polygon' as const,
        coordinates: [[[-90, -90], [0, -90], [90, -90], [0, 0], [-90, -90]]]
    };

    const index = new GeoJSONVT(polygon, {indexMaxZoom: 0, maxZoom: 24, tolerance: 1.5, buffer: 0});

    expect(index.getTile(1, 1, 1).features[0].geometry).toEqual([[[0, 4096], [0, 0], [0, 0], [2048, 4096], [0, 4096]]]);
});

test('keeps the corner of a polygon whose vertex lies on the right edge of a tile', () => {
    const polygon = {
        type: 'Polygon' as const,
        coordinates: [[[20, 34.365234375], [80, 4.34326171875], [45, 4.34326171875], [20, 4.34326171875], [20, 34.365234375]]]
    };

    const index = new GeoJSONVT(polygon, {maxZoom: 5, buffer: 0});

    expect(index.getTile(3, 4, 3).features[0].geometry).toEqual([[[1820, 762], [4096, 1986], [4096, 3700], [1820, 3700], [1820, 762]]]);
});

test('keeps the part of a line that enters a tile exactly at a vertex', () => {
    const line = {
        type: 'LineString' as const,
        coordinates: [[-90, 20], [0, 20], [90, 20]]
    };

    const index = new GeoJSONVT(line, {lineMetrics: true, buffer: 0});

    const feature = index.getTile(1, 1, 0).features[0];
    expect(feature.geometry).toEqual([[[0, 3631], [2048, 3631]]]);
    expect(feature.tags).toEqual({geojsonvt_clip_start: 0.5, geojsonvt_clip_end: 1});
});

test('clusters each position of a MultiPoint feature when clustering is on', () => {
    const multiPoint = {
        type: 'Feature' as const,
        id: 7,
        properties: {name: 'multi'},
        geometry: {type: 'MultiPoint' as const, coordinates: [[20, 20], [20.0001, 20], [60, 20]]}
    };

    const index = new GeoJSONVT(multiPoint, {cluster: true});

    expect(index.getTile(0, 0, 0).features).toEqual([
        {type: 1, geometry: [[284, 227]], tags: {cluster: true, cluster_id: 20, point_count: 2, point_count_abbreviated: 2}, id: 20},
        {type: 1, geometry: [[341, 227]], tags: {name: 'multi'}, id: 7}
    ]);
});

test('worldCoordinates leaves the positions of a MultiPoint outside the world out of the clusters', () => {
    const multiPoint = {
        type: 'Feature' as const,
        properties: {},
        geometry: {type: 'MultiPoint' as const, coordinates: [[0.99, 0.5], [1.03, 0.5], [0.5, -0.03]]}
    };

    const index = new GeoJSONVT(multiPoint, {worldCoordinates: true, cluster: true});

    expect(index.getTile(0, 0, 0).features.map(feature => feature.geometry)).toEqual([[[507, 256]]]);
});
