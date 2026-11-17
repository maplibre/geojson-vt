import type { GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTInternalTile, GeoJSONVTInternalTileFeature, GeoJSONVTOptions, GeoJSONVTSourceCoords, GeoJSONVTTileCoords } from "./definitions";
import { isHole } from "./feature";

export const GEOJSONVT_CLIP_START = 'geojsonvt_clip_start';
export const GEOJSONVT_CLIP_END = 'geojsonvt_clip_end';

type TileCoordsConstructor = Int16ArrayConstructor | Int32ArrayConstructor | Float64ArrayConstructor;

/**
 * Where a tile lies in the world, and what holds the coordinates of its features.
 */
type TileFrame = {
    z2: number;
    tx: number;
    ty: number;
    extent: number;
    CoordArray: TileCoordsConstructor;
};

/**
 * The smallest array type that holds the coordinates of a tile whose features are cut at its buffer.
 */
function getTileCoordsConstructor(options: GeoJSONVTOptions): TileCoordsConstructor {
    return options.extent + options.buffer <= 0x7fff ? Int16Array : Int32Array;
}

/**
 * Creates a tile object from the given features, with their coordinates in the tile's extent
 * @param features - the features to include in the tile
 * @param z
 * @param tx
 * @param ty
 * @param options - the options object
 * @param CoordArray - what holds the coordinates, which has to be a `Float64Array` when the features are not cut at the tile's buffer
 * @returns the created tile
 */
export function createTile(features: GeoJSONVTInternalFeature[], z: number, tx: number, ty: number, options: GeoJSONVTOptions, CoordArray = getTileCoordsConstructor(options)): GeoJSONVTInternalTile {
    const tolerance = z === options.maxZoom ? 0 : options.tolerance / ((1 << z) * options.extent);

    const tile = {
        features: [] as GeoJSONVTInternalTileFeature[],
        source: null as GeoJSONVTInternalFeature[],
        x: tx,
        y: ty,
        z: z,
        minX: 2,
        minY: 1,
        maxX: -1,
        maxY: 0,
        numPoints: 0,
        numSimplified: 0,
        numFeatures: features.length
    };

    const frame: TileFrame = {
        z2: 1 << z,
        tx,
        ty,
        extent: options.extent,
        CoordArray
    };

    for (const feature of features) {
        addFeature(tile, feature, tolerance, options, frame);
    }

    return tile;
}

function addFeature(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalFeature, tolerance: number, options: GeoJSONVTOptions, frame: TileFrame) {
    if (feature.type === 'Point') {
        addPointTileFeature(tile, feature, frame);
        return;
    }

    tile.minX = Math.min(tile.minX, feature.minX);
    tile.minY = Math.min(tile.minY, feature.minY);
    tile.maxX = Math.max(tile.maxX, feature.maxX);
    tile.maxY = Math.max(tile.maxY, feature.maxY);

    if (feature.type === 'MultiPoint') {
        addPointsTileFeature(tile, feature, frame);
        return;
    }

    addRingsTileFeature(tile, feature, tolerance, options, frame);
}

function addPointTileFeature(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalPointFeature, frame: TileFrame) {
    tile.minX = Math.min(tile.minX, feature.x);
    tile.minY = Math.min(tile.minY, feature.y);
    tile.maxX = Math.max(tile.maxX, feature.x);
    tile.maxY = Math.max(tile.maxY, feature.y);
    tile.numPoints++;
    tile.numSimplified++;

    const tileFeature: GeoJSONVTInternalTileFeature = {
        type: 4,
        tags: feature.tags || null,
        x: project(feature.x, frame.tx, frame),
        y: project(feature.y, frame.ty, frame)
    };
    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }
    tile.features.push(tileFeature);
}

function addPointsTileFeature(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalMultiPointFeature, frame: TileFrame) {
    const numPoints = feature.geometry.length / 3;
    if (!numPoints) return;

    const geometry = projectCoords(feature.geometry, 3, frame);
    tile.numPoints += numPoints;
    tile.numSimplified += numPoints;

    const tileFeature: GeoJSONVTInternalTileFeature = {
        type: 1,
        tags: feature.tags || null,
        geometry: geometry
    };
    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }
    tile.features.push(tileFeature);
}

