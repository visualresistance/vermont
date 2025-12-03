class MapboxScene {
    constructor() {
        this.map = null;
        this.isAnimating = false;
    }
    
    init() {
        mapboxgl.accessToken = CONFIG.mapboxToken;
        
        // Initialize map
        this.map = new mapboxgl.Map({
            container: 'map-container',
            // Use public Mapbox satellite style for quick testing (fallback to verify token/style)
            style: 'mapbox://styles/andy-rutkowski/cmi6n8nss002e01r58sgd5lid',
            center: [CONFIG.lotLocation.lng, CONFIG.lotLocation.lat],
            zoom: CONFIG.animation.initialZoom,
            pitch: 0,
            bearing: 0,
            interactive: false, // Disable user interaction during animation
            attributionControl: false
        });
        
        // Wait for map to load
        this.map.on('load', () => {
            this.startZoomAnimation();
        });
    }
    
    startZoomAnimation() {
        this.isAnimating = true;
        
        // Smooth camera animation
        this.map.flyTo({
            center: [CONFIG.lotLocation.lng, CONFIG.lotLocation.lat],
            zoom: CONFIG.animation.finalZoom,
            pitch: 45, // Tilt for 3D effect
            bearing: 0,
            duration: CONFIG.animation.duration,
            essential: true,
            easing: (t) => {
                // Custom easing function for smooth deceleration
                return t * (2 - t);
            }
        });
        
        // When the camera finishes moving, show the lot boundary (if provided)
        // and pause until the user continues. This replaces the previous fixed
        // timeout so we can inspect the lot before transitioning.
        this.map.once('moveend', () => {
            // Wait until the map is idle (all tiles loaded) before showing boundary
            this.map.once('idle', async () => {
                this.isAnimating = false;
                try {
                    await this.showBoundaryAndPause();

                    // Optionally enable 3D terrain/buildings if configured
                    if (CONFIG && CONFIG.enable3D) {
                        this.enable3DView();
                    }

                    // Auto-run the 360 pan/zoom-out if configured (default: true)
                    const autoPan = !(CONFIG && CONFIG.animation && CONFIG.animation.autoPanAfterBoundary === false);
                    if (autoPan) {
                        await this.pan360AndZoomOut();

                        // After the pan, optionally load and zoom out to vacant land dataset
                        if (CONFIG && CONFIG.showVacantLand) {
                            try {
                                await this.loadVacantLandAndZoomOut();
                            } catch (err) {
                                console.warn('Loading vacant land after pan failed:', err);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Boundary display/auto-pan failed:', err);
                }

                // After everything completes (or on error/fallback), do not
                // automatically transition — wait for the user to click the
                // Archive control. This prevents an automatic transition to
                // the fence/timeline and keeps the map visible.
            });
        });
    }

    async showBoundaryAndPause() {
        // Path can be provided via CONFIG.boundaryGeojson, otherwise default
        const geojsonPath = (CONFIG && CONFIG.boundaryGeojson) || 'assets/data/lot-boundary.geojson';

        // Try to load the GeoJSON; if it fails, just resolve immediately.
        let geojson;
        try {
            const res = await fetch(geojsonPath);
            if (!res.ok) throw new Error(`Failed to fetch ${geojsonPath}: ${res.status}`);
            geojson = await res.json();
        } catch (err) {
            console.warn('Could not load boundary GeoJSON:', err);
            return; // nothing to display, continue
        }

        // Add or update the source
        if (this.map.getSource('lot-boundary')) {
            this.map.getSource('lot-boundary').setData(geojson);
        } else {
            this.map.addSource('lot-boundary', {
                type: 'geojson',
                data: geojson
            });

            // Fill layer (semi-transparent)
            if (!this.map.getLayer('lot-boundary-fill')) {
                this.map.addLayer({
                    id: 'lot-boundary-fill',
                    type: 'fill',
                    source: 'lot-boundary',
                    paint: {
                        'fill-color': '#ffcc00',
                        'fill-opacity': 0.25
                    }
                });
            }

            // Line layer (outline)
            if (!this.map.getLayer('lot-boundary-line')) {
                this.map.addLayer({
                    id: 'lot-boundary-line',
                    type: 'line',
                    source: 'lot-boundary',
                    paint: {
                        'line-color': '#ffcc00',
                        'line-width': 3
                    }
                });
            }
        }

        // Add a small continue button overlay to let the user proceed when ready
        const container = document.getElementById('map-container') || document.body;
        let btn = document.getElementById('map-continue-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'map-continue-btn';
            btn.textContent = 'Continue';
            Object.assign(btn.style, {
                position: 'absolute',
                right: '20px',
                bottom: '20px',
                padding: '10px 14px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                zIndex: 2000
            });
            container.appendChild(btn);
        }

        // Return a promise that resolves when the user clicks continue, with
        // a fallback timeout so the app won't hang forever (30s).
        await new Promise((resolve) => {
            const cleanup = () => {
                if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
                resolve();
            };

            const onClick = () => {
                cleanup();
            };

            btn.addEventListener('click', onClick, { once: true });

            // Fallback: continue automatically after 30 seconds
            const fallback = setTimeout(() => {
                btn.removeEventListener('click', onClick);
                cleanup();
            }, 30000);
        });
    }

    // Perform a slow 360-degree pan around the current center while zooming out
    // slightly and increasing pitch to create a bird-eye view.
    pan360AndZoomOut() {
        const duration = (CONFIG && CONFIG.animation && CONFIG.animation.pan360Duration) || 20000; // ms
        const panEaseDuration = 2000; // time to ease to target zoom/pitch

        const startBearing = this.map.getBearing() || 0;
        const startZoom = this.map.getZoom();
        const zoomOutDelta = (CONFIG && CONFIG.animation && CONFIG.animation.panOutDelta) || 3;
        const targetZoom = Math.max(startZoom - zoomOutDelta, 3);
        const targetPitch = (CONFIG && CONFIG.animation && CONFIG.animation.panPitch) || 70;
        const offsetMeters = (CONFIG && CONFIG.animation && CONFIG.animation.panOffsetMeters) || 250; // meters to shift center toward city

        // Compute a small latitude offset (approx meters -> degrees)
        const center = this.map.getCenter();
        const deltaLat = offsetMeters / 111000; // ~111km per degree latitude
        const offsetCenter = [center.lng, center.lat + deltaLat];

        // Apply a gentle center shift so the view is elevated toward the city
        try {
            this.map.easeTo({ center: offsetCenter, duration: panEaseDuration, easing: (t) => t });
        } catch (e) {
            // ignore if easeTo fails
        }

        // Ease to target zoom & pitch first
        this.map.easeTo({ zoom: targetZoom, pitch: targetPitch, duration: panEaseDuration, easing: (t) => t });

        return new Promise((resolve) => {
            const start = performance.now();

            const step = (now) => {
                const elapsed = now - start;
                const t = Math.min(elapsed / duration, 1);
                const bearing = startBearing + 360 * t;
                // Immediate set so rotation is smooth and continuous
                try {
                    this.map.setBearing(bearing);
                } catch (e) {
                    // fallback to rotateTo if setBearing isn't available
                    try { this.map.rotateTo(bearing, { duration: 0 }); } catch (err) {}
                }

                if (t < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });
    }

    // Try to enable 3D terrain and building extrusions if supported by the current style.
    enable3DView() {
        try {
            // Add DEM source for terrain if not present
            if (!this.map.getSource('mapbox-dem')) {
                this.map.addSource('mapbox-dem', {
                    type: 'raster-dem',
                    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    tileSize: 512
                });
                this.map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.25 });
            }

            // Add building extrusion layer if possible
            if (!this.map.getLayer('3d-buildings')) {
                this.map.addLayer({
                    id: '3d-buildings',
                    source: 'composite',
                    'source-layer': 'building',
                    filter: ['==', 'extrude', 'true'],
                    type: 'fill-extrusion',
                    minzoom: 15,
                    paint: {
                        'fill-extrusion-color': '#aaa',
                        'fill-extrusion-height': ['get', 'height'],
                        'fill-extrusion-base': ['get', 'min_height'],
                        'fill-extrusion-opacity': 0.6
                    }
                }, 'waterway-label');
            }
        } catch (err) {
            console.warn('3D view could not be enabled (style may not support DEM or building layer):', err);
        }
    }

    // Load a GeoJSON of vacant land, draw fill+outline, compute bounds and
    // animate a zoom-out / fit to show the dataset in context (e.g., wider LA).
    async loadVacantLandAndZoomOut() {
        const path = (CONFIG && CONFIG.vacantLandGeojson) || 'assets/data/VacantLand_LA.geojson';
        console.log('[MapboxScene] loadVacantLandAndZoomOut: fetching', path);
        let geojson;
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
            geojson = await res.json();
            console.log('[MapboxScene] loadVacantLandAndZoomOut: fetched, features=', (geojson && geojson.features && geojson.features.length) || 0);
        } catch (err) {
            console.warn('Could not load vacant land GeoJSON:', err);
            return;
        }

        // Add or update the source
        if (this.map.getSource('vacant-land')) {
            this.map.getSource('vacant-land').setData(geojson);
        } else {
            this.map.addSource('vacant-land', { type: 'geojson', data: geojson });

            if (!this.map.getLayer('vacant-land-fill')) {
                // Prepare choropleth styling using Jenks natural breaks on `numpoints`
                const values = [];
                if (geojson && Array.isArray(geojson.features)) {
                    for (const f of geojson.features) {
                        const v = f && f.properties && (f.properties.numpoints || f.properties.numPoints || f.properties.count || f.properties.value || f.properties.NUMPOINTS);
                        const n = v != null ? Number(v) : NaN;
                        if (!isNaN(n)) values.push(n);
                    }
                }

                // Default single-color if we couldn't detect a numeric property
                let fillExpression = '#00bcd4';
                let legendInfo = null;

                if (values.length >= 1) {
                    // Use hardcoded breaks with viridis color ramp from QGIS
                    const breaks = [0, 266, 748, 1226, 1786, 2934, 4444];
                    const viridisColors = ['#440154', '#31688e', '#35b779', '#6ece58', '#b5de2b', '#fde724'];
                    
                    // Build coalesce list for property names
                    const coalesceList = ['coalesce', ['get', 'numpoints'], ['get', 'numPoints'], ['get', 'NUMPOINTS'], ['get', 'count'], ['get', 'value'], 0];
                    
                    // Build step expression: ['step', value, color0, threshold1, color1, threshold2, color2, ...]
                    const stepExpr = ['step', ['to-number', coalesceList], viridisColors[0]];
                    
                    // Add thresholds and colors: thresholds are breaks[1] through breaks[breaks.length-1]
                    for (let i = 1; i < breaks.length; i++) {
                        stepExpr.push(breaks[i]);
                        stepExpr.push(viridisColors[i] || viridisColors[viridisColors.length - 1]);
                    }
                    
                    fillExpression = stepExpr;
                    legendInfo = { breaks, colors: viridisColors };
                }

                // Debugging info to help diagnose why choropleth might not appear
                try {
                    const uniqueVals = Array.from(new Set(values));
                    const nonZeroValuesLog = values.filter(v => v > 0);
                    const uniqueNonZero = Array.from(new Set(nonZeroValuesLog)).length;
                    let breaksForLog = null;
                    try {
                        if (nonZeroValuesLog.length > 0) {
                            breaksForLog = this.jenks(nonZeroValuesLog, Math.min(8, Math.max(1, uniqueNonZero)));
                        }
                    } catch (e) {
                        breaksForLog = null;
                    }
                    console.log('[MapboxScene] vacantLand: valuesCount=', values.length, 'unique=', uniqueVals.length, 'nonZeroCount=', nonZeroValuesLog.length, 'uniqueNonZero=', uniqueNonZero);
                    console.log('[MapboxScene] vacantLand: breaks=', breaksForLog);
                    console.log('[MapboxScene] vacantLand: fillExpression=', JSON.stringify(fillExpression));
                    const sampleProps = (geojson.features || []).slice(0,5).map(f => f.properties);
                    console.log('[MapboxScene] vacantLand: sampleProps=', sampleProps);
                } catch (err) {
                    console.warn('Could not log vacant land debug info:', err);
                }

                this.map.addLayer({
                    id: 'vacant-land-fill',
                    type: 'fill',
                    source: 'vacant-land',
                    paint: {
                        'fill-color': fillExpression,
                        'fill-opacity': 0.7
                    }
                });

                // If legend info exists, add a legend UI
                if (legendInfo) this._renderLegend(legendInfo);
            }

            if (!this.map.getLayer('vacant-land-line')) {
                this.map.addLayer({
                    id: 'vacant-land-line',
                    type: 'line',
                    source: 'vacant-land',
                    paint: {
                        'line-color': '#00bcd4',
                        'line-width': 2
                    }
                });
            }
            // Add a small layer control so user can toggle this dataset
            this.createLayerControl();
        }

        // Compute bounds of the GeoJSON
        const bounds = this._computeGeoJSONBounds(geojson);
        if (!bounds) return;

        const padding = (CONFIG && CONFIG.animation && CONFIG.animation.vacantFitPadding) || 120;
        const maxZoom = (CONFIG && CONFIG.animation && CONFIG.animation.vacantFitMaxZoom) || 11;

        try {
            this.map.fitBounds([[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]], {
                padding,
                duration: 6000,
                maxZoom
            });
            console.log('[MapboxScene] loadVacantLandAndZoomOut: fitBounds to', [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]]);
        } catch (err) {
            console.warn('fitBounds failed:', err);
        }
        // Enable map interactions now that the visualization is shown
        try {
            if (this.map && this.map.scrollZoom) this.map.scrollZoom.enable();
            if (this.map && this.map.boxZoom) this.map.boxZoom.enable();
            if (this.map && this.map.doubleClickZoom) this.map.doubleClickZoom.enable();
            if (this.map && this.map.dragPan) this.map.dragPan.enable();
            if (this.map && this.map.dragRotate) this.map.dragRotate.enable();
            if (this.map && this.map.keyboard) this.map.keyboard.enable();

            // Add navigation controls (zoom + compass) once
            if (!this._navAdded) {
                try {
                    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');
                    this._navAdded = true;
                } catch (err) {
                    console.warn('Could not add NavigationControl:', err);
                }
            }
        } catch (err) {
            console.warn('Enabling map interactions failed:', err);
        }
    }

    // Create a small layer control UI in the top-right of the map container
    createLayerControl() {
        const container = document.getElementById('map-container') || document.body;
        // avoid duplicate control
        if (document.getElementById('layer-control')) return;

        const ctrl = document.createElement('div');
        ctrl.id = 'layer-control';
        Object.assign(ctrl.style, {
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: '6px',
            zIndex: 3000,
            fontFamily: 'sans-serif',
            fontSize: '13px'
        });

        const title = document.createElement('div');
        title.textContent = 'Layers';
        title.style.fontWeight = '700';
        title.style.marginBottom = '6px';
        ctrl.appendChild(title);

        // Checkbox for vacant lots
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '8px';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.id = 'vacant-layer-checkbox';
        cb.style.width = '14px';
        cb.style.height = '14px';

        const txt = document.createElement('span');
        txt.textContent = 'Vacant Lots';

        label.appendChild(cb);
        label.appendChild(txt);
        ctrl.appendChild(label);

        // Archive link/button that triggers the existing archive flow
        const archive = document.createElement('a');
        archive.href = '#';
        archive.textContent = 'Archive →';
        Object.assign(archive.style, { display: 'block', marginTop: '8px', color: '#fff', textDecoration: 'underline', cursor: 'pointer' });
        ctrl.appendChild(archive);

        // Toggle handler
        cb.addEventListener('change', () => {
            const visible = cb.checked ? 'visible' : 'none';
            if (this.map.getLayer('vacant-land-fill')) this.map.setLayoutProperty('vacant-land-fill', 'visibility', visible);
            if (this.map.getLayer('vacant-land-line')) this.map.setLayoutProperty('vacant-land-line', 'visibility', visible);
        });

        // Archive click: fade out map and dispatch existing completion event
        archive.addEventListener('click', (e) => {
            e.preventDefault();
            try { this.fadeOut(); } catch (err) {}
            window.dispatchEvent(new CustomEvent('mapAnimationComplete'));
        });

        container.appendChild(ctrl);
    }

    // Helper to compute bounding box for GeoJSON (simple, supports Point/LineString/Polygon/FeatureCollection)
    _computeGeoJSONBounds(geojson) {
        if (!geojson) return null;
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

        const inspectCoords = (coords) => {
            if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                const lng = coords[0], lat = coords[1];
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
            } else if (Array.isArray(coords)) {
                for (const c of coords) inspectCoords(c);
            }
        };

        const inspectGeometry = (geom) => {
            if (!geom) return;
            const { type, coordinates } = geom;
            if (!coordinates) return;
            inspectCoords(coordinates);
        };

        const inspectFeature = (feature) => {
            if (!feature) return;
            if (feature.type === 'Feature' && feature.geometry) inspectGeometry(feature.geometry);
            else if (feature.type === 'FeatureCollection' && Array.isArray(feature.features)) {
                for (const f of feature.features) inspectFeature(f);
            } else if (feature.coordinates) inspectCoords(feature.coordinates);
        };

        if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
            for (const f of geojson.features) inspectFeature(f);
        } else if (geojson.type === 'Feature') {
            inspectFeature(geojson);
        } else if (geojson.coordinates) {
            inspectCoords(geojson.coordinates);
        } else {
            // unknown structure
            return null;
        }

        if (!isFinite(minLng)) return null;
        return { minLng, minLat, maxLng, maxLat };
    }
    
    // Render a small legend (simple) into the layer control area
    _renderLegend(legendInfo) {
        try {
            const mapContainer = document.getElementById('map-container');
            if (!mapContainer) return;
            
            // Remove existing legend if present
            const existing = document.getElementById('vacant-legend');
            if (existing) existing.parentNode.removeChild(existing);

            const legend = document.createElement('div');
            legend.id = 'vacant-legend';
            Object.assign(legend.style, {
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                background: 'rgba(0, 0, 0, 0.85)',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                zIndex: 1000,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                minWidth: '160px'
            });

            const title = document.createElement('div');
            title.textContent = 'Vacant Lots';
            title.style.fontWeight = '700';
            title.style.marginBottom = '8px';
            title.style.fontSize = '13px';
            legend.appendChild(title);

            const { breaks, colors } = legendInfo;
            const classes = colors.length;

            for (let i = 0; i < classes; i++) {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '8px';
                row.style.marginBottom = '3px';

                const swatch = document.createElement('span');
                swatch.style.width = '18px';
                swatch.style.height = '14px';
                swatch.style.background = colors[i];
                swatch.style.display = 'inline-block';
                swatch.style.border = '1px solid rgba(255,255,255,0.2)';
                swatch.style.borderRadius = '2px';

                const label = document.createElement('span');
                const lo = Math.round(breaks[i]);
                const hi = i < classes - 1 ? Math.round(breaks[i + 1]) - 1 : Math.round(breaks[i + 1] || breaks[i]);
                
                if (i === classes - 1) {
                    label.textContent = `${lo}+`;
                } else {
                    label.textContent = `${lo}–${hi}`;
                }
                
                label.style.fontSize = '11px';

                row.appendChild(swatch);
                row.appendChild(label);
                legend.appendChild(row);
            }

            mapContainer.appendChild(legend);
        } catch (err) {
            console.warn('Failed to render legend:', err);
        }
    }

    // Jenks natural breaks implementation (returns breaks array length classes+1)
    // Basic implementation adapted for client-side use.
    jenks(data, nClasses) {
        // remove NaN and sort
        const arr = data.filter(v => !isNaN(v)).slice().sort((a,b)=>a-b);
        const n = arr.length;
        if (n === 0) return [];
        if (nClasses <= 1) return [arr[0], arr[arr.length-1]];

        const lower = Array.from({length: n+1}, () => Array(nClasses+1).fill(0));
        const variance = Array.from({length: n+1}, () => Array(nClasses+1).fill(Infinity));

        for (let i=1;i<=n;i++) {
            variance[i][1] = 0;
            lower[i][1] = 1;
        }

        const cumulative = Array(n+1).fill(0);
        const cumulativeSq = Array(n+1).fill(0);
        for (let i=1;i<=n;i++) {
            const val = arr[i-1];
            cumulative[i] = cumulative[i-1] + val;
            cumulativeSq[i] = cumulativeSq[i-1] + val*val;
        }

        for (let k=2;k<=nClasses;k++) {
            for (let i=k;i<=n;i++) {
                let minVar = Infinity;
                let minIdx = -1;
                for (let j=k-1;j<=i-1;j++) {
                    const count = i - j;
                    const sum = cumulative[i] - cumulative[j];
                    const sumSq = cumulativeSq[i] - cumulativeSq[j];
                    const mean = sum / count;
                    const varianceSegment = sumSq - sum*mean;
                    const totalVar = variance[j][k-1] + varianceSegment;
                    if (totalVar < minVar) {
                        minVar = totalVar;
                        minIdx = j+1;
                    }
                }
                variance[i][k] = minVar;
                lower[i][k] = minIdx;
            }
        }

        const breaks = Array(nClasses+1).fill(0);
        breaks[nClasses] = arr[n-1];
        let k = nClasses;
        let idx = n;
        while (k > 1) {
            const id = lower[idx][k] - 1;
            breaks[k-1] = arr[id-1] || arr[0];
            idx = id;
            k--;
        }
        breaks[0] = arr[0];
        return breaks;
    }

    /**
     * Initialize map in direct interactive mode (no animation)
     * Loads vacant land data with choropleth visualization
     */
    async initInteractiveMap() {
        console.log('[MapboxScene] Initializing interactive map view...');
        
        mapboxgl.accessToken = CONFIG.mapboxToken;
        
        // Initialize map
        this.map = new mapboxgl.Map({
            container: 'map-container',
            style: 'mapbox://styles/andy-rutkowski/cmi6n8nss002e01r58sgd5lid',
            center: [CONFIG.lotLocation.lng, CONFIG.lotLocation.lat],
            zoom: 14,
            pitch: 0,
            bearing: 0,
            interactive: true,
            attributionControl: false
        });

        // Enable interactions immediately
        this.map.scrollZoom.enable();
        this.map.boxZoom.enable();
        this.map.doubleClickZoom.enable();
        this.map.dragPan.enable();
        this.map.dragRotate.enable();
        this.map.keyboard.enable();

        // Add navigation control
        const nav = new mapboxgl.NavigationControl();
        this.map.addControl(nav, 'top-left');

        // Wait for map to load, then add vacant land layer
        this.map.on('load', async () => {
            console.log('[MapboxScene] Map loaded, adding vacant land data...');
            
            try {
                // Load vacant land GeoJSON
                const geojsonPath = CONFIG.vacantLandGeojson || 'assets/data/VacantLand_LA.geojson';
                const response = await fetch(geojsonPath);
                if (!response.ok) throw new Error(`Failed to load ${geojsonPath}`);
                
                const geojsonData = await response.json();
                console.log('[MapboxScene] Vacant land GeoJSON loaded, features:', geojsonData.features.length);
                
                // Add source
                if (!this.map.getSource('vacant-land')) {
                    this.map.addSource('vacant-land', {
                        type: 'geojson',
                        data: geojsonData
                    });
                }

                // Hardcoded Jenks breaks from previous analysis
                const breaks = [0, 266, 748, 1226, 1786, 2934, 4444];
                const colors = [
                    '#440154', // viridis: dark purple
                    '#31688e', // blue
                    '#35b779', // green
                    '#6ece58', // yellow-green
                    '#b5de2b', // yellow
                    '#fde724'  // bright yellow
                ];

                // Build step expression with property detection via coalesce
                const stepExpr = [
                    'step',
                    ['coalesce',
                        ['get', 'NUMPOINTS'],
                        ['get', 'numPoints'],
                        ['get', 'numpoints'],
                        ['get', 'count'],
                        ['get', 'value'],
                        0
                    ]
                ];

                // Add color stops
                stepExpr.push(colors[0]);
                for (let i = 0; i < breaks.length - 1; i++) {
                    stepExpr.push(breaks[i + 1]);
                    stepExpr.push(colors[i + 1] || colors[colors.length - 1]);
                }

                // Add fill layer
                if (!this.map.getLayer('vacant-land-fill')) {
                    this.map.addLayer({
                        id: 'vacant-land-fill',
                        type: 'fill',
                        source: 'vacant-land',
                        paint: {
                            'fill-color': stepExpr,
                            'fill-opacity': 0.7
                        }
                    });

                    // Add outline layer
                    this.map.addLayer({
                        id: 'vacant-land-outline',
                        type: 'line',
                        source: 'vacant-land',
                        paint: {
                            'line-color': '#fff',
                            'line-width': 0.5,
                            'line-opacity': 0.3
                        }
                    });
                }

                // Render legend
                this._renderLegend({ breaks, colors });

                // Fit bounds to data
                const bounds = this._computeGeoJSONBounds(geojsonData);
                if (bounds) {
                    this.map.fitBounds(bounds, { padding: 40 });
                }

                console.log('[MapboxScene] Vacant land layer added and styled');
            } catch (err) {
                console.error('[MapboxScene] Error loading vacant land:', err);
            }
        });
    }
    
    fadeOut() {
        document.getElementById('map-container').classList.remove('active');
    }
}

// Create instance but don't initialize until user opens the invitation
const mapboxScene = new MapboxScene();
window.mapboxScene = mapboxScene;