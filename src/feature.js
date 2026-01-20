
export function createFeature(id, type, geom, tags) {
    const data = {type, geom};
    const feature = {
        id: id == null ? null : id,
        type: data.type,
        geometry: data.geom,
        tags,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    };

    switch (data.type) {
    case 'Point':
    case 'MultiPoint':
    case 'LineString':
        calcLineBBox(feature, data.geom);
        break;
    case 'Polygon':
        // the outer ring (ie [0]) contains all inner rings
        calcLineBBox(feature, data.geom[0]);
        break;
    case 'MultiLineString':
        for (const line of data.geom) {
            calcLineBBox(feature, line);
        }
        break;
    case 'MultiPolygon':
        for (const polygon of data.geom) {
            // the outer ring (ie [0]) contains all inner rings
            calcLineBBox(feature, polygon[0]);
        }
        break;
    }

    return feature;
}

function calcLineBBox(feature, geom) {
    for (let i = 0; i < geom.length; i += 3) {
        feature.minX = Math.min(feature.minX, geom[i]);
        feature.minY = Math.min(feature.minY, geom[i + 1]);
        feature.maxX = Math.max(feature.maxX, geom[i]);
        feature.maxY = Math.max(feature.maxY, geom[i + 1]);
    }
}
