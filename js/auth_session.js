/**
 * auth_session.js - Session Manager for JWT Authentication
 * Part of AP Statistics Consensus Quiz
 *
 * Handles JWT token storage, automatic refresh, and session persistence.
 * Designed for non-blocking initialization with progressive enhancement.
 *
 * Storage Strategy:
 * 1. Memory-first for active session (best security)
 * 2. SessionStorage for tab persistence (cleared on close)
 * 3. localStorage fallback for offline mode only
 */

class SessionManager extends EventTarget {
    constructor() {
        super();

        // State
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        this.isReady = false;
        this.isAuthenticated = false;
        this.refreshTimer = null;

        // Configuration
        this.config = {
            apiBaseUrl: window.RAILWAY_SERVER_URL || 'http://localhost:3000',
            tokenRefreshBuffer: 5 * 60 * 1000, // Refresh 5 minutes before expiry
            maxRetries: 3,
            retryDelay: 1000,
            offlineMode: true
        };

        // Event types for subscribers
        this.EVENTS = {
            AUTH_STATE_CHANGED: 'authStateChanged',
            TOKEN_REFRESHED: 'tokenRefreshed',
            SESSION_EXPIRED: 'sessionExpired',
            AUTH_ERROR: 'authError',
            READY: 'ready'
        };
    }

    /**
     * Initialize session manager (non-blocking)
     * Returns immediately, emits 'ready' event when complete
     */
    async initialize() {
        try {
            // Try to restore session from storage
            await this.restoreSession();

            // Set up automatic token refresh
            if (this.isAuthenticated) {
                this.scheduleTokenRefresh();
            }

            this.isReady = true;
            this.emit(this.EVENTS.READY, { isAuthenticated: this.isAuthenticated });

            return true;
        } catch (error) {
            console.error('[SessionManager] Initialization error:', error);
            this.isReady = true;
            this.emit(this.EVENTS.READY, { isAuthenticated: false, error });
            return false;
        }
    }

    /**
     * Restore session from storage
     * Checks sessionStorage first, then localStorage (offline fallback)
     */
    async restoreSession() {
        // Try sessionStorage first (best for session persistence)
        let token = sessionStorage.getItem('auth_token');
        let userData = sessionStorage.getItem('auth_user');

        // Fallback to localStorage for offline mode
        if (!token && this.config.offlineMode) {
            token = localStorage.getItem('auth_token');
            userData = localStorage.getItem('auth_user');
        }

        if (token && userData) {
            try {
                // Verify token is still valid
                const decoded = this.decodeToken(token);
                const now = Date.now() / 1000;

                if (decoded.exp && decoded.exp > now) {
                    // Token is valid
                    this.token = token;
                    this.user = JSON.parse(userData);
                    this.isAuthenticated = true;

                    console.log('[SessionManager] Session restored for user:', this.user.username);
                    this.emit(this.EVENTS.AUTH_STATE_CHANGED, { isAuthenticated: true, user: this.user });

                    return true;
                } else {
                    // Token expired, try to refresh
                    console.log('[SessionManager] Token expired, attempting refresh');
                    await this.refreshTokenRequest();
                    return this.isAuthenticated;
                }
            } catch (error) {
                console.error('[SessionManager] Session restore failed:', error);
                this.clearSession();
            }
        }

        return false;
    }

    /**
     * Create anonymous session with Fruit_Animal username
     * This is the primary authentication method for students
     */
    async createAnonymousSession(username, classCode = null) {
        try {
            const response = await this.apiRequest('/api/profiles', {
                method: 'POST',
                body: JSON.stringify({
                    username: username,
                    class_section_code: classCode
                })
            });

            if (response.success) {
                this.setSession(response.token, response.profile);
                return { success: true, user: response.profile };
            } else {
                throw new Error(response.message || 'Failed to create session');
            }
        } catch (error) {
            console.error('[SessionManager] Anonymous session creation failed:', error);

            // Fallback to offline mode
            if (this.config.offlineMode) {
                return this.createOfflineSession(username);
            }

            throw error;
        }
    }

    /**
     * Create offline session (no server connection)
     * Used as fallback when Railway server is unavailable
     */
    createOfflineSession(username) {
        console.log('[SessionManager] Creating offline session');

        const offlineUser = {
            username: username,
            is_teacher: false,
            offline: true,
            created_at: new Date().toISOString()
        };

        // Store in localStorage only (no JWT token)
        localStorage.setItem('auth_user', JSON.stringify(offlineUser));
        localStorage.setItem('offline_mode', 'true');

        this.user = offlineUser;
        this.isAuthenticated = true;
        this.emit(this.EVENTS.AUTH_STATE_CHANGED, {
            isAuthenticated: true,
            user: offlineUser,
            offline: true
        });

        return { success: true, user: offlineUser, offline: true };
    }

