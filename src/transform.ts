import type {GeoJSONVTInternalTile} from './tile';
import type {GeoJSONVTPoint} from './definitions';

export type GeoJSONVTTile = GeoJSONVTInternalTile & {
    transformed: true;
}

/**
 * Transforms the coordinates of each feature in the given tile from
 * mercator-projected space into (extent x extent) tile space.
 * @param tile - the tile to transform, this gets modified in place
 * @param extent - the tile extent (usually 4096)
 * @returns the transformed tile
 */
export function transformTile(tile: GeoJSONVTInternalTile, extent: number): GeoJSONVTTile {
    if (tile.transformed) {
        return tile as GeoJSONVTTile;
    }

    const z2 = 1 << tile.z;
    const tx = tile.x;
    const ty = tile.y;

    for (const feature of tile.features) {
        if (feature.type === 1) {
            for (const point of feature.geometry) {
                transformPoint(point, extent, z2, tx, ty);
            }
        } else {
            for (const ring of feature.geometry) {
                for (const point of ring) {
                    transformPoint(point, extent, z2, tx, ty);
                }
            }
        }
    }
    tile.transformed = true;

    return tile as GeoJSONVTTile;
}

/**
 * Transforms a point from mercator-projected space into (extent x extent) tile space.
 */
function transformPoint(point: GeoJSONVTPoint, extent: number, z2: number, tx: number, ty: number): void {
    point[0] = Math.round(extent * (point[0] * z2 - tx));
    point[1] = Math.round(extent * (point[1] * z2 - ty));
}
