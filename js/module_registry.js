// Module Registry - Track module initialization and dependencies
// Part of AP Statistics Consensus Quiz
// See docs/module-boundaries.md for architecture details

(function() {
    'use strict';

    // Global module registry
    window.MODULE_REGISTRY = {
        // Track which modules have been initialized
        loaded: new Set(),

        // Expected load order (foundation -> business -> presentation -> infrastructure)
        order: [
            'curriculum',      // data/curriculum.js
            'units',          // data/units.js
            'data_manager',   // js/data_manager.js
            'auth',           // js/auth.js
            'charts',         // js/charts.js
            'railway_config', // railway_config.js (optional)
            'railway_client'  // railway_client.js (optional)
        ],

        // Mark a module as loaded
        register: function(moduleName) {
            this.loaded.add(moduleName);
            console.log(`✓ Module loaded: ${moduleName}`);
        },

        // Require a module (throws if not loaded)
        require: function(moduleName) {
            if (!this.loaded.has(moduleName)) {
                throw new Error(`Module '${moduleName}' not loaded. Check script order in index.html`);
            }
        },

        // Check if a module is loaded (soft check)
        isLoaded: function(moduleName) {
            return this.loaded.has(moduleName);
        },

        // Validate all expected modules are loaded
        validate: function() {
            const required = ['curriculum', 'units', 'data_manager', 'auth', 'charts'];
            const missing = required.filter(mod => !this.loaded.has(mod));

            if (missing.length > 0) {
                console.error('Missing required modules:', missing);
                return false;
            }

            console.log('✓ All required modules loaded');
            return true;
        },

        // Get load order report
        report: function() {
            console.log('=== MODULE REGISTRY REPORT ===');
            this.order.forEach(moduleName => {
                const status = this.loaded.has(moduleName) ? '✓' : '✗';
                console.log(`${status} ${moduleName}`);
            });
            console.log('==============================');
        }
    };

    // Helper: Wait for module to load (useful for optional modules)
    window.MODULE_REGISTRY.waitFor = function(moduleName, timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (this.loaded.has(moduleName)) {
                resolve();
                return;
            }

            const startTime = Date.now();
            const interval = setInterval(() => {
                if (this.loaded.has(moduleName)) {
                    clearInterval(interval);
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject(new Error(`Module '${moduleName}' not loaded within ${timeout}ms`));
                }
            }, 100);
        });
    };

})();
