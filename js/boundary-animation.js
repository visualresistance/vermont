/**
 * Boundary Animation - Animates a point tracing the lot-boundary polygon
 * Loads coordinates from lot-boundary.geojson
 * Syncs with split-screen walking videos
 */

const boundaryAnimation = {
    polygonPoints: [],
    
    traceLine: null,
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
        
        // Get current position and next position on polygon path
        const progress = currentTime / this.mockDuration;
        const lineLength = 0.05; // Line covers 5% of the path
        const { x: x1, y: y1 } = this.getPointOnPath(progress);
        const { x: x2, y: y2 } = this.getPointOnPath((progress + lineLength) % 1);
        
        // Update SVG line position (create if doesn't exist)
        if (!this.traceLine) {
            this.traceLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            this.traceLine.setAttribute('id', 'boundary-trace-line');
            this.traceLine.setAttribute('stroke', '#ff4444');
            this.traceLine.setAttribute('stroke-width', '3');
            this.traceLine.setAttribute('stroke-linecap', 'round');
            this.svgElement.appendChild(this.traceLine);
        }
        
        if (this.traceLine && x1 && y1 && x2 && y2) {
            this.traceLine.setAttribute('x1', x1);
            this.traceLine.setAttribute('y1', y1);
            this.traceLine.setAttribute('x2', x2);
            this.traceLine.setAttribute('y2', y2);
        }
        
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
