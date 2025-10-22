/**
 * offline_queue.js - Offline Operation Queue Manager
 * Part of AP Statistics Consensus Quiz
 *
 * Manages queued operations when offline, stores in IndexedDB for persistence.
 */

class OfflineQueue {
    constructor() {
        this.dbName = 'APStatsOfflineQueue';
        this.storeName = 'operations';
        this.db = null;
        this.maxSize = 100; // Max operations to store
    }

    /**
     * Initialize IndexedDB
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[OfflineQueue] Initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // Index by timestamp for ordering
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    /**
     * Add operation to queue
     * @param {Object} operation - Operation to queue
     * @returns {Promise<number>} Operation ID
     */
    async enqueue(operation) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        // Check size limit
        const currentSize = await this.size();
        if (currentSize >= this.maxSize) {
            console.warn('[OfflineQueue] Queue full, removing oldest');
            await this._removeOldest();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const request = store.add({
                ...operation,
                queuedAt: Date.now()
            });

            request.onsuccess = () => {
                console.log('[OfflineQueue] Operation queued:', request.result);
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all operations
     * @returns {Promise<Array>} All queued operations
     */
    async getAll() {
        if (!this.db) {
            return [];
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove operation by ID
     * @param {number} id - Operation ID
     * @returns {Promise<void>}
     */
    async remove(id) {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('[OfflineQueue] Operation removed:', id);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all operations
     * @returns {Promise<void>}
     */
    async clear() {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[OfflineQueue] Queue cleared');
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get queue size
     * @returns {Promise<number>} Number of operations in queue
     */
    async size() {
        if (!this.db) {
            return 0;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove oldest operation (for size management)
     */
    async _removeOldest() {
        if (!this.db) {
            return;
        }

        const operations = await this.getAll();
        if (operations.length === 0) return;

        // Sort by queuedAt timestamp
        operations.sort((a, b) => a.queuedAt - b.queuedAt);

        // Remove the oldest
        await this.remove(operations[0].id);
    }

    /**
     * Get operations by type
     * @param {string} type - Operation type
     * @returns {Promise<Array>} Matching operations
     */
    async getByType(type) {
        if (!this.db) {
            return [];
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('type');
            const request = index.getAll(type);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Export for use in progress_sync.js
window.OfflineQueue = OfflineQueue;

console.log('[OfflineQueue] Module loaded');
