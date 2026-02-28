export type GeoJSONVTOptions = {
    /**
     * Max zoom to preserve detail on
     * @default 14
     */
    maxZoom?: number;
    /**
     * Max zoom in the tile index
     * @default 5
     */
    indexMaxZoom?: number;
    /**
     * Max number of points per tile in the tile index
     * @default 100000
     */
    indexMaxPoints?: number;
    /**
     * Simplification tolerance (higher means simpler)
     * @default 3
     */
    tolerance?: number;
    /**
     * Tile extent
     * @default 4096
     */
    extent?: number;
    /**
     * Tile buffer on each side
     * @default 64
     */
    buffer?: number;
    /**
     * Whether to calculate line metrics
     * @default false
     */
    lineMetrics?: boolean;
    /**
     * Name of a feature property to be promoted to feature.id
     */
    promoteId?: string | null;
    /**
     * Whether to generate feature ids. Cannot be used with promoteId
     * @default false
     */
    generateId?: boolean;
    /**
     * Whether geojson can be updated (with caveat of a stored simplified copy)
     * @default true
     */
    updateable?: boolean;
    /**
     * Logging level (0, 1 or 2)
     * @default 0
     */
    debug?: number;
    /**
     * Enable Supercluster for point features.
     * @default false
     */
    cluster?: boolean;
    /**
     * Options for the Supercluster point clustering algorithm.
     * @see {@link SuperclusterOptions}
     */
    clusterOptions?: SuperclusterOptions;
};

export type GeoJSONToTileOptions = GeoJSONVTOptions & {
    /**
     * Whether to wrap features around the antimeridian
     * @default false
     */
    wrap?: boolean;
    /**
     * Whether to clip features to the tile boundary
     * @default false
     */
    clip?: boolean;
};

export type StartEndSizeArray = number[] & { start?: number; end?: number; size?: number };

export type PartialGeoJSONVTFeature = {
    id?: number | string | undefined;
    tags: GeoJSON.GeoJsonProperties;
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
}

export type GeoJSONVTInternalPointFeature = PartialGeoJSONVTFeature & {
    type: 'Point';
    geometry: number[];
};

export type GeoJSONVTInternalMultiPointFeature = PartialGeoJSONVTFeature & {
    type: 'MultiPoint';
    geometry: number[];
};

export type GeoJSONVTInternalLineStringFeature = PartialGeoJSONVTFeature & {
    type: 'LineString';
    geometry: StartEndSizeArray;
};

export type GeoJSONVTInternalMultiLineStringFeature = PartialGeoJSONVTFeature & {
    type: 'MultiLineString';
    geometry: StartEndSizeArray[];
};

export type GeoJSONVTInternalPolygonFeature = PartialGeoJSONVTFeature & {
    type: 'Polygon';
    geometry: StartEndSizeArray[];
};

export type GeoJSONVTInternalMultiPolygonFeature = PartialGeoJSONVTFeature & {
    type: 'MultiPolygon';
    geometry: StartEndSizeArray[][];
};

export type GeoJSONVTInternalFeature =
    | GeoJSONVTInternalPointFeature
    | GeoJSONVTInternalMultiPointFeature
    | GeoJSONVTInternalLineStringFeature
    | GeoJSONVTInternalMultiLineStringFeature
    | GeoJSONVTInternalPolygonFeature
    | GeoJSONVTInternalMultiPolygonFeature;

/**
 * The geojson properies related to a cluster.
 */
export type ClusterProperties = {
    cluster: true;
    cluster_id: number;
    point_count: number;
    point_count_abbreviated: string | number;
    [key: string]: unknown;
};

/**
 * A geojson point with cluster properties, see {@link ClusterProperties}.
 */
export type ClusterFeature = GeoJSON.Feature<GeoJSON.Point, ClusterProperties>;

/**
 * A geojson point that is either a regular point or a cluster, which is a point with cluster properties.
 * See {@link ClusterFeature} for more information
 */
export type ClusterOrPointFeature = ClusterFeature | GeoJSON.Feature<GeoJSON.Point>;

export type GeoJSONVTInternalTileFeaturePoint = {
    id? : number | string | undefined;
    type: 1;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: number[];
}

export type GeoJSONVTInternalTileFeatureNonPoint = {
    id? : number | string | undefined;
    type: 2 | 3;
    tags: GeoJSON.GeoJsonProperties | null;
    geometry: number[][];
}
export type GeoJSONVTInternalTileFeature = GeoJSONVTInternalTileFeaturePoint | GeoJSONVTInternalTileFeatureNonPoint;

export type GeoJSONVTInternalTile = {
    transformed: boolean;
    features: GeoJSONVTInternalTileFeature[];
    source: GeoJSONVTInternalFeature[] | null;
    x: number;
    y: number;
    z: number;
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
    numPoints?: number;
    numSimplified?: number;
    numFeatures?: number;
}

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

export interface GeoJSONVTTileIndex {
    initialize(features: GeoJSONVTInternalFeature[]): void;
    updateIndex(source: GeoJSONVTInternalFeature[], affected: GeoJSONVTInternalFeature[], options: GeoJSONVTOptions): void;
    getClusterExpansionZoom(clusterId: number): number | null;
    getChildren(clusterId: number): ClusterOrPointFeature[] | null;
    getLeaves(clusterId: number, limit?: number, offset?: number): GeoJSON.Feature<GeoJSON.Point>[] | null
    getTile(z: number, x: number, y: number): GeoJSONVTTile | null
}

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