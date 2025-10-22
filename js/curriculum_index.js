/**
 * curriculum_index.js - Curriculum Indexing & Query Engine
 * Part of AP Statistics Consensus Quiz
 *
 * Provides O(1) question lookups and efficient search capabilities
 */

class CurriculumIndex {
    constructor() {
        this.initialized = false;

        // Primary index: questionId -> metadata
        this.questionIndex = new Map(); // O(1) lookups

        // Secondary indexes for fast queries
        this.unitIndex = new Map(); // unitId -> question IDs
        this.lessonIndex = new Map(); // lessonId -> question IDs
        this.typeIndex = new Map(); // question type -> question IDs

        // Search index (simplified inverted index)
        this.searchIndex = new Map(); // word -> question IDs

        // Tags index
        this.tagIndex = new Map(); // tag -> question IDs

        // Statistics
        this.stats = {
            totalQuestions: 0,
            totalUnits: 0,
            totalLessons: 0,
            indexSize: 0
        };
    }

    /**
     * Build index from curriculum data
     * @param {Array} questions - Array of all questions
     * @returns {Promise<void>}
     */
    async buildIndex(questions) {
        performance.mark('index-build-start');
        console.log('[CurriculumIndex] Building index...');

        this.questionIndex.clear();
        this.unitIndex.clear();
        this.lessonIndex.clear();
        this.typeIndex.clear();
        this.searchIndex.clear();
        this.tagIndex.clear();

        const units = new Set();
        const lessons = new Set();

        // Build indexes
        questions.forEach((question, index) => {
            const questionId = question.id;

            // Parse question ID for unit and lesson
            const match = questionId.match(/U(\d+)-L(\d+)-Q(\d+)/i);
            if (!match) {
                console.warn(`[CurriculumIndex] Invalid question ID format: ${questionId}`);
                return;
            }

            const unitId = parseInt(match[1]);
            const lessonId = parseInt(match[2]);
            const questionNum = parseInt(match[3]);

            units.add(unitId);
            lessons.add(`${unitId}-${lessonId}`);

            // Primary index entry
            const metadata = {
                questionId,
                unitId,
                lessonId,
                questionNum,
                type: question.type || 'unknown',
                arrayIndex: index,
                prompt: question.prompt || '',
                tags: question.tags || []
            };

            this.questionIndex.set(questionId, metadata);

            // Unit index
            if (!this.unitIndex.has(unitId)) {
                this.unitIndex.set(unitId, []);
            }
            this.unitIndex.get(unitId).push(questionId);

            // Lesson index
            const lessonKey = `U${unitId}-L${lessonId}`;
            if (!this.lessonIndex.has(lessonKey)) {
                this.lessonIndex.set(lessonKey, []);
            }
            this.lessonIndex.get(lessonKey).push(questionId);

            // Type index
            const type = question.type || 'unknown';
            if (!this.typeIndex.has(type)) {
                this.typeIndex.set(type, []);
            }
            this.typeIndex.get(type).push(questionId);

            // Search index (tokenize prompt)
            this._indexText(questionId, question.prompt || '');

            // Tags index
            if (question.tags && Array.isArray(question.tags)) {
                question.tags.forEach(tag => {
                    if (!this.tagIndex.has(tag)) {
                        this.tagIndex.set(tag, []);
                    }
                    this.tagIndex.get(tag).push(questionId);
                });
            }
        });

        // Update statistics
        this.stats.totalQuestions = questions.length;
        this.stats.totalUnits = units.size;
        this.stats.totalLessons = lessons.size;
        this.stats.indexSize = this._calculateIndexSize();

        this.initialized = true;

        performance.mark('index-build-end');
        performance.measure('index-build', 'index-build-start', 'index-build-end');

        const measure = performance.getEntriesByName('index-build')[0];
        console.log(`[CurriculumIndex] Index built in ${measure.duration.toFixed(2)}ms`);
        console.log(`[CurriculumIndex] Indexed ${this.stats.totalQuestions} questions`);
        console.log(`[CurriculumIndex] Index size: ~${(this.stats.indexSize / 1024).toFixed(2)}KB`);

        // Cache index to IndexedDB
        await this._saveIndexToCache();
    }

