/**
 * Bridge Atlas - 3D Interactive Map Application
 * Uses MapLibre GL JS (free, open source) for 3D terrain and visualization
 * Satellite tiles: ESRI World Imagery (free)
 * Terrain DEM: Terrarium tiles from AWS Open Data (free)
 */

// Backend API base URL (empty = same origin)
const API_BASE = 'http://localhost:4000';

// USA center coordinates (fallback to NYC if backend not available)
const USA_CENTER = [-98.5, 39.8];
const NYC_CENTER = [-73.95, 40.73];
const INITIAL_CENTER = NYC_CENTER;
const INITIAL_ZOOM = 10.3;
const INITIAL_PITCH = 55;
const INITIAL_BEARING = -15;

let useBackend = false; // will be set to true if backend responds

let map;
let activePopup = null;
let activeBridgeId = null;
let currentViewMode = 'health'; // health | traffic | age
let currentFilter = 'all';
let compareMode = false;
let compareBridges = []; // up to 2 bridge IDs
let currentState = 'all';
let currentCity = 'all';
let currentCondition = 'all';

// ============================================
// Initialization
// ============================================
// ============================================
// Backend API Functions
// ============================================
async function checkBackend() {
    try {
        const res = await fetch(`${API_BASE}/api/stats`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            const stats = await res.json();
            useBackend = true;
            return stats;
        }
    } catch (e) { /* backend not available */ }
    return null;
}

async function fetchBridgesInView() {
    if (!useBackend || !map) return;
    const bounds = map.getBounds();
    const zoom = Math.floor(map.getZoom());
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
    try {
        const res = await fetch(`${API_BASE}/api/bridges?bbox=${bbox}&zoom=${zoom}`);
        if (res.ok) return await res.json();
    } catch (e) { console.warn('Failed to fetch bridges from backend:', e); }
    return null;
}

async function fetchBridgeDetail(id) {
    if (!useBackend) return null;
    try {
        const res = await fetch(`${API_BASE}/api/bridges/${encodeURIComponent(id)}`);
        if (res.ok) return await res.json();
    } catch (e) { console.warn('Failed to fetch bridge detail:', e); }
    return null;
}

// Debounce utility for map move events
function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Update map data from backend on viewport change
const updateMapFromBackend = debounce(async () => {
    if (!useBackend) return;
    const geojson = await fetchBridgesInView();
    if (!geojson) return;

    const src = map.getSource('bridge-points');
    const lineSrc = map.getSource('bridge-lines');
    if (src) src.setData(geojson);
    // For lines, filter to non-cluster features with coordinates
    if (lineSrc) {
        const lineFeatures = {
            type: 'FeatureCollection',
            features: geojson.features.filter(f => !f.properties.cluster && f.geometry.type === 'Point').map(f => ({
                ...f,
                geometry: {
                    type: 'LineString',
                    coordinates: [f.geometry.coordinates, f.geometry.coordinates] // single point for now
                }
            }))
        };
        lineSrc.setData(lineFeatures);
    }
}, 300);

document.addEventListener('DOMContentLoaded', async () => {
    simulateLoading();

    // Check if backend is available
    const backendStats = await checkBackend();
    if (backendStats) {
        console.log(`Backend connected: ${backendStats.totalBridges} bridges loaded`);
        document.getElementById('ts-bridges').textContent = formatCompact(backendStats.totalBridges);
        const indicator = document.getElementById('live-indicator');
        if (indicator) {
            indicator.classList.add('active');
            indicator.title = `Backend: ${backendStats.totalBridges} US bridges`;
        }
    }

    initMap();
    populateFilters();
    renderSidebar();
    updateGlobalStats();
    setupEventListeners();

    // Fetch live data from NYC Open Data
    if (typeof updateBridgeDataFromAPI === 'function') {
        try {
            const result = await updateBridgeDataFromAPI();
            if (result.matched > 0) {
                renderSidebar(currentFilter);
                updateGlobalStats();
                const indicator = document.getElementById('live-indicator');
                if (indicator) {
                    indicator.classList.add('active');
                    indicator.title = `Live data: ${result.matched}/${result.total} bridges matched`;
                }
            }
        } catch (e) {
            console.warn('Live data fetch failed, using static data:', e);
        }
    }
});

function simulateLoading() {
    const fill = document.getElementById('load-fill');
    let pct = 0;
    const interval = setInterval(() => {
        pct += Math.random() * 15 + 5;
        if (pct > 100) pct = 100;
        fill.style.width = pct + '%';
        if (pct >= 100) clearInterval(interval);
    }, 200);
}

