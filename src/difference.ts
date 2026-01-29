import {convert} from './convert';
import {wrap} from './wrap';
import type { GeoJSONVTInternalFeature, GeoJSONVTOptions } from './definitions';

export type GeoJSONVTSourceDiff = {
    /**
     * If true, clear all existing features
     */
    removeAll?: boolean;
    /**
     * Array of feature IDs to remove
     */
    remove?: (string | number)[];
    /**
     * Array of GeoJSON features to add
     */
    add?: GeoJSON.Feature[];
    /**
     * Array of per-feature updates
     */
    update?: GeoJSONVTFeatureDiff[];
};

export type GeoJSONVTFeatureDiff = {
    /**
     * ID of the feature being updated
     */
    id: string | number;
    /**
     * Optional new geometry
     */
    newGeometry?: GeoJSON.Geometry;
    /**
     * Remove all properties if true
     */
    removeAllProperties?: boolean;
    /**
     * Specific properties to delete
     */
    removeProperties?: string[];
    /**
     * Properties to add or update
     */
    addOrUpdateProperties?: {
        key: string;
        value: unknown;
    }[];
};

type HashedGeoJSONVTSourceDiff = {
    removeAll?: boolean | undefined;
    remove: Set<string | number>;
    add: Map<string | number | undefined, GeoJSON.Feature>;
    update: Map<string | number, GeoJSONVTFeatureDiff>;
};

/**
 * Applies a GeoJSON Source Diff to an existing set of simplified features
 * @param source 
 * @param dataDiff 
 * @param options 
 * @returns 
 */
export function applySourceDiff(source: GeoJSONVTInternalFeature[], dataDiff: GeoJSONVTSourceDiff, options: GeoJSONVTOptions) {

    // convert diff to sets/maps for o(1) lookups
    const diff = diffToHashed(dataDiff);

    // collection for features that will be affected by this update
    let affected: GeoJSONVTInternalFeature[] = [];

    // full removal - clear everything before applying diff
    if (diff.removeAll) {
        affected = source;
        source = [];
    }

    // remove/add features and collect affected ones
    if (diff.remove.size || diff.add.size) {
        const removeFeatures = [];

        // collect source features to be removed
        for (const feature of source) {
            const {id} = feature;

            // explicit feature removal
            if (diff.remove.has(id)) {
                removeFeatures.push(feature);
            // feature with duplicate id being added
            } else if (diff.add.has(id)) {
                removeFeatures.push(feature);
            }
        }

        // collect affected and remove from source
        if (removeFeatures.length) {
            affected.push(...removeFeatures);

            const removeIds = new Set(removeFeatures.map(f => f.id));
            source = source.filter(f => !removeIds.has(f.id));
        }

        // convert and add new features
        if (diff.add.size) {
            // projects and adds simplification info
            let addFeatures = convert({type: 'FeatureCollection', features: Array.from(diff.add.values())}, options);

            // wraps features (ie extreme west and extreme east)
            addFeatures = wrap(addFeatures, options);

            affected.push(...addFeatures);
            source.push(...addFeatures);
        }
    }

    if (diff.update.size) {
        for (const [id, update] of diff.update) {
            const featureIndex = source.findIndex(f => f.id === id);
            if (featureIndex === -1) continue;

            const feature = source[featureIndex];

            // get updated geojsonvt simplified feature
            const updatedFeature = getUpdatedFeature(feature, update, options);
            if (!updatedFeature) continue;

            // track both features for invalidation
            affected.push(feature, updatedFeature);

            // replace old feature with updated feature
            source[featureIndex] = updatedFeature;
        }
    }

    return {affected, source};
}

// return an updated geojsonvt simplified feature
function getUpdatedFeature(vtFeature: GeoJSONVTInternalFeature, update: GeoJSONVTFeatureDiff, options: GeoJSONVTOptions): GeoJSONVTInternalFeature | null {
    const changeGeometry = !!update.newGeometry;

    const changeProps =
        update.removeAllProperties ||
        update.removeProperties?.length > 0 ||
        update.addOrUpdateProperties?.length > 0;

    // if geometry changed, need to create new geojson feature and convert to simplified format
    if (changeGeometry) {
        const geojsonFeature = {
            type: 'Feature' as const,
            id: vtFeature.id,
            geometry: update.newGeometry,
            properties: changeProps ? applyPropertyUpdates(vtFeature.tags, update) : vtFeature.tags
        };

        // projects and adds simplification info
        let features = convert({type: 'FeatureCollection', features: [geojsonFeature]}, options);

        // wraps features (ie extreme west and extreme east)
        features = wrap(features, options);

        return features[0];
    }

    // only properties changed - update tags directly
    if (changeProps) {
        const feature = {...vtFeature};
        feature.tags = applyPropertyUpdates(feature.tags, update);
        return feature;
    }

    return null;
}

/**
 * helper to apply property updates from a diff update object to a properties object
 */
function applyPropertyUpdates(tags: GeoJSON.GeoJsonProperties, update: GeoJSONVTFeatureDiff): GeoJSON.GeoJsonProperties {
    if (update.removeAllProperties) {
        return {};
    }

    const properties = {...tags || {}};

    if (update.removeProperties) {
        for (const key of update.removeProperties) {
            delete properties[key];
        }
    }

    if (update.addOrUpdateProperties) {
        for (const {key, value} of update.addOrUpdateProperties) {
            properties[key] = value;
        }
    }

    return properties;
}

/**
 * Convert a GeoJSON Source Diff to an idempotent hashed representation using Sets and Maps
 */
export function diffToHashed(diff: GeoJSONVTSourceDiff): HashedGeoJSONVTSourceDiff {
    if (!diff) return {
        remove: new Set(),
        add: new Map(),
        update: new Map()
    };

    const hashed: HashedGeoJSONVTSourceDiff = {
        removeAll: diff.removeAll,
        remove: new Set(diff.remove || []),
        add: new Map(diff.add?.map(feature => [feature.id, feature])),
        update: new Map(diff.update?.map(update => [update.id, update]))
    };

    return hashed;
}
