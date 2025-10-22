// Safe Logger - PII Protection for Console Logging
// Part of AP Statistics Consensus Quiz
// See docs/security/logging-policy.md for policy details

// IMPORTANT: This file must load BEFORE any other application scripts
// It overrides console methods to prevent PII leakage

(function() {
    'use strict';

    // Preserve original console methods for internal use
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    /**
     * Sanitize arguments to remove PII patterns
     * @param {Array} args - Console arguments
     * @returns {Array} Sanitized arguments
     */
    function sanitize(args) {
        return args.map(arg => {
            // Only sanitize strings
            if (typeof arg !== 'string') {
                return arg;
            }

            let sanitized = arg;

            // Redact email addresses
            sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

            // Redact full names (First Last pattern)
            sanitized = sanitized.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]');

            // Redact phone numbers (various formats)
            sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
            sanitized = sanitized.replace(/\(\d{3}\)\s*\d{3}[-.]?\d{4}/g, '[PHONE]');

            // Redact SSN
            sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

            // Redact credit card numbers
            sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');

            // Redact street addresses (number + street name)
            sanitized = sanitized.replace(/\b\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi, '[ADDRESS]');

            return sanitized;
        });
    }

    /**
     * Check if AuthValidator is available for enhanced PII detection
     * @param {string} text - Text to check
     * @returns {boolean} True if PII detected
     */
    function containsPII(text) {
        if (window.AuthValidator && typeof window.AuthValidator.containsPII === 'function') {
            return window.AuthValidator.containsPII(text);
        }
        // Fallback to basic check
        return false;
    }

    // Override console.log
    console.log = function(...args) {
        originalLog.apply(console, sanitize(args));
    };

    // Override console.error
    console.error = function(...args) {
        originalError.apply(console, sanitize(args));
    };

    // Override console.warn
    console.warn = function(...args) {
        originalWarn.apply(console, sanitize(args));
    };

    // Override console.info
    console.info = function(...args) {
        originalInfo.apply(console, sanitize(args));
    };

    // Provide raw logging for debugging (use sparingly)
    console.raw = originalLog;
    console.rawError = originalError;
    console.rawWarn = originalWarn;

    // ============================================
    // STRUCTURED SAFE LOGGER
    // ============================================

    window.SafeLogger = {
        /**
         * Log an event with metadata (sanitized)
         * @param {string} action - Action name (e.g., 'answer_submitted')
         * @param {object} metadata - Event metadata
         */
        event: function(action, metadata = {}) {
            const safeMetadata = {};

            // Filter out PII from metadata
            for (const [key, value] of Object.entries(metadata)) {
                // Allow safe types
                if (typeof value === 'number' || typeof value === 'boolean') {
                    safeMetadata[key] = value;
                    continue;
                }

                // Check strings for PII
                if (typeof value === 'string') {
                    // Use AuthValidator if available
                    if (window.AuthValidator && window.AuthValidator.containsPII(value)) {
                        safeMetadata[key] = '[REDACTED - PII DETECTED]';
                    } else {
                        safeMetadata[key] = value;
                    }
                    continue;
                }

                // Arrays and objects - shallow check
                if (Array.isArray(value) || typeof value === 'object') {
                    safeMetadata[key] = '[OBJECT - not logged for safety]';
                }
            }

            // Log with timestamp
            originalLog('📊 EVENT:', action, {
                ...safeMetadata,
                timestamp: new Date().toISOString()
            });
        },

        /**
         * Log a user action (always uses anonymous username)
         * @param {string} action - Action description
         * @param {object} details - Additional details
         */
        userAction: function(action, details = {}) {
            const username = window.currentUsername || 'anonymous';

            this.event('user_action', {
                action,
                username,  // Already anonymous (Fruit_Animal)
                ...details
            });
        },

        /**
         * Log an error safely
         * @param {Error|string} error - Error object or message
         * @param {object} context - Additional context
         */
        error: function(error, context = {}) {
            const errorMessage = error instanceof Error ? error.message : error;

            console.error('❌ Error:', errorMessage);

            // Log context without PII
            if (Object.keys(context).length > 0) {
                this.event('error_occurred', {
                    error: errorMessage,
                    ...context
                });
            }

            // Stack trace in development only
            if (error instanceof Error && process?.env?.NODE_ENV !== 'production') {
                console.raw('Stack:', error.stack);
            }
        },

        /**
         * Log performance metrics
         * @param {string} metric - Metric name
         * @param {number} value - Metric value
         * @param {string} unit - Unit (ms, bytes, etc.)
         */
        performance: function(metric, value, unit = '') {
            this.event('performance', {
                metric,
                value,
                unit
            });
        },

        /**
         * Log feature usage
         * @param {string} feature - Feature name
         * @param {object} details - Usage details
         */
        featureUsed: function(feature, details = {}) {
            this.event('feature_used', {
                feature,
                ...details
            });
        },

        /**
         * Sanitize and return text (for display, not logging)
         * @param {string} text - Text to sanitize
         * @returns {string} Sanitized text
         */
        sanitize: function(text) {
            if (window.AuthValidator && typeof window.AuthValidator.sanitizeText === 'function') {
                return window.AuthValidator.sanitizeText(text);
            }

            // Fallback sanitization
            return sanitize([text])[0];
        }
    };

    // Log that safe logger is active
    originalLog('🔒 Safe Logger initialized - PII protection active');

    // Register module
    if (window.MODULE_REGISTRY) {
        window.MODULE_REGISTRY.register('safe_logger');
    }

})();
