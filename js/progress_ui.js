/**
 * progress_ui.js - Progress Sync UI Components
 * Part of AP Statistics Consensus Quiz
 *
 * Provides visual feedback for progress synchronization:
 * - Sync status indicator (syncing/synced/failed/offline)
 * - Progress bar for batch operations
 * - Toast notifications for sync events
 * - Offline mode indicator
 * - Manual sync button
 */

class ProgressUI {
    constructor(progressSync) {
        this.progressSync = progressSync;
        this.container = null;
        this.statusIndicator = null;
        this.progressBar = null;
        this.offlineIndicator = null;
        this.syncButton = null;
        this.toastContainer = null;

        // State
        this.currentStatus = 'idle'; // idle, syncing, synced, failed, offline
        this.isOnline = navigator.onLine;
        this.lastSyncTime = null;
        this.activeToasts = [];

        // Configuration
        this.config = {
            toastDuration: 3000,
            syncedMessageDuration: 2000,
            showProgressBar: true,
            showToasts: true,
            showOfflineIndicator: true,
            autoHideDelay: 3000
        };

        this.bindEvents();
    }

    /**
     * Initialize UI components
     */
    initialize() {
        console.log('[ProgressUI] Initializing...');

        // Create UI container
        this.createContainer();

        // Create status indicator
        this.createStatusIndicator();

        // Create progress bar
        if (this.config.showProgressBar) {
            this.createProgressBar();
        }

        // Create offline indicator
        if (this.config.showOfflineIndicator) {
            this.createOfflineIndicator();
        }

        // Create sync button
        this.createSyncButton();

        // Create toast container
        if (this.config.showToasts) {
            this.createToastContainer();
        }

        // Listen to progress sync events
        this.attachProgressSyncListeners();

        // Update initial state
        this.updateOnlineStatus();

        console.log('[ProgressUI] Initialized');
    }

    /**
     * Create main container
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'progress-sync-ui';
        this.container.className = 'progress-sync-container';
        document.body.appendChild(this.container);
    }

    /**
     * Create status indicator
     */
    createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'sync-status-indicator';
        indicator.className = 'sync-status-indicator';
        indicator.innerHTML = `
            <div class="sync-status-icon">
                <svg class="sync-icon" viewBox="0 0 24 24" width="16" height="16">
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                <span class="sync-status-dot"></span>
            </div>
            <span class="sync-status-text">Idle</span>
        `;

        indicator.addEventListener('click', () => this.showSyncDetails());

