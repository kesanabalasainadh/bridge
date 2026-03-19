const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
let Supercluster;

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
let bridges = [];
let curatedBridges = [];
let curatedMap = {};  // id -> curated bridge data
let clusterIndex = null;

const bridgesPath = path.join(__dirname, 'data', 'bridges.json');
const curatedPath = path.join(__dirname, 'data', 'nyc-curated.json');

if (fs.existsSync(bridgesPath)) {
  try {
    bridges = JSON.parse(fs.readFileSync(bridgesPath, 'utf-8'));
    console.log(`Loaded ${bridges.length} bridges from ${bridgesPath}`);
  } catch (err) {
    console.error('Error loading bridges.json:', err.message);
  }
} else {
  console.warn('WARNING: data/bridges.json not found.');
  console.warn('Run "npm run setup-data" to download and process NBI data.');
}

if (fs.existsSync(curatedPath)) {
  try {
    curatedBridges = JSON.parse(fs.readFileSync(curatedPath, 'utf-8'));
    curatedBridges.forEach(b => { curatedMap[b.id] = b; });
    console.log(`Loaded ${curatedBridges.length} curated NYC bridges from ${curatedPath}`);
  } catch (err) {
    console.error('Error loading nyc-curated.json:', err.message);
  }
} else {
  console.warn('WARNING: data/nyc-curated.json not found.');
}

// ---------------------------------------------------------------------------
// Build Supercluster index
// ---------------------------------------------------------------------------
function buildClusterIndex() {
  if (bridges.length === 0) {
    console.log('No bridge data – skipping cluster index build.');
    return;
  }

  const features = bridges.map(b => ({
    type: 'Feature',
    properties: { id: b.id },
    geometry: { type: 'Point', coordinates: [b.lng, b.lat] }
  }));

  clusterIndex = new Supercluster({
    radius: 60,
    maxZoom: 14,
    map: (props) => ({ bridgeId: props.id, count: 1 }),
    reduce: (accumulated, props) => { accumulated.count += props.count; }
  });

  clusterIndex.load(features);
  console.log('Supercluster index built.');
}

// Supercluster is ESM-only in v8+, load dynamically
async function loadSupercluster() {
  try {
    const sc = await import('supercluster');
    Supercluster = sc.default || sc;
    buildClusterIndex();
  } catch (e) {
    console.warn('Supercluster not available, clustering disabled:', e.message);
  }
}
loadSupercluster();

// ---------------------------------------------------------------------------
// Helper: build a lookup map by bridge id for fast access
// ---------------------------------------------------------------------------
const bridgeMap = {};
bridges.forEach(b => { bridgeMap[b.id] = b; });

// ---------------------------------------------------------------------------
// API: GET /api/bridges
// ---------------------------------------------------------------------------
app.get('/api/bridges', (req, res) => {
  try {
    const { bbox, zoom } = req.query;

    if (!bbox || zoom === undefined) {
      return res.status(400).json({ error: 'Missing required query params: bbox, zoom' });
    }

    const [west, south, east, north] = bbox.split(',').map(Number);
    const z = parseInt(zoom, 10);

    if ([west, south, east, north].some(isNaN) || isNaN(z)) {
      return res.status(400).json({ error: 'Invalid bbox or zoom values' });
    }

    if (z < 8 && clusterIndex) {
      // Return clusters
      const clusters = clusterIndex.getClusters([west, south, east, north], z);
      const limited = clusters.slice(0, 2000);
      return res.json({ type: 'FeatureCollection', features: limited });
    }

    // Return individual bridges within bounding box
    const results = [];
    for (const b of bridges) {
      if (b.lng >= west && b.lng <= east && b.lat >= south && b.lat <= north) {
        results.push({
          type: 'Feature',
          properties: {
            id: b.id,
            name: b.name,
            lat: b.lat,
            lng: b.lng,
            yearBuilt: b.yearBuilt,
            type: b.type,
            condition: b.condition,
            adt: b.adt,
            length: b.length,
            owner: b.owner,
            state: b.state,
            facilityCarried: b.facilityCarried,
            featureCrossed: b.featureCrossed
          },
          geometry: { type: 'Point', coordinates: [b.lng, b.lat] }
        });
        if (results.length >= 2000) break;
      }
    }

    return res.json({ type: 'FeatureCollection', features: results });
  } catch (err) {
    console.error('Error in /api/bridges:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// API: GET /api/bridges/:id
// ---------------------------------------------------------------------------
app.get('/api/bridges/:id', (req, res) => {
  try {
    const id = req.params.id;
    const bridge = bridgeMap[id];

    if (!bridge) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Merge curated data if available
    const curated = curatedMap[id] || {};
    const merged = { ...bridge, ...curated };

    return res.json(merged);
  } catch (err) {
    console.error('Error in /api/bridges/:id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// API: GET /api/stats
// ---------------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  try {
    if (bridges.length === 0) {
      return res.json({
        totalBridges: 0,
        totalByState: [],
        avgAge: 0,
        conditionBreakdown: { good: 0, fair: 0, poor: 0 },
        totalADT: 0
      });
    }

    const currentYear = new Date().getFullYear();

    // Count by state
    const stateCount = {};
    let totalAge = 0;
    let ageCount = 0;
    let good = 0, fair = 0, poor = 0;
    let totalADT = 0;

    for (const b of bridges) {
      // State counts
      const st = b.state || 'Unknown';
      stateCount[st] = (stateCount[st] || 0) + 1;

      // Age
      if (b.yearBuilt && b.yearBuilt > 0) {
        totalAge += (currentYear - b.yearBuilt);
        ageCount++;
      }

      // Condition
      if (b.condition === 'Good') good++;
      else if (b.condition === 'Fair') fair++;
      else if (b.condition === 'Poor') poor++;

      // ADT
      if (b.adt && b.adt > 0) {
        totalADT += b.adt;
      }
    }

    // Top 10 states
    const totalByState = Object.entries(stateCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([state, count]) => ({ state, count }));

    return res.json({
      totalBridges: bridges.length,
      totalByState,
      avgAge: ageCount > 0 ? Math.round(totalAge / ageCount) : 0,
      conditionBreakdown: { good, fair, poor },
      totalADT
    });
  } catch (err) {
    console.error('Error in /api/stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\nBridge Atlas server running on http://localhost:${PORT}`);
  console.log(`  Bridges loaded: ${bridges.length}`);
  console.log(`  Curated NYC bridges: ${curatedBridges.length}`);
  if (bridges.length === 0) {
    console.log('\n  To load NBI data, run:');
    console.log('    npm run setup-data\n');
  }
});
