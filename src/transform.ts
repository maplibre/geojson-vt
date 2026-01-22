import type { GeoJSONVTInternalTile } from './tile';

type PointGeometry = [number, number][];
type NonPointGeometry = [number, number][][];

export type GeoJSONVTFeaturePoint = {
    id? : number | string | undefined;
    type: 1;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: PointGeometry
}

export type GeoJSONVTFeatureNonPoint = {
    id? : number | string | undefined;
    type: 2 | 3;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: NonPointGeometry
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
            const geometry: PointGeometry = [];
            for (let i = 0; i < feature.geometry.length; i += 2) {
                geometry.push(transformPoint(feature.geometry[i], feature.geometry[i + 1], extent, z2, tx, ty));
            }
            (feature as unknown as GeoJSONVTFeaturePoint).geometry = geometry;
            continue;
        }

        const geometry: NonPointGeometry = [];
        for (const singleGeom of feature.geometry) {
            const ring: PointGeometry = [];
            for (let i = 0; i < singleGeom.length; i += 2) {
                ring.push(transformPoint(singleGeom[i], singleGeom[i + 1], extent, z2, tx, ty));
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
