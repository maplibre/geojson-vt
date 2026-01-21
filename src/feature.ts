import type { GeoJSONVTInternalFeature, GeometryType, GeometryTypeMap } from "./definitions";

export type SupportedGeometries = GeoJSON.Point | GeoJSON.MultiPoint | GeoJSON.LineString | GeoJSON.MultiLineString | GeoJSON.Polygon | GeoJSON.MultiPolygon;

/**
 * 
 * @param id - the feature's ID
 * @param type - the feature's type
 * @param geom - the feature's geometry
 * @param tags - the feature's properties
 * @returns the created feature
 */
export function createFeature<T extends GeometryType>(id: number | string | undefined, type: T, geom: GeometryTypeMap[T], tags: GeoJSON.GeoJsonProperties): GeoJSONVTFeature {
    const feature = {
        id: id == null ? null : id,
        type: type,
        geometry: geom,
        tags: tags,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    } as GeoJSONVTInternalFeature;

    switch (type) {
        case 'Point':
        case 'MultiPoint':
        case 'LineString':
            calcLineBBox(feature, geom as StartEndSizeArray);
            break;

        case 'Polygon':
            // the outer ring (ie [0]) contains all inner rings
            calcLineBBox(feature, geom[0] as StartEndSizeArray);
            break;

        case 'MultiLineString':
            for (const line of geom) {
                calcLineBBox(feature, line as StartEndSizeArray);
            }
            break;

        case 'MultiPolygon':
            for (const polygon of geom as StartEndSizeArray[][]) {
                // the outer ring (ie [0]) contains all inner rings
                calcLineBBox(feature, polygon[0] as StartEndSizeArray);
            }
            break;
    }

    return feature;
}

export function getFeatureBounds(feature: GeoJSONVTFeature): BoundLimits {
    const {minX, maxX, minY, maxY} = feature;
    return {minX, maxX, minY, maxY};
}

function calcLineBBox(feature: GeoJSONVTFeature, geom: number[] | StartEndSizeArray) {
    for (let i = 0; i < geom.length; i += 3) {
        feature.minX = Math.min(feature.minX, geom[i]);
        feature.minY = Math.min(feature.minY, geom[i + 1]);
        feature.maxX = Math.max(feature.maxX, geom[i]);
        feature.maxY = Math.max(feature.maxY, geom[i + 1]);
    }
}