// ============================================
// Map Setup
// ============================================
function initMap() {
    // MapLibre style with ESRI satellite tiles + OpenFreeMap labels
    const satelliteStyle = {
        version: 8,
        name: 'Satellite',
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            'esri-satellite': {
                type: 'raster',
                tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                maxzoom: 19,
                attribution: 'Tiles &copy; Esri'
            },
            'terrain-dem': {
                type: 'raster-dem',
                tiles: [
                    'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                maxzoom: 15,
                encoding: 'terrarium'
            },
            'osm-labels': {
                type: 'raster',
                tiles: [
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                maxzoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }
        },
        layers: [
            {
                id: 'satellite',
                type: 'raster',
                source: 'esri-satellite',
                paint: { 'raster-opacity': 1 }
            },
            {
                id: 'osm-overlay',
                type: 'raster',
                source: 'osm-labels',
                paint: { 'raster-opacity': 0.25 },
                minzoom: 12
            }
        ],
        terrain: {
            source: 'terrain-dem',
            exaggeration: 1.0
        },
        sky: {}
    };

    map = new maplibregl.Map({
        container: 'map',
        style: satelliteStyle,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        pitch: INITIAL_PITCH,
        bearing: INITIAL_BEARING,
        antialias: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('load', () => {
        // Add bridge layers
        addBridgeLayers();

        // If backend is available, load bridges on map move
        if (useBackend) {
            map.on('moveend', updateMapFromBackend);
            updateMapFromBackend(); // initial load
        }

        // NBI data loaded on demand via "Explore US" button

        // Hide loading
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 1500);
    });
}

// ============================================
// Bridge Layers
// ============================================
// ============================================
// NBI Static Data Layer
// ============================================
let nbiLoaded = false;

async function loadNbiBridges() {
    if (nbiLoaded) {
        // Toggle off — remove layers and reset
        if (map.getLayer('nbi-bridges-dots')) map.removeLayer('nbi-bridges-dots');
        if (map.getLayer('nbi-bridges-labels')) map.removeLayer('nbi-bridges-labels');
        if (map.getSource('nbi-bridges')) map.removeSource('nbi-bridges');
        window.NBI_BRIDGES = [];
        nbiLoaded = false;
        document.getElementById('btn-explore-us').classList.remove('active');
        document.getElementById('btn-explore-us').innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM6.5 4L12 8l-5.5 4V4z"/></svg> Explore US';
        document.getElementById('ts-bridges').textContent = NYC_BRIDGES.length;
        renderSidebar(currentFilter, document.getElementById('search-input')?.value || '');
        map.flyTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, pitch: INITIAL_PITCH, bearing: INITIAL_BEARING, duration: 1500 });
        return;
    }

    const btn = document.getElementById('btn-explore-us');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM6.5 4L12 8l-5.5 4V4z"/></svg> Loading...';

    try {
        const res = await fetch('us-bridges.json');
        if (!res.ok) return;
        const nbiBridges = await res.json();
        console.log(`Loaded ${nbiBridges.length} NBI bridges`);

        // Convert to GeoJSON
        const nbiGeojson = {
            type: 'FeatureCollection',
            features: nbiBridges.map(b => ({
                type: 'Feature',
                properties: {
                    id: b.id,
                    name: b.name,
                    condition: b.condition,
                    adt: b.adt || 0,
                    yearBuilt: b.yearBuilt,
                    length: b.length,
                    type: b.type,
                    owner: b.owner,
                    deckCond: b.conditionRatings?.deck,
                    superCond: b.conditionRatings?.superstructure,
                    subCond: b.conditionRatings?.substructure,
                },
                geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
            })),
        };

        // Store NBI bridges globally for sidebar
        window.NBI_BRIDGES = nbiBridges;

        map.addSource('nbi-bridges', { type: 'geojson', data: nbiGeojson });

        // Re-render sidebar to include NBI bridges
        renderSidebar(currentFilter, document.getElementById('search-input')?.value || '');

        // NBI bridge dots — visible from zoom 8
        map.addLayer({
            id: 'nbi-bridges-dots',
            type: 'circle',
            source: 'nbi-bridges',
            minzoom: 8,
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    11, 2,
                    14, 5,
                    17, 8,
                ],
                'circle-color': [
                    'match', ['get', 'condition'],
                    'Good', '#4caf50',
                    'Fair', '#ff9800',
                    'Poor', '#f44336',
                    '#666666'
                ],
                'circle-opacity': 0.7,
                'circle-stroke-width': 1,
                'circle-stroke-color': 'rgba(255,255,255,0.3)',
            },
        });

        // NBI bridge labels at high zoom
        map.addLayer({
            id: 'nbi-bridges-labels',
            type: 'symbol',
            source: 'nbi-bridges',
            minzoom: 14,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Semibold'],
                'text-size': 10,
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
            },
            paint: {
                'text-color': '#cccccc',
                'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                'text-halo-width': 1.5,
            },
        });

        // Hover popup for NBI bridges
        map.on('mouseenter', 'nbi-bridges-dots', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            const p = e.features[0].properties;
            if (activePopup) activePopup.remove();
            const condColor = p.condition === 'Good' ? '#4caf50' : p.condition === 'Fair' ? '#ff9800' : p.condition === 'Poor' ? '#f44336' : '#666';
            activePopup = new maplibregl.Popup({ closeButton: false, offset: 10 })
                .setLngLat(e.features[0].geometry.coordinates)
                .setHTML(`
                    <div class="popup-title">${p.name}</div>
                    <div class="popup-row"><span class="pr-label">Type</span><span class="pr-value">${p.type}</span></div>
                    <div class="popup-row"><span class="pr-label">Built</span><span class="pr-value">${p.yearBuilt || 'N/A'}</span></div>
                    <div class="popup-row"><span class="pr-label">Length</span><span class="pr-value">${p.length ? formatNum(p.length) + ' ft' : 'N/A'}</span></div>
                    <div class="popup-row"><span class="pr-label">Daily Traffic</span><span class="pr-value">${p.adt ? formatNum(p.adt) : 'N/A'}</span></div>
                    <div class="popup-row"><span class="pr-label">Condition</span><span class="pr-value" style="color:${condColor}">${p.condition}</span></div>
                    <div class="popup-row"><span class="pr-label">Owner</span><span class="pr-value">${p.owner}</span></div>
                    <div style="margin-top:6px;font-size:9px;color:#4a6080;text-align:center">Source: National Bridge Inventory (FHWA 2024)</div>
                `)
                .addTo(map);
        });
        map.on('mouseleave', 'nbi-bridges-dots', () => {
            map.getCanvas().style.cursor = '';
            if (activePopup) { activePopup.remove(); activePopup = null; }
        });

        // Update bridge count in top bar
        const totalCount = NYC_BRIDGES.length + nbiBridges.length;
        document.getElementById('ts-bridges').textContent = formatCompact(totalCount);

        // Mark as loaded, update button, fly to US view
        nbiLoaded = true;
        btn.classList.add('active');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM6.5 4L12 8l-5.5 4V4z"/></svg> NYC Only';
        map.flyTo({ center: USA_CENTER, zoom: 4.2, pitch: 30, bearing: 0, duration: 2000 });

    } catch (e) {
        console.warn('NBI data not available:', e);
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM6.5 4L12 8l-5.5 4V4z"/></svg> Explore US';
    }
}

