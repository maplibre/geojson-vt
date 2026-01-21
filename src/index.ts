
import {convert} from './convert';
import {clip} from './clip';
import {wrap} from './wrap';
import {transformTile, type GeoJSONVTFeature, type GeoJSONVTFeatureNonPoint, type GeoJSONVTFeaturePoint, type GeoJSONVTTile} from './transform';
import {createTile, type GeoJSONVTInternalTile, type GeoJSONVTInternalTileFeature, type GeoJSONVTInternalTileFeaturePoint, type GeoJSONVTInternalTileFeaturNonPoint} from './tile';
import {applySourceDiff, type GeoJSONVTFeatureDiff, type GeoJSONVTSourceDiff} from './difference';
import type { GeoJSONVTInternalFeature, GeoJSONVTOptions, GeometryType, GeometryTypeMap, PartialGeoJSONVTFeature, StartEndSizeArray } from './definitions';

const defaultOptions: GeoJSONVTOptions = {
    maxZoom: 14,
    indexMaxZoom: 5,
    indexMaxPoints: 100000,
    tolerance: 3,
    extent: 4096,
    buffer: 64,
    lineMetrics: false,
    promoteId: null,
    generateId: false,
    updateable: false,
    debug: 0
};

/**
 * Main class for creating and managing a vector tile index from GeoJSON data.
 */
class GeoJSONVT {
    private options: GeoJSONVTOptions;
    /** @internal */
    public tiles: {[key: string]: GeoJSONVTInternalTile};
    private tileCoords: {z: number, x: number, y: number, id: number}[];
    /** @internal */
    public stats: {[key: string]: number} = {};
    /** @internal */
    public total: number = 0;
    private source?: GeoJSONVTInternalFeature[];

    constructor(data: GeoJSON.GeoJSON, options: GeoJSONVTOptions) {
        options = this.options = Object.assign({}, defaultOptions, options);

        const debug = options.debug;

        if (debug) console.time('preprocess data');

        if (options.maxZoom < 0 || options.maxZoom > 24) throw new Error('maxZoom should be in the 0-24 range');
        if (options.promoteId && options.generateId) throw new Error('promoteId and generateId cannot be used together.');

        // projects and adds simplification info
        let features = convert(data, options);

        // tiles and tileCoords are part of the public API
        this.tiles = {};
        this.tileCoords = [];

        if (debug) {
            console.timeEnd('preprocess data');
            console.log('index: maxZoom: %d, maxPoints: %d', options.indexMaxZoom, options.indexMaxPoints);
            console.time('generate tiles');
            this.stats = {};
            this.total = 0;
        }

        // wraps features (ie extreme west and extreme east)
        features = wrap(features, options);

        // start slicing from the top tile down
        if (features.length) {
            this.splitTile(features, 0, 0, 0);
        }

        // for updateable indexes, store a copy of the original simplified features
        if (options.updateable) {
            this.source = features;
        }

        if (debug) {
            if (features.length) console.log('features: %d, points: %d', this.tiles[0].numFeatures, this.tiles[0].numPoints);
            console.timeEnd('generate tiles');
            console.log('tiles generated:', this.total, JSON.stringify(this.stats));
        }
    }

