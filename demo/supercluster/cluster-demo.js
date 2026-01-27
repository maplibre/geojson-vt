
/* global geojsonvt */

const Supercluster = geojsonvt.Supercluster;
const GeoJSONVT = geojsonvt.GeoJSONVT;
const clusterOptions = {
    log: true,
    radius: 10,
    extent: 256,
    maxZoom: 17
};

// Animation state for moving points
let animationId = null;
const NUM_POINTS = 10;
const VELOCITY_SCALE = 0.5; // Speed
let movingPoints = [];

// Initialize points with random positions and velocities
function initializePoints() {
    movingPoints = [];
    for (let i = 0; i < NUM_POINTS; i++) {
        movingPoints.push({
            id: `animated-point-${i}`,
            lon: Math.random() * 360 - 180,
            lat: Math.random() * 170 - 85,
            velocityX: (Math.random() - 0.5) * VELOCITY_SCALE,
            velocityY: (Math.random() - 0.5) * VELOCITY_SCALE
        });
    }
}

const padding = 8 / 512;
const totalExtent = 256 * (1 + padding * 2);

let tileIndex;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const height = canvas.height = canvas.width = window.innerHeight - 5;
const ratio = height / totalExtent;
const pad = 256 * padding * ratio;

const backButton = document.getElementById('back');
const coordDiv = document.getElementById('coord');

let x = 0;
let y = 0;
let z = 0;

if (devicePixelRatio > 1) {
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    canvas.width *= 2;
    canvas.height *= 2;
    ctx.scale(2, 2);
}

ctx.textAlign = 'center';
ctx.font = '48px Helvetica, Arial';
ctx.fillText('Loading...', height / 2, height / 2);

// Load the places data
fetch('../../test/fixtures/places.json')
    .then(res => res.json())
    .then(geojson => {
        console.log(`loaded ${geojson.features.length} points`);

        //old method
        // tileIndex = new Supercluster(clusterOptions).load(geojson.features);

        //new method
        tileIndex = new GeoJSONVT(geojson, {updateable: true, clusterOptions});

        drawTile();

        // Initialize and start the point animation
        initializePoints();
        startAnimation();
    });

ctx.lineWidth = 1;
const halfHeight = height / 2;

function drawGrid() {
    ctx.strokeStyle = 'lightgreen';
    ctx.strokeRect(pad, pad, height - 2 * pad, height - 2 * pad);
    ctx.beginPath();
    ctx.moveTo(pad, halfHeight);
    ctx.lineTo(height - pad, halfHeight);
    ctx.moveTo(halfHeight, pad);
    ctx.lineTo(halfHeight, height - pad);
    ctx.stroke();
}

function drawSquare(left, top) {
    ctx.strokeStyle = 'blue';
    ctx.strokeRect(left ? pad : halfHeight, top ? pad : halfHeight, halfHeight - pad, halfHeight - pad);
}

function drawTile() {
    console.time(`getting tile z${z}-${x}-${y}`);
    const tile = tileIndex.getTile(z, x, y, true);
    console.timeEnd(`getting tile z${z}-${x}-${y}`);

    coordDiv.textContent = `tile: z${z}-${x}-${y}`;
    ctx.clearRect(0, 0, height, height);

    if (!tile) {
        ctx.fillStyle = 'black';
        ctx.fillText(`No tile at z${z}-${x}-${y}`, height / 2, height / 2);
        drawGrid();
        return;
    }

    const features = tile.features;

    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const geom = feature.geometry;
        const isCluster = feature.tags && feature.tags.cluster;
        const pointCount = feature.tags?.point_count || 1;

        // Size based on cluster count
        const radius = isCluster ? Math.min(20, 5 + Math.log2(pointCount) * 3) : 4;

        // Color: clusters are blue, single points are red
        ctx.fillStyle = isCluster ? 'rgba(0, 100, 255, 0.7)' : 'rgba(255, 0, 0, 0.7)';
        ctx.strokeStyle = isCluster ? 'rgba(0, 50, 200, 1)' : 'rgba(200, 0, 0, 1)';

        ctx.beginPath();
        ctx.arc(geom[0][0] * ratio + pad, geom[0][1] * ratio + pad, radius, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.stroke();

        // Draw count for clusters
        if (isCluster) {
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pointCount, geom[0][0] * ratio + pad, geom[0][1] * ratio + pad);
        }
    }

    drawGrid();
}

canvas.onclick = function (e) {
    if (!tileIndex || z >= clusterOptions.maxZoom) return;

    const mouseX = e.layerX - 10;
    const mouseY = e.layerY - 10;
    const left = mouseX / height < 0.5;
    const top = mouseY / height < 0.5;

    z++;
    x *= 2;
    y *= 2;
    if (!left) x++;
    if (!top) y++;

    drawTile();
    drawSquare(left, top);

    if (z > 0) backButton.style.display = '';
};

canvas.onmousemove = function (e) {
    if (!tileIndex) return;

    const mouseX = e.layerX - 10;
    const mouseY = e.layerY - 10;
    const left = mouseX / height < 0.5;
    const top = mouseY / height < 0.5;
    drawGrid();
    drawSquare(left, top);
};

backButton.style.display = 'none';

backButton.onclick = function () {
    if (!tileIndex || z === 0) return;
    z--;
    x = Math.floor(x / 2);
    y = Math.floor(y / 2);
    drawTile();
    if (z === 0) backButton.style.display = 'none';
};

// Animation functions for the moving points
function createPointFeature(point) {
    return {
        type: 'Feature',
        id: point.id,
        properties: { name: point.id },
        geometry: {
            type: 'Point',
            coordinates: [point.lon, point.lat]
        }
    };
}

function updateMovingPoints() {
    const removeIds = [];
    const addFeatures = [];

    for (const point of movingPoints) {
        // Update position
        point.lon += point.velocityX;
        point.lat += point.velocityY;

        // Bounce off boundaries
        if (point.lon < -180 || point.lon > 180) {
            point.velocityX *= -1;
            point.lon = Math.max(-180, Math.min(180, point.lon));
        }
        if (point.lat < -85 || point.lat > 85) {
            point.velocityY *= -1;
            point.lat = Math.max(-85, Math.min(85, point.lat));
        }

        removeIds.push(point.id);
        addFeatures.push(createPointFeature(point));
    }

    tileIndex.updateData({
        remove: removeIds,
        add: addFeatures
    });

    drawTile();
    animationId = requestAnimationFrame(updateMovingPoints);
}

function startAnimation() {
    if (animationId) return;

    // Add initial points
    const initialFeatures = movingPoints.map(createPointFeature);
    tileIndex.updateData({
        add: initialFeatures
    });

    animationId = requestAnimationFrame(updateMovingPoints);
}

function stopAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Keyboard controls: 's' to start, 'x' to stop
document.addEventListener('keydown', (e) => {
    if (e.key === 's') startAnimation();
    if (e.key === 'x') stopAnimation();
});
