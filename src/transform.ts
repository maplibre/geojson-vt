import type { GeoJSONVTFeature, GeoJSONVTInternalTile, GeoJSONVTInternalTileFeature, GeoJSONVTTile, GeoJSONVTTileCoords } from "./definitions";

/**
 * Turns a stored tile, which keeps its coordinates in flat arrays, into the tile `getTile` returns,
 * with every position as an `[x, y]` pair. The stored tile stays as it is.
 * @param tile - the stored tile
 * @returns a new tile with the coordinates as pairs
 */
export function transformTile(tile: GeoJSONVTInternalTile): GeoJSONVTTile {
    const features: GeoJSONVTFeature[] = [];
    for (const feature of tile.features) {
        features.push(transformFeature(feature));
    }

    return {features};
}

function transformFeature(feature: GeoJSONVTInternalTileFeature): GeoJSONVTFeature {
    let transformed: GeoJSONVTFeature;
    if (feature.type === 4) {
        transformed = {type: 1, tags: feature.tags, geometry: [[feature.x, feature.y]]};
    } else if (feature.type === 1) {
        transformed = {type: 1, tags: feature.tags, geometry: toPairs(feature.geometry)};
    } else {
        transformed = {type: feature.type, tags: feature.tags, geometry: feature.geometry.map(toPairs)};
    }
    if (feature.id !== undefined) {
        transformed.id = feature.id;
    }

    return transformed;
}

function toPairs(coords: GeoJSONVTTileCoords): [number, number][] {
    const pairs: [number, number][] = [];
    for (let i = 0; i < coords.length; i += 2) {
        pairs.push([coords[i], coords[i + 1]]);
    }

    return pairs;
}
