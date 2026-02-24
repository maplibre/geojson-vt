
import type {GeoJSONVTFeatureDiff, GeoJSONVTSourceDiff} from './difference';
import type {GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTOptions, GeoJSONToTileOptions, PartialGeoJSONVTFeature, StartEndSizeArray, ClusterProperties, ClusterFeature, ClusterOrPointFeature, GeoJSONVTTile, GeoJSONVTFeature, GeoJSONVTFeaturePoint, GeoJSONVTFeatureNonPoint, GeoJSONVTInternalTileFeaturePoint, GeoJSONVTInternalTileFeatureNonPoint, GeoJSONVTInternalTile, GeoJSONVTInternalTileFeature, GeoJSONVTTileIndex, SuperclusterOptions} from './definitions';
import type {KDBushWithData} from './cluster-tile-index';
import {GeoJSONVT} from './geojsonvt';
import {ClusterTileIndex} from './cluster-tile-index';
import {geoJSONToTile} from './geojson-to-tile';

function geojsonvt(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    return new GeoJSONVT(data, options);
}

geojsonvt.GeoJSONVT = GeoJSONVT;
geojsonvt.Supercluster = ClusterTileIndex;
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
    ClusterTileIndex as Supercluster,
    SuperclusterOptions,
    ClusterProperties,
    ClusterFeature,
    ClusterOrPointFeature,
    KDBushWithData,
    GeoJSONVTTileIndex
};
