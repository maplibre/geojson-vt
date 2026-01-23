import {simplify} from './simplify';
import type {GVTFeature, GeoJSONVTOptions, StartEndSizeArray} from './definitions';
import {createPointFeature, createMultiPointFeature, createLineStringFeature, createMultiLineStringFeature, createPolygonFeature, createMultiPolygonFeature} from './feature';

/**
 * converts GeoJSON feature into an intermediate projected JSON vector format with simplification data
 * @param data
 * @param options
 * @returns
 */
export function convert(data: GeoJSON.GeoJSON, options: GeoJSONVTOptions): GVTFeature[] {
    const features: GVTFeature[] = [];

    switch (data.type) {
        case 'FeatureCollection':
            for (let i = 0; i < data.features.length; i++) {
                convertFeature(features, data.features[i], options, i);
            }
            break;

        case 'Feature':
            convertFeature(features, data, options);
            break;

        default:
            convertFeature(features, {type: 'Feature' as const, geometry: data, properties: undefined}, options);
    }

    return features;
}

function convertFeature(features: GVTFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number) {
    if (!geojson.geometry) return;

    const {geometry, properties} = geojson;

    if (geometry.type === 'GeometryCollection') {
        convertGeometryCollection(features, geojson, geometry, options, index);
        return;
    }

    const coords = geometry.coordinates;
    if (!coords?.length) return;

    const id = getFeatureId(geojson, options, index);
    const tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);

    switch (geometry.type) {
        case 'Point': {
            convertPointFeature(features, id, geometry, properties);
            break;
        }
        case 'MultiPoint': {
            convertMultiPointFeature(features, id, geometry, properties);
            break;
        }
        case 'LineString': {
            convertLineStringFeature(features, id, geometry, tolerance, properties);
            break;
        }
        case 'MultiLineString': {
            convertMultiLineStringFeature(features, id, geometry, tolerance, options, properties);
            break;
        }
        case 'Polygon': {
            convertPolygonFeature(features, id, geometry, tolerance, properties);
            break;
        }
        case 'MultiPolygon': {
            convertMultiPolygonFeature(features, id, geometry, tolerance, properties);
            break;
        }
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

function convertGeometryCollection(features: GVTFeature[], geojson: GeoJSON.Feature, geometry: GeoJSON.GeometryCollection, options: GeoJSONVTOptions, index?: number) {
    for (const geom of geometry.geometries) {
        convertFeature(features, {
            id: geojson.id,
            type: 'Feature',
            geometry: geom,
            properties: geojson.properties
        }, options, index);
    }
}

function convertPointFeature(features: GVTFeature[], id: number | string | undefined, geom: GeoJSON.Point, properties: GeoJSON.GeoJsonProperties) {
    const out: number[] = [];
    out.push(projectX(geom.coordinates[0]), projectY(geom.coordinates[1]), 0);
    features.push(createPointFeature(id, out, properties));
}

function convertMultiPointFeature(features: GVTFeature[], id: number | string | undefined, geom: GeoJSON.MultiPoint, properties: GeoJSON.GeoJsonProperties) {
    const out: number[] = [];
    for (const coords of geom.coordinates) {
        out.push(projectX(coords[0]), projectY(coords[1]), 0);
    }
    features.push(createMultiPointFeature(id, out, properties));
}

function convertLineStringFeature(features: GVTFeature[], id: number | string | undefined, geom: GeoJSON.LineString, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const out: StartEndSizeArray = [];
    convertLine(geom.coordinates, out, tolerance, false);
    features.push(createLineStringFeature(id, out, properties));
}

function convertMultiLineStringFeature(features: GVTFeature[], id: number | string | undefined, geom: GeoJSON.MultiLineString, tolerance: number, options: GeoJSONVTOptions, properties: GeoJSON.GeoJsonProperties) {
    if (options.lineMetrics) {
        // explode into linestrings to be able to track metrics
        for (const line of geom.coordinates) {
            const out: StartEndSizeArray = [];
            convertLine(line, out, tolerance, false);
            features.push(createLineStringFeature(id, out, properties));
        }
    } else {
        const out: StartEndSizeArray[] = [];
        convertLines(geom.coordinates, out, tolerance, false);
        features.push(createMultiLineStringFeature(id, out, properties));
    }
}

function convertPolygonFeature(features: GVTFeature[], id: number | string | undefined, geom: GeoJSON.Polygon, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const out: StartEndSizeArray[] = [];
    convertLines(geom.coordinates, out, tolerance, true);
    features.push(createPolygonFeature(id, out, properties));
}

function convertMultiPolygonFeature(features: GVTFeature[], id: number | string | undefined, geom: GeoJSON.MultiPolygon, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const out: StartEndSizeArray[][] = [];
    for (const polygon of geom.coordinates) {
        const polygonOut: StartEndSizeArray[] = [];
        convertLines(polygon, polygonOut, tolerance, true);
        out.push(polygonOut);
    }
    features.push(createMultiPolygonFeature(id, out, properties));
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

function projectX(x: number) {
    return x / 360 + 0.5;
}

function projectY(y: number) {
    const sin = Math.sin(y * Math.PI / 180);
    const y2 = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
    return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}