    /**
     * Index text for search (tokenize and store)
     */
    _indexText(questionId, text) {
        // Simple tokenization: lowercase, split on non-word chars, filter short words
        const tokens = text
            .toLowerCase()
            .split(/\W+/)
            .filter(word => word.length >= 3); // Ignore very short words

        tokens.forEach(token => {
            if (!this.searchIndex.has(token)) {
                this.searchIndex.set(token, new Set());
            }
            this.searchIndex.get(token).add(questionId);
        });
    }

    /**
     * Search questions by text query
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Array of question IDs matching the query
     */
    search(query, options = {}) {
        performance.mark('index-search-start');

        const {
            limit = 100,
            offset = 0,
            unitFilter = null,
            typeFilter = null
        } = options;

        // Tokenize query
        const queryTokens = query
            .toLowerCase()
            .split(/\W+/)
            .filter(word => word.length >= 3);

        if (queryTokens.length === 0) {
            return [];
        }

        // Find questions that match all tokens (AND search)
        let matches = null;

        queryTokens.forEach(token => {
            const tokenMatches = this.searchIndex.get(token);

            if (!tokenMatches) {
                // No matches for this token, so no overall matches
                matches = new Set();
                return;
            }

            if (matches === null) {
                // First token
                matches = new Set(tokenMatches);
            } else {
                // Intersection with previous matches
                matches = new Set([...matches].filter(id => tokenMatches.has(id)));
            }
        });

        if (!matches || matches.size === 0) {
            return [];
        }

        // Convert to array and apply filters
        let results = Array.from(matches);

        // Apply unit filter
        if (unitFilter !== null) {
            results = results.filter(questionId => {
                const metadata = this.questionIndex.get(questionId);
                return metadata && metadata.unitId === unitFilter;
            });
        }

        // Apply type filter
        if (typeFilter !== null) {
            results = results.filter(questionId => {
                const metadata = this.questionIndex.get(questionId);
                return metadata && metadata.type === typeFilter;
            });
        }

        // Sort by question ID for consistent ordering
        results.sort();

        // Apply pagination
        const paginated = results.slice(offset, offset + limit);

        performance.mark('index-search-end');
        performance.measure('index-search', 'index-search-start', 'index-search-end');

        const measure = performance.getEntriesByName('index-search')[0];
        console.log(`[CurriculumIndex] Search completed in ${measure.duration.toFixed(2)}ms (${paginated.length} results)`);

        return paginated;
    }

    /**
     * Get questions by tags
     * @param {Array|string} tags - Tag or array of tags
     * @param {Object} options - Query options
     * @returns {Array} Array of question IDs
     */
    getQuestionsByTags(tags, options = {}) {
        const {
            matchAll = false, // If true, question must have all tags
            limit = 100,
            offset = 0
        } = options;

        const tagArray = Array.isArray(tags) ? tags : [tags];

        if (tagArray.length === 0) {
            return [];
        }

        let matches = null;

        tagArray.forEach(tag => {
            const tagMatches = this.tagIndex.get(tag);

            if (!tagMatches) {
                if (matchAll) {
                    matches = [];
                }
                return;
            }

            if (matches === null) {
                matches = new Set(tagMatches);
            } else if (matchAll) {
                // Intersection (AND)
                matches = new Set([...matches].filter(id => tagMatches.includes(id)));
            } else {
                // Union (OR)
                tagMatches.forEach(id => matches.add(id));
            }
        });

        if (!matches || matches.size === 0) {
            return [];
        }

        const results = Array.from(matches).sort();
        return results.slice(offset, offset + limit);
    }

    /**
     * Get question metadata by ID (O(1) lookup)
     * @param {string} questionId - Question ID
     * @returns {Object|null} Question metadata or null
     */
    getQuestionMetadata(questionId) {
        return this.questionIndex.get(questionId) || null;
    }

    /**
     * Get all questions for a unit
     * @param {number} unitId - Unit number
     * @returns {Array} Array of question IDs
     */
    getUnitQuestions(unitId) {
        return this.unitIndex.get(unitId) || [];
    }

    /**
     * Get all questions for a lesson
     * @param {number} unitId - Unit number
     * @param {number} lessonId - Lesson number
     * @returns {Array} Array of question IDs
     */
    getLessonQuestions(unitId, lessonId) {
        const lessonKey = `U${unitId}-L${lessonId}`;
        return this.lessonIndex.get(lessonKey) || [];
    }

    /**
     * Get questions by type
     * @param {string} type - Question type (e.g., 'multiple-choice', 'free-response')
     * @returns {Array} Array of question IDs
     */
    getQuestionsByType(type) {
        return this.typeIndex.get(type) || [];
    }