function addRingsTileFeature(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalLineStringFeature | GeoJSONVTInternalMultiLineStringFeature | GeoJSONVTInternalPolygonFeature | GeoJSONVTInternalMultiPolygonFeature, tolerance: number, options: GeoJSONVTOptions, frame: TileFrame) {
    const isPolygon = feature.type === 'Polygon' || feature.type === 'MultiPolygon';
    const coords = feature.geometry;
    const geometry: GeoJSONVTTileCoords[] = [];
    for (let i = 0; i < coords.length;) {
        const ringEnd = i + 2 + coords[i] * 3;
        addLine(geometry, coords, i + 2, ringEnd, coords[i + 1], tile, tolerance, isPolygon, frame);
        i = ringEnd;
    }
    if (!geometry.length) return;

    let tags = feature.tags || null;
    if (feature.type === 'LineString' && options.lineMetrics) {
        tags = {};
        for (const key in feature.tags) tags[key] = feature.tags[key];
        tags[GEOJSONVT_CLIP_START] = feature.start / feature.size;
        tags[GEOJSONVT_CLIP_END] = feature.end / feature.size;
    }
    const tileFeature: GeoJSONVTInternalTileFeature = {
        type: isPolygon ? 3 : 2,
        tags: tags,
        geometry: geometry
    }
    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }
    tile.features.push(tileFeature);
}

/**
 * Adds a ring to a tile feature, with the positions that matter on the zoom level of the tile.
 * @param size - the size of the ring, which is negative for the hole of a polygon
 */
function addLine(result: GeoJSONVTTileCoords[], coords: GeoJSONVTSourceCoords, first: number, ringEnd: number, size: number, tile: GeoJSONVTInternalTile, tolerance: number, isPolygon: boolean, frame: TileFrame) {
    const sqTolerance = tolerance * tolerance;
    const numPoints = (ringEnd - first) / 3;

    tile.numPoints += numPoints;
    if (tolerance > 0 && (Math.abs(size) < (isPolygon ? sqTolerance : tolerance))) return;

    // the area of what is kept tells which way the ring winds, starting from the last position that is kept
    let last = ringEnd - 3;
    while (last > first && tolerance > 0 && coords[last + 2] <= sqTolerance) last -= 3;
    let x0 = coords[last];
    let y0 = coords[last + 1];
    let area = 0;
    let numKept = 0;

    for (let i = first; i < ringEnd; i += 3) {
        if (tolerance === 0 || coords[i + 2] > sqTolerance) {
            area += (coords[i] - x0) * (coords[i + 1] + y0);
            x0 = coords[i];
            y0 = coords[i + 1];
            numKept++;
        }
    }
    tile.numSimplified += numKept;

    // an outer ring goes clockwise and a hole the other way
    const isReversed = isPolygon && (area > 0) === !isHole(size);
    const ring = projectRing(coords, first, ringEnd, tolerance, numKept, isReversed, frame);

    if (isPolygon && isWindingFlipped(coords, first, ringEnd, tolerance, isReversed, ring)) reverse(ring);

    result.push(ring);
}

/**
 * The positions of a ring that matter on the zoom level of the tile, as coordinates in the tile, last to first when
 * the ring is reversed. They go into a `Float64Array` when one of them doesn't fit the tile's array, which takes a
 * position far outside the tile.
 */
