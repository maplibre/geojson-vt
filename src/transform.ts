import type { GeoJSONVTTile } from "./tile";

export type GeoJSONVTTransformedTile = GeoJSONVTTile & {
    transformed: true;
    geometry: [number, number][] | [number, number][][];
}

/**
 * Transforms the coordinates of each feature in the given tile from
 * mercator-projected space into (extent x extent) tile space.
 * @param tile - the tile to transform, this gets modified in place
 * @param extent - the tile extent (usually 4096)
 * @returns the transformed tile
 */
export function transformTile(tile: GeoJSONVTTile, extent: number): GeoJSONVTTransformedTile {
    if (tile.transformed) return tile as GeoJSONVTTransformedTile;

    const z2 = 1 << tile.z;
    const tx = tile.x;
    const ty = tile.y;

    for (const feature of tile.features) {
        const geom = feature.geometry;
        const type = feature.type;

        feature.geometry = [];

        if (type === 1) {
            for (let j = 0; j < geom.length; j += 2) {
                (feature.geometry as number[][]).push(transformPoint(geom[j] as number, geom[j + 1] as number, extent, z2, tx, ty));
            }
        } else {
            for (let geom of (feature.geometry as number[][])) {
                const ring: [number, number][] = [];
                for (let k = 0; k < geom.length; k += 2) {
                    ring.push(transformPoint(geom[k] as number, geom[k + 1] as number, extent, z2, tx, ty));
                }
                (feature.geometry as unknown as [number, number][][]).push(ring);
            }
        }
    }

    tile.transformed = true;

    return tile as GeoJSONVTTransformedTile;
}

function transformPoint(x: number, y: number, extent: number, z2: number, tx: number, ty: number): [number, number] {
    return [
        Math.round(extent * (x * z2 - tx)),
        Math.round(extent * (y * z2 - ty))
    ];
}
