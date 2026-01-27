/*global importScripts geojsonvt */

importScripts('../../dist/geojson-vt-dev.js');

const Supercluster = geojsonvt.Supercluster;
const GeoJSONVT = geojsonvt.GeoJSONVT;

const now = Date.now();

let index;

getJSON('../../test/fixtures/places.json', (geojson) => {
    console.log(`loaded ${geojson.features.length} points JSON in ${(Date.now() - now) / 1000}s`);

    // old method - using the class directly
    // index = new Supercluster({
    //     log: true,
    //     radius: 60,
    //     extent: 256,
    //     maxZoom: 17
    // }).load(geojson.features);

    // new method - using updateable geojsonvt
    index = new GeoJSONVT(geojson, {
        updateable: true,
        clusterOptions: {
            log: true,
            radius: 60,
            extent: 256,
            maxZoom: 17
        }
    });

    console.log(index.getTile(0, 0, 0, true));

    postMessage({ready: true});
});

self.onmessage = function (e) {
    if (e.data.getClusterExpansionZoom) {
        postMessage({
            expansionZoom: index.superCluster.getClusterExpansionZoom(e.data.getClusterExpansionZoom),
            center: e.data.center
        });
    } else if (e.data) {
        postMessage(index.superCluster.getClusters(e.data.bbox, e.data.zoom));
    }
};

function getJSON(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            callback(xhr.response);
        }
    };
    xhr.send();
}
