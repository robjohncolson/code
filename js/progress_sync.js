/**
 * progress_sync.js - Progress Synchronization Engine
 * Part of AP Statistics Consensus Quiz
 *
 * Handles client → API → database roundtrip for saving and loading user progress.
 * Features: debouncing, retry logic, offline queue, conflict resolution.
 */

class ProgressSync {
    constructor() {
        // Configuration
        this.config = {
            enabled: true,
            autoSync: true,
            saveDebounceMs: 500,      // Debounce individual saves
            batchWindowMs: 2000,       // Batch window for multiple saves
            syncIntervalMs: 30000,     // Periodic sync interval
            retryAttempts: 3,          // Max retry attempts
            retryDelayMs: 1000,        // Initial retry delay
            maxQueueSize: 100          // Max offline queue size
        };

        // State
        this.initialized = false;
        this.syncing = false;
        this.lastSyncTime = null;
        this.syncTimer = null;

        // Debounce timers
        this.saveTimers = new Map(); // questionId -> timer
        this.batchTimer = null;
        this.pendingBatch = [];

        // Statistics
        this.stats = {
            saveAttempts: 0,
            saveSuccess: 0,
            saveFailed: 0,
            loadAttempts: 0,
            loadSuccess: 0,
            retries: 0,
            queuedOperations: 0
        };

        // Bind methods
        this.saveProgress = this.saveProgress.bind(this);
        this.loadAllProgress = this.loadAllProgress.bind(this);
        this.startPeriodicSync = this.startPeriodicSync.bind(this);
    }

    /**
     * Initialize sync engine
     */
    async initialize() {
        if (this.initialized) return;

        console.log('[ProgressSync] Initializing...');

        // Check if auth is available
        if (!window.sessionManager) {
            console.warn('[ProgressSync] SessionManager not available, disabling sync');
            this.config.enabled = false;
            return false;
        }

        // Check if offline queue exists
        if (typeof OfflineQueue !== 'undefined') {
            this.offlineQueue = new OfflineQueue();
            await this.offlineQueue.initialize();
        }

        this.initialized = true;

        // Start periodic sync if auto-sync is enabled
        if (this.config.autoSync) {
            this.startPeriodicSync();
        }

        // Process offline queue
        this.processOfflineQueue();

        console.log('[ProgressSync] Initialized successfully');
        return true;
    }

    /**
     * Save progress for a question
     * @param {string} questionId - Question ID
     * @param {string} answer - User's answer
     * @param {string} reason - User's reasoning (optional)
     * @param {number} attempt - Attempt number
     * @returns {Promise<boolean>} Success status
     */
    async saveProgress(questionId, answer, reason = '', attempt = 1) {
        if (!this.config.enabled) {
            console.log('[ProgressSync] Sync disabled, skipping save');
            return true;
        }

        performance.mark(`progress-save-${questionId}-start`);

        // Optimistic update - save to localStorage immediately
        this._optimisticUpdate(questionId, answer, reason, attempt);

        // Debounce the API call
        this._debouncedSave(questionId, answer, reason, attempt);

        return true;
    }

    /**
     * Optimistic update to localStorage
     */
    _optimisticUpdate(questionId, answer, reason, attempt) {
        if (!window.classData || !window.currentUsername) {
            return;
        }

        const userData = window.classData.users[window.currentUsername];
        if (!userData) return;

        // Update local state immediately
        userData.answers[questionId] = {
            value: answer,
            timestamp: Date.now()
        };

        if (reason) {
            userData.reasons[questionId] = reason;
        }

        userData.attempts[questionId] = attempt;
        userData.timestamps[questionId] = Date.now();

        // Save to localStorage
        if (typeof saveClassData === 'function') {
            saveClassData();
        }

        console.log(`[ProgressSync] Optimistic update for ${questionId}`);
    }

