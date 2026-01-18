import type { GeoJSONVTOptions } from "./definitions";
import type { GeoJSONVTFeature, StartEndSizeArray } from "./feature";

export type GeoJSONVTTileFeature = {
    id? : number | string | undefined;
    type: 1 | 2 | 3;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: number[] | number[][];
}

export type GeoJSONVTTile = {
    features: GeoJSONVTTileFeature[];
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
    source: GeoJSONVTFeature[] | null;
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
export function createTile(features: GeoJSONVTFeature[], z: number, tx: number, ty: number, options: GeoJSONVTOptions): GeoJSONVTTile {
    const tolerance = z === options.maxZoom ? 0 : options.tolerance / ((1 << z) * options.extent);
    const tile: GeoJSONVTTile = {
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

function addFeature(tile: GeoJSONVTTile, feature: GeoJSONVTFeature, tolerance: number, options: GeoJSONVTOptions) {
    const simplified: number[] | number[][] = [];

    tile.minX = Math.min(tile.minX, feature.minX);
    tile.minY = Math.min(tile.minY, feature.minY);
    tile.maxX = Math.max(tile.maxX, feature.maxX);
    tile.maxY = Math.max(tile.maxY, feature.maxY);

    switch (feature.type) {
        case 'Point':
        case 'MultiPoint':
            for (let i = 0; i < feature.geometry.length; i += 3) {
                // HM TODO: fix this!
                simplified.push(feature.geometry[i] as any, feature.geometry[i + 1] as any);
                tile.numPoints++;
                tile.numSimplified++;
            }
            break;
        case 'LineString':
            addLine(simplified as number[][], feature.geometry, tile, tolerance, false, false);
            break;
        case 'MultiLineString':
        case 'Polygon':
            for (let i = 0; i < feature.geometry.length; i++) {
                addLine(simplified as number[][], feature.geometry[i]!, tile, tolerance, feature.type === 'Polygon', i === 0);
            }
            break;
        case 'MultiPolygon':
            for (let k = 0; k < feature.geometry.length; k++) {
                const polygon = feature.geometry[k]!;
                for (let i = 0; i < polygon.length; i++) {
                    addLine(simplified as number[][], polygon[i]!, tile, tolerance, true, i === 0);
                }
            }
            break;
    }

    if (simplified.length === 0) return;
    let tags = feature.tags || null;

    if (feature.type === 'LineString' && options.lineMetrics) {
        tags = {};
        for (const key in feature.tags) tags[key] = feature.tags[key];
        // HM TODO: replace with maplibre
        /* eslint-disable dot-notation */
        tags['mapbox_clip_start'] = feature.geometry.start! / feature.geometry.size!;
        tags['mapbox_clip_end'] = feature.geometry.end! / feature.geometry.size!;
        /* eslint-enable dot-notation */
    }

    const tileFeature: GeoJSONVTTileFeature = {
        geometry: simplified,
        type: feature.type === 'Polygon' || feature.type === 'MultiPolygon' ? 3 :
        (feature.type === 'LineString' || feature.type === 'MultiLineString' ? 2 : 1),
        tags
    };
    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }
    tile.features.push(tileFeature);
}

function addLine(result: number[][], geom: StartEndSizeArray, tile: GeoJSONVTTile, tolerance: number, isPolygon: boolean, isOuter: boolean) {
    const sqTolerance = tolerance * tolerance;

    if (tolerance > 0 && (geom.size! < (isPolygon ? sqTolerance : tolerance))) {
        tile.numPoints += geom.length / 3;
        return;
    }

    const ring: number[] = [];

    for (let i = 0; i < geom.length; i += 3) {
        if (tolerance === 0 || geom[i + 2]! > sqTolerance) {
            tile.numSimplified++;
            ring.push(geom[i]!, geom[i + 1]!);
        }
        tile.numPoints++;
    }

    if (isPolygon) rewind(ring, isOuter);

    result.push(ring);
}

function rewind(ring: number[], clockwise: boolean) {
    let area = 0;
    for (let i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
        area += (ring[i]! - ring[j]!) * (ring[i + 1]! + ring[j + 1]!);
    }
    if (area > 0 === clockwise) {
        for (let i = 0, len = ring.length; i < len / 2; i += 2) {
            const x = ring[i]!;
            const y = ring[i + 1]!;
            ring[i] = ring[len - 2 - i]!;
            ring[i + 1] = ring[len - 1 - i]!;
            ring[len - 2 - i] = x;
            ring[len - 1 - i] = y;
        }
    }
}
