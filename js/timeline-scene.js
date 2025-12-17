class TimelineScene {
    constructor() {
        this.container = document.getElementById('timeline-container');
        this.stage = null;
        this.layer = null;
        this.startYear = 1923;
        this.endYear = new Date().getFullYear();
        this.prePaddingYears = 50;
        this.postPaddingYears = 30;
        this.virtualWidth = 4000;
        this.items = [];
        this.overlay = null;
        window.timelineScene = this;
    }

    init() {
        console.log('[TimelineScene] init() called');
        if (!this.container) {
            console.error('[TimelineScene] timeline-container not found');
            return;
        }

        const rect = this.container.getBoundingClientRect();
        const width = Math.max(800, rect.width);
        const height = Math.max(600, rect.height);
        
        console.log('[TimelineScene] Container dimensions:', { width, height });

        this.stage = new Konva.Stage({
            container: 'timeline-container',
            width: width,
            height: height,
            draggable: true
        });

        this.layer = new Konva.Layer();
        this.stage.add(this.layer);
        
        // Performance optimization: disable shadows during drag
        this.isDragging = false;
        this.stage.on('dragstart', () => {
            this.isDragging = true;
            this.toggleShadows(false);
        });
        
        this.stage.on('dragend', () => {
            this.isDragging = false;
            this.toggleShadows(true);
        });

        this.createTimeline();
        this.loadDocuments();
        this.addZoomHandlers();
        this.createOverlay();
        
        console.log('[TimelineScene] Stage created with', this.items.length, 'items');

        window.addEventListener('resize', () => {
            const rect = this.container.getBoundingClientRect();
            this.stage.width(rect.width);
            this.stage.height(rect.height);
            this.stage.batchDraw();
        });
    }

    mapYearToX(year) {
        const minYear = this.startYear - this.prePaddingYears;
        const maxYear = this.endYear + this.postPaddingYears;
        const t = (year - minYear) / (maxYear - minYear);
        return t * this.virtualWidth;
    }

    createTimeline() {
        const y = this.stage.height() / 2;
        const line = new Konva.Line({
            points: [0, y, this.virtualWidth, y],
            stroke: '#999',
            strokeWidth: 2
        });
        this.layer.add(line);

        // decade ticks
        const minYear = this.startYear - this.prePaddingYears;
        const maxYear = this.endYear + this.postPaddingYears;
        for (let yr = Math.floor(minYear/10)*10; yr <= maxYear; yr += 10) {
            const x = this.mapYearToX(yr);
            const tick = new Konva.Line({ points: [x, y-8, x, y+8], stroke: '#bbb', strokeWidth: 1 });
            this.layer.add(tick);
            const label = new Konva.Text({ x: x-20, y: y+12, text: String(yr), fontSize: 12, fill: '#bbb' });
            this.layer.add(label);
        }
    }

    async loadDocuments() {
        try {
            const response = await fetch('assets/documents/Timeline_Documents.csv');
            const csvText = await response.text();
            const documents = this.parseCSV(csvText);
            
            console.log('[TimelineScene] Loaded', documents.length, 'documents from CSV');
            
            // Create items from CSV documents
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                const year = parseInt(doc.Year);
                const x = this.mapYearToX(year);
                const y = (this.stage.height() / 2) + ((i % 2 === 0) ? -140 : 100);
                const pdfPath = doc.ID ? `assets/documents/${doc.ID}.pdf` : null;
                const item = await this.createDocumentItem(x, y, 160, 110, doc, i, pdfPath);
                this.items.push(item);
                this.layer.add(item.group);
            }
            
            // Add some sample items to fill the timeline
            const numSamples = 7;
            const minYear = this.startYear - this.prePaddingYears;
            const maxYear = this.endYear + this.postPaddingYears;
            
            for (let i = 0; i < numSamples; i++) {
                const t = (i + 1) / (numSamples + 1);
                const year = Math.round(minYear + t * (maxYear - minYear));
                // Skip if year is too close to existing documents
                const tooClose = documents.some(doc => Math.abs(parseInt(doc.Year) - year) < 5);
                if (tooClose) continue;
                
                const x = this.mapYearToX(year);
                const y = (this.stage.height() / 2) + ((i % 2 === 0) ? -140 : 100);
                const item = this.createItem(x, y, 160, 110, `Sample ${i+1}`, year, i + documents.length);
                this.items.push(item);
                this.layer.add(item.group);
            }
            
            this.layer.draw();
        } catch (err) {
            console.error('[TimelineScene] Error loading documents:', err);
            // Fallback to sample items
            this.createSampleItems(10);
        }
    }
    
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const documents = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const doc = {};
            headers.forEach((header, index) => {
                doc[header] = values[index] || '';
            });
            documents.push(doc);
        }
        
        return documents;
    }
    
    createSampleItems(n) {
        const minYear = this.startYear - this.prePaddingYears;
        const maxYear = this.endYear + this.postPaddingYears;

        // Generate sample years evenly across the range
        for (let i = 0; i < n; i++) {
            const t = i / (n-1 || 1);
            const year = Math.round(minYear + t * (maxYear - minYear));
            const x = this.mapYearToX(year);
            const y = (this.stage.height() / 2) + ((i % 2 === 0) ? -140 : 100);
            const item = this.createItem(x, y, 160, 110, `Document ${i+1}`, year, i);
            this.items.push(item);
            this.layer.add(item.group);
        }

        this.layer.draw();
    }
    
    async createDocumentItem(x, y, w, h, doc, index, pdfPath) {
        // Generate thumbnail from PDF
        let img;
        if (pdfPath) {
            img = await this.generatePDFThumbnail(pdfPath, w, h);
        } else {
            img = this.makePlaceholderImage(doc.Source, doc.Year, w, h, index);
        }
        
        const konvaImage = new Konva.Image({
            x: x - w/2,
            y: y - h/2,
            image: img,
            width: w,
            height: h,
            cornerRadius: 6,
            shadowColor: 'black',
            shadowBlur: 4,
            shadowOpacity: 0.3,
            shadowEnabled: true,
            perfectDrawEnabled: false
        });
        
        // Cache the image for better performance
        konvaImage.cache();

        const label = new Konva.Text({
            x: x - w/2,
            y: y + h/2 + 6,
            text: `${doc.Source} — ${doc.Year}`,
            fontSize: 14,
            fill: '#fff',
            width: w,
            align: 'center'
        });

        const group = new Konva.Group({ x: 0, y: 0, draggable: false });
        group.add(konvaImage);
        group.add(label);

        // Click to open PDF viewer
        konvaImage.on('click', () => {
            if (pdfPath) {
                this.showPDFOverlay(pdfPath, doc);
            } else {
                this.showOverlay(img.src || img, doc.Source, doc.Year);
            }
        });

        return { group, konvaImage, label, meta: { ...doc, index, pdfPath } };
    }
    
    async generatePDFThumbnail(pdfPath, width, height) {
        try {
            const pdf = await pdfjsLib.getDocument(pdfPath).promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 1 });
            const scale = Math.min(width / viewport.width, height / viewport.height);
            const scaledViewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            
            // Fill background
            context.fillStyle = '#fff';
            context.fillRect(0, 0, width, height);
            
            // Center the PDF page
            const offsetX = (width - scaledViewport.width) / 2;
            const offsetY = (height - scaledViewport.height) / 2;
            
            context.save();
            context.translate(offsetX, offsetY);
            
            await page.render({
                canvasContext: context,
                viewport: scaledViewport
            }).promise;
            
            context.restore();
            
            const img = new Image();
            img.src = canvas.toDataURL('image/png');
            return img;
        } catch (err) {
            console.error('[TimelineScene] Error generating PDF thumbnail:', err);
            // Return placeholder on error
            return this.makePlaceholderImage('PDF', '', width, height, 0);
        }
    }

    createItem(x, y, w, h, title, year, index) {
        // create placeholder thumbnail as an HTML canvas image
        const img = this.makePlaceholderImage(title, year, w, h, index);
        const konvaImage = new Konva.Image({
            x: x - w/2,
            y: y - h/2,
            image: img,
            width: w,
            height: h,
            cornerRadius: 6,
            shadowColor: 'black',
            shadowBlur: 4,
            shadowOpacity: 0.3,
            shadowEnabled: true,
            perfectDrawEnabled: false
        });
        
        // Cache the image for better performance
        konvaImage.cache();

        const label = new Konva.Text({
            x: x - w/2,
            y: y + h/2 + 6,
            text: `${title} — ${year}`,
            fontSize: 14,
            fill: '#fff',
            width: w,
            align: 'center'
        });

        const group = new Konva.Group({ x: 0, y: 0, draggable: false });
        group.add(konvaImage);
        group.add(label);

        // click to open overlay viewer
        konvaImage.on('click', () => {
            this.showOverlay(img.src || img, title, year);
        });

        return { group, konvaImage, label, meta: { title, year, index } };
    }

    makePlaceholderImage(title, year, w, h, index) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        // color palette
        const colors = ['#6b8cff','#ff8c6b','#8cffb0','#ffd36b','#c48cff','#8cfff2','#ff8ccf','#b6ff8c','#8c9bff','#ffb08c'];
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, w/2, h/2 - 6);
        ctx.font = '14px sans-serif';
        ctx.fillText(String(year), w/2, h/2 + 20);
        const img = new Image();
        img.src = c.toDataURL('image/png');
        return img;
    }

    toggleShadows(enabled) {
        this.items.forEach(item => {
            if (item.konvaImage) {
                item.konvaImage.shadowEnabled(enabled);
            }
        });
        this.layer.batchDraw();
    }

    addZoomHandlers() {
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const oldScale = this.stage.scaleX();
            const pointer = this.stage.getPointerPosition();
            const mousePointTo = {
                x: (pointer.x - this.stage.x()) / oldScale,
                y: (pointer.y - this.stage.y()) / oldScale,
            };

            const scaleBy = 1.05;
            const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
            this.stage.scale({ x: newScale, y: newScale });

            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            this.stage.position(newPos);
            this.stage.batchDraw();
        });
    }

    createOverlay() {
        // simple fullscreen overlay for viewing a document image
        let overlay = document.getElementById('doc-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'doc-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = 0;
            overlay.style.left = 0;
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.9)';
            overlay.style.display = 'none';
            overlay.style.zIndex = 2000;
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.padding = '30px';
            overlay.innerHTML = '<div id="doc-view" style="max-width:90%;max-height:90%;overflow:auto;"></div>' +
                                '<button id="doc-close" style="position:fixed;top:20px;right:20px;padding:12px 18px;font-size:16px;">Close</button>';
            document.body.appendChild(overlay);
            document.getElementById('doc-close').addEventListener('click', () => {
                overlay.style.display = 'none';
                document.getElementById('doc-view').innerHTML = '';
            });
        }
        this.overlay = overlay;
    }

    showOverlay(imgSrc, title, year) {
        if (!this.overlay) this.createOverlay();
        const view = document.getElementById('doc-view');
        view.innerHTML = '';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        view.appendChild(img);
        const caption = document.createElement('div');
        caption.style.color = '#fff';
        caption.style.marginTop = '12px';
        caption.textContent = `${title} — ${year}`;
        view.appendChild(caption);
        this.overlay.style.display = 'flex';
    }
    
    async showPDFOverlay(pdfPath, doc) {
        if (!this.overlay) this.createOverlay();
        const view = document.getElementById('doc-view');
        view.innerHTML = '<div style="color:#fff;margin-bottom:20px;"><strong>' + doc.Source + '</strong> — ' + doc.Year + '</div>';
        
        if (doc.Description) {
            const desc = document.createElement('div');
            desc.style.color = '#ddd';
            desc.style.marginBottom = '20px';
            desc.style.fontSize = '14px';
            desc.textContent = doc.Description;
            view.appendChild(desc);
        }
        
        try {
            const pdf = await pdfjsLib.getDocument(pdfPath).promise;
            
            // Render all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                
                const canvas = document.createElement('canvas');
                canvas.style.display = 'block';
                canvas.style.margin = '10px auto';
                canvas.style.border = '1px solid rgba(255,255,255,0.2)';
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                const context = canvas.getContext('2d');
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                view.appendChild(canvas);
            }
        } catch (err) {
            console.error('[TimelineScene] Error rendering PDF:', err);
            view.innerHTML += '<div style="color:#f66;margin-top:20px;">Error loading PDF</div>';
        }
        
        this.overlay.style.display = 'flex';
    }

    show() {
        if (!this.stage) this.init();
        document.getElementById('timeline-container').classList.add('active');
    }

    hide() {
        document.getElementById('timeline-container').classList.remove('active');
    }
}

// Auto-create instance
const timelineScene = new TimelineScene();

// Optional: expose for console
window.timelineScene = timelineScene;

// Initialize only when a developer calls timelineScene.init() or timelineScene.show()