    /**
     * Debounced save to API (with batching)
     */
    _debouncedSave(questionId, answer, reason, attempt) {
        // Clear existing timer for this question
        if (this.saveTimers.has(questionId)) {
            clearTimeout(this.saveTimers.get(questionId));
        }

        // Add to pending batch
        this.pendingBatch.push({
            question_id: questionId,
            answer: answer,
            reason: reason || null,
            attempt: attempt,
            timestamp: new Date().toISOString()
        });

        // Remove duplicates (keep latest)
        const seen = new Set();
        this.pendingBatch = this.pendingBatch.reverse().filter(item => {
            if (seen.has(item.question_id)) {
                return false;
            }
            seen.add(item.question_id);
            return true;
        }).reverse();

        // Clear existing batch timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        // If batch is large enough or timeout reached, process immediately
        if (this.pendingBatch.length >= 10) {
            this._processBatch();
        } else {
            // Otherwise wait for batch window
            this.batchTimer = setTimeout(() => {
                this._processBatch();
            }, this.config.batchWindowMs);
        }
    }

    /**
     * Process pending batch
     */
    async _processBatch() {
        if (this.pendingBatch.length === 0) {
            return;
        }

        const batch = [...this.pendingBatch];
        this.pendingBatch = [];

        console.log(`[ProgressSync] Processing batch of ${batch.length} operations`);

        // Emit batch start event
        this._emit('progressSyncBatchStart', { total: batch.length });

        try {
            // Check if online
            if (!navigator.onLine) {
                console.log('[ProgressSync] Offline, queuing batch');
                for (const item of batch) {
                    await this._queueOperation('save', item);
                }
                return;
            }

            // Get JWT token
            const token = window.sessionManager?.getToken();
            if (!token) {
                console.warn('[ProgressSync] No auth token, queuing batch');
                for (const item of batch) {
                    await this._queueOperation('save', item);
                }
                return;
            }

            // Make batch API call
            await this._apiBatchSave(token, batch);

            // Emit batch complete event
            this._emit('progressSyncBatchComplete', { total: batch.length });

        } catch (error) {
            console.error('[ProgressSync] Batch save failed:', error);

            // Emit error event
            this._emit('progressSyncError', { error: error.message, count: batch.length });

            // Queue all items
            for (const item of batch) {
                await this._queueOperation('save', item);
            }
        }
    }

