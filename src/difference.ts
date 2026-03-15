import {convertToInternal} from './convert';
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
            let addFeatures = convertToInternal({type: 'FeatureCollection', features: Array.from(diff.add.values())}, options);

            // wraps features (ie extreme west and extreme east)
            addFeatures = wrap(addFeatures, options);

            affected.push(...addFeatures);
            source.push(...addFeatures);
        }
    }

    if (diff.update.size) {
        for (const [id, update] of diff.update) {

            const changeGeometry = !!update.newGeometry;
            const changeProps =
                update.removeAllProperties ||
                update.removeProperties?.length > 0 ||
                update.addOrUpdateProperties?.length > 0;

            if (!changeGeometry && !changeProps) {
                continue;
            }
            const featureIndexes: number[] = [];
            source.reduce((acc, feature, index) => {
                if (feature.id === id) {
                    acc.push(index);
                }
                return acc;
            }, featureIndexes);
            if (featureIndexes.length == 0) {
                continue;
            }

            const feature = source[featureIndexes[0]];

            const updatedFeatures = getUpdatedFeatures(feature, update, options, changeGeometry, changeProps);
            // Track both features for invalidation
            affected.push(feature, ...updatedFeatures);

            if (featureIndexes.length == updatedFeatures.length) {
                for (let i = 0; i < featureIndexes.length; i++) {
                    source[featureIndexes[i]] = updatedFeatures[i];
                }
                continue;
            }

            if (featureIndexes.length > updatedFeatures.length) {
                let i = 0;
                for (; i < updatedFeatures.length; i++) {
                    source[featureIndexes[i]] = updatedFeatures[i];
                }
                for (; i < featureIndexes.length; i++) {
                    source.splice(featureIndexes[i], 1);
                }
                continue;
            }
            // more updated features than old features
            let i = 0;
            for (; i < featureIndexes.length; i++) {
                source[featureIndexes[i]] = updatedFeatures[i];
            }
            for (; i < updatedFeatures.length; i++) {
                source.push(updatedFeatures[i]);
            }
        }
    }

    return {affected, source};
}

/**
 * Gets updated simplified feature(s) based on a diff update object.
 * @param vtFeature - the original feature
 * @param update - the update object to apply
 * @param options - the options to use for the wrap method
 * @returns Updated features. If geometry is updated, returns a new feature converted from geojson and wrapped (maybe more than one). If only properties are updated, returns a single updated feature with tags updated.
 */
function getUpdatedFeatures(vtFeature: GeoJSONVTInternalFeature, update: GeoJSONVTFeatureDiff, options: GeoJSONVTOptions, changeGeometry: boolean, changeProps: boolean): GeoJSONVTInternalFeature[] {
    // if geometry changed, need to create new geojson feature and convert to simplified format
    if (changeGeometry) {
        const geojsonFeature = {
            type: 'Feature' as const,
            id: vtFeature.id,
            geometry: update.newGeometry,
            properties: changeProps ? applyPropertyUpdates(vtFeature.tags, update) : vtFeature.tags
        };

        // projects and adds simplification info
        let features = convertToInternal({type: 'FeatureCollection', features: [geojsonFeature]}, options);

        // wraps features (ie extreme west and extreme east)
        features = wrap(features, options);

        return features;
    }

    // only properties changed - update tags directly
    const feature = {...vtFeature};
    feature.tags = applyPropertyUpdates(feature.tags, update);
    return [feature];
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
