import {test, expect} from 'vitest';
import geojsonvt, {type GeoJSONVTTile} from '../src';

test('updateData: requires updateable option', () => {
    const index = geojsonvt({
        type: 'FeatureCollection' as const,
        features: []
    });

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

    const index = geojsonvt(initialData, {updateable: true});

    const newFeature = {
        type: 'Feature' as const,
        id: 'feature2',
        geometry: {type: 'Point' as const, coordinates: [10, 10]},
        properties: {name: 'Feature 2'}
    };

    index.updateData({add: [newFeature]});

    const tile = index.getTile(0, 0, 0) as GeoJSONVTTile;
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

    const index = geojsonvt(initialData, {updateable: true});

    index.updateData({remove: ['feature1']});

    const tile = index.getTile(0, 0, 0) as GeoJSONVTTile;
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

    const index = geojsonvt(initialData, {updateable: true});

    const updatedFeature = {
        type: 'Feature' as const,
        id: 'feature1',
        geometry: {type: 'Point' as const, coordinates: [5, 5]},
        properties: {name: 'Updated'}
    };

    index.updateData({add: [updatedFeature]});

    const tile = index.getTile(0, 0, 0) as GeoJSONVTTile;
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

    const index = geojsonvt(initialData, {updateable: true});

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

    const tile = index.getTile(0, 0, 0) as GeoJSONVTTile;
    expect(tile.features.length).toBe(2);

    const featureIds = tile.features.map(f => f.id).sort();
    expect(featureIds).toEqual(['feature2', 'feature3']);
});

test('updateData: works with empty diff', () => {
    const index = geojsonvt({
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

    const index = geojsonvt(initialData, {
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

    const tileRegenerated = index.getTile(5, 16, 16) as GeoJSONVTTile;
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

    const index = geojsonvt(initialData, {
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

    const tile = index.getTile(2, 3, 2) as GeoJSONVTTile;
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

    const index = geojsonvt(initialData, {
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

    const index = geojsonvt(initialData, {
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

    const index = geojsonvt(initialData, {
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

    const newZ3Tile = index.getTile(3, 4, 4) as GeoJSONVTTile;
    const newZ5Tile = index.getTile(5, 16, 16) as GeoJSONVTTile;
    const newZ7Tile = index.getTile(7, 64, 64) as GeoJSONVTTile;

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

    const index = geojsonvt(initialData, {
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

    const index = geojsonvt(initialData, {
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

    const highZoomTile = index.getTile(8, 128, 128) as GeoJSONVTTile;
    expect(highZoomTile).toBeTruthy();

    const featureIds = highZoomTile.features.map(f => f.id).sort();
    expect(featureIds).toEqual(['line1', 'line2']);
});

function toID(z: number, x: number, y: number): number {
    return (((1 << z) * y + x) * 32) + z;
}
