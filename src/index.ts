
import type {GeoJSONVTFeature, GeoJSONVTFeatureNonPoint, GeoJSONVTFeaturePoint, GeoJSONVTTile} from './transform';
import type {GeoJSONVTInternalTile, GeoJSONVTInternalTileFeature, GeoJSONVTInternalTileFeaturePoint, GeoJSONVTInternalTileFeatureNonPoint} from './tile';
import type {GeoJSONVTFeatureDiff, GeoJSONVTSourceDiff} from './difference';
import type {GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTOptions, GeoJSONToTileOptions, PartialGeoJSONVTFeature, StartEndSizeArray} from './definitions';
import {GeoJSONVT} from './geojsonvt';

export default function geojsonvt(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    return new GeoJSONVT(data, options);
}

export type {
    GeoJSONVTInternalFeature,
    GeoJSONVTOptions,
    GeoJSONToTileOptions,
    GeoJSONVTInternalTile, 
    GeoJSONVTInternalTileFeature, 
    PartialGeoJSONVTFeature,
    GeoJSONVT,
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
    GeoJSONVTInternalMultiPolygonFeature
};
