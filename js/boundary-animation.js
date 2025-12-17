/**
 * Boundary Animation - Animates a point tracing the lot-boundary polygon
 * Loads coordinates from lot-boundary.geojson
 * Syncs with split-screen walking videos
 */

const boundaryAnimation = {
    polygonPoints: [],
    
    traceLine: null,
    tracePoint: null,
    traceGradient: null,
    svgElement: null,
    polygonElement: null,
    isRunning: false,
    animationFrameId: null,
    mockTime: 0,
    mockDuration: 600,
    startTime: null,
    
    async init() {
        console.log('[BoundaryAnimation] Initializing...');
        
        this.svgElement = document.getElementById('lot-boundary-svg');
        this.videoLeft = document.getElementById('video-main');
        
        if (!this.svgElement) {
            console.warn('[BoundaryAnimation] Missing SVG element');
            return;
        }
        
        // Load GeoJSON and extract polygon coordinates
        try {
            await this.loadPolygonFromGeoJSON();
            this.generateSVGPolygon();
            this.setupVideoSync();
            this.startAnimation();
        } catch (err) {
            console.error('[BoundaryAnimation] Error:', err);
        }
    },
    
    setupVideoSync() {
        // Don't sync to video duration - use the custom mockDuration instead
        // This allows independent control of the boundary animation speed
        console.log('[BoundaryAnimation] Using custom duration:', this.mockDuration);
    },
    
    async loadPolygonFromGeoJSON() {
        try {
            const response = await fetch('assets/data/lot-boundary.geojson');
            const geojson = await response.json();
            
            // Extract coordinates from first feature
            const feature = geojson.features[0];
            const coordinates = feature.geometry.coordinates[0];
            
            // Convert from [lng, lat] to normalized [x, y] on a 1000x1000 viewBox
            // First, find bounds
            let minLng = Infinity, maxLng = -Infinity;
            let minLat = Infinity, maxLat = -Infinity;
            
            for (const [lng, lat] of coordinates) {
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
            }
            
            const lngRange = maxLng - minLng;
            const latRange = maxLat - minLat;
            const maxRange = Math.max(lngRange, latRange);
            
            // Normalize to 1000x1000 viewBox with padding
            const padding = 50;
            const viewBoxSize = 1000;
            const scaledSize = viewBoxSize - 2 * padding;
            
            this.polygonPoints = coordinates.map(([lng, lat]) => {
                const x = ((lng - minLng) / maxRange) * scaledSize + padding;
                const y = ((maxLat - lat) / maxRange) * scaledSize + padding;
                return { x, y };
            });
            
            console.log('[BoundaryAnimation] Loaded', this.polygonPoints.length, 'polygon vertices');
        } catch (err) {
            console.error('[BoundaryAnimation] Failed to load GeoJSON:', err);
            throw err;
        }
    },
    
    generateSVGPolygon() {
        // Remove existing polygon if present
        const existing = this.svgElement.querySelector('#lot-polygon-dynamic');
        if (existing) existing.remove();
        
        // Create polygon points string
        const pointsStr = this.polygonPoints
            .map(p => `${p.x},${p.y}`)
            .join(' ');
        
        // Create new polygon element
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('id', 'lot-polygon-dynamic');
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('fill', 'none');
        polygon.setAttribute('stroke', 'none');
        
        // Append polygon to SVG
        this.svgElement.appendChild(polygon);
        
        console.log('[BoundaryAnimation] Generated SVG polygon');
    },
    
    createPlaceholders() {
        const leftCanvas = document.getElementById('placeholder-left');
        const rightCanvas = document.getElementById('placeholder-right');
        
        if (leftCanvas) {
            leftCanvas.style.display = 'block';
            const ctx = leftCanvas.getContext('2d');
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 1280, 720);
            ctx.fillStyle = '#666';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Walking Left Video', 640, 360);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#999';
            ctx.fillText('(Add your video: assets/media/walk-left.mp4)', 640, 400);
        }
        
        if (rightCanvas) {
            rightCanvas.style.display = 'block';
            const ctx = rightCanvas.getContext('2d');
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 1280, 720);
            ctx.fillStyle = '#666';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Walking Right Video', 640, 360);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#999';
            ctx.fillText('(Add your video: assets/media/walk-right.mp4)', 640, 400);
        }
    },
    
    startAnimation() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[BoundaryAnimation] Animation started');
        
        this.startTime = performance.now();
        this.animate();
    },
    
    animate() {
        // Use custom mock timer for slow animation
        const now = performance.now();
        const elapsed = (now - this.startTime) / 1000;
        const currentTime = elapsed % this.mockDuration;
        
        // Get current position on polygon path
        const progress = currentTime / this.mockDuration;
        const trailLength = 0.08; // Trail covers 8% of path behind the point
        
        // Current point position
        const { x: pointX, y: pointY } = this.getPointOnPath(progress);
        
        // Create trail path from back to front
        const pathData = [];
        const segments = 30; // Number of segments for smooth trail
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const trailProgress = (progress - (trailLength * (1 - t)) + 1) % 1;
            const { x, y } = this.getPointOnPath(trailProgress);
            pathData.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
        }
        
        // Create gradient if it doesn't exist
        if (!this.traceGradient) {
            const defs = this.svgElement.querySelector('defs') || this.svgElement.insertBefore(
                document.createElementNS('http://www.w3.org/2000/svg', 'defs'),
                this.svgElement.firstChild
            );
            
            this.traceGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            this.traceGradient.setAttribute('id', 'trace-gradient');
            this.traceGradient.setAttribute('gradientUnits', 'userSpaceOnUse');
            
            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '0%');
            stop1.setAttribute('stop-color', '#c084fc'); // Purple
            stop1.setAttribute('stop-opacity', '0');
            
            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop2.setAttribute('offset', '100%');
            stop2.setAttribute('stop-color', '#e879f9'); // Pinkish
            stop2.setAttribute('stop-opacity', '0.8');
            
            this.traceGradient.appendChild(stop1);
            this.traceGradient.appendChild(stop2);
            defs.appendChild(this.traceGradient);
        }
        
        // Create or update trail path
        if (!this.traceLine) {
            this.traceLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            this.traceLine.setAttribute('id', 'boundary-trace-line');
            this.traceLine.setAttribute('stroke', 'url(#trace-gradient)');
            this.traceLine.setAttribute('stroke-width', '3');
            this.traceLine.setAttribute('stroke-linecap', 'round');
            this.traceLine.setAttribute('fill', 'none');
            this.svgElement.appendChild(this.traceLine);
        }
        
        // Create or update point
        if (!this.tracePoint) {
            this.tracePoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            this.tracePoint.setAttribute('r', '4');
            this.tracePoint.setAttribute('fill', '#e879f9'); // Pinkish
            this.tracePoint.setAttribute('stroke', '#ffffff');
            this.tracePoint.setAttribute('stroke-width', '1.5');
            this.tracePoint.setAttribute('opacity', '0.9');
            this.svgElement.appendChild(this.tracePoint);
        }
        
        // Update gradient direction based on trail
        const { x: backX, y: backY } = this.getPointOnPath((progress - trailLength + 1) % 1);
        this.traceGradient.setAttribute('x1', backX);
        this.traceGradient.setAttribute('y1', backY);
        this.traceGradient.setAttribute('x2', pointX);
        this.traceGradient.setAttribute('y2', pointY);
        
        // Update trail path and point position
        this.traceLine.setAttribute('d', pathData.join(' '));
        this.tracePoint.setAttribute('cx', pointX);
        this.tracePoint.setAttribute('cy', pointY);
        
        // Continue animation
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    },
    
    /**
     * Calculate a point on the polygon path based on progress (0-1)
     */
    getPointOnPath(progress) {
        // Total perimeter
        const perimeter = this.calculatePerimeter();
        const targetDistance = perimeter * progress;
        
        let currentDistance = 0;
        
        for (let i = 0; i < this.polygonPoints.length; i++) {
            const p1 = this.polygonPoints[i];
            const p2 = this.polygonPoints[(i + 1) % this.polygonPoints.length];
            
            const segmentLength = this.distance(p1, p2);
            
            if (currentDistance + segmentLength >= targetDistance) {
                // Point is on this segment
                const segmentProgress = (targetDistance - currentDistance) / segmentLength;
                return this.interpolate(p1, p2, segmentProgress);
            }
            
            currentDistance += segmentLength;
        }
        
        // Fallback to first point
        return this.polygonPoints[0];
    },
    
    /**
     * Calculate total perimeter of polygon
     */
    calculatePerimeter() {
        let perimeter = 0;
        for (let i = 0; i < this.polygonPoints.length; i++) {
            const p1 = this.polygonPoints[i];
            const p2 = this.polygonPoints[(i + 1) % this.polygonPoints.length];
            perimeter += this.distance(p1, p2);
        }
        return perimeter;
    },
    
    /**
     * Distance between two points
     */
    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    /**
     * Linear interpolation between two points
     */
    interpolate(p1, p2, t) {
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        };
    },
    
    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this._mockTimer) {
            clearInterval(this._mockTimer);
        }
    }
};

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure videos are ready
    setTimeout(() => {
        boundaryAnimation.init();
    }, 500);
});

window.boundaryAnimation = boundaryAnimation;
