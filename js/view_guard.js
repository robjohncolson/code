/**
 * view_guard.js - View-Level Access Control
 * Part of AP Statistics Consensus Quiz
 *
 * Protects teacher-only features and handles unauthorized access
 * using DOM attributes and mutation observers.
 */

class ViewGuard {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.observer = null;
        this.initialized = false;

        // Bind methods
        this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
        this.handleMutation = this.handleMutation.bind(this);
    }

    /**
     * Initialize view guard system
     */
    initialize() {
        if (this.initialized) return;

        // Listen for auth state changes
        this.sessionManager.on(
            this.sessionManager.EVENTS.AUTH_STATE_CHANGED,
            this.handleAuthStateChange
        );

        // Apply guards to existing content
        this.applyGuards();

        // Watch for dynamically added content
        this.setupMutationObserver();

        this.initialized = true;
        console.log('[ViewGuard] Initialized');
    }

    /**
     * Set up mutation observer to watch for new protected elements
     */
    setupMutationObserver() {
        this.observer = new MutationObserver(this.handleMutation);

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-auth-required']
        });
    }

    /**
     * Handle DOM mutations
     */
    handleMutation(mutations) {
        let needsUpdate = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.hasAttribute('data-auth-required')) {
                            needsUpdate = true;
                        }
                        // Check descendants
                        if (node.querySelectorAll) {
                            const protected = node.querySelectorAll('[data-auth-required]');
                            if (protected.length > 0) {
                                needsUpdate = true;
                            }
                        }
                    }
                });
            } else if (mutation.type === 'attributes') {
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.applyGuards();
        }
    }

    /**
     * Apply guards to all protected elements
     */
    applyGuards() {
        const protectedElements = document.querySelectorAll('[data-auth-required]');

        protectedElements.forEach(element => {
            this.checkAccess(element);
        });
    }

    /**
     * Check access for a specific element
     */
    checkAccess(element) {
        const requiredAuth = element.getAttribute('data-auth-required');
        const fallbackMode = element.getAttribute('data-auth-fallback') || 'hide';
        const customMessage = element.getAttribute('data-auth-message');

        const isAuthenticated = this.sessionManager.isAuthenticated;
        const isTeacher = this.sessionManager.isTeacher();

        let hasAccess = false;

        switch (requiredAuth) {
            case 'none':
                hasAccess = true; // Public content
                break;
            case 'student':
                hasAccess = isAuthenticated; // Any authenticated user
                break;
            case 'teacher':
                hasAccess = isAuthenticated && isTeacher; // Teachers only
                break;
            case 'any':
            default:
                hasAccess = isAuthenticated; // Any authenticated user
                break;
        }

        if (hasAccess) {
            this.grantAccess(element);
        } else {
            this.denyAccess(element, fallbackMode, customMessage, requiredAuth);
        }
    }

    /**
     * Grant access to protected element
     */
    grantAccess(element) {
        // Remove any unauthorized overlays
        const overlay = element.querySelector('.auth-required-overlay');
        if (overlay) {
            overlay.remove();
        }

        // Show element
        element.style.display = '';
        element.removeAttribute('aria-hidden');

        // Remove disabled state from interactive elements
        if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
            element.disabled = false;
        }

        // Enable links
        if (element.tagName === 'A') {
            element.style.pointerEvents = '';
        }
    }

    /**
     * Deny access to protected element
     */
    denyAccess(element, fallbackMode, customMessage, requiredAuth) {
        switch (fallbackMode) {
            case 'hide':
                this.hideElement(element);
                break;

            case 'message':
                this.showUnauthorizedMessage(element, customMessage, requiredAuth);
                break;

            case 'redirect':
                // Redirect is handled by caller
                break;

            case 'disable':
                this.disableElement(element);
                break;

            default:
                this.hideElement(element);
        }
    }

    /**
     * Hide protected element
     */
    hideElement(element) {
        element.style.display = 'none';
        element.setAttribute('aria-hidden', 'true');
    }

    /**
     * Show unauthorized message overlay
     */
    showUnauthorizedMessage(element, customMessage, requiredAuth) {
        // Don't add overlay if one already exists
        if (element.querySelector('.auth-required-overlay')) {
            return;
        }

        const message = customMessage || this.getDefaultMessage(requiredAuth);

        const overlay = document.createElement('div');
        overlay.className = 'auth-required-overlay';
        overlay.innerHTML = `
            <div class="auth-required-message">
                <div class="auth-icon">🔒</div>
                <div class="auth-text">${this.escapeHtml(message)}</div>
                ${!this.sessionManager.isAuthenticated ? `
                    <button class="auth-login-button" onclick="authUI?.showLoginModal()">
                        Login to Access
                    </button>
                ` : ''}
            </div>
        `;

        // Position overlay
        const position = window.getComputedStyle(element).position;
        if (position === 'static') {
            element.style.position = 'relative';
        }

        element.appendChild(overlay);
        element.setAttribute('aria-label', message);
    }

    /**
     * Disable interactive element
     */
    disableElement(element) {
        if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
            element.disabled = true;
            element.title = 'Login required';
        }

        if (element.tagName === 'A') {
            element.style.pointerEvents = 'none';
            element.style.opacity = '0.5';
            element.title = 'Login required';
        }
    }

    /**
     * Get default unauthorized message
     */
    getDefaultMessage(requiredAuth) {
        const messages = {
            student: 'Please login to access this feature',
            teacher: 'This feature is only available to teachers',
            any: 'Authentication required to access this content'
        };

        return messages[requiredAuth] || messages.any;
    }

    /**
     * Handle auth state changes
     */
    handleAuthStateChange(event) {
        console.log('[ViewGuard] Auth state changed, reapplying guards');
        this.applyGuards();
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Destroy view guard (cleanup)
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.sessionManager.off(
            this.sessionManager.EVENTS.AUTH_STATE_CHANGED,
            this.handleAuthStateChange
        );

        this.initialized = false;
    }
}

// CSS for unauthorized overlay (inject dynamically)
const overlayStyles = `
    .auth-required-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 100;
        border-radius: inherit;
    }

    .auth-required-message {
        text-align: center;
        padding: 2rem;
        max-width: 300px;
    }

    .auth-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }

    .auth-text {
        font-size: 1rem;
        color: #666;
        margin-bottom: 1.5rem;
        line-height: 1.5;
    }

    .auth-login-button {
        padding: 0.75rem 1.5rem;
        background: var(--primary-color, #4a90e2);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .auth-login-button:hover {
        background: #3a7bc8;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
    }
`;

// Inject styles
if (!document.getElementById('view-guard-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'view-guard-styles';
    styleElement.textContent = overlayStyles;
    document.head.appendChild(styleElement);
}

// Create global instance (will be initialized by init.js)
window.viewGuard = null;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewGuard;
}