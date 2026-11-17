
import {simplify} from './simplify';
import {createFeature, createPointFeature} from './feature';
import {getWorldCoordinateHelper, type WorldCoordinateHelper} from './world-coordinate-helper';
import type {GeoJSONVTInternalFeature, GeoJSONVTOptions, GeoJSONVTSourceCoords} from './definitions';

const MAX_GEOMETRY_COLLECTION_DEPTH = 1024;

/**
 * converts GeoJSON to internal source features (an intermediate projected JSON vector format with simplification data)
 * @param data
 * @param options
 * @param unlocated - the features without coordinates, by id: a feature with an id that converts to nothing is set in it, and one that converts to something is deleted from it
 * @returns
 */
export function convertToInternal(data: GeoJSON.GeoJSON, options: GeoJSONVTOptions, unlocated?: Map<string | number, GeoJSON.Feature>): GeoJSONVTInternalFeature[] {
    const features: GeoJSONVTInternalFeature[] = [];

    switch (data.type) {
        case 'FeatureCollection':
            for (let i = 0; i < data.features.length; i++) {
                convertFeature(features, data.features[i], options, unlocated, i);
            }
            break;
        case 'Feature':
            convertFeature(features, data, options, unlocated);
            break;
        default:
            convertFeature(features, {type: "Feature" as const, geometry: data, properties: undefined}, options, unlocated);
    }

    return features;
}

function convertFeature(features: GeoJSONVTInternalFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, unlocated?: Map<string | number, GeoJSON.Feature>, index?: number) {
    const count = features.length;
    featureToInternal(features, geojson, options, index);
    if (!unlocated) return;

    const id = getFeatureId(geojson, options, index);
    if (id == null) return;
    if (features.length > count) {
        unlocated.delete(id);
    } else {
        unlocated.set(id, {...geojson, id});
    }
}

function featureToInternal(features: GeoJSONVTInternalFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number, depth = 0) {
    if (!geojson.geometry) return;

    if (depth > MAX_GEOMETRY_COLLECTION_DEPTH) {
        throw new Error('GeometryCollection nesting exceeds supported depth: ' + MAX_GEOMETRY_COLLECTION_DEPTH);
    }

    if (geojson.geometry.type === 'GeometryCollection') {
        convertGeometryCollection(features, geojson, geojson.geometry, options, index, depth + 1);
        return;
    }

    const coords = geojson.geometry.coordinates;
    if (!coords?.length) return;

    const id = getFeatureId(geojson, options, index);
    const tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);
    const worldCoordinateHelper = getWorldCoordinateHelper(options.coordinates);

    switch (geojson.geometry.type) {
        case 'Point':
            features.push(createPointFeature(id, worldCoordinateHelper.projectX(geojson.geometry.coordinates[0]), worldCoordinateHelper.projectY(geojson.geometry.coordinates[1]), geojson.properties));
            return;

        case 'MultiPoint':
            convertMultiPointFeature(features, id, geojson.geometry, worldCoordinateHelper, geojson.properties);
            return;

        case 'LineString':
            convertLineStringFeature(features, id, geojson.geometry.coordinates, tolerance, worldCoordinateHelper, options, geojson.properties);
            return;

        case 'MultiLineString':
            if (options.lineMetrics) {
                // explode into linestrings to be able to track metrics
                for (const line of geojson.geometry.coordinates) {
                    convertLineStringFeature(features, id, line, tolerance, worldCoordinateHelper, options, geojson.properties);
                }
                return;
            }
            convertRingsFeature(features, id, 'MultiLineString', [geojson.geometry.coordinates], tolerance, worldCoordinateHelper, geojson.properties);
            return;

        case 'Polygon':
            convertRingsFeature(features, id, 'Polygon', [geojson.geometry.coordinates], tolerance, worldCoordinateHelper, geojson.properties);
            return;

        case 'MultiPolygon':
            convertRingsFeature(features, id, 'MultiPolygon', geojson.geometry.coordinates, tolerance, worldCoordinateHelper, geojson.properties);
            return;

        default:
            throw new Error('Input data is not a valid GeoJSON object.');
    }
}

function getFeatureId(geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number): number | string | undefined {
    if (options.promoteId) {
        return geojson.properties?.[options.promoteId];
    }
    if (options.generateId) {
        return index || 0;
    }
    return geojson.id;
}

