/**
 * Video Scan Effect
 * Reveals video content line by line with alternating gaps
 * Pattern: 7 lines of video → 7 lines of black → repeat, scrolling up then down
 * Uses a single video for the entire landing page
 */

class VideoScanEffect {
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.animationStartTime = null;
    this.animationDuration = 30000; // 30 seconds for full cycle
    this.linesPerBand = 7; // 7 lines of video, then 7 lines of black
    this.lineHeight = 2; // Height of each line in pixels
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

  getRevealPattern(progress) {
    // progress: 0 to 1 over 30 seconds
    // Returns which lines should be visible as video vs black
    // Each "band" is 14 lines (7 video + 7 black)
    
    const cycleProgress = progress % 1.0;
    
    // Timeline:
    // 0.0-0.50: Scroll upward on left side
    // 0.50-1.0: Scroll downward on right side
    
    let scrollProgress; // 0 to 1 for current scroll
    let isLeftSide = true;
    
    if (cycleProgress < 0.50) {
      // Left side, scrolling up
      scrollProgress = cycleProgress / 0.50;
      isLeftSide = true;
    } else {
      // Right side, scrolling down
      scrollProgress = (cycleProgress - 0.50) / 0.50;
      isLeftSide = false;
    }
    
    // Calculate how many pixels to offset (scroll)
    // Total scroll distance is the canvas height
    const scrollPixels = scrollProgress * this.canvas.height;
    
    return {
      scrollPixels,
      isLeftSide,
      scrollProgress
    };
  }

  isLineVisible(lineY, scrollPixels, isLeftSide) {
    // Determine if this line should show video or be black
    // Lines are in 14-line bands: 7 video, 7 black
    
    // Calculate which band this line falls into after scrolling
    const adjustedY = (lineY + scrollPixels) % (this.canvas.height);
    
    // Within the canvas, determine the pattern
    // Each band is 14 lines (7 video + 7 black)
    const bandSize = this.linesPerBand * 2; // 14
    const positionInBand = Math.floor(adjustedY / this.lineHeight) % bandSize;
    
    // First 7 lines (0-6) are video, next 7 (7-13) are black
    return positionInBand < this.linesPerBand;
  }

  drawReveal(progress) {
    // Start with all black
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Get the reveal pattern
    const pattern = this.getRevealPattern(progress);
    
    // Draw the video
    if (this.videoElement.readyState >= 2) {
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Now mask with black lines to create the reveal effect
    this.ctx.fillStyle = '#000000';
    
    // Draw horizontal lines of black based on the pattern
    for (let y = 0; y < this.canvas.height; y += this.lineHeight) {
      if (!this.isLineVisible(y, pattern.scrollPixels, pattern.isLeftSide)) {
        // This line should be black
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
  const videoEl = document.getElementById('video-main');
  const canvasEl = document.getElementById('canvas-scan');

  if (videoEl && canvasEl) {
    window.scanEffect = new VideoScanEffect(videoEl, canvasEl);
    // Start scan when video is ready
    videoEl.addEventListener('loadedmetadata', () => {
      window.scanEffect.start();
    });
  }
}
