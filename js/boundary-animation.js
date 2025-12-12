/**
 * Boundary Animation - Animates a point tracing the lot-boundary polygon
 * Syncs with split-screen walking videos
 */

const boundaryAnimation = {
    polygonPoints: [
        { x: 250, y: 150 },   // top-left
        { x: 750, y: 150 },   // top-right
        { x: 850, y: 500 },   // right
        { x: 750, y: 850 },   // bottom-right
        { x: 250, y: 850 },   // bottom-left
        { x: 150, y: 500 }    // left
    ],
    
    point: null,
    isRunning: false,
    animationFrameId: null,
    mockTime: 0,
    mockDuration: 20,
    startTime: null,
    
    init() {
        console.log('[BoundaryAnimation] Initializing...');
        
        this.point = document.getElementById('boundary-point');
        
        if (!this.point) {
            console.warn('[BoundaryAnimation] Missing point element');
            return;
        }
        
        // Create placeholder canvases
        this.createPlaceholders();
        
        // Start animation
        this.startAnimation();
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
        // Calculate elapsed time for mock video
        const now = performance.now();
        const elapsed = (now - this.startTime) / 1000;
        this.mockTime = elapsed % this.mockDuration;
        
        // Get position on polygon path
        const progress = this.mockTime / this.mockDuration;
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
