/**
 * logger.js - Structured Logging with PII Redaction
 * Production-grade logging system with automatic PII sanitization
 */

import crypto from 'crypto';

// ============================
// PII REDACTION
// ============================

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

    // Phone numbers (various formats)
    phone: /\b(\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,

    // SSN
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

    // Credit card (basic pattern)
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

    // IP addresses (will be hashed)
    ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // Fruit_Animal usernames (app-specific)
    username: /\b(Apple|Banana|Cherry|Date|Elderberry|Fig|Grape|Honeydew)_(Lion|Tiger|Bear|Eagle|Dolphin|Wolf|Fox|Hawk|Deer|Rabbit|Snake|Owl)\b/gi
};

/**
 * LogRedactor - Sanitizes logs to remove PII
 */
class LogRedactor {
    constructor() {
        // Daily salt for username hashing (rotates at midnight UTC)
        this.dailySalt = this._getDailySalt();
        this._lastSaltUpdate = new Date().toISOString().split('T')[0];
    }

    /**
     * Generate daily salt for hashing
     */
    _getDailySalt() {
        const today = new Date().toISOString().split('T')[0];
        return crypto.createHash('sha256').update(today + process.env.LOG_SALT || 'default-salt').digest('hex').substring(0, 16);
    }

    /**
     * Update salt if day has changed
     */
    _updateSaltIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        if (today !== this._lastSaltUpdate) {
            this.dailySalt = this._getDailySalt();
            this._lastSaltUpdate = today;
        }
    }

    /**
     * Hash sensitive data
     */
    hash(value) {
        if (!value) return '[REDACTED_NULL]';
        this._updateSaltIfNeeded();
        return 'hash_' + crypto
            .createHash('sha256')
            .update(value + this.dailySalt)
            .digest('hex')
            .substring(0, 8);
    }

    /**
     * Redact email addresses
     */
    redactEmail(text) {
        return text.replace(PII_PATTERNS.email, '[REDACTED_EMAIL]');
    }

    /**
     * Redact phone numbers
     */
    redactPhone(text) {
        return text.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');
    }

    /**
     * Redact SSN
     */
    redactSSN(text) {
        return text.replace(PII_PATTERNS.ssn, '[REDACTED_SSN]');
    }

    /**
     * Redact credit cards
     */
    redactCreditCard(text) {
        return text.replace(PII_PATTERNS.creditCard, '[REDACTED_CC]');
    }

    /**
     * Hash IP addresses
     */
    redactIP(text) {
        return text.replace(PII_PATTERNS.ipv4, (ip) => this.hash(ip));
    }

    /**
     * Hash usernames
     */
    redactUsername(text) {
        return text.replace(PII_PATTERNS.username, (username) => this.hash(username));
    }

    /**
     * Redact all PII from text
     */
    redact(text) {
        if (typeof text !== 'string') return text;

        let redacted = text;
        redacted = this.redactEmail(redacted);
        redacted = this.redactPhone(redacted);
        redacted = this.redactSSN(redacted);
        redacted = this.redactCreditCard(redacted);
        redacted = this.redactIP(redacted);
        redacted = this.redactUsername(redacted);

        return redacted;
    }

    /**
     * Recursively redact object properties
     */
    redactObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return typeof obj === 'string' ? this.redact(obj) : obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.redactObject(item));
        }

        const redacted = {};
        for (const [key, value] of Object.entries(obj)) {
            // Redact specific fields completely
            if (['password', 'token', 'secret', 'apiKey', 'reasoning', 'answer_text'].includes(key)) {
                redacted[key] = '[REDACTED_SENSITIVE]';
            } else if (key === 'username') {
                redacted[key] = this.hash(value);
            } else if (key === 'ip' || key === 'ipAddress') {
                redacted[key] = this.hash(value);
            } else if (typeof value === 'string') {
                redacted[key] = this.redact(value);
            } else if (typeof value === 'object') {
                redacted[key] = this.redactObject(value);
            } else {
                redacted[key] = value;
            }
        }

        return redacted;
    }
}

// ============================
// LOGGER
// ============================

/**
 * Log levels
 */
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

/**
 * Structured Logger with PII redaction
 */
class Logger {
    constructor(options = {}) {
        this.service = options.service || 'railway-server';
        this.level = options.level || process.env.LOG_LEVEL || 'info';
        this.redactor = new LogRedactor();
        this.sampleRate = options.sampleRate || {
            error: 1.0,  // 100% of errors
            warn: 1.0,   // 100% of warnings
            info: parseFloat(process.env.LOG_SAMPLE_RATE) || 0.01,  // 1% of info
            debug: 0.01  // 1% of debug
        };

        // Request context storage
        this.context = {};
    }

    /**
     * Check if log should be sampled
     */
    _shouldSample(level) {
        const rate = this.sampleRate[level] || 1.0;
        return Math.random() < rate;
    }

    /**
     * Check if level should be logged
     */
    _shouldLog(level) {
        return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
    }

    /**
     * Set context for current request
     */
    setContext(context) {
        this.context = { ...this.context, ...context };
    }

    /**
     * Clear context
     */
    clearContext() {
        this.context = {};
    }

    /**
     * Format log entry
     */
    _formatLog(level, message, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            ...this.context,
            ...metadata,
            message: typeof message === 'string' ? this.redactor.redact(message) : message
        };

        // Redact metadata
        if (metadata && typeof metadata === 'object') {
            const redactedMetadata = this.redactor.redactObject(metadata);
            Object.assign(entry, redactedMetadata);
        }

        return entry;
    }

    /**
     * Write log to output
     */
    _write(entry) {
        // In production, write as JSON to stdout (consumed by logging service)
        if (process.env.NODE_ENV === 'production') {
            console.log(JSON.stringify(entry));
        } else {
            // In development, pretty print
            const { timestamp, level, message, ...rest } = entry;
            const levelEmoji = {
                error: '❌',
                warn: '⚠️ ',
                info: 'ℹ️ ',
                debug: '🔍'
            };

            console.log(
                `${levelEmoji[level]} [${new Date(timestamp).toLocaleTimeString()}]`,
                message,
                Object.keys(rest).length > 0 ? rest : ''
            );
        }
    }

    /**
     * Log error
     */
    error(message, metadata = {}) {
        if (!this._shouldLog('error') || !this._shouldSample('error')) return;

        // Extract error details if metadata is Error object
        if (metadata instanceof Error) {
            metadata = {
                error: {
                    name: metadata.name,
                    message: this.redactor.redact(metadata.message),
                    stack: process.env.NODE_ENV === 'production'
                        ? '[REDACTED]'
                        : metadata.stack?.split('\n').slice(0, 3).join('\n')
                }
            };
        } else if (metadata.error instanceof Error) {
            metadata.error = {
                name: metadata.error.name,
                message: this.redactor.redact(metadata.error.message),
                stack: process.env.NODE_ENV === 'production'
                    ? '[REDACTED]'
                    : metadata.error.stack?.split('\n').slice(0, 3).join('\n')
            };
        }

        const entry = this._formatLog('error', message, metadata);
        this._write(entry);
    }

    /**
     * Log warning
     */
    warn(message, metadata = {}) {
        if (!this._shouldLog('warn') || !this._shouldSample('warn')) return;
        const entry = this._formatLog('warn', message, metadata);
        this._write(entry);
    }

    /**
     * Log info
     */
    info(message, metadata = {}) {
        if (!this._shouldLog('info') || !this._shouldSample('info')) return;
        const entry = this._formatLog('info', message, metadata);
        this._write(entry);
    }

    /**
     * Log debug
     */
    debug(message, metadata = {}) {
        if (!this._shouldLog('debug') || !this._shouldSample('debug')) return;
        const entry = this._formatLog('debug', message, metadata);
        this._write(entry);
    }

    /**
     * Create child logger with additional context
     */
    child(context) {
        const childLogger = new Logger({
            service: this.service,
            level: this.level,
            sampleRate: this.sampleRate
        });
        childLogger.context = { ...this.context, ...context };
        childLogger.redactor = this.redactor;
        return childLogger;
    }
}

// ============================
// REQUEST ID GENERATION
// ============================

/**
 * Generate unique request ID (nanoid-style)
 */
export function generateRequestId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'req_';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

/**
 * Generate unique session ID
 */
export function generateSessionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'sess_';
    for (let i = 0; i < 10; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// ============================
// EXPORTS
// ============================

// Create default logger instance
const logger = new Logger({
    service: 'railway-server',
    level: process.env.LOG_LEVEL || 'info'
});

export { Logger, LogRedactor, logger };
export default logger;
