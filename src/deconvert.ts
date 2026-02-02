import type {GeoJSONVTInternalFeature} from './definitions';

/**
 * Converts internal source features back to GeoJSON format.
 */
export function convertToGeoJSON(source: GeoJSONVTInternalFeature[]): GeoJSON.GeoJSON {
    const geojson: GeoJSON.GeoJSON = {
        type: 'FeatureCollection',
        features: source.map(feature => featureToGeoJSON(feature))
    };

    return geojson;
}

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

/**
 * Convert spherical mercator in [0..1] range to longitude
 */
export function unprojectX(x: number): number {
    return (x - 0.5) * 360;
}

/**
 * Convert spherical mercator in [0..1] range to latitude
 */
export function unprojectY(y: number): number {
    const y2 = (180 - y * 360) * Math.PI / 180;
    return 360 * Math.atan(Math.exp(y2)) / Math.PI - 90;
}
