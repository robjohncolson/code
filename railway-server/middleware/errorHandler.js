/**
 * Error Response Contracts and Handlers
 *
 * Standardized error handling for the AP Statistics Quiz API
 * All errors follow a consistent response format for client parsing
 */

// ============================================
// Error Classes
// ============================================

/**
 * Base API Error class
 * All custom errors extend from this
 */
export class APIError extends Error {
    constructor(message, status = 500, code = null) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.code = code;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            error: this.name,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp
        };
    }
}

/**
 * Validation Error
 * HTTP 400 - Bad Request
 */
export class ValidationError extends APIError {
    constructor(message, details = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            details: this.details
        };
    }
}

/**
 * Authentication Error
 * HTTP 401 - Unauthorized
 */
export class AuthenticationError extends APIError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTH_REQUIRED');
    }
}

/**
 * Authorization Error
 * HTTP 403 - Forbidden
 */
export class AuthorizationError extends APIError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'FORBIDDEN');
    }
}

/**
 * Not Found Error
 * HTTP 404 - Not Found
 */
export class NotFoundError extends APIError {
    constructor(resource, identifier) {
        super(`${resource} not found: ${identifier}`, 404, 'NOT_FOUND');
        this.resource = resource;
        this.identifier = identifier;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            resource: this.resource,
            identifier: this.identifier
        };
    }
}

/**
 * Conflict Error
 * HTTP 409 - Conflict
 */
export class ConflictError extends APIError {
    constructor(message, resource = null) {
        super(message, 409, 'CONFLICT');
        this.resource = resource;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            resource: this.resource
        };
    }
}

/**
 * Rate Limit Error
 * HTTP 429 - Too Many Requests
 */
export class RateLimitError extends APIError {
    constructor(message = 'Rate limit exceeded', retryAfter = 60) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
        this.retryAfter = retryAfter;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter
        };
    }
}

/**
 * Database Error
 * HTTP 500 - Internal Server Error
 */
export class DatabaseError extends APIError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, 500, 'DATABASE_ERROR');
        this.originalError = originalError;
    }

    toJSON() {
        const json = super.toJSON();
        // Don't expose internal database errors in production
        if (process.env.NODE_ENV !== 'production' && this.originalError) {
            json.debug = {
                originalError: this.originalError.message,
                code: this.originalError.code
            };
        }
        return json;
    }
}

/**
 * External Service Error
 * HTTP 502 - Bad Gateway
 */
export class ExternalServiceError extends APIError {
    constructor(service, message = 'External service unavailable') {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            service: this.service
        };
    }
}

// ============================================
// Error Response Contracts
// ============================================

/**
 * Standard error response format
 */
export const ErrorResponse = {
    /**
     * 400 Bad Request
     */
    badRequest: (message, details = []) => ({
        error: 'Bad Request',
        message: message,
        code: 'VALIDATION_ERROR',
        details: details,
        timestamp: new Date().toISOString()
    }),

    /**
     * 401 Unauthorized
     */
    unauthorized: (message = 'Authentication required') => ({
        error: 'Unauthorized',
        message: message,
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
    }),

    /**
     * 403 Forbidden
     */
    forbidden: (message = 'Insufficient permissions') => ({
        error: 'Forbidden',
        message: message,
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString()
    }),

    /**
     * 404 Not Found
     */
    notFound: (resource, identifier) => ({
        error: 'Not Found',
        message: `${resource} not found`,
        code: 'NOT_FOUND',
        resource: resource,
        identifier: identifier,
        timestamp: new Date().toISOString()
    }),

    /**
     * 409 Conflict
     */
    conflict: (message, resource = null) => ({
        error: 'Conflict',
        message: message,
        code: 'CONFLICT',
        resource: resource,
        timestamp: new Date().toISOString()
    }),

    /**
     * 429 Too Many Requests
     */
    tooManyRequests: (retryAfter = 60) => ({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfter,
        timestamp: new Date().toISOString()
    }),

    /**
     * 500 Internal Server Error
     */
    internalError: (message = 'An unexpected error occurred') => ({
        error: 'Internal Server Error',
        message: message,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    }),

    /**
     * 502 Bad Gateway
     */
    badGateway: (service) => ({
        error: 'Bad Gateway',
        message: 'External service unavailable',
        code: 'EXTERNAL_SERVICE_ERROR',
        service: service,
        timestamp: new Date().toISOString()
    })
};

// ============================================
// Error Handler Middleware
// ============================================

/**
 * Global error handler middleware
 * Catches all errors and returns standardized responses
 */