function projectRing(coords: GeoJSONVTSourceCoords, first: number, ringEnd: number, tolerance: number, numKept: number, isReversed: boolean, frame: TileFrame, CoordArray = frame.CoordArray): GeoJSONVTTileCoords {
    const sqTolerance = tolerance * tolerance;
    const limit = CoordArray === Int16Array ? 0x7fff : 0x7fffffff;
    const ring = new CoordArray(numKept * 2);
    let next = isReversed ? ring.length - 2 : 0;

    for (let i = first; i < ringEnd; i += 3) {
        if (tolerance === 0 || coords[i + 2] > sqTolerance) {
            const x = project(coords[i], frame.tx, frame);
            const y = project(coords[i + 1], frame.ty, frame);
            if (CoordArray !== Float64Array && !(Math.abs(x) <= limit && Math.abs(y) <= limit)) {
                return projectRing(coords, first, ringEnd, tolerance, numKept, isReversed, frame, Float64Array);
            }
            ring[next] = x;
            ring[next + 1] = y;
            next += isReversed ? -2 : 2;
        }
    }

    return ring;
}

/**
 * Whether rounding to tile coordinates turned a polygon ring around, so that a hole would read as a shell, or the
 * other way round. Both signed areas are summed in the order of the tile's ring and relative to its first position,
 * to reduce cancellation for narrow rings far from the origin. A ring that rounds to no area is left as it is, and
 * other changes rounding makes to a ring are not repaired.
 */
function isWindingFlipped(coords: GeoJSONVTSourceCoords, first: number, ringEnd: number, tolerance: number, isReversed: boolean, ring: GeoJSONVTTileCoords): boolean {
    const sqTolerance = tolerance * tolerance;
    const step = isReversed ? -3 : 3;
    let originX = 0;
    let originY = 0;
    let previousX = 0;
    let previousY = 0;
    let previousRoundedX = 0;
    let previousRoundedY = 0;
    let sourceArea = 0;
    let roundedArea = 0;
    let next = 0;

    for (let i = isReversed ? ringEnd - 3 : first; i >= first && i < ringEnd; i += step) {
        if (tolerance > 0 && !(coords[i + 2] > sqTolerance)) continue;
        if (next === 0) {
            originX = coords[i];
            originY = coords[i + 1];
        } else {
            const x = coords[i] - originX;
            const y = coords[i + 1] - originY;
            const roundedX = ring[next] - ring[0];
            const roundedY = ring[next + 1] - ring[1];
            sourceArea += previousX * y - x * previousY;
            roundedArea += previousRoundedX * roundedY - roundedX * previousRoundedY;
            previousX = x;
            previousY = y;
            previousRoundedX = roundedX;
            previousRoundedY = roundedY;
        }
        next += 2;
    }

    return sourceArea * roundedArea < 0;
}

function reverse(coords: GeoJSONVTTileCoords) {
    for (let i = 0, j = coords.length - 2; i < j; i += 2, j -= 2) {
        const x = coords[i];
        const y = coords[i + 1];

        coords[i] = coords[j];
        coords[i + 1] = coords[j + 1];
        coords[j] = x;
        coords[j + 1] = y;
    }
}

/**
 * A position in the world, on one axis, as a coordinate in the tile that starts at `t` on that axis.
 */
function project(position: number, t: number, frame: TileFrame): number {
    return Math.round(frame.extent * (position * frame.z2 - t));
}

/**
 * The positions as coordinates in the tile, `stride` values apart, of which the first two are x and y.
 * They go into a `Float64Array` when one of them doesn't fit the tile's array, which takes a position far outside the tile.
 */
function projectCoords(positions: ArrayLike<number>, stride: number, frame: TileFrame, CoordArray = frame.CoordArray): GeoJSONVTTileCoords {
    const limit = CoordArray === Int16Array ? 0x7fff : 0x7fffffff;
    const coords = new CoordArray(positions.length / stride * 2);

    for (let i = 0, j = 0; i < positions.length; i += stride, j += 2) {
        const x = project(positions[i], frame.tx, frame);
        const y = project(positions[i + 1], frame.ty, frame);
        if (CoordArray !== Float64Array && !(Math.abs(x) <= limit && Math.abs(y) <= limit)) {
            return projectCoords(positions, stride, frame, Float64Array);
        }
        coords[j] = x;
        coords[j + 1] = y;
    }

    return coords;
}
