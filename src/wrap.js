
import {clip} from './clip.js';
import {createFeature} from './feature.js';

export function wrap(features, options) {
    const buffer = options.buffer / options.extent;
    let merged = features;
    const left  = clip(features, 1, -1 - buffer, buffer,     0, -1, 2, options); // left world copy
    const right = clip(features, 1,  1 - buffer, 2 + buffer, 0, -1, 2, options); // right world copy

    if (left || right) {
        merged = clip(features, 1, -buffer, 1 + buffer, 0, -1, 2, options) || []; // center world copy

        if (left) merged = shiftFeatureCoords(left, 1).concat(merged); // merge left into center
        if (right) merged = merged.concat(shiftFeatureCoords(right, -1)); // merge right into center
    }

    return merged;
}

function shiftFeatureCoords(features, offset) {
    const newFeatures = [];

    for (let feature of features) {

        switch (feature.type) {
            case 'Point':
            case 'MultiPoint':
            case 'LineString':
                newFeatures.push(createFeature(feature.id, feature.type, shiftCoords(feature.geometry, offset), feature.tags));
                break;
            case 'MultiLineString':
            case 'Polygon': {
                    const newGeometry = [];
                    for (const line of feature.geometry) {
                        newGeometry.push(shiftCoords(line, offset));
                    }
                    newFeatures.push(createFeature(feature.id, feature.type, newGeometry, feature.tags));
                }                
                break;
            case 'MultiPolygon': {
                const newGeometry = [];
                for (const polygon of feature.geometry) {
                    const newPolygon = [];
                    for (const line of polygon) {
                        newPolygon.push(shiftCoords(line, offset));
                    }
                    newGeometry.push(newPolygon);
                }
                newFeatures.push(createFeature(feature.id, feature.type, newGeometry, feature.tags));
                break;
            }
        }    
    }

    return newFeatures;
}

function shiftCoords(points, offset) {
    const newPoints = [];
    newPoints.size = points.size;

    if (points.start !== undefined) {
        newPoints.start = points.start;
        newPoints.end = points.end;
    }

    for (let i = 0; i < points.length; i += 3) {
        newPoints.push(points[i] + offset, points[i + 1], points[i + 2]);
    }
    return newPoints;
}
