/**
 * test_utils.js - Test Utilities
 * Common utilities for browser-based testing
 */

window.TestUtils = {
    /**
     * Create a deep clone of an object (for test isolation)
     */
    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Wait for async operation
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Assert array equality (order matters)
     */
    assertArrayEqual(actual, expected, message) {
        QUnit.assert.deepEqual(actual, expected, message);
    },

    /**
     * Assert array contains (order doesn't matter)
     */
    assertArrayContains(actual, expected, message) {
        const actualSet = new Set(actual);
        const allPresent = expected.every(item => actualSet.has(item));
        QUnit.assert.ok(allPresent, message || 'Array contains all expected items');
    },

    /**
     * Assert object has keys
     */
    assertHasKeys(obj, keys, message) {
        const objKeys = Object.keys(obj);
        const hasAll = keys.every(key => objKeys.includes(key));
        QUnit.assert.ok(hasAll, message || `Object has keys: ${keys.join(', ')}`);
    },

    /**
     * Assert date is recent (within N seconds)
     */
    assertDateRecent(dateStr, withinSeconds = 60, message) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = Math.abs(now - date);
        const diffSec = diffMs / 1000;
        QUnit.assert.ok(
            diffSec <= withinSeconds,
            message || `Date is within ${withinSeconds}s (actual: ${diffSec.toFixed(1)}s)`
        );
    },

    /**
     * Generate mock progress data
     */
    generateMockProgressData(options = {}) {
        const {
            questionCount = 10,
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            endDate = new Date(),
            units = [1, 2, 3]
        } = options;

        const data = [];
        const msPerQuestion = (endDate - startDate) / questionCount;

        for (let i = 0; i < questionCount; i++) {
            const timestamp = new Date(startDate.getTime() + i * msPerQuestion);
            const unit = units[i % units.length];
            const lesson = Math.floor(i / 3) + 1;

            data.push({
                questionId: `U${unit}-L${lesson}-Q${String(i + 1).padStart(2, '0')}`,
                timestamp: timestamp.toISOString(),
                correct: Math.random() > 0.3, // 70% correct
                attempts: Math.floor(Math.random() * 3) + 1,
                timeSpent: Math.floor(Math.random() * 120) + 30 // 30-150 seconds
            });
        }

        return data;
    },

    /**
     * Generate mock Chart.js dataset
     */
    generateMockChartData(type = 'bar') {
        const templates = {
            bar: {
                labels: ['Unit 1', 'Unit 2', 'Unit 3'],
                datasets: [{
                    label: 'Test Data',
                    data: [10, 20, 15],
                    backgroundColor: '#4CAF50'
                }]
            },
            line: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                datasets: [{
                    label: 'Activity',
                    data: [5, 10, 8, 12, 7],
                    borderColor: '#2196F3',
                    fill: false
                }]
            }
        };

        return templates[type] || templates.bar;
    },

    /**
     * Mock localStorage for isolated tests
     */
    createMockStorage() {
        const storage = {};

        return {
            getItem(key) {
                return storage[key] || null;
            },
            setItem(key, value) {
                storage[key] = String(value);
            },
            removeItem(key) {
                delete storage[key];
            },
            clear() {
                Object.keys(storage).forEach(key => delete storage[key]);
            },
            get length() {
                return Object.keys(storage).length;
            },
            key(index) {
                const keys = Object.keys(storage);
                return keys[index] || null;
            }
        };
    },

    /**
     * Create test canvas context
     */
    createMockCanvasContext() {
        const calls = [];

        const mockContext = {
            fillRect: (...args) => calls.push(['fillRect', args]),
            strokeRect: (...args) => calls.push(['strokeRect', args]),
            clearRect: (...args) => calls.push(['clearRect', args]),
            fillText: (...args) => calls.push(['fillText', args]),
            beginPath: () => calls.push(['beginPath']),
            closePath: () => calls.push(['closePath']),
            moveTo: (...args) => calls.push(['moveTo', args]),
            lineTo: (...args) => calls.push(['lineTo', args]),
            arc: (...args) => calls.push(['arc', args]),
            fill: () => calls.push(['fill']),
            stroke: () => calls.push(['stroke']),
            save: () => calls.push(['save']),
            restore: () => calls.push(['restore']),
            translate: (...args) => calls.push(['translate', args]),
            scale: (...args) => calls.push(['scale', args]),
            getCalls: () => calls,
            clearCalls: () => calls.length = 0
        };

        return mockContext;
    },

    /**
     * Wait for DOM element
     */
    async waitForElement(selector, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await this.wait(100);
        }

        throw new Error(`Element not found: ${selector}`);
    },

    /**
     * Measure execution time
     */
    async measureTime(fn) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        return end - start;
    }
};
