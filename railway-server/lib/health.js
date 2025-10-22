/**
 * health.js - Health Check & Telemetry System
 * Comprehensive health monitoring for production deployment
 */

import logger from './logger.js';

// ============================
// HEALTH CHECK SYSTEM
// ============================

/**
 * Health check result structure
 */
class HealthCheckResult {
    constructor(name, status, data = {}) {
        this.name = name;
        this.status = status; // 'ok', 'degraded', 'unhealthy'
        this.timestamp = new Date().toISOString();
        this.data = data;
    }
}

/**
 * HealthChecker - Manages health checks
 */
class HealthChecker {
    constructor(options = {}) {
        this.checks = new Map();
        this.cacheEnabled = options.cacheEnabled !== false;
        this.cacheTTL = options.cacheTTL || 5000; // 5 seconds
        this.cachedResult = null;
        this.cacheTime = 0;

        // Metrics tracking
        this.metrics = {
            requests: {
                total: 0,
                perMinute: 0,
                lastMinute: []
            },
            responses: {
                avgTime: 0,
                p95Time: 0,
                p99Time: 0,
                responseTimes: []
            },
            errors: {
                count: 0,
                rate: 0
            }
        };

        // Start metrics collection
        this._startMetricsCollection();
    }

    /**
     * Register a health check
     */
    registerCheck(name, checkFn, timeout = 1000) {
        this.checks.set(name, { checkFn, timeout });
    }

    /**
     * Run single health check with timeout
     */
    async _runCheck(name, checkConfig) {
        const startTime = process.hrtime();

        try {
            // Run check with timeout
            const result = await Promise.race([
                checkConfig.checkFn(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Health check timeout')), checkConfig.timeout)
                )
            ]);

            // Calculate latency
            const diff = process.hrtime(startTime);
            const latency = Math.round(diff[0] * 1000 + diff[1] / 1000000);

            return new HealthCheckResult(name, 'ok', { ...result, latency });
        } catch (error) {
            logger.warn(`Health check failed: ${name}`, { error: error.message });
            return new HealthCheckResult(name, 'unhealthy', {
                error: error.message
            });
        }
    }

    /**
     * Run all health checks
     */
    async runChecks() {
        // Check cache first
        if (this.cacheEnabled && Date.now() - this.cacheTime < this.cacheTTL) {
            return this.cachedResult;
        }

        const checkResults = {};

        // Run all checks in parallel
        const checkPromises = Array.from(this.checks.entries()).map(
            async ([name, config]) => {
                const result = await this._runCheck(name, config);
                checkResults[name] = result;
            }
        );

        await Promise.all(checkPromises);

        // Determine overall status
        let overallStatus = 'healthy';
        const statuses = Object.values(checkResults).map(r => r.status);

        if (statuses.includes('unhealthy')) {
            overallStatus = 'unhealthy';
        } else if (statuses.includes('degraded')) {
            overallStatus = 'degraded';
        }

        const result = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '2.0.0',
            uptime: Math.floor(process.uptime()),
            checks: checkResults,
            metrics: this.getMetrics()
        };

        // Cache result
        if (this.cacheEnabled) {
            this.cachedResult = result;
            this.cacheTime = Date.now();
        }

        return result;
    }

    /**
     * Track request
     */
    trackRequest(responseTime, statusCode) {
        const now = Date.now();

        // Track total requests
        this.metrics.requests.total++;
        this.metrics.requests.lastMinute.push(now);

        // Track response times
        this.metrics.responses.responseTimes.push(responseTime);

        // Keep only last 1000 response times
        if (this.metrics.responses.responseTimes.length > 1000) {
            this.metrics.responses.responseTimes = this.metrics.responses.responseTimes.slice(-1000);
        }

        // Track errors
        if (statusCode >= 500) {
            this.metrics.errors.count++;
        }

        // Update percentiles
        this._updatePercentiles();
    }

    /**
     * Update response time percentiles
     */
    _updatePercentiles() {
        const times = [...this.metrics.responses.responseTimes].sort((a, b) => a - b);

        if (times.length === 0) return;

        const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
        const p95Index = Math.floor(times.length * 0.95);
        const p99Index = Math.floor(times.length * 0.99);

        this.metrics.responses.avgTime = Math.round(avg);
        this.metrics.responses.p95Time = times[p95Index] || 0;
        this.metrics.responses.p99Time = times[p99Index] || 0;
    }

    /**
     * Start metrics collection
     */
    _startMetricsCollection() {
        // Update requests per minute every 10 seconds
        setInterval(() => {
            const now = Date.now();
            const oneMinuteAgo = now - 60000;

            // Remove old timestamps
            this.metrics.requests.lastMinute = this.metrics.requests.lastMinute.filter(
                t => t > oneMinuteAgo
            );

            // Update requests per minute
            this.metrics.requests.perMinute = this.metrics.requests.lastMinute.length;

            // Update error rate
            const totalRequests = this.metrics.requests.total;
            this.metrics.errors.rate = totalRequests > 0
                ? this.metrics.errors.count / totalRequests
                : 0;
        }, 10000);
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        const memUsage = process.memoryUsage();

        return {
            requestsPerMinute: this.metrics.requests.perMinute,
            totalRequests: this.metrics.requests.total,
            avgResponseTime: this.metrics.responses.avgTime,
            p95ResponseTime: this.metrics.responses.p95Time,
            p99ResponseTime: this.metrics.responses.p99Time,
            errorRate: this.metrics.errors.rate.toFixed(4),
            errorCount: this.metrics.errors.count,
            memoryUsage: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
                rss: Math.round(memUsage.rss / 1024 / 1024)
            },
            cpuPercent: this._getCPUUsage()
        };
    }

    /**
     * Get CPU usage percentage (approximate)
     */
    _getCPUUsage() {
        const cpuUsage = process.cpuUsage();
        const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000; // microseconds to milliseconds
        const uptime = process.uptime() * 1000; // seconds to milliseconds

        return Math.min(100, Math.round((totalUsage / uptime) * 100));
    }
}

// ============================
// STANDARD HEALTH CHECKS
// ============================

/**
 * Database health check
 */
export async function databaseCheck(supabase) {
    const startTime = Date.now();

    try {
        // Simple query to verify connection
        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .limit(1);

        if (error) throw error;

        const latency = Date.now() - startTime;

        return {
            connection: 'active',
            latency,
            status: latency > 1000 ? 'degraded' : 'ok'
        };
    } catch (error) {
        logger.error('Database health check failed', { error });
        throw error;
    }
}

/**
 * Cache health check
 */
export function cacheCheck(cache) {
    try {
        // Calculate hit rate
        const stats = cache.getStats ? cache.getStats() : {};

        return {
            entries: cache.store ? cache.store.size : 0,
            hitRate: stats.hitRate || 0,
            memoryMB: stats.size ? (stats.size / 1024 / 1024).toFixed(2) : 0,
            status: stats.hitRate > 0.5 ? 'ok' : 'degraded'
        };
    } catch (error) {
        logger.error('Cache health check failed', { error });
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
}

/**
 * WebSocket health check
 */
export function websocketCheck(wsClients) {
    try {
        const connections = wsClients ? wsClients.size : 0;

        return {
            connections,
            status: 'ok'
        };
    } catch (error) {
        logger.error('WebSocket health check failed', { error });
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
}

// ============================
// EXPORTS
// ============================

export { HealthChecker, HealthCheckResult };

// Create default health checker
export const healthChecker = new HealthChecker();

export default healthChecker;