    /**
     * splits features from a parent tile to sub-tiles.
     * z, x, and y are the coordinates of the parent tile
     * cz, cx, and cy are the coordinates of the target tile
     * 
     * If no target tile is specified, splitting stops when we reach the maximum
     * zoom or the number of points is low as specified in the options.
     * @internal
     * @param features - features to split
     * @param z - tile zoom level
     * @param x - tile x coordinate
     * @param y - tile y coordinate
     * @param cz - target tile zoom level
     * @param cx - target tile x coordinate
     * @param cy - target tile y coordinate
     */
    splitTile(features: GeoJSONVTInternalFeature[], z: number, x: number, y: number, cz?: number, cx?: number, cy?: number) {

        const stack = [features, z, x, y];
        const options = this.options;
        const debug = options.debug;

        // avoid recursion by using a processing queue
        while (stack.length) {
            y = stack.pop() as number;
            x = stack.pop() as number;
            z = stack.pop() as number;
            features = stack.pop() as GeoJSONVTInternalFeature[];

            const z2 = 1 << z;
            const id = toID(z, x, y);
            let tile = this.tiles[id];

            if (!tile) {
                if (debug > 1) console.time('creation');

                tile = this.tiles[id] = createTile(features, z, x, y, options);
                this.tileCoords.push({z, x, y, id});

                if (debug) {
                    if (debug > 1) {
                        console.log('tile z%d-%d-%d (features: %d, points: %d, simplified: %d)',
                            z, x, y, tile.numFeatures, tile.numPoints, tile.numSimplified);
                        console.timeEnd('creation');
                    }
                    const key = `z${  z}`;
                    this.stats[key] = (this.stats[key] || 0) + 1;
                    this.total++;
                }
            }

            // save reference to original geometry in tile so that we can drill down later if we stop now
            tile.source = features;

            // if it's the first-pass tiling
            if (cz == null) {
                // stop tiling if we reached max zoom, or if the tile is too simple
                if (z === options.indexMaxZoom || tile.numPoints <= options.indexMaxPoints) continue;
            // if a drilldown to a specific tile
            } else if (z === options.maxZoom || z === cz) {
                // stop tiling if we reached base zoom or our target tile zoom
                continue;
            } else if (cz != null) {
                // stop tiling if it's not an ancestor of the target tile
                const zoomSteps = cz - z;
                if (x !== cx >> zoomSteps || y !== cy >> zoomSteps) continue;
            }

            // if we slice further down, no need to keep source geometry
            tile.source = null;

            if (!features.length) continue;

            if (debug > 1) console.time('clipping');

            // values we'll use for clipping
            const k1 = 0.5 * options.buffer / options.extent;
            const k2 = 0.5 - k1;
            const k3 = 0.5 + k1;
            const k4 = 1 + k1;

            let tl = null;
            let bl = null;
            let tr = null;
            let br = null;

            const left  = clip(features, z2, x - k1, x + k3, 0, tile.minX, tile.maxX, options);
            const right = clip(features, z2, x + k2, x + k4, 0, tile.minX, tile.maxX, options);

            if (left) {
                tl = clip(left, z2, y - k1, y + k3, 1, tile.minY, tile.maxY, options);
                bl = clip(left, z2, y + k2, y + k4, 1, tile.minY, tile.maxY, options);
            }

            if (right) {
                tr = clip(right, z2, y - k1, y + k3, 1, tile.minY, tile.maxY, options);
                br = clip(right, z2, y + k2, y + k4, 1, tile.minY, tile.maxY, options);
            }

            if (debug > 1) console.timeEnd('clipping');

            stack.push(tl || [], z + 1, x * 2,     y * 2);
            stack.push(bl || [], z + 1, x * 2,     y * 2 + 1);
            stack.push(tr || [], z + 1, x * 2 + 1, y * 2);
            stack.push(br || [], z + 1, x * 2 + 1, y * 2 + 1);
        }
    }

    /**
     * Given z, x, and y tile coordinates, returns the corresponding tile with geometries in tile coordinates, much like MVT data is stored.
     * @param z - tile zoom level
     * @param x - tile x coordinate
     * @param y - tile y coordinate
     * @returns the transformed tile or null if not found
     */
    getTile(z: number | string, x: number | string, y: number | string): GeoJSONVTTile | null {
        z = +z;
        x = +x;
        y = +y;

        const options = this.options;
        const {extent, debug} = options;

        if (z < 0 || z > 24) return null;

        const z2 = 1 << z;
        x = (x + z2) & (z2 - 1); // wrap tile x coordinate

        const id = toID(z, x, y);
        if (this.tiles[id]) {
            return transformTile(this.tiles[id], extent);
        }

        if (debug > 1) console.log('drilling down to z%d-%d-%d', z, x, y);

        let z0 = z;
        let x0 = x;
        let y0 = y;
        let parent;

        while (!parent && z0 > 0) {
            z0--;
            x0 = x0 >> 1;
            y0 = y0 >> 1;
            parent = this.tiles[toID(z0, x0, y0)];
        }

        if (!parent?.source) return null;

        // if we found a parent tile containing the original geometry, we can drill down from it
        if (debug > 1) {
            console.log('found parent tile z%d-%d-%d', z0, x0, y0);
            console.time('drilling down');
        }
        this.splitTile(parent.source, z0, x0, y0, z, x, y);
        if (debug > 1) console.timeEnd('drilling down');

        if (!this.tiles[id]) return null;

        return transformTile(this.tiles[id], extent);
    }

