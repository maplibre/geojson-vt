import type { GeoJSONVTInternalTile } from "./tile";

export type GeoJSONVTFeaturePoint = {
    id? : number | string | undefined;
    type: 1;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: [number, number][]
}

export type GeoJSONVTFeatureNonPoint = {
    id? : number | string | undefined;
    type: 2 | 3;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: [number, number][][]
}

export type GeoJSONVTFeature = GeoJSONVTFeaturePoint | GeoJSONVTFeatureNonPoint;

export type GeoJSONVTTile = GeoJSONVTInternalTile & {
    transformed: true;
    features: GeoJSONVTFeature[]
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
            const pointGeometry: [number, number][] = []
            for (let j = 0; j < feature.geometry.length; j += 2) {
                pointGeometry.push(transformPoint(feature.geometry[j], feature.geometry[j + 1], extent, z2, tx, ty));
            }
            (feature as unknown as GeoJSONVTFeaturePoint).geometry = pointGeometry;
            continue;
        }

        const geometry: [number, number][][] = [];
        for (const singleGeom of feature.geometry) {
            const ring: [number, number][] = [];
            for (let k = 0; k < singleGeom.length; k += 2) {
                ring.push(transformPoint(singleGeom[k], singleGeom[k + 1], extent, z2, tx, ty));
            }
            geometry.push(ring);
        }
        (feature as unknown as GeoJSONVTFeatureNonPoint).geometry = geometry;
    }
    tile.transformed = true;

    return tile as GeoJSONVTTile;
}

function transformPoint(x: number, y: number, extent: number, z2: number, tx: number, ty: number): [number, number] {
    return [
        Math.round(extent * (x * z2 - tx)),
        Math.round(extent * (y * z2 - ty))
    ];
}
