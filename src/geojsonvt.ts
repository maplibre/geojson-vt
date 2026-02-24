import {convertToInternal} from './convert';
import {convertToGeoJSON, featureToGeoJSON} from './deconvert';
import {wrap} from './wrap';
import {applySourceDiff, type GeoJSONVTSourceDiff} from './difference';
import {Supercluster, type SuperclusterOptions, defaultClusterOptions} from './supercluster';
import {NonClusterDataHandler} from './noncluster';
import type {ClusterOrPointFeature, GeoJSONVTInternalFeature, GeoJSONVTOptions} from './definitions';
import type {GeoJSONDataHandler} from './geojson-data-handler';
import type {GeoJSONVTTile} from './transform';

export const defaultOptions: GeoJSONVTOptions = {
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
    cluster: false,
    clusterOptions: defaultClusterOptions,
    debug: 0
};

/**
 * Main class for creating and managing a vector tile index from GeoJSON data.
 */
export class GeoJSONVT {

    /** 
     * @internal
     * This is for the tests
     */
    public get tiles() {
        return (this.dataHandler as any)?.tiles ?? {};
    }
    /** 
     * @internal
     * This is for the tests
     */
    public get stats() {
        return (this.dataHandler as any).stats;
    }
     /** 
     * @internal
     * This is for the tests
     */
    public get total() {
        return (this.dataHandler as any).total;
    }

    private options: GeoJSONVTOptions;
    
    private source?: GeoJSONVTInternalFeature[];
    private dataHandler?: GeoJSONDataHandler;

    constructor(data: GeoJSON.GeoJSON, options: GeoJSONVTOptions) {
        options = this.options = Object.assign({}, defaultOptions, options);

        const debug = options.debug;

        if (debug) console.time('preprocess data');

        if (options.maxZoom < 0 || options.maxZoom > 24) throw new Error('maxZoom should be in the 0-24 range');
        if (options.promoteId && options.generateId) throw new Error('promoteId and generateId cannot be used together.');

        // projects and adds simplification info
        let features = convertToInternal(data, options);

        if (debug) {
            console.timeEnd('preprocess data');
            console.log('index: maxZoom: %d, maxPoints: %d', options.indexMaxZoom, options.indexMaxPoints);
            console.time('generate tiles');
        }

        // wraps features (ie extreme west and extreme east)
        features = wrap(features, options);

        // for updateable indexes, store a copy of the original simplified features
        if (options.updateable) {
            this.source = features;
        }

        this.initializeIndex(features, options);
    }

    private initializeIndex(features: GeoJSONVTInternalFeature[], options: GeoJSONVTOptions) {
        if (!features.length) return;

        this.dataHandler = options.cluster ? new Supercluster(options.clusterOptions) : new NonClusterDataHandler(options);
        this.dataHandler.initialize(features);
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

        if (z < 0 || z > 24) return null;

        return this.dataHandler.getTile(z, x, y);
    }

    /**
     * Updates the source data feature set using a {@link GeoJSONVTSourceDiff}
     * @param diff - the source diff object
     */
    updateData(diff: GeoJSONVTSourceDiff, filter?: (feature: GeoJSON.Feature) => boolean) {
        const options = this.options;

        if (!options.updateable) throw new Error('to update tile geojson `updateable` option must be set to true');

        // apply diff and collect affected features and updated source that will be used to invalidate tiles
        let {affected, source} = applySourceDiff(this.source, diff, options);

        if (filter) {
            ({affected, source} = this.filterUpdate(source, affected, filter));
        }

        // nothing has changed
        if (!affected.length) return;

        // update source with new simplified feature set
        this.source = source;

        this.updateIndex(source, affected, options);
    }

    /**
     * Updates the tile index - invalidates tiles that are affected by the update
     */
    private updateIndex(source: GeoJSONVTInternalFeature[], affected: GeoJSONVTInternalFeature[], options: GeoJSONVTOptions) {
        this.dataHandler.updateIndex(source, affected, options);
    }

    /**
     * Filter an update using a predicate function. Returns the affected and updated source features.
     */
    private filterUpdate(source: GeoJSONVTInternalFeature[], affected: GeoJSONVTInternalFeature[], predicate: (feature: GeoJSON.Feature) => boolean) {
        const removeIds = new Set();

        for (const feature of source) {
            if (feature.id == undefined) continue;
            if (predicate(featureToGeoJSON(feature))) continue;
            affected.push(feature);
            removeIds.add(feature.id);
        }
        source = source.filter(feature => !removeIds.has(feature.id));

        return {affected, source};
    }

    /**
     * Returns source data as GeoJSON - only available when `updateable` option is set to true.
     */
    getData(): GeoJSON.GeoJSON {
        if (!this.options.updateable) throw new Error('to retrieve data the `updateable` option must be set to true');
        return convertToGeoJSON(this.source);
    }
    
    /**
     * Update supercluster options and regenerate the index.
     * @param cluster - whether to enable clustering
     * @param clusterOptions - {@link SuperclusterOptions}
     */
    updateClusterOptions(cluster: boolean, clusterOptions: SuperclusterOptions) {
        const wasCluster = this.options.cluster;
        this.options.cluster = cluster;
        this.options.clusterOptions = clusterOptions;

        if (wasCluster != cluster) {
            this.dataHandler = cluster ? new Supercluster(this.options.clusterOptions) : new NonClusterDataHandler(this.options);
        }

        this.updateIndex(this.source, [], this.options);
    }

    /**
     * Returns the zoom level at which a cluster expands into multiple children.
     * @param clusterId - The target cluster id.
     * @returns the expansion zoom or null in case of non-clustered source
     */
    getClusterExpansionZoom(clusterId: number): number | null {
        return this.dataHandler?.getClusterExpansionZoom(clusterId);
    }

    /**
     * Returns the immediate children (clusters or points) of a cluster as GeoJSON.
     * @param clusterId - The target cluster id.
     * @returns the immediate children or null in case of non-clustered source
     */
    getClusterChildren(clusterId: number): ClusterOrPointFeature[] | null {
        return this.dataHandler?.getChildren(clusterId);
    }

    /**
     * Returns leaf point features under a cluster, paginated by `limit` and `offset`.
     * @param clusterId - The target cluster id.
     * @param limit - Maximum number of points to return (defaults to `10`).
     * @param offset - Number of points to skip before collecting results (defaults to `0`).
     * @returns leaf point features under a cluster or null in case of non-clustered source
     */
    getClusterLeaves(clusterId: number, limit: number, offset: number): GeoJSON.Feature<GeoJSON.Point>[] | null {
        return this.dataHandler?.getLeaves(clusterId, limit, offset);
    }
}
