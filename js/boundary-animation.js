/**
 * Boundary Animation - Animates a point tracing the lot-boundary polygon
 * Loads coordinates from lot-boundary.geojson
 * Syncs with split-screen walking videos
 */

const boundaryAnimation = {
    polygonPoints: [],
    
    point: null,
    svgElement: null,
    polygonElement: null,
    isRunning: false,
    animationFrameId: null,
    mockTime: 0,
    mockDuration: 20,
    startTime: null,
    
    async init() {
        console.log('[BoundaryAnimation] Initializing...');
        
        this.point = document.getElementById('boundary-point');
        this.svgElement = document.getElementById('lot-boundary-svg');
        this.videoLeft = document.getElementById('video-left');
        this.videoRight = document.getElementById('video-right');
        
        if (!this.point || !this.svgElement) {
            console.warn('[BoundaryAnimation] Missing elements');
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
        // Set mock duration from video if available
        if (this.videoLeft && !isNaN(this.videoLeft.duration) && this.videoLeft.duration > 0) {
            this.mockDuration = this.videoLeft.duration;
            console.log('[BoundaryAnimation] Syncing to video duration:', this.mockDuration);
        }
        
        // Listen for video metadata loaded
        if (this.videoLeft) {
            this.videoLeft.addEventListener('loadedmetadata', () => {
                if (!isNaN(this.videoLeft.duration) && this.videoLeft.duration > 0) {
                    this.mockDuration = this.videoLeft.duration;
                    console.log('[BoundaryAnimation] Video duration set:', this.mockDuration);
                }
            });
        }
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
        polygon.setAttribute('fill', 'rgba(0,0,0,0.2)');
        polygon.setAttribute('stroke', '#64c8ff');
        polygon.setAttribute('stroke-width', '4');
        polygon.setAttribute('filter', 'url(#glow)');
        
        // Insert before the point
        const point = this.svgElement.querySelector('#boundary-point');
        if (point && point.parentNode) {
            point.parentNode.insertBefore(polygon, point);
        }
        
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
        // Try to use actual video time if available, otherwise use mock timer
        let currentTime = 0;
        let duration = this.mockDuration;
        
        if (this.videoLeft && !isNaN(this.videoLeft.currentTime) && !isNaN(this.videoLeft.duration)) {
            currentTime = this.videoLeft.currentTime;
            duration = this.videoLeft.duration || this.mockDuration;
        } else {
            // Fallback to mock timer
            const now = performance.now();
            const elapsed = (now - this.startTime) / 1000;
            currentTime = elapsed % this.mockDuration;
        }
        
        // Get position on polygon path
        const progress = (currentTime % duration) / duration;
        const { x, y } = this.getPointOnPath(progress);
        
        // Update SVG point position
        if (this.point && x && y) {
            this.point.setAttribute('cx', x);
            this.point.setAttribute('cy', y);
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
