import KDBush from 'kdbush';
import type {GeoJSONVTTile, GeoJSONVTFeature} from './transform';
import type {GeoJSONVTInternalFeature, GeoJSONVTInternalPointFeature} from './definitions';
import {projectX, projectY} from './convert';
import {unprojectX, unprojectY} from './deconvert';

export type SuperclusterOptions = {
    /**
     * Min zoom to generate clusters on
     * @default 0
     */
    minZoom?: number;
    /**
     * Max zoom level to cluster the points on
     * @default 16
     */
    maxZoom?: number;
    /**
     * Minimum points to form a cluster
     * @default 2
     */
    minPoints?: number;
    /**
     * Cluster radius in pixels
     * @default 40
     */
    radius?: number;
    /**
     * Tile extent (radius is calculated relative to it)
     * @default 512
     */
    extent?: number;
    /**
     * Size of the KD-tree leaf node, affects performance
     * @default 64
     */
    nodeSize?: number;
    /**
     * Whether to log timing info
     * @default false
     */
    log?: boolean;
    /**
     * Whether to generate numeric ids for input features (in vector tiles)
     * @default false
     */
    generateId?: boolean;
    /**
     * A reduce function for calculating custom cluster properties
     * @default null
     */
    reduce?: ((accumulated: Record<string, unknown>, props: Record<string, unknown>) => void) | null;
    /**
     * Properties to use for individual points when running the reducer
     * @default props => props
     */
    map?: (props: GeoJSON.GeoJsonProperties) => Record<string, unknown>;
};

export type ClusterProperties = {
    cluster: true;
    cluster_id: number;
    point_count: number;
    point_count_abbreviated: string | number;
    [key: string]: unknown;
};

export type ClusterFeature = GeoJSON.Feature<GeoJSON.Point, ClusterProperties>;

type PointFeature = GeoJSON.Feature<GeoJSON.Point> | GeoJSONVTInternalPointFeature;

export type KDBushWithData = KDBush & {
    flatData: number[];
};

export const defaultClusterOptions: Required<SuperclusterOptions> = {
    minZoom: 0,
    maxZoom: 16,
    minPoints: 2,
    radius: 40,
    extent: 512,
    nodeSize: 64,
    log: false,
    generateId: false,
    reduce: null,
    map: (props) => props as Record<string, unknown>
};

const OFFSET_ZOOM = 2;
const OFFSET_ID = 3;
const OFFSET_PARENT = 4;
const OFFSET_NUM = 5;
const OFFSET_PROP = 6;

export class Supercluster {
    options: Required<SuperclusterOptions>;
    trees: KDBushWithData[];
    stride: number;
    clusterProps: Record<string, unknown>[];
    points: PointFeature[];

    constructor(options?: SuperclusterOptions) {
        this.options = Object.assign(Object.create(defaultClusterOptions), options) as Required<SuperclusterOptions>;
        this.trees = new Array(this.options.maxZoom + 1);
        this.stride = this.options.reduce ? 7 : 6;
        this.clusterProps = [];
        this.points = [];
    }

    /**
     * Loads internal GeoJSONVT point features from a data source and builds the clustering index.
     * @param features - {@link GeoJSONVTInternalFeature} data source features to filter and cluster.
     */
    loadInternal(features: GeoJSONVTInternalFeature[]): this {
        const points: GeoJSONVTInternalPointFeature[] = [];

        for (const feature of features) {
            if (feature.type !== 'Point') continue;
            points.push(feature);
        }

        return this.load(points);
    }

    /**
     * Loads input point features and builds the internal clustering index.
     * @param points - Input GeoJSON point features to cluster.
     */
    load(points: PointFeature[]): this {
        const {log, minZoom, maxZoom} = this.options;

        if (log) console.time('total time');

        const timerId = `prepare ${points.length} points`;
        if (log) console.time(timerId);

        this.points = points;

        // generate a cluster object for each point and index input points into a KD-tree
        const data: number[] = [];

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (!p.geometry) continue;

            let x, y;
            [x, y] = getPointCoords(p);
            x = Math.fround(x);
            y = Math.fround(y);

            // store internal point/cluster data in flat numeric arrays for performance
            data.push(
                x, y, // projected point coordinates
                Infinity, // the last zoom the point was processed at
                i, // index of the source feature in the original input array
                -1, // parent cluster id
                1 // number of points in a cluster
            );
            if (this.options.reduce) data.push(0); // noop
        }
        let tree = this.trees[maxZoom + 1] = this.createTree(data);

        if (log) console.timeEnd(timerId);

