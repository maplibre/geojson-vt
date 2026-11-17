
import {createFeature, createPointFeature} from './feature';
import type { GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTOptions, GeoJSONVTSourceCoords } from './definitions';

export const enum AxisType {
    X = 0,
    Y = 1
}

type RingsFeature = GeoJSONVTInternalLineStringFeature | GeoJSONVTInternalMultiLineStringFeature | GeoJSONVTInternalPolygonFeature | GeoJSONVTInternalMultiPolygonFeature;

/**
 * clip features between two vertical or horizontal axis-parallel lines:
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 *
 * @param features - the features to clip
 * @param scale - the scale to divide start and end inputs
 * @param start - the start of the clip range
 * @param end - the end of the clip range
 * @param axis - which axis to clip against
 * @param minAll - the minimum for all features in the relevant axis
 * @param maxAll - the maximum for all features in the relevant axis
 */
export function clip(features: GeoJSONVTInternalFeature[], scale: number, start: number, end: number, axis: AxisType, minAll: number, maxAll: number, options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] | null {
    start /= scale;
    end /= scale;

    if (minAll >= start && maxAll < end) { // trivial accept
        return features;
    }

    if (maxAll < start || minAll >= end) { // trivial reject
        return null;
    }

    const clipped: GeoJSONVTInternalFeature[] = [];

    for (const feature of features) {
        if (feature.type === 'Point') {
            const a = axis === AxisType.X ? feature.x : feature.y;
            if (a >= start && a < end) clipped.push(feature);
            continue;
        }

        const min = axis === AxisType.X ? feature.minX : feature.minY;
        const max = axis === AxisType.X ? feature.maxX : feature.maxY;

        if (min >= start && max < end) { // trivial accept
            clipped.push(feature);
            continue;
        }

        if (max < start || min >= end) { // trivial reject
            continue;
        }

        if (feature.type === 'MultiPoint') {
            clipPointsFeature(feature, clipped, start, end, axis);
            continue;
        }

        clipRingsFeature(feature, clipped, start, end, axis, options);
    }

    if (!clipped.length) return null;

    return clipped;
}

function clipPointsFeature(feature: GeoJSONVTInternalMultiPointFeature, clipped: GeoJSONVTInternalFeature[], start: number, end: number, axis: AxisType) {
    const geom = feature.geometry;
    const offset = feature.offset;
    const axisOffset = axis === AxisType.X ? offset : 0;

    let count = 0;
    let lastInside = 0;
    for (let i = 0; i < geom.length; i += 3) {
        const a = geom[i + axis] + axisOffset;
        if (a >= start && a <= end) {
            count++;
            lastInside = i;
        }
    }
    if (!count) return;

    if (count === 1) {
        clipped.push(createPointFeature(feature.id, geom[lastInside] + offset, geom[lastInside + 1], feature.tags));
        return;
    }

    const out = new Float64Array(count * 3);
    let next = 0;
    for (let i = 0; i < geom.length; i += 3) {
        const a = geom[i + axis] + axisOffset;
        if (a >= start && a <= end) {
            out[next] = geom[i] + offset;
            out[next + 1] = geom[i + 1];
            out[next + 2] = geom[i + 2];
            next += 3;
        }
    }

    clipped.push(createFeature(feature.id, 'MultiPoint', out, feature.tags));
}

