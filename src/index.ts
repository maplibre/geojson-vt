
import type {GeoJSONVTTile} from './transform';
import type {GeoJSONVTInternalTile, GeoJSONVTFeature, GeoJSONVTFeaturePoint, GeoJSONVTFeatureNonPoint, GeoJSONVTPoint, GeoJSONVTRing} from './tile';
import type {GeoJSONVTFeatureDiff, GeoJSONVTSourceDiff} from './difference';
import type {GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTOptions, PartialGeoJSONVTFeature, StartEndSizeArray} from './definitions';
import {GeoJSONVT} from './geojsonvt';

export default function geojsonvt(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    return new GeoJSONVT(data, options);
}

export type { 
    GeoJSONVTInternalFeature, 
    GeoJSONVTOptions, 
    GeoJSONVTInternalTile, 
    PartialGeoJSONVTFeature,
    GeoJSONVT,
    StartEndSizeArray,
    GeoJSONVTTile,
    GeoJSONVTFeature,
    GeoJSONVTSourceDiff,
    GeoJSONVTFeatureDiff,
    GeoJSONVTFeaturePoint,
    GeoJSONVTFeatureNonPoint,
    GeoJSONVTPoint,
    GeoJSONVTRing,
    GeoJSONVTInternalPointFeature,
    GeoJSONVTInternalMultiPointFeature,
    GeoJSONVTInternalLineStringFeature,
    GeoJSONVTInternalMultiLineStringFeature,
    GeoJSONVTInternalPolygonFeature,
    GeoJSONVTInternalMultiPolygonFeature
};
