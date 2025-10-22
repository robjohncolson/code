/**
 * curriculum_loader.js - Async Curriculum Loader with Caching
 * Part of AP Statistics Consensus Quiz
 *
 * Provides lazy-loading, indexing, and query capabilities for curriculum data.
 * Reduces initial bundle parse time by loading asynchronously.
 */

class CurriculumLoader {
    constructor(options = {}) {
        // Configuration
        this.config = {
            curriculumUrl: options.curriculumUrl || 'data/curriculum.js',
            manifestUrl: options.manifestUrl || 'data/curriculum_manifest.json',
            chunkBaseUrl: options.chunkBaseUrl || 'data/',
            cacheTTL: options.cacheTTL || 30 * 60 * 1000, // 30 minutes default
            enableMemoryCache: options.enableMemoryCache !== false,
            enableIndexedDB: options.enableIndexedDB !== false,
            enableChunkLoading: options.enableChunkLoading !== false, // P9: Enable lazy chunk loading
            maxMemoryUnits: options.maxMemoryUnits || 5, // Max units in memory
            enableFallback: options.enableFallback !== false
        };

        // P9: Chunk loading state
        this.manifest = null;
        this.loadedChunks = new Set();
        this.chunkLoadPromises = new Map(); // Track in-flight chunk loads

        // State
        this.initialized = false;
        this.loading = false;
        this.fullCurriculum = null;
        this.unitCache = new Map(); // Map<unitId, {data, timestamp, accessCount}>
        this.lastAccess = new Map(); // For LRU eviction
        this.loadPromise = null;

        // Indexing
        this.index = null; // CurriculumIndex instance

        // Performance tracking
        this.metrics = {
            loadStart: 0,
            loadEnd: 0,
            cacheHits: 0,
            cacheMisses: 0,
            unitsLoaded: 0,
            preloadHits: 0
        };

        // Progressive loading
        this.currentUnit = null; // Track current unit for preloading
        this.preloadQueue = []; // Queue of units to preload
        this.preloading = false; // Preload in progress flag

        // Network detection
        this.networkType = this._detectNetworkType();
        this._setupNetworkListener();

        // Memory pressure detection
        this.memoryPressure = 'normal'; // normal, moderate, critical
        this._setupMemoryMonitoring();

        // Bind methods
        this.init = this.init.bind(this);
        this.loadUnit = this.loadUnit.bind(this);
        this.getQuestion = this.getQuestion.bind(this);
        this.searchQuestions = this.searchQuestions.bind(this);
        this.preloadAdjacentUnits = this.preloadAdjacentUnits.bind(this);
    }

    /**
     * Initialize the loader
     * @returns {Promise<boolean>} Success status
     */
    async init() {
        if (this.initialized) return true;
        if (this.loadPromise) return this.loadPromise;

        performance.mark('curriculum-loader-init-start');
        console.log('[CurriculumLoader] Initializing...');

        this.loadPromise = this._init()
            .then(success => {
                performance.mark('curriculum-loader-init-end');
                performance.measure(
                    'curriculum-loader-init',
                    'curriculum-loader-init-start',
                    'curriculum-loader-init-end'
                );

                const measure = performance.getEntriesByName('curriculum-loader-init')[0];
                console.log(`[CurriculumLoader] Initialized in ${measure.duration.toFixed(2)}ms`);

                this.initialized = success;
                return success;
            })
            .catch(error => {
                console.error('[CurriculumLoader] Initialization failed:', error);
                return false;
            });

        return this.loadPromise;
    }

