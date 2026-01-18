export type GeoJSONVTOptions = {
    /**
     * max zoom to preserve detail on
     */
    maxZoom: number;
    /**
     * max zoom in the tile index
     */
    indexMaxZoom: number;
    /**
     * max number of points per tile in the tile index
     */
    indexMaxPoints: number;
    /**
     * simplification tolerance (higher means simpler)
     */
    tolerance: number;
    /**
     * tile extent
     */
    extent: number;
    /**
     * tile buffer on each side
     */
    buffer: number;
    /**
     * whether to calculate line metrics
     */
    lineMetrics: boolean;
    /**
     * name of a feature property to be promoted to feature.id
     */
    promoteId: string | null;
    /**
     * whether to generate feature ids. Cannot be used with promoteId
     */
    generateId: boolean;
    /**
     * whether geojson can be updated (with caveat of a stored simplified copy)
     */
    updateable: boolean;
    /**
     * logging level (0, 1 or 2)
     */
    debug: number;
}