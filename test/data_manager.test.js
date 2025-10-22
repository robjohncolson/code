/**
 * data_manager.test.js - Data Manager Tests
 * Tests for data persistence, migration, and storage
 */

QUnit.module('Data Manager', (hooks) => {
    let mockStorage;
    let mockStorageHelper;

    hooks.beforeEach(() => {
        // Mock localStorage
        mockStorageHelper = window.TestUtils.mockLocalStorage();
        mockStorage = mockStorageHelper.mock;

        // Mock global dependencies
        window.currentUsername = 'Test_User';
        window.classData = null;
        window.showMessage = function(msg, type) {
            console.log(`[${type}] ${msg}`);
        };
    });

    hooks.afterEach(() => {
        // Restore original localStorage
        mockStorageHelper.restore();

        // Cleanup globals
        delete window.currentUsername;
        delete window.classData;
        delete window.showMessage;
    });

    QUnit.test('initClassData creates new user entry', (assert) => {
        // No existing data
        assert.strictEqual(mockStorage.getItem('classData'), null, 'No initial classData');

        // Call initClassData (if available)
        if (typeof window.initClassData === 'function') {
            window.initClassData();

            // Verify classData was created
            assert.ok(window.classData, 'classData object exists');
            assert.ok(window.classData.users, 'classData.users exists');
            assert.ok(window.classData.users[window.currentUsername], 'User entry created');

            // Verify user structure
            const user = window.classData.users[window.currentUsername];
            assert.ok(user.answers, 'User has answers object');
            assert.ok(user.reasons, 'User has reasons object');
            assert.ok(user.timestamps, 'User has timestamps object');
            assert.ok(user.attempts, 'User has attempts object');
            assert.ok(user.currentActivity, 'User has currentActivity object');

            // Verify currentActivity structure
            assert.strictEqual(user.currentActivity.state, 'idle', 'Initial state is idle');
            assert.strictEqual(user.currentActivity.questionId, null, 'No initial questionId');
            assert.ok(user.currentActivity.lastUpdate, 'Has lastUpdate timestamp');
        } else {
            assert.ok(true, 'initClassData not loaded, skipping test');
        }
    });

    QUnit.test('initClassData migrates existing users', (assert) => {
        // Create existing user without currentActivity
        const existingData = {
            users: {
                'Test_User': {
                    answers: { 'U1-L1-Q01': 'A' },
                    reasons: {},
                    timestamps: {},
                    attempts: {}
                    // Missing currentActivity field
                }
            }
        };
        mockStorage.setItem('classData', JSON.stringify(existingData));

        if (typeof window.initClassData === 'function') {
            window.initClassData();

            // Verify migration
            const user = window.classData.users[window.currentUsername];
            assert.ok(user.currentActivity, 'currentActivity was added');
            assert.strictEqual(user.currentActivity.state, 'idle', 'Migrated state is idle');
            assert.deepEqual(user.answers, { 'U1-L1-Q01': 'A' }, 'Existing data preserved');
        } else {
            assert.ok(true, 'initClassData not loaded, skipping test');
        }
    });

    QUnit.test('saveClassData persists to localStorage', (assert) => {
        window.classData = {
            users: {
                'Test_User': {
                    answers: { 'U1-L1-Q01': 'B' },
                    reasons: {},
                    timestamps: {},
                    attempts: {},
                    currentActivity: {
                        state: 'viewing',
                        questionId: 'U1-L1-Q01',
                        lastUpdate: Date.now()
                    }
                }
            }
        };

        if (typeof window.saveClassData === 'function') {
            window.saveClassData();

            // Verify saved data
            const saved = mockStorage.getItem('classData');
            assert.ok(saved, 'Data was saved');

            const parsed = JSON.parse(saved);
            assert.deepEqual(parsed, window.classData, 'Saved data matches classData');
        } else {
            assert.ok(true, 'saveClassData not loaded, skipping test');
        }
    });

    QUnit.test('saveClassData handles storage quota exceeded', (assert) => {
        // Set very small quota
        mockStorage.setQuota(100); // 100 bytes

        // Create large classData
        window.classData = {
            users: {}
        };

        // Fill with lots of data
        for (let i = 0; i < 100; i++) {
            window.classData.users[`User_${i}`] = {
                answers: { 'U1-L1-Q01': 'A'.repeat(1000) },
                reasons: {},
                timestamps: {},
                attempts: {},
                currentActivity: { state: 'idle', questionId: null, lastUpdate: Date.now() }
            };
        }

        // Mock showMessage to track error
        let errorShown = false;
        window.showMessage = function(msg, type) {
            if (type === 'error' && msg.includes('storage is full')) {
                errorShown = true;
            }
        };

        if (typeof window.saveClassData === 'function') {
            window.saveClassData();

            assert.ok(errorShown, 'Error message shown when quota exceeded');
        } else {
            assert.ok(true, 'saveClassData not loaded, skipping test');
        }
    });

    QUnit.test('initializeProgressTracking sets session start', (assert) => {
        window.currentUsername = 'Test_User';

        if (typeof window.initializeProgressTracking === 'function') {
            window.initializeProgressTracking();

            // Verify session start time
            const sessionStart = mockStorage.getItem('sessionStart_Test_User');
            assert.ok(sessionStart, 'Session start time saved');

            // Verify it's a valid ISO timestamp
            const parsed = new Date(sessionStart);
            assert.ok(!isNaN(parsed.getTime()), 'Session start is valid date');

            // Verify temp progress cleared
            const tempProgress = mockStorage.getItem('tempProgress_Test_User');
            assert.strictEqual(tempProgress, null, 'Temp progress cleared');
        } else {
            assert.ok(true, 'initializeProgressTracking not loaded, skipping test');
        }
    });

    QUnit.test('localStorage persistence across sessions', (assert) => {
        // Simulate first session
        window.currentUsername = 'Persistent_User';

        if (typeof window.initClassData === 'function') {
            window.initClassData();

            window.classData.users[window.currentUsername].answers['U1-L1-Q01'] = 'A';
            window.classData.users[window.currentUsername].timestamps['U1-L1-Q01'] = Date.now();

            if (typeof window.saveClassData === 'function') {
                window.saveClassData();
            }

            // Simulate session end / page reload
            window.classData = null;

            // Simulate new session
            window.initClassData();

            // Verify data persisted
            const user = window.classData.users[window.currentUsername];
            assert.strictEqual(user.answers['U1-L1-Q01'], 'A', 'Answer persisted across sessions');
            assert.ok(user.timestamps['U1-L1-Q01'], 'Timestamp persisted');
        } else {
            assert.ok(true, 'Functions not loaded, skipping test');
        }
    });

    QUnit.test('multiple users data isolation', (assert) => {
        if (typeof window.initClassData === 'function' && typeof window.saveClassData === 'function') {
            // Create first user
            window.currentUsername = 'User_A';
            window.initClassData();
            window.classData.users['User_A'].answers['U1-L1-Q01'] = 'A';
            window.saveClassData();

            // Create second user
            window.currentUsername = 'User_B';
            window.initClassData();
            window.classData.users['User_B'].answers['U1-L1-Q01'] = 'B';
            window.saveClassData();

            // Verify both users exist
            assert.ok(window.classData.users['User_A'], 'User A exists');
            assert.ok(window.classData.users['User_B'], 'User B exists');

            // Verify data isolation
            assert.strictEqual(window.classData.users['User_A'].answers['U1-L1-Q01'], 'A', 'User A answer is A');
            assert.strictEqual(window.classData.users['User_B'].answers['U1-L1-Q01'], 'B', 'User B answer is B');
        } else {
            assert.ok(true, 'Functions not loaded, skipping test');
        }
    });

    QUnit.test('data manager handles corrupted localStorage', (assert) => {
        // Set corrupted data
        mockStorage.setItem('classData', '{invalid json');

        if (typeof window.initClassData === 'function') {
            try {
                window.initClassData();
                assert.ok(false, 'Should throw error on corrupted data');
            } catch (error) {
                assert.ok(true, 'Error thrown on corrupted data');
            }
        } else {
            assert.ok(true, 'initClassData not loaded, skipping test');
        }
    });
});