    /**
     * Internal initialization logic
     */
    async _init() {
        try {
            // Initialize index
            if (typeof CurriculumIndex !== 'undefined') {
                this.index = new CurriculumIndex();

                // Try to load cached index first
                if (this.config.enableIndexedDB) {
                    const indexLoaded = await this.index.loadFromCache();
                    if (indexLoaded) {
                        console.log('[CurriculumLoader] Index loaded from cache');
                    }
                }
            } else {
                console.warn('[CurriculumLoader] CurriculumIndex not available');
            }

            // Try to load from IndexedDB cache first
            if (this.config.enableIndexedDB) {
                const cached = await this._loadFromIndexedDB();
                if (cached) {
                    console.log('[CurriculumLoader] Loaded from IndexedDB cache');
                    this.fullCurriculum = cached;

                    // Build index if not already loaded
                    if (this.index && !this.index.initialized) {
                        await this.index.buildIndex(cached);
                    }

                    return true;
                }
            }

            // Fall back to network load
            const success = await this._loadFromNetwork();

            // Build index after loading curriculum
            if (success && this.index && !this.index.initialized) {
                await this.index.buildIndex(this.fullCurriculum);
            }

            return success;

        } catch (error) {
            console.error('[CurriculumLoader] Init error:', error);

            // Try fallback to synchronous global
            if (this.config.enableFallback && typeof EMBEDDED_CURRICULUM !== 'undefined') {
                console.warn('[CurriculumLoader] Using fallback to global EMBEDDED_CURRICULUM');
                this.fullCurriculum = EMBEDDED_CURRICULUM;

                // Build index for fallback data
                if (this.index && !this.index.initialized) {
                    await this.index.buildIndex(EMBEDDED_CURRICULUM);
                }

                return true;
            }

            throw error;
        }
    }