function addBridgeLayers() {
    // GeoJSON source for bridge lines
    const bridgeLines = {
        type: 'FeatureCollection',
        features: NYC_BRIDGES.map(b => {
            // Build coordinate array - support multi-point bridges (e.g., RFK/Triborough)
            const coords = [[b.lon1, b.lat1]];
            if (b.lat3 !== undefined && b.lon3 !== undefined) {
                // 3-point bridge: endpoint1 → endpoint3 → endpoint2
                coords.push([b.lon3, b.lat3]);
            }
            coords.push([b.lon2, b.lat2]);

            return {
                type: 'Feature',
                properties: {
                    id: b.id,
                    name: b.name,
                    type: b.type,
                    healthRating: b.healthRating,
                    dailyTraffic: b.dailyTraffic || 0,
                    age: b.age,
                    lengthFt: b.lengthFt,
                },
                geometry: {
                    type: 'LineString',
                    coordinates: coords,
                },
            };
        }),
    };

    // GeoJSON source for bridge endpoint markers
    const bridgePoints = {
        type: 'FeatureCollection',
        features: NYC_BRIDGES.flatMap(b => {
            // For multi-point bridges, use centroid of all points
            const lons = [b.lon1, b.lon2];
            const lats = [b.lat1, b.lat2];
            if (b.lon3 !== undefined) { lons.push(b.lon3); lats.push(b.lat3); }
            const midLon = lons.reduce((a, c) => a + c, 0) / lons.length;
            const midLat = lats.reduce((a, c) => a + c, 0) / lats.length;
            return [{
                type: 'Feature',
                properties: {
                    id: b.id,
                    name: b.name,
                    type: b.type,
                    healthRating: b.healthRating,
                    dailyTraffic: b.dailyTraffic || 0,
                    age: b.age,
                    position: 'center',
                },
                geometry: { type: 'Point', coordinates: [midLon, midLat] },
            }];
        }),
    };

    map.addSource('bridge-lines', { type: 'geojson', data: bridgeLines });
    map.addSource('bridge-points', { type: 'geojson', data: bridgePoints });

    // Bridge line glow (outer) — brighter for satellite
    map.addLayer({
        id: 'bridge-lines-glow',
        type: 'line',
        source: 'bridge-lines',
        paint: {
            'line-color': getLineColorExpression(),
            'line-width': 12,
            'line-opacity': 0.4,
            'line-blur': 8,
        },
    });

    // Bridge line core — bolder for satellite
    map.addLayer({
        id: 'bridge-lines-core',
        type: 'line',
        source: 'bridge-lines',
        paint: {
            'line-color': getLineColorExpression(),
            'line-width': 4.5,
            'line-opacity': 0.95,
        },
    });

    // Animated flowing particles along bridge paths — brighter for satellite
    map.addLayer({
        id: 'bridge-lines-dash',
        type: 'line',
        source: 'bridge-lines',
        paint: {
            'line-color': '#ffffff',
            'line-width': 2,
            'line-opacity': 0.5,
            'line-dasharray': [0, 4, 3],
        },
    });

    // Animate the dash offset
    let dashStep = 0;
    function animateDash() {
        dashStep = (dashStep + 1) % 100;
        const t = dashStep / 100;
        // Cycle through dash patterns to create flowing effect
        const dash1 = 3 * Math.sin(t * Math.PI * 2) + 3;
        const gap = 4;
        const dash2 = 3;
        map.setPaintProperty('bridge-lines-dash', 'line-dasharray', [0, dash1, dash2, gap]);
        requestAnimationFrame(animateDash);
    }
    animateDash();

    // Bridge center point circles — larger + brighter for satellite
    map.addLayer({
        id: 'bridge-points-outer',
        type: 'circle',
        source: 'bridge-points',
        paint: {
            'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 8,
                12, 16,
                16, 26,
            ],
            'circle-color': getPointColorExpression(),
            'circle-opacity': 0.25,
            'circle-blur': 0.5,
        },
    });

    map.addLayer({
        id: 'bridge-points-inner',
        type: 'circle',
        source: 'bridge-points',
        paint: {
            'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 4,
                12, 9,
                16, 14,
            ],
            'circle-color': getPointColorExpression(),
            'circle-opacity': 0.95,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': 'rgba(255,255,255,0.3)',
        },
    });

    // Bridge labels
    map.addLayer({
        id: 'bridge-labels',
        type: 'symbol',
        source: 'bridge-points',
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold'],
            'text-size': [
                'interpolate', ['linear'], ['zoom'],
                8, 9,
                12, 12,
                16, 16,
            ],
            'text-offset': [0, 1.8],
            'text-anchor': 'top',
            'text-allow-overlap': false,
        },
        paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0, 0, 0, 0.85)',
            'text-halo-width': 2.5,
        },
    });

    // Click handler on bridge points
    map.on('click', 'bridge-points-inner', (e) => {
        const id = e.features[0].properties.id;
        selectBridge(id);
    });

    // Hover cursor
    map.on('mouseenter', 'bridge-points-inner', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'bridge-points-inner', () => {
        map.getCanvas().style.cursor = '';
    });

    // Hover popup
    map.on('mouseenter', 'bridge-points-inner', (e) => {
        const props = e.features[0].properties;
        const bridge = NYC_BRIDGES.find(b => b.id === props.id);
        if (!bridge) return;

        if (activePopup) activePopup.remove();

        const html = `
            <div class="popup-title">${bridge.name}</div>
            <div class="popup-row"><span class="pr-label">Built</span><span class="pr-value">${bridge.opened}</span></div>
            <div class="popup-row"><span class="pr-label">Age</span><span class="pr-value">${bridge.age} years</span></div>
            <div class="popup-row"><span class="pr-label">Length</span><span class="pr-value">${formatNum(bridge.lengthFt)} ft (${bridge.lengthMiles} mi)</span></div>
            <div class="popup-row"><span class="pr-label">Daily Traffic</span><span class="pr-value">${formatNum(bridge.dailyTraffic || bridge.dailyPassengers || 0)}</span></div>
            <div class="popup-row"><span class="pr-label">Health</span><span class="pr-value">${bridge.healthLabel} (${bridge.healthRating}/7)</span></div>
            <div class="popup-row"><span class="pr-label">Time Saved</span><span class="pr-value">${bridge.timeSavedAt50MphMin} min @50mph</span></div>
            <div class="popup-cta">Click for deep dive &rarr;</div>
        `;

        activePopup = new maplibregl.Popup({ closeButton: false, offset: 15 })
            .setLngLat(e.features[0].geometry.coordinates)
            .setHTML(html)
            .addTo(map);
    });

    map.on('mouseleave', 'bridge-points-inner', () => {
        if (activePopup) {
            activePopup.remove();
            activePopup = null;
        }
    });

    // Click on bridge lines too
    map.on('click', 'bridge-lines-core', (e) => {
        const id = e.features[0].properties.id;
        selectBridge(id);
    });
    map.on('mouseenter', 'bridge-lines-core', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'bridge-lines-core', () => {
        map.getCanvas().style.cursor = '';
    });
}