export function errorHandler(err, req, res, next) {
    // Log error for debugging
    console.error(`[${new Date().toISOString()}] Error in ${req.method} ${req.path}:`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        user: req.user?.username,
        ip: req.ip
    });

    // Handle known API errors
    if (err instanceof APIError) {
        return res.status(err.status).json(err.toJSON());
    }

    // Handle validation errors from express-validator
    if (err.name === 'ValidationError' && err.details) {
        return res.status(400).json(ErrorResponse.badRequest(err.message, err.details));
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(ErrorResponse.unauthorized('Invalid token'));
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json(ErrorResponse.unauthorized('Token expired'));
    }

    // Handle Supabase errors
    if (err.code && err.code.startsWith('PGRST')) {
        // PostgreSQL REST error codes
        if (err.code === 'PGRST116') {
            return res.status(404).json(ErrorResponse.notFound('Resource', 'unknown'));
        }
        if (err.code === 'PGRST201' || err.code === 'PGRST202') {
            return res.status(409).json(ErrorResponse.conflict('Duplicate entry'));
        }
    }

    // Handle database constraint violations
    if (err.code === '23505') { // Unique violation
        return res.status(409).json(ErrorResponse.conflict('Resource already exists'));
    }

    if (err.code === '23503') { // Foreign key violation
        return res.status(400).json(ErrorResponse.badRequest('Referenced resource does not exist'));
    }

    // Default to 500 Internal Server Error
    const isDevelopment = process.env.NODE_ENV === 'development';
    const response = ErrorResponse.internalError(
        isDevelopment ? err.message : 'An unexpected error occurred'
    );

    if (isDevelopment) {
        response.stack = err.stack;
    }

    res.status(500).json(response);
}

/**
 * Async error wrapper
 * Catches async errors and passes them to error handler
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Not found handler (404)
 * Used for unmatched routes
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        code: 'ROUTE_NOT_FOUND',
        timestamp: new Date().toISOString()
    });
}

// ============================================
// Error Utilities
// ============================================

/**
 * Validate required fields in request
 */
export function validateRequired(fields, data) {
    const missing = [];
    for (const field of fields) {
        if (!data[field]) {
            missing.push(field);
        }
    }

    if (missing.length > 0) {
        throw new ValidationError('Missing required fields', missing.map(f => ({
            field: f,
            message: `${f} is required`
        })));
    }
}

/**
 * Safe error serialization for logging
 * Removes sensitive information
 */
export function sanitizeError(err) {
    const sanitized = {
        message: err.message,
        name: err.name,
        code: err.code,
        status: err.status
    };

    // Remove sensitive patterns
    const sensitivePatterns = [
        /Bearer\s+[^\s]+/gi,  // JWT tokens
        /\b\d{3}-\d{2}-\d{4}\b/g,  // SSN
        /\b\d{4,}\b/g,  // Credit card numbers
        /\S+@\S+\.\S+/g  // Email addresses
    ];

    for (const pattern of sensitivePatterns) {
        sanitized.message = sanitized.message.replace(pattern, '[REDACTED]');
    }

    return sanitized;
}

/**
 * Create error response from Supabase error
 */
export function handleSupabaseError(error) {
    if (!error) return null;

    // Network errors
    if (error.message === 'Failed to fetch') {
        throw new ExternalServiceError('Supabase', 'Database service unavailable');
    }

    // Authentication errors
    if (error.message?.includes('JWT')) {
        throw new AuthenticationError('Invalid authentication token');
    }

    // RLS violations
    if (error.message?.includes('row-level security')) {
        throw new AuthorizationError('Access denied by security policy');
    }

    // Unique constraint violations
    if (error.code === '23505') {
        const match = error.message.match(/duplicate key value violates unique constraint "(.+)"/);
        const constraint = match?.[1] || 'unknown';
        throw new ConflictError(`Duplicate value for ${constraint}`);
    }

    // Foreign key violations
    if (error.code === '23503') {
        throw new ValidationError('Referenced resource does not exist');
    }

    // Default database error
    throw new DatabaseError(error.message, error);
}

// ============================================
// Error Logging
// ============================================

/**
 * Error logger with context
 */
export class ErrorLogger {
    constructor(context) {
        this.context = context;
    }

    log(level, message, error = null, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            context: this.context,
            message,
            ...metadata
        };

        if (error) {
            logEntry.error = sanitizeError(error);
        }

        // In production, send to logging service
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to logging service (e.g., Datadog, Sentry)
        }

        // Console output with color coding
        const colors = {
            error: '\x1b[31m',   // Red
            warn: '\x1b[33m',    // Yellow
            info: '\x1b[36m',    // Cyan
            debug: '\x1b[90m',   // Gray
            reset: '\x1b[0m'
        };

        const color = colors[level] || colors.reset;
        console.log(`${color}[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${colors.reset}`,
                   error ? logEntry.error : '');
    }

    error(message, error, metadata) {
        this.log('error', message, error, metadata);
    }

    warn(message, metadata) {
        this.log('warn', message, null, metadata);
    }

    info(message, metadata) {
        this.log('info', message, null, metadata);
    }

    debug(message, metadata) {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message, null, metadata);
        }
    }
}

// Export all error classes and utilities
export default {
    APIError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    ExternalServiceError,
    ErrorResponse,
    errorHandler,
    asyncHandler,
    notFoundHandler,
    validateRequired,
    sanitizeError,
    handleSupabaseError,
    ErrorLogger
};