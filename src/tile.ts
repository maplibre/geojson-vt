import type { GeoJSONVTInternalFeature, GeoJSONVTOptions, StartEndSizeArray } from "./definitions";

export type GeoJSONVTInternalTileFeaturePoint = {
    id? : number | string | undefined;
    type: 1;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: number[];
}

export type GeoJSONVTInternalTileFeaturNonPoint = {
    id? : number | string | undefined;
    type: 2 | 3;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: number[][];
}
export type GeoJSONVTInternalTileFeature = GeoJSONVTInternalTileFeaturePoint | GeoJSONVTInternalTileFeaturNonPoint;

export type GeoJSONVTInternalTile = {
    features: GeoJSONVTInternalTileFeature[];
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
    source: GeoJSONVTInternalFeature[] | null;
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
export function createTile(features: GeoJSONVTInternalFeature[], z: number, tx: number, ty: number, options: GeoJSONVTOptions): GeoJSONVTInternalTile {
    const tolerance = z === options.maxZoom ? 0 : options.tolerance / ((1 << z) * options.extent);

    const tile = {
        features: [] as GeoJSONVTInternalTileFeature[],
        numPoints: 0,
        numSimplified: 0,
        numFeatures: features.length,
        source: null as GeoJSONVTInternalFeature[] | null,
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

function addFeature(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalFeature, tolerance: number, options: GeoJSONVTOptions) {
    tile.minX = Math.min(tile.minX, feature.minX);
    tile.minY = Math.min(tile.minY, feature.minY);
    tile.maxX = Math.max(tile.maxX, feature.maxX);
    tile.maxY = Math.max(tile.maxY, feature.maxY);

    let tags = feature.tags || null;

    let tileFeature: GeoJSONVTInternalTileFeature;

    switch (feature.type) {
        case 'Point':
        case 'MultiPoint': {
            const geometry: number[] = [];
            for (let i = 0; i < feature.geometry.length; i += 3) {
                geometry.push(feature.geometry[i] , feature.geometry[i + 1]);
                tile.numPoints++;
                tile.numSimplified++;
            }
            if (!geometry.length) return;
            tileFeature = {
                type: 1,
                tags: tags,
                geometry: geometry
            }
            break;
        }
        case 'LineString': {
            const geometry: number[][] = [];
            addLine(geometry, feature.geometry, tile, tolerance, false, false);
            if (!geometry.length) return;
            if (options.lineMetrics) {
                tags = {};
                for (const key in feature.tags) tags[key] = feature.tags[key];
                // HM TODO: replace with geojsonvt
                tags['mapbox_clip_start'] = feature.geometry.start / feature.geometry.size;
                tags['mapbox_clip_end'] = feature.geometry.end / feature.geometry.size;
            }
            tileFeature = {
                type: 2,
                tags: tags,
                geometry: geometry
            }
            break;
        }
        case 'MultiLineString':
        case 'Polygon': {
            const geometry: number[][] = [];
            for (let i = 0; i < feature.geometry.length; i++) {
                addLine(geometry, feature.geometry[i], tile, tolerance, feature.type === 'Polygon', i === 0);
            }
            if (!geometry.length) return;
            tileFeature = {
                type: feature.type === 'Polygon' ? 3 : 2,
                tags: tags,
                geometry: geometry
            }
            break;
        }
        case 'MultiPolygon': {
            const geometry: number[][] = [];
            for (let k = 0; k < feature.geometry.length; k++) {
                const polygon = feature.geometry[k];
                for (let i = 0; i < polygon.length; i++) {
                    addLine(geometry, polygon[i], tile, tolerance, true, i === 0);
                }
            }
            if (!geometry.length) return;
            tileFeature = {
                type: 3,
                tags: tags,
                geometry: geometry
            }
            break;
        }
    }

    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }

    tile.features.push(tileFeature);
}

function addLine(result: number[][], geom: StartEndSizeArray, tile: GeoJSONVTInternalTile, tolerance: number, isPolygon: boolean, isOuter: boolean) {
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
