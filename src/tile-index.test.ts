import {describe, expect, test} from "vitest";
import {TileIndex} from "./tile-index";
import {convertToInternal} from "./convert";
import {applySourceDiff} from "./difference";
import {wrap} from "./wrap";
import {defaultOptions} from "./geojsonvt";

function toID(z: number, x: number, y: number): number {
    return (((1 << z) * y + x) * 32) + z;
}

describe('TileIndex', () => {
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
        const options = {
            ...defaultOptions,
            updateable: true,
            indexMaxZoom: 1,
            indexMaxPoints: 0,
            debug: 2
        };
        const index = new TileIndex(options);
        let sourceFeatures = convertToInternal(initialData, options);
        sourceFeatures = wrap(sourceFeatures, options);
        index.initialize(sourceFeatures);
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
        const {source, affected} = applySourceDiff(sourceFeatures, {add: [globalFeature]}, options);
        index.updateIndex(source, affected, options);
        expect(index.stats.z1).toBe(0);
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
    
        const options = {
            ...defaultOptions,
            updateable: true,
            indexMaxZoom: 1,
            indexMaxPoints: 0
        };
        const index = new TileIndex(options);
        let sourceFeatures = convertToInternal(initialData, options);
        sourceFeatures = wrap(sourceFeatures, options);
        index.initialize(sourceFeatures);
    
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
        const {source, affected} = applySourceDiff(sourceFeatures, {add: [featureWithinBuffer]}, options);
        index.updateIndex(source, affected, options);
        expect(index.tiles[tileId]).toBeUndefined();
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
    
        const options = {
            ...defaultOptions,
            updateable: true,
            indexMaxZoom: 5,
            indexMaxPoints: 0
        };
        const index = new TileIndex(options);
        let sourceFeatures = convertToInternal(initialData, options);
        sourceFeatures = wrap(sourceFeatures, options);
        index.initialize(sourceFeatures);
    
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
    
        const {source, affected} = applySourceDiff(sourceFeatures, {add: [updatedFeature]}, options);
        index.updateIndex(source, affected, options);
    
        const tileAfter = index.tiles[tileId];
        expect(tileAfter).toBeUndefined();
    
        const tileRegenerated = index.getTile(5, 16, 16);
        expect(tileRegenerated).toBeTruthy();
        expect(tileRegenerated.features[0].tags.name).toBe('Updated');
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
    
        const options = {
            ...defaultOptions,
            updateable: true,
            indexMaxZoom: 2,
            indexMaxPoints: 0
        };
        const index = new TileIndex(options);
        let sourceFeatures = convertToInternal(initialData, options);
        sourceFeatures = wrap(sourceFeatures, options);
        index.initialize(sourceFeatures);
    
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
    

        const {source, affected} = applySourceDiff(sourceFeatures, {add: [updatedFeature]}, options);
        index.updateIndex(source, affected, options);
    
        const nwTileAfter = index.tiles[nwTileId];
        expect(nwTileAfter).toBeUndefined();
    
        const seTileAfter = index.tiles[seTileId];
        expect(seTileAfter).toBe(seTileBefore);
    });
});

describe('Multiworld test', () => {
    const leftPoint = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
            coordinates: [-540, 0],
            type: 'Point' as const
        }
    };

    const rightPoint = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
            coordinates: [540, 0],
            type: 'Point' as const
        }
    };

    test('handle point only in the rightside world', () => {
        const vt = new TileIndex(defaultOptions);
        let sourceFeatures = convertToInternal(rightPoint, defaultOptions);
        sourceFeatures = wrap(sourceFeatures, defaultOptions);
        vt.initialize(sourceFeatures);
        expect(vt.tiles[0].features[0].geometry[0]).toBe(1);
        expect(vt.tiles[0].features[0].geometry[1]).toBe(.5);
    });

    test('handle point only in the leftside world', () => {
        const vt = new TileIndex(defaultOptions);
        let sourceFeatures = convertToInternal(leftPoint, defaultOptions);
        sourceFeatures = wrap(sourceFeatures, defaultOptions);
        vt.initialize(sourceFeatures);
        expect(vt.tiles[0].features[0].geometry[0]).toBe(0);
        expect(vt.tiles[0].features[0].geometry[1]).toBe(.5);
    });

    test('handle points in the leftside world and the rightside world', () => {
        const vt = new TileIndex(defaultOptions);
        let sourceFeatures = convertToInternal({type: 'FeatureCollection', features: [leftPoint, rightPoint]}, defaultOptions);
        sourceFeatures = wrap(sourceFeatures, defaultOptions);
        vt.initialize(sourceFeatures);

        expect(vt.tiles[0].features[0].geometry[0]).toBe(0);
        expect(vt.tiles[0].features[0].geometry[1]).toBe(.5);

        expect(vt.tiles[0].features[1].geometry[0]).toBe(1);
        expect(vt.tiles[0].features[1].geometry[1]).toBe(.5);
    });
})