// ============================================
// Color Expressions
// ============================================
function getHealthColor(rating) {
    if (rating >= 6.5) return '#4caf50';
    if (rating >= 5.5) return '#8bc34a';
    if (rating >= 4.5) return '#ff9800';
    return '#f44336';
}

function getTrafficColor(traffic) {
    if (traffic >= 200000) return '#f44336';
    if (traffic >= 100000) return '#ff9800';
    if (traffic >= 50000) return '#ffeb3b';
    return '#4caf50';
}

function getAgeColor(age) {
    if (age >= 100) return '#f44336';
    if (age >= 80) return '#ff9800';
    if (age >= 50) return '#ffeb3b';
    return '#4caf50';
}

function getLineColorExpression() {
    const stops = NYC_BRIDGES.map(b => {
        let color;
        if (currentViewMode === 'health') color = getHealthColor(b.healthRating);
        else if (currentViewMode === 'traffic') color = getTrafficColor(b.dailyTraffic || 0);
        else color = getAgeColor(b.age);
        return [b.id, color];
    }).flat();

    return ['match', ['get', 'id'], ...stops, '#3b82f6'];
}

function getPointColorExpression() {
    return getLineColorExpression();
}

function updateMapColors() {
    const lineColor = getLineColorExpression();
    const pointColor = getPointColorExpression();

    map.setPaintProperty('bridge-lines-glow', 'line-color', lineColor);
    map.setPaintProperty('bridge-lines-core', 'line-color', lineColor);
    map.setPaintProperty('bridge-points-outer', 'circle-color', pointColor);
    map.setPaintProperty('bridge-points-inner', 'circle-color', pointColor);
}