    /**
     * Get index statistics
     * @returns {Object} Index statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheStatus: this.initialized ? 'ready' : 'not_initialized'
        };
    }

    /**
     * Calculate approximate index size in bytes
     */
    _calculateIndexSize() {
        // Rough estimation
        let size = 0;

        // Question index
        this.questionIndex.forEach((metadata, key) => {
            size += key.length * 2; // String key
            size += JSON.stringify(metadata).length * 2; // Metadata object
        });

        // Other indexes
        size += this.unitIndex.size * 100;
        size += this.lessonIndex.size * 100;
        size += this.typeIndex.size * 100;
        size += this.tagIndex.size * 100;

        // Search index
        this.searchIndex.forEach((questionIds, word) => {
            size += word.length * 2;
            size += questionIds.size * 20; // Rough estimate for Set
        });

        return size;
    }

    /**
     * Save index to IndexedDB cache
     */
    async _saveIndexToCache() {
        try {
            const db = await this._openIndexedDB();

            // Convert Maps and Sets to serializable format
            const indexData = {
                questionIndex: Array.from(this.questionIndex.entries()),
                unitIndex: Array.from(this.unitIndex.entries()),
                lessonIndex: Array.from(this.lessonIndex.entries()),
                typeIndex: Array.from(this.typeIndex.entries()),
                tagIndex: Array.from(this.tagIndex.entries()),
                // Search index with Sets converted to arrays
                searchIndex: Array.from(this.searchIndex.entries()).map(([word, ids]) => [
                    word,
                    Array.from(ids)
                ]),
                stats: this.stats,
                timestamp: Date.now()
            };

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['index'], 'readwrite');
                const store = transaction.objectStore('index');

                const request = store.put({
                    id: 'curriculum_index',
                    data: indexData
                });

                request.onsuccess = () => {
                    console.log('[CurriculumIndex] Index cached to IndexedDB');
                    resolve();
                };

                request.onerror = () => reject(request.error);
            });

        } catch (error) {
            console.warn('[CurriculumIndex] Failed to cache index:', error);
        }
    }

    /**
     * Load index from IndexedDB cache
     */
    async loadFromCache(maxAge = 7 * 24 * 60 * 60 * 1000) {
        try {
            const db = await this._openIndexedDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['index'], 'readonly');
                const store = transaction.objectStore('index');
                const request = store.get('curriculum_index');

                request.onsuccess = () => {
                    const result = request.result;

                    if (!result) {
                        resolve(false);
                        return;
                    }

                    // Check if cache is too old
                    const age = Date.now() - result.data.timestamp;
                    if (age > maxAge) {
                        console.log('[CurriculumIndex] Cached index expired');
                        resolve(false);
                        return;
                    }

                    // Restore indexes from cached data
                    const data = result.data;

                    this.questionIndex = new Map(data.questionIndex);
                    this.unitIndex = new Map(data.unitIndex);
                    this.lessonIndex = new Map(data.lessonIndex);
                    this.typeIndex = new Map(data.typeIndex);
                    this.tagIndex = new Map(data.tagIndex);

                    // Restore search index with Sets
                    this.searchIndex = new Map(
                        data.searchIndex.map(([word, ids]) => [word, new Set(ids)])
                    );

                    this.stats = data.stats;
                    this.initialized = true;

                    console.log('[CurriculumIndex] Index loaded from cache');
                    console.log(`[CurriculumIndex] ${this.stats.totalQuestions} questions indexed`);

                    resolve(true);
                };

                request.onerror = () => reject(request.error);
            });

        } catch (error) {
            console.warn('[CurriculumIndex] Failed to load index from cache:', error);
            return false;
        }
    }

    /**
     * Open IndexedDB connection
     */
    _openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('APStatsCurriculum', 2);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('curriculum')) {
                    db.createObjectStore('curriculum', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('index')) {
                    db.createObjectStore('index', { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Clear index cache
     */
    async clearCache() {
        try {
            const db = await this._openIndexedDB();
            const transaction = db.transaction(['index'], 'readwrite');
            const store = transaction.objectStore('index');
            await store.clear();
            console.log('[CurriculumIndex] Index cache cleared');
        } catch (error) {
            console.warn('[CurriculumIndex] Failed to clear index cache:', error);
        }
    }
}

// Export for use in curriculum_loader.js
window.CurriculumIndex = CurriculumIndex;

console.log('[CurriculumIndex] Module loaded');
