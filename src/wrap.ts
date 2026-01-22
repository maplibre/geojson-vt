
import {clip} from './clip';
import type {GeoJSONVTInternalFeature, GeoJSONVTOptions, StartEndSizeArray} from './definitions';
import {createFeature} from './feature';

/**
 * Wraps GeoJSONVT features around the antimeridian to handle tiled geographic projections.
 */
export function wrap(features: GeoJSONVTInternalFeature[], options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] {
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
function shiftFeatureCoords(features: GeoJSONVTInternalFeature[], offset: number): GeoJSONVTInternalFeature[] {
    const newFeatures = [];

    for (const feature of features) {
        const {id, type, geometry, tags} = feature;

        switch (type) {
            case 'Point':
            case 'MultiPoint':
            case 'LineString': {
                const newGeometry = shiftCoords(geometry as StartEndSizeArray, offset);
                newFeatures.push(createFeature(id, type, newGeometry, tags));
                continue;
            }

            case 'MultiLineString':
            case 'Polygon': {
                const newGeometry = shiftLines(geometry as StartEndSizeArray[], offset);
                newFeatures.push(createFeature(id, type, newGeometry, tags));
                continue;
            }

            case 'MultiPolygon': {
                const newGeometry = shiftPolygons(geometry as StartEndSizeArray[][], offset);
                newFeatures.push(createFeature(id, type, newGeometry, tags));
                continue;
            }
        }
    }

    return newFeatures;
}

/**
 * Shifts the coordinates of a collection of LineStrings by a specified offset.
 * @param lines
 * @param offset
 */
function shiftLines(lines: StartEndSizeArray[], offset: number): StartEndSizeArray[] {
    const geom = [];

    for (const line of lines) {
        geom.push(shiftCoords(line, offset));
    }

    return geom;
}

/**
 * Shifts the coordinates of a collection of Polygons by a specified offset.
 */
function shiftPolygons(polygons: StartEndSizeArray[][], offset: number): StartEndSizeArray[][] {
    const geom = [];

    for (const polygon of polygons) {
        const newPolygon = [];

        for (const line of polygon) {
            newPolygon.push(shiftCoords(line, offset));
        }

        geom.push(newPolygon);
    }

    return geom;
}

/**
 * Shifts the coordinates of a collection of points by a specified offset.
 */
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
