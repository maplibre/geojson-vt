import type { GeoJSONVTInternalFeature } from './definitions';

/**
 * Converts a single internal feature to GeoJSON format.
 */
export function featureToGeoJSON(feature: GeoJSONVTInternalFeature): GeoJSON.Feature {
    const geojsonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: geometryToGeoJSON(feature),
        properties: feature.tags
    };
    if (feature.id != null) {
        geojsonFeature.id = feature.id;
    }

    return geojsonFeature;
}

/**
 * Converts a single internal feature geometry to GeoJSON format.
 */
function geometryToGeoJSON(feature: GeoJSONVTInternalFeature): GeoJSON.Geometry {
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
