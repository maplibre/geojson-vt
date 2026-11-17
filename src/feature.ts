import type { GeoJSONVTInternalFeature, GeoJSONVTInternalPointFeature, GeoJSONVTSourceCoords } from "./definitions";

type GeometryFeature = Exclude<GeoJSONVTInternalFeature, GeoJSONVTInternalPointFeature>;

/**
 *
 * @param id - the feature's ID
 * @param type - the feature's type
 * @param geom - the feature's coordinates, see {@link GeoJSONVTSourceCoords}
 * @param tags - the feature's properties
 * @returns the created feature
 */
export function createFeature<T extends GeometryFeature["type"]>(id: number | string | undefined, type: T, geom: GeoJSONVTSourceCoords, tags: GeoJSON.GeoJsonProperties): Extract<GeometryFeature, {type: T}> {
    const feature = {
        id: id == null ? null : id,
        type,
        geometry: geom,
        tags,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        offsetX: 0
    } as Extract<GeometryFeature, {type: T}>;

    if (type === 'MultiPoint') {
        calcBBox(feature, geom, 0, geom.length);
        return feature;
    }

    // the outer ring of a polygon contains its holes
    const outerOnly = type === 'Polygon' || type === 'MultiPolygon';
    for (let i = 0; i < geom.length;) {
        const end = i + 2 + geom[i] * 3;
        if (!outerOnly || geom[i + 1] >= 0) calcBBox(feature, geom, i + 2, end);
        i = end;
    }

    return feature;
}

export function createPointFeature(id: number | string | undefined, x: number, y: number, tags: GeoJSON.GeoJsonProperties): GeoJSONVTInternalPointFeature {
    return {
        id: id == null ? null : id,
        type: 'Point',
        x,
        y,
        tags
    };
}

export function getMinX(feature: GeoJSONVTInternalFeature): number {
    return feature.type === 'Point' ? feature.x : feature.minX;
}

export function getMinY(feature: GeoJSONVTInternalFeature): number {
    return feature.type === 'Point' ? feature.y : feature.minY;
}

export function getMaxX(feature: GeoJSONVTInternalFeature): number {
    return feature.type === 'Point' ? feature.x : feature.maxX;
}

export function getMaxY(feature: GeoJSONVTInternalFeature): number {
    return feature.type === 'Point' ? feature.y : feature.maxY;
}

function calcBBox(feature: GeometryFeature, geom: GeoJSONVTSourceCoords, start: number, end: number) {
    for (let i = start; i < end; i += 3) {
        feature.minX = Math.min(feature.minX, geom[i]);
        feature.minY = Math.min(feature.minY, geom[i + 1]);
        feature.maxX = Math.max(feature.maxX, geom[i]);
        feature.maxY = Math.max(feature.maxY, geom[i + 1]);
    }
}
