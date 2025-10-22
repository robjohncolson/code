/**
 * perf_monitor.js - Performance Monitoring & Baseline Measurement
 * Part of AP Statistics Consensus Quiz
 *
 * Provides comprehensive performance tracking using the Performance API.
 * Tracks TTI, FCP, bundle sizes, memory usage, and custom metrics.
 */

class PerfMonitor {
    constructor() {
        // Check if Performance API is available
        this.supported = typeof performance !== 'undefined' &&
                        typeof performance.mark === 'function';

        // Configuration
        this.config = {
            enabled: this._isEnabled(),
            sampleRate: 0.01, // 1% of users in production
            maxStoredReports: 10,
            reportToConsole: true,
            reportToServer: false,
            serverEndpoint: '/api/performance'
        };

        // State
        this.marks = [];
        this.measures = [];
        this.resources = [];
        this.startTime = this.supported ? performance.now() : Date.now();
        this.reportGenerated = false;

        // Budgets (from Opus P9)
        this.budgets = {
            cold_load: {
                TTI: 3000,        // 3s on 4G
                FCP: 1500,        // 1.5s
                scriptParse: 500, // 500ms
                jsHeapMB: 20      // 20MB
            },
            warm_load: {
                TTI: 1000,        // 1s
                FCP: 500,         // 500ms
                scriptParse: 200, // 200ms
                jsHeapMB: 15      // 15MB
            },
            bundle: {
                initial: 50,      // 50KB initial JS (gzipped)
                perUnit: 15       // 15KB per unit (gzipped)
            }
        };

        // Initialize
        if (this.supported && this.config.enabled) {
            this._init();
        }
    }

    /**
     * Initialize monitoring
     */
    _init() {
        console.log('[PerfMonitor] Initializing performance monitoring');

        // Mark app start
        this.mark('app-init-start', { type: 'lifecycle' });

        // Listen for page load events
        this._setupEventListeners();

        // Capture paint metrics when available
        this._capturePaintMetrics();

        // Set up resource timing observer
        this._setupResourceObserver();
    }

    /**
     * Check if monitoring is enabled
     */
    _isEnabled() {
        // Check localStorage flag
        const localStorageFlag = localStorage.getItem('perfMonitorEnabled');
        if (localStorageFlag !== null) {
            return localStorageFlag === 'true';
        }

        // In development, always enable
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return true;
        }