    /**
     * Invalidates (removes) tiles affected by the provided features
     * @internal
     * @param features 
     */
    invalidateTiles(features: GeoJSONVTInternalFeature[]) {
        const options = this.options;
        const {debug} = options;

        // calculate bounding box of all features for trivial reject
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const feature of features) {
            minX = Math.min(minX, feature.minX);
            maxX = Math.max(maxX, feature.maxX);
            minY = Math.min(minY, feature.minY);
            maxY = Math.max(maxY, feature.maxY);
        }

        // tile buffer clipping value - not halved as in splitTile above because checking against tile's own extent
        const k1 = options.buffer / options.extent;

        // track removed tile ids for o(1) lookup
        const removedLookup = new Set();

        // iterate through existing tiles and remove ones that are affected by features
        for (const id in this.tiles) {
            const tile = this.tiles[id];

            // calculate tile bounds including buffer
            const z2 = 1 << tile.z;
            const tileMinX = (tile.x     - k1) / z2;
            const tileMaxX = (tile.x + 1 + k1) / z2;
            const tileMinY = (tile.y     - k1) / z2;
            const tileMaxY = (tile.y + 1 + k1) / z2;

            // trivial reject if feature bounds don't intersect tile
            if (maxX < tileMinX || minX >= tileMaxX ||
                maxY < tileMinY || minY >= tileMaxY) {
                continue;
            }

            // check if any feature intersects with the tile
            let intersects = false;
            for (const feature of features) {
                if (feature.maxX >= tileMinX && feature.minX < tileMaxX &&
                    feature.maxY >= tileMinY && feature.minY < tileMaxY) {
                    intersects = true;
                    break;
                }
            }
            if (!intersects) continue;

            if (debug) {
                if (debug > 1) {
                    console.log('invalidate tile z%d-%d-%d (features: %d, points: %d, simplified: %d)',
                        tile.z, tile.x, tile.y, tile.numFeatures, tile.numPoints, tile.numSimplified);
                }
                const key = `z${  tile.z}`;
                this.stats[key] = (this.stats[key] || 0) - 1;
                this.total--;
            }

            delete this.tiles[id];
            removedLookup.add(id);
        }

        // remove tile coords that are no longer in the index
        if (removedLookup.size) {
            this.tileCoords = this.tileCoords.filter(c => !removedLookup.has(c.id));
        }
    }

    /**
     * Updates the tile index by adding and/or removing geojson features
     * invalidates tiles that are affected by the update for regeneration on next getTile call.
     * @param diff - the source diff object
     */
    updateData(diff: GeoJSONVTSourceDiff) {
        const options = this.options;
        const debug = options.debug;

        if (!options.updateable) throw new Error('to update tile geojson `updateable` option must be set to true');

        // apply diff and collect affected features and updated source that will be used to invalidate tiles
        const {affected, source} = applySourceDiff(this.source, diff, options);

        // nothing has changed
        if (!affected.length) return;

        // update source with new simplified feature set
        this.source = source;

        if (debug > 1) {
            console.log('invalidating tiles');
            console.time('invalidating');
        }

        this.invalidateTiles(affected);

        if (debug > 1) console.timeEnd('invalidating');

        // re-generate root tile with updated feature set
        const [z, x, y] = [0, 0, 0];
        const rootTile = createTile(this.source, z, x, y, this.options);
        rootTile.source = this.source;

        // update tile index with new root tile - ready for getTile calls
        const id = toID(z, x, y);
        this.tiles[id] = rootTile;
        this.tileCoords.push({z, x, y, id});

        if (debug) {
            const key = `z${  z}`;
            this.stats[key] = (this.stats[key] || 0) + 1;
            this.total++;
        }
    }
}

function toID(z: number, x: number, y: number): number {
    return (((1 << z) * y + x) * 32) + z;
}

export default function geojsonvt(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    return new GeoJSONVT(data, options);
}

export type { 
    GeoJSONVTInternalFeature, 
    GeoJSONVTOptions, 
    GeoJSONVTInternalTile, 
    GeoJSONVTInternalTileFeature, 
    GeometryType,
    PartialGeoJSONVTFeature,
    GeoJSONVT,
    GeometryTypeMap,
    StartEndSizeArray,
    GeoJSONVTTile,
    GeoJSONVTFeature,
    GeoJSONVTSourceDiff,
    GeoJSONVTFeatureDiff,
    GeoJSONVTFeaturePoint,
    GeoJSONVTFeatureNonPoint,
    GeoJSONVTInternalTileFeaturePoint,
    GeoJSONVTInternalTileFeaturNonPoint
};
