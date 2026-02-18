
import type {GeoJSONVTFeature, GeoJSONVTFeatureNonPoint, GeoJSONVTFeaturePoint, GeoJSONVTTile} from './transform';
import type {GeoJSONVTInternalTile, GeoJSONVTInternalTileFeature, GeoJSONVTInternalTileFeaturePoint, GeoJSONVTInternalTileFeatureNonPoint} from './tile';
import type {GeoJSONVTFeatureDiff, GeoJSONVTSourceDiff} from './difference';
import type {GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTOptions, GeoJSONToTileOptions, PartialGeoJSONVTFeature, StartEndSizeArray} from './definitions';
import type {SuperclusterOptions, ClusterProperties, ClusterFeature, ClusterFeatureInternal, ClusterInternalPointFeature, KDBushWithData} from './supercluster';
import {GeoJSONVT} from './geojsonvt';
import {Supercluster} from './supercluster';
import {geoJSONToTile} from './geoJSONToTile';

function geojsonvt(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    return new GeoJSONVT(data, options);
}

geojsonvt.GeoJSONVT = GeoJSONVT;
geojsonvt.Supercluster = Supercluster;
geojsonvt.geoJSONToTile = geoJSONToTile;

export default geojsonvt;

export type {
    GeoJSONVT,
    GeoJSONVTInternalFeature, 
    GeoJSONVTOptions,
    GeoJSONToTileOptions,
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
    Supercluster,
    SuperclusterOptions,
    ClusterProperties,
    ClusterFeature,
    ClusterFeatureInternal,
    ClusterInternalPointFeature,
    KDBushWithData
};
