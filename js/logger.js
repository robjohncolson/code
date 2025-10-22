/**
 * logger.js - Client-Side Structured Logging
 * Browser-based logging with PII redaction and remote error reporting
 */

// ============================
// PII REDACTION (Client-Side)
// ============================

/**
 * PII detection patterns (client-side)
 */
const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    phone: /\b(\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    username: /\b(Apple|Banana|Cherry|Date|Elderberry|Fig|Grape|Honeydew)_(Lion|Tiger|Bear|Eagle|Dolphin|Wolf|Fox|Hawk|Deer|Rabbit|Snake|Owl)\b/gi
};

/**
 * Simple hash function for browser (no crypto.subtle for simplicity)
 */
async function simpleHash(str) {
    if (!str) return '[REDACTED_NULL]';

    // Use SubtleCrypto if available
    if (window.crypto && window.crypto.subtle) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(str + getDailySalt());
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return 'hash_' + hashHex.substring(0, 8);
        } catch (e) {
            // Fallback to simple hash
        }
    }

    // Simple fallback hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(16).substring(0, 8);
}

/**
 * Get daily salt (changes daily)
 */
function getDailySalt() {
    const today = new Date().toISOString().split('T')[0];
    return today;
}

/**
 * ClientLogRedactor - Sanitize logs in browser
 */
class ClientLogRedactor {
    /**
     * Redact all PII from text
     */
    redact(text) {
        if (typeof text !== 'string') return text;

        let redacted = text;
        redacted = redacted.replace(PII_PATTERNS.email, '[REDACTED_EMAIL]');
        redacted = redacted.replace(PII_PATTERNS.phone, '[REDACTED_PHONE]');
        redacted = redacted.replace(PII_PATTERNS.ssn, '[REDACTED_SSN]');
        redacted = redacted.replace(PII_PATTERNS.creditCard, '[REDACTED_CC]');
        redacted = redacted.replace(PII_PATTERNS.username, '[REDACTED_USER]');

        return redacted;
    }

    /**
     * Redact object recursively
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
            // Sensitive fields
            if (['password', 'token', 'secret', 'reasoning', 'answer_text'].includes(key)) {
                redacted[key] = '[REDACTED_SENSITIVE]';
            } else if (key === 'username') {
                redacted[key] = '[REDACTED_USER]';
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

    /**
     * Sanitize stack trace
     */
    sanitizeStack(stack) {
        if (!stack) return '[NO_STACK]';

        // Remove file paths that might contain usernames
        let sanitized = stack.replace(/file:\/\/.*?\/([^\/]+\.js)/g, 'file://[PATH]/$1');

        // Keep only first 5 lines
        const lines = sanitized.split('\n').slice(0, 5);

        return lines.join('\n');
    }
}

// ============================
// CLIENT LOGGER
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
 * ClientLogger - Structured logging for browser
 */
class ClientLogger {
    constructor(options = {}) {
        this.service = 'client';
        this.level = options.level || 'info';
        this.redactor = new ClientLogRedactor();
        this.sessionId = this._getOrCreateSessionId();
        this.errorBuffer = [];
        this.maxBufferSize = 50;

        // Remote reporting config
        this.remoteEndpoint = options.remoteEndpoint || '/api/client-errors';
        this.reportingEnabled = options.reportingEnabled !== false;
        this.batchSize = 10;
        this.batchInterval = 60000; // 60 seconds

        // Start batch reporting
        if (this.reportingEnabled) {
            this._startBatchReporting();
        }

        // Hook into window errors
        this._setupGlobalErrorHandlers();
    }