    /**
     * Load curriculum from network
     */
    async _loadFromNetwork() {
        performance.mark('curriculum-network-load-start');
        this.metrics.loadStart = Date.now();

        try {
            console.log('[CurriculumLoader] Loading curriculum from network...');

            const response = await fetch(this.config.curriculumUrl, {
                cache: 'force-cache' // Use browser cache if available
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();

            // Parse the curriculum data
            // Extract EMBEDDED_CURRICULUM from "const EMBEDDED_CURRICULUM = [...]"
            const match = text.match(/const\s+EMBEDDED_CURRICULUM\s*=\s*(\[[\s\S]*\]);?\s*$/);
            if (!match) {
                throw new Error('Could not parse curriculum data format');
            }

            this.fullCurriculum = JSON.parse(match[1]);
            this.metrics.loadEnd = Date.now();

            performance.mark('curriculum-network-load-end');
            performance.measure(
                'curriculum-network-load',
                'curriculum-network-load-start',
                'curriculum-network-load-end'
            );

            const measure = performance.getEntriesByName('curriculum-network-load')[0];
            console.log(`[CurriculumLoader] Network load: ${measure.duration.toFixed(2)}ms`);
            console.log(`[CurriculumLoader] Loaded ${this.fullCurriculum.length} questions`);

            // Cache in IndexedDB for future loads
            if (this.config.enableIndexedDB) {
                this._saveToIndexedDB(this.fullCurriculum).catch(err => {
                    console.warn('[CurriculumLoader] IndexedDB save failed:', err);
                });
            }

            return true;

        } catch (error) {
            console.error('[CurriculumLoader] Network load failed:', error);
            throw error;
        }
    }

    /**
     * Load a specific unit on demand
     * @param {string|number} unitId - Unit identifier (e.g., 1, "1", "unit1")
     * @returns {Promise<Object>} Unit data with questions and metadata
     */
    async loadUnit(unitId) {
        performance.mark(`curriculum-load-unit-${unitId}-start`);

        // Normalize unit ID
        const normalizedId = this._normalizeUnitId(unitId);

        // Check memory cache first
        if (this.unitCache.has(normalizedId)) {
            this.metrics.cacheHits++;
            const cached = this.unitCache.get(normalizedId);

            // Update access tracking for LRU
            cached.accessCount++;
            cached.lastAccess = Date.now();
            this.lastAccess.set(normalizedId, Date.now());

            performance.mark(`curriculum-load-unit-${unitId}-end`);
            performance.measure(
                `curriculum-load-unit-${unitId}`,
                `curriculum-load-unit-${unitId}-start`,
                `curriculum-load-unit-${unitId}-end`
            );

            console.log(`[CurriculumLoader] Unit ${unitId} cache hit`);
            return cached.data;
        }

        // Cache miss - need to load
        this.metrics.cacheMisses++;

        let unitQuestions;

        // P9: Try chunk loading first if enabled
        if (this.config.enableChunkLoading) {
            try {
                unitQuestions = await this.loadChunk(normalizedId);
                console.log(`[CurriculumLoader] Loaded unit ${unitId} from chunk`);
            } catch (error) {
                console.warn(`[CurriculumLoader] Chunk loading failed for unit ${unitId}, falling back:`, error.message);
                // Fall through to legacy loading
            }
        }

        // Fallback: Load from full curriculum
        if (!unitQuestions) {
            // Ensure curriculum is loaded
            if (!this.fullCurriculum) {
                await this.init();
            }

            // Extract unit questions
            unitQuestions = this.fullCurriculum.filter(question => {
                const match = question.id.match(/U(\d+)/i);
                return match && parseInt(match[1]) === normalizedId;
            });
        }

        if (unitQuestions.length === 0) {
            console.warn(`[CurriculumLoader] No questions found for unit ${unitId}`);
            return null;
        }

        // Build unit data object
        const unitData = {
            unitId: normalizedId,
            questions: unitQuestions,
            metadata: this._buildUnitMetadata(unitQuestions),
            loadedAt: Date.now()
        };

        // Store in cache
        if (this.config.enableMemoryCache) {
            this._cacheUnit(normalizedId, unitData);
        }

        this.metrics.unitsLoaded++;

        performance.mark(`curriculum-load-unit-${unitId}-end`);
        performance.measure(
            `curriculum-load-unit-${unitId}`,
            `curriculum-load-unit-${unitId}-start`,
            `curriculum-load-unit-${unitId}-end`
        );

        const measure = performance.getEntriesByName(`curriculum-load-unit-${unitId}`)[0];
        console.log(`[CurriculumLoader] Unit ${unitId} loaded in ${measure.duration.toFixed(2)}ms (${unitQuestions.length} questions)`);

        return unitData;
    }

    /**
     * Get a specific question by ID
     * @param {string} questionId - Question ID (e.g., "U1-L2-Q01")
     * @returns {Promise<Object|null>} Question object or null if not found
     */
    async getQuestion(questionId) {
        performance.mark(`curriculum-get-question-${questionId}-start`);

        // Extract unit from question ID
        const match = questionId.match(/U(\d+)/i);
        if (!match) {
            console.warn(`[CurriculumLoader] Invalid question ID format: ${questionId}`);
            return null;
        }

        const unitId = parseInt(match[1]);

        // Load the unit (will use cache if available)
        const unit = await this.loadUnit(unitId);
        if (!unit) return null;

        // Find the question
        const question = unit.questions.find(q => q.id === questionId);

        performance.mark(`curriculum-get-question-${questionId}-end`);
        performance.measure(
            `curriculum-get-question-${questionId}`,
            `curriculum-get-question-${questionId}-start`,
            `curriculum-get-question-${questionId}-end`
        );

        return question || null;
    }

    /**
     * Get all questions for a unit
     * @param {string|number} unitId - Unit identifier
     * @returns {Promise<Array>} Array of questions
     */
    async getUnitQuestions(unitId) {
        const unit = await this.loadUnit(unitId);
        return unit ? unit.questions : [];
    }

    /**
     * Cache a unit in memory with LRU eviction
     */
    _cacheUnit(unitId, unitData) {
        // Check if we need to evict
        if (this.unitCache.size >= this.config.maxMemoryUnits) {
            this._evictLRU();
        }

        this.unitCache.set(unitId, {
            data: unitData,
            timestamp: Date.now(),
            accessCount: 1,
            lastAccess: Date.now()
        });

        this.lastAccess.set(unitId, Date.now());
    }

    /**
     * Evict least recently used unit from cache
     */
    _evictLRU() {
        let oldestId = null;
        let oldestTime = Infinity;

        for (const [unitId, time] of this.lastAccess.entries()) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestId = unitId;
            }
        }

        if (oldestId !== null) {
            console.log(`[CurriculumLoader] Evicting unit ${oldestId} from cache (LRU)`);
            this.unitCache.delete(oldestId);
            this.lastAccess.delete(oldestId);
        }
    }

