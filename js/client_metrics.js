/**
 * client_metrics.js - Client-Side Performance Metrics
 * Tracks client performance and integrates with logger
 */

// ============================
// CLIENT METRICS COLLECTOR
// ============================

class ClientMetricsCollector {
    constructor() {
        this.metrics = {
            pageLoad: null,
            bundleLoad: null,
            errors: [],
            operations: []
        };

        this.errorWindow = 5 * 60 * 1000; // 5 minutes
        this.reportInterval = 60000; // 60 seconds

        // Collect initial metrics
        this._collectPageLoadMetrics();

        // Start periodic reporting
        this._startReporting();
    }

    /**
     * Collect page load metrics
     */
    _collectPageLoadMetrics() {
        if (!window.performance || !window.performance.timing) return;

        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = window.performance.timing;
                const navigation = window.performance.navigation;

                this.metrics.pageLoad = {
                    // Overall timings
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    loadComplete: timing.loadEventEnd - timing.navigationStart,

                    // Network
                    dns: timing.domainLookupEnd - timing.domainLookupStart,
                    tcp: timing.connectEnd - timing.connectStart,
                    request: timing.responseStart - timing.requestStart,
                    response: timing.responseEnd - timing.responseStart,

                    // Processing
                    domProcessing: timing.domComplete - timing.domLoading,
                    domInteractive: timing.domInteractive - timing.navigationStart,

                    // Navigation type
                    navigationType: navigation.type,
                    redirectCount: navigation.redirectCount
                };

                // Log page load metrics
                if (window.logger) {
                    window.logger.info('Page load complete', {
                        metrics: this.metrics.pageLoad
                    });
                }
            }, 0);
        });
    }

    /**
     * Track operation timing
     */
    trackOperation(name, duration, metadata = {}) {
        this.metrics.operations.push({
            name,
            duration,
            timestamp: Date.now(),
            ...metadata
        });

        // Keep only last 100 operations
        if (this.metrics.operations.length > 100) {
            this.metrics.operations = this.metrics.operations.slice(-100);
        }
    }

    /**
     * Track error
     */
    trackError(error, context = {}) {
        this.metrics.errors.push({
            timestamp: Date.now(),
            message: error.message || String(error),
            context
        });

        // Keep only errors from last 5 minutes
        const cutoff = Date.now() - this.errorWindow;
        this.metrics.errors = this.metrics.errors.filter(e => e.timestamp > cutoff);
    }

    /**
     * Get error rate
     */
    getErrorRate() {
        const recent = this.metrics.errors.filter(
            e => e.timestamp > Date.now() - this.errorWindow
        );

        return {
            count: recent.length,
            rate: recent.length / (this.errorWindow / 60000) // errors per minute
        };
    }

    /**
     * Get metrics summary
     */
    getSummary() {
        return {
            pageLoad: this.metrics.pageLoad,
            errorRate: this.getErrorRate(),
            operationCount: this.metrics.operations.length
        };
    }

    /**
     * Start periodic reporting
     */
    _startReporting() {
        setInterval(() => {
            const summary = this.getSummary();

            if (window.logger) {
                window.logger.debug('Client metrics summary', summary);
            }

            // Clear old operations
            const cutoff = Date.now() - this.errorWindow;
            this.metrics.operations = this.metrics.operations.filter(
                op => op.timestamp > cutoff
            );
        }, this.reportInterval);
    }
}

// ============================
// PERFORMANCE MARK HELPERS
// ============================

/**
 * Mark performance event
 */
function markPerformance(name, metadata = {}) {
    if (window.performance && window.performance.mark) {
        window.performance.mark(name);
    }

    if (window.logger) {
        window.logger.debug(`Performance mark: ${name}`, metadata);
    }
}

/**
 * Measure performance between marks
 */
function measurePerformance(name, startMark, endMark) {
    if (!window.performance || !window.performance.measure) return null;

    try {
        window.performance.measure(name, startMark, endMark);

        const measure = window.performance.getEntriesByName(name)[0];

        if (measure && window.logger) {
            window.logger.info(`Performance measure: ${name}`, {
                duration: Math.round(measure.duration)
            });
        }

        // Track in metrics collector
        if (window.metricsCollector && measure) {
            window.metricsCollector.trackOperation(name, Math.round(measure.duration));
        }

        return measure ? Math.round(measure.duration) : null;
    } catch (error) {
        if (window.logger) {
            window.logger.warn('Failed to measure performance', {
                name,
                startMark,
                endMark,
                error: error.message
            });
        }
        return null;
    }
}

// ============================
// EXPORTS & INITIALIZATION
// ============================

// Create global metrics collector
if (typeof window !== 'undefined') {
    window.metricsCollector = new ClientMetricsCollector();

    // Expose performance helpers
    window.markPerformance = markPerformance;
    window.measurePerformance = measurePerformance;

    console.log('✅ Client metrics collector initialized');
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClientMetricsCollector, markPerformance, measurePerformance };
}
