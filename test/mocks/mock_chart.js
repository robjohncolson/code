/**
 * mock_chart.js - Mock Chart.js Implementation
 * Provides mock Chart.js for testing without rendering
 */

class MockChart {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.data = config.data;
        this.options = config.options;
        this.type = config.type;
        this._destroyed = false;

        // Track instance
        MockChart.instances.push(this);
    }

    update() {
        if (this._destroyed) {
            throw new Error('Cannot update destroyed chart');
        }
        return this;
    }

    destroy() {
        this._destroyed = true;
        const index = MockChart.instances.indexOf(this);
        if (index > -1) {
            MockChart.instances.splice(index, 1);
        }
    }

    resize() {
        if (this._destroyed) {
            throw new Error('Cannot resize destroyed chart');
        }
        return this;
    }

    reset() {
        if (this._destroyed) {
            throw new Error('Cannot reset destroyed chart');
        }
        return this;
    }

    toBase64Image() {
        return 'data:image/png;base64,mock-chart-image';
    }

    // Test helper: verify config structure
    static validateConfig(config) {
        const errors = [];

        if (!config.type) {
            errors.push('Missing config.type');
        }

        if (!config.data) {
            errors.push('Missing config.data');
        } else {
            if (!Array.isArray(config.data.labels)) {
                errors.push('config.data.labels must be an array');
            }
            if (!Array.isArray(config.data.datasets)) {
                errors.push('config.data.datasets must be an array');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Static properties
MockChart.instances = [];
MockChart.defaults = {
    global: {
        responsive: true,
        maintainAspectRatio: true
    }
};

// Reset helper for tests
MockChart.reset = function() {
    MockChart.instances = [];
};

// Export as global Chart
window.Chart = MockChart;

// Mock Chart.js helpers
window.Chart.helpers = {
    merge(target, source) {
        return Object.assign({}, target, source);
    }
};

// Mock Chart.js scales
window.Chart.scales = {};

console.log('✅ Mock Chart.js loaded');
