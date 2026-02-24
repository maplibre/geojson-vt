import type { ClusterOrPointFeature, GeoJSONVTInternalFeature, GeoJSONVTOptions } from "./definitions";
import type { GeoJSONVTTile } from "./transform";

export interface GeoJSONDataHandler {
    initialize(features: GeoJSONVTInternalFeature[]): void;
    updateIndex(source: GeoJSONVTInternalFeature[], affected: GeoJSONVTInternalFeature[], options: GeoJSONVTOptions): void;
    getClusterExpansionZoom(clusterId: number): number | null;
    getChildren(clusterId: number): ClusterOrPointFeature[] | null;
    getLeaves(clusterId: number, limit?: number, offset?: number): GeoJSON.Feature<GeoJSON.Point>[] | null
    getTile(z: number, x: number, y: number): GeoJSONVTTile | null
}