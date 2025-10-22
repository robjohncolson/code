/**
 * error_toast.js - Toast Notification System
 * Part of AP Statistics Consensus Quiz
 *
 * Provides accessible toast notifications for errors, warnings, and info messages.
 * Replaces blocking alert() calls with non-intrusive notifications.
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 5000; // 5 seconds
        this.initialize();
    }

    /**
     * Initialize toast container
     */
    initialize() {
        // Create container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'false');
            document.body.appendChild(container);
            this.container = container;
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    show(message, type = 'info', duration = null) {
        // Limit number of toasts
        if (this.toasts.length >= this.maxToasts) {
            this.toasts[0].remove();
        }

        const toastDuration = duration !== null ? duration : this.defaultDuration;
        const toast = this.createToast(message, type, toastDuration);

        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);

        // Auto-dismiss if duration is set
        if (toastDuration > 0) {
            setTimeout(() => {
                this.dismiss(toast);
            }, toastDuration);
        }

        // Announce to screen readers
        this.announceToScreenReader(message, type);

        return toast;
    }

    /**
     * Create toast element
     */
    createToast(message, type, duration) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

        // Icon based on type
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const icon = icons[type] || icons.info;

        // Build toast content
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${this.escapeHtml(message)}</div>
            <button class="toast-close" aria-label="Dismiss notification" onclick="toastManager.dismiss(this.parentElement)">
                ×
            </button>
        `;

        // Add progress bar if auto-dismissing
        if (duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.className = 'toast-progress';
            progressBar.style.animationDuration = `${duration}ms`;
            toast.appendChild(progressBar);
        }

        return toast;
    }

    /**
     * Dismiss a toast
     */
    dismiss(toast) {
        if (!toast || !toast.classList) return;

        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');

        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    /**
     * Dismiss all toasts
     */
    dismissAll() {
        this.toasts.forEach(toast => this.dismiss(toast));
    }

    /**
     * Show success message
     */
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    /**
     * Show error message
     */
    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    /**
     * Show warning message
     */
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    /**
     * Show info message
     */
    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    /**
     * Show loading toast (persistent until manually dismissed)
     */
    loading(message) {
        const toast = this.show(message, 'info', 0);
        toast.classList.add('toast-loading');

        // Add spinner
        const spinner = document.createElement('div');
        spinner.className = 'toast-spinner';
        toast.querySelector('.toast-icon').innerHTML = '';
        toast.querySelector('.toast-icon').appendChild(spinner);

        return toast;
    }

    /**
     * Announce message to screen readers
     */
    announceToScreenReader(message, type) {
        const announcer = document.getElementById('sr-announcer');
        if (announcer) {
            const prefix = {
                success: 'Success: ',
                error: 'Error: ',
                warning: 'Warning: ',
                info: ''
            };

            announcer.textContent = (prefix[type] || '') + message;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
window.toastManager = new ToastManager();

// Convenience global function
window.showToast = function(message, type = 'info', duration) {
    return window.toastManager.show(message, type, duration);
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastManager;
}