/**
 * init.js - Application Initialization Orchestrator
 * Part of AP Statistics Consensus Quiz
 *
 * Coordinates non-blocking initialization sequence:
 * 1. DOM ready
 * 2. Start auth check (async)
 * 3. Render public content immediately
 * 4. Apply view guards
 * 5. Restore session if exists
 * 6. Unlock protected content when auth completes
 */

class AppInitializer {
    constructor() {
        this.initialized = false;
        this.initStartTime = Date.now();
        this.phases = {
            domReady: false,
            sessionManagerReady: false,
            authUIReady: false,
            viewGuardReady: false,
            appContentReady: false
        };

        // Feature flags
        this.features = window.AUTH_FEATURES || {
            enabled: true,
            enforceAuth: false,
            teacherAuth: true,
            autoRefresh: true,
            offlineMode: true
        };
    }

    /**
     * Initialize application
     * This is the main entry point called from DOMContentLoaded
     */
    async initialize() {
        if (this.initialized) return;

        console.log('[AppInit] Starting initialization...');
        this.logPhase('DOM Ready', true);

        try {
            // Phase 1: Initialize session manager (non-blocking)
            this.initSessionManager();

            // Phase 2: Render public content immediately (don't wait for auth)
            this.renderPublicContent();

            // Phase 3: Initialize auth UI
            await this.initAuthUI();

            // Phase 4: Initialize view guard
            await this.initViewGuard();

            // Phase 5: Restore existing session (if any)
            await this.restoreSession();

            // Phase 6: Mark as complete
            this.complete();

        } catch (error) {
            console.error('[AppInit] Initialization failed:', error);
            this.handleInitError(error);
        }
    }

    /**
     * Phase 1: Initialize session manager
     */
    initSessionManager() {
        if (!window.sessionManager) {
            console.warn('[AppInit] SessionManager not found, auth features disabled');
            this.features.enabled = false;
            return;
        }

        // Initialize asynchronously
        window.sessionManager.initialize().then(() => {
            this.logPhase('Session Manager Ready', true);
        }).catch(error => {
            console.error('[AppInit] Session manager init failed:', error);
            // Continue without auth
            this.features.enabled = false;
        });
    }

    /**
     * Phase 2: Render public content immediately
     */
    renderPublicContent() {
        console.log('[AppInit] Rendering public content...');

        // Call existing initialization if it exists
        if (typeof promptUsername === 'function') {
            // Don't call promptUsername directly anymore
            // Instead, check if we have a stored username
            const savedUsername = localStorage.getItem('consensusUsername');

            if (savedUsername && !window.sessionManager?.isAuthenticated) {
                // User has old localStorage data but no JWT session
                // Show welcome back or migrate to new auth
                console.log('[AppInit] Found legacy username, migration needed');
            }
        }

        this.logPhase('App Content Ready', true);
    }

    /**
     * Phase 3: Initialize auth UI
     */
    async initAuthUI() {
        if (!this.features.enabled) {
            console.log('[AppInit] Auth features disabled, skipping UI init');
            return;
        }

        if (!window.sessionManager) {
            return;
        }

        // Wait for session manager to be ready
        await this.waitForSessionManager();

        // Create auth UI if it doesn't exist
        if (!window.authUI) {
            window.authUI = new AuthUI(window.sessionManager);
        }

        // Wait for session manager ready event
        const readyPromise = new Promise(resolve => {
            if (window.sessionManager.isReady) {
                resolve();
            } else {
                window.sessionManager.addEventListener(
                    window.sessionManager.EVENTS.READY,
                    () => resolve(),
                    { once: true }
                );
            }
        });

        await readyPromise;

        // Initialize auth UI
        window.authUI.initialize();

        this.logPhase('Auth UI Ready', true);
    }

    /**
     * Phase 4: Initialize view guard
     */
    async initViewGuard() {
        if (!this.features.enabled) {
            console.log('[AppInit] Auth features disabled, skipping view guard');
            return;
        }

        if (!window.sessionManager) {
            return;
        }

        // Wait for session manager
        await this.waitForSessionManager();

        // Create view guard
        if (!window.ViewGuard) {
            console.warn('[AppInit] ViewGuard class not found');
            return;
        }

        window.viewGuard = new ViewGuard(window.sessionManager);
        window.viewGuard.initialize();

        this.logPhase('View Guard Ready', true);
    }

