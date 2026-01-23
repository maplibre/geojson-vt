import type {GVTFeature, GeoJSONVTOptions, StartEndSizeArray} from './definitions';

type GVTTilePoint = number[];
type GVTTileNonPoint = number[][];

type GVTPointTypes = 'Point' | 'MultiPoint';
type GVTNonPointTypes = 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';

export type GVTTilePointFeature = {
    id? : number | string | undefined;
    type: 1;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: GVTTilePoint;
}

export type GVTTileNonPointFeature = {
    id? : number | string | undefined;
    type: 2 | 3;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: GVTTileNonPoint;
}

export type GVTTileFeature = GVTTilePointFeature | GVTTileNonPointFeature;

/**
 * A tile object representing a geojson-vt tile.
 */
export type GVTTile = {
    features: GVTTileFeature[];
    numPoints: number;
    numSimplified: number;
    numFeatures: number;
    x: number;
    y: number;
    z: number;
    transformed: boolean;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    source: GVTFeature[] | null;
}

/**
 * Creates a tile object from the given features
 * @param features - the features to include in the tile
 * @param z
 * @param tx
 * @param ty
 * @param options - the options object
 * @returns the created tile
 */
export function createTile(features: GVTFeature[], z: number, tx: number, ty: number, options: GeoJSONVTOptions): GVTTile {
    const tolerance = z === options.maxZoom ? 0 : options.tolerance / ((1 << z) * options.extent);

    const tile: GVTTile = {
        features: [],
        numPoints: 0,
        numSimplified: 0,
        numFeatures: features.length,
        source: null,
        x: tx,
        y: ty,
        z,
        transformed: false,
        minX: 2,
        minY: 1,
        maxX: -1,
        maxY: 0
    };

    for (const feature of features) {
        addFeature(tile, feature, tolerance, options);
    }

    return tile;
}

function addFeature(tile: GVTTile, feature: GVTFeature, tolerance: number, options: GeoJSONVTOptions) {
    // Update the tile bounds with respect to the current feature
    tile.minX = Math.min(tile.minX, feature.minX);
    tile.minY = Math.min(tile.minY, feature.minY);
    tile.maxX = Math.max(tile.maxX, feature.maxX);
    tile.maxY = Math.max(tile.maxY, feature.maxY);

    const tags = getFeatureTags(feature, options);
    const id = feature.id !== null ? feature.id : undefined;

    if (feature.type === 'Point' || feature.type === 'MultiPoint') {
        addPointFeature(tile, feature, tags, id);
    } else {
        addNonPointFeature(tile, feature, tolerance, tags, id);
    }
}

function addPointFeature(tile: GVTTile, feature: GVTFeature & {type: GVTPointTypes}, tags: GeoJSON.GeoJsonProperties | null, id: number | string | undefined) {
    const geometry = simplifyPointGeometry(feature, tile);
    if (!geometry.length) return;

    const tileFeature: GVTTilePointFeature = {type: 1, geometry, tags};
    if (id !== undefined) tileFeature.id = id;

    tile.features.push(tileFeature);
}

function addNonPointFeature(tile: GVTTile, feature: GVTFeature & {type: GVTNonPointTypes}, tolerance: number, tags: GeoJSON.GeoJsonProperties | null, id: number | string | undefined) {
    const geometry = simplifyNonPointGeometry(feature, tile, tolerance);
    if (!geometry.length) return;

    const tileFeature: GVTTileNonPointFeature = {type: getNonPointFeatureType(feature.type), geometry, tags};
    if (id !== undefined) tileFeature.id = id;

    tile.features.push(tileFeature);
}

function simplifyPointGeometry(feature: GVTFeature & {type: GVTPointTypes}, tile: GVTTile): GVTTilePoint {
    const simplified: GVTTilePoint = [];
    addPoint(simplified, feature.geometry, tile);
    return simplified;
}

function simplifyNonPointGeometry(feature: GVTFeature & {type: GVTNonPointTypes}, tile: GVTTile, tolerance: number): GVTTileNonPoint {
    const simplified: GVTTileNonPoint = [];
    const {type, geometry} = feature;

    switch (type) {
        case 'LineString':
            addLine(simplified, geometry, tile, tolerance, false, false);
            break;

        case 'MultiLineString':
        case 'Polygon':
            for (let i = 0; i < geometry.length; i++) {
                addLine(simplified, geometry[i], tile, tolerance, type === 'Polygon', i === 0);
            }
            break;

        case 'MultiPolygon':
            for (let k = 0; k < geometry.length; k++) {
                const polygon = geometry[k];
                for (let i = 0; i < polygon.length; i++) {
                    addLine(simplified, polygon[i], tile, tolerance, true, i === 0);
                }
            }
            break;
    }

    return simplified;
}

function addPoint(simplified: GVTTilePoint, geometry: GVTTilePoint, tile: GVTTile): void {
    for (let i = 0; i < geometry.length; i += 3) {
        simplified.push(geometry[i], geometry[i + 1]);
        tile.numPoints++;
        tile.numSimplified++;
    }
}

function addLine(result: GVTTileNonPoint, geom: StartEndSizeArray, tile: GVTTile, tolerance: number, isPolygon: boolean, isOuter: boolean) {
    const sqTolerance = tolerance * tolerance;

    if (tolerance > 0 && (geom.size < (isPolygon ? sqTolerance : tolerance))) {
        tile.numPoints += geom.length / 3;
        return;
    }

    const ring = [];

    for (let i = 0; i < geom.length; i += 3) {
        if (tolerance === 0 || geom[i + 2] > sqTolerance) {
            tile.numSimplified++;
            ring.push(geom[i], geom[i + 1]);
        }
        tile.numPoints++;
    }

    if (isPolygon) rewind(ring, isOuter);

    result.push(ring);
}

function getFeatureTags(feature: GVTFeature, options: GeoJSONVTOptions): GeoJSON.GeoJsonProperties | null {
    let tags = feature.tags || null;

    if (feature.type === 'LineString' && options.lineMetrics) {
        tags = {};
        for (const key in feature.tags) tags[key] = feature.tags[key];
        // HM TODO: replace with geojsonvt
        tags['mapbox_clip_start'] = feature.geometry.start / feature.geometry.size;
        tags['mapbox_clip_end'] = feature.geometry.end / feature.geometry.size;
    }

    return tags;
}

function getNonPointFeatureType(featureType: GVTNonPointTypes): 2 | 3 {
    if (featureType === 'Polygon' || featureType === 'MultiPolygon') {
        return 3;
    }
    return 2;
}

function rewind(ring: number[], clockwise: boolean) {
    let area = 0;

    for (let i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
        area += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1]);
    }

    if (area > 0 !== clockwise) return;

    for (let i = 0, len = ring.length; i < len / 2; i += 2) {
        const x = ring[i];
        const y = ring[i + 1];

        ring[i] = ring[len - 2 - i];
        ring[i + 1] = ring[len - 1 - i];
        ring[len - 2 - i] = x;
        ring[len - 1 - i] = y;
    }
}
