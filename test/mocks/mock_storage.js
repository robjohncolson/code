/**
 * mock_storage.js - Mock localStorage Implementation
 * Provides isolated localStorage for testing
 */

class MockStorage {
    constructor() {
        this._storage = {};
        this._quotaBytes = 5 * 1024 * 1024; // 5MB quota
        this._usedBytes = 0;
    }

    getItem(key) {
        return this._storage[key] || null;
    }

    setItem(key, value) {
        const valueStr = String(value);
        const oldSize = this._storage[key] ? this._storage[key].length : 0;
        const newSize = valueStr.length;
        const sizeDelta = newSize - oldSize;

        // Simulate quota exceeded
        if (this._usedBytes + sizeDelta > this._quotaBytes) {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }

        this._storage[key] = valueStr;
        this._usedBytes += sizeDelta;
    }

    removeItem(key) {
        if (this._storage[key]) {
            this._usedBytes -= this._storage[key].length;
            delete this._storage[key];
        }
    }

    clear() {
        this._storage = {};
        this._usedBytes = 0;
    }

    key(index) {
        const keys = Object.keys(this._storage);
        return keys[index] || null;
    }

    get length() {
        return Object.keys(this._storage).length;
    }

    // Test utilities
    getStorageSize() {
        return this._usedBytes;
    }

    setQuota(bytes) {
        this._quotaBytes = bytes;
    }

    getAllKeys() {
        return Object.keys(this._storage);
    }

    getAllData() {
        return { ...this._storage };
    }
}

// Global mock storage instance
window.MockStorage = MockStorage;

// Helper to replace global localStorage
window.TestUtils = window.TestUtils || {};
window.TestUtils.mockLocalStorage = function() {
    const originalLocalStorage = window.localStorage;
    const mockStorage = new MockStorage();

    // Replace global localStorage
    Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true
    });

    return {
        mock: mockStorage,
        restore() {
            Object.defineProperty(window, 'localStorage', {
                value: originalLocalStorage,
                writable: true,
                configurable: true
            });
        }
    };
};
