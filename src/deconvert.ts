import type {GeoJSONVTInternalFeature} from './definitions';

/**
 * Converts internal source features back to GeoJSON format.
 */
export function convertToGeoJSON(source: GeoJSONVTInternalFeature[], worldCoordinates = false): GeoJSON.GeoJSON {
    const geojson: GeoJSON.GeoJSON = {
        type: 'FeatureCollection',
        features: source.map(feature => featureToGeoJSON(feature, worldCoordinates))
    };

    return geojson;
}

/**
 * Converts a single internal feature to GeoJSON format.
 */
export function featureToGeoJSON(feature: GeoJSONVTInternalFeature, worldCoordinates = false): GeoJSON.Feature {
    const geojsonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: geometryToGeoJSON(feature, worldCoordinates),
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
function geometryToGeoJSON(feature: GeoJSONVTInternalFeature, worldCoordinates: boolean): GeoJSON.Geometry {
    const {type, geometry} = feature;

    switch (type) {
        case 'Point':
            return {
                type: type,
                coordinates: unprojectPoint(geometry[0], geometry[1], worldCoordinates)
            };
        case 'MultiPoint':
            return {
                type: type,
                coordinates: unprojectPoints(geometry, worldCoordinates)
            };
        case 'LineString':
            return {
                type: type,
                coordinates: unprojectPoints(geometry.points, worldCoordinates)
            };
        case 'MultiLineString':
        case 'Polygon':
            return {
                type: type,
                coordinates: geometry.map(ring => unprojectPoints(ring.points, worldCoordinates))
            };
        case 'MultiPolygon':
            return {
                type: type,
                coordinates: geometry.map(polygon =>
                    polygon.map(ring => unprojectPoints(ring.points, worldCoordinates))
                )
            };
    }
}

export function unprojectPoints(coords: number[] | Float64Array, worldCoordinates = false): GeoJSON.Position[] {
    const result: GeoJSON.Position[] = [];

    for (let i = 0; i < coords.length; i += 3) {
        result.push(unprojectPoint(coords[i], coords[i + 1], worldCoordinates));
    }

    return result;
}

function unprojectPoint(x: number, y: number, worldCoordinates: boolean): GeoJSON.Position {
    return [unprojectX(x, worldCoordinates), unprojectY(y, worldCoordinates)];
}

/**
 * Convert spherical mercator in [0..1] range to longitude, or keep a world coordinate as it is
 */
export function unprojectX(x: number, worldCoordinates = false): number {
    if (worldCoordinates) return x;
    return (x - 0.5) * 360;
}

/**
 * Convert spherical mercator in [0..1] range to latitude, or keep a world coordinate as it is
 */
export function unprojectY(y: number, worldCoordinates = false): number {
    if (worldCoordinates) return y;
    const y2 = (180 - y * 360) * Math.PI / 180;
    return 360 * Math.atan(Math.exp(y2)) / Math.PI - 90;
}
