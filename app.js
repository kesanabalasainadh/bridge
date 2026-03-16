/**
 * NYC Bridge Atlas - 3D Interactive Map Application
 * Uses Mapbox GL JS for 3D terrain, buildings, and bridge visualization
 */

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYmFsYXNhaW5hZGgiLCJhIjoiY21tcmFpZTE5MTc2ODJwb21xdWRjZWV5MiJ9.LgD04ZMcWeT99sHbTRF7_g';

// NYC center coordinates
const NYC_CENTER = [-73.95, 40.73];
const INITIAL_ZOOM = 10.3;
const INITIAL_PITCH = 55;
const INITIAL_BEARING = -15;

let map;
let activePopup = null;
let activeBridgeId = null;
let currentViewMode = 'health'; // health | traffic | age
let currentFilter = 'all';

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    simulateLoading();
    initMap();
    renderSidebar();
    updateGlobalStats();
    setupEventListeners();
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
    mapboxgl.accessToken = MAPBOX_TOKEN;

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: NYC_CENTER,
        zoom: INITIAL_ZOOM,
        pitch: INITIAL_PITCH,
        bearing: INITIAL_BEARING,
        antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('style.load', () => {
        // 3D Terrain
        map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

        // Atmospheric sky
        map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
                'sky-type': 'atmosphere',
                'sky-atmosphere-sun': [0, 85],
                'sky-atmosphere-sun-intensity': 5,
            },
        });

        // Fog for atmosphere
        map.setFog({
            color: '#0a1628',
            'high-color': '#1a2a44',
            'space-color': '#060a14',
            'horizon-blend': 0.08,
            'star-intensity': 0.6,
        });

        // 3D Buildings
        const layers = map.getStyle().layers;
        const labelLayerId = layers.find(l => l.type === 'symbol' && l.layout['text-field'])?.id;

        map.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 12,
            paint: {
                'fill-extrusion-color': '#1a2a3a',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.6,
            },
        }, labelLayerId);

        // Add bridge layers
        addBridgeLayers();

        // Hide loading
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 1500);
    });
}

// ============================================
// Bridge Layers
// ============================================
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

    // Bridge line glow (outer)
    map.addLayer({
        id: 'bridge-lines-glow',
        type: 'line',
        source: 'bridge-lines',
        paint: {
            'line-color': getLineColorExpression(),
            'line-width': 8,
            'line-opacity': 0.25,
            'line-blur': 6,
        },
    });

    // Bridge line core
    map.addLayer({
        id: 'bridge-lines-core',
        type: 'line',
        source: 'bridge-lines',
        paint: {
            'line-color': getLineColorExpression(),
            'line-width': 3.5,
            'line-opacity': 0.85,
        },
    });

    // Animated flowing particles along bridge paths
    map.addLayer({
        id: 'bridge-lines-dash',
        type: 'line',
        source: 'bridge-lines',
        paint: {
            'line-color': '#ffffff',
            'line-width': 1.5,
            'line-opacity': 0.35,
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

    // Bridge center point circles (pulsing effect via extrusion)
    map.addLayer({
        id: 'bridge-points-outer',
        type: 'circle',
        source: 'bridge-points',
        paint: {
            'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 6,
                12, 14,
                16, 22,
            ],
            'circle-color': getPointColorExpression(),
            'circle-opacity': 0.15,
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
                8, 3,
                12, 7,
                16, 12,
            ],
            'circle-color': getPointColorExpression(),
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(255,255,255,0.15)',
        },
    });

    // Bridge labels
    map.addLayer({
        id: 'bridge-labels',
        type: 'symbol',
        source: 'bridge-points',
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
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
            'text-color': '#8ab4d8',
            'text-halo-color': 'rgba(10, 14, 23, 0.9)',
            'text-halo-width': 2,
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

        activePopup = new mapboxgl.Popup({ closeButton: false, offset: 15 })
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
function renderSidebar(filter = 'all', search = '') {
    const list = document.getElementById('bridge-list');
    const bridges = NYC_BRIDGES.filter(b => {
        if (filter !== 'all' && !b.type.includes(filter)) return false;
        if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    list.innerHTML = bridges.map(b => {
        const healthClass = b.healthRating >= 6.5 ? 'excellent' : b.healthRating >= 5.5 ? 'good' : b.healthRating >= 4.5 ? 'fair' : 'poor';
        const healthColor = getHealthColor(b.healthRating);
        const isActive = activeBridgeId === b.id;

        return `
            <div class="bridge-card ${isActive ? 'active' : ''}" data-id="${b.id}" style="--card-accent: ${healthColor}">
                <div class="bc-top">
                    <div class="bc-name">${b.name}</div>
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
            </div>
        `;
    }).join('');

    // Attach click handlers
    list.querySelectorAll('.bridge-card').forEach(card => {
        card.addEventListener('click', () => selectBridge(card.dataset.id));
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
            center: NYC_CENTER,
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

    // View mode buttons
    document.getElementById('btn-view-health').addEventListener('click', () => setViewMode('health'));
    document.getElementById('btn-view-traffic').addEventListener('click', () => setViewMode('traffic'));
    document.getElementById('btn-view-age').addEventListener('click', () => setViewMode('age'));
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
