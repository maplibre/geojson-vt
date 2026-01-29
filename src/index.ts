
import type {GeoJSONVTTile} from './transform';
import type {GeoJSONVTInternalTile} from './tile';
import type {GeoJSONVTFeatureDiff, GeoJSONVTSourceDiff} from './difference';
import type {GeoJSONVTInternalFeature, GeoJSONVTInternalLineStringFeature, GeoJSONVTInternalMultiLineStringFeature, GeoJSONVTInternalMultiPointFeature, GeoJSONVTInternalMultiPolygonFeature, GeoJSONVTInternalPointFeature, GeoJSONVTInternalPolygonFeature, GeoJSONVTOptions, StartEndSizeArray, GeoJSONVTFeature, GeoJSONVTFeaturePoint, GeoJSONVTFeatureNonPoint, GeoJSONVTPoint, GeoJSONVTRing, GeoJSONVTPartialInternalFeature} from './definitions';
import {GeoJSONVT} from './geojsonvt';

export default function geojsonvt(data: GeoJSON.GeoJSON, options?: GeoJSONVTOptions) {
    return new GeoJSONVT(data, options);
}

export type { 
    GeoJSONVT,
    GeoJSONVTOptions,
    StartEndSizeArray,
    GeoJSONVTTile,
    GeoJSONVTFeature,
    GeoJSONVTSourceDiff,
    GeoJSONVTFeatureDiff,
    GeoJSONVTFeaturePoint,
    GeoJSONVTFeatureNonPoint,
    GeoJSONVTPoint,
    GeoJSONVTRing,
    GeoJSONVTInternalTile,
    GeoJSONVTPartialInternalFeature,
    GeoJSONVTInternalPointFeature,
    GeoJSONVTInternalMultiPointFeature,
    GeoJSONVTInternalLineStringFeature,
    GeoJSONVTInternalMultiLineStringFeature,
    GeoJSONVTInternalPolygonFeature,
    GeoJSONVTInternalMultiPolygonFeature,
    GeoJSONVTInternalFeature
};
