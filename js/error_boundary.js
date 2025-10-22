/**
 * error_boundary.js - Error Boundary & Recovery System
 * Graceful error handling with user-friendly UI and automatic recovery
 */

// ============================
// ERROR BOUNDARY
// ============================

/**
 * ErrorBoundary - Wraps functions to catch and handle errors gracefully
 */
class ErrorBoundary {
    constructor(options = {}) {
        this.name = options.name || 'ErrorBoundary';
        this.onError = options.onError || this._defaultErrorHandler;
        this.recoveryStrategies = options.recoveryStrategies || {};
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.retryCount = 0;
    }

    /**
     * Default error handler
     */
    _defaultErrorHandler(error, context) {
        if (window.logger) {
            window.logger.error(`Error in ${context}`, { error });
        }

        if (window.metricsCollector) {
            window.metricsCollector.trackError(error, { context });
        }

        // Show user-friendly error
        this.showErrorUI(error, context);
    }

    /**
     * Wrap synchronous function
     */
    wrap(fn, context = 'unknown') {
        return (...args) => {
            try {
                const result = fn.apply(this, args);
                this.retryCount = 0; // Reset on success
                return result;
            } catch (error) {
                this.onError(error, context);
                return null;
            }
        };
    }

    /**
     * Wrap async function
     */
    wrapAsync(fn, context = 'unknown') {
        return async (...args) => {
            try {
                const result = await fn.apply(this, args);
                this.retryCount = 0; // Reset on success
                return result;
            } catch (error) {
                this.onError(error, context);
                return null;
            }
        };
    }

    /**
     * Wrap function with retry logic
     */
    wrapWithRetry(fn, context = 'unknown') {
        return async (...args) => {
            let lastError;

            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    const result = await fn.apply(this, args);
                    this.retryCount = 0;
                    return result;
                } catch (error) {
                    lastError = error;

                    if (attempt < this.maxRetries) {
                        // Log retry attempt
                        if (window.logger) {
                            window.logger.warn(`Retry ${attempt + 1}/${this.maxRetries} for ${context}`, {
                                error: error.message
                            });
                        }

                        // Exponential backoff
                        await this._delay(this.retryDelay * Math.pow(2, attempt));
                    }
                }
            }

