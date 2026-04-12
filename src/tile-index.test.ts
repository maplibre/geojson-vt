import { describe, expect, test } from "vitest";
import { TileIndex } from "./tile-index";
import { convertToInternal } from "./convert";
import { applySourceDiff } from "./difference";
import { wrap } from "./wrap";

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
            updateable: true,
            indexMaxZoom: 1,
            indexMaxPoints: 0,
            debug: 2,
            extent: 4096,
            buffer: 64,
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
});