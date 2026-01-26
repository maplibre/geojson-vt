import Point from '@mapbox/point-geometry';
import type {GeoJSONVTFeature} from './transform';

export interface VectorTileFeatureLike {
    type: 0 | 1 | 2 | 3;
    properties: Record<string, number | string | boolean>;
    id: number | undefined;
    extent: number;
    loadGeometry(): Point[][];
}

export interface VectorTileLayerLike {
    version: number;
    name: string;
    extent: number;
    length: number;
    feature(i: number): VectorTileFeatureLike;
}

export interface VectorTileLike {
    layers: Record<string, VectorTileLayerLike>;
}

export interface GeoJSONOptions {
    version: number;
    extent: number;
}

class FeatureWrapper implements VectorTileFeatureLike {
    feature: GeoJSONVTFeature;
    type: VectorTileFeatureLike['type'];
    properties: VectorTileFeatureLike['properties'];
    id: VectorTileFeatureLike['id'];
    extent: VectorTileFeatureLike['extent'];

    constructor(feature: GeoJSONVTFeature, extent: number) {
        this.feature = feature;
        this.type = feature.type;
        this.properties = feature.tags ? feature.tags : {};
        this.extent = extent;

        // If the feature has a top-level `id` property, copy it over, but only
        // if it can be coerced to an integer, because this wrapper is used for
        // serializing geojson feature data into vector tile PBF data, and the
        // vector tile spec only supports integer values for feature ids --
        // allowing non-integer values here results in a non-compliant PBF
        // that causes an exception when it is parsed with vector-tile-js
        if ('id' in feature) {
            if (typeof feature.id === 'string') {
                this.id = parseInt(feature.id, 10);
            } else if (typeof feature.id === 'number' && !isNaN(feature.id)) {
                this.id = feature.id;
            }
        }
    }

    loadGeometry() {
        const geometry = [];
        const rawGeo = this.feature.type === 1 ? [this.feature.geometry] : this.feature.geometry;
        for (const ring of rawGeo) {
            const newRing = [];
            for (const point of ring) {
                newRing.push(new Point(point[0], point[1]));
            }
            geometry.push(newRing);
        }
        return geometry;
    }
}

export const GEOJSON_TILE_LAYER_NAME = "_geojsonTileLayer";

export class GeoJSONWrapper implements VectorTileLayerLike {
    layers: Record<string, VectorTileLayerLike>;
    features: GeoJSONVTFeature[];
    version: VectorTileLayerLike['version'];
    name: VectorTileLayerLike['name'];
    extent: VectorTileLayerLike['extent'];
    length: VectorTileLayerLike['length'];

    constructor(features: GeoJSONVTFeature[], options?: GeoJSONOptions) {
        this.layers = { [GEOJSON_TILE_LAYER_NAME]: this };
        this.name = GEOJSON_TILE_LAYER_NAME;
        this.version = options ? options.version : 1;
        this.extent = options ? options.extent : 4096;
        this.length = features.length;
        this.features = features;
    }

    feature(i: number): VectorTileFeatureLike {
        return new FeatureWrapper(this.features[i], this.extent);
    }
}