/**
 * Video Scan Effect - Matrix Falling Pixels (Full Screen)
 * Creates a Matrix-like effect with falling pixelated video blocks across entire screen
 * Pixels gradually disappear to reveal clearer video, then reappear to break it up again
 */

class VideoScanEffect {
  constructor(videoElement, canvasElement, side = 'left') {
    this.videoElement = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.animationStartTime = null;
    this.animationDuration = 60000; // 60 seconds for full cycle (disappear and reappear)
    this.side = side;
    this.isAnimating = true;
    
    // Pixel settings
    this.pixelSize = 8;
    this.fallSpeed = 0.3; // Very slow fall speed
    this.columnDelay = 50; // Faster activation across screen
    
    // Track falling pixels for each column
    this.columns = [];
    
    // Polygon exclusion zone (will be populated from boundary animation)
    this.polygonBounds = null;
    
    // Navigation bubble exclusion zones
    this.bubbleZones = [];
    
    // Set canvas size to match video
    this.updateCanvasSize();
    
    // Initialize columns
    this.initColumns();
    
    // Get polygon bounds for exclusion
    this.initPolygonExclusion();
    
    // Get navigation bubble bounds for exclusion
    this.initBubbleExclusion();
    
    // Start animation loop
    this.animate();
  }

  initPolygonExclusion() {
    // Wait for boundary animation to load, then get polygon coordinates
    const checkBoundary = () => {
      if (window.boundaryAnimation && window.boundaryAnimation.polygonPoints && window.boundaryAnimation.polygonPoints.length > 0) {
        this.polygonBounds = this.calculatePolygonScreenBounds(window.boundaryAnimation.polygonPoints);
        console.log('[VideoScanEffect] Polygon exclusion zone set:', this.polygonBounds);
      } else {
        setTimeout(checkBoundary, 100);
      }
    };
    checkBoundary();
  }

  initBubbleExclusion() {
    // Get all navigation bubbles and calculate their exclusion zones
    const bubbles = document.querySelectorAll('.nav-bubble');
    const canvasRect = this.canvas.getBoundingClientRect();
    const scaleCanvasX = this.canvas.width / canvasRect.width;
    const scaleCanvasY = this.canvas.height / canvasRect.height;
    
    this.bubbleZones = Array.from(bubbles).map(bubble => {
      const rect = bubble.getBoundingClientRect();
      
      // Convert to canvas-relative coordinates with resolution scaling
      const x = (rect.left - canvasRect.left) * scaleCanvasX;
      const y = (rect.top - canvasRect.top) * scaleCanvasY;
      const width = rect.width * scaleCanvasX;
      const height = rect.height * scaleCanvasY;
      
      // Add padding for better exclusion
      const padding = 10 * Math.min(scaleCanvasX, scaleCanvasY);
      
      return {
        x: x - padding,
        y: y - padding,
        width: width + padding * 2,
        height: height + padding * 2,
        // Calculate ellipse params for circular bubbles
        centerX: x + width / 2,
        centerY: y + height / 2,
        radiusX: (width + padding * 2) / 2,
        radiusY: (height + padding * 2) / 2
      };
    });
    
    console.log('[VideoScanEffect] Navigation bubble exclusion zones set:', this.bubbleZones.length);
  }

  isPointInBubble(x, y) {
    // Check if point is inside any navigation bubble (using ellipse test)
    return this.bubbleZones.some(zone => {
      const dx = (x - zone.centerX) / zone.radiusX;
      const dy = (y - zone.centerY) / zone.radiusY;
      return (dx * dx + dy * dy) <= 1;
    });
  }

  calculatePolygonScreenBounds(svgPoints) {
    // Get SVG element to calculate screen position
    const svgElement = document.getElementById('lot-boundary-svg');
    if (!svgElement) return null;

    const svgRect = svgElement.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const viewBoxSize = 1000; // SVG viewBox is 0 0 1000 1000
    
    // Scale factor from SVG coordinates to screen display size
    const scaleX = svgRect.width / viewBoxSize;
    const scaleY = svgRect.height / viewBoxSize;
    
    // Convert SVG polygon points to canvas-relative coordinates
    // Then scale to canvas internal resolution
    const scaleCanvasX = this.canvas.width / canvasRect.width;
    const scaleCanvasY = this.canvas.height / canvasRect.height;
    
    const canvasPoints = svgPoints.map(p => ({
      x: ((svgRect.left - canvasRect.left) + (p.x * scaleX)) * scaleCanvasX,
      y: ((svgRect.top - canvasRect.top) + (p.y * scaleY)) * scaleCanvasY
    }));
    
    console.log('[VideoScanEffect] Polygon bounds:', {
      canvasSize: [this.canvas.width, this.canvas.height],
      displaySize: [canvasRect.width, canvasRect.height],
      scale: [scaleCanvasX, scaleCanvasY],
      samplePoint: canvasPoints[0]
    });
    
    return {
      points: canvasPoints,
      svgRect: svgRect
    };
  }