    /**
     * Make batch API call
     */
    async _apiBatchSave(token, operations) {
        const railwayUrl = window.RAILWAY_SERVER_URL ||
                          (window.railway_config && window.railway_config.RAILWAY_SERVER_URL);

        if (!railwayUrl) {
            console.warn('[ProgressSync] No Railway server URL configured');
            throw new Error('No Railway server URL');
        }

        // Emit sync start event
        this._emit('progressSyncStart', { count: operations.length });

        const response = await fetch(`${railwayUrl}/api/progress/batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                operations: operations.map(op => ({
                    type: 'save',
                    data: op
                }))
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[ProgressSync] Batch save successful:', result);

        // Emit sync success event
        this._emit('progressSyncSuccess', { count: result.results.length });

        // Don't show toast - let UI handle it via events

        return true;
    }

    /**
     * Execute the actual save operation
     */
    async _executeSave(questionId, answer, reason, attempt) {
        this.stats.saveAttempts++;

        const progressData = {
            question_id: questionId,
            answer: answer,
            reason: reason || null,
            attempt: attempt,
            timestamp: new Date().toISOString()
        };

        try {
            // Check if online
            if (!navigator.onLine) {
                console.log('[ProgressSync] Offline, queuing operation');
                await this._queueOperation('save', progressData);
                return;
            }

            // Get JWT token
            const token = window.sessionManager?.getToken();
            if (!token) {
                console.warn('[ProgressSync] No auth token, queuing operation');
                await this._queueOperation('save', progressData);
                return;
            }

            // Make API call with retry
            const success = await this._retryWithBackoff(async () => {
                return await this._apiSave(token, progressData);
            });

            if (success) {
                this.stats.saveSuccess++;
                this._showSuccessToast('Progress saved');

                performance.mark(`progress-save-${questionId}-end`);
                performance.measure(
                    `progress-save-${questionId}`,
                    `progress-save-${questionId}-start`,
                    `progress-save-${questionId}-end`
                );
            } else {
                throw new Error('Save failed after retries');
            }

        } catch (error) {
            console.error('[ProgressSync] Save failed:', error);
            this.stats.saveFailed++;

            // Queue for later
            await this._queueOperation('save', progressData);
            this._showErrorToast('Progress saved locally (will sync when online)');
        }
    }

    /**
     * Make API call to save progress
     */
    async _apiSave(token, progressData) {
        const railwayUrl = window.RAILWAY_SERVER_URL ||
                          (window.railway_config && window.railway_config.RAILWAY_SERVER_URL);

        if (!railwayUrl) {
            console.warn('[ProgressSync] No Railway server URL configured');
            return false;
        }

        const response = await fetch(`${railwayUrl}/api/progress`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(progressData)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[ProgressSync] Save successful:', result);
        return true;
    }

    /**
     * Load all progress from API
     * @param {string} since - ISO timestamp to load changes since (optional)
     * @returns {Promise<Object>} Progress data
     */
    async loadAllProgress(since = null) {
        if (!this.config.enabled) {
            console.log('[ProgressSync] Sync disabled, skipping load');
            return null;
        }

        this.stats.loadAttempts++;
        performance.mark('progress-load-start');

        try {
            // Check if online
            if (!navigator.onLine) {
                console.log('[ProgressSync] Offline, cannot load');
                return null;
            }

            // Get JWT token
            const token = window.sessionManager?.getToken();
            if (!token) {
                console.warn('[ProgressSync] No auth token, cannot load');
                return null;
            }

            // Make API call
            const railwayUrl = window.RAILWAY_SERVER_URL ||
                              (window.railway_config && window.railway_config.RAILWAY_SERVER_URL);

            if (!railwayUrl) {
                console.warn('[ProgressSync] No Railway server URL configured');
                return null;
            }

            const url = new URL(`${railwayUrl}/api/progress`);
            if (since) {
                url.searchParams.set('since', since);
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[ProgressSync] Load successful:', result);

            this.stats.loadSuccess++;
            this.lastSyncTime = new Date().toISOString();

            performance.mark('progress-load-end');
            performance.measure('progress-load', 'progress-load-start', 'progress-load-end');

            // Merge with local state
            if (result.progress && Array.isArray(result.progress)) {
                this._mergeProgress(result.progress);
            }

            return result;

        } catch (error) {
            console.error('[ProgressSync] Load failed:', error);
            return null;
        }
    }

    /**
     * Merge remote progress with local state
     * @param {Array} remoteProgress - Progress items from API
     */
    _mergeProgress(remoteProgress) {
        if (!window.classData || !window.currentUsername) {
            return;
        }

        const userData = window.classData.users[window.currentUsername];
        if (!userData) return;

        let mergeCount = 0;
        let conflictCount = 0;

        remoteProgress.forEach(item => {
            const questionId = item.question_id;
            const remoteTimestamp = new Date(item.timestamp).getTime();

            // Get local timestamp
            const localTimestamp = userData.timestamps[questionId] || 0;

            // Conflict resolution: last-write-wins
            if (remoteTimestamp > localTimestamp) {
                // Remote is newer, update local
                userData.answers[questionId] = {
                    value: item.answer,
                    timestamp: remoteTimestamp
                };

                if (item.reason) {
                    userData.reasons[questionId] = item.reason;
                }

                userData.attempts[questionId] = item.attempt || 1;
                userData.timestamps[questionId] = remoteTimestamp;

                mergeCount++;

                if (localTimestamp > 0) {
                    conflictCount++;
                    console.log(`[ProgressSync] Conflict resolved for ${questionId}: remote wins`);
                }
            } else {
                // Local is newer or same, keep local
                console.log(`[ProgressSync] Keeping local version for ${questionId}`);
            }
        });

        // Save merged data to localStorage
        if (mergeCount > 0) {
            if (typeof saveClassData === 'function') {
                saveClassData();
            }

            console.log(`[ProgressSync] Merged ${mergeCount} items (${conflictCount} conflicts resolved)`);

            // Update UI if needed
            if (typeof updateCurrentUsernameDisplay === 'function') {
                updateCurrentUsernameDisplay();
            }
        }
    }

    /**
     * Start periodic sync
     */
    startPeriodicSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(() => {
            if (this.config.enabled && this.config.autoSync && !this.syncing) {
                this._periodicSync();
            }
        }, this.config.syncIntervalMs);

        console.log('[ProgressSync] Periodic sync started (interval: ${this.config.syncIntervalMs}ms)');
    }

    /**
     * Stop periodic sync
     */
    stopPeriodicSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('[ProgressSync] Periodic sync stopped');
        }
    }

    /**
     * Execute periodic sync
     */
    async _periodicSync() {
        if (this.syncing) return;

        this.syncing = true;

        try {
            // Load changes since last sync
            const result = await this.loadAllProgress(this.lastSyncTime);

            if (result) {
                console.log('[ProgressSync] Periodic sync completed');
            }

        } catch (error) {
            console.error('[ProgressSync] Periodic sync error:', error);
        } finally {
            this.syncing = false;
        }
    }

    /**
     * Retry with exponential backoff
     */
    async _retryWithBackoff(fn, maxAttempts = this.config.retryAttempts) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                return await fn();
            } catch (error) {
                this.stats.retries++;

                if (i === maxAttempts - 1) {
                    throw error;
                }

                const delay = this.config.retryDelayMs * Math.pow(2, i);
                console.log(`[ProgressSync] Retry ${i + 1}/${maxAttempts} after ${delay}ms`);
                await this._sleep(delay);
            }
        }
    }

    /**
     * Queue operation for offline mode
     */
    async _queueOperation(type, data) {
        if (this.offlineQueue) {
            await this.offlineQueue.enqueue({ type, data, timestamp: Date.now() });
            this.stats.queuedOperations++;
            console.log('[ProgressSync] Operation queued:', type);

            // Emit offline queued event
            this._emit('progressSyncOfflineQueued', { type, questionId: data.question_id });
        } else {
            console.warn('[ProgressSync] No offline queue available');
        }
    }

    /**
     * Process offline queue
     */
    async processOfflineQueue() {
        if (!this.offlineQueue) return;

        const operations = await this.offlineQueue.getAll();

        if (operations.length === 0) {
            return;
        }

        console.log(`[ProgressSync] Processing ${operations.length} queued operations`);

        for (const op of operations) {
            try {
                if (op.type === 'save') {
                    const token = window.sessionManager?.getToken();
                    if (token) {
                        await this._apiSave(token, op.data);
                        await this.offlineQueue.remove(op.id);
                        console.log('[ProgressSync] Queued operation processed:', op.id);
                    }
                }
            } catch (error) {
                console.error('[ProgressSync] Failed to process queued operation:', error);
            }
        }

        this._showSuccessToast('Offline changes synced');
    }

    /**
     * Manual sync trigger
     */
    async manualSync() {
        console.log('[ProgressSync] Manual sync triggered');

        // Flush any pending batch first
        await this._processBatch();

        // Process offline queue
        await this.processOfflineQueue();

        // Load latest progress
        await this.loadAllProgress();

        this._showSuccessToast('Sync complete');
    }

    /**
     * Flush pending operations (call before page unload)
     */
    async flush() {
        console.log('[ProgressSync] Flushing pending operations');

        // Process pending batch
        if (this.pendingBatch.length > 0) {
            await this._processBatch();
        }

        // Clear timers
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        this.saveTimers.forEach(timer => clearTimeout(timer));
        this.saveTimers.clear();
    }

    /**
     * Get sync statistics
     */
    getStats() {
        return {
            ...this.stats,
            lastSyncTime: this.lastSyncTime,
            queueSize: this.offlineQueue ? this.offlineQueue.size() : 0,
            syncing: this.syncing
        };
    }

    /**
     * Helper: sleep
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Helper: emit custom event for UI
     */
    _emit(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
    }

    /**
     * Helper: show success toast
     */
    _showSuccessToast(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'success', 2000);
        }
    }

    /**
     * Helper: show error toast
     */
    _showErrorToast(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'warning', 4000);
        }
    }
}

// Create global instance
window.ProgressSync = ProgressSync;

// Initialize automatically if sessionManager is available
if (typeof window.sessionManager !== 'undefined' && window.sessionManager.isAuthenticated) {
    window.progressSync = new ProgressSync();
    window.progressSync.initialize();
}

// Flush pending operations on page unload
window.addEventListener('beforeunload', () => {
    if (window.progressSync) {
        // Use sendBeacon for best-effort delivery
        window.progressSync.flush();
    }
});

console.log('[ProgressSync] Module loaded');
