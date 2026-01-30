import type { GeoJSONVTInternalFeature } from './definitions';

/**
 * Converts internal features back to GeoJSON format.
 */
export function deconvert(source: GeoJSONVTInternalFeature[]): GeoJSON.GeoJSON {
    if (!source?.length) return featureCollection([]);

    const features: GeoJSON.Feature[] = [];
    for (const feature of source) {
        features.push(deconvertFeature(feature));
    }

    return featureCollection(features);
}

/**
 * Converts a single internal feature back to GeoJSON format.
 */
export function deconvertFeature(feature: GeoJSONVTInternalFeature): GeoJSON.Feature {
    const geojsonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: convertGeometry(feature),
        properties: feature.tags
    };
    if (feature.id != null) {
        geojsonFeature.id = feature.id;
    }

    return geojsonFeature;
}

/**
 * Converts a single internal feature geometry back to GeoJSON format.
 */
function convertGeometry(feature: GeoJSONVTInternalFeature): GeoJSON.Geometry {
    const {type, geometry} = feature;

    switch (type) {
        case 'Point':
            return {
                type: type,
                coordinates: unprojectPoint(geometry[0], geometry[1])
            };
        case 'MultiPoint':
        case 'LineString':
            return {
                type: type,
                coordinates: unprojectPoints(geometry)
            };
        case 'MultiLineString':
        case 'Polygon':
            return {
                type: type,
                coordinates: geometry.map(ring => unprojectPoints(ring))
            };
        case 'MultiPolygon':
            return {
                type: type,
                coordinates: geometry.map(polygon =>
                    polygon.map(ring => unprojectPoints(ring))
                )
            };
    }
}

export function unprojectPoints(coords: number[]): GeoJSON.Position[] {
    const result: GeoJSON.Position[] = [];

    for (let i = 0; i < coords.length; i += 3) {
        result.push(unprojectPoint(coords[i], coords[i + 1]));
    }

    return result;
}

function unprojectPoint(x: number, y: number): GeoJSON.Position {
    return [unprojectX(x), unprojectY(y)];
}

export function unprojectX(x: number) {
    return (x - 0.5) * 360;
}

export function unprojectY(y: number) {
    const y2 = (0.5 - y) * 2 * Math.PI;
    return (Math.atan(Math.exp(y2)) * 2 - Math.PI / 2) * 180 / Math.PI;
}

function featureCollection(features: GeoJSON.Feature[]): GeoJSON.GeoJSON {
    return {type: 'FeatureCollection', features};
}
