/**
 * Landing page animation: syncs boundary point to video playback
 */

class LandingAnimation {
    constructor() {
        this.leftVideo = null;
        this.rightVideo = null;
        this.boundaryPoint = null;
        this.polygon = null;
        this.vertices = [];
        this.totalDistance = 0;
        this.distances = [];
        this.animationFrame = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        console.log('[LandingAnimation] Initializing...');
        
        this.leftVideo = document.getElementById('landing-video-left');
        this.rightVideo = document.getElementById('landing-video-right');
        this.boundaryPoint = document.getElementById('boundary-point');
        this.polygon = document.getElementById('lot-polygon');
        
        if (!this.polygon || !this.boundaryPoint) {
            console.error('[LandingAnimation] Required elements not found');
            return;
        }
        
        // Parse polygon points
        this.parsePolygonVertices();
        
        // Sync videos
        this.syncVideos();
        
        // Start animation loop
        this.startAnimation();
        
        this.isInitialized = true;
        console.log('[LandingAnimation] Initialized with', this.vertices.length, 'vertices');
    }
    
    parsePolygonVertices() {
        const pointsAttr = this.polygon.getAttribute('points');
        if (!pointsAttr) return;
        
        const pairs = pointsAttr.trim().split(/\s+/);
        this.vertices = pairs.map(pair => {
            const [x, y] = pair.split(',').map(Number);
            return { x, y };
        });
        
        // Calculate cumulative distances along the polygon perimeter
        this.distances = [0];
        this.totalDistance = 0;
        
        for (let i = 1; i < this.vertices.length; i++) {
            const dx = this.vertices[i].x - this.vertices[i-1].x;
            const dy = this.vertices[i].y - this.vertices[i-1].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            this.totalDistance += dist;
            this.distances.push(this.totalDistance);
        }
        
        // Close the loop (back to first vertex)
        const dx = this.vertices[0].x - this.vertices[this.vertices.length - 1].x;
        const dy = this.vertices[0].y - this.vertices[this.vertices.length - 1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.totalDistance += dist;
        this.distances.push(this.totalDistance);
    }
    
    syncVideos() {
        if (!this.leftVideo || !this.rightVideo) return;
        
        // Keep videos in sync
        this.leftVideo.addEventListener('play', () => {
            if (this.rightVideo.paused) {
                this.rightVideo.play().catch(() => {});
            }
        });
        
        this.rightVideo.addEventListener('play', () => {
            if (this.leftVideo.paused) {
                this.leftVideo.play().catch(() => {});
            }
        });
        
        // Sync on time update (handle seeking)
        this.leftVideo.addEventListener('seeked', () => {
            if (Math.abs(this.leftVideo.currentTime - this.rightVideo.currentTime) > 0.1) {
                this.rightVideo.currentTime = this.leftVideo.currentTime;
            }
        });
        
        this.rightVideo.addEventListener('seeked', () => {
            if (Math.abs(this.rightVideo.currentTime - this.leftVideo.currentTime) > 0.1) {
                this.leftVideo.currentTime = this.rightVideo.currentTime;
            }
        });
    }
    
    startAnimation() {
        const animate = () => {
            this.updatePointPosition();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    updatePointPosition() {
        if (!this.leftVideo || !this.boundaryPoint || this.vertices.length === 0) return;
        
        // Get video progress (0 to 1)
        const duration = this.leftVideo.duration || 20; // fallback to 20s
        const currentTime = this.leftVideo.currentTime || 0;
        const progress = (currentTime % duration) / duration;
        
        // Map progress to position along polygon perimeter
        const targetDist = progress * this.totalDistance;
        
        // Find which segment we're on
        let segmentIndex = 0;
        for (let i = 0; i < this.distances.length - 1; i++) {
            if (targetDist >= this.distances[i] && targetDist <= this.distances[i + 1]) {
                segmentIndex = i;
                break;
            }
        }
        
        // Interpolate position within segment
        const segmentStart = this.distances[segmentIndex];
        const segmentEnd = this.distances[segmentIndex + 1];
        const segmentProgress = (targetDist - segmentStart) / (segmentEnd - segmentStart);
        
        const v1 = this.vertices[segmentIndex];
        const v2 = segmentIndex < this.vertices.length - 1 
            ? this.vertices[segmentIndex + 1]
            : this.vertices[0]; // wrap around
        
        const x = v1.x + (v2.x - v1.x) * segmentProgress;
        const y = v1.y + (v2.y - v1.y) * segmentProgress;
        
        // Update point position
        this.boundaryPoint.setAttribute('cx', x);
        this.boundaryPoint.setAttribute('cy', y);
    }
    
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.isInitialized = false;
    }
}

// Create global instance
window.landingAnimation = new LandingAnimation();