        this.container.appendChild(indicator);
        this.statusIndicator = indicator;
    }

    /**
     * Create progress bar
     */
    createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.id = 'sync-progress-bar';
        progressBar.className = 'sync-progress-bar hidden';
        progressBar.innerHTML = `
            <div class="sync-progress-fill"></div>
            <span class="sync-progress-text">0/0</span>
        `;

        this.container.appendChild(progressBar);
        this.progressBar = progressBar;
    }

    /**
     * Create offline indicator
     */
    createOfflineIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator hidden';
        indicator.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"/>
            </svg>
            <span>Offline Mode</span>
        `;

        this.container.appendChild(indicator);
        this.offlineIndicator = indicator;
    }

    /**
     * Create manual sync button
     */
    createSyncButton() {
        const button = document.createElement('button');
        button.id = 'manual-sync-button';
        button.className = 'manual-sync-button';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            <span>Sync Now</span>
        `;
        button.title = 'Manually sync progress';

        button.addEventListener('click', () => this.manualSync());

        this.container.appendChild(button);
        this.syncButton = button;
    }

    /**
     * Create toast notification container
     */
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'sync-toast-container';
        container.className = 'sync-toast-container';
        document.body.appendChild(container);
        this.toastContainer = container;
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Online/offline detection
        window.addEventListener('online', () => {
            console.log('[ProgressUI] Online');
            this.isOnline = true;
            this.updateOnlineStatus();
            this.showToast('Back online! Syncing progress...', 'success');

            // Trigger sync when coming online
            if (this.progressSync) {
                this.progressSync.processOfflineQueue();
            }
        });

        window.addEventListener('offline', () => {
            console.log('[ProgressUI] Offline');
            this.isOnline = false;
            this.updateOnlineStatus();
            this.showToast('You are offline. Changes will sync when you reconnect.', 'warning');
        });
    }

    /**
     * Attach listeners to progress sync events
     */
    attachProgressSyncListeners() {
        if (!this.progressSync) return;

        // Listen to progress sync events via custom events
        window.addEventListener('progressSyncStart', (e) => {
            this.onSyncStart(e.detail);
        });

        window.addEventListener('progressSyncSuccess', (e) => {
            this.onSyncSuccess(e.detail);
        });

        window.addEventListener('progressSyncError', (e) => {
            this.onSyncError(e.detail);
        });

        window.addEventListener('progressSyncBatchStart', (e) => {
            this.onBatchStart(e.detail);
        });

        window.addEventListener('progressSyncBatchProgress', (e) => {
            this.onBatchProgress(e.detail);
        });

        window.addEventListener('progressSyncBatchComplete', (e) => {
            this.onBatchComplete(e.detail);
        });

        window.addEventListener('progressSyncOfflineQueued', (e) => {
            this.onOfflineQueued(e.detail);
        });
    }

    /**
     * Update online/offline status
     */
    updateOnlineStatus() {
        if (this.isOnline) {
            this.offlineIndicator?.classList.add('hidden');
            this.updateStatus('idle');
        } else {
            this.offlineIndicator?.classList.remove('hidden');
            this.updateStatus('offline');
        }
    }

    /**
     * Update sync status
     * @param {string} status - idle, syncing, synced, failed, offline
     * @param {string} message - Optional status message
     */
    updateStatus(status, message = null) {
        this.currentStatus = status;

        if (!this.statusIndicator) return;

        const indicator = this.statusIndicator;
        const dot = indicator.querySelector('.sync-status-dot');
        const text = indicator.querySelector('.sync-status-text');
        const icon = indicator.querySelector('.sync-icon');

        // Remove all status classes
        indicator.classList.remove('status-idle', 'status-syncing', 'status-synced', 'status-failed', 'status-offline');

        // Add current status class
        indicator.classList.add(`status-${status}`);

        // Update text
        const statusTexts = {
            idle: message || 'Idle',
            syncing: message || 'Syncing...',
            synced: message || 'Synced',
            failed: message || 'Sync Failed',
            offline: message || 'Offline'
        };
        text.textContent = statusTexts[status];

        // Animate icon for syncing
        if (status === 'syncing') {
            icon.classList.add('spinning');
        } else {
            icon.classList.remove('spinning');
        }

        // Auto-hide "synced" status after delay
        if (status === 'synced') {
            setTimeout(() => {
                if (this.currentStatus === 'synced') {
                    this.updateStatus('idle');
                }
            }, this.config.autoHideDelay);
        }
    }

    /**
     * Show sync details in modal/tooltip
     */
    showSyncDetails() {
        const details = {
            status: this.currentStatus,
            online: this.isOnline,
            lastSync: this.lastSyncTime,
            queueSize: this.progressSync?.offlineQueue ? 'checking...' : 0
        };

        // Get queue size
        if (this.progressSync?.offlineQueue) {
            this.progressSync.offlineQueue.size().then(size => {
                details.queueSize = size;
                this.displaySyncDetails(details);
            });
        } else {
            this.displaySyncDetails(details);
        }
    }

    /**
     * Display sync details
     */
    displaySyncDetails(details) {
        const lastSyncText = details.lastSync
            ? new Date(details.lastSync).toLocaleTimeString()
            : 'Never';

        const message = `
Sync Status: ${details.status}
Online: ${details.online ? 'Yes' : 'No'}
Last Sync: ${lastSyncText}
Offline Queue: ${details.queueSize} operations
        `.trim();

        alert(message); // Simple alert for now, could be replaced with custom modal
    }

    /**
     * Manual sync triggered by user
     */
    async manualSync() {
        if (!this.progressSync) {
            this.showToast('Progress sync not available', 'error');
            return;
        }

        if (!this.isOnline) {
            this.showToast('Cannot sync while offline', 'warning');
            return;
        }

        // Disable button
        this.syncButton.disabled = true;
        this.syncButton.classList.add('syncing');

        try {
            this.showToast('Starting manual sync...', 'info');

            // Process offline queue
            await this.progressSync.processOfflineQueue();

            // Load latest from server
            await this.progressSync.loadAllProgress();

            this.showToast('Manual sync completed successfully', 'success');
        } catch (error) {
            console.error('[ProgressUI] Manual sync failed:', error);
            this.showToast(`Manual sync failed: ${error.message}`, 'error');
        } finally {
            // Re-enable button
            this.syncButton.disabled = false;
            this.syncButton.classList.remove('syncing');
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - success, error, warning, info
     * @param {number} duration - Duration in ms (default: config.toastDuration)
     */
    showToast(message, type = 'info', duration = null) {
        if (!this.config.showToasts || !this.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `sync-toast sync-toast-${type}`;

        // Icon based on type
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="sync-toast-icon">${icons[type] || icons.info}</span>
            <span class="sync-toast-message">${message}</span>
        `;

        this.toastContainer.appendChild(toast);
        this.activeToasts.push(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-remove after duration
        const toastDuration = duration !== null ? duration : this.config.toastDuration;
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                this.activeToasts = this.activeToasts.filter(t => t !== toast);
            }, 300); // Wait for fade-out animation
        }, toastDuration);
    }

    /**
     * Update progress bar
     * @param {number} current - Current progress
     * @param {number} total - Total items
     */
    updateProgressBar(current, total) {
        if (!this.progressBar) return;

        const fill = this.progressBar.querySelector('.sync-progress-fill');
        const text = this.progressBar.querySelector('.sync-progress-text');

        const percentage = total > 0 ? (current / total) * 100 : 0;

        fill.style.width = `${percentage}%`;
        text.textContent = `${current}/${total}`;

        // Show progress bar
        this.progressBar.classList.remove('hidden');

        // Hide when complete
        if (current >= total && total > 0) {
            setTimeout(() => {
                this.progressBar.classList.add('hidden');
            }, 1000);
        }
    }

    /**
     * Hide progress bar
     */
    hideProgressBar() {
        if (!this.progressBar) return;
        this.progressBar.classList.add('hidden');
    }

    // Event handlers for progress sync events

    onSyncStart(detail) {
        console.log('[ProgressUI] Sync started', detail);
        this.updateStatus('syncing', 'Syncing progress...');
    }

    onSyncSuccess(detail) {
        console.log('[ProgressUI] Sync succeeded', detail);
        this.lastSyncTime = Date.now();
        this.updateStatus('synced', 'Progress synced');

        // Only show toast for manual syncs or batch completions
        if (detail?.manual) {
            this.showToast('Progress saved successfully', 'success');
        }
    }

    onSyncError(detail) {
        console.error('[ProgressUI] Sync failed', detail);
        this.updateStatus('failed', 'Sync failed');
        this.showToast(`Sync failed: ${detail?.error || 'Unknown error'}`, 'error', 5000);
    }

    onBatchStart(detail) {
        console.log('[ProgressUI] Batch started', detail);
        this.updateStatus('syncing', `Syncing ${detail?.total || 0} items...`);

        if (detail?.total > 1) {
            this.updateProgressBar(0, detail.total);
        }
    }

    onBatchProgress(detail) {
        console.log('[ProgressUI] Batch progress', detail);
        this.updateProgressBar(detail?.current || 0, detail?.total || 0);
    }

    onBatchComplete(detail) {
        console.log('[ProgressUI] Batch complete', detail);
        this.lastSyncTime = Date.now();
        this.updateStatus('synced', `Synced ${detail?.total || 0} items`);

        if (detail?.total > 1) {
            this.showToast(`${detail.total} items synced successfully`, 'success');
        }

        this.hideProgressBar();
    }

    onOfflineQueued(detail) {
        console.log('[ProgressUI] Offline queued', detail);
        this.showToast('Saved locally. Will sync when online.', 'warning', 2000);
    }

    /**
     * Destroy UI components
     */
    destroy() {
        // Remove containers
        this.container?.remove();
        this.toastContainer?.remove();

        // Clear active toasts
        this.activeToasts.forEach(toast => toast.remove());
        this.activeToasts = [];

        console.log('[ProgressUI] Destroyed');
    }
}

// Export for use in other modules
window.ProgressUI = ProgressUI;

console.log('[ProgressUI] Module loaded');
