/**
 * Session Fallback Module
 * Provides fallback storage options when localStorage is unavailable
 * Hierarchy: localStorage → sessionStorage → memory
 */

(function() {
    'use strict';

    // In-memory storage fallback
    const memoryStorage = {};
    let storageType = 'unknown';
    let storageWarningShown = false;

    /**
     * Test if localStorage is available and working
     * @returns {boolean} - True if localStorage works
     */
    function testLocalStorage() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Test if sessionStorage is available and working
     * @returns {boolean} - True if sessionStorage works
     */
    function testSessionStorage() {
        try {
            const test = '__storage_test__';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Determine which storage type is available
     * @returns {string} - 'localStorage', 'sessionStorage', or 'memory'
     */
    function detectStorageType() {
        if (testLocalStorage()) {
            storageType = 'localStorage';
        } else if (testSessionStorage()) {
            storageType = 'sessionStorage';
        } else {
            storageType = 'memory';
        }

        console.log(`📦 Storage type detected: ${storageType}`);

        // Show warning if not using localStorage
        if (storageType !== 'localStorage' && !storageWarningShown) {
            showStorageWarning();
            storageWarningShown = true;
        }

        return storageType;
    }

    /**
     * Show warning message about storage limitations
     */
    function showStorageWarning() {
        const message = storageType === 'sessionStorage'
            ? '⚠️ LocalStorage unavailable. Using session storage - data will be lost when you close the browser.'
            : '⚠️ Both LocalStorage and SessionStorage unavailable. Using memory storage - data will be lost on page refresh.';

        console.warn(message);

        // Show appropriate notification based on storage type
        if (window.notifications) {
            if (storageType === 'sessionStorage') {
                window.notifications.storage.sessionStorageOnly();
            } else if (storageType === 'memory') {
                window.notifications.storage.memoryOnly();
            }
        } else if (typeof window.showMessage === 'function') {
            // Fallback to showMessage if notifications not loaded yet
            window.showMessage(message, 'warning');
        }

        // Create recovery suggestion
        if (storageType === 'memory') {
            suggestRecoveryOptions();
        }
    }

    /**
     * Suggest recovery options for memory-only storage
     */
    function suggestRecoveryOptions() {
        console.log('💡 Recovery options:');
        console.log('1. Export your data frequently using the Export button');
        console.log('2. Enable cookies/storage for this site in browser settings');
        console.log('3. Use a different browser or incognito mode');
        console.log('4. Connect to cloud sync (Railway/Supabase) if available');
    }

    /**
     * Get item from appropriate storage
     * @param {string} key - Storage key
     * @returns {string|null} - Stored value or null
     */
    function getItem(key) {
        try {
            switch (storageType) {
                case 'localStorage':
                    return localStorage.getItem(key);
                case 'sessionStorage':
                    return sessionStorage.getItem(key);
                case 'memory':
                    return memoryStorage[key] || null;
                default:
                    detectStorageType();
                    return getItem(key);
            }
        } catch (e) {
            console.error('Storage getItem error:', e);
            return memoryStorage[key] || null;
        }
    }

    /**
     * Set item in appropriate storage
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     * @returns {boolean} - True if successful
     */
    function setItem(key, value) {
        try {
            switch (storageType) {
                case 'localStorage':
                    localStorage.setItem(key, value);
                    return true;
                case 'sessionStorage':
                    sessionStorage.setItem(key, value);
                    return true;
                case 'memory':
                    memoryStorage[key] = value;
                    return true;
                default:
                    detectStorageType();
                    return setItem(key, value);
            }
        } catch (e) {
            console.error('Storage setItem error:', e);
            // Fallback to memory
            memoryStorage[key] = value;

            // Check for quota exceeded error
            if (e.name === 'QuotaExceededError') {
                handleQuotaExceeded();
            }
            return false;
        }
    }

    /**
     * Remove item from appropriate storage
     * @param {string} key - Storage key
     * @returns {boolean} - True if successful
     */
    function removeItem(key) {
        try {
            switch (storageType) {
                case 'localStorage':
                    localStorage.removeItem(key);
                    return true;
                case 'sessionStorage':
                    sessionStorage.removeItem(key);
                    return true;
                case 'memory':
                    delete memoryStorage[key];
                    return true;
                default:
                    detectStorageType();
                    return removeItem(key);
            }
        } catch (e) {
            console.error('Storage removeItem error:', e);
            delete memoryStorage[key];
            return false;
        }
    }

    /**
     * Clear all items from appropriate storage
     * @returns {boolean} - True if successful
     */
    function clear() {
        try {
            switch (storageType) {
                case 'localStorage':
                    localStorage.clear();
                    return true;
                case 'sessionStorage':
                    sessionStorage.clear();
                    return true;
                case 'memory':
                    Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
                    return true;
                default:
                    detectStorageType();
                    return clear();
            }
        } catch (e) {
            console.error('Storage clear error:', e);
            Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
            return false;
        }
    }

    /**
     * Get all keys from appropriate storage
     * @returns {Array<string>} - Array of keys
     */
    function getAllKeys() {
        try {
            switch (storageType) {
                case 'localStorage':
                    return Object.keys(localStorage);
                case 'sessionStorage':
                    return Object.keys(sessionStorage);
                case 'memory':
                    return Object.keys(memoryStorage);
                default:
                    detectStorageType();
                    return getAllKeys();
            }
        } catch (e) {
            console.error('Storage getAllKeys error:', e);
            return Object.keys(memoryStorage);
        }
    }

    /**
     * Handle quota exceeded error
     */
    function handleQuotaExceeded() {
        console.error('⚠️ Storage quota exceeded!');

        // Try to clean up old data
        const keysToCheck = ['classData', 'peerData'];
        keysToCheck.forEach(key => {
            const data = getItem(key);
            if (data && data.length > 100000) { // If data is large
                console.log(`Attempting to compress ${key}...`);
                // In a real implementation, you might compress or trim the data
            }
        });

        // Show quota exceeded notification
        if (window.notifications) {
            window.notifications.storage.quotaExceeded();
        } else if (typeof window.showMessage === 'function') {
            window.showMessage('Storage quota exceeded. Please export your data and clear old entries.', 'error');
        }
    }

    /**
     * Create a downloadable backup of all storage
     * @returns {string} - JSON string of all data
     */
    function createBackup() {
        const backup = {};
        const keys = getAllKeys();

        keys.forEach(key => {
            const value = getItem(key);
            if (value) {
                backup[key] = value;
            }
        });

        return JSON.stringify(backup, null, 2);
    }

    /**
     * Restore data from backup
     * @param {string} backupJson - JSON string of backup data
     * @returns {boolean} - True if successful
     */
    function restoreBackup(backupJson) {
        try {
            const backup = JSON.parse(backupJson);

            Object.entries(backup).forEach(([key, value]) => {
                setItem(key, value);
            });

            console.log('✅ Backup restored successfully');
            return true;
        } catch (e) {
            console.error('❌ Failed to restore backup:', e);
            return false;
        }
    }

    /**
     * Get storage usage info
     * @returns {Object} - Storage usage statistics
     */
    function getStorageInfo() {
        const keys = getAllKeys();
        let totalSize = 0;

        keys.forEach(key => {
            const value = getItem(key);
            if (value) {
                totalSize += value.length;
            }
        });

        return {
            type: storageType,
            keyCount: keys.length,
            totalSize: totalSize,
            sizeInKB: Math.round(totalSize / 1024),
            sizeInMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
        };
    }

    // Initialize storage type on load
    detectStorageType();

    // Export to global scope
    window.sessionFallback = {
        getItem,
        setItem,
        removeItem,
        clear,
        getAllKeys,
        getStorageType: () => storageType,
        detectStorageType,
        createBackup,
        restoreBackup,
        getStorageInfo,
        testLocalStorage,
        testSessionStorage
    };

    console.log('✅ Session Fallback module loaded');
    console.log(`📦 Current storage type: ${storageType}`);

})();