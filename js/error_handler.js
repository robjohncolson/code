// Error Boundary Handler - Graceful degradation for AP Stats Quiz
// Part of AP Statistics Consensus Quiz
// See docs/module-boundaries.md for error handling strategy

(function() {
    'use strict';

    window.ErrorBoundary = {
        /**
         * Wrap a function with error handling and fallback
         * @param {Function} fn - Function to wrap
         * @param {Function} fallback - Fallback function if error occurs
         * @param {String} context - Description for logging
         * @returns {Function} Wrapped function
         */
        wrap: function(fn, fallback, context) {
            return function(...args) {
                try {
                    return fn.apply(this, args);
                } catch (error) {
                    console.error(`Error in ${context}:`, error);

                    // Call fallback if provided
                    if (fallback) {
                        return fallback(error);
                    }

                    // Show user-friendly message if available
                    if (typeof window.showMessage === 'function') {
                        window.showMessage(`Error: ${error.message}`, 'error');
                    }

                    return null;
                };
            };
        },

        /**
         * Fallback for chart rendering failures
         * Returns placeholder HTML instead of crashing
         */
        chartFallback: function(error) {
            console.warn('Chart rendering failed, showing placeholder:', error.message);
            return `
                <div class="chart-error" style="
                    padding: 20px;
                    text-align: center;
                    border: 2px dashed #ccc;
                    border-radius: 8px;
                    color: #666;
                    background: #f8f8f8;
                ">
                    <p>📊 Chart unavailable</p>
                    <small style="color: #999;">${error.message || 'Rendering error'}</small>
                </div>
            `;
        },

        /**
         * Fallback for sync failures
         * Returns offline indicator and allows app to continue
         */
        syncFallback: function(error) {
            console.log('Sync failed, continuing in offline mode:', error.message);

            // Show non-intrusive message
            if (typeof window.showMessage === 'function') {
                window.showMessage('Continuing in offline mode', 'info');
            }

            return {
                offline: true,
                error: error.message,
                timestamp: Date.now()
            };
        },

        /**
         * Fallback for localStorage quota exceeded
         * Attempts to free space by removing old data
         */
        quotaFallback: function(error) {
            console.warn('localStorage quota exceeded:', error);

            // Try to free space
            try {
                // Remove old session markers
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sessionStart_') || key.startsWith('tempProgress_')) {
                        localStorage.removeItem(key);
                    }
                });

                if (typeof window.showMessage === 'function') {
                    window.showMessage('Storage space low. Old data cleaned up.', 'warning');
                }
            } catch (e) {
                if (typeof window.showMessage === 'function') {
                    window.showMessage('Storage full. Please export your data.', 'error');
                }
            }

            return false; // Indicate save failed
        },

        /**
         * Fallback for Railway connection failures
         * Falls back to direct Supabase access
         */
        railwayFallback: function(error) {
            console.log('Railway server unavailable, falling back to Supabase:', error.message);

            // Disable Railway for this session
            if (window.railwayClient) {
                window.railwayClient.disable();
            }

            return {
                useRailway: false,
                fallbackActive: true
            };
        },

        /**
         * Global error handler for uncaught errors
         * Prevents app crashes from unhandled exceptions
         */
        setupGlobalHandler: function() {
            window.addEventListener('error', function(event) {
                console.error('Uncaught error:', event.error);

                // Prevent default browser error handling
                event.preventDefault();

                // Log to console for debugging
                console.error('Stack trace:', event.error?.stack);

                // Show user-friendly message
                if (typeof window.showMessage === 'function') {
                    window.showMessage('An error occurred. The app will continue running.', 'error');
                }

                return true;
            });

            // Handle promise rejections
            window.addEventListener('unhandledrejection', function(event) {
                console.error('Unhandled promise rejection:', event.reason);
                event.preventDefault();

                if (typeof window.showMessage === 'function') {
                    window.showMessage('Connection error. Continuing in offline mode.', 'warning');
                }

                return true;
            });
        },

        /**
         * Safe wrapper for localStorage operations
         * Handles quota exceeded and other storage errors
         */
        safeLocalStorage: {
            setItem: function(key, value) {
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (error) {
                    if (error.name === 'QuotaExceededError') {
                        window.ErrorBoundary.quotaFallback(error);
                    } else {
                        console.error('localStorage error:', error);
                    }
                    return false;
                }
            },

            getItem: function(key, defaultValue = null) {
                try {
                    return localStorage.getItem(key) || defaultValue;
                } catch (error) {
                    console.error('localStorage read error:', error);
                    return defaultValue;
                }
            },

            removeItem: function(key) {
                try {
                    localStorage.removeItem(key);
                    return true;
                } catch (error) {
                    console.error('localStorage remove error:', error);
                    return false;
                }
            }
        }
    };

    // Auto-setup global handlers on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.ErrorBoundary.setupGlobalHandler();
        });
    } else {
        window.ErrorBoundary.setupGlobalHandler();
    }

})();
