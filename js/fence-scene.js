class FenceScene {
    constructor() {
        // Updated: look for fence-canvas directly (it's in time-section now)
        // Don't fail if canvas not found yet - init() will check again
        this.canvas = null;
        this.ctx = null;
        this.interactionPoints = [];
        this.sceneImage = null;
        this._onResize = this.drawImage.bind(this);
    }
    
    init() {
        console.log('[FenceScene] init() called');
        
        // Find canvas if not already found
        if (!this.canvas) {
            this.canvas = document.getElementById('fence-canvas');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
                console.log('[FenceScene] canvas found and context created');
            }
        }
        
        if (!this.canvas) {
            console.error('[FenceScene] fence-canvas not found in DOM');
            return;
        }

        // Set canvas to fill its own rendered size (after layout)
        this.resizeCanvas();
        const rect0 = this.canvas.getBoundingClientRect();
        console.log('[FenceScene] initial canvas rect', {
            width: rect0.width,
            height: rect0.height
        });
        // Ensure a second pass after layout settles
        requestAnimationFrame(() => {
            this.resizeCanvas();
            const rect1 = this.canvas.getBoundingClientRect();
            console.log('[FenceScene] post-rAF canvas rect', {
                width: rect1.width,
                height: rect1.height
            });
            if (this.sceneImage && this.sceneImage.complete) this.drawImage();
        });

        // Load and draw the fence image, then set up interaction zones
        this.loadSceneImage('assets/images/vermontfence1_gate.jpg');
        this.setupInteractionZones();
        window.addEventListener('resize', this._onResize);
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        // account for device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        console.log('[FenceScene] resized canvas', { w, h, dpr, pixelW: this.canvas.width, pixelH: this.canvas.height });
    }

    show() {
        this.init();
    }

    hide() {
        window.removeEventListener('resize', this._onResize);
    }
    
    setupInteractionZones() {
        // Placeholder for adding interactive hotspots
        // This is where you'll add clickable areas, audio triggers, etc.
        console.log('Ready for interaction zones');
        
        // Example: Add click listener
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            console.log(`Clicked at: ${x}, ${y}`);
            // Future: trigger multimedia interactions
        });
    }

    loadSceneImage(src) {
        if (!this.canvas || !this.ctx) return;
        const img = new Image();
        img.onload = () => {
            this.sceneImage = img;
            console.log('[FenceScene] image loaded', { w: img.width, h: img.height });
            this.drawImage();
        };
        img.onerror = (err) => console.error('Failed to load fence image', err);
        img.src = src;
    }

    drawImage() {
        if (!this.canvas || !this.ctx || !this.sceneImage) return;

        // Match canvas to displayed size
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        const iw = this.sceneImage.width;
        const ih = this.sceneImage.height;

        // Scale to cover the canvas (like background-size: cover)
        const scale = Math.max(cw / iw, ch / ih);
        const w = iw * scale;
        const h = ih * scale;
        const x = (cw - w) / 2;
        const y = (ch - h) / 2;

        this.ctx.clearRect(0, 0, cw, ch);
        this.ctx.drawImage(this.sceneImage, x, y, w, h);
    }
}

const fenceScene = new FenceScene();
window.fenceScene = fenceScene;