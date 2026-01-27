
import type {GeoJSONVTFeature, GeoJSONVTFeatureNonPoint, GeoJSONVTFeaturePoint, GeoJSONVTTile} from './transform';
import type {GeoJSONVTInternalTile, GeoJSONVTInternalTileFeature, GeoJSONVTInternalTileFeaturePoint, GeoJSONVTInternalTileFeatureNonPoint} from './tile';
import type {GeoJSONVTFeatureDiff, GeoJSONVTSourceDiff} from './difference';
import type {GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTOptions, PartialGeoJSONVTFeature, StartEndSizeArray} from './definitions';
import type {SuperclusterOptions, ClusterFeature, ClusterProperties} from './supercluster';
import {GeoJSONVT} from './geojsonvt';
import {Supercluster} from './supercluster';

function geojsonvt(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    return new GeoJSONVT(data, options);
}

geojsonvt.GeoJSONVT = GeoJSONVT;
geojsonvt.Supercluster = Supercluster;

export default geojsonvt;

export type { 
    GeoJSONVTInternalFeature, 
    GeoJSONVTOptions, 
    GeoJSONVTInternalTile, 
    GeoJSONVTInternalTileFeature, 
    PartialGeoJSONVTFeature,
    StartEndSizeArray,
    GeoJSONVTTile,
    GeoJSONVTFeature,
    GeoJSONVTSourceDiff,
    GeoJSONVTFeatureDiff,
    GeoJSONVTFeaturePoint,
    GeoJSONVTFeatureNonPoint,
    GeoJSONVTInternalTileFeaturePoint,
    GeoJSONVTInternalTileFeatureNonPoint,
    GeoJSONVTInternalPointFeature,
    GeoJSONVTInternalMultiPointFeature,
    GeoJSONVTInternalLineStringFeature,
    GeoJSONVTInternalMultiLineStringFeature,
    GeoJSONVTInternalPolygonFeature,
    GeoJSONVTInternalMultiPolygonFeature,
    SuperclusterOptions,
    ClusterFeature,
    ClusterProperties
};
