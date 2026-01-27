
import type {GeoJSONVTInternalFeature} from './definitions';
import {xLng, yLat} from './supercluster';

/**
 * Converts internal point features to GeoJSON Point features - non-point features are skipped.
 * @param features - array of internal features
 * @returns array of GeoJSON Point features
 */
export function toGeoJSONPoints(features: GeoJSONVTInternalFeature[]): GeoJSON.Feature<GeoJSON.Point>[] {
    const result: GeoJSON.Feature<GeoJSON.Point>[] = [];

    for (const feature of features) {
        if (feature.type !== 'Point') continue;

        // Convert mercator to lng/lat
        const lng = xLng(feature.geometry[0]);
        const lat = yLat(feature.geometry[1]);

        result.push({
            type: 'Feature',
            id: feature.id ?? undefined,
            properties: feature.tags,
            geometry: {
                type: 'Point',
                coordinates: [lng, lat]
            }
        });
    }

    return result;
}
