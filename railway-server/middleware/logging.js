/**
 * logging.js - Express Logging Middleware
 * Request/response logging with automatic PII redaction
 */

import logger, { generateRequestId } from '../lib/logger.js';
import healthChecker from '../lib/health.js';

/**
 * Request logging middleware
 * Logs all incoming requests with timing and context
 */
export function requestLogging(req, res, next) {
    // Generate unique request ID
    const requestId = generateRequestId();
    req.requestId = requestId;

    // Set request ID header for client
    res.setHeader('X-Request-Id', requestId);

    // Track request start time
    const startTime = process.hrtime();

    // Create request-scoped logger
    req.logger = logger.child({
        requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.username ? logger.redactor.hash(req.user.username) : null
    });

    // Log request start
    req.logger.debug('Request started', {
        query: req.query,
        headers: {
            'user-agent': req.get('user-agent'),
            'content-type': req.get('content-type')
        }
    });

    // Capture original end function
    const originalEnd = res.end;

    // Override res.end to log response
    res.end = function (chunk, encoding) {
        // Restore original end
        res.end = originalEnd;

        // Calculate duration
        const diff = process.hrtime(startTime);
        const duration = diff[0] * 1000 + diff[1] / 1000000; // Convert to ms

        // Determine log level based on status code
        const statusCode = res.statusCode;
        let logLevel = 'info';
        if (statusCode >= 500) logLevel = 'error';
        else if (statusCode >= 400) logLevel = 'warn';

        // Log request completion
        req.logger[logLevel]('Request completed', {
            statusCode,
            duration: Math.round(duration),
            contentLength: res.get('content-length')
        });

        // P11: Track metrics
        healthChecker.trackRequest(Math.round(duration), statusCode);

        // Call original end
        res.end(chunk, encoding);
    };

    next();
}

/**
 * Error logging middleware
 * Logs all errors before sending to client
 */
export function errorLogging(err, req, res, next) {
    // Log error with context
    const errorLogger = req.logger || logger;

    errorLogger.error('Request error', {
        error: {
            name: err.name,
            message: err.message,
            stack: process.env.NODE_ENV === 'production'
                ? '[REDACTED]'
                : err.stack?.split('\n').slice(0, 5).join('\n')
        },
        statusCode: err.statusCode || 500,
        requestId: req.requestId
    });

    next(err);
}

/**
 * Access log middleware (Apache/NGINX style)
 * Simplified logging for production
 */
export function accessLog(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const userId = req.user?.username ? logger.redactor.hash(req.user.username) : '-';

        // Apache Common Log Format (with userId instead of remote user)
        const logLine = [
            req.ip || req.connection.remoteAddress,
            userId,
            `[${new Date().toISOString()}]`,
            `"${req.method} ${req.originalUrl} HTTP/${req.httpVersion}"`,
            res.statusCode,
            res.get('content-length') || '-',
            `${duration}ms`
        ].join(' ');

        // Log based on status
        if (res.statusCode >= 500) {
            logger.error('Access log', { access: logLine });
        } else if (res.statusCode >= 400) {
            logger.warn('Access log', { access: logLine });
        } else {
            logger.info('Access log', { access: logLine });
        }
    });

    next();
}

export default { requestLogging, errorLogging, accessLog };
