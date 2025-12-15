/**
 * Video Scan Effect
 * Creates individual horizontal scanning lines that appear and move across the video
 * Lines appear one at a time from bottom, move up on left side, down on right side
 * Pattern: Start black → lines appear from bottom → move up left → move down right → repeat
 */

class VideoScanEffect {
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.animationStartTime = null;
    this.animationDuration = 30000; // 30 seconds for full cycle
    this.numLines = 7;
    this.lineHeight = 2; // Thickness of each line
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

  getLinePositions(progress) {
    // progress: 0 to 1 over 30 seconds
    // Returns object with { positions: [], phase: 'string' }
    // Positions are normalized y values (0 = top, 1 = bottom)
    
    const cycleProgress = progress % 1.0;
    const result = {
      positions: [],
      phase: 'reset',
      showLeft: false,
      showRight: false
    };
    
    // Timeline for the effect:
    // 0.0-0.10: Lines appear one by one from bottom (no movement yet)
    // 0.10-0.50: All 7 lines move upward together (showing on left)
    // 0.50-0.90: All 7 lines move downward together (showing on right)
    // 0.90-1.0: Reset to black
    
    if (cycleProgress < 0.10) {
      // Phase 1: Lines appear one by one from bottom
      result.phase = 'appear';
      const appearProgress = cycleProgress / 0.10; // 0 to 1
      const numVisibleLines = Math.floor(appearProgress * (this.numLines + 1));
      
      // All appearing lines start at bottom
      for (let i = 0; i < numVisibleLines && i < this.numLines; i++) {
        result.positions.push(1.0); // 1.0 = bottom
      }
      result.showLeft = true;
    } else if (cycleProgress < 0.50) {
      // Phase 2: Lines move upward on left side
      result.phase = 'move-up';
      const moveProgress = (cycleProgress - 0.10) / 0.40; // 0 to 1
      
      // All 7 lines are visible and moving upward
      // Start at bottom (1.0), move to top (0.0)
      const upwardPos = 1.0 - moveProgress;
      
      for (let i = 0; i < this.numLines; i++) {
        result.positions.push(upwardPos);
      }
      result.showLeft = true;
    } else if (cycleProgress < 0.90) {
      // Phase 3: Lines move downward on right side
      result.phase = 'move-down';
      const moveProgress = (cycleProgress - 0.50) / 0.40; // 0 to 1
      
      // All 7 lines are visible and moving downward
      // Start at top (0.0), move to bottom (1.0)
      const downwardPos = moveProgress;
      
      for (let i = 0; i < this.numLines; i++) {
        result.positions.push(downwardPos);
      }
      result.showRight = true;
    } else {
      // Phase 4: Reset (all black)
      result.phase = 'reset';
    }
    
    return result;
  }

  drawLines(progress) {
    // Start with full black canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Get line positions and phase info
    const lineData = this.getLinePositions(progress);
    
    if (lineData.positions.length === 0) {
      // Reset phase - just black
      return;
    }
    
    // Draw video on the side where lines are
    if (lineData.showLeft) {
      // Show video on left half only
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(0, 0, this.canvas.width / 2, this.canvas.height);
      this.ctx.clip();
      if (this.videoElement.readyState >= 2) {
        this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      }
      this.ctx.restore();
    } else if (lineData.showRight) {
      // Show video on right half only
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(this.canvas.width / 2, 0, this.canvas.width / 2, this.canvas.height);
      this.ctx.clip();
      if (this.videoElement.readyState >= 2) {
        this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      }
      this.ctx.restore();
    }
    
    // Draw the horizontal lines as bright white lines
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = this.lineHeight;
    this.ctx.lineCap = 'round';
    
    for (let i = 0; i < lineData.positions.length; i++) {
      const normalizedY = lineData.positions[i];
      const yPos = normalizedY * this.canvas.height;
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, yPos);
      this.ctx.lineTo(this.canvas.width, yPos);
      this.ctx.stroke();
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

    // Draw the effect
    this.drawLines(progress);

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
