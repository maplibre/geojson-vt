import {mercatorWorldCoordinateHelper, type WorldCoordinateHelper} from './world-coordinate-helper';
import type {GeoJSONVTInternalFeature, GeoJSONVTSourceCoords} from './definitions';

/**
 * Converts internal source features back to GeoJSON format.
 */
export function convertToGeoJSON(source: GeoJSONVTInternalFeature[], worldCoordinateHelper: WorldCoordinateHelper = mercatorWorldCoordinateHelper): GeoJSON.GeoJSON {
    const geojson: GeoJSON.GeoJSON = {
        type: 'FeatureCollection',
        features: source.map(feature => featureToGeoJSON(feature, worldCoordinateHelper))
    };

    return geojson;
}

/**
 * Converts a single internal feature to GeoJSON format.
 */
export function featureToGeoJSON(feature: GeoJSONVTInternalFeature, worldCoordinateHelper: WorldCoordinateHelper = mercatorWorldCoordinateHelper): GeoJSON.Feature {
    const geojsonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: geometryToGeoJSON(feature, worldCoordinateHelper),
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
function geometryToGeoJSON(feature: GeoJSONVTInternalFeature, worldCoordinateHelper: WorldCoordinateHelper): GeoJSON.Geometry {
    switch (feature.type) {
        case 'Point':
            return {
                type: feature.type,
                coordinates: [worldCoordinateHelper.unprojectX(feature.x), worldCoordinateHelper.unprojectY(feature.y)]
            };
        case 'MultiPoint':
            return {
                type: feature.type,
                coordinates: unprojectPoints(feature.geometry, 0, feature.geometry.length, worldCoordinateHelper)
            };
        case 'LineString':
            return {
                type: feature.type,
                coordinates: unprojectRings(feature.geometry, worldCoordinateHelper)[0]
            };
        case 'MultiLineString':
        case 'Polygon':
            return {
                type: feature.type,
                coordinates: unprojectRings(feature.geometry, worldCoordinateHelper)
            };
        case 'MultiPolygon':
            return {
                type: feature.type,
                coordinates: unprojectPolygons(feature.geometry, worldCoordinateHelper)
            };
    }
}

function unprojectRings(coords: GeoJSONVTSourceCoords, worldCoordinateHelper: WorldCoordinateHelper): GeoJSON.Position[][] {
    const rings: GeoJSON.Position[][] = [];

    for (let i = 0; i < coords.length;) {
        const ringEnd = i + 2 + coords[i] * 3;
        rings.push(unprojectPoints(coords, i + 2, ringEnd, worldCoordinateHelper));
        i = ringEnd;
    }

    return rings;
}

/**
 * The rings in groups of one polygon each, where a ring with a negative size is a hole of the polygon before it.
 */
function unprojectPolygons(coords: GeoJSONVTSourceCoords, worldCoordinateHelper: WorldCoordinateHelper): GeoJSON.Position[][][] {
    const polygons: GeoJSON.Position[][][] = [];

    for (let i = 0; i < coords.length;) {
        const ringEnd = i + 2 + coords[i] * 3;
        const ring = unprojectPoints(coords, i + 2, ringEnd, worldCoordinateHelper);
        if (coords[i + 1] >= 0 || !polygons.length) {
            polygons.push([ring]);
        } else {
            polygons[polygons.length - 1].push(ring);
        }
        i = ringEnd;
    }

    return polygons;
}

function unprojectPoints(coords: GeoJSONVTSourceCoords, start: number, end: number, worldCoordinateHelper: WorldCoordinateHelper): GeoJSON.Position[] {
    const result: GeoJSON.Position[] = [];

    for (let i = start; i < end; i += 3) {
        result.push([worldCoordinateHelper.unprojectX(coords[i]), worldCoordinateHelper.unprojectY(coords[i + 1])]);
    }

    return result;
}
