import {test, expect} from 'vitest';
import {GeoJSONVT, type ClusterProperties } from '../src';

test('updateData: requires updateable option set to true', () => {
    const index = new GeoJSONVT({
        type: 'FeatureCollection' as const,
        features: []
    }, {updateable: false});

    expect(() => {
        index.updateData({add: [], remove: []});
    }).toThrow();
});

test('updateData: adds new features', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'feature1',
                geometry: {type: 'Point' as const, coordinates: [0, 0]},
                properties: {name: 'Feature 1'}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {updateable: true});

    const newFeature = {
        type: 'Feature' as const,
        id: 'feature2',
        geometry: {type: 'Point' as const, coordinates: [10, 10]},
        properties: {name: 'Feature 2'}
    };

    index.updateData({add: [newFeature]});

    const tile = index.getTile(0, 0, 0);
    expect(tile.features.length).toBe(2);
});

test('updateData: removes features by id', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'feature1',
                geometry: {type: 'Point' as const, coordinates: [0, 0]},
                properties: {name: 'Feature 1'}
            },
            {
                type: 'Feature' as const,
                id: 'feature2',
                geometry: {type: 'Point' as const, coordinates: [10, 10]},
                properties: {name: 'Feature 2'}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {updateable: true});

    index.updateData({remove: ['feature1']});

    const tile = index.getTile(0, 0, 0);
    expect(tile.features.length).toBe(1);
});

test('updateData: replaces features with duplicate ids', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'feature1',
                geometry: {type: 'Point' as const, coordinates: [0, 0]},
                properties: {name: 'Original'}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {updateable: true});

    const updatedFeature = {
        type: 'Feature' as const,
        id: 'feature1',
        geometry: {type: 'Point' as const, coordinates: [5, 5]},
        properties: {name: 'Updated'}
    };

    index.updateData({add: [updatedFeature]});

    const tile = index.getTile(0, 0, 0);
    expect(tile.features.length).toBe(1);
    expect(tile.features[0].id).toBe('feature1');
    expect(tile.features[0].tags.name).toBe('Updated');
});

test('updateData: handles both add and remove in same call', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'feature1',
                geometry: {type: 'Point' as const, coordinates: [0, 0]},
                properties: {name: 'Feature 1'}
            },
            {
                type: 'Feature' as const,
                id: 'feature2',
                geometry: {type: 'Point' as const, coordinates: [10, 10]},
                properties: {name: 'Feature 2'}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {updateable: true});

    const newFeature = {
        type: 'Feature' as const,
        id: 'feature3',
        geometry: {type: 'Point' as const, coordinates: [20, 20]},
        properties: {name: 'Feature 3'}
    };

    index.updateData({
        remove: ['feature1'],
        add: [newFeature]
    });

    const tile = index.getTile(0, 0, 0);
    expect(tile.features.length).toBe(2);

    const featureIds = tile.features.map(f => f.id).sort();
    expect(featureIds).toEqual(['feature2', 'feature3']);
});

test('updateData: works with empty diff', () => {
    const index = new GeoJSONVT({
        type: 'FeatureCollection',
        features: []
    }, {updateable: true});

    expect(() => {
        index.updateData({});
        index.updateData({add: [], remove: []});
    }).not.toThrow();
});

test('updateData: invalidates tiles at deeper zoom', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [{
            type: 'Feature' as const,
            id: 'feature1',
            geometry: {
                type: 'Polygon' as const,
                coordinates: [[
                    [0, 0], [5, 0], [5, 5], [0, 5], [0, 0]
                ]]
            },
            properties: {name: 'Original'}
        }]
    };

    const index = new GeoJSONVT(initialData, {
        updateable: true,
        indexMaxZoom: 5,
        indexMaxPoints: 0
    });

    const tileId = toID(5, 16, 16);

    const tileBefore = index.tiles[tileId];
    expect(tileBefore).toBeTruthy();
    expect(tileBefore.numFeatures).toBe(1);

    const updatedFeature = {
        type: 'Feature' as const,
        id: 'feature1',
        geometry: {
            type: 'Polygon' as const,
            coordinates: [[
                [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
            ]]
        },
        properties: {name: 'Updated'}
    };

    index.updateData({add: [updatedFeature]});

    const tileAfter = index.tiles[tileId];
    expect(tileAfter).toBeUndefined();

    const tileRegenerated = index.getTile(5, 16, 16);
    expect(tileRegenerated).toBeTruthy();
    expect(tileRegenerated.features[0].tags.name).toBe('Updated');
});

