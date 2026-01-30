import Benchmark from 'benchmark';
import geojsonvt, {geoJSONToTile} from '../src';

function generateRectangle(id, centerX, centerY, width, height) {
    const corners = [
        [centerX - width / 2, centerY + height / 2],
        [centerX + width / 2, centerY + height / 2],
        [centerX + width / 2, centerY - height / 2],
        [centerX - width / 2, centerY - height / 2],
        [centerX - width / 2, centerY + height / 2]
    ];

    return {
        id,
        type: 'Feature',
        properties: {name: `Rectangle ${id}`},
        geometry: {
            type: 'Polygon',
            coordinates: [corners]
        }
    };
}

function generateFeatures(count) {
    const features = [];
    for (let i = 0; i < count; i++) {
        const id = `rect-${i}`;
        const centerX = Math.random() * 360 - 180;
        const centerY = Math.random() * 180 - 90;
        const width = Math.random() * 0.5 + 0.1;
        const height = Math.random() * 0.5 + 0.1;
        features.push(generateRectangle(id, centerX, centerY, width, height));
    }
    return features;
}

const optionsConstructor = {
    maxZoom: 20,
    updateable: false
};

const optionsUpdate = {
    maxZoom: 20,
    updateable: true
};

const testConfigs = [
    {initial: 100, changing: 1, z: 20},
    {initial: 100, changing: 100, z: 20},
    {initial: 10000, changing: 1, z: 20},
    {initial: 10000, changing: 1000, z: 20},
    {initial: 100000, changing: 1, z: 20},
    {initial: 100000, changing: 1000, z: 20}
];

console.log('Starting geojson-vt benchmark - constructor vs updateData:\n');

testConfigs.forEach((config) => {
    return;
    const suite = new Benchmark.Suite();

    const initialFeatures = generateFeatures(config.initial);
    const changedFeatures = generateFeatures(config.changing);

    // Replace the first N features with changed ones
    const updatedFeatures = [...initialFeatures];
    for (let i = 0; i < config.changing; i++) {
        updatedFeatures[i] = changedFeatures[i];
    }

    const initialData = {
        type: 'FeatureCollection',
        features: initialFeatures
    };

    const updatedData = {
        type: 'FeatureCollection',
        features: updatedFeatures
    };

    const removeIds = [];
    for (let i = 0; i < config.changing; i++) {
        removeIds.push(`rect-${i}`);
    }

    const tileX = Math.floor(Math.pow(2, config.z) / 2);
    const tileY = Math.floor(Math.pow(2, config.z) / 2);

    let reusableIndex = geojsonvt(initialData, optionsUpdate);

    console.log(`\n${config.initial.toLocaleString()} Initial, ${config.changing.toLocaleString()} changing, getTile z=${config.z}:`);

    const results = {};

    suite
        .add('constructor', () => {
            const index = geojsonvt(updatedData, optionsConstructor);
            index.getTile(config.z, tileX, tileY);
        })
        .add('updateData', () => {
            reusableIndex.updateData({
                remove: removeIds,
                add: changedFeatures
            });
            reusableIndex.getTile(config.z, tileX, tileY);
        }, {
            onCycle: () => {
                reusableIndex = geojsonvt(initialData, optionsUpdate);
            }
        })
        .on('cycle', (event) => {
            const benchmark = event.target;
            results[benchmark.name] = {
                hz: benchmark.hz,
                stats: benchmark.stats
            };
            const opsPerSec = benchmark.hz.toFixed(2);
            console.log(`  ${benchmark.name}: ${opsPerSec} ops/sec`);
        })
        .on('complete', (event) => {
            const benches = event.currentTarget;
            const fastest = benches.filter('fastest').map('name')[0];
            const slowest = benches.filter('slowest').map('name')[0];

            const fastestHz = results[fastest].hz;
            const slowestHz = results[slowest].hz;

            const percentFaster = (((fastestHz - slowestHz) / slowestHz) * 100).toFixed(0);

            console.log(`  - ${fastest}: ${percentFaster}% faster`);
        })
        .run({
            async: false
        });
});

console.log('Starting getTile benchmark - geojsonvt vs geoJSONToTile:\n');

const getTileConfigs = [
    {featureCount: 1000, zoom: 14, description: '1k features, z14'},
    {featureCount: 100000, zoom: 14, description: '100k features, z14'}
];

const tilesToFetch = [
    {z: 14, x: 8192, y: 8192},
    {z: 14, x: 8193, y: 8192},
    {z: 14, x: 8192, y: 8193},
    {z: 14, x: 8193, y: 8193}
];

getTileConfigs.forEach((config) => {
    console.log(`\n${config.description}:`);

    const suite = new Benchmark.Suite();

    const features = generateFeatures(config.featureCount);
    const geojsonData = {type: 'FeatureCollection', features};
    const index = geojsonvt(geojsonData, {maxZoom: 14});

    const results = {};

    suite
        .add('geojsonvt.getTile (indexed)', () => {
            for (const tile of tilesToFetch) {
                index.getTile(tile.z, tile.x, tile.y);
            }
        })
        .add('geojsonvt.getTile (non-indexed)', () => {
            const newIndex = geojsonvt(geojsonData, {maxZoom: 14, indexMaxZoom: 0});
            for (const tile of tilesToFetch) {
                newIndex.getTile(tile.z, tile.x, tile.y);
            }
        })
        .add('geoJSONToTile (on-demand)', () => {
            for (const tile of tilesToFetch) {
                geoJSONToTile(geojsonData, tile.z, tile.x, tile.y, {clip: true});
            }
        })
        .on('cycle', (event) => {
            const benchmark = event.target;
            results[benchmark.name] = {
                hz: benchmark.hz,
                stats: benchmark.stats
            };
            const opsPerSec = benchmark.hz.toFixed(2);
            console.log(`  ${benchmark.name}: ${opsPerSec} ops/sec`);
        })
        .run({
            async: false
        });
});
