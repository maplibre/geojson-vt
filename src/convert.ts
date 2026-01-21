import {simplify} from './simplify';
import {createFeature} from './feature';
import type { GeoJSONVTInternalFeature, GeoJSONVTOptions, StartEndSizeArray } from './definitions';

/**
 * converts GeoJSON feature into an intermediate projected JSON vector format with simplification data
 * @param data
 * @param options
 * @returns
 */
export function convert(data: GeoJSON.GeoJSON, options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] {
    const features: GeoJSONVTInternalFeature[] = [];

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

function convertFeature(features: GeoJSONVTInternalFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number) {
    if (!geojson.geometry) return;

    const {geometry, properties} = geojson;

    if (geometry.type === 'GeometryCollection') {
        const geom: GeoJSON.GeometryCollection = geometry;
        convertGeometryCollection(features, geojson, geom, options, index);
        return;
    }

    const coords = geometry.coordinates;
    if (!coords?.length) return;

    const id = getFeatureId(geojson, options, index);
    const tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);

    switch (geometry.type) {
        case 'Point': {
            const geom: GeoJSON.Point = geometry;
            convertPointFeature(features, id, geom, properties);
            break;
        }
        case 'MultiPoint': {
            const geom: GeoJSON.MultiPoint = geometry;
            convertMultiPointFeature(features, id, geom, properties);
            break;
        }
        case 'LineString': {
            const geom: GeoJSON.LineString = geometry;
            convertLineStringFeature(features, id, geom, tolerance, properties);
            break;
        }
        case 'MultiLineString': {
            const geom: GeoJSON.MultiLineString = geometry;
            convertMultiLineStringFeature(features, id, geom, tolerance, options, properties);
            break;
        }
        case 'Polygon': {
            const geom: GeoJSON.Polygon = geometry;
            convertPolygonFeature(features, id, geom, tolerance, properties);
            break;
        }
        case 'MultiPolygon': {
            const geom: GeoJSON.MultiPolygon = geometry;
            convertMultiPolygonFeature(features, id, geom, tolerance, properties);
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

function convertGeometryCollection(features: GeoJSONVTFeature[], geojson: GeoJSON.Feature, geometry: GeoJSON.GeometryCollection, options: GeoJSONVTOptions, index?: number) {
    for (const geom of geometry.geometries) {
        convertFeature(features, {
            id: geojson.id,
            type: 'Feature',
            geometry: geom,
            properties: geojson.properties
        }, options, index);
    }
}

function convertPointFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geometry: GeoJSON.Point, properties: GeoJSON.GeoJsonProperties) {
    const geom: StartEndSizeArray = [];
    convertPoint(geometry.coordinates, geom);
    features.push(createFeature(id, 'Point', geom, properties));
}

function convertMultiPointFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geometry: GeoJSON.MultiPoint, properties: GeoJSON.GeoJsonProperties) {
    const geom: StartEndSizeArray = [];
    for (const point of geometry.coordinates) {
        convertPoint(point, geom);
    }
    features.push(createFeature(id, 'MultiPoint', geom, properties));
}

function convertLineStringFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geometry: GeoJSON.LineString, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const geom: StartEndSizeArray = [];
    convertLine(geometry.coordinates, geom, tolerance, false);
    features.push(createFeature(id, 'LineString', geom, properties));
}

function convertMultiLineStringFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geometry: GeoJSON.MultiLineString, tolerance: number, options: GeoJSONVTOptions, properties: GeoJSON.GeoJsonProperties) {
    if (options.lineMetrics) {
        for (const line of geometry.coordinates) {
            const geom: StartEndSizeArray = [];
            convertLine(line, geom, tolerance, false);
            features.push(createFeature(id, 'LineString', geom, properties));
        }
        return;
    }

    const geom: StartEndSizeArray[] = [];
    convertLines(geometry.coordinates, geom, tolerance, false);
    features.push(createFeature(id, 'MultiLineString', geom, properties));
}

function convertPolygonFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geometry: GeoJSON.Polygon, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const geom: StartEndSizeArray[] = [];
    convertLines(geometry.coordinates, geom, tolerance, true);
    features.push(createFeature(id, 'Polygon', geom, properties));
}

function convertMultiPolygonFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geometry: GeoJSON.MultiPolygon, tolerance: number, properties: GeoJSON.GeoJsonProperties) {
    const geom: StartEndSizeArray[][] = [];
    for (const polygon of geometry.coordinates) {
        const newPolygon: StartEndSizeArray[] = [];
        convertLines(polygon, newPolygon, tolerance, true);
        geom.push(newPolygon);
    }
    features.push(createFeature(id, 'MultiPolygon', geom, properties));
}

function convertPoint(coords: GeoJSON.Position, out: number[]) {
    out.push(projectX(coords[0]), projectY(coords[1]), 0);
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
