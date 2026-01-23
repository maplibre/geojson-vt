import type { GVTTile, GVTTileFeature, GVTTilePointFeature, GVTTileNonPointFeature } from './tile';

type TransformedPoint = [number, number][];
type TransformedNonPoint = [number, number][][];

/** Represents a transformed point feature for tile output */
export type TransformedPointFeature = {
    id? : number | string | undefined;
    type: 1;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: TransformedPoint
}

/** Represents a transformed non-point feature for tile output */
export type TransformedNonPointFeature = {
    id? : number | string | undefined;
    type: 2 | 3;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: TransformedNonPoint
}

export type TransformedFeature = TransformedPointFeature | TransformedNonPointFeature;

export type TransformedTile = GVTTile & {
    transformed: true;
    features: TransformedFeature[]
}

/**
 * Transforms the coordinates of each feature in the given tile from
 * mercator-projected space into (extent x extent) tile space.
 * @param tile - the tile to transform, this gets modified in place
 * @param extent - the tile extent (usually 4096)
 * @returns the transformed tile
 */
export function transformTile(tile: GVTTile | TransformedTile, extent: number): TransformedTile {
    if (tile.transformed) {
        return tile as TransformedTile;
    }
    const gvtTile = tile as GVTTile;

    const z2 = 1 << tile.z;
    const tx = tile.x;
    const ty = tile.y;

    const newTile: TransformedTile = {
        ...gvtTile,
        transformed: true,
        features: []
    };
    for (const feature of gvtTile.features) {
        newTile.features.push(transformFeature(feature, extent, z2, tx, ty));
    }

    return newTile;
}

/**
 * Transforms a single feature from mercator-projected space into (extent x extent) tile space.
 */
function transformFeature(feature: GVTTileFeature, extent: number, z2: number, tx: number, ty: number): TransformedFeature {
    if (feature.type === 1) {
        return transformPointFeature(feature, extent, z2, tx, ty);
    }
    return transformNonPointFeature(feature, extent, z2, tx, ty);
}

/**
 * Transforms a single point feature from mercator-projected space into (extent x extent) tile space.
 */
function transformPointFeature(feature: GVTTilePointFeature, extent: number, z2: number, tx: number, ty: number): TransformedPointFeature {
    const newFeature: TransformedPointFeature = {
        id: feature.id,
        type: 1,
        tags: feature.tags,
        geometry: []
    };

    for (let i = 0; i < feature.geometry.length; i += 2) {
        newFeature.geometry.push(transformPoint(feature.geometry[i], feature.geometry[i + 1], extent, z2, tx, ty));
    }

    return newFeature;
}

/**
 * Transforms a single non-point feature from mercator-projected space into (extent x extent) tile space.
 */
function transformNonPointFeature(feature: GVTTileNonPointFeature, extent: number, z2: number, tx: number, ty: number): TransformedNonPointFeature {
    const newFeature: TransformedNonPointFeature = {
        id: feature.id,
        type: feature.type,
        tags: feature.tags,
        geometry: []
    };

    for (const geom of feature.geometry) {
        const ring: TransformedPoint = [];
        
        for (let i = 0; i < geom.length; i += 2) {
            ring.push(transformPoint(geom[i], geom[i + 1], extent, z2, tx, ty));
        }
        
        newFeature.geometry.push(ring);
    }

    return newFeature;
}

function transformPoint(x: number, y: number, extent: number, z2: number, tx: number, ty: number): [number, number] {
    return [
        Math.round(extent * (x * z2 - tx)),
        Math.round(extent * (y * z2 - ty))
    ];
}
