
import {clip} from './clip';
import type {GVTFeature, GeoJSONVTOptions, StartEndSizeArray} from './definitions';
import {createPointFeature, createMultiPointFeature, createLineStringFeature, createMultiLineStringFeature, createPolygonFeature, createMultiPolygonFeature} from './feature';

/**
 * Wraps GeoJSONVT features around the antimeridian to handle tiled geographic projections.
 */
export function wrap(features: GVTFeature[], options: GeoJSONVTOptions): GVTFeature[] {
    const buffer = options.buffer / options.extent;
    let merged = features;

    const left  = clip(features, 1, -1 - buffer, buffer,     0, -1, 2, options); // left world copy
    const right = clip(features, 1,  1 - buffer, 2 + buffer, 0, -1, 2, options); // right world copy

    if (!left && !right) return merged;

    merged = clip(features, 1, -buffer, 1 + buffer, 0, -1, 2, options) || []; // center world copy

    if (left) merged = shiftFeatureCoords(left, 1).concat(merged); // merge left into center
    if (right) merged = merged.concat(shiftFeatureCoords(right, -1)); // merge right into center

    return merged;
}

/**
 * Shifts the coordinates of a collection of GeoJSONVTFeatures by a specified offset.
 */
function shiftFeatureCoords(features: GVTFeature[], offset: number): GVTFeature[] {
    const newFeatures: GVTFeature[] = [];

    for (const feature of features) {
        switch (feature.type) {
            case 'Point': {
                const geometry = shiftCoords(feature.geometry, offset);
                newFeatures.push(createPointFeature(feature.id, geometry, feature.tags));
                break;
            }

            case 'MultiPoint': {
                const geometry = shiftCoords(feature.geometry, offset);
                newFeatures.push(createMultiPointFeature(feature.id, geometry, feature.tags));
                break;
            }

            case 'LineString': {
                const geometry = shiftLineCoords(feature.geometry, offset);
                newFeatures.push(createLineStringFeature(feature.id, geometry, feature.tags));
                break;
            }

            case 'MultiLineString': {
                const geometry = shiftLines(feature.geometry, offset);
                newFeatures.push(createMultiLineStringFeature(feature.id, geometry, feature.tags));
                break;
            }

            case 'Polygon': {
                const geometry = shiftLines(feature.geometry, offset);
                newFeatures.push(createPolygonFeature(feature.id, geometry, feature.tags));
                break;
            }

            case 'MultiPolygon': {
                const geometry = shiftPolygons(feature.geometry, offset);
                newFeatures.push(createMultiPolygonFeature(feature.id, geometry, feature.tags));
                break;
            }
        }
    }

    return newFeatures;
}

/**
 * Shifts the coordinates of a collection of LineStrings by a specified offset.
 */
function shiftLines(lines: StartEndSizeArray[], offset: number): StartEndSizeArray[] {
    const geom: StartEndSizeArray[] = [];

    for (const line of lines) {
        geom.push(shiftLineCoords(line, offset));
    }

    return geom;
}

/**
 * Shifts the coordinates of a collection of Polygons by a specified offset.
 */
function shiftPolygons(polygons: StartEndSizeArray[][], offset: number): StartEndSizeArray[][] {
    const geom: StartEndSizeArray[][] = [];

    for (const polygon of polygons) {
        const newPolygon: StartEndSizeArray[] = [];

        for (const line of polygon) {
            newPolygon.push(shiftLineCoords(line, offset));
        }

        geom.push(newPolygon);
    }

    return geom;
}

/**
 * Shifts the coordinates of a lines (with start/end/size metadata) by a specified offset.
 */
function shiftLineCoords(points: StartEndSizeArray, offset: number): StartEndSizeArray {
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

/**
 * Shifts the coordinates of a collection of points by a specified offset.
 */
function shiftCoords(points: number[], offset: number): number[] {
    const newPoints: number[] = [];

    for (let i = 0; i < points.length; i += 3) {
        newPoints.push(points[i] + offset, points[i + 1], points[i + 2]);
    }

    return newPoints;
}
