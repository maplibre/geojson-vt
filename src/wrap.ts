
import {AxisType, clip} from './clip';
import type { GeoJSONVTInternalFeature, GeoJSONVTOptions, StartEndSizeArray } from './definitions';
import {createFeature} from './feature';

export function wrap(features: GeoJSONVTInternalFeature[], options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] {
  if (options.worldCopies) {
    const buffer = options.buffer / options.extent;
    let merged = features;

    const left  = clip(features, 1, -1 - buffer, buffer,     AxisType.X, -1, 2, options); // left world copy
    const right = clip(features, 1,  1 - buffer, 2 + buffer, AxisType.X, -1, 2, options); // right world copy

    if (!left && !right) return merged;

    merged = clip(features, 1, -buffer, 1 + buffer, AxisType.X, -1, 2, options) || []; // center world copy

    if (left) merged = shiftFeatureCoords(left, 1).concat(merged); // merge left into center
    if (right) merged = merged.concat(shiftFeatureCoords(right, -1)); // merge right into center

    return merged;
  } else {
    const result: GeoJSONVTInternalFeature[] = [];

    const center = clip(features, 1, 0, 1, AxisType.X, -1, 2, options);
    if (center) result.push(...center);

    // Filters prevent duplicates at the antimeridian: clip()'s bounds are inclusive, 
    // so features with maxX === 1 must be routed to the right pass only.
    const rightCandidates = features.filter(f => f.maxX > 1 || f.minX >= 1);
    const right = rightCandidates.length
      ? clip(rightCandidates, 1, 1, 3, AxisType.X, -1, 2, options)
      : null;
    if (right) result.push(...shiftFeatureCoords(right, -1));

    const leftCandidates = features.filter(f => f.minX < 0);
    const left = leftCandidates.length
      ? clip(leftCandidates, 1, -2, 0, AxisType.X, -1, 2, options)
      : null;
    if (left) result.push(...shiftFeatureCoords(left, 1));

    return result;
  }
}

function shiftFeatureCoords(features: GeoJSONVTInternalFeature[], offset: number): GeoJSONVTInternalFeature[] {
    const newFeatures = [];

    for (const feature of features) {
        switch (feature.type) {
            case 'Point':
            case 'MultiPoint':
            case 'LineString': {
                const newGeometry = shiftCoords(feature.geometry, offset);

                newFeatures.push(createFeature(feature.id, feature.type, newGeometry, feature.tags));
                continue;
            }

            case 'MultiLineString':
            case 'Polygon': {
                const newGeometry = [];
                for (const line of feature.geometry) {
                    newGeometry.push(shiftCoords(line, offset));
                }

                newFeatures.push(createFeature(feature.id, feature.type, newGeometry, feature.tags));
                continue;
            }

            case 'MultiPolygon': {
                const newGeometry = [];
                for (const polygon of feature.geometry) {
                    const newPolygon = [];
                    for (const line of polygon) {
                        newPolygon.push(shiftCoords(line, offset));
                    }
                    newGeometry.push(newPolygon);
                }

                newFeatures.push(createFeature(feature.id, feature.type, newGeometry, feature.tags));
                continue;
            }
        }
    }

    return newFeatures;
}

function shiftCoords(points: StartEndSizeArray, offset: number): number[] | StartEndSizeArray {
    const newPoints: StartEndSizeArray = [];
    newPoints.size = points.size;

    if (points.start !== undefined) {
        newPoints.start = points.start;
        newPoints.end = points.end;
    }

    for (let i = 0; i < points.length; i += 3) {
        newPoints.push(points[i] + offset, points[i + 1], points[i + 2]);
    }

    return newPoints;
}