function convertGeometryCollection(features: GeoJSONVTInternalFeature[], geojson: GeoJSON.Feature, geometry: GeoJSON.GeometryCollection, options: GeoJSONVTOptions, index?: number, depth = 0) {
    for (const geom of geometry.geometries) {
        featureToInternal(features, {
            id: geojson.id,
            type: 'Feature',
            geometry: geom,
            properties: geojson.properties
        }, options, index, depth);
    }
}

function convertMultiPointFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, geom: GeoJSON.MultiPoint, worldCoordinateHelper: WorldCoordinateHelper, properties: GeoJSON.GeoJsonProperties) {
    const out = new Float64Array(geom.coordinates.length * 3);
    for (let i = 0; i < geom.coordinates.length; i++) {
        out[i * 3] = worldCoordinateHelper.projectX(geom.coordinates[i][0]);
        out[i * 3 + 1] = worldCoordinateHelper.projectY(geom.coordinates[i][1]);
    }
    features.push(createFeature(id, 'MultiPoint', out, properties));
}

function convertLineStringFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, line: GeoJSON.Position[], tolerance: number, worldCoordinateHelper: WorldCoordinateHelper, options: GeoJSONVTOptions, properties: GeoJSON.GeoJsonProperties) {
    if (!line.length) return;

    const out = new Float64Array(2 + line.length * 3);
    convertRing(line, out, 0, tolerance, false, false, worldCoordinateHelper);

    const feature = createFeature(id, 'LineString', out, properties);
    if (options.lineMetrics) {
        feature.start = 0;
        feature.end = feature.size = out[1];
    }
    features.push(feature);
}

/**
 * Converts a MultiLineString, a Polygon or a MultiPolygon, whose rings come in groups: all lines in one,
 * and the rings of one polygon in each. The first ring of a polygon is its outer ring, and the rest are its holes.
 */
function convertRingsFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, type: 'MultiLineString' | 'Polygon' | 'MultiPolygon', groups: GeoJSON.Position[][][], tolerance: number, worldCoordinateHelper: WorldCoordinateHelper, properties: GeoJSON.GeoJsonProperties) {
    let length = 0;
    for (const rings of groups) {
        for (const ring of rings) {
            if (ring.length) length += 2 + ring.length * 3;
        }
    }
    if (!length) return;

    const isPolygon = type !== 'MultiLineString';
    const out = new Float64Array(length);
    let index = 0;
    for (const rings of groups) {
        let isOuter = true;
        for (const ring of rings) {
            if (!ring.length) continue;
            index = convertRing(ring, out, index, tolerance, isPolygon, isOuter, worldCoordinateHelper);
            isOuter = false;
        }
    }

    features.push(createFeature(id, type, out, properties));
}

/**
 * The size a hole is stored with, which has to be negative for {@link isHole} to tell it from an outer ring.
 * A hole without area gets -0, and one whose area is not a number gets -Infinity. Both compare with a tolerance
 * the way 0 and NaN do.
 */
function toHoleSize(size: number): number {
    const magnitude = Math.abs(size);
    return Number.isNaN(magnitude) ? -Infinity : -magnitude;
}

/**
 * Writes a ring and the two values before it, see {@link GeoJSONVTSourceCoords}.
 * @returns where the next ring starts
 */
function convertRing(ring: GeoJSON.Position[], out: GeoJSONVTSourceCoords, index: number, tolerance: number, isPolygon: boolean, isOuter: boolean, worldCoordinateHelper: WorldCoordinateHelper): number {
    const first = index + 2;
    let x0, y0;
    let size = 0;
    let next = first;

    for (let j = 0; j < ring.length; j++) {
        const x = worldCoordinateHelper.projectX(ring[j][0]);
        const y = worldCoordinateHelper.projectY(ring[j][1]);

        out[next] = x;
        out[next + 1] = y;
        next += 3;

        if (j > 0) {
            if (isPolygon) {
                size += (x0 * y - x * y0) / 2; // area
            } else {
                size += Math.sqrt(Math.pow(x - x0, 2) + Math.pow(y - y0, 2)); // length
            }
        }
        x0 = x;
        y0 = y;
    }

    const last = next - 3;
    out[first + 2] = 1;
    if (tolerance > 0) simplify(out, first, last, tolerance);
    out[last + 2] = 1;

    out[index] = ring.length;
    out[index + 1] = isPolygon && !isOuter ? toHoleSize(size) : Math.abs(size);

    return next;
}
