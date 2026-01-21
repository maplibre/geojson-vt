
import {simplify} from './simplify';
import {createFeature} from './feature';
import type { GeoJSONVTFeature, GeoJSONVTOptions, StartEndSizeArray } from './definitions';

/**
 * converts GeoJSON feature into an intermediate projected JSON vector format with simplification data
 * @param data
 * @param options
 * @returns
 */
export function convert(data: GeoJSON.GeoJSON, options: GeoJSONVTOptions): GeoJSONVTFeature[] {
    const features: GeoJSONVTFeature[] = [];

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

function convertFeature(features: GeoJSONVTFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number) {
    if (!geojson.geometry) return;

    if (geojson.geometry.type === 'GeometryCollection') {
        convertGeometryCollection(features, geojson, options, index);
        return;
    }

    const coords = geojson.geometry.coordinates;
    if (!coords?.length) return;

    const id = getFeatureId(geojson, options, index);
    const tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);

    switch (geojson.geometry.type) {
        case 'Point':
            convertPointFeature(features, id, geojson);
            break;

        case 'MultiPoint':
            convertMultiPointFeature(features, id, geojson);
            break;

        case 'LineString':
            convertLineStringFeature(features, id, geojson, tolerance);
            break;

        case 'MultiLineString':
            convertMultiLineStringFeature(features, id, geojson, tolerance, options);
            break;

        case 'Polygon':
            convertPolygonFeature(features, id, geojson, tolerance);
            break;

        case 'MultiPolygon':
            convertMultiPolygonFeature(features, id, geojson, tolerance);
            break;

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

function convertGeometryCollection(features: GeoJSONVTFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number) {
    const collection = geojson.geometry as GeoJSON.GeometryCollection;
    
    for (const geometry of collection.geometries) {
        convertFeature(features, {
            id: geojson.id,
            type: 'Feature',
            geometry: geometry,
            properties: geojson.properties
        }, options, index);
    }
}

function convertPointFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geojson: GeoJSON.Feature) {
    const geom: StartEndSizeArray = [];
    
    convertPoint((geojson.geometry as GeoJSON.Point).coordinates, geom);
    
    features.push(createFeature(id, 'Point', geom, geojson.properties));
}

function convertMultiPointFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geojson: GeoJSON.Feature) {
    const geom: StartEndSizeArray = [];

    for (const point of (geojson.geometry as GeoJSON.MultiPoint).coordinates) {
        convertPoint(point, geom);
    }

    features.push(createFeature(id, 'MultiPoint', geom, geojson.properties));
}

function convertLineStringFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geojson: GeoJSON.Feature, tolerance: number) {
    const geom: StartEndSizeArray = [];
    
    convertLine((geojson.geometry as GeoJSON.LineString).coordinates, geom, tolerance, false);
    
    features.push(createFeature(id, 'LineString', geom, geojson.properties));
}

function convertMultiLineStringFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geojson: GeoJSON.Feature, tolerance: number, options: GeoJSONVTOptions) {
    // explode into line strings to track metrics
    if (options.lineMetrics) {
        for (const line of (geojson.geometry as GeoJSON.MultiLineString).coordinates) {
            const geom: StartEndSizeArray = [];
            convertLine(line, geom, tolerance, false);
            features.push(createFeature(id, 'LineString', geom, geojson.properties));
        }
        return;
    }

    const geom: StartEndSizeArray[] = [];
    convertLines((geojson.geometry as GeoJSON.MultiLineString).coordinates, geom, tolerance, false);
    features.push(createFeature(id, 'MultiLineString', geom, geojson.properties));
}

function convertPolygonFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geojson: GeoJSON.Feature, tolerance: number) {
    const geom: StartEndSizeArray[] = [];
    
    convertLines((geojson.geometry as GeoJSON.Polygon).coordinates, geom, tolerance, true);
    
    features.push(createFeature(id, 'Polygon', geom, geojson.properties));
}

function convertMultiPolygonFeature(features: GeoJSONVTFeature[], id: number | string | undefined, geojson: GeoJSON.Feature, tolerance: number) {
    const geom: StartEndSizeArray[][] = [];

    for (const polygon of (geojson.geometry as GeoJSON.MultiPolygon).coordinates) {
        const newPolygon: StartEndSizeArray[] = [];
        convertLines(polygon, newPolygon, tolerance, true);
        geom.push(newPolygon);
    }

    features.push(createFeature(id, 'MultiPolygon', geom, geojson.properties));
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