function clipRingsFeature(feature: RingsFeature, clipped: GeoJSONVTInternalFeature[], start: number, end: number, axis: AxisType, options: GeoJSONVTOptions) {
    const geom = feature.geometry;
    const offset = feature.offset;
    const isPolygon = feature.type === 'Polygon' || feature.type === 'MultiPolygon';

    // count first, so that all clipped rings go into one array of the right size
    let length = 0;
    for (let i = 0; i < geom.length;) {
        const ringEnd = i + 2 + geom[i] * 3;
        length += countClippedRing(geom, offset, i + 2, ringEnd, start, end, axis, isPolygon);
        i = ringEnd;
    }
    if (!length) return;

    const metricsOf = options.lineMetrics && feature.type === 'LineString' ? feature : null;
    const metrics: number[] = [];
    let out = new Float64Array(length);
    let next = 0;
    let hasOuter = false;
    for (let i = 0; i < geom.length;) {
        const ringEnd = i + 2 + geom[i] * 3;
        let size = geom[i + 1];
        if (isPolygon) {
            // the first ring that is left of a polygon is its outer ring, also when that was a hole
            if (size >= 0) hasOuter = false;
            if (!hasOuter) size = Math.abs(size);
        }
        const ringStart = next;
        next = clipRing(geom, offset, i + 2, ringEnd, size, out, next, start, end, axis, isPolygon, metricsOf, metrics);
        if (next > ringStart) hasOuter = true;
        i = ringEnd;
    }
    // a polygon ring that crosses a clip line has room for a position that closes it, which it does not always need
    if (next < length) out = out.subarray(0, next);

    if (metricsOf) {
        // each part of the line becomes a feature, to be able to track its metrics
        for (let i = 0, part = 0; i < out.length; part += 2) {
            const ringEnd = i + 2 + out[i] * 3;
            const line = createFeature(feature.id, 'LineString', i === 0 && ringEnd === out.length ? out : out.slice(i, ringEnd), feature.tags);
            line.start = metrics[part];
            line.end = metrics[part + 1];
            line.size = metricsOf.size;
            clipped.push(line);
            i = ringEnd;
        }
        return;
    }

    if (isPolygon) {
        clipped.push(createFeature(feature.id, feature.type, out, feature.tags));
        return;
    }

    const isSingleLine = 2 + out[0] * 3 === out.length;
    clipped.push(createFeature(feature.id, isSingleLine ? 'LineString' : 'MultiLineString', out, feature.tags));
}

/**
 * How many values `clipRing` writes for a ring, without working out the intersections.
 * @param offset - what to add to every x of `geom`
 */
function countClippedRing(geom: GeoJSONVTSourceCoords, offset: number, first: number, ringEnd: number, start: number, end: number, axis: AxisType, isPolygon: boolean): number {
    const axisOffset = axis === AxisType.X ? offset : 0;
    let parts = 0;
    let total = 0;
    let count = 0;
    let crossings = 0;

    for (let i = first; i < ringEnd - 3; i += 3) {
        const a = geom[i + axis] + axisOffset;
        const b = geom[i + 3 + axis] + axisOffset;
        let exited = false;

        if (a < start) {
            if (b >= start) {
                count++;
                crossings++;
            }
        } else if (a > end) {
            if (b <= end) {
                count++;
                crossings++;
            }
        } else {
            count++;
        }

        if (b < start && a >= start) {
            count++;
            crossings++;
            exited = true;
        }

        if (b > end && a <= end) {
            count++;
            crossings++;
            exited = true;
        }

        if (!isPolygon && exited) {
            total += count;
            parts++;
            count = 0;
        }
    }

    const last = ringEnd - 3;
    const a = geom[last + axis] + axisOffset;
    if (a >= start && a <= end) count++;

    // a ring that is cut ends at an intersection and gets closed, and so does one that came in open
    const isOpen = geom[first] + offset !== geom[last] + offset || geom[first + 1] !== geom[last + 1];
    if (isPolygon && count >= 2 && (crossings > 0 || isOpen)) count++;

    if (count > 0) {
        total += count;
        parts++;
    }

    return total * 3 + parts * 2;
}

/**
 * Clips a ring and writes what is left of it to `out`, each part with the two values before it,
 * see {@link GeoJSONVTSourceCoords}. A polygon ring stays one ring, and a line can come out in several parts.
 * @param offset - what to add to every x of `geom`, which `out` has added already
 * @param metricsOf - the line whose metrics to track, which adds where each part starts and ends to `metrics`
 * @returns where the next ring starts in `out`
 */