        // cluster points on max zoom, then cluster the results on previous zoom, etc.;
        // results in a cluster hierarchy across zoom levels
        for (let z = maxZoom; z >= minZoom; z--) {
            const now = Date.now();

            // create a new set of clusters for the zoom and index them with a KD-tree
            tree = this.trees[z] = this.createTree(this.cluster(tree, z));

            if (log) console.log('z%d: %d clusters in %dms', z, tree.numItems, Date.now() - now);
        }

        if (log) console.timeEnd('total time');

        return this;
    }

    /**
     * Returns clusters and/or points within a bounding box at a given zoom level.
     * @param bbox - Bounding box in `[westLng, southLat, eastLng, northLat]` order.
     * @param zoom - Zoom level to query.
     */
    getClusters(bbox: [number, number, number, number], zoom: number): (ClusterFeature | GeoJSON.Feature<GeoJSON.Point>)[] {
        let minLng = ((bbox[0] + 180) % 360 + 360) % 360 - 180;
        const minLat = Math.max(-90, Math.min(90, bbox[1]));
        let maxLng = bbox[2] === 180 ? 180 : ((bbox[2] + 180) % 360 + 360) % 360 - 180;
        const maxLat = Math.max(-90, Math.min(90, bbox[3]));

        if (bbox[2] - bbox[0] >= 360) {
            minLng = -180;
            maxLng = 180;
        } else if (minLng > maxLng) {
            const easternHem = this.getClusters([minLng, minLat, 180, maxLat], zoom);
            const westernHem = this.getClusters([-180, minLat, maxLng, maxLat], zoom);
            return easternHem.concat(westernHem);
        }

        const tree = this.trees[this.limitZoom(zoom)];
        const ids = tree.range(projectX(minLng), projectY(maxLat), projectX(maxLng), projectY(minLat));
        const data = tree.flatData;
        const clusters: (ClusterFeature | GeoJSON.Feature<GeoJSON.Point>)[] = [];
        for (const id of ids) {
            const k = this.stride * id;
            clusters.push(data[k + OFFSET_NUM] > 1 ? getClusterJSON(data, k, this.clusterProps) : this.points[data[k + OFFSET_ID]] as GeoJSON.Feature<GeoJSON.Point>);
        }
        return clusters;
    }

    /**
     * Returns the immediate children (clusters or points) of a cluster.
     * @param clusterId - The target cluster id.
     */
    getChildren(clusterId: number): (ClusterFeature | GeoJSON.Feature<GeoJSON.Point>)[] {
        const originId = this.getOriginId(clusterId);
        const originZoom = this.getOriginZoom(clusterId);
        const clusterError = new Error('No cluster with the specified id: ' + clusterId);

        const tree = this.trees[originZoom];
        if (!tree) throw clusterError;

        const data = tree.flatData;
        if (originId * this.stride >= data.length) throw clusterError;

        const r = this.options.radius / (this.options.extent * Math.pow(2, originZoom - 1));
        const x = data[originId * this.stride];
        const y = data[originId * this.stride + 1];
        const ids = tree.within(x, y, r);
        const children: (ClusterFeature | GeoJSON.Feature<GeoJSON.Point>)[] = [];
        for (const id of ids) {
            const k = id * this.stride;
            if (data[k + OFFSET_PARENT] === clusterId) {
                children.push(data[k + OFFSET_NUM] > 1 ? getClusterJSON(data, k, this.clusterProps) : this.points[data[k + OFFSET_ID]] as GeoJSON.Feature<GeoJSON.Point>);
            }
        }

        if (children.length === 0) throw clusterError;

        return children;
    }

    /**
     * Returns leaf point features under a cluster, paginated by `limit` and `offset`.
     * @param clusterId - The target cluster id.
     * @param limit - Maximum number of points to return (defaults to `10`).
     * @param offset - Number of points to skip before collecting results (defaults to `0`).
     */
    getLeaves(clusterId: number, limit?: number, offset?: number): GeoJSON.Feature<GeoJSON.Point>[] {
        limit = limit || 10;
        offset = offset || 0;

        const leaves: GeoJSON.Feature<GeoJSON.Point>[] = [];
        this.appendLeaves(leaves, clusterId, limit, offset, 0);

        return leaves;
    }

    /**
     * Generates a vector-tile-like representation of a single tile.
     * @param z - Tile zoom.
     * @param x - Tile x coordinate.
     * @param y - Tile y coordinate.
     */
    getTile(z: number, x: number, y: number): GeoJSONVTTile | null {
        const tree = this.trees[this.limitZoom(z)];
        const z2 = Math.pow(2, z);
        const {extent, radius} = this.options;
        const p = radius / extent;
        const top = (y - p) / z2;
        const bottom = (y + 1 + p) / z2;

        const tile: GeoJSONVTTile = {
            features: [],
            transformed: true,
            numPoints: 0,
            numSimplified: 0,
            numFeatures: 0,
            source: null,
            x: x,
            y: y,
            z: z,
            minX: 2,
            minY: 1,
            maxX: -1,
            maxY: 0
        };

        this.addTileFeatures(
            tree.range((x - p) / z2, top, (x + 1 + p) / z2, bottom),
            tree.flatData, x, y, z2, tile);

        if (x === 0) {
            this.addTileFeatures(
                tree.range(1 - p / z2, top, 1, bottom),
                tree.flatData, z2, y, z2, tile);
        }
        if (x === z2 - 1) {
            this.addTileFeatures(
                tree.range(0, top, p / z2, bottom),
                tree.flatData, -1, y, z2, tile);
        }

        return tile;
    }

    /**
     * Returns the zoom level at which a cluster expands into multiple children.
     * @param clusterId - The target cluster id.
     */
    getClusterExpansionZoom(clusterId: number): number {
        return this.getOriginZoom(clusterId);
    }

    private appendLeaves(result: GeoJSON.Feature<GeoJSON.Point>[], clusterId: number, limit: number, offset: number, skipped: number): number {
        const children = this.getChildren(clusterId);

        for (const child of children) {
            const props = child.properties as ClusterProperties | null;

            if (props?.cluster) {
                if (skipped + props.point_count <= offset) {
                    // skip the whole cluster
                    skipped += props.point_count;
                } else {
                    // enter the cluster
                    skipped = this.appendLeaves(result, props.cluster_id, limit, offset, skipped);
                    // exit the cluster
                }
            } else if (skipped < offset) {
                // skip a single point
                skipped++;
            } else {
                // add a single point
                result.push(child as GeoJSON.Feature<GeoJSON.Point>);
            }
            if (result.length === limit) break;
        }

        return skipped;
    }

    private createTree(data: number[]): KDBushWithData {
        const tree = new KDBush(data.length / this.stride | 0, this.options.nodeSize, Float32Array) as unknown as KDBushWithData;
        for (let i = 0; i < data.length; i += this.stride) tree.add(data[i], data[i + 1]);
        tree.finish();
        tree.flatData = data;
        tree.data = null; // clear original data to free memory as it isn't used later on.
        return tree;
    }

    private addTileFeatures(ids: number[], data: number[], x: number, y: number, z2: number, tile: GeoJSONVTTile): void {
        for (const i of ids) {
            const k = i * this.stride;
            const isCluster = data[k + OFFSET_NUM] > 1;

            let tags: GeoJSON.GeoJsonProperties | ClusterProperties;
            let px: number;
            let py: number;
            if (isCluster) {
                tags = getClusterProperties(data, k, this.clusterProps);
                px = data[k];
                py = data[k + 1];
            } else {
                const p = this.points[data[k + OFFSET_ID]];
                tags = getPointProps(p);
                [px, py] = getPointCoords(p);
            }

            const f: GeoJSONVTFeature = {
                type: 1,
                geometry: [[
                    Math.round(this.options.extent * (px * z2 - x)),
                    Math.round(this.options.extent * (py * z2 - y))
                ]],
                tags
            };

            // assign id
            let id: number | string | undefined;
            if (isCluster || this.options.generateId) {
                // optionally generate id for points
                id = data[k + OFFSET_ID];
            } else {
                // keep id if already assigned
                id = this.points[data[k + OFFSET_ID]].id as number | string | undefined;
            }

            if (id !== undefined) f.id = id;

            tile.features.push(f);
        }
    }

    private limitZoom(z: number): number {
        return Math.max(this.options.minZoom, Math.min(Math.floor(+z), this.options.maxZoom + 1));
    }

    private cluster(tree: KDBushWithData, zoom: number): number[] {
        const {radius, extent, reduce, minPoints} = this.options;
        const r = radius / (extent * Math.pow(2, zoom));
        const data = tree.flatData;
        const nextData: number[] = [];
        const stride = this.stride;

        // loop through each point
        for (let i = 0; i < data.length; i += stride) {
            // if we've already visited the point at this zoom level, skip it
            if (data[i + OFFSET_ZOOM] <= zoom) continue;
            data[i + OFFSET_ZOOM] = zoom;

            // find all nearby points
            const x = data[i];
            const y = data[i + 1];
            const neighborIds = tree.within(data[i], data[i + 1], r);

            const numPointsOrigin = data[i + OFFSET_NUM];
            let numPoints = numPointsOrigin;

            // count the number of points in a potential cluster
            for (const neighborId of neighborIds) {
                const k = neighborId * stride;
                // filter out neighbors that are already processed
                if (data[k + OFFSET_ZOOM] > zoom) numPoints += data[k + OFFSET_NUM];
            }

            // if there were neighbors to merge, and there are enough points to form a cluster
            if (numPoints > numPointsOrigin && numPoints >= minPoints) {
                let wx = x * numPointsOrigin;
                let wy = y * numPointsOrigin;

                let clusterProperties: Record<string, unknown> | undefined;
                let clusterPropIndex = -1;

                // encode both zoom and point index on which the cluster originated -- offset by total length of features
                const id = ((i / stride | 0) << 5) + (zoom + 1) + this.points.length;

                for (const neighborId of neighborIds) {
                    const k = neighborId * stride;

                    if (data[k + OFFSET_ZOOM] <= zoom) continue;
                    data[k + OFFSET_ZOOM] = zoom; // save the zoom (so it doesn't get processed twice)

                    const numPoints2 = data[k + OFFSET_NUM];
                    wx += data[k] * numPoints2; // accumulate coordinates for calculating weighted center
                    wy += data[k + 1] * numPoints2;

                    data[k + OFFSET_PARENT] = id;

                    if (reduce) {
                        if (!clusterProperties) {
                            clusterProperties = this.map(data, i, true);
                            clusterPropIndex = this.clusterProps.length;
                            this.clusterProps.push(clusterProperties);
                        }
                        reduce(clusterProperties, this.map(data, k));
                    }
                }

                data[i + OFFSET_PARENT] = id;
                nextData.push(wx / numPoints, wy / numPoints, Infinity, id, -1, numPoints);
                if (reduce) nextData.push(clusterPropIndex);

            } else { // left points as unclustered
                for (let j = 0; j < stride; j++) nextData.push(data[i + j]);

                if (numPoints > 1) {
                    for (const neighborId of neighborIds) {
                        const k = neighborId * stride;
                        if (data[k + OFFSET_ZOOM] <= zoom) continue;
                        data[k + OFFSET_ZOOM] = zoom;
                        for (let j = 0; j < stride; j++) nextData.push(data[k + j]);
                    }
                }
            }
        }

        return nextData;
    }

    // get index of the point from which the cluster originated
    private getOriginId(clusterId: number): number {
        return (clusterId - this.points.length) >> 5;
    }

    // get zoom of the point from which the cluster originated
    private getOriginZoom(clusterId: number): number {
        return (clusterId - this.points.length) % 32;
    }

    private map(data: number[], i: number, clone?: boolean): Record<string, unknown> {
        if (data[i + OFFSET_NUM] > 1) {
            const props = this.clusterProps[data[i + OFFSET_PROP]];
            return clone ? Object.assign({}, props) : props;
        }
        const p = this.points[data[i + OFFSET_ID]];
        const original = getPointProps(p);
        const result = this.options.map(original);
        return clone && result === original ? Object.assign({}, result) : result;
    }
}

