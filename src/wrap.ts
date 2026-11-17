
import {AxisType, clip} from './clip';
import type { GeoJSONVTInternalFeature, GeoJSONVTOptions, GeoJSONVTSourceCoords } from './definitions';
import {createFeature, createPointFeature} from './feature';

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

function shiftFeatureCoords(features: GeoJSONVTInternalFeature[], offset: number): GeoJSONVTInternalFeature[] {
    const newFeatures = [];

    for (const feature of features) {
        if (feature.type === 'Point') {
            newFeatures.push(createPointFeature(feature.id, feature.x + offset, feature.y, feature.tags));
            continue;
        }

        const shifted = createFeature(feature.id, feature.type, shiftCoords(feature.geometry, feature.type === 'MultiPoint', offset), feature.tags);
        if (feature.type === 'LineString' && shifted.type === 'LineString' && feature.start !== undefined) {
            shifted.start = feature.start;
            shifted.end = feature.end;
            shifted.size = feature.size;
        }
        newFeatures.push(shifted);
    }

    return newFeatures;
}

/**
 * A copy of the coordinates with every x moved by an offset.
 */
function shiftCoords(coords: GeoJSONVTSourceCoords, isPoints: boolean, offset: number): GeoJSONVTSourceCoords {
    const shifted = coords.slice();

    if (isPoints) {
        for (let i = 0; i < shifted.length; i += 3) shifted[i] += offset;
        return shifted;
    }

    for (let i = 0; i < shifted.length;) {
        const ringEnd = i + 2 + shifted[i] * 3;
        for (let j = i + 2; j < ringEnd; j += 3) shifted[j] += offset;
        i = ringEnd;
    }

    return shifted;
}