    /**
     * Build metadata for a unit
     */
    _buildUnitMetadata(questions) {
        const lessons = new Set();
        const questionTypes = {};

        questions.forEach(q => {
            const lessonMatch = q.id.match(/U\d+-L(\d+)/i);
            if (lessonMatch) {
                lessons.add(parseInt(lessonMatch[1]));
            }

            const type = q.type || 'unknown';
            questionTypes[type] = (questionTypes[type] || 0) + 1;
        });

        return {
            totalQuestions: questions.length,
            lessons: Array.from(lessons).sort((a, b) => a - b),
            lessonCount: lessons.size,
            questionTypes
        };
    }

    /**
     * Normalize unit ID to integer
     */
    _normalizeUnitId(unitId) {
        if (typeof unitId === 'number') return unitId;

        const match = String(unitId).match(/(\d+)/);
        return match ? parseInt(match[1]) : parseInt(unitId);
    }

    /**
     * Load from IndexedDB cache
     */
    async _loadFromIndexedDB() {
        try {
            const db = await this._openIndexedDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['curriculum'], 'readonly');
                const store = transaction.objectStore('curriculum');
                const request = store.get('full_curriculum');

                request.onsuccess = () => {
                    const result = request.result;

                    if (!result) {
                        resolve(null);
                        return;
                    }

                    // Check if cache is expired
                    const age = Date.now() - result.timestamp;
                    if (age > this.config.cacheTTL) {
                        console.log('[CurriculumLoader] IndexedDB cache expired');
                        resolve(null);
                        return;
                    }

                    resolve(result.data);
                };

                request.onerror = () => reject(request.error);
            });

        } catch (error) {
            console.warn('[CurriculumLoader] IndexedDB load failed:', error);
            return null;
        }
    }

    /**
     * Save to IndexedDB cache
     */
    async _saveToIndexedDB(data) {
        try {
            const db = await this._openIndexedDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['curriculum'], 'readwrite');
                const store = transaction.objectStore('curriculum');

                const request = store.put({
                    id: 'full_curriculum',
                    data: data,
                    timestamp: Date.now()
                });

                request.onsuccess = () => {
                    console.log('[CurriculumLoader] Saved to IndexedDB cache');
                    resolve();
                };

                request.onerror = () => reject(request.error);
            });

        } catch (error) {
            console.warn('[CurriculumLoader] IndexedDB save failed:', error);
        }
    }

    /**
     * Open IndexedDB connection
     */
    _openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('APStatsCurriculum', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('curriculum')) {
                    db.createObjectStore('curriculum', { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Clear all caches (for debugging/testing)
     */
    async clearCache() {
        this.unitCache.clear();
        this.lastAccess.clear();

        if (this.config.enableIndexedDB) {
            try {
                const db = await this._openIndexedDB();
                const transaction = db.transaction(['curriculum'], 'readwrite');
                const store = transaction.objectStore('curriculum');
                await store.clear();
                console.log('[CurriculumLoader] Caches cleared');
            } catch (error) {
                console.warn('[CurriculumLoader] IndexedDB clear failed:', error);
            }
        }
    }

    /**
     * Search questions by text query
     * @param {string} query - Search query
     * @param {Object} options - Search options (limit, offset, unitFilter, typeFilter)
     * @returns {Promise<Array>} Array of matching questions
     */
    async searchQuestions(query, options = {}) {
        // Ensure curriculum and index are loaded
        if (!this.fullCurriculum) {
            await this.init();
        }

        if (!this.index || !this.index.initialized) {
            console.warn('[CurriculumLoader] Index not available, using fallback search');
            return this._fallbackSearch(query, options);
        }

        // Use index for fast search
        const questionIds = this.index.search(query, options);

        // Get full question objects
        const questions = questionIds.map(id => {
            return this.fullCurriculum.find(q => q.id === id);
        }).filter(q => q !== undefined);

        return questions;
    }

    /**
     * Get questions by tags
     * @param {Array|string} tags - Tag or array of tags
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of matching questions
     */
    async getQuestionsByTags(tags, options = {}) {
        // Ensure curriculum and index are loaded
        if (!this.fullCurriculum) {
            await this.init();
        }

        if (!this.index || !this.index.initialized) {
            console.warn('[CurriculumLoader] Index not available');
            return [];
        }

        const questionIds = this.index.getQuestionsByTags(tags, options);

        // Get full question objects
        const questions = questionIds.map(id => {
            return this.fullCurriculum.find(q => q.id === id);
        }).filter(q => q !== undefined);

        return questions;
    }

    /**
     * Get questions by type
     * @param {string} type - Question type
     * @returns {Promise<Array>} Array of matching questions
     */
    async getQuestionsByType(type) {
        // Ensure curriculum and index are loaded
        if (!this.fullCurriculum) {
            await this.init();
        }

        if (!this.index || !this.index.initialized) {
            // Fallback: filter manually
            return this.fullCurriculum.filter(q => q.type === type);
        }

        const questionIds = this.index.getQuestionsByType(type);

        // Get full question objects
        const questions = questionIds.map(id => {
            return this.fullCurriculum.find(q => q.id === id);
        }).filter(q => q !== undefined);

        return questions;
    }

    /**
     * Get lesson questions
     * @param {number} unitId - Unit number
     * @param {number} lessonId - Lesson number
     * @returns {Promise<Array>} Array of questions
     */
    async getLessonQuestions(unitId, lessonId) {
        // Ensure curriculum and index are loaded
        if (!this.fullCurriculum) {
            await this.init();
        }

        if (!this.index || !this.index.initialized) {
            // Fallback: filter manually
            const lessonPrefix = `U${unitId}-L${lessonId}`;
            return this.fullCurriculum.filter(q => q.id.startsWith(lessonPrefix));
        }

        const questionIds = this.index.getLessonQuestions(unitId, lessonId);

        // Get full question objects
        const questions = questionIds.map(id => {
            return this.fullCurriculum.find(q => q.id === id);
        }).filter(q => q !== undefined);

        return questions;
    }

    /**
     * Fallback search without index (slower)
     */
    _fallbackSearch(query, options = {}) {
        const { limit = 100, offset = 0, unitFilter = null } = options;

        const lowerQuery = query.toLowerCase();

        let results = this.fullCurriculum.filter(question => {
            // Check if prompt contains query
            const promptMatch = question.prompt && question.prompt.toLowerCase().includes(lowerQuery);

            // Apply unit filter
            if (unitFilter !== null) {
                const match = question.id.match(/U(\d+)/i);
                if (!match || parseInt(match[1]) !== unitFilter) {
                    return false;
                }
            }

            return promptMatch;
        });

        return results.slice(offset, offset + limit);
    }

    /**
     * Get index statistics
     * @returns {Object|null} Index statistics or null if index not available
     */
    getIndexStats() {
        return this.index ? this.index.getStats() : null;
    }

    /**
     * Get loader metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.unitCache.size,
            cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses),
            loadDuration: this.metrics.loadEnd - this.metrics.loadStart,
            indexStats: this.getIndexStats()
        };
    }

    /**
     * Preload adjacent units based on current navigation
     * @param {number} currentUnitId - Current unit being viewed
     * @returns {Promise<void>}
     */
    async preloadAdjacentUnits(currentUnitId) {
        this.currentUnit = currentUnitId;

        // Don't preload if network is slow or memory pressure is high
        if (this.networkType === '2g' || this.memoryPressure === 'critical') {
            console.log('[CurriculumLoader] Skipping preload: poor network/memory conditions');
            return;
        }

        // Preload next and previous units
        const unitsToPreload = [];

        if (currentUnitId > 1) {
            unitsToPreload.push(currentUnitId - 1); // Previous unit
        }

        if (currentUnitId < 9) {
            unitsToPreload.push(currentUnitId + 1); // Next unit
        }

        // Add to preload queue
        unitsToPreload.forEach(unitId => {
            if (!this.unitCache.has(unitId) && !this.preloadQueue.includes(unitId)) {
                this.preloadQueue.push(unitId);
            }
        });

        // Start preloading if not already in progress
        if (!this.preloading && this.preloadQueue.length > 0) {
            this._processPreloadQueue();
        }
    }

    /**
     * Process preload queue during idle time
     */
    async _processPreloadQueue() {
        if (this.preloading || this.preloadQueue.length === 0) {
            return;
        }

        this.preloading = true;

        // Use requestIdleCallback if available for non-blocking preload
        const preloadNext = async () => {
            if (this.preloadQueue.length === 0) {
                this.preloading = false;
                return;
            }

            // Check memory pressure before each preload
            if (this.memoryPressure === 'critical') {
                console.log('[CurriculumLoader] Stopping preload: critical memory pressure');
                this.preloadQueue = [];
                this.preloading = false;
                return;
            }

            const unitId = this.preloadQueue.shift();

            try {
                console.log(`[CurriculumLoader] Preloading unit ${unitId}...`);
                await this.loadUnit(unitId);
                this.metrics.preloadHits++;
            } catch (error) {
                console.warn(`[CurriculumLoader] Preload failed for unit ${unitId}:`, error);
            }

            // Continue with next unit
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => preloadNext());
            } else {
                setTimeout(() => preloadNext(), 100);
            }
        };

        // Start preloading
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => preloadNext());
        } else {
            setTimeout(() => preloadNext(), 100);
        }
    }

    /**
     * Detect network type for adaptive loading
     */
    _detectNetworkType() {
        if (typeof navigator === 'undefined' || !navigator.connection) {
            return 'unknown';
        }

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (!connection) {
            return 'unknown';
        }

        const effectiveType = connection.effectiveType || 'unknown';
        const saveData = connection.saveData || false;

        console.log(`[CurriculumLoader] Network: ${effectiveType}, Save Data: ${saveData}`);

        return saveData ? 'save-data' : effectiveType;
    }

    /**
     * Setup network change listener
     */
    _setupNetworkListener() {
        if (typeof navigator === 'undefined' || !navigator.connection) {
            return;
        }

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (!connection) {
            return;
        }

        connection.addEventListener('change', () => {
            this.networkType = this._detectNetworkType();
            console.log(`[CurriculumLoader] Network changed to: ${this.networkType}`);

            // Clear preload queue on slow network
            if (this.networkType === '2g' || this.networkType === 'slow-2g') {
                this.preloadQueue = [];
                console.log('[CurriculumLoader] Preload queue cleared due to slow network');
            }
        });
    }

    /**
     * Setup memory monitoring
     */
    _setupMemoryMonitoring() {
        // Check if performance.memory is available (Chrome only)
        if (typeof performance === 'undefined' || !performance.memory) {
            return;
        }

        // Monitor memory usage periodically
        setInterval(() => {
            const memory = performance.memory;

            // Calculate memory usage percentage
            const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

            if (usagePercent > 90) {
                this.memoryPressure = 'critical';

                // Aggressive eviction
                if (this.unitCache.size > 2) {
                    console.log('[CurriculumLoader] Critical memory pressure, evicting units');
                    this._evictMultipleUnits(this.unitCache.size - 2);
                }
            } else if (usagePercent > 75) {
                this.memoryPressure = 'moderate';

                // Moderate eviction
                if (this.unitCache.size > 3) {
                    this._evictMultipleUnits(this.unitCache.size - 3);
                }
            } else {
                this.memoryPressure = 'normal';
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Evict multiple units from cache
     */
    _evictMultipleUnits(count) {
        for (let i = 0; i < count; i++) {
            this._evictLRU();
        }
    }

    /**
     * Update load metrics to track preload effectiveness
     */
    _updateLoadMetrics(unitId, wasPreloaded) {
        if (wasPreloaded) {
            this.metrics.preloadHits++;
            console.log(`[CurriculumLoader] Preload hit for unit ${unitId}`);
        }
    }

    /**
     * Get preload statistics
     */
    getPreloadStats() {
        return {
            currentUnit: this.currentUnit,
            queueLength: this.preloadQueue.length,
            preloadHits: this.metrics.preloadHits,
            networkType: this.networkType,
            memoryPressure: this.memoryPressure,
            cacheSize: this.unitCache.size,
            maxCacheSize: this.config.maxMemoryUnits
        };
    }

    /**
     * P9: Load curriculum manifest
     * @returns {Promise<Object>} Manifest object
     */
    async loadManifest() {
        if (this.manifest) return this.manifest;

        try {
            console.log('[CurriculumLoader] Loading manifest...');
            const response = await fetch(this.config.manifestUrl);

            if (!response.ok) {
                throw new Error(`Failed to load manifest: ${response.status}`);
            }

            this.manifest = await response.json();
            console.log(`[CurriculumLoader] Manifest loaded: ${Object.keys(this.manifest.units).length} units`);

            return this.manifest;
        } catch (error) {
            console.error('[CurriculumLoader] Manifest load failed:', error);
            // Fallback: disable chunk loading
            this.config.enableChunkLoading = false;
            return null;
        }
    }

    /**
     * P9: Load a specific curriculum chunk
     * @param {number} unitNum - Unit number (e.g., 1, 2, 3)
     * @returns {Promise<Array>} Unit questions
     */
    async loadChunk(unitNum) {
        const unitKey = `U${unitNum}`;

        // Check if already loaded
        if (this.loadedChunks.has(unitKey)) {
            return window.curriculumChunks?.[unitKey] || null;
        }

        // Check if currently loading
        if (this.chunkLoadPromises.has(unitKey)) {
            return this.chunkLoadPromises.get(unitKey);
        }

        // Start loading
        const loadPromise = this._loadChunkImpl(unitNum);
        this.chunkLoadPromises.set(unitKey, loadPromise);

        try {
            const result = await loadPromise;
            this.loadedChunks.add(unitKey);
            this.chunkLoadPromises.delete(unitKey);
            return result;
        } catch (error) {
            this.chunkLoadPromises.delete(unitKey);
            throw error;
        }
    }

    /**
     * P9: Internal chunk loading implementation
     */
    async _loadChunkImpl(unitNum) {
        const unitKey = `U${unitNum}`;

        // Performance mark
        window.perfMonitor?.mark(`curriculum-chunk-${unitNum}-load-start`, { type: 'curriculum' });

        // Ensure manifest is loaded
        if (!this.manifest) {
            await this.loadManifest();
        }

        if (!this.manifest || !this.manifest.units[unitNum]) {
            throw new Error(`Unit ${unitNum} not found in manifest`);
        }

        const unitInfo = this.manifest.units[unitNum];
        const chunkUrl = `${this.config.chunkBaseUrl}${unitInfo.filename}`;

        console.log(`[CurriculumLoader] Loading chunk for unit ${unitNum}...`);

        // Try dynamic import first (ES modules)
        if (typeof import === 'function') {
            try {
                await import(chunkUrl);
                const data = window.curriculumChunks?.[unitKey];

                if (data) {
                    window.perfMonitor?.mark(`curriculum-chunk-${unitNum}-load-end`, { type: 'curriculum' });
                    console.log(`[CurriculumLoader] Loaded ${unitInfo.questionCount} questions for unit ${unitNum} via import()`);
                    return data;
                }
            } catch (e) {
                console.warn('[CurriculumLoader] Dynamic import failed, falling back to script injection:', e.message);
            }
        }

        // Fallback: Script injection
        await this._loadChunkViaScript(chunkUrl);
        const data = window.curriculumChunks?.[unitKey];

        if (!data) {
            throw new Error(`Failed to load chunk for unit ${unitNum}`);
        }

        window.perfMonitor?.mark(`curriculum-chunk-${unitNum}-load-end`, { type: 'curriculum' });
        console.log(`[CurriculumLoader] Loaded ${unitInfo.questionCount} questions for unit ${unitNum} via script`);

        return data;
    }

    /**
     * P9: Load chunk via script tag injection
     */
    async _loadChunkViaScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;

            script.onload = () => {
                document.head.removeChild(script);
                resolve();
            };

            script.onerror = () => {
                document.head.removeChild(script);
                reject(new Error(`Failed to load script: ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Check if loader supports async loading in this browser
     */
    static supportsAsyncLoading() {
        return typeof fetch !== 'undefined' &&
               typeof Promise !== 'undefined';
    }
}

// Create global instance with feature flag
window.CurriculumLoader = CurriculumLoader;

// Initialize if feature is enabled
if (typeof USE_LAZY_CURRICULUM === 'undefined') {
    window.USE_LAZY_CURRICULUM = true; // Default to enabled
}

console.log('[CurriculumLoader] Module loaded. Feature enabled:', window.USE_LAZY_CURRICULUM);
