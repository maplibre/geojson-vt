import type {GVTTile, GVTTileFeature, GVTTilePointFeature, GVTTileNonPointFeature, GVTTilePoint, GVTTileNonPoint, TransformedPoint, TransformedNonPoint} from './tile';

export type TransformedTile = Omit<GVTTile, 'transformed' | 'features'> & {
    transformed: true;
    features: GVTTileFeature[];
}

/**
 * Transforms the coordinates of each feature in the given tile from
 * mercator-projected space into (extent x extent) tile space.
 * @param tile - the tile to transform, this gets modified in place
 * @param extent - the tile extent (usually 4096)
 * @returns the transformed tile
 */
export function transformTile(tile: GVTTile, extent: number): TransformedTile {
    const z2 = 1 << tile.z;
    const tx = tile.x;
    const ty = tile.y;

    const transformed = tile as TransformedTile;
    for (const feature of transformed.features) {
        if (feature.type === 1) {
            transformPointFeature(feature, extent, z2, tx, ty);
        } else {
            transformNonPointFeature(feature, extent, z2, tx, ty);
        }
    }
    transformed.transformed = true;

    return transformed;
}

/**
 * Transforms a single point feature from mercator-projected space into (extent x extent) tile space.
 */
function transformPointFeature(feature: GVTTilePointFeature, extent: number, z2: number, tx: number, ty: number): GVTTilePointFeature {
    const transformed = feature as GVTTilePointFeature & {geometry: TransformedPoint};

    const geometry = feature.geometry as GVTTilePoint;
    const point: TransformedPoint = [];
    for (let i = 0; i < geometry.length; i += 2) {
        point.push(transformPoint(geometry[i], geometry[i + 1], extent, z2, tx, ty));
    }
    transformed.geometry = point;

    return transformed;
}

/**
 * Transforms a single non-point feature from mercator-projected space into (extent x extent) tile space.
 */
function transformNonPointFeature(feature: GVTTileNonPointFeature, extent: number, z2: number, tx: number, ty: number): GVTTileNonPointFeature {
    const transformed = feature as GVTTileNonPointFeature & {geometry: TransformedNonPoint};

    const geometry = feature.geometry as GVTTileNonPoint;
    const nonPoint: TransformedNonPoint = [];
    for (const geom of geometry) {
        const ring: TransformedPoint = [];
        for (let i = 0; i < geom.length; i += 2) {
            ring.push(transformPoint(geom[i], geom[i + 1], extent, z2, tx, ty));
        }
        nonPoint.push(ring);
    }
    transformed.geometry = nonPoint;

    return transformed;
}

function transformPoint(x: number, y: number, extent: number, z2: number, tx: number, ty: number): [number, number] {
    return [
        Math.round(extent * (x * z2 - tx)),
        Math.round(extent * (y * z2 - ty))
    ];
}