            // All retries failed
            this.onError(lastError, context);
            return null;
        };
    }

    /**
     * Delay helper
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Show error UI
     */
    showErrorUI(error, context) {
        // Use existing error toast system if available
        if (window.showMessage) {
            const message = this._getUserFriendlyMessage(error, context);
            window.showMessage(message, 'error');
        } else {
            // Fallback to console
            console.error(`Error in ${context}:`, error);
        }

        // Show error boundary UI
        this._showErrorBoundaryUI(error, context);
    }

    /**
     * Get user-friendly error message
     */
    _getUserFriendlyMessage(error, context) {
        // Map technical errors to user-friendly messages
        const errorMessages = {
            'Network': 'Unable to connect. Please check your internet connection.',
            'TypeError': 'Something went wrong. Please try refreshing the page.',
            'QuotaExceededError': 'Storage is full. Try clearing some old data.',
            'ChartRenderError': 'Unable to display chart. Continuing without visualization.',
            'DataLoadError': 'Failed to load data. Retrying...',
            'AuthError': 'Session expired. Please log in again.'
        };

        // Try to match error type
        for (const [key, message] of Object.entries(errorMessages)) {
            if (error.name.includes(key) || error.message.includes(key)) {
                return message;
            }
        }

        // Default message
        return `An error occurred in ${context}. We're working to resolve it.`;
    }

    /**
     * Show inline error boundary UI
     */
    _showErrorBoundaryUI(error, context) {
        const errorId = `error-boundary-${Date.now()}`;

        const errorHTML = `
            <div id="${errorId}" class="error-boundary" role="alert">
                <div class="error-boundary-content">
                    <div class="error-boundary-icon">⚠️</div>
                    <div class="error-boundary-message">
                        <h4>Something went wrong</h4>
                        <p>${this._getUserFriendlyMessage(error, context)}</p>
                    </div>
                    <div class="error-boundary-actions">
                        <button onclick="window.errorBoundary.retry('${context}', '${errorId}')" class="btn btn-sm">
                            Retry
                        </button>
                        <button onclick="window.errorBoundary.dismiss('${errorId}')" class="btn btn-sm btn-secondary">
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insert error UI (non-blocking, inline)
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.insertAdjacentHTML('afterbegin', errorHTML);
        } else {
            // Fallback: insert at top of body
            document.body.insertAdjacentHTML('afterbegin', errorHTML);
        }

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            this.dismiss(errorId);
        }, 10000);
    }

    /**
     * Retry operation
     */
    retry(context, errorId) {
        if (window.logger) {
            window.logger.info(`User initiated retry for ${context}`);
        }

        this.dismiss(errorId);

        // Refresh page for now (can be improved with specific retry logic)
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    /**
     * Dismiss error UI
     */
    dismiss(errorId) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.style.opacity = '0';
            errorElement.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                errorElement.remove();
            }, 300);
        }
    }
}

// ============================
// RECOVERY STRATEGIES
// ============================

/**
 * NetworkErrorRecovery - Handle network errors
 */
class NetworkErrorRecovery {
    constructor() {
        this.isOffline = !navigator.onLine;
        this.offlineBanner = null;

        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    /**
     * Handle offline state
     */
    handleOffline() {
        this.isOffline = true;

        if (window.logger) {
            window.logger.warn('Network connection lost');
        }

        // Show offline banner
        this.showOfflineBanner();
    }

    /**
     * Handle online state
     */
    handleOnline() {
        this.isOffline = false;

        if (window.logger) {
            window.logger.info('Network connection restored');
        }

        // Hide offline banner
        this.hideOfflineBanner();

        // Retry pending operations
        this.retryPendingOperations();
    }

    /**
     * Show offline banner
     */
    showOfflineBanner() {
        if (this.offlineBanner) return;

        this.offlineBanner = document.createElement('div');
        this.offlineBanner.id = 'offline-banner';
        this.offlineBanner.className = 'offline-banner';
        this.offlineBanner.innerHTML = `
            <div class="offline-banner-content">
                <span class="offline-icon">📡</span>
                <span>You're offline. Changes will sync when connection is restored.</span>
            </div>
        `;

        document.body.insertAdjacentElement('afterbegin', this.offlineBanner);
    }

    /**
     * Hide offline banner
     */
    hideOfflineBanner() {
        if (this.offlineBanner) {
            this.offlineBanner.style.opacity = '0';
            this.offlineBanner.style.transition = 'opacity 0.5s';

            setTimeout(() => {
                if (this.offlineBanner && this.offlineBanner.parentNode) {
                    this.offlineBanner.remove();
                }
                this.offlineBanner = null;
            }, 500);
        }
    }

    /**
     * Retry pending operations
     */
    retryPendingOperations() {
        // Check if there are pending sync operations
        if (window.syncManager && window.syncManager.hasPendingOperations) {
            window.syncManager.syncNow();
        }

        // Show success message
        if (window.showMessage) {
            window.showMessage('Connection restored. Syncing data...', 'success');
        }
    }
}

/**
 * ChartErrorRecovery - Handle chart rendering errors
 */
class ChartErrorRecovery {
    static handleChartError(error, chartType, containerId) {
        if (window.logger) {
            window.logger.error('Chart rendering failed', {
                error,
                chartType,
                containerId
            });
        }

        // Show placeholder
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="chart-error-placeholder">
                    <div class="chart-error-icon">📊</div>
                    <p>Chart temporarily unavailable</p>
                    <button onclick="location.reload()" class="btn btn-sm">Reload</button>
                </div>
            `;
        }
    }
}

/**
 * DataErrorRecovery - Handle data corruption
 */
class DataErrorRecovery {
    static handleDataError(error, dataKey) {
        if (window.logger) {
            window.logger.error('Data error detected', { error, dataKey });
        }

        // Try to clear corrupted data
        try {
            localStorage.removeItem(dataKey);
            if (window.logger) {
                window.logger.info('Corrupted data cleared', { dataKey });
            }

            // Reload page to reinitialize
            if (window.showMessage) {
                window.showMessage('Data reset. Reloading...', 'info');
            }

            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (clearError) {
            if (window.logger) {
                window.logger.error('Failed to clear corrupted data', { clearError });
            }
        }
    }
}

// ============================
// EXPORTS & INITIALIZATION
// ============================

// Create global error boundary
if (typeof window !== 'undefined') {
    window.errorBoundary = new ErrorBoundary({
        name: 'GlobalErrorBoundary',
        maxRetries: 3,
        retryDelay: 1000
    });

    // Create network recovery
    window.networkRecovery = new NetworkErrorRecovery();

    // Export recovery strategies
    window.ChartErrorRecovery = ChartErrorRecovery;
    window.DataErrorRecovery = DataErrorRecovery;

    // Add error container to DOM if not exists
    if (!document.getElementById('error-container')) {
        const errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        errorContainer.className = 'error-container';
        document.body.appendChild(errorContainer);
    }

    console.log('✅ Error boundary system initialized');
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ErrorBoundary,
        NetworkErrorRecovery,
        ChartErrorRecovery,
        DataErrorRecovery
    };
}