test('updateData: invalidates tiles with partial intersection', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'far-east',
                geometry: {
                    type: 'Point' as const,
                    coordinates: [179.99, 0]  // far east
                },
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {
        updateable: true,
        indexMaxZoom: 2,
        indexMaxPoints: 0
    });

    const edgeFeature = {
        type: 'Feature' as const,
        id: 'edge-line',
        geometry: {
            type: 'LineString' as const,
            coordinates: [[0, -1], [180, 1]]
        },
        properties: {}
    };

    index.updateData({add: [edgeFeature]});

    const tile = index.getTile(2, 3, 2);
    expect(tile).toBeTruthy();
    expect(tile.features.length).toBe(2);
});

test('updateData: invalidates empty tiles', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'nw-only',
                geometry: {
                    type: 'Point' as const,
                    coordinates: [-90, 45]  // top left quadrant only
                },
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {
        updateable: true,
        indexMaxZoom: 1,
        indexMaxPoints: 0,
        debug: 2
    });
    expect(index.stats.z1).toBe(4);

    const globalFeature = {
        type: 'Feature' as const,
        id: 'global',
        geometry: {
            type: 'LineString' as const,
            coordinates: [[-180, -85], [180, 85]]  // spans whole world
        },
        properties: {}
    };

    index.updateData({add: [globalFeature]});
    expect(index.stats.z1).toBe(0);
});

test('updateData: does not invalidate unaffected tiles', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'northwest',
                geometry: {
                    type: 'Point' as const,
                    coordinates: [-90, 45]  // NW quadrant only
                },
                properties: {}
            },
            {
                type: 'Feature' as const,
                id: 'southeast',
                geometry: {
                    type: 'Point' as const,
                    coordinates: [90, -45]  // SE quadrant only
                },
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {
        updateable: true,
        indexMaxZoom: 2,
        indexMaxPoints: 0
    });

    const nwTileId = toID(1, 0, 0);
    const seTileId = toID(1, 1, 1);

    const nwTileBefore = index.tiles[nwTileId];
    const seTileBefore = index.tiles[seTileId];

    expect(nwTileBefore).toBeTruthy();
    expect(seTileBefore).toBeTruthy();

    const updatedFeature = {
        type: 'Feature' as const,
        id: 'northwest',
        geometry: {
            type: 'Point' as const,
            coordinates: [-85, 40]  // NW different coordinate
        },
        properties: {}
    };

    index.updateData({add: [updatedFeature]});

    const nwTileAfter = index.tiles[nwTileId];
    expect(nwTileAfter).toBeUndefined();

    const seTileAfter = index.tiles[seTileId];
    expect(seTileAfter).toBe(seTileBefore);
});

test('updateData: invalidates and regenerates tiles at multiple zoom levels', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'feature1',
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [[
                        [0, 0],
                        [5, 0],
                        [5, 5],
                        [0, 5],
                        [0, 0]
                    ]]
                },
                properties: {name: 'Original'}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {
        updateable: true,
        indexMaxZoom: 7,
        indexMaxPoints: 0
    });

    const updatedFeature = {
        type: 'Feature' as const,
        id: 'feature1',
        geometry: {
            type: 'Polygon' as const,
            coordinates: [[
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0]
            ]]
        },
        properties: {name: 'Updated'}
    };

    index.updateData({add: [updatedFeature]});

    const newZ3Tile = index.getTile(3, 4, 4);
    const newZ5Tile = index.getTile(5, 16, 16);
    const newZ7Tile = index.getTile(7, 64, 64);

    expect(newZ3Tile).toBeTruthy();
    expect(newZ5Tile).toBeTruthy();
    expect(newZ7Tile).toBeTruthy();

    expect(newZ3Tile.features[0].id).toBe('feature1');
    expect(newZ3Tile.features[0].tags.name).toBe('Updated');

    expect(newZ5Tile.features[0].id).toBe('feature1');
    expect(newZ5Tile.features[0].tags.name).toBe('Updated');

    expect(newZ7Tile.features[0].id).toBe('feature1');
    expect(newZ7Tile.features[0].tags.name).toBe('Updated');
});

