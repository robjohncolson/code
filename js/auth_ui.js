/**
 * auth_ui.js - Authentication UI Components
 * Part of AP Statistics Consensus Quiz
 *
 * Handles authentication UI rendering, modals, and DOM visibility control.
 * Designed for progressive enhancement with accessibility features.
 */

class AuthUI {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.initialized = false;
        this.currentModal = null;

        // Bind methods
        this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Initialize auth UI components
     * Non-blocking, progressive enhancement
     */
    initialize() {
        if (this.initialized) return;

        // Listen for auth state changes
        this.sessionManager.on(this.sessionManager.EVENTS.AUTH_STATE_CHANGED, this.handleAuthStateChange);
        this.sessionManager.on(this.sessionManager.EVENTS.SESSION_EXPIRED, () => {
            this.showSessionExpiredModal();
        });

        // Render initial UI state
        this.renderAuthHeader();
        this.updateAuthState(this.sessionManager.isAuthenticated);

        // Set up keyboard handlers
        document.addEventListener('keydown', this.handleKeyDown);

        this.initialized = true;
        console.log('[AuthUI] Initialized');
    }

    /**
     * Render authentication header controls
     */
    renderAuthHeader() {
        const authContainer = document.getElementById('auth-container');
        if (!authContainer) {
            console.warn('[AuthUI] auth-container not found in DOM');
            return;
        }

        const user = this.sessionManager.getUser();
        const isAuthenticated = this.sessionManager.isAuthenticated;
        const isOffline = this.sessionManager.isOffline();

        if (isAuthenticated && user) {
            // Show user info and logout button
            authContainer.innerHTML = `
                <div class="auth-header-content">
                    <div class="user-info">
                        <span class="user-avatar" aria-label="User">👤</span>
                        <span class="username-display" id="headerUsername">${this.escapeHtml(user.username)}</span>
                        ${user.is_teacher ? '<span class="teacher-badge" aria-label="Teacher">👩‍🏫</span>' : ''}
                        ${isOffline ? '<span class="offline-badge" aria-label="Offline mode" title="Working offline">📴</span>' : ''}
                    </div>
                    <button class="btn-logout"
                            onclick="authUI.logout()"
                            aria-label="Logout"
                            title="Logout">
                        Logout
                    </button>
                </div>
            `;
        } else {
            // Show login button
            authContainer.innerHTML = `
                <div class="auth-header-content">
                    <button class="btn-login"
                            onclick="authUI.showLoginModal()"
                            aria-label="Login"
                            title="Login or create account">
                        Login
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show login/create account modal
     */
    showLoginModal() {
        const modalHtml = `
            <div class="auth-modal-overlay" id="authModalOverlay" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
                <div class="auth-modal">
                    <div class="auth-modal-header">
                        <h2 id="authModalTitle">Welcome!</h2>
                        <button class="modal-close" onclick="authUI.closeModal()" aria-label="Close modal">&times;</button>
                    </div>

                    <div class="auth-modal-body">
                        <p class="modal-intro">Choose how you'd like to get started:</p>

                        <div class="auth-options">
                            <button class="auth-option-btn primary" onclick="authUI.showStudentFlow()">
                                <div class="option-icon">🎓</div>
                                <div class="option-content">
                                    <div class="option-title">Student</div>
                                    <div class="option-description">Get an anonymous username</div>
                                </div>
                            </button>

                            <button class="auth-option-btn secondary" onclick="authUI.showTeacherFlow()">
                                <div class="option-icon">👩‍🏫</div>
                                <div class="option-content">
                                    <div class="option-title">Teacher</div>
                                    <div class="option-description">Login with access code</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showModal(modalHtml);
    }

    /**
     * Show student authentication flow
     */
    showStudentFlow() {
        const suggestedUsername = this.generateUsername();

        const modalHtml = `
            <div class="auth-modal-overlay" id="authModalOverlay" role="dialog" aria-modal="true">
                <div class="auth-modal">
                    <div class="auth-modal-header">
                        <button class="modal-back" onclick="authUI.showLoginModal()" aria-label="Go back">←</button>
                        <h2>Student Login</h2>
                        <button class="modal-close" onclick="authUI.closeModal()" aria-label="Close">&times;</button>
                    </div>

                    <div class="auth-modal-body">
                        <div class="username-generator">
                            <p>Your anonymous username:</p>
                            <div class="generated-username" id="generatedUsername">${suggestedUsername}</div>
                            <button class="btn-regenerate" onclick="authUI.regenerateUsername()">
                                🎲 Try Another
                            </button>
                        </div>

                        <div class="class-code-input" style="margin-top: 20px;">
                            <label for="classCodeInput">Class Code (optional):</label>
                            <input type="text"
                                   id="classCodeInput"
                                   placeholder="e.g., STATS2024"
                                   maxlength="20"
                                   pattern="[A-Z0-9]{4,20}"
                                   autocomplete="off">
                        </div>

                        <div class="auth-actions">
                            <button class="btn-primary btn-large"
                                    onclick="authUI.createStudentAccount()"
                                    id="btnCreateStudent">
                                ✅ Let's Go!
                            </button>
                        </div>

                        <div class="auth-note">
                            💡 <strong>Important:</strong> Write down your username! You'll need it to restore your progress later.
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        // Focus on class code input for keyboard users
        setTimeout(() => {
            document.getElementById('classCodeInput')?.focus();
        }, 100);
    }

    /**
     * Show teacher authentication flow
     */
    showTeacherFlow() {
        const modalHtml = `
            <div class="auth-modal-overlay" id="authModalOverlay" role="dialog" aria-modal="true">
                <div class="auth-modal">
                    <div class="auth-modal-header">
                        <button class="modal-back" onclick="authUI.showLoginModal()" aria-label="Go back">←</button>
                        <h2>Teacher Login</h2>
                        <button class="modal-close" onclick="authUI.closeModal()" aria-label="Close">&times;</button>
                    </div>

                    <div class="auth-modal-body">
                        <form onsubmit="authUI.teacherLogin(event); return false;">
                            <div class="form-group">
                                <label for="teacherAccessCode">Access Code:</label>
                                <input type="password"
                                       id="teacherAccessCode"
                                       required
                                       autocomplete="off"
                                       placeholder="Enter teacher access code"
                                       aria-describedby="accessCodeHelp">
                                <small id="accessCodeHelp">Contact your administrator for the access code</small>
                            </div>

                            <div class="form-group">
                                <label for="teacherUsername">Username (optional):</label>
                                <input type="text"
                                       id="teacherUsername"
                                       placeholder="e.g., Teacher_Smith"
                                       pattern="[A-Za-z0-9_]{3,50}"
                                       autocomplete="username">
                            </div>

                            <div class="auth-actions">
                                <button type="submit" class="btn-primary btn-large" id="btnTeacherLogin">
                                    Login
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.showModal(modalHtml);

        // Focus on access code input
        setTimeout(() => {
            document.getElementById('teacherAccessCode')?.focus();
        }, 100);
    }

    /**
     * Show session expired modal
     */
    showSessionExpiredModal() {
        const modalHtml = `
            <div class="auth-modal-overlay" id="authModalOverlay" role="dialog" aria-modal="true" aria-live="assertive">
                <div class="auth-modal">
                    <div class="auth-modal-header">
                        <h2>Session Expired</h2>
                    </div>

                    <div class="auth-modal-body">
                        <p>Your session has expired. Please log in again to continue.</p>

                        <div class="auth-actions">
                            <button class="btn-primary" onclick="authUI.showLoginModal()">
                                Log In Again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showModal(modalHtml);
    }

    /**
     * Create student account
     */
    async createStudentAccount() {
        const username = document.getElementById('generatedUsername')?.textContent.trim();
        const classCode = document.getElementById('classCodeInput')?.value.trim() || null;
        const button = document.getElementById('btnCreateStudent');

        if (!username) {
            window.showToast('Please generate a username', 'error');
            return;
        }

        try {
            // Disable button and show loading
            button.disabled = true;
            button.textContent = 'Creating account...';

            // Create session
            const result = await this.sessionManager.createAnonymousSession(username, classCode);

            if (result.success) {
                window.showToast(`Welcome, ${username}!`, 'success');
                this.closeModal();
                this.renderAuthHeader();

                // Trigger app initialization if needed
                if (typeof initializeAfterAuth === 'function') {
                    initializeAfterAuth();
                }
            } else {
                throw new Error(result.message || 'Failed to create account');
            }
        } catch (error) {
            console.error('[AuthUI] Create account error:', error);
            window.showToast(error.message || 'Failed to create account. Please try again.', 'error');

            // Re-enable button
            button.disabled = false;
            button.textContent = '✅ Let\'s Go!';
        }
    }

    /**
     * Teacher login
     */
    async teacherLogin(event) {
        event.preventDefault();

        const accessCode = document.getElementById('teacherAccessCode')?.value.trim();
        const username = document.getElementById('teacherUsername')?.value.trim() || null;
        const button = document.getElementById('btnTeacherLogin');

        if (!accessCode) {
            window.showToast('Please enter access code', 'error');
            return;
        }

        try {
            // Disable button and show loading
            button.disabled = true;
            button.textContent = 'Logging in...';

            // Authenticate
            const result = await this.sessionManager.teacherLogin(accessCode, username);

            if (result.success) {
                window.showToast(`Welcome, ${result.user.username}!`, 'success');
                this.closeModal();
                this.renderAuthHeader();

                // Trigger app initialization
                if (typeof initializeAfterAuth === 'function') {
                    initializeAfterAuth();
                }
            } else {
                throw new Error(result.message || 'Invalid access code');
            }
        } catch (error) {
            console.error('[AuthUI] Teacher login error:', error);
            window.showToast(error.message || 'Invalid access code. Please try again.', 'error');

            // Re-enable button
            button.disabled = false;
            button.textContent = 'Login';
        }
    }

    /**
     * Logout user
     */
    async logout() {
        if (!confirm('Are you sure you want to logout?')) {
            return;
        }

        this.sessionManager.logout();
        this.renderAuthHeader();
        window.showToast('Logged out successfully', 'info');

        // Optionally redirect or reload
        // window.location.reload();
    }

    /**
     * Regenerate username
     */
    regenerateUsername() {
        const newUsername = this.generateUsername();
        const usernameDisplay = document.getElementById('generatedUsername');

        if (usernameDisplay) {
            // Animate the change
            usernameDisplay.style.opacity = '0';
            setTimeout(() => {
                usernameDisplay.textContent = newUsername;
                usernameDisplay.style.opacity = '1';
            }, 150);
        }
    }

    /**
     * Generate random Fruit_Animal username
     */
    generateUsername() {
        // Reuse existing arrays if available from auth.js
        const fruits = window.fruits || ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape'];
        const animals = window.animals || ['Aardvark', 'Badger', 'Cougar', 'Dolphin', 'Eagle', 'Fox', 'Giraffe'];

        const fruit = fruits[Math.floor(Math.random() * fruits.length)];
        const animal = animals[Math.floor(Math.random() * animals.length)];

        return `${fruit}_${animal}`;
    }

    /**
     * Show modal with HTML content
     */
    showModal(html) {
        // Remove existing modal if any
        this.closeModal();

        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', html);

        // Store reference
        this.currentModal = document.getElementById('authModalOverlay');

        // Trap focus in modal
        this.trapFocus(this.currentModal);

        // Announce to screen readers
        this.announceToScreenReader('Modal opened');
    }

    /**
     * Close current modal
     */
    closeModal() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
            this.announceToScreenReader('Modal closed');
        }
    }

    /**
     * Handle keyboard events (ESC to close modal)
     */
    handleKeyDown(event) {
        if (event.key === 'Escape' && this.currentModal) {
            this.closeModal();
        }
    }

    /**
     * Trap focus within modal for accessibility
     */
    trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        element.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    }

    /**
     * Handle auth state changes
     */
    handleAuthStateChange(event) {
        const { isAuthenticated } = event.detail;
        this.updateAuthState(isAuthenticated);
        this.renderAuthHeader();
    }

    /**
     * Update DOM visibility based on auth state
     */
    updateAuthState(isAuthenticated) {
        const isTeacher = this.sessionManager.isTeacher();

        // Update elements with data-auth-required attribute
        document.querySelectorAll('[data-auth-required]').forEach(element => {
            const required = element.getAttribute('data-auth-required');

            let shouldShow = false;

            switch (required) {
                case 'none':
                    shouldShow = true; // Always visible
                    break;
                case 'student':
                    shouldShow = isAuthenticated;
                    break;
                case 'teacher':
                    shouldShow = isAuthenticated && isTeacher;
                    break;
                default:
                    shouldShow = isAuthenticated;
            }

            if (shouldShow) {
                element.style.display = '';
                element.removeAttribute('aria-hidden');
            } else {
                element.style.display = 'none';
                element.setAttribute('aria-hidden', 'true');
            }
        });
    }

    /**
     * Announce message to screen readers
     */
    announceToScreenReader(message) {
        const announcer = document.getElementById('sr-announcer');
        if (announcer) {
            announcer.textContent = message;
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

// Create global instance (will be initialized after DOM ready)
window.authUI = null;

// Initialize after DOM is ready and sessionManager is available
document.addEventListener('DOMContentLoaded', () => {
    if (window.sessionManager) {
        window.authUI = new AuthUI(window.sessionManager);

        // Wait for session manager to be ready
        window.sessionManager.on(window.sessionManager.EVENTS.READY, () => {
            window.authUI.initialize();
        });
    }
});