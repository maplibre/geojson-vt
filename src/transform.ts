import type { GeoJSONVTFeatureNonPoint, GeoJSONVTFeaturePoint, GeoJSONVTInternalTile, GeoJSONVTInternalTileFeatureNonPoint, GeoJSONVTInternalTileFeaturePoint, GeoJSONVTTile } from "./definitions";

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
            transformPointFeature(feature, extent, z2, tx, ty);
        } else {
            transformNonPointFeature(feature, extent, z2, tx, ty);
        }   
    }
    tile.transformed = true;

    return tile as GeoJSONVTTile;
}

/**
 * Transforms a single point feature from mercator-projected space into (extent x extent) tile space.
 */
function transformPointFeature(feature: GeoJSONVTInternalTileFeaturePoint, extent: number, z2: number, tx: number, ty: number): GeoJSONVTFeaturePoint {
    const transformed = feature as unknown as GeoJSONVTFeaturePoint;

    const geometry = feature.geometry;
    const point: GeoJSONVTFeaturePoint["geometry"] = [];
    for (let i = 0; i < geometry.length; i += 2) {
        point.push(transformPoint(geometry[i], geometry[i + 1], extent, z2, tx, ty));
    }
    transformed.geometry = point;

    return transformed;
}

/**
 * Transforms a single non-point feature from mercator-projected space into (extent x extent) tile space.
 */
function transformNonPointFeature(feature: GeoJSONVTInternalTileFeatureNonPoint, extent: number, z2: number, tx: number, ty: number): GeoJSONVTFeatureNonPoint {
    const transformed = feature as unknown as GeoJSONVTFeatureNonPoint;

    const geometry = feature.geometry;
    const nonPoint: GeoJSONVTFeatureNonPoint["geometry"] = [];
    for (const geom of geometry) {
        if (feature.type === 3) {
            nonPoint.push(transformPolygonRing(geom, extent, z2, tx, ty));
        } else {
            const line: GeoJSONVTFeaturePoint["geometry"] = [];
            for (let i = 0; i < geom.length; i += 2) {
                line.push(transformPoint(geom[i], geom[i + 1], extent, z2, tx, ty));
            }
            nonPoint.push(line);
        }
    }
    transformed.geometry = nonPoint;

    return transformed;
}

function transformPolygonRing(geometry: number[], extent: number, z2: number, tx: number, ty: number): [number, number][] {
    if (!geometry.length) return [];

    // Relative coordinates avoid cancellation for narrow rings far from the origin.
    const originX = geometry[0];
    const originY = geometry[1];
    const origin = transformPoint(originX, originY, extent, z2, tx, ty);
    const ring = [origin];
    let previousX = 0;
    let previousY = 0;
    let previousRoundedX = 0;
    let previousRoundedY = 0;
    let sourceArea = 0;
    let roundedArea = 0;

    for (let i = 2; i < geometry.length; i += 2) {
        const point = transformPoint(geometry[i], geometry[i + 1], extent, z2, tx, ty);
        const x = geometry[i] - originX;
        const y = geometry[i + 1] - originY;
        const roundedX = point[0] - origin[0];
        const roundedY = point[1] - origin[1];
        sourceArea += previousX * y - x * previousY;
        roundedArea += previousRoundedX * roundedY - roundedX * previousRoundedY;
        previousX = x;
        previousY = y;
        previousRoundedX = roundedX;
        previousRoundedY = roundedY;
        ring.push(point);
    }

    // Quantization must not turn a hole into a shell, or vice versa.
    if (sourceArea * roundedArea < 0) ring.reverse();
    return ring;
}

function transformPoint(x: number, y: number, extent: number, z2: number, tx: number, ty: number): [number, number] {
    return [
        Math.round(extent * (x * z2 - tx)),
        Math.round(extent * (y * z2 - ty))
    ];
}
