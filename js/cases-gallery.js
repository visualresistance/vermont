/**
 * Cases Gallery - Displays fence case studies from CSV in a Palladio-style tiled gallery
 */

const casesGallery = {
    initialized: false,
    caseStudies: [],
    
    /**
     * Initialize the gallery - load CSV and render tiles
     */
    async init() {
        if (this.initialized) return;
        
        console.log('[Cases Gallery] Initializing...');
        
        try {
            await this.loadCases();
            this.render();
            this.setupModal();
            this.initialized = true;
            console.log('[Cases Gallery] Initialized with', this.caseStudies.length, 'cases');
        } catch (err) {
            console.error('[Cases Gallery] Initialization error:', err);
        }
    },
    
    /**
     * Load and parse CSV file
     */
    async loadCases() {
        const response = await fetch('assets/data/fence_casestudies.csv');
        const csvText = await response.text();
        
        // Parse CSV
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        this.caseStudies = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line (handling commas within quotes)
            const values = this.parseCSVLine(line);
            
            if (values.length >= headers.length) {
                const caseStudy = {};
                headers.forEach((header, index) => {
                    caseStudy[header] = values[index] ? values[index].trim() : '';
                });
                this.caseStudies.push(caseStudy);
            }
        }
        
        console.log('[Cases Gallery] Loaded', this.caseStudies.length, 'case studies');
    },
    
    /**
     * Parse CSV line handling quoted commas
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current);
        return values;
    },
    
    /**
     * Render gallery tiles
     */
    render() {
        const gallery = document.getElementById('cases-gallery');
        gallery.innerHTML = '';
        
        this.caseStudies.forEach((caseStudy, index) => {
            const tile = this.createTile(caseStudy, index);
            gallery.appendChild(tile);
        });
    },
    
    /**
     * Create a single gallery tile
     */
    createTile(caseStudy, index) {
        const tile = document.createElement('div');
        tile.className = 'case-tile';
        tile.dataset.index = index;
        
        // Image
        const img = document.createElement('img');
        img.className = 'case-image';
        img.src = caseStudy['Image URL (JPG)'] || 'assets/images/placeholder.svg';
        img.alt = caseStudy['Title'] || 'Case study';
        img.onerror = function() {
            this.src = 'assets/images/placeholder.svg';
        };
        
        // Metadata overlay
        const metadata = document.createElement('div');
        metadata.className = 'case-metadata';
        
        const title = document.createElement('h3');
        title.className = 'case-title';
        title.textContent = caseStudy['Title'] || 'Untitled';
        
        const artist = document.createElement('p');
        artist.className = 'case-artist';
        artist.textContent = caseStudy['Artist(s)'] || 'Unknown Artist';
        
        metadata.appendChild(title);
        metadata.appendChild(artist);
        
        tile.appendChild(img);
        tile.appendChild(metadata);
        
        // Click to expand
        tile.addEventListener('click', () => {
            this.showDetailModal(caseStudy);
        });
        
        return tile;
    },
    
    /**
     * Show detail modal with all metadata
     */
    showDetailModal(caseStudy) {
        const modal = document.getElementById('case-modal');
        const modalBody = document.getElementById('modal-body');
        
        modalBody.innerHTML = '';
        
        // Image
        const img = document.createElement('img');
        img.className = 'modal-image';
        img.src = caseStudy['Image URL (JPG)'] || 'assets/images/placeholder.svg';
        img.alt = caseStudy['Title'];
        img.onerror = function() {
            this.src = 'assets/images/placeholder.svg';
        };
        
        // Metadata
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'modal-metadata';
        
        const fields = [
            'Title',
            'Artist(s)',
            'Year/Duration',
            'Location',
            'Materials / Structure',
            'Fence/Barrier Type',
            'Themes',
            'Primary Link'
        ];
        
        fields.forEach(field => {
            if (caseStudy[field]) {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'metadata-field';
                
                const label = document.createElement('strong');
                label.textContent = field + ': ';
                
                const value = document.createElement('span');
                
                // Make links clickable
                if (field === 'Primary Link') {
                    const link = document.createElement('a');
                    link.href = caseStudy[field];
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = caseStudy[field];
                    value.appendChild(link);
                } else {
                    value.textContent = caseStudy[field];
                }
                
                fieldDiv.appendChild(label);
                fieldDiv.appendChild(value);
                metadataDiv.appendChild(fieldDiv);
            }
        });
        
        modalBody.appendChild(img);
        modalBody.appendChild(metadataDiv);
        
        modal.style.display = 'flex';
    },
    
    /**
     * Setup modal close handlers
     */
    setupModal() {
        const modal = document.getElementById('case-modal');
        const closeBtn = document.querySelector('.modal-close');
        
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }
};

// Make available globally
window.casesGallery = casesGallery;
