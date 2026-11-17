
import {AxisType, clip} from './clip';
import type { GeoJSONVTInternalFeature, GeoJSONVTOptions } from './definitions';
import {createPointFeature} from './feature';

export function wrap(features: GeoJSONVTInternalFeature[], options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] {
    if (!options.wrap) return features;

    const buffer = options.buffer / options.extent;
    let merged = features;

    const left  = clip(features, 1, -1 - buffer, buffer,     AxisType.X, -1, 2, options); // left world copy
    const right = clip(features, 1,  1 - buffer, 2 + buffer, AxisType.X, -1, 2, options); // right world copy

    if (!left && !right) return merged;

    merged = clip(features, 1, -buffer, 1 + buffer, AxisType.X, -1, 2, options) || []; // center world copy

    if (left) merged = shiftFeatureCoords(left, 1).concat(merged); // merge left into center
    if (right) merged = merged.concat(shiftFeatureCoords(right, -1)); // merge right into center

    return merged;
}

/**
 * The features on the other side of the antimeridian. A feature with a coordinates array shares it with its copy,
 * which only gets the offset.
 */
function shiftFeatureCoords(features: GeoJSONVTInternalFeature[], offset: number): GeoJSONVTInternalFeature[] {
    const newFeatures: GeoJSONVTInternalFeature[] = [];

    for (const feature of features) {
        if (feature.type === 'Point') {
            newFeatures.push(createPointFeature(feature.id, feature.x + offset, feature.y, feature.tags));
            continue;
        }

        newFeatures.push({...feature, minX: feature.minX + offset, maxX: feature.maxX + offset, offset: feature.offset + offset});
    }

    return newFeatures;
}