test('updateData: invalidates tiles when feature is within the buffer edge', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [{
            type: 'Feature' as const,
            id: 'feature1',
            geometry: {
                type: 'Point' as const,
                coordinates: [-45, 45] // inside tile 1-0-0
            },
            properties: {}
        }]
    };

    const index = new GeoJSONVT(initialData, {
        updateable: true,
        indexMaxZoom: 1,
        indexMaxPoints: 0
    });

    const tileId = toID(1, 0, 0);
    index.getTile(1, 0, 0);
    expect(index.tiles[tileId]).toBeTruthy();

    const featureWithinBuffer = {
        type: 'Feature' as const,
        id: 'buffer-feature',
        geometry: {
            type: 'Point' as const,
            coordinates: [2, 0] // feature within tile buffer edge
        },
        properties: {}
    };

    index.updateData({add: [featureWithinBuffer]});
    expect(index.tiles[tileId]).toBeUndefined();
});

test('updateData: handles drill-down after update', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'line1',
                geometry: {
                    type: 'LineString' as const,
                    coordinates: [[0, 0], [5, 5]]
                },
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {
        updateable: true,
        indexMaxZoom: 5
    });

    const newFeature = {
        type: 'Feature' as const,
        id: 'line2',
        geometry: {
            type: 'LineString' as const,
            coordinates: [[0, 0], [6, 6]]
        },
        properties: {}
    };

    index.updateData({add: [newFeature]});

    const highZoomTile = index.getTile(8, 128, 128);
    expect(highZoomTile).toBeTruthy();

    const featureIds = highZoomTile.features.map(f => f.id).sort();
    expect(featureIds).toEqual(['line1', 'line2']);
});

test('updateData: filter keeps all features when predicate matches all', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'small', geometry: {type: 'Point' as const, coordinates: [0, 0]}, properties: {population: 100}},
            {type: 'Feature' as const, id: 'large', geometry: {type: 'Point' as const, coordinates: [10, 10]}, properties: {population: 2000}},
            {type: 'Feature' as const, id: 'medium', geometry: {type: 'Point' as const, coordinates: [20, 20]}, properties: {population: 500}}
        ]
    };

    const index = new GeoJSONVT(initialData, {updateable: true});
    expect(index.getTile(0, 0, 0).features.length).toBe(3);

    index.updateData({}, feature => feature.geometry.type === 'Point');
    expect(index.getTile(0, 0, 0).features.length).toBe(3);

    index.updateData({}, feature => feature.properties.population > 1);
    expect(index.getTile(0, 0, 0).features.length).toBe(3);
});

test('updateData: filter removes features not matching predicate', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'small', geometry: {type: 'Point' as const, coordinates: [0, 0]}, properties: {population: 100}},
            {type: 'Feature' as const, id: 'large', geometry: {type: 'Point' as const, coordinates: [10, 10]}, properties: {population: 2000}},
            {type: 'Feature' as const, id: 'medium', geometry: {type: 'Point' as const, coordinates: [20, 20]}, properties: {population: 500}}
        ]
    };

    const index = new GeoJSONVT(initialData, {updateable: true});

    index.updateData({}, feature => feature.properties.population > 500);
    expect(index.getTile(0, 0, 0).features.length).toBe(1);
    expect(index.getTile(0, 0, 0).features[0].id).toBe('large');
});

test('updateData: filter removes all features when none match predicate', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {type: 'Feature' as const, id: 'small', geometry: {type: 'Point' as const, coordinates: [0, 0]}, properties: {population: 100}},
            {type: 'Feature' as const, id: 'large', geometry: {type: 'Point' as const, coordinates: [10, 10]}, properties: {population: 2000}},
            {type: 'Feature' as const, id: 'medium', geometry: {type: 'Point' as const, coordinates: [20, 20]}, properties: {population: 500}}
        ]
    };

    const index = new GeoJSONVT(initialData, {updateable: true});

    index.updateData({}, feature => feature.properties.population < 100);
    expect(index.getTile(0, 0, 0).features.length).toBe(0);
});

test('getData: returns source data when updateable', () => {
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            id: 'point1',
            geometry: {type: 'Point', coordinates: [0, 0]},
            properties: {name: 'Test'}
        }]
    };

    const updateable = new GeoJSONVT(geojson, {updateable: true});
    const result = updateable.getData() as GeoJSON.FeatureCollection;

    expect(result.type).toBe('FeatureCollection');
    expect(result.features.length).toBe(1);
    expect(result.features[0].id).toBe('point1');

    const notUpdateable = new GeoJSONVT(geojson, {updateable: false});
    expect(() => notUpdateable.getData()).toThrow();
});