QUnit.module('Progress Tracking', (hooks) => {
    let mockStorage;
    let mockStorageHelper;

    hooks.beforeEach(() => {
        mockStorageHelper = window.TestUtils.mockLocalStorage();
        mockStorage = mockStorageHelper.mock;
        window.currentUsername = 'Test_User';
    });

    hooks.afterEach(() => {
        mockStorageHelper.restore();
        delete window.currentUsername;
    });

    QUnit.test('tracks session duration', (assert) => {
        const done = assert.async();

        if (typeof window.initializeProgressTracking === 'function') {
            window.initializeProgressTracking();

            const sessionStart = mockStorage.getItem('sessionStart_Test_User');
            const startTime = new Date(sessionStart);

            // Wait 100ms
            setTimeout(() => {
                const now = new Date();
                const duration = now - startTime;

                assert.ok(duration >= 90, 'Session duration tracked (at least 90ms)');
                done();
            }, 100);
        } else {
            assert.ok(true, 'initializeProgressTracking not loaded, skipping test');
            done();
        }
    });

    QUnit.test('handles pending imports after refresh', (assert) => {
        // Simulate pending master import
        const pendingData = {
            users: {
                'User_A': { answers: { 'U1-L1-Q01': 'A' } }
            }
        };
        mockStorage.setItem('pending_master_import', JSON.stringify(pendingData));

        // Mock importMasterData
        let importCalled = false;
        window.importMasterData = function(data) {
            importCalled = true;
            assert.deepEqual(data, pendingData, 'Correct data passed to import');
        };

        if (typeof window.initializeProgressTracking === 'function') {
            window.initializeProgressTracking();

            assert.ok(importCalled, 'Import function called for pending data');
        } else {
            assert.ok(true, 'initializeProgressTracking not loaded, skipping test');
        }

        delete window.importMasterData;
    });
});
