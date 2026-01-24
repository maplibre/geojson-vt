
import type {GVTFeature, GVTPointFeature, GVTMultiPointFeature, GVTLineStringFeature, GVTMultiLineStringFeature, GVTPolygonFeature, GVTMultiPolygonFeature, BoundLimits, StartEndSizeArray} from './definitions';

type FeatureTypeMap = {
    Point: GVTPointFeature;
    MultiPoint: GVTMultiPointFeature;
    LineString: GVTLineStringFeature;
    MultiLineString: GVTMultiLineStringFeature;
    Polygon: GVTPolygonFeature;
    MultiPolygon: GVTMultiPolygonFeature;
};

type FeatureGeometry = {
    [K in keyof FeatureTypeMap]: FeatureTypeMap[K]['geometry'];
};

function toGeom<T>(g: FeatureGeometry[keyof FeatureGeometry]): T {
    return <T>g;
}

const infiniteBounds: BoundLimits = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
};

export function createFeature<T extends GVTFeature['type']>(type: T, id: number | string | undefined, geometry: FeatureGeometry[T], tags: GeoJSON.GeoJsonProperties): GVTFeature {
    switch (type) {
        case 'Point': {
            const geom = toGeom<number[]>(geometry);
            return createPointFeature(id, geom, tags);
        }

        case 'MultiPoint': {
            const geom = toGeom<number[]>(geometry);
            return createMultiPointFeature(id, geom, tags);
        }

        case 'LineString': {
            const geom = toGeom<StartEndSizeArray>(geometry);
            return createLineStringFeature(id, geom, tags);
        }

        case 'MultiLineString': {
            const geom = toGeom<StartEndSizeArray[]>(geometry);
            return createMultiLineStringFeature(id, geom, tags);
        }

        case 'Polygon': {
            const geom = toGeom<StartEndSizeArray[]>(geometry);
            return createPolygonFeature(id, geom, tags);
        }

        case 'MultiPolygon': {
            const geom = toGeom<StartEndSizeArray[][]>(geometry);
            return createMultiPolygonFeature(id, geom, tags);
        }
    }
}

function createPointFeature(id: number | string | undefined, geom: number[], tags: GeoJSON.GeoJsonProperties): GVTPointFeature {
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

function createMultiPointFeature(id: number | string | undefined, geom: number[], tags: GeoJSON.GeoJsonProperties): GVTMultiPointFeature {
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

function createLineStringFeature(id: number | string | undefined, geom: StartEndSizeArray, tags: GeoJSON.GeoJsonProperties): GVTLineStringFeature {
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

function createMultiLineStringFeature(id: number | string | undefined, geom: StartEndSizeArray[], tags: GeoJSON.GeoJsonProperties): GVTMultiLineStringFeature {
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

function createPolygonFeature(id: number | string | undefined, geom: StartEndSizeArray[], tags: GeoJSON.GeoJsonProperties): GVTPolygonFeature {
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

function createMultiPolygonFeature(id: number | string | undefined, geom: StartEndSizeArray[][], tags: GeoJSON.GeoJsonProperties): GVTMultiPolygonFeature {
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