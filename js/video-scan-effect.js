/**
 * Video Scan Effect
 * Creates a serpentine scanning effect with 7 horizontal bands revealing the video
 * The bands move from bottom-left up, then top-right down in a wave pattern
 * Animation completes in ~30 seconds and loops
 */

class VideoScanEffect {
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.animationStartTime = null;
    this.animationDuration = 30000; // 30 seconds in ms
    this.numBands = 7;
    this.bandHeight = 0;
    this.isAnimating = true;
    
    // Set canvas size to match video
    this.updateCanvasSize();
    
    // Start animation loop
    this.animate();
  }

  updateCanvasSize() {
    if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
      this.canvas.width = this.videoElement.videoWidth;
      this.canvas.height = this.videoElement.videoHeight;
      this.bandHeight = this.canvas.height / this.numBands;
    } else {
      // Fallback to display size
      this.canvas.width = this.videoElement.offsetWidth;
      this.canvas.height = this.videoElement.offsetHeight;
      this.bandHeight = this.canvas.height / this.numBands;
    }
  }

  getSerpentinePosition(progress) {
    // progress: 0 to 1
    // Returns the wave position in the serpentine pattern
    // Bottom-left up (0-0.5), then top-right down (0.5-1)
    
    if (progress < 0.5) {
      // First half: move from bottom (1.0) to top (0.0)
      return 1.0 - (progress * 2); // 1.0 → 0.0
    } else {
      // Second half: move from top (0.0) to bottom (1.0)
      return (progress - 0.5) * 2; // 0.0 → 1.0
    }
  }

  drawBands(progress) {
    // Fill canvas with semi-transparent black (obscures video)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Get the wave center position (0 = top, 1 = bottom)
    const waveCenter = this.getSerpentinePosition(progress);
    
    // Create 7 horizontal bands that follow the wave
    const bandWidth = this.canvas.height / this.numBands;
    
    for (let i = 0; i < this.numBands; i++) {
      // Offset each band slightly around the wave center
      // This creates the staggered "scanning" effect
      const offset = (i / (this.numBands - 1)) - 0.5; // -0.5 to 0.5
      const bandCenter = waveCenter + (offset * 0.2); // Add stagger
      
      // Normalize to 0-1 range with wrapping
      const normalizedCenter = ((bandCenter % 1.0) + 1.0) % 1.0;
      
      // Calculate the y position of this band
      const yPos = normalizedCenter * this.canvas.height;
      
      // Clear band (make it transparent to show video)
      // Use clearRect to punch through the black overlay
      this.ctx.clearRect(0, yPos - bandWidth * 0.5, this.canvas.width, bandWidth * 0.5);
    }
  }

  animate = () => {
    if (!this.isAnimating) {
      requestAnimationFrame(this.animate);
      return;
    }

    // Initialize start time on first frame
    if (this.animationStartTime === null) {
      this.animationStartTime = performance.now();
    }

    const currentTime = performance.now();
    const elapsed = currentTime - this.animationStartTime;
    const progress = (elapsed % this.animationDuration) / this.animationDuration;

    // Update canvas size if needed (responsive)
    if (this.videoElement.videoWidth && 
        this.canvas.width !== this.videoElement.videoWidth) {
      this.updateCanvasSize();
    }

    // Draw video frame to canvas (with full opacity initially)
    if (this.videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Fill with black if video not ready
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw scanning bands (black overlay with bands revealed)
    this.drawBands(progress);

    requestAnimationFrame(this.animate);
  }

  stop() {
    this.isAnimating = false;
  }

  start() {
    this.isAnimating = true;
    this.animationStartTime = null; // Reset to restart animation
    this.animate();
  }

  reset() {
    this.animationStartTime = null;
  }
}

// Initialize scan effects when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVideoScanEffects);
} else {
  initVideoScanEffects();
}

function initVideoScanEffects() {
  const videoLeftEl = document.getElementById('video-left');
  const videoRightEl = document.getElementById('video-right');
  const canvasLeftEl = document.getElementById('canvas-left');
  const canvasRightEl = document.getElementById('canvas-right');

  if (videoLeftEl && canvasLeftEl) {
    window.scanEffectLeft = new VideoScanEffect(videoLeftEl, canvasLeftEl);
    // Start scan when video is ready
    videoLeftEl.addEventListener('loadedmetadata', () => {
      window.scanEffectLeft.start();
    });
  }

  if (videoRightEl && canvasRightEl) {
    window.scanEffectRight = new VideoScanEffect(videoRightEl, canvasRightEl);
    // Start scan when video is ready
    videoRightEl.addEventListener('loadedmetadata', () => {
      window.scanEffectRight.start();
    });
  }
}