        // In production, sample users
        return Math.random() < this.config.sampleRate;
    }

    /**
     * Create a performance mark
     * @param {string} name - Mark name
     * @param {Object} metadata - Additional metadata
     */
    mark(name, metadata = {}) {
        if (!this.supported || !this.config.enabled) return;

        try {
            performance.mark(name);

            const entry = {
                name,
                time: performance.now(),
                timestamp: Date.now(),
                metadata
            };

            this.marks.push(entry);

            // Auto-measure from previous mark if same type
            if (this.marks.length > 1 && metadata.type) {
                const prevMark = this.marks
                    .slice(0, -1)
                    .reverse()
                    .find(m => m.metadata.type === metadata.type);

                if (prevMark) {
                    this.measure(`${prevMark.name}-to-${name}`, prevMark.name, name);
                }
            }

            console.log(`[PerfMonitor] Mark: ${name} @ ${entry.time.toFixed(2)}ms`);
        } catch (error) {
            console.warn('[PerfMonitor] Failed to create mark:', error);
        }
    }

    /**
     * Create a performance measure
     * @param {string} name - Measure name
     * @param {string} startMark - Start mark name
     * @param {string} endMark - End mark name
     * @returns {number|null} Duration in ms
     */
    measure(name, startMark, endMark) {
        if (!this.supported || !this.config.enabled) return null;

        try {
            performance.measure(name, startMark, endMark);
            const measure = performance.getEntriesByName(name, 'measure')[0];

            if (measure) {
                const entry = {
                    name,
                    duration: measure.duration,
                    start: measure.startTime,
                    end: measure.startTime + measure.duration
                };

                this.measures.push(entry);

                console.log(`[PerfMonitor] Measure: ${name} = ${entry.duration.toFixed(2)}ms`);
                return entry.duration;
            }
        } catch (error) {
            console.warn('[PerfMonitor] Failed to create measure:', error);
        }

        return null;
    }

    /**
     * Setup event listeners for lifecycle events
     */
    _setupEventListeners() {
        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.mark('page-hidden', { type: 'visibility' });
            } else {
                this.mark('page-visible', { type: 'visibility' });
            }
        });

        // User interactions
        ['click', 'keydown', 'touchstart'].forEach(eventType => {
            document.addEventListener(eventType, () => {
                if (!this.marks.find(m => m.name === 'first-input')) {
                    this.mark('first-input', { type: 'interaction' });
                }
            }, { once: true, passive: true });
        });

        // Page load complete
        if (document.readyState === 'complete') {
            this._onPageLoad();
        } else {
            window.addEventListener('load', () => this._onPageLoad());
        }

        // Unload - generate final report
        window.addEventListener('beforeunload', () => {
            if (!this.reportGenerated) {
                this.generateReport();
            }
        });
    }

    /**
     * Called when page finishes loading
     */
    _onPageLoad() {
        this.mark('page-load-complete', { type: 'lifecycle' });

        // Schedule TTI detection
        this._detectTTI();
    }

    /**
     * Detect Time to Interactive (TTI)
     * Heuristic: 5 seconds after last long task
     */
    _detectTTI() {
        if (!this.supported) return;

        // Simple heuristic: TTI = load + 50ms (optimistic)
        // More sophisticated: wait for 5s quiet window
        setTimeout(() => {
            this.mark('app-interactive', { type: 'lifecycle' });

            // Generate report after TTI
            setTimeout(() => {
                if (this.config.enabled && !this.reportGenerated) {
                    this.generateReport();
                }
            }, 1000);
        }, 50);
    }

    /**
     * Capture paint metrics (FCP, LCP)
     */
    _capturePaintMetrics() {
        if (!this.supported) return;

        // Try PerformanceObserver for paint timing
        if ('PerformanceObserver' in window) {
            try {
                const paintObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.mark(`paint-${entry.name}`, {
                            type: 'paint',
                            startTime: entry.startTime
                        });
                    }
                });

                paintObserver.observe({ entryTypes: ['paint'] });
            } catch (e) {
                console.warn('[PerfMonitor] Paint observer not supported');
            }
        }

        // Fallback: check paint entries after load
        window.addEventListener('load', () => {
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
                if (!this.marks.find(m => m.name === `paint-${entry.name}`)) {
                    this.mark(`paint-${entry.name}`, {
                        type: 'paint',
                        startTime: entry.startTime
                    });
                }
            });
        });
    }

    /**
     * Setup resource timing observer
     */
    _setupResourceObserver() {
        if (!this.supported) return;

        // Capture initial resources
        const resources = performance.getEntriesByType('resource');
        this.resources = this._processResourceEntries(resources);

        // Observe new resources
        if ('PerformanceObserver' in window) {
            try {
                const resourceObserver = new PerformanceObserver((list) => {
                    const newResources = this._processResourceEntries(list.getEntries());
                    this.resources.push(...newResources);
                });

                resourceObserver.observe({ entryTypes: ['resource'] });
            } catch (e) {
                console.warn('[PerfMonitor] Resource observer not supported');
            }
        }
    }

    /**
     * Process resource timing entries
     */
    _processResourceEntries(entries) {
        return entries.map(entry => ({
            name: entry.name.split('/').pop(),
            url: entry.name,
            type: this._getResourceType(entry),
            duration: entry.duration,
            size: entry.transferSize || 0,
            cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
            startTime: entry.startTime,
            responseEnd: entry.responseEnd
        }));
    }

    /**
     * Get resource type from entry
     */
    _getResourceType(entry) {
        const name = entry.name.toLowerCase();
        if (name.endsWith('.js')) return 'script';
        if (name.endsWith('.css')) return 'stylesheet';
        if (name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
        if (name.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
        return entry.initiatorType || 'other';
    }

    /**
     * Get paint metrics
     */
    getPaintMetrics() {
        if (!this.supported) return {};

        const paintEntries = performance.getEntriesByType('paint');
        const metrics = {};

        paintEntries.forEach(entry => {
            if (entry.name === 'first-contentful-paint') {
                metrics.FCP = entry.startTime;
            }
            if (entry.name === 'first-paint') {
                metrics.FP = entry.startTime;
            }
        });

        // Try to get LCP
        if ('PerformanceObserver' in window) {
            const lcpEntry = performance.getEntriesByType('largest-contentful-paint')?.[0];
            if (lcpEntry) {
                metrics.LCP = lcpEntry.startTime;
            }
        }

        return metrics;
    }

    /**
     * Get memory metrics
     */
    getMemoryMetrics() {
        const metrics = {};

        if (performance.memory) {
            metrics.usedJSHeapSizeMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
            metrics.totalJSHeapSizeMB = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
            metrics.jsHeapSizeLimitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
            metrics.heapUsagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);
        } else {
            metrics.supported = false;
        }

        return metrics;
    }

    /**
     * Get resource metrics
     */
    getResourceMetrics() {
        const byType = {};
        let totalSize = 0;
        let totalDuration = 0;

        this.resources.forEach(resource => {
            if (!byType[resource.type]) {
                byType[resource.type] = {
                    count: 0,
                    size: 0,
                    duration: 0,
                    cached: 0
                };
            }

            byType[resource.type].count++;
            byType[resource.type].size += resource.size;
            byType[resource.type].duration += resource.duration;
            if (resource.cached) byType[resource.type].cached++;

            totalSize += resource.size;
            totalDuration += resource.duration;
        });

        return {
            byType,
            total: {
                count: this.resources.length,
                size: totalSize,
                sizeMB: (totalSize / 1048576).toFixed(2),
                avgDuration: this.resources.length > 0 ? (totalDuration / this.resources.length).toFixed(2) : 0
            }
        };
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (connection) {
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }

        return { supported: false };
    }

    /**
     * Get device info
     */
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            deviceMemory: navigator.deviceMemory || 'unknown',
            screenResolution: `${screen.width}x${screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };
    }

    /**
     * Generate performance report
     */
    generateReport() {
        if (!this.supported) {
            console.warn('[PerfMonitor] Performance API not supported');
            return null;
        }

        this.mark('report-generated', { type: 'internal' });

        const paintMetrics = this.getPaintMetrics();
        const memoryMetrics = this.getMemoryMetrics();
        const resourceMetrics = this.getResourceMetrics();
        const connectionInfo = this.getConnectionInfo();
        const deviceInfo = this.getDeviceInfo();

        // Calculate key metrics
        const ttiMark = this.marks.find(m => m.name === 'app-interactive');
        const TTI = ttiMark ? ttiMark.time : null;

        const scriptParseTime = this.measures
            .filter(m => m.name.includes('curriculum') || m.name.includes('script'))
            .reduce((sum, m) => sum + m.duration, 0);

        const report = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            reportId: this._generateReportId(),

            // Summary metrics
            summary: {
                TTI: TTI,
                FCP: paintMetrics.FCP || null,
                FP: paintMetrics.FP || null,
                LCP: paintMetrics.LCP || null,
                scriptParseTime: scriptParseTime,
                totalJSSizeMB: parseFloat(resourceMetrics.total.sizeMB)
            },

            // Detailed metrics
            marks: this.marks,
            measures: this.measures,
            resources: resourceMetrics,
            memory: memoryMetrics,
            connection: connectionInfo,
            device: deviceInfo,

            // Budget compliance
            budgetCompliance: this._checkBudgets(TTI, paintMetrics.FCP, scriptParseTime, memoryMetrics)
        };

        // Store report
        this._storeReport(report);

        // Log to console
        if (this.config.reportToConsole) {
            this._logReport(report);
        }

        // Send to server
        if (this.config.reportToServer) {
            this._sendReport(report);
        }

        this.reportGenerated = true;
        return report;
    }

    /**
     * Generate unique report ID
     */
    _generateReportId() {
        return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check budget compliance
     */
    _checkBudgets(tti, fcp, scriptParse, memory) {
        const isColdLoad = !performance.getEntriesByType('navigation')[0]?.transferSize === 0;
        const budget = isColdLoad ? this.budgets.cold_load : this.budgets.warm_load;

        const compliance = {
            loadType: isColdLoad ? 'cold' : 'warm',
            checks: {
                TTI: {
                    value: tti,
                    budget: budget.TTI,
                    pass: tti ? tti < budget.TTI : null,
                    delta: tti ? tti - budget.TTI : null
                },
                FCP: {
                    value: fcp,
                    budget: budget.FCP,
                    pass: fcp ? fcp < budget.FCP : null,
                    delta: fcp ? fcp - budget.FCP : null
                },
                scriptParse: {
                    value: scriptParse,
                    budget: budget.scriptParse,
                    pass: scriptParse < budget.scriptParse,
                    delta: scriptParse - budget.scriptParse
                }
            },
            overall: null
        };

        // Check memory if available
        if (memory.usedJSHeapSizeMB) {
            compliance.checks.memory = {
                value: parseFloat(memory.usedJSHeapSizeMB),
                budget: budget.jsHeapMB,
                pass: parseFloat(memory.usedJSHeapSizeMB) < budget.jsHeapMB,
                delta: parseFloat(memory.usedJSHeapSizeMB) - budget.jsHeapMB
            };
        }

        // Overall compliance
        const passedChecks = Object.values(compliance.checks).filter(c => c.pass === true).length;
        const totalChecks = Object.values(compliance.checks).filter(c => c.pass !== null).length;
        compliance.overall = totalChecks > 0 ? passedChecks === totalChecks : null;

        return compliance;
    }

    /**
     * Store report in localStorage
     */
    _storeReport(report) {
        try {
            const key = 'perfMonitorReports';
            const stored = JSON.parse(localStorage.getItem(key) || '[]');

            // Keep only last N reports
            stored.push(report);
            if (stored.length > this.config.maxStoredReports) {
                stored.shift();
            }

            localStorage.setItem(key, JSON.stringify(stored));
        } catch (error) {
            console.warn('[PerfMonitor] Failed to store report:', error);
        }
    }

    /**
     * Log report to console
     */
    _logReport(report) {
        console.group('📊 Performance Report');
        console.log('Report ID:', report.reportId);
        console.log('Timestamp:', report.timestamp);

        console.group('Summary Metrics');
        console.table(report.summary);
        console.groupEnd();

        console.group('Budget Compliance');
        console.log('Load Type:', report.budgetCompliance.loadType);
        console.table(report.budgetCompliance.checks);
        console.log('Overall:', report.budgetCompliance.overall ? '✅ PASS' : '❌ FAIL');
        console.groupEnd();

        console.group('Resources');
        console.table(report.resources.byType);
        console.log('Total:', report.resources.total);
        console.groupEnd();

        if (report.memory.supported !== false) {
            console.group('Memory');
            console.table(report.memory);
            console.groupEnd();
        }

        console.groupEnd();
    }

    /**
     * Send report to server
     */
    _sendReport(report) {
        if (!navigator.sendBeacon) {
            console.warn('[PerfMonitor] sendBeacon not supported');
            return;
        }

        try {
            const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
            navigator.sendBeacon(this.config.serverEndpoint, blob);
        } catch (error) {
            console.warn('[PerfMonitor] Failed to send report:', error);
        }
    }

    /**
     * Get all stored reports
     */
    getStoredReports() {
        try {
            return JSON.parse(localStorage.getItem('perfMonitorReports') || '[]');
        } catch (error) {
            console.warn('[PerfMonitor] Failed to get stored reports:', error);
            return [];
        }
    }

    /**
     * Clear stored reports
     */
    clearReports() {
        localStorage.removeItem('perfMonitorReports');
        console.log('[PerfMonitor] Cleared stored reports');
    }

    /**
     * Get performance metrics for comparison
     */
    getMetrics() {
        return {
            marks: this.marks,
            measures: this.measures,
            resources: this.getResourceMetrics(),
            memory: this.getMemoryMetrics(),
            paint: this.getPaintMetrics(),
            connection: this.getConnectionInfo(),
            device: this.getDeviceInfo()
        };
    }

    /**
     * Enable performance monitoring
     */
    enable() {
        localStorage.setItem('perfMonitorEnabled', 'true');
        this.config.enabled = true;
        console.log('[PerfMonitor] Enabled');
    }

    /**
     * Disable performance monitoring
     */
    disable() {
        localStorage.setItem('perfMonitorEnabled', 'false');
        this.config.enabled = false;
        console.log('[PerfMonitor] Disabled');
    }
}

// Create global instance
window.perfMonitor = new PerfMonitor();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerfMonitor;
}

console.log('[PerfMonitor] Module loaded');
