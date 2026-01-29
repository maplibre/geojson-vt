import type { GeoJSONVTInternalFeature } from './definitions';

/**
 * Converts internal features back to GeoJSON format.
 */
export function deconvert(source: GeoJSONVTInternalFeature[]): GeoJSON.GeoJSON {
    if (!source?.length) {
        return {type: 'FeatureCollection', features: []};
    }

    const features: GeoJSON.Feature[] = [];

    for (const feature of source) {
        const geojsonFeature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: convertGeometry(feature),
            properties: feature.tags
        };
        if (feature.id != null) {
            geojsonFeature.id = feature.id;
        }
        features.push(geojsonFeature);
    }

    return {type: 'FeatureCollection', features};
}

function convertGeometry(feature: GeoJSONVTInternalFeature): GeoJSON.Geometry {
    switch (feature.type) {
        case 'Point':
            return {
                type: feature.type,
                coordinates: unprojectPoint(feature.geometry[0], feature.geometry[1])
            };
        case 'MultiPoint':
        case 'LineString':
            return {
                type: feature.type,
                coordinates: unprojectPoints(feature.geometry)
            };
        case 'MultiLineString':
        case 'Polygon':
            return {
                type: feature.type,
                coordinates: feature.geometry.map(ring => unprojectPoints(ring))
            };
        case 'MultiPolygon':
            return {
                type: feature.type,
                coordinates: feature.geometry.map(polygon =>
                    polygon.map(ring => unprojectPoints(ring))
                )
            };
    }
}

function unprojectPoints(coords: number[]): GeoJSON.Position[] {
    const result: GeoJSON.Position[] = [];
    for (let i = 0; i < coords.length; i += 3) {
        result.push(unprojectPoint(coords[i], coords[i + 1]));
    }
    return result;
}

function unprojectPoint(x: number, y: number): GeoJSON.Position {
    const lng = (x - 0.5) * 360;
    const lat = (Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) * 2 - Math.PI / 2) * 180 / Math.PI;
    return [lng, lat];
}