function clipRing(geom: GeoJSONVTSourceCoords, offset: number, first: number, ringEnd: number, size: number, out: GeoJSONVTSourceCoords, next: number, start: number, end: number, axis: AxisType, isPolygon: boolean, metricsOf: GeoJSONVTInternalLineStringFeature | null, metrics: number[]): number {
    let header = next;
    out[next + 1] = size;
    next += 2;
    let partStart = next;

    let len = metricsOf ? metricsOf.start : 0;
    let metricStart = len;
    let segLen, t;

    for (let i = first; i < ringEnd - 3; i += 3) {
        const ax = geom[i] + offset;
        const ay = geom[i + 1];
        const az = geom[i + 2];
        const bx = geom[i + 3] + offset;
        const by = geom[i + 4];
        const a = axis === AxisType.X ? ax : ay;
        const b = axis === AxisType.X ? bx : by;
        let exited = false;

        if (metricsOf) segLen = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));

        if (a < start) {
            // ---|-->  | (line enters the clip region from the left)
            if (b >= start) {
                t = intersect(out, next, ax, ay, bx, by, start, axis);
                next += 3;
                if (metricsOf) metricStart = len + segLen * t;
            }
        } else if (a > end) {
            // |  <--|--- (line enters the clip region from the right)
            if (b <= end) {
                t = intersect(out, next, ax, ay, bx, by, end, axis);
                next += 3;
                if (metricsOf) metricStart = len + segLen * t;
            }
        } else {
            out[next] = ax;
            out[next + 1] = ay;
            out[next + 2] = az;
            next += 3;
        }

        if (b < start && a >= start) {
            // <--|---  | or <--|-----|--- (line exits the clip region on the left)
            t = intersect(out, next, ax, ay, bx, by, start, axis);
            next += 3;
            exited = true;
        }

        if (b > end && a <= end) {
            // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
            t = intersect(out, next, ax, ay, bx, by, end, axis);
            next += 3;
            exited = true;
        }

        if (!isPolygon && exited) {
            // the part ends here, and the next one starts
            out[header] = (next - partStart) / 3;
            if (metricsOf) {
                metrics.push(metricStart, len + segLen * t);
                metricStart = metricsOf.start;
            }
            header = next;
            out[next + 1] = size;
            next += 2;
            partStart = next;
        }

        if (metricsOf) len += segLen;
    }

    // add the last point
    const last = ringEnd - 3;
    const ax = geom[last] + offset;
    const ay = geom[last + 1];
    const a = axis === AxisType.X ? ax : ay;
    if (a >= start && a <= end) {
        out[next] = ax;
        out[next + 1] = ay;
        out[next + 2] = geom[last + 2];
        next += 3;
    }

    // close the polygon if its endpoints are not the same after clipping
    if (isPolygon && next - partStart >= 6 && (out[next - 3] !== out[partStart] || out[next - 2] !== out[partStart + 1])) {
        out[next] = out[partStart];
        out[next + 1] = out[partStart + 1];
        out[next + 2] = out[partStart + 2];
        next += 3;
    }

    // add the final part, or give back the two values before it when it is empty
    if (next === partStart) return header;

    out[header] = (next - partStart) / 3;
    if (metricsOf) metrics.push(metricStart, metricsOf.end);

    return next;
}

/**
 * Writes the position where a segment crosses the clip line at `k`.
 * @returns how far along the segment that is, from 0 to 1
 */
function intersect(out: GeoJSONVTSourceCoords, next: number, ax: number, ay: number, bx: number, by: number, k: number, axis: AxisType): number {
    let t;
    if (axis === AxisType.X) {
        t = (k - ax) / (bx - ax);
        out[next] = k;
        out[next + 1] = ay + (by - ay) * t;
    } else {
        t = (k - ay) / (by - ay);
        out[next] = ax + (bx - ax) * t;
        out[next + 1] = k;
    }
    out[next + 2] = 1;

    return t;
}