  isPointInPolygon(x, y) {
    if (!this.polygonBounds) return false;
    
    const points = this.polygonBounds.points;
    let inside = false;
    
    // Ray casting algorithm for point-in-polygon test
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      
      const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    
    return inside;
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

  initColumns() {
    const numColumns = Math.ceil(this.canvas.width / this.pixelSize);
    this.columns = [];
    
    for (let i = 0; i < numColumns; i++) {
      this.columns.push({
        x: i * this.pixelSize,
        pixels: [],
        active: false,
        activationTime: i * this.columnDelay
      });
    }
  }

  getPixelDensity(progress) {
    // progress: 0 to 1 over 60 seconds
    // 0-0.5: Pixels gradually increase (density goes from 0.2 to 1.0) - more pixels reveal video
    // 0.5-1.0: Pixels gradually decrease (density goes from 1.0 to 0.2) - fewer pixels, more abstract
    
    if (progress < 0.5) {
      // Increasing pixel phase - start sparse, get dense
      return 0.2 + (progress * 2 * 0.8); // 0.2 → 1.0
    } else {
      // Decreasing pixel phase - dense back to sparse
      return 1.0 - ((progress - 0.5) * 2 * 0.8); // 1.0 → 0.2
    }
  }

  updateColumns(elapsed, density) {
    // Activate columns from left to right over time
    this.columns.forEach(col => {
      if (!col.active && elapsed >= col.activationTime) {
        col.active = true;
        // Start first pixel at top
        col.pixels.push({
          y: -this.pixelSize * Math.random() * 5,
          speed: this.fallSpeed * (0.8 + Math.random() * 0.4)
        });
      }
      
      if (col.active) {
        // Update falling pixels
        col.pixels = col.pixels.filter(pixel => {
          pixel.y += pixel.speed;
          
          // Wrap around when reaching bottom
          if (pixel.y > this.canvas.height) {
            pixel.y = -this.pixelSize * (2 + Math.random() * 3);
          }
          
          return true;
        });
        
        // Vary pixel spawn rate based on density - less random for smoother effect
        const spawnChance = 0.015 * density;
        const maxPixels = Math.ceil(15 * density);
        
        if (Math.random() < spawnChance && col.pixels.length < maxPixels) {
          col.pixels.push({
            y: -this.pixelSize * (2 + Math.random() * 3),
            speed: this.fallSpeed * (0.9 + Math.random() * 0.2) // Less speed variation
          });
        }
      }
    });
  }

  drawMatrixEffect(progress, density) {
    // Draw full video as base
    if (this.videoElement.readyState < 2) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    
    // Start with black
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw falling pixel blocks everywhere
    this.columns.forEach(col => {
      if (!col.active) return;
      
      col.pixels.forEach(pixel => {
        const pixelCenterX = col.x + this.pixelSize/2;
        const pixelCenterY = pixel.y + this.pixelSize/2;
        
        // Skip if pixel is inside the polygon - we'll draw clear video there instead
        if (this.isPointInPolygon(pixelCenterX, pixelCenterY)) {
          return;
        }
        
        // Skip if pixel is inside any navigation bubble
        if (this.isPointInBubble(pixelCenterX, pixelCenterY)) {
          return;
        }
        
        // Sample and draw video at this pixel location
        this.ctx.drawImage(
          this.videoElement,
          col.x, pixel.y, this.pixelSize, this.pixelSize,
          col.x, pixel.y, this.pixelSize, this.pixelSize
        );
      });
    });
    
    // Draw fragmented/fading video inside the polygon boundary
    if (this.polygonBounds && this.polygonBounds.points.length > 0) {
      this.ctx.save();
      
      // Create clipping path from polygon
      this.ctx.beginPath();
      const points = this.polygonBounds.points;
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.closePath();
      this.ctx.clip();
      
      // Simpler approach: fade in during first half, fade out during second half
      // Match the visual rhythm of falling pixels
      
      let videoAlpha, fragmentSize;
      
      // Smooth easing function
      const smoothEase = (t) => {
        // Smooth acceleration and deceleration
        return t * t * (3 - 2 * t);
      };
      
      if (progress < 0.5) {
        // Fade in: first half of cycle (30 seconds)
        const t = progress / 0.5;
        const eased = smoothEase(t);
        videoAlpha = eased * 0.9; // 0 -> 0.9 
        fragmentSize = 32 - (eased * 20); // 32 -> 12 (fragments shrink)
      } else {
        // Fade out: second half of cycle (30 seconds)
        const t = (progress - 0.5) / 0.5;
        const eased = smoothEase(t);
        videoAlpha = 0.9 - (eased * 0.9); // 0.9 -> 0
        fragmentSize = 12 + (eased * 20); // 12 -> 32 (fragments grow)
      }
      
      // Draw pixelated/fragmented video inside polygon
      this.ctx.globalAlpha = videoAlpha;
      
      if (fragmentSize > 8) {
        // Draw fragmented (pixelated) video
        const bounds = this.polygonBounds;
        for (let x = Math.floor(bounds.minX); x < bounds.maxX; x += fragmentSize) {
          for (let y = Math.floor(bounds.minY); y < bounds.maxY; y += fragmentSize) {
            const centerX = x + fragmentSize / 2;
            const centerY = y + fragmentSize / 2;
            
            // Check if this fragment is inside polygon
            if (this.isPointInPolygon(centerX, centerY)) {
              this.ctx.drawImage(
                this.videoElement,
                x, y, fragmentSize, fragmentSize,
                x, y, fragmentSize, fragmentSize
              );
            }
          }
        }
      } else {
        // Draw clear video
        this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      }
      
      this.ctx.restore();
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
      this.initColumns();
    }

    // Calculate current pixel density
    const density = this.getPixelDensity(progress);

    // Update column states
    this.updateColumns(elapsed, density);

    // Draw the matrix effect
    this.drawMatrixEffect(progress, density);

    requestAnimationFrame(this.animate);
  }

  stop() {
    this.isAnimating = false;
  }

  start() {
    this.isAnimating = true;
    this.animationStartTime = null;
    this.initColumns();
    this.animate();
  }

  reset() {
    this.animationStartTime = null;
    this.initColumns();
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
  const canvasEl = document.getElementById('canvas-main');

  if (videoEl && canvasEl) {
    window.scanEffect = new VideoScanEffect(videoEl, canvasEl, 'full');
    videoEl.addEventListener('loadedmetadata', () => {
      window.scanEffect.start();
    });
  }
}
