/**
 * Notification System for User Feedback
 * Provides visual feedback for storage issues and chart operations
 */

(function() {
    'use strict';

    let notificationContainer = null;
    let activeNotifications = [];

    /**
     * Initialize notification container
     */
    function initNotifications() {
        // Check if container already exists
        if (document.getElementById('notification-container')) {
            notificationContainer = document.getElementById('notification-container');
            return;
        }

        // Create container
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(notificationContainer);
    }

    /**
     * Show a notification message
     * @param {string} message - The message to display
     * @param {string} type - Type of message: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (0 = persistent)
     */
    function showMessage(message, type = 'info', duration = 5000) {
        if (!notificationContainer) {
            initNotifications();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        // Set styles based on type
        const colors = {
            success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724', icon: '✅' },
            error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24', icon: '❌' },
            warning: { bg: '#fff3cd', border: '#ffeeba', text: '#856404', icon: '⚠️' },
            info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460', icon: 'ℹ️' }
        };

        const style = colors[type] || colors.info;

        notification.style.cssText = `
            background-color: ${style.bg};
            border: 1px solid ${style.border};
            color: ${style.text};
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease-out;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
        `;

        // Add content
        notification.innerHTML = `
            <span style="font-size: 18px; flex-shrink: 0;">${style.icon}</span>
            <div style="flex: 1;">
                <div>${message}</div>
                ${type === 'error' || type === 'warning' ?
                    '<div style="margin-top: 4px; font-size: 12px; opacity: 0.8;">Click to dismiss</div>' :
                    ''}
            </div>
            ${duration === 0 ?
                `<button onclick="window.notifications.dismiss(this.parentElement)" style="
                    background: none;
                    border: none;
                    color: ${style.text};
                    cursor: pointer;
                    padding: 0;
                    font-size: 18px;
                    line-height: 1;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">×</button>` :
                ''}
        `;

        // Add click to dismiss for errors and warnings
        if (type === 'error' || type === 'warning') {
            notification.style.cursor = 'pointer';
            notification.onclick = () => dismiss(notification);
        }

        // Add to container
        notificationContainer.appendChild(notification);
        activeNotifications.push(notification);

        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => dismiss(notification), duration);
        }

        // Log to console as well
        const consoleMethod = type === 'error' ? 'error' :
                             type === 'warning' ? 'warn' : 'log';
        console[consoleMethod](`[${type.toUpperCase()}] ${message}`);

        return notification;
    }

    /**
     * Dismiss a notification
     * @param {HTMLElement} notification - The notification element to dismiss
     */
    function dismiss(notification) {
        if (!notification || !notification.parentElement) return;

        // Add fade out animation
        notification.style.animation = 'slideOut 0.3s ease-in';

        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
            // Remove from active notifications
            const index = activeNotifications.indexOf(notification);
            if (index > -1) {
                activeNotifications.splice(index, 1);
            }
        }, 300);
    }

    /**
     * Clear all notifications
     */
    function clearAll() {
        activeNotifications.forEach(notification => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        });
        activeNotifications = [];
    }

    /**
     * Show storage-specific notifications
     */
    const storageNotifications = {
        quotaExceeded: () => {
            showMessage(
                'Storage quota exceeded! Please export your data and clear old entries.',
                'error',
                0 // Persistent
            );
        },

        localStorageUnavailable: () => {
            showMessage(
                'LocalStorage is unavailable. Your data will not persist after closing the browser.',
                'warning',
                10000
            );
        },

        sessionStorageOnly: () => {
            showMessage(
                'Using session storage. Data will be lost when you close the browser.',
                'warning',
                10000
            );
        },

        memoryOnly: () => {
            showMessage(
                'No storage available! Data will be lost on page refresh. Export frequently!',
                'error',
                0 // Persistent
            );
        },

        hydrationSuccess: (count) => {
            showMessage(
                `Successfully loaded ${count} answers from cloud storage.`,
                'success',
                3000
            );
        },

        hydrationFailed: (error) => {
            showMessage(
                `Failed to load data from cloud: ${error}. Using local data only.`,
                'warning',
                7000
            );
        },

        chartSaved: () => {
            showMessage(
                'Chart saved successfully!',
                'success',
                2000
            );
        },

        chartLoadFailed: () => {
            showMessage(
                'Failed to load chart. The data may be corrupted.',
                'error',
                5000
            );
        },

        railwayConnected: () => {
            showMessage(
                'Connected to Railway server for real-time sync.',
                'success',
                3000
            );
        },

        railwayDisconnected: () => {
            showMessage(
                'Disconnected from Railway server. Working offline.',
                'warning',
                5000
            );
        },

        exportReady: () => {
            showMessage(
                'Data exported successfully! Check your downloads.',
                'success',
                3000
            );
        },

        importSuccess: (count) => {
            showMessage(
                `Successfully imported ${count} answers.`,
                'success',
                3000
            );
        },

        importFailed: (error) => {
            showMessage(
                `Import failed: ${error}`,
                'error',
                7000
            );
        }
    };

    // Add CSS animations
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
        initNotifications();
    }

    // Export to global scope
    window.notifications = {
        showMessage,
        dismiss,
        clearAll,
        storage: storageNotifications
    };

    // Also export showMessage directly for compatibility
    window.showMessage = showMessage;

    console.log('✅ Notification system loaded');

})();