    /**
     * Phase 5: Restore existing session
     */
    async restoreSession() {
        if (!this.features.enabled || !window.sessionManager) {
            return;
        }

        // Session restoration already started in session manager init
        // Just wait for it to complete
        await this.waitForSessionManager();

        if (window.sessionManager.isAuthenticated) {
            const user = window.sessionManager.getUser();
            console.log('[AppInit] Session restored for user:', user?.username);

            // Trigger post-auth initialization if needed
            if (typeof initializeAfterAuth === 'function') {
                initializeAfterAuth();
            }
        } else {
            console.log('[AppInit] No existing session to restore');

            // Check if we should show login prompt
            if (this.features.enforceAuth) {
                window.authUI?.showLoginModal();
            }
        }
    }

    /**
     * Wait for session manager to be ready
     */
    async waitForSessionManager() {
        if (!window.sessionManager) {
            return;
        }

        if (window.sessionManager.isReady) {
            return;
        }

        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                console.warn('[AppInit] Session manager timeout');
                resolve();
            }, 5000);

            window.sessionManager.addEventListener(
                window.sessionManager.EVENTS.READY,
                () => {
                    clearTimeout(timeout);
                    resolve();
                },
                { once: true }
            );
        });
    }

    /**
     * Mark initialization as complete
     */
    complete() {
        this.initialized = true;
        const duration = Date.now() - this.initStartTime;

        console.log(`[AppInit] ✅ Initialization complete in ${duration}ms`);
        console.log('[AppInit] Phases:', this.phases);

        // Emit custom event for other modules
        const event = new CustomEvent('appInitialized', {
            detail: {
                duration,
                phases: this.phases,
                features: this.features
            }
        });
        window.dispatchEvent(event);

        // Call legacy initialization hook if exists
        if (typeof onAppInitialized === 'function') {
            onAppInitialized();
        }
    }

    /**
     * Handle initialization error
     */
    handleInitError(error) {
        console.error('[AppInit] ❌ Initialization error:', error);

        // Show user-friendly error
        if (window.showToast) {
            window.showToast(
                'Application initialization failed. Some features may not work correctly.',
                'error',
                10000
            );
        }

        // Continue with degraded functionality
        this.features.enabled = false;
        this.complete();
    }

    /**
     * Log phase completion
     */
    logPhase(phaseName, completed) {
        const key = phaseName.replace(/\s+/g, '').replace(/^./, str => str.toLowerCase());
        this.phases[key] = completed;
        console.log(`[AppInit] ${completed ? '✅' : '⏳'} ${phaseName}`);
    }

    /**
     * Get initialization status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            phases: this.phases,
            features: this.features,
            duration: Date.now() - this.initStartTime
        };
    }
}

// Create global initializer instance
window.appInitializer = new AppInitializer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.appInitializer.initialize();
    });
} else {
    // DOM already loaded
    window.appInitializer.initialize();
}

// Helper function for other modules to wait for initialization
window.waitForInit = function() {
    return new Promise(resolve => {
        if (window.appInitializer.initialized) {
            resolve();
        } else {
            window.addEventListener('appInitialized', () => resolve(), { once: true });
        }
    });
};

// Post-auth initialization hook (called after successful login)
window.initializeAfterAuth = function() {
    console.log('[AppInit] Running post-auth initialization');

    const user = window.sessionManager?.getUser();
    if (!user) return;

    // Update username in legacy code
    if (typeof currentUsername !== 'undefined') {
        window.currentUsername = user.username;
    }

    // Store in localStorage for backward compatibility
    localStorage.setItem('consensusUsername', user.username);

    // Initialize progress tracking if available
    if (typeof initializeProgressTracking === 'function') {
        initializeProgressTracking();
    }

    // Initialize class data if available
    if (typeof initClassData === 'function') {
        initClassData();
    }

    // Refresh current view
    if (typeof showUsernameWelcome === 'function') {
        showUsernameWelcome();
    }

    // Update username displays
    if (typeof updateCurrentUsernameDisplay === 'function') {
        updateCurrentUsernameDisplay();
    }

    // Initialize progress sync if available
    if (typeof ProgressSync !== 'undefined' && !window.progressSync) {
        window.progressSync = new ProgressSync();
        window.progressSync.initialize().then(() => {
            console.log('[AppInit] Progress sync initialized');

            // Initialize progress UI
            if (typeof ProgressUI !== 'undefined' && !window.progressUI) {
                window.progressUI = new ProgressUI(window.progressSync);
                window.progressUI.initialize();
                console.log('[AppInit] Progress UI initialized');
            }

            // Load progress from server
            window.progressSync.loadAllProgress().then(() => {
                console.log('[AppInit] Progress loaded from server');
            });
        });
    }

    console.log('[AppInit] Post-auth initialization complete');
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppInitializer;
}