// ============================================
// Sidebar
// ============================================
function populateFilters() {
    // Populate state dropdown from bridge data
    const stateSelect = document.getElementById('filter-state');
    const citySelect = document.getElementById('filter-city');
    if (!stateSelect || !citySelect) return;

    // Get unique states and cities from NYC_BRIDGES (or backend data when available)
    const states = new Set();
    const cities = new Set();
    NYC_BRIDGES.forEach(b => {
        if (b.connects) {
            b.connects.forEach(c => {
                // Extract city/borough names
                const city = c.replace(/\s*\(.*\)/, '').trim();
                cities.add(city);
            });
        }
        // For backend data with state field
        if (b.state) states.add(b.state);
    });

    // If no states from data (NYC only), add New York
    if (states.size === 0) states.add('New York');

    // Populate state dropdown
    stateSelect.innerHTML = '<option value="all">All States</option>';
    [...states].sort().forEach(s => {
        stateSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    // Populate city dropdown
    citySelect.innerHTML = '<option value="all">All Cities</option>';
    [...cities].sort().forEach(c => {
        citySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

let currentSort = 'traffic-desc'; // default sort
let currentLengthBucket = 'all'; // all | 0-500 | 500-1000 | 1000-2500 | 2500-5000 | 5000+

function matchesLengthBucket(lengthFt) {
    if (currentLengthBucket === 'all') return true;
    if (!lengthFt) return false;
    switch (currentLengthBucket) {
        case '0-500': return lengthFt < 500;
        case '500-1000': return lengthFt >= 500 && lengthFt < 1000;
        case '1000-2500': return lengthFt >= 1000 && lengthFt < 2500;
        case '2500-5000': return lengthFt >= 2500 && lengthFt < 5000;
        case '5000+': return lengthFt >= 5000;
        default: return true;
    }
}

function renderSidebar(filter = 'all', search = '') {
    const list = document.getElementById('bridge-list');

    // --- Curated bridges ---
    const curated = NYC_BRIDGES.filter(b => {
        if (filter !== 'all' && !b.type.includes(filter)) return false;
        if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (currentState !== 'all') {
            if (b.state && b.state !== currentState) return false;
        }
        if (currentCity !== 'all') {
            if (b.connects && !b.connects.some(c => c.includes(currentCity))) return false;
        }
        if (currentCondition !== 'all') {
            if (currentCondition === 'Good' && b.healthRating < 5.5) return false;
            if (currentCondition === 'Fair' && (b.healthRating < 4.5 || b.healthRating >= 5.5)) return false;
            if (currentCondition === 'Poor' && b.healthRating >= 4.5) return false;
        }
        if (!matchesLengthBucket(b.lengthFt)) return false;
        return true;
    }).map(b => ({
        ...b,
        _source: 'curated',
        _traffic: b.dailyTraffic || b.dailyPassengers || 0,
        _length: b.lengthFt || 0,
        _year: b.opened || 0,
        _health: b.healthRating || 0,
        _name: b.name,
    }));

    // --- NBI bridges ---
    const nbiRaw = window.NBI_BRIDGES || [];
    const nbi = nbiRaw.filter(b => {
        if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter !== 'all') {
            const t = (b.type || '').toLowerCase();
            if (!t.includes(filter)) return false;
        }
        if (currentCondition !== 'all') {
            if (b.condition !== currentCondition) return false;
        }
        if (!matchesLengthBucket(b.length)) return false;
        return true;
    }).map(b => ({
        ...b,
        _source: 'nbi',
        _traffic: b.adt || 0,
        _length: b.length || 0,
        _year: b.yearBuilt || 0,
        _health: b.condition === 'Good' ? 7 : b.condition === 'Fair' ? 5 : b.condition === 'Poor' ? 2 : 0,
        _name: b.name,
    }));

    // Combine and sort
    let allBridges = [...curated, ...nbi];

    switch (currentSort) {
        case 'traffic-desc': allBridges.sort((a, b) => b._traffic - a._traffic); break;
        case 'traffic-asc': allBridges.sort((a, b) => a._traffic - b._traffic); break;
        case 'length-desc': allBridges.sort((a, b) => b._length - a._length); break;
        case 'length-asc': allBridges.sort((a, b) => a._length - b._length); break;
        case 'age-desc': allBridges.sort((a, b) => a._year - b._year); break;
        case 'age-asc': allBridges.sort((a, b) => b._year - a._year); break;
        case 'health-desc': allBridges.sort((a, b) => b._health - a._health); break;
        case 'health-asc': allBridges.sort((a, b) => a._health - b._health); break;
        case 'name-asc': allBridges.sort((a, b) => a._name.localeCompare(b._name)); break;
        case 'name-desc': allBridges.sort((a, b) => b._name.localeCompare(a._name)); break;
    }

    // Render sort bar + count
    const sortBar = `
        <div class="sort-bar">
            <span class="sort-count">${allBridges.length} bridges</span>
            <select class="sort-select" id="sort-select">
                <option value="traffic-desc" ${currentSort === 'traffic-desc' ? 'selected' : ''}>Traffic ↓</option>
                <option value="traffic-asc" ${currentSort === 'traffic-asc' ? 'selected' : ''}>Traffic ↑</option>
                <option value="length-desc" ${currentSort === 'length-desc' ? 'selected' : ''}>Length ↓</option>
                <option value="length-asc" ${currentSort === 'length-asc' ? 'selected' : ''}>Length ↑</option>
                <option value="age-desc" ${currentSort === 'age-desc' ? 'selected' : ''}>Oldest First</option>
                <option value="age-asc" ${currentSort === 'age-asc' ? 'selected' : ''}>Newest First</option>
                <option value="health-desc" ${currentSort === 'health-desc' ? 'selected' : ''}>Best Health</option>
                <option value="health-asc" ${currentSort === 'health-asc' ? 'selected' : ''}>Worst Health</option>
                <option value="name-asc" ${currentSort === 'name-asc' ? 'selected' : ''}>Name A–Z</option>
                <option value="name-desc" ${currentSort === 'name-desc' ? 'selected' : ''}>Name Z–A</option>
            </select>
        </div>
    `;

    // Limit to 200 for performance
    const displayBridges = allBridges.slice(0, 200);

    list.innerHTML = sortBar + displayBridges.map(b => {
        if (b._source === 'curated') {
            const healthClass = b.healthRating >= 6.5 ? 'excellent' : b.healthRating >= 5.5 ? 'good' : b.healthRating >= 4.5 ? 'fair' : 'poor';
            const healthColor = getHealthColor(b.healthRating);
            const isActive = activeBridgeId === b.id;
            const isComparing = compareBridges.includes(b.id);
            const liveTag = b.liveDataAvailable ? '<span class="live-tag">LIVE</span>' : '';

            return `
                <div class="bridge-card ${isActive ? 'active' : ''} ${isComparing ? 'comparing' : ''}" data-id="${b.id}" data-source="curated" style="--card-accent: ${healthColor}">
                    <div class="bc-top">
                        <div class="bc-name">${b.name} ${liveTag}</div>
                        <div class="bc-type">${b.type}</div>
                    </div>
                    <div class="bc-connects">${b.connects.join(' ↔ ')} &middot; ${b.crosses}</div>
                    <div class="bc-stats">
                        <div class="bc-stat">
                            <span class="bc-stat-val">${b.opened}</span>
                            <span class="bc-stat-label">Built</span>
                        </div>
                        <div class="bc-stat">
                            <span class="bc-stat-val">${b.lengthMiles}mi</span>
                            <span class="bc-stat-label">Length</span>
                        </div>
                        <div class="bc-stat">
                            <span class="bc-stat-val">${formatCompact(b.dailyTraffic || b.dailyPassengers || 0)}</span>
                            <span class="bc-stat-label">${b.isRailOnly ? 'Riders' : 'Vehicles'}/Day</span>
                        </div>
                        <div class="bc-health">
                            <span class="health-dot ${healthClass}"></span>
                            <span class="health-text" style="color:${healthColor}">${b.healthRating}</span>
                        </div>
                    </div>
                    ${compareMode ? `<button class="compare-add-btn ${isComparing ? 'selected' : ''}" data-compare-id="${b.id}">${isComparing ? 'Selected' : 'Compare'}</button>` : ''}
                </div>
            `;
        } else {
            // NBI bridge card
            const condColor = b.condition === 'Good' ? '#4caf50' : b.condition === 'Fair' ? '#ff9800' : b.condition === 'Poor' ? '#f44336' : '#666';
            const condClass = b.condition === 'Good' ? 'good' : b.condition === 'Fair' ? 'fair' : b.condition === 'Poor' ? 'poor' : 'fair';
            const lengthMi = b.length ? (b.length / 5280).toFixed(2) : '--';
            return `
                <div class="bridge-card nbi-card" data-id="${b.id}" data-source="nbi" data-lat="${b.lat}" data-lng="${b.lng}" style="--card-accent: ${condColor}">
                    <div class="bc-top">
                        <div class="bc-name">${b.name} <span class="nbi-tag">NBI</span></div>
                        <div class="bc-type">${b.designType || b.kind || ''}</div>
                    </div>
                    <div class="bc-connects">${b.owner || ''}</div>
                    <div class="bc-stats">
                        <div class="bc-stat">
                            <span class="bc-stat-val">${b.yearBuilt || '--'}</span>
                            <span class="bc-stat-label">Built</span>
                        </div>
                        <div class="bc-stat">
                            <span class="bc-stat-val">${lengthMi}mi</span>
                            <span class="bc-stat-label">Length</span>
                        </div>
                        <div class="bc-stat">
                            <span class="bc-stat-val">${formatCompact(b.adt || 0)}</span>
                            <span class="bc-stat-label">Vehicles/Day</span>
                        </div>
                        <div class="bc-health">
                            <span class="health-dot ${condClass}"></span>
                            <span class="health-text" style="color:${condColor}">${b.condition || '?'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('') + (allBridges.length > 200 ? `<div class="sidebar-more">Showing 200 of ${allBridges.length} bridges. Zoom in or search to narrow results.</div>` : '');

    // Attach sort handler
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderSidebar(currentFilter, document.getElementById('search-input')?.value || '');
        });
    }

    // Attach click handlers for curated bridges
    list.querySelectorAll('.bridge-card[data-source="curated"]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.compare-add-btn')) return;
            selectBridge(card.dataset.id);
        });
    });

    // Attach click handlers for NBI bridges — fly to location
    list.querySelectorAll('.bridge-card[data-source="nbi"]').forEach(card => {
        card.addEventListener('click', () => {
            const lat = parseFloat(card.dataset.lat);
            const lng = parseFloat(card.dataset.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.flyTo({ center: [lng, lat], zoom: 15, pitch: 50, duration: 1500 });
            }
        });
    });

    // Compare button clicks
    list.querySelectorAll('.compare-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCompare(btn.dataset.compareId);
        });
    });
}

// ============================================
// Bridge Selection & Detail Panel
// ============================================
function selectBridge(id) {
    const bridge = NYC_BRIDGES.find(b => b.id === id);
    if (!bridge) return;

    activeBridgeId = id;

    // Update sidebar active state
    document.querySelectorAll('.bridge-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.querySelector(`.bridge-card[data-id="${id}"]`);
    if (activeCard) {
        activeCard.classList.add('active');
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Fly to bridge
    const midLon = (bridge.lon1 + bridge.lon2) / 2;
    const midLat = (bridge.lat1 + bridge.lat2) / 2;
    map.flyTo({
        center: [midLon, midLat],
        zoom: 13.5,
        pitch: 60,
        bearing: getBearingForBridge(bridge),
        duration: 2000,
        essential: true,
    });

    // Show detail panel
    showDetailPanel(bridge);
}

function getBearingForBridge(b) {
    const dLon = b.lon2 - b.lon1;
    const dLat = b.lat2 - b.lat1;
    const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
    return angle + 30; // offset for nice viewing angle
}

function showDetailPanel(b) {
    const panel = document.getElementById('detail-panel');
    const content = document.getElementById('detail-content');
    const healthColor = getHealthColor(b.healthRating);
    const healthClass = b.healthRating >= 6.5 ? 'excellent' : b.healthRating >= 5.5 ? 'good' : b.healthRating >= 4.5 ? 'fair' : 'poor';

    content.innerHTML = `
        <div class="detail-hero">
            <h2>${b.name}</h2>
            <div class="dh-type">${b.type} Bridge</div>
            <div class="dh-connects">${b.connects.join(' ↔ ')} &middot; Crosses ${b.crosses}</div>
            <div class="dh-desc">${b.description}</div>
            ${b.funFact ? `<div class="fun-fact">"${b.funFact}"</div>` : ''}
        </div>

        <!-- Construction & Age -->
        <div class="detail-section">
            <h3>Construction & Age</h3>
            <div class="detail-grid three">
                <div class="d-item">
                    <div class="d-label">Year Built</div>
                    <div class="d-value">${b.opened}</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Age</div>
                    <div class="d-value ${b.age > 100 ? 'orange' : ''}">${b.age} yrs</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Operator</div>
                    <div class="d-value" style="font-size:12px">${b.operator}</div>
                </div>
            </div>
        </div>

        <!-- Physical Specs -->
        <div class="detail-section">
            <h3>Physical Specifications</h3>
            <div class="detail-grid">
                <div class="d-item">
                    <div class="d-label">Total Length</div>
                    <div class="d-value">${formatNum(b.lengthFt)} ft</div>
                    <div class="d-sub">${b.lengthMiles} miles</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Main Span</div>
                    <div class="d-value">${formatNum(b.mainSpanFt)} ft</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Lanes</div>
                    <div class="d-value">${b.lanes}${b.isRailOnly ? ' (Rail)' : ''}</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Access</div>
                    <div class="d-value" style="font-size:12px">${[b.pedestrian ? 'Pedestrian' : null, b.bikeLane ? 'Bike' : null].filter(Boolean).join(', ') || 'Vehicles Only'}</div>
                </div>
            </div>
        </div>

        <!-- Health & Condition -->
        <div class="detail-section">
            <h3>Structural Health</h3>
            <div class="detail-grid">
                <div class="d-item">
                    <div class="d-label">Health Rating</div>
                    <div class="d-value" style="color:${healthColor}">${b.healthRating}/7</div>
                    <div class="d-sub">${b.healthLabel}</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Condition</div>
                    <div class="d-value" style="color:${healthColor}">${b.healthPct}%</div>
                </div>
            </div>
            <div class="health-bar-wrap">
                <div class="health-bar-bg">
                    <div class="health-bar-fg" style="width:${b.healthPct}%; background: linear-gradient(90deg, ${healthColor}88, ${healthColor})"></div>
                </div>
                <div class="health-bar-labels">
                    <span>Poor (1)</span>
                    <span>Excellent (7)</span>
                </div>
            </div>
        </div>

        <!-- Traffic & Usage -->
        <div class="detail-section">
            <h3>Traffic & Usage</h3>
            <div class="detail-grid">
                <div class="d-item">
                    <div class="d-label">${b.isRailOnly ? 'Daily Passengers' : 'Daily Vehicles'}</div>
                    <div class="d-value">${formatNum(b.dailyTraffic || b.dailyPassengers || 0)}</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Daily Person-Trips</div>
                    <div class="d-value">${formatNum(b.dailyPersonTrips)}</div>
                </div>
                ${b.tollAmount > 0 ? `
                <div class="d-item">
                    <div class="d-label">Toll</div>
                    <div class="d-value orange">$${b.tollAmount.toFixed(2)}</div>
                </div>` : `
                <div class="d-item">
                    <div class="d-label">Toll</div>
                    <div class="d-value green">Free</div>
                </div>`}
                <div class="d-item">
                    <div class="d-label">Bridge Length</div>
                    <div class="d-value">${b.lengthMiles} mi</div>
                </div>
            </div>
        </div>

        <!-- Distance & Time Savings -->
        <div class="detail-section">
            <h3>Distance & Time Savings Analysis</h3>
            <div class="impact-banner">
                <h4>Impact on Humanity</h4>
                <div class="impact-row">
                    <span class="ir-label">Detour without bridge</span>
                    <span class="ir-value">${b.detourMiles} miles</span>
                </div>
                <div class="impact-row">
                    <span class="ir-label">Distance saved per crossing</span>
                    <span class="ir-value highlight">${b.distanceSavedPerCrossing} miles</span>
                </div>
                <div class="impact-row">
                    <span class="ir-label">Time saved per person (@${b.avgSpeedMph}mph avg)</span>
                    <span class="ir-value">${b.timeSavedPerPersonMin} min</span>
                </div>
                <div class="impact-row">
                    <span class="ir-label">Time saved per person (@50mph)</span>
                    <span class="ir-value highlight">${b.timeSavedAt50MphMin} min</span>
                </div>
                <div class="impact-row" style="border-top:1px solid rgba(76,175,80,0.15); padding-top:8px; margin-top:4px">
                    <span class="ir-label">Total miles saved / day</span>
                    <span class="ir-value">${formatNum(b.dailyMilesSaved)} mi</span>
                </div>
                <div class="impact-row">
                    <span class="ir-label">Total miles saved / month</span>
                    <span class="ir-value highlight">${formatNum(b.monthlyMilesSaved)} mi</span>
                </div>
                <div class="impact-row" style="border-top:1px solid rgba(76,175,80,0.15); padding-top:8px; margin-top:4px">
                    <span class="ir-label">Human-hours saved / day</span>
                    <span class="ir-value highlight">${formatNum(b.personHoursSavedPerDay)} hrs</span>
                </div>
                <div class="impact-row">
                    <span class="ir-label">Human-hours saved / month</span>
                    <span class="ir-value highlight">${formatNum(b.personHoursSavedPerDay * 30)} hrs</span>
                </div>
                <div class="impact-row">
                    <span class="ir-label">Human-YEARS saved / year</span>
                    <span class="ir-value highlight">${formatNum(Math.round(b.personHoursSavedPerDay * 365 / 8760))} person-years</span>
                </div>
            </div>
        </div>

        <!-- Each-Way Analysis -->
        <div class="detail-section">
            <h3>Per-Direction Breakdown</h3>
            <div class="detail-grid">
                <div class="d-item">
                    <div class="d-label">Driving Each Way (Bridge)</div>
                    <div class="d-value green">${b.lengthMiles} mi</div>
                    <div class="d-sub">${(b.lengthMiles / b.avgSpeedMph * 60).toFixed(1)} min</div>
                </div>
                <div class="d-item">
                    <div class="d-label">Driving Each Way (Detour)</div>
                    <div class="d-value red">${b.detourMiles} mi</div>
                    <div class="d-sub">${(b.detourMiles / b.avgSpeedMph * 60).toFixed(1)} min</div>
                </div>
            </div>
        </div>
    `;

    panel.classList.add('open');
}

// ============================================
// Global Stats
// ============================================
function updateGlobalStats() {
    const t = BRIDGE_TOTALS;

    // Top bar
    document.getElementById('ts-bridges').textContent = t.totalBridges;
    document.getElementById('ts-daily').textContent = formatCompact(t.totalDailyTraffic);
    document.getElementById('ts-miles-saved').textContent = formatCompact(t.totalDailyMilesSaved);
    document.getElementById('ts-hours-saved').textContent = formatCompact(t.totalPersonHoursSavedPerDay);

    // Bottom bar
    document.getElementById('bs-crossings').textContent = formatCompact(t.totalDailyPersonTrips);
    document.getElementById('bs-monthly-miles').textContent = formatCompact(t.totalMonthlyMilesSaved);
    document.getElementById('bs-time-per-person').textContent = t.avgTimeSavedAt50Mph + ' min';
    document.getElementById('bs-humanity').textContent = formatNum(t.totalPersonHoursSavedPerDay);
    document.getElementById('bs-avg-age').textContent = t.avgAge + ' yrs';
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Detail panel close
    document.getElementById('detail-close').addEventListener('click', () => {
        document.getElementById('detail-panel').classList.remove('open');
        activeBridgeId = null;
        document.querySelectorAll('.bridge-card').forEach(c => c.classList.remove('active'));

        // Reset view
        map.flyTo({
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
            pitch: INITIAL_PITCH,
            bearing: INITIAL_BEARING,
            duration: 1500,
        });
    });

    // Filter chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderSidebar(currentFilter, document.getElementById('search-input').value);
        });
    });

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        renderSidebar(currentFilter, e.target.value);
    });

    // State filter
    document.getElementById('filter-state').addEventListener('change', (e) => {
        currentState = e.target.value;
        renderSidebar(currentFilter, document.getElementById('search-input').value);
    });

    // City filter
    document.getElementById('filter-city').addEventListener('change', (e) => {
        currentCity = e.target.value;
        renderSidebar(currentFilter, document.getElementById('search-input').value);
    });

    // Condition chips
    document.querySelectorAll('[data-condition]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('[data-condition]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCondition = chip.dataset.condition;
            renderSidebar(currentFilter, document.getElementById('search-input').value);
        });
    });

    // Length bucket chips
    document.querySelectorAll('[data-length]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('[data-length]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentLengthBucket = chip.dataset.length;
            renderSidebar(currentFilter, document.getElementById('search-input').value);
        });
    });

    // View mode buttons
    document.getElementById('btn-view-health').addEventListener('click', () => setViewMode('health'));
    document.getElementById('btn-view-traffic').addEventListener('click', () => setViewMode('traffic'));
    document.getElementById('btn-view-age').addEventListener('click', () => setViewMode('age'));

    // Explore US toggle
    document.getElementById('btn-explore-us').addEventListener('click', () => loadNbiBridges());

    // Compare mode
    const compareBtn = document.getElementById('btn-compare');
    if (compareBtn) compareBtn.addEventListener('click', toggleCompareMode);
    const compareClose = document.getElementById('compare-close');
    if (compareClose) compareClose.addEventListener('click', () => {
        document.getElementById('compare-panel').classList.remove('open');
        compareBridges = [];
        compareMode = false;
        const btn = document.getElementById('btn-compare');
        if (btn) btn.classList.remove('active');
        renderSidebar(currentFilter, document.getElementById('search-input').value);
    });

    // Mobile drawer
    setupMobileDrawer();
}

function setViewMode(mode) {
    currentViewMode = mode;

    // Update button states
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-view-${mode}`).classList.add('active');

    // Update map colors
    updateMapColors();
}

// ============================================
// Utilities
// ============================================
function formatNum(n) {
    if (n == null || isNaN(n)) return '--';
    return n.toLocaleString('en-US');
}

function formatCompact(n) {
    if (n == null || isNaN(n)) return '--';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
}

// ============================================
// Comparison Mode
// ============================================
function toggleCompareMode() {
    compareMode = !compareMode;
    compareBridges = [];
    const btn = document.getElementById('btn-compare');
    if (btn) btn.classList.toggle('active', compareMode);
    document.getElementById('compare-panel').classList.remove('open');
    renderSidebar(currentFilter, document.getElementById('search-input').value);
}

function addToCompare(id) {
    if (compareBridges.includes(id)) {
        compareBridges = compareBridges.filter(b => b !== id);
    } else if (compareBridges.length < 2) {
        compareBridges.push(id);
    } else {
        compareBridges[1] = id;
    }
    renderSidebar(currentFilter, document.getElementById('search-input').value);
    if (compareBridges.length === 2) showComparison();
}

function showComparison() {
    const b1 = NYC_BRIDGES.find(b => b.id === compareBridges[0]);
    const b2 = NYC_BRIDGES.find(b => b.id === compareBridges[1]);
    if (!b1 || !b2) return;

    const panel = document.getElementById('compare-panel');
    const content = document.getElementById('compare-content');

    const rows = [
        ['Type', b1.type, b2.type],
        ['Year Built', b1.opened, b2.opened],
        ['Age', b1.age + ' yrs', b2.age + ' yrs'],
        ['Length', formatNum(b1.lengthFt) + ' ft', formatNum(b2.lengthFt) + ' ft'],
        ['Main Span', formatNum(b1.mainSpanFt) + ' ft', formatNum(b2.mainSpanFt) + ' ft'],
        ['Lanes', b1.lanes, b2.lanes],
        ['Daily Traffic', formatCompact(b1.dailyTraffic || b1.dailyPassengers || 0), formatCompact(b2.dailyTraffic || b2.dailyPassengers || 0)],
        ['Health Rating', b1.healthRating + '/7', b2.healthRating + '/7'],
        ['Health', b1.healthLabel, b2.healthLabel],
        ['Toll', b1.tollAmount > 0 ? '$' + b1.tollAmount.toFixed(2) : 'Free', b2.tollAmount > 0 ? '$' + b2.tollAmount.toFixed(2) : 'Free'],
        ['Detour Distance', b1.detourMiles + ' mi', b2.detourMiles + ' mi'],
        ['Miles Saved/Day', formatCompact(b1.dailyMilesSaved), formatCompact(b2.dailyMilesSaved)],
        ['Person-Hours Saved/Day', formatNum(b1.personHoursSavedPerDay), formatNum(b2.personHoursSavedPerDay)],
        ['Pedestrian', b1.pedestrian ? 'Yes' : 'No', b2.pedestrian ? 'Yes' : 'No'],
        ['Bike Lane', b1.bikeLane ? 'Yes' : 'No', b2.bikeLane ? 'Yes' : 'No'],
        ['Operator', b1.operator, b2.operator],
    ];

    content.innerHTML = `
        <div class="compare-header">
            <div class="compare-col-header">${b1.name}</div>
            <div class="compare-col-header">vs</div>
            <div class="compare-col-header">${b2.name}</div>
        </div>
        ${rows.map(([label, v1, v2]) => `
            <div class="compare-row">
                <div class="compare-val">${v1}</div>
                <div class="compare-label">${label}</div>
                <div class="compare-val">${v2}</div>
            </div>
        `).join('')}
    `;

    panel.classList.add('open');

    // Fly to show both bridges
    const lons = [b1.lon1, b1.lon2, b2.lon1, b2.lon2];
    const lats = [b1.lat1, b1.lat2, b2.lat1, b2.lat2];
    const bounds = [
        [Math.min(...lons) - 0.02, Math.min(...lats) - 0.02],
        [Math.max(...lons) + 0.02, Math.max(...lats) + 0.02],
    ];
    map.fitBounds(bounds, { padding: 100, pitch: 50, duration: 1500 });
}

// ============================================
// Mobile Drawer
// ============================================
function toggleMobileDrawer() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-open');
}

function setupMobileDrawer() {
    const toggle = document.getElementById('mobile-drawer-toggle');
    if (toggle) {
        toggle.addEventListener('click', toggleMobileDrawer);
    }

    // Close drawer when clicking on map (mobile)
    map.on('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
        }
    });
}
