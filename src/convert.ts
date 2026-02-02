
import {simplify} from './simplify';
import {createFeature} from './feature';
import type {GeoJSONVTInternalFeature, GeoJSONVTOptions, StartEndSizeArray} from './definitions';

/**
 * converts GeoJSON to internal source features (an intermediate projected JSON vector format with simplification data)
 * @param data
 * @param options
 * @returns
 */
export function convertToInternal(data: GeoJSON.GeoJSON, options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] {
    const features: GeoJSONVTInternalFeature[] = [];

    switch (data.type) {
        case 'FeatureCollection':
            for (let i = 0; i < data.features.length; i++) {
                featureToInternal(features, data.features[i], options, i);
            }
            break;
        case 'Feature':
            featureToInternal(features, data, options);
            break;
        default:
            featureToInternal(features, {type: "Feature" as const, geometry: data, properties: undefined}, options);
    }

    return features;
}

function featureToInternal(features: GeoJSONVTInternalFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number) {
    if (!geojson.geometry) return;

    if (geojson.geometry.type === 'GeometryCollection') {
        convertGeometryCollection(features, geojson, geojson.geometry, options, index);
        return;
    }

    const coords = geojson.geometry.coordinates;
    if (!coords?.length) return;

    const id = getFeatureId(geojson, options, index);
    const tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);

    switch (geojson.geometry.type) {
        case 'Point':
            convertPointFeature(features, id, geojson.geometry, geojson.properties);
            return;

        case 'MultiPoint':
            convertMultiPointFeature(features, id, geojson.geometry, geojson.properties);
            return;

        case 'LineString':
            convertLineStringFeature(features, id, geojson.geometry, tolerance, geojson.properties);
            return;

        case 'MultiLineString':
            convertMultiLineStringFeature(features, id, geojson.geometry, tolerance, options, geojson.properties);
            return;

        case 'Polygon':
            convertPolygonFeature(features, id, geojson.geometry, tolerance, geojson.properties);
            return;

        case 'MultiPolygon':
            convertMultiPolygonFeature(features, id, geojson.geometry, tolerance, geojson.properties);
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

function convertGeometryCollection(features: GeoJSONVTInternalFeature[], geojson: GeoJSON.Feature, geometry: GeoJSON.GeometryCollection, options: GeoJSONVTOptions, index?: number) {
    for (const geom of geometry.geometries) {
        featureToInternal(features, {
            id: geojson.id,
            type: 'Feature',
            geometry: geom,
            properties: geojson.properties
        }, options, index);
    }
}

function convertPointFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, geom: GeoJSON.Point, properties: GeoJSON.GeoJsonProperties) {
    const out: number[] = [];
    out.push(projectX(geom.coordinates[0]), projectY(geom.coordinates[1]), 0);
    features.push(createFeature(id, 'Point', out, properties));
}

function convertMultiPointFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, geom: GeoJSON.MultiPoint, properties: GeoJSON.GeoJsonProperties) {
    const out: number[] = [];
    for (const coords of geom.coordinates) {
        out.push(projectX(coords[0]), projectY(coords[1]), 0);
    }
    features.push(createFeature(id, 'MultiPoint', out, properties));
}

function convertLineStringFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, geom: GeoJSON.LineString, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const out: StartEndSizeArray = [];
    convertLine(geom.coordinates, out, tolerance, false);
    features.push(createFeature(id, 'LineString', out, properties));
}

function convertMultiLineStringFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, geom: GeoJSON.MultiLineString, tolerance: number, options: GeoJSONVTOptions, properties: GeoJSON.GeoJsonProperties) {
    if (options.lineMetrics) {
        // explode into linestrings to be able to track metrics
        for (const line of geom.coordinates) {
            const out: StartEndSizeArray = [];
            convertLine(line, out, tolerance, false);
            features.push(createFeature(id, 'LineString', out, properties));
        }
    } else {
        const out: StartEndSizeArray[] = [];
        convertLines(geom.coordinates, out, tolerance, false);
        features.push(createFeature(id, 'MultiLineString', out, properties));
    }
}

function convertPolygonFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, geom: GeoJSON.Polygon, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const out: StartEndSizeArray[] = [];
    convertLines(geom.coordinates, out, tolerance, true);
    features.push(createFeature(id, 'Polygon', out, properties));
}

function convertMultiPolygonFeature(features: GeoJSONVTInternalFeature[], id: number | string | undefined, geom: GeoJSON.MultiPolygon, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const out: StartEndSizeArray[][] = [];
    for (const polygon of geom.coordinates) {
        const polygonOut: StartEndSizeArray[] = [];
        convertLines(polygon, polygonOut, tolerance, true);
        out.push(polygonOut);
    }
    features.push(createFeature(id, 'MultiPolygon', out, properties));
}

function convertLine(ring: GeoJSON.Position[], out: StartEndSizeArray, tolerance: number, isPolygon: boolean) {
    let x0, y0;
    let size = 0;

    for (let j = 0; j < ring.length; j++) {
        const x = projectX(ring[j][0]);
        const y = projectY(ring[j][1]);

        out.push(x, y, 0);

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

    const last = out.length - 3;
    out[2] = 1;
    if (tolerance > 0) simplify(out, 0, last, tolerance);
    out[last + 2] = 1;

    out.size = Math.abs(size);
    out.start = 0;
    out.end = out.size;
}

function convertLines(rings: GeoJSON.Position[][], out: StartEndSizeArray[], tolerance: number, isPolygon: boolean) {
    for (let i = 0; i < rings.length; i++) {
        const geom: StartEndSizeArray = [];
        convertLine(rings[i], geom, tolerance, isPolygon);
        out.push(geom);
    }
}

/**
 * Convert longitude to spherical mercator in [0..1] range
 */
export function projectX(x: number) {
    return x / 360 + 0.5;
}

/**
 * Convert latitude to spherical mercator in [0..1] range
 */
export function projectY(y: number) {
    const sin = Math.sin(y * Math.PI / 180);
    const y2 = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
    return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}
