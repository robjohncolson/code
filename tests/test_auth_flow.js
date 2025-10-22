/**
 * test_auth_flow.js - Manual Test Suite for Auth Flow
 * Part of AP Statistics Consensus Quiz
 *
 * Comprehensive manual testing script for authentication flows.
 * Run this in browser console to test all auth scenarios.
 */

async function testAuthFlow() {
    console.log('='.repeat(60));
    console.log('🧪 AP Statistics Quiz - Auth Flow Test Suite');
    console.log('='.repeat(60));
    console.log('');

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    /**
     * Helper function to run test
     */
    async function runTest(name, testFn) {
        console.log(`\n▶️  Test: ${name}`);
        try {
            await testFn();
            console.log(`✅ PASS: ${name}`);
            results.passed++;
            results.tests.push({ name, status: 'PASS' });
        } catch (error) {
            console.error(`❌ FAIL: ${name}`);
            console.error('   Error:', error.message);
            results.failed++;
            results.tests.push({ name, status: 'FAIL', error: error.message });
        }
    }

    /**
     * Helper to wait for element
     */
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    // ========================================
    // Test 1: Session Manager Initialization
    // ========================================
    await runTest('Session Manager Initialization', async () => {
        if (!window.sessionManager) {
            throw new Error('SessionManager not found');
        }

        if (!window.sessionManager.isReady) {
            // Wait for ready event
            await new Promise(resolve => {
                window.sessionManager.on(window.sessionManager.EVENTS.READY, resolve);
            });
        }

        if (!window.sessionManager.isReady) {
            throw new Error('SessionManager failed to initialize');
        }
    });

    // ========================================
    // Test 2: Non-blocking Initialization
    // ========================================
    await runTest('Non-blocking Initialization', async () => {
        // Check that app initialized without blocking
        if (!window.appInitializer) {
            throw new Error('AppInitializer not found');
        }

        const status = window.appInitializer.getStatus();

        if (!status.initialized) {
            throw new Error('App not initialized');
        }

        if (status.duration > 5000) {
            throw new Error(`Initialization took too long: ${status.duration}ms`);
        }

        console.log(`   ℹ️  Init time: ${status.duration}ms`);
    });

    // ========================================
    // Test 3: Auth UI Rendering
    // ========================================
    await runTest('Auth UI Rendering', async () => {
        const authContainer = document.getElementById('auth-container');
        if (!authContainer) {
            throw new Error('Auth container not found');
        }

        if (authContainer.innerHTML.trim() === '') {
            throw new Error('Auth UI not rendered');
        }

        console.log('   ℹ️  Auth container has content');
    });

    // ========================================
    // Test 4: Anonymous Session Creation
    // ========================================
    await runTest('Anonymous Session Creation', async () => {
        // Clear existing session
        window.sessionManager.logout();

        const testUsername = `Test_${Date.now()}`;

        // Create session
        const result = await window.sessionManager.createAnonymousSession(testUsername);

        if (!result.success) {
            throw new Error('Failed to create anonymous session');
        }

        if (!window.sessionManager.isAuthenticated) {
            throw new Error('User not authenticated after session creation');
        }

        const user = window.sessionManager.getUser();
        if (user.username !== testUsername && !user.offline) {
            throw new Error(`Username mismatch: expected ${testUsername}, got ${user.username}`);
        }

        console.log(`   ℹ️  Created session for: ${user.username}`);
        console.log(`   ℹ️  Offline mode: ${user.offline || false}`);
    });

    // ========================================
    // Test 5: Session Persistence
    // ========================================
    await runTest('Session Persistence', async () => {
        const username = window.sessionManager.getUser()?.username;
        if (!username) {
            throw new Error('No active session to test persistence');
        }

        // Check storage
        const tokenInSession = sessionStorage.getItem('auth_token');
        const userInSession = sessionStorage.getItem('auth_user');

        if (!userInSession) {
            throw new Error('User data not persisted to sessionStorage');
        }

        const storedUser = JSON.parse(userInSession);
        if (storedUser.username !== username) {
            throw new Error('Stored username does not match session');
        }

        console.log('   ℹ️  Session data persisted correctly');
    });

    // ========================================
    // Test 6: Auth State Changes
    // ========================================
    await runTest('Auth State Changes', async () => {
        let eventFired = false;

        // Listen for auth state change
        window.sessionManager.on(window.sessionManager.EVENTS.AUTH_STATE_CHANGED, () => {
            eventFired = true;
        });

        // Trigger logout
        window.sessionManager.logout();

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!eventFired) {
            throw new Error('AUTH_STATE_CHANGED event not fired');
        }

        if (window.sessionManager.isAuthenticated) {
            throw new Error('User still authenticated after logout');
        }

        console.log('   ℹ️  Auth state events working correctly');
    });

    // ========================================
    // Test 7: Toast Notifications
    // ========================================
    await runTest('Toast Notifications', async () => {
        if (!window.showToast) {
            throw new Error('Toast function not available');
        }

        // Show test toast
        const toast = window.showToast('Test notification', 'info', 2000);

        if (!toast || !toast.classList.contains('toast')) {
            throw new Error('Toast not created properly');
        }

        // Check if visible
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!toast.classList.contains('toast-show')) {
            throw new Error('Toast not showing');
        }

        // Dismiss
        window.toastManager.dismiss(toast);

        console.log('   ℹ️  Toast system working');
    });

    // ========================================
    // Test 8: View Guards
    // ========================================
    await runTest('View Guards', async () => {
        if (!window.viewGuard) {
            throw new Error('ViewGuard not initialized');
        }

        // Create test protected element
        const testDiv = document.createElement('div');
        testDiv.setAttribute('data-auth-required', 'teacher');
        testDiv.setAttribute('data-auth-fallback', 'message');
        testDiv.textContent = 'Teacher only content';
        testDiv.id = 'test-protected-element';
        document.body.appendChild(testDiv);

        // Wait for guard to process
        await new Promise(resolve => setTimeout(resolve, 200));

        // Should be hidden/blocked for non-teachers
        const isTeacher = window.sessionManager.isTeacher();
        const hasOverlay = testDiv.querySelector('.auth-required-overlay');

        if (!isTeacher && !hasOverlay) {
            // Clean up
            testDiv.remove();
            throw new Error('Protected content not guarded');
        }

        if (isTeacher && hasOverlay) {
            // Clean up
            testDiv.remove();
            throw new Error('Teacher content blocked for teacher');
        }

        // Clean up
        testDiv.remove();

        console.log('   ℹ️  View guards functioning correctly');
    });

    // ========================================
    // Test 9: Offline Mode Fallback
    // ========================================
    await runTest('Offline Mode Fallback', async () => {
        // This would require mocking network failure
        // For now, just check that offline session creation works

        const offlineUsername = `Offline_${Date.now()}`;
        const result = window.sessionManager.createOfflineSession(offlineUsername);

        if (!result.success) {
            throw new Error('Offline session creation failed');
        }

        if (!result.offline) {
            throw new Error('Session not marked as offline');
        }

        console.log('   ℹ️  Offline mode available');
    });

    // ========================================
    // Test 10: Accessibility Features
    // ========================================
    await runTest('Accessibility Features', async () => {
        // Check for screen reader announcer
        const announcer = document.getElementById('sr-announcer');
        if (!announcer) {
            throw new Error('Screen reader announcer not found');
        }

        if (!announcer.hasAttribute('aria-live')) {
            throw new Error('Screen reader announcer missing aria-live');
        }

        console.log('   ℹ️  Accessibility features present');
    });

    // ========================================
    // Test Summary
    // ========================================
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 Test Results');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📝 Total:  ${results.passed + results.failed}`);
    console.log('');

    if (results.failed > 0) {
        console.log('Failed tests:');
        results.tests
            .filter(t => t.status === 'FAIL')
            .forEach(t => {
                console.log(`  ❌ ${t.name}: ${t.error}`);
            });
        console.log('');
    }

    const successRate = (results.passed / (results.passed + results.failed) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);
    console.log('');

    if (results.failed === 0) {
        console.log('🎉 All tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.');
    }

    console.log('='.repeat(60));

    return results;
}

// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.location.search.includes('run-tests')) {
    window.addEventListener('load', () => {
        setTimeout(() => testAuthFlow(), 1000);
    });
}

// Export for manual running
window.testAuthFlow = testAuthFlow;

console.log('✨ Auth flow test suite loaded.');
console.log('💡 Run testAuthFlow() in console to start tests.');
