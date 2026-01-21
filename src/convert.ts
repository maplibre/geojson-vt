
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
            convertFeature(features, {type: "Feature" as const, geometry: data, properties: undefined}, options);
    }

    return features;
}

function convertFeature(features: GeoJSONVTInternalFeature[], geojson: GeoJSON.Feature, options: GeoJSONVTOptions, index?: number) {
    if (!geojson.geometry) return;

    if (geojson.geometry.type === 'GeometryCollection') {
        for (const singleGeometry of geojson.geometry.geometries) {
            convertFeature(features, {
                id: geojson.id,
                type: 'Feature',
                geometry: singleGeometry,
                properties: geojson.properties
            }, options, index);
        }
        return;
    }

    const coords = geojson.geometry.coordinates;
    if (!coords?.length) return;

    const tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);
    let id = geojson.id;
    if (options.promoteId) {
        id = geojson.properties?.[options.promoteId];
    } else if (options.generateId) {
        id = index || 0;
    }

    switch (geojson.geometry.type) {
        case 'Point': {
            const pointGeometry: StartEndSizeArray = [];
            convertPoint(geojson.geometry.coordinates, pointGeometry);

            features.push(createFeature(id, geojson.geometry.type, pointGeometry, geojson.properties));
            return;
        }

        case 'MultiPoint': {
            const multiPointGeometry: StartEndSizeArray = [];
            for (const p of geojson.geometry.coordinates) {
                convertPoint(p, multiPointGeometry);
            }

            features.push(createFeature(id, geojson.geometry.type, multiPointGeometry, geojson.properties));
            return;
        }

        case 'LineString': {
            const lineGeometry: StartEndSizeArray = [];
            convertLine(geojson.geometry.coordinates, lineGeometry, tolerance, false);

            features.push(createFeature(id, geojson.geometry.type, lineGeometry, geojson.properties));
            return;
        }

        case 'MultiLineString': {
            if (options.lineMetrics) {
                // explode into linestrings in order to track metrics
                for (const line of geojson.geometry.coordinates) {
                    const lineGeometry: StartEndSizeArray = [];
                    convertLine(line, lineGeometry, tolerance, false);
                    features.push(createFeature(id, 'LineString', lineGeometry, geojson.properties));
                }
                return;
            }

            const multiLineGeometry: StartEndSizeArray[] = [];
            convertLines(geojson.geometry.coordinates, multiLineGeometry, tolerance, false);

            features.push(createFeature(id, geojson.geometry.type, multiLineGeometry, geojson.properties));
            return;
        }

        case 'Polygon': {
            const polygonGeometry: StartEndSizeArray[] = [];
            convertLines(geojson.geometry.coordinates, polygonGeometry, tolerance, true);

            features.push(createFeature(id, geojson.geometry.type, polygonGeometry, geojson.properties));
            return;
        }

        case 'MultiPolygon': {
            const multiPolygonGeometry: StartEndSizeArray[][] = [];
            for (const polygon of geojson.geometry.coordinates) {
                const newPolygon: StartEndSizeArray[] = [];
                convertLines(polygon, newPolygon, tolerance, true);
                multiPolygonGeometry.push(newPolygon);
            }

            features.push(createFeature(id, geojson.geometry.type, multiPolygonGeometry, geojson.properties));
            return;
        }

        default:
            throw new Error('Input data is not a valid GeoJSON object.');
    }
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
