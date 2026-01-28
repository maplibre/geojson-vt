import type {SuperclusterOptions} from './supercluster';

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
     * @default false
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


export type StartEndSizeArray = number[] & { start?: number; end?: number; size?: number };

export type PartialGeoJSONVTFeature = {
    id?: number | string | undefined;
    tags: GeoJSON.GeoJsonProperties;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
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