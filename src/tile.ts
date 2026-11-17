import type { GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTInternalTile, GeoJSONVTInternalTileFeature, GeoJSONVTOptions, GeoJSONVTTileCoords, SliceFixedArray } from "./definitions";

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

    switch (feature.type) {
        case 'MultiPoint':
            addPointsTileFeature(tile, feature, frame);
            return;
        case 'LineString':
            addLineTileFeautre(tile, feature, tolerance, options, frame);
            return;
        case 'MultiLineString':
        case 'Polygon':
            addLinesTileFeature(tile, feature, tolerance, frame);
            return;
        case 'MultiPolygon':
            addMultiPolygonTileFeature(tile, feature, tolerance, frame);
            return;
    }
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

function addLineTileFeautre(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalLineStringFeature, tolerance: number, options: GeoJSONVTOptions, frame: TileFrame) {
    const geometry: GeoJSONVTTileCoords[] = [];
    addLine(geometry, feature.geometry, tile, tolerance, false, false, frame);
    if (!geometry.length) return;
    let tags = feature.tags || null;
    if (options.lineMetrics) {
        tags = {};
        for (const key in feature.tags) tags[key] = feature.tags[key];
        tags[GEOJSONVT_CLIP_START] = feature.geometry.start / feature.geometry.size;
        tags[GEOJSONVT_CLIP_END] = feature.geometry.end / feature.geometry.size;
    }
    const tileFeature: GeoJSONVTInternalTileFeature = {
        type: 2,
        tags: tags,
        geometry: geometry
    }
    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }
    tile.features.push(tileFeature);
}

function addLinesTileFeature(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalPolygonFeature | GeoJSONVTInternalMultiLineStringFeature, tolerance: number, frame: TileFrame) {
    const geometry: GeoJSONVTTileCoords[] = [];
    for (let i = 0; i < feature.geometry.length; i++) {
        addLine(geometry, feature.geometry[i], tile, tolerance, feature.type === 'Polygon', i === 0, frame);
    }
    if (!geometry.length) return;
    const tileFeature: GeoJSONVTInternalTileFeature = {
        type: feature.type === 'Polygon' ? 3 : 2,
        tags: feature.tags || null,
        geometry: geometry
    }
    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }
    tile.features.push(tileFeature);
}

function addMultiPolygonTileFeature(tile: GeoJSONVTInternalTile, feature: GeoJSONVTInternalMultiPolygonFeature, tolerance: number, frame: TileFrame) {
    const geometry: GeoJSONVTTileCoords[] = [];
    for (let k = 0; k < feature.geometry.length; k++) {
        const polygon = feature.geometry[k];
        for (let i = 0; i < polygon.length; i++) {
            addLine(geometry, polygon[i], tile, tolerance, true, i === 0, frame);
        }
    }
    if (!geometry.length) return;
    const tileFeature: GeoJSONVTInternalTileFeature = {
        type: 3,
        tags: feature.tags || null,
        geometry: geometry
    }
    if (feature.id !== null) {
        tileFeature.id = feature.id;
    }
    tile.features.push(tileFeature);
}

function addLine(result: GeoJSONVTTileCoords[], geom: SliceFixedArray, tile: GeoJSONVTInternalTile, tolerance: number, isPolygon: boolean, isOuter: boolean, frame: TileFrame) {
    const sqTolerance = tolerance * tolerance;

    if (tolerance > 0 && (geom.size < (isPolygon ? sqTolerance : tolerance))) {
        tile.numPoints += geom.points.length / 3;
        return;
    }

    const ring = [];

    for (let i = 0; i < geom.points.length; i += 3) {
        if (tolerance === 0 || geom.points[i + 2] > sqTolerance) {
            tile.numSimplified++;
            ring.push(geom.points[i], geom.points[i + 1]);
        }
        tile.numPoints++;
    }

    if (isPolygon) rewind(ring, isOuter);

    const coords = projectCoords(ring, 2, frame);

    if (isPolygon && isWindingFlipped(ring, coords)) reverse(coords);

    result.push(coords);
}

/**
 * Whether rounding to tile coordinates turned a polygon ring around, so that a hole would read as a shell, or the
 * other way round. Both signed areas are summed relative to the first position, to reduce cancellation for narrow
 * rings far from the origin. A ring that rounds to no area is left as it is, and other changes rounding makes to
 * a ring are not repaired.
 */
function isWindingFlipped(ring: number[], coords: GeoJSONVTTileCoords): boolean {
    let previousX = 0;
    let previousY = 0;
    let previousRoundedX = 0;
    let previousRoundedY = 0;
    let sourceArea = 0;
    let roundedArea = 0;

    for (let i = 2; i < ring.length; i += 2) {
        const x = ring[i] - ring[0];
        const y = ring[i + 1] - ring[1];
        const roundedX = coords[i] - coords[0];
        const roundedY = coords[i + 1] - coords[1];
        sourceArea += previousX * y - x * previousY;
        roundedArea += previousRoundedX * roundedY - roundedX * previousRoundedY;
        previousX = x;
        previousY = y;
        previousRoundedX = roundedX;
        previousRoundedY = roundedY;
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

function rewind(ring: number[], clockwise: boolean) {
    let area = 0;

    for (let i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
        area += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1]);
    }

    if (area > 0 !== clockwise) return;

    for (let i = 0, len = ring.length; i < len / 2; i += 2) {
        const x = ring[i];
        const y = ring[i + 1];

        ring[i] = ring[len - 2 - i];
        ring[i + 1] = ring[len - 1 - i];
        ring[len - 2 - i] = x;
        ring[len - 1 - i] = y;
    }
}
