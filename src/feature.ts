
import type {GVTFeature, GVTPointFeature, GVTMultiPointFeature, GVTLineStringFeature, GVTMultiLineStringFeature, GVTPolygonFeature, GVTMultiPolygonFeature, BoundLimits, StartEndSizeArray} from './definitions';

const infiniteBounds: BoundLimits = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
};

export function createPointFeature(id: number | string | undefined, geom: number[], tags: GeoJSON.GeoJsonProperties): GVTPointFeature {
    const feature: GVTPointFeature = {
        id: id ?? null,
        type: 'Point',
        geometry: geom,
        tags: tags,
        ...infiniteBounds
    };
    calcLineBBox(feature, geom);
    return feature;
}

export function createMultiPointFeature(id: number | string | undefined, geom: number[], tags: GeoJSON.GeoJsonProperties): GVTMultiPointFeature {
    const feature: GVTMultiPointFeature = {
        id: id ?? null,
        type: 'MultiPoint',
        geometry: geom,
        tags: tags,
        ...infiniteBounds
    };
    calcLineBBox(feature, geom);
    return feature;
}

export function createLineStringFeature(id: number | string | undefined, geom: StartEndSizeArray, tags: GeoJSON.GeoJsonProperties): GVTLineStringFeature {
    const feature: GVTLineStringFeature = {
        id: id ?? null,
        type: 'LineString',
        geometry: geom,
        tags: tags,
        ...infiniteBounds
    };
    calcLineBBox(feature, geom);
    return feature;
}

export function createMultiLineStringFeature(id: number | string | undefined, geom: StartEndSizeArray[], tags: GeoJSON.GeoJsonProperties): GVTMultiLineStringFeature {
    const feature: GVTMultiLineStringFeature = {
        id: id ?? null,
        type: 'MultiLineString',
        geometry: geom,
        tags: tags,
        ...infiniteBounds
    };
    for (const line of geom) {
        calcLineBBox(feature, line);
    }
    return feature;
}

export function createPolygonFeature(id: number | string | undefined, geom: StartEndSizeArray[], tags: GeoJSON.GeoJsonProperties): GVTPolygonFeature {
    const feature: GVTPolygonFeature = {
        id: id ?? null,
        type: 'Polygon',
        geometry: geom,
        tags: tags,
        ...infiniteBounds
    };
    // the outer ring (ie [0]) contains all inner rings
    calcLineBBox(feature, geom[0]);
    return feature;
}

export function createMultiPolygonFeature(id: number | string | undefined, geom: StartEndSizeArray[][], tags: GeoJSON.GeoJsonProperties): GVTMultiPolygonFeature {
    const feature: GVTMultiPolygonFeature = {
        id: id ?? null,
        type: 'MultiPolygon',
        geometry: geom,
        tags: tags,
        ...infiniteBounds

    };
    for (const polygon of geom) {
        // the outer ring (ie [0]) contains all inner rings
        calcLineBBox(feature, polygon[0]);
    }
    return feature;
}

function calcLineBBox(feature: GVTFeature, geom: number[] | StartEndSizeArray) {
    for (let i = 0; i < geom.length; i += 3) {
        feature.minX = Math.min(feature.minX, geom[i]);
        feature.minY = Math.min(feature.minY, geom[i + 1]);
        feature.maxX = Math.max(feature.maxX, geom[i]);
        feature.maxY = Math.max(feature.maxY, geom[i + 1]);
    }
}