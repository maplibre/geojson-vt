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

export type ApplySourceDiffResult = {
    /**
     * The features affected by this update, which should be used to invalidate tiles
     */
    affected: GeoJSONVTInternalFeature[];
    /**
     * The updated source data, which should replace the existing source data in the index
     */
    source: GeoJSONVTInternalFeature[];
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
export function applySourceDiff(source: GeoJSONVTInternalFeature[], dataDiff: GeoJSONVTSourceDiff, options: GeoJSONVTOptions): ApplySourceDiffResult {
    // convert diff to sets/maps for o(1) lookups
    const diff = diffToHashed(dataDiff);

    // collection for features that will be affected by this update and used to invalidate tiles
    let affected: GeoJSONVTInternalFeature[] = [];

    if (diff.removeAll) {
        affected = source;
        source = [];
    }

    if (diff.remove.size || diff.add.size) {
        const removeFeatures = [];

        // Collect features to remove (explicit removals + replacements via add)
        for (const feature of source) {
            if (diff.remove.has(feature.id) || diff.add.has(feature.id)) {
                removeFeatures.push(feature);
            }
        }

        if (removeFeatures.length) {
            affected.push(...removeFeatures);
            const removeIds = new Set(removeFeatures.map(f => f.id));
            source = source.filter(f => !removeIds.has(f.id));
        }

        if (diff.add.size) {
            let addFeatures = convertToInternal({type: 'FeatureCollection', features: Array.from(diff.add.values())}, options);
            addFeatures = wrap(addFeatures, options);
            affected.push(...addFeatures);
            source.push(...addFeatures);
        }
    }

    if (diff.update.size) {
        // Features can be duplicated across the antimeridian (wrap) in a single tile, so must update all instances with the same id
        for (const [id, update] of diff.update) {
            const oldFeatures = [];
            const keepFeatures = [];

            for (const feature of source) {
                if (feature.id === id) {
                    oldFeatures.push(feature);
                } else {
                    keepFeatures.push(feature);
                }
            }
            if (!oldFeatures.length) continue;

            const updatedFeatures = getUpdatedFeatures(oldFeatures, update, options);
            if (!updatedFeatures.length) continue;

            affected.push(...oldFeatures, ...updatedFeatures);
            keepFeatures.push(...updatedFeatures);
            source = keepFeatures;
        }
    }

    return {affected, source};
}

/**
 * Gets updated simplified feature(s) based on a diff update object.
 * @param vtFeatures - the original features
 * @param update - the update object to apply
 * @param options - the options to use for the wrap method
 * @returns Updated features. If geometry is updated, returns new feature(s) converted from geojson and wrapped. If only properties are updated, returns feature(s) with tags updated.
 */
function getUpdatedFeatures(vtFeatures: GeoJSONVTInternalFeature[], update: GeoJSONVTFeatureDiff, options: GeoJSONVTOptions): GeoJSONVTInternalFeature[] {
    const changeGeometry = !!update.newGeometry;
    const changeProps =
        update.removeAllProperties ||
        update.removeProperties?.length > 0 ||
        update.addOrUpdateProperties?.length > 0;

    // if geometry changed, need to create a new geojson feature and convert to internal format
    if (changeGeometry) {
        const vtFeature = vtFeatures[0];
        const geojsonFeature = {
            type: 'Feature' as const,
            id: vtFeature.id,
            geometry: update.newGeometry,
            properties: changeProps ? applyPropertyUpdates(vtFeature.tags, update) : vtFeature.tags
        };

        let features = convertToInternal({type: 'FeatureCollection', features: [geojsonFeature]}, options);
        features = wrap(features, options);
        return features;
    }

    if (changeProps) {
        const updated = [];
        for (const vtFeature of vtFeatures) {
            const feature = {...vtFeature};
            feature.tags = applyPropertyUpdates(feature.tags, update);
            updated.push(feature);
        }
        return updated;
    }

    return [];
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
