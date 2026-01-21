
import {createFeature} from './feature';
import type { GeoJSONVTInternalFeature, GeoJSONVTOptions, StartEndSizeArray } from './definitions';

/* clip features between two vertical or horizontal axis-parallel lines:
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 *
 * k1 and k2 are the line coordinates
 * axis: 0 for x, 1 for y
 * minAll and maxAll: minimum and maximum coordinate value for all features
 */
export function clip(features: GeoJSONVTInternalFeature[], scale: number, k1: number, k2: number, axis: number, minAll: number, maxAll: number, options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] | null {
    k1 /= scale;
    k2 /= scale;

    if (minAll >= k1 && maxAll < k2) { // trivial accept
        return features;
    }

    if (maxAll < k1 || minAll >= k2) { // trivial reject
        return null;
    }

    const clipped: GeoJSONVTInternalFeature[] = [];

    for (const feature of features) {
        const min = axis === 0 ? feature.minX : feature.minY;
        const max = axis === 0 ? feature.maxX : feature.maxY;

        if (min >= k1 && max < k2) { // trivial accept
            clipped.push(feature);
            continue;
        }

        if (max < k1 || min >= k2) { // trivial reject
            continue;
        }

        switch (feature.type) {
            case 'Point':
            case 'MultiPoint': {
                const pointGeometry: number[] = [];
                clipPoints(feature.geometry, pointGeometry, k1, k2, axis);
                if (!pointGeometry.length) continue;

                const type = pointGeometry.length === 3 ? 'Point' : 'MultiPoint';
                clipped.push(createFeature(feature.id, type, pointGeometry, feature.tags));
                continue;
            }

            case 'LineString': {
                const lineGeometry: StartEndSizeArray[] = [];
                clipLine(feature.geometry, lineGeometry, k1, k2, axis, false, options.lineMetrics);
                if (!lineGeometry.length) continue;

                if (options.lineMetrics) {
                    for (const line of lineGeometry) {
                        clipped.push(createFeature(feature.id, feature.type, line, feature.tags));
                    }
                    continue;
                }

                if (lineGeometry.length > 1) {
                    clipped.push(createFeature(feature.id, "MultiLineString", lineGeometry, feature.tags));
                    continue;
                }

                clipped.push(createFeature(feature.id, feature.type, lineGeometry[0], feature.tags));
                continue;
            }

            case 'MultiLineString': {
                const multiLineGeometry: StartEndSizeArray[] = [];
                clipLines(feature.geometry, multiLineGeometry, k1, k2, axis, false);
                if (!multiLineGeometry.length) continue;

                if (multiLineGeometry.length === 1) {
                    clipped.push(createFeature(feature.id, "LineString", multiLineGeometry[0], feature.tags));
                    continue;
                }

                clipped.push(createFeature(feature.id, feature.type, multiLineGeometry, feature.tags));
                continue;
            }

            case 'Polygon': {
                const polygonGeometry: StartEndSizeArray[] = [];
                clipLines(feature.geometry, polygonGeometry, k1, k2, axis, true);
                if (!polygonGeometry.length) continue;

                clipped.push(createFeature(feature.id, feature.type, polygonGeometry, feature.tags));
                continue;
            }

            case 'MultiPolygon': {
                const multiPolygonGeometry: StartEndSizeArray[][] = [];
                for (const polygon of feature.geometry) {
                    const newPolygon: StartEndSizeArray[] = [];
                    clipLines(polygon, newPolygon, k1, k2, axis, true);
                    if (newPolygon.length) multiPolygonGeometry.push(newPolygon);
                }
                if (!multiPolygonGeometry.length) continue;

                clipped.push(createFeature(feature.id, feature.type, multiPolygonGeometry, feature.tags));
                continue;
            }
        }
    }

    if (!clipped.length) return null;

    return clipped;
}

function clipPoints(geom: number[], newGeom: number[], k1: number, k2: number, axis: number) {
    for (let i = 0; i < geom.length; i += 3) {
        const a = geom[i + axis];

        if (a >= k1 && a <= k2) {
            addPoint(newGeom, geom[i], geom[i + 1], geom[i + 2]);
        }
    }
}

function clipLine(geom: StartEndSizeArray, newGeom: StartEndSizeArray[], k1: number, k2: number, axis: number, isPolygon: boolean, trackMetrics: boolean) {

    let slice = newSlice(geom);
    const intersect = axis === 0 ? intersectX : intersectY;
    let len = geom.start;
    let segLen, t;

    for (let i = 0; i < geom.length - 3; i += 3) {
        const ax = geom[i];
        const ay = geom[i + 1];
        const az = geom[i + 2];
        const bx = geom[i + 3];
        const by = geom[i + 4];
        const a = axis === 0 ? ax : ay;
        const b = axis === 0 ? bx : by;
        let exited = false;

        if (trackMetrics) segLen = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));

        if (a < k1) {
            // ---|-->  | (line enters the clip region from the left)
            if (b > k1) {
                t = intersect(slice, ax, ay, bx, by, k1);
                if (trackMetrics) slice.start = len + segLen * t;
            }
        } else if (a > k2) {
            // |  <--|--- (line enters the clip region from the right)
            if (b < k2) {
                t = intersect(slice, ax, ay, bx, by, k2);
                if (trackMetrics) slice.start = len + segLen * t;
            }
        } else {
            addPoint(slice, ax, ay, az);
        }

        if (b < k1 && a >= k1) {
            // <--|---  | or <--|-----|--- (line exits the clip region on the left)
            t = intersect(slice, ax, ay, bx, by, k1);
            exited = true;
        }

        if (b > k2 && a <= k2) {
            // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
            t = intersect(slice, ax, ay, bx, by, k2);
            exited = true;
        }

        if (!isPolygon && exited) {
            if (trackMetrics) slice.end = len + segLen * t;
            newGeom.push(slice);
            slice = newSlice(geom);
        }

        if (trackMetrics) len += segLen;
    }

    // add the last point
    let last = geom.length - 3;
    const ax = geom[last];
    const ay = geom[last + 1];
    const az = geom[last + 2];
    const a = axis === 0 ? ax : ay;
    if (a >= k1 && a <= k2) addPoint(slice, ax, ay, az);

    // close the polygon if its endpoints are not the same after clipping
    last = slice.length - 3;
    if (isPolygon && last >= 3 && (slice[last] !== slice[0] || slice[last + 1] !== slice[1])) {
        addPoint(slice, slice[0], slice[1], slice[2]);
    }

    // add the final slice
    if (slice.length) {
        newGeom.push(slice);
    }
}

function newSlice(line: StartEndSizeArray): StartEndSizeArray {
    const slice: StartEndSizeArray = [];
    slice.size = line.size;
    slice.start = line.start;
    slice.end = line.end;
    return slice;
}

function clipLines(geom: StartEndSizeArray[], newGeom: StartEndSizeArray[], k1: number, k2: number, axis: number, isPolygon: boolean) {
    for (const line of geom) {
        clipLine(line, newGeom, k1, k2, axis, isPolygon, false);
    }
}

function addPoint(out: number[], x: number, y: number, z: number) {
    out.push(x, y, z);
}

function intersectX(out: StartEndSizeArray, ax: number, ay: number, bx: number, by: number, x: number) {
    const t = (x - ax) / (bx - ax);
    addPoint(out, x, ay + (by - ay) * t, 1);
    return t;
}

function intersectY(out: StartEndSizeArray, ax: number, ay: number, bx: number, by: number, y: number) {
    const t = (y - ay) / (by - ay);
    addPoint(out, ax + (bx - ax) * t, y, 1);
    return t;
}
