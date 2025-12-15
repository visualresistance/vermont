/**
 * Video Scan Effect
 * Reveals video content in solid bands: 7 lines of video, then 7 lines of black
 * Pattern scrolls upward on left side, then downward on right side
 * Starts from completely black screen
 */

class VideoScanEffect {
  constructor(videoElement, canvasElement, side = 'left') {
    this.videoElement = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.animationStartTime = null;
    this.animationDuration = 30000; // 30 seconds for full cycle
    this.bandHeight = 7; // 7 lines per solid band
    this.lineHeight = 1; // Height of each line in pixels
    this.side = side; // 'left' or 'right'
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
    } else {
      this.canvas.width = this.videoElement.offsetWidth;
      this.canvas.height = this.videoElement.offsetHeight;
    }
  }

  getScrollProgress(progress) {
    // progress: 0 to 1 over 30 seconds
    // Returns scroll progress based on which side we're on
    
    const cycleProgress = progress % 1.0;
    
    if (this.side === 'left') {
      // Left side: use first 50% of cycle for scrolling up
      if (cycleProgress < 0.5) {
        return cycleProgress / 0.5; // 0 to 1
      } else {
        return 1.0; // Stay at top when right side is moving
      }
    } else {
      // Right side: use second 50% of cycle for scrolling down
      if (cycleProgress >= 0.5) {
        return (cycleProgress - 0.5) / 0.5; // 0 to 1
      } else {
        return 0.0; // Stay at top while left side is moving
      }
    }
  }

  drawReveal(progress) {
    // Start with all black
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Get scroll progress for this side
    const scrollProgress = this.getScrollProgress(progress);
    
    // Check if this side should be active
    const cycleProgress = progress % 1.0;
    let isActive = false;
    
    if (this.side === 'left' && cycleProgress < 0.5) {
      isActive = true;
    } else if (this.side === 'right' && cycleProgress >= 0.5) {
      isActive = true;
    }
    
    // If this side isn't active, keep it black
    if (!isActive) {
      return;
    }
    
    // For a "start at lower left and scroll up", we need to calculate which bands are visible
    // Total canvas height divided by band size (7 video + 7 black = 14 lines)
    const totalBandSize = this.bandHeight * 2; // 14 lines per complete cycle
    const pixelsPerLine = this.canvas.height / (this.bandHeight * 20); // Approximate line height
    
    // Calculate scroll offset
    // Start at bottom, scroll upward to top
    let scrollPixels;
    if (this.side === 'left') {
      // Left: scroll from bottom (positive) to top (negative)
      scrollPixels = (1 - scrollProgress) * this.canvas.height;
    } else {
      // Right: scroll from top (0) to bottom (positive)
      scrollPixels = scrollProgress * this.canvas.height;
    }
    
    // Draw the video
    if (this.videoElement.readyState >= 2) {
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Now mask with black to create the band effect
    // Calculate which bands should be black based on scroll position
    this.ctx.fillStyle = '#000000';
    
    const pixelHeight = this.canvas.height / (this.bandHeight * 20); // Estimate pixels per line
    
    // Draw black bands (masking out video)
    for (let y = 0; y < this.canvas.height; y += this.lineHeight) {
      // Calculate which band this y position falls into
      const adjustedY = (y + scrollPixels) % (this.canvas.height * 2);
      const bandSize = this.canvas.height / (this.bandHeight * 2);
      const positionInBand = (adjustedY / bandSize) % (this.bandHeight * 2);
      
      // First 7 units are video, next 7 are black
      if (positionInBand >= this.bandHeight) {
        this.ctx.fillRect(0, y, this.canvas.width, this.lineHeight);
      }
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

    // Draw the reveal effect
    this.drawReveal(progress);

    requestAnimationFrame(this.animate);
  }

  stop() {
    this.isAnimating = false;
  }

  start() {
    this.isAnimating = true;
    this.animationStartTime = null;
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
    window.scanEffectLeft = new VideoScanEffect(videoLeftEl, canvasLeftEl, 'left');
    videoLeftEl.addEventListener('loadedmetadata', () => {
      window.scanEffectLeft.start();
    });
  }

  if (videoRightEl && canvasRightEl) {
    window.scanEffectRight = new VideoScanEffect(videoRightEl, canvasRightEl, 'right');
    videoRightEl.addEventListener('loadedmetadata', () => {
      window.scanEffectRight.start();
    });
  }
}