test('cluster option: initializes supercluster instead of tiling', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'point1',
                geometry: {type: 'Point' as const, coordinates: [0, 0]},
                properties: {name: 'Point 1'}
            },
            {
                type: 'Feature' as const,
                id: 'point2',
                geometry: {type: 'Point' as const, coordinates: [0.001, 0.001]},
                properties: {name: 'Point 2'}
            },
            {
                type: 'Feature' as const,
                id: 'point3',
                geometry: {type: 'Point' as const, coordinates: [100, 50]},
                properties: {name: 'Point 3'}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {cluster: true});

    const tile = index.getTile(0, 0, 0);
    expect(tile).toBeTruthy();
    expect(tile.features.length).toBeGreaterThan(0);
});

test('cluster option: updateData rebuilds supercluster', () => {
    const initialData = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'point1',
                geometry: {type: 'Point' as const, coordinates: [0, 0]},
                properties: {name: 'Point 1'}
            }
        ]
    };

    const index = new GeoJSONVT(initialData, {cluster: true, updateable: true});

    let tile = index.getTile(0, 0, 0);
    expect(tile).toBeTruthy();
    expect(tile.features.length).toBe(1);

    const newFeature = {
        type: 'Feature' as const,
        id: 'point2',
        geometry: {type: 'Point' as const, coordinates: [100, 50]},
        properties: {name: 'Point 2'}
    };
    index.updateData({add: [newFeature]});

    tile = index.getTile(0, 0, 0);
    expect(tile).toBeTruthy();
    expect(tile.features.length).toBe(2);

    index.updateData({remove: ['point1']});

    tile = index.getTile(0, 0, 0);
    expect(tile).toBeTruthy();
    expect(tile.features.length).toBe(1);
});

test('updateClusterOptions: rebuilds supercluster with new options', () => {
    const closePoints = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: 'point1',
                geometry: {type: 'Point' as const, coordinates: [0, 0]},
                properties: {}
            },
            {
                type: 'Feature' as const,
                id: 'point2',
                geometry: {type: 'Point' as const, coordinates: [0.5, 0.5]},
                properties: {}
            },
            {
                type: 'Feature' as const,
                id: 'point3',
                geometry: {type: 'Point' as const, coordinates: [1, 1]},
                properties: {}
            }
        ]
    };

    const index = new GeoJSONVT(closePoints, {
        updateable: true,
        cluster: true,
        clusterOptions: {radius: 200}
    });

    let tile = index.getTile(0, 0, 0);
    expect(tile).toBeTruthy();
    const closeCount = tile.features.length;

    // Update with a much smaller radius - should produce more features (less clustering)
    index.updateClusterOptions(true, {radius: 1});

    tile = index.getTile(0, 0, 0);
    expect(tile).toBeTruthy();
    expect(tile.features.length).toBeGreaterThan(closeCount);
});

test('updateClusterOptions: can toggle clustering from on to off', () => {
    const points = {
        type: 'FeatureCollection' as const,
        features: Array.from({length: 20}, (_, i) => ({
            type: 'Feature' as const,
            geometry: {type: 'Point' as const, coordinates: [i * 0.0001, i * 0.0001]},
            properties: {}
        }))
    };

    const index = new GeoJSONVT(points, {
        updateable: true,
        cluster: true,
        clusterOptions: {radius: 100}
    });
    const tile = index.getTile(0, 0, 0);
    const clusterId = (tile.features.find(f => (f.tags as ClusterProperties)?.cluster).tags as ClusterProperties).cluster_id;
    index.updateClusterOptions(false, {radius: 100});

    expect(index.getClusterExpansionZoom(clusterId)).toBeNull();
    expect(index.getTile(0, 0, 0).features.some(f => (f.tags as ClusterProperties)?.cluster)).toBe(false);
});

test('updateClusterOptions: can toggle clustering from on to off and then back on', () => {
    const points = {
        type: 'FeatureCollection' as const,
        features: Array.from({length: 20}, (_, i) => ({
            type: 'Feature' as const,
            geometry: {type: 'Point' as const, coordinates: [i * 0.0001, i * 0.0001]},
            properties: {}
        }))
    };

    const index = new GeoJSONVT(points, {
        updateable: true,
        cluster: true,
        clusterOptions: {radius: 100}
    });
    index.updateClusterOptions(false, {radius: 100});
    index.updateClusterOptions(true, {radius: 100});
    const tile = index.getTile(0, 0, 0);
    const clusterId = (tile.features.find(f => (f.tags as ClusterProperties)?.cluster).tags as ClusterProperties).cluster_id;

    expect(index.getClusterExpansionZoom(clusterId)).toBeGreaterThan(0);
    expect(index.getTile(0, 0, 0).features.some(f => (f.tags as ClusterProperties)?.cluster)).toBe(true);
});

function toID(z: number, x: number, y: number): number {
    return (((1 << z) * y + x) * 32) + z;
}