function getClusterJSON(data: number[], i: number, clusterProps: Record<string, unknown>[]): ClusterFeature {
    return {
        type: 'Feature',
        id: data[i + OFFSET_ID],
        properties: getClusterProperties(data, i, clusterProps),
        geometry: {
            type: 'Point',
            coordinates: [unprojectX(data[i]), unprojectY(data[i + 1])]
        }
    };
}

function getClusterProperties(data: number[], i: number, clusterProps: Record<string, unknown>[]): ClusterProperties {
    const count = data[i + OFFSET_NUM];
    const abbrev =
        count >= 10000 ? `${Math.round(count / 1000)  }k` :
        count >= 1000 ? `${Math.round(count / 100) / 10  }k` : count;
    const propIndex = data[i + OFFSET_PROP];
    const properties = propIndex === -1 ? {} : Object.assign({}, clusterProps[propIndex]);

    return Object.assign(properties, {
        cluster: true as const,
        cluster_id: data[i + OFFSET_ID],
        point_count: count,
        point_count_abbreviated: abbrev
    });
}

function isGeoJSONPoint(p: PointFeature): p is GeoJSON.Feature<GeoJSON.Point> {
    return 'coordinates' in p.geometry;
}

function getPointCoords(p: PointFeature): [x: number, y: number] {
    if (isGeoJSONPoint(p)) {
        const [lng, lat] = p.geometry.coordinates;
        return [projectX(lng), projectY(lat)];
    }
    const [x, y] = p.geometry;
    return [x, y];
}

function getPointProps(p: PointFeature): GeoJSON.GeoJsonProperties {
    return isGeoJSONPoint(p) ? p.properties : p.tags;
}