    /**
     * Teacher authentication with access code
     */
    async teacherLogin(accessCode, customUsername = null) {
        try {
            const response = await this.apiRequest('/api/auth/teacher', {
                method: 'POST',
                body: JSON.stringify({
                    access_code: accessCode,
                    username: customUsername
                })
            });

            if (response.success) {
                this.setSession(response.token, response.profile);
                return { success: true, user: response.profile };
            } else {
                throw new Error(response.message || 'Invalid access code');
            }
        } catch (error) {
            console.error('[SessionManager] Teacher login failed:', error);
            this.emit(this.EVENTS.AUTH_ERROR, {
                type: 'teacher_login',
                message: error.message
            });
            throw error;
        }
    }

    /**
     * Set session data and persist to storage
     */
    setSession(token, user) {
        this.token = token;
        this.user = user;
        this.isAuthenticated = true;

        // Store in sessionStorage (primary)
        sessionStorage.setItem('auth_token', token);
        sessionStorage.setItem('auth_user', JSON.stringify(user));

        // Also store in localStorage for offline fallback
        if (this.config.offlineMode) {
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));
        }

        // Remove offline mode flag if it exists
        localStorage.removeItem('offline_mode');

        // Schedule token refresh
        this.scheduleTokenRefresh();

        // Emit auth state change
        this.emit(this.EVENTS.AUTH_STATE_CHANGED, {
            isAuthenticated: true,
            user: this.user
        });

        console.log('[SessionManager] Session established for:', user.username);
    }

    /**
     * Clear session and logout
     */
    logout() {
        console.log('[SessionManager] Logging out user:', this.user?.username);

        // Clear state
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        this.isAuthenticated = false;

        // Clear timers
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // Clear storage
        this.clearSession();

        // Emit auth state change
        this.emit(this.EVENTS.AUTH_STATE_CHANGED, { isAuthenticated: false });
    }

    /**
     * Clear session storage
     */
    clearSession() {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('offline_mode');
    }

    /**
     * Get current authentication token
     */
    getToken() {
        return this.token;
    }

    /**
     * Get current user
     */
    getUser() {
        return this.user;
    }

    /**
     * Check if user is teacher
     */
    isTeacher() {
        return this.user?.is_teacher || false;
    }

    /**
     * Check if in offline mode
     */
    isOffline() {
        return this.user?.offline || localStorage.getItem('offline_mode') === 'true';
    }

    /**
     * Schedule automatic token refresh
     */
    scheduleTokenRefresh() {
        // Clear existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        // Don't schedule refresh for offline sessions
        if (this.isOffline()) {
            return;
        }

        try {
            const decoded = this.decodeToken(this.token);
            const expiresAt = decoded.exp * 1000; // Convert to milliseconds
            const now = Date.now();
            const timeUntilExpiry = expiresAt - now;
            const refreshTime = timeUntilExpiry - this.config.tokenRefreshBuffer;

            if (refreshTime > 0) {
                console.log(`[SessionManager] Token refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);
                this.refreshTimer = setTimeout(() => {
                    this.refreshTokenRequest();
                }, refreshTime);
            } else {
                // Token expires soon, refresh immediately
                console.log('[SessionManager] Token expires soon, refreshing now');
                this.refreshTokenRequest();
            }
        } catch (error) {
            console.error('[SessionManager] Failed to schedule refresh:', error);
        }
    }

    /**
     * Refresh authentication token
     */
    async refreshTokenRequest() {
        try {
            const response = await this.apiRequest('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.token) {
                // Update token but keep user data
                this.token = response.token;
                sessionStorage.setItem('auth_token', response.token);

                if (this.config.offlineMode) {
                    localStorage.setItem('auth_token', response.token);
                }

                // Schedule next refresh
                this.scheduleTokenRefresh();

                this.emit(this.EVENTS.TOKEN_REFRESHED, { token: response.token });
                console.log('[SessionManager] Token refreshed successfully');

                return true;
            } else {
                throw new Error('No token in refresh response');
            }
        } catch (error) {
            console.error('[SessionManager] Token refresh failed:', error);
            this.emit(this.EVENTS.SESSION_EXPIRED);

            // Session expired, need to re-authenticate
            this.logout();
            return false;
        }
    }

    /**
     * Decode JWT token (client-side only, not validation)
     */
    decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('[SessionManager] Token decode error:', error);
            return null;
        }
    }

    /**
     * Make authenticated API request
     */
    async apiRequest(endpoint, options = {}) {
        const url = `${this.config.apiBaseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add auth token if available
        if (this.token && !options.headers?.Authorization) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const requestOptions = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, requestOptions);

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
                throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `API error: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('[SessionManager] API request failed:', error);
            throw error;
        }
    }

    /**
     * Emit event to subscribers
     */
    emit(eventType, detail) {
        const event = new CustomEvent(eventType, { detail });
        this.dispatchEvent(event);
    }

    /**
     * Subscribe to auth events
     */
    on(eventType, callback) {
        this.addEventListener(eventType, callback);
    }

    /**
     * Unsubscribe from auth events
     */
    off(eventType, callback) {
        this.removeEventListener(eventType, callback);
    }
}

// Create singleton instance
window.sessionManager = new SessionManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}