    /**
     * Get or create session ID
     */
    _getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('logSessionId');
        if (!sessionId) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            sessionId = 'sess_';
            for (let i = 0; i < 10; i++) {
                sessionId += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            sessionStorage.setItem('logSessionId', sessionId);
        }
        return sessionId;
    }

    /**
     * Setup global error handlers
     */
    _setupGlobalErrorHandlers() {
        // Only setup once
        if (window.__loggerErrorHandlersSetup) return;
        window.__loggerErrorHandlersSetup = true;

        // Unhandled errors
        window.addEventListener('error', (event) => {
            this.error('Unhandled error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error ? {
                    name: event.error.name,
                    message: event.error.message,
                    stack: this.redactor.sanitizeStack(event.error.stack)
                } : null
            });
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled promise rejection', {
                reason: event.reason,
                promise: '[Promise]'
            });
        });
    }

    /**
     * Start batch reporting
     */
    _startBatchReporting() {
        setInterval(() => {
            this._flushErrorBuffer();
        }, this.batchInterval);

        // Flush on page unload
        window.addEventListener('beforeunload', () => {
            this._flushErrorBuffer(true);
        });
    }

    /**
     * Flush error buffer to server
     */
    _flushErrorBuffer(useBeacon = false) {
        if (this.errorBuffer.length === 0) return;

        const errors = this.errorBuffer.splice(0, this.batchSize);
        const payload = {
            sessionId: this.sessionId,
            errors,
            timestamp: new Date().toISOString()
        };

        if (useBeacon && navigator.sendBeacon) {
            // Use beacon for reliability on page unload
            navigator.sendBeacon(this.remoteEndpoint, JSON.stringify(payload));
        } else {
            // Normal fetch
            fetch(this.remoteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => {
                console.warn('Failed to send error report:', err);
            });
        }
    }

    /**
     * Add to error buffer
     */
    _bufferError(entry) {
        this.errorBuffer.push(entry);

        // Trim buffer if too large
        if (this.errorBuffer.length > this.maxBufferSize) {
            this.errorBuffer.shift();
        }

        // Flush immediately for errors
        if (entry.level === 'error' && this.errorBuffer.length >= 5) {
            this._flushErrorBuffer();
        }
    }

    /**
     * Check if level should be logged
     */
    _shouldLog(level) {
        return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
    }

    /**
     * Format log entry
     */
    _formatLog(level, message, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            sessionId: this.sessionId,
            userId: window.currentUsername ? '[REDACTED_USER]' : null,
            url: window.location.pathname,
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
     * Write log to console
     */
    _write(entry) {
        const { timestamp, level, message, ...rest } = entry;

        // Color-coded console output
        const styles = {
            error: 'color: #ff0000; font-weight: bold',
            warn: 'color: #ff9800; font-weight: bold',
            info: 'color: #2196f3',
            debug: 'color: #9e9e9e'
        };

        const levelEmoji = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🔍'
        };

        console.log(
            `%c${levelEmoji[level]} [${new Date(timestamp).toLocaleTimeString()}] ${message}`,
            styles[level],
            Object.keys(rest).length > 0 ? rest : ''
        );

        // Buffer errors for remote reporting
        if (level === 'error' && this.reportingEnabled) {
            this._bufferError(entry);
        }
    }

    /**
     * Log error
     */
    error(message, metadata = {}) {
        if (!this._shouldLog('error')) return;

        // Extract error details
        if (metadata instanceof Error) {
            metadata = {
                error: {
                    name: metadata.name,
                    message: this.redactor.redact(metadata.message),
                    stack: this.redactor.sanitizeStack(metadata.stack)
                }
            };
        } else if (metadata.error instanceof Error) {
            metadata.error = {
                name: metadata.error.name,
                message: this.redactor.redact(metadata.error.message),
                stack: this.redactor.sanitizeStack(metadata.error.stack)
            };
        }

        const entry = this._formatLog('error', message, metadata);
        this._write(entry);
    }

    /**
     * Log warning
     */
    warn(message, metadata = {}) {
        if (!this._shouldLog('warn')) return;
        const entry = this._formatLog('warn', message, metadata);
        this._write(entry);
    }

    /**
     * Log info
     */
    info(message, metadata = {}) {
        if (!this._shouldLog('info')) return;
        const entry = this._formatLog('info', message, metadata);
        this._write(entry);
    }

    /**
     * Log debug
     */
    debug(message, metadata = {}) {
        if (!this._shouldLog('debug')) return;
        const entry = this._formatLog('debug', message, metadata);
        this._write(entry);
    }

    /**
     * Track event
     */
    track(event, properties = {}) {
        this.info(`Event: ${event}`, { event, properties });
    }
}

// ============================
// EXPORTS
// ============================

// Create global logger instance
window.logger = new ClientLogger({
    level: localStorage.getItem('logLevel') || 'info',
    reportingEnabled: true
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClientLogger, ClientLogRedactor };
}

console.log('✅ Client logger initialized (sessionId: ' + window.logger.sessionId + ')');
