/**
 * Railway Hydration Module
 * Handles fetching and merging user's own answers from Railway server
 * Part of the chart integration: ensures charts reliably rehydrate on page load
 */

(function() {
    'use strict';

    // Configuration
    const RAILWAY_SERVER_URL = window.RAILWAY_SERVER_URL || 'https://code-production-2468.up.railway.app';
    const USE_RAILWAY = window.USE_RAILWAY || false;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // milliseconds

    /**
     * Fetch current user's answers from Railway server
     * @param {string} username - The username to fetch answers for
     * @returns {Promise<Object>} - Object containing user's answers
     */
    async function fetchUserAnswersFromRailway(username) {
        if (!USE_RAILWAY || !username) {
            console.log('⚠️ Railway hydration skipped: USE_RAILWAY=' + USE_RAILWAY + ', username=' + username);
            return null;
        }

        const url = `${RAILWAY_SERVER_URL}/api/user-answers/${encodeURIComponent(username)}`;
        console.log('🚂 Fetching user answers from Railway:', url);

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    // Special handling for 404 - endpoint might not be deployed yet
                    if (response.status === 404) {
                        console.warn('⚠️ Railway /api/user-answers endpoint not found. Server may need redeployment.');
                        console.warn('   See railway-server/DEPLOYMENT.md for instructions');
                        return null; // Return null instead of throwing to prevent retries
                    }
                    throw new Error(`Railway server returned ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log(`✅ Railway hydration successful: ${result.count} answers fetched for ${username}`);
                return result;

            } catch (error) {
                console.error(`❌ Railway hydration attempt ${attempt}/${MAX_RETRIES} failed:`, error);

                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                } else {
                    console.error('❌ Railway hydration failed after', MAX_RETRIES, 'attempts');
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * Merge Railway answers into classData and localStorage
     * Handles chart deserialization from answer_value
     * @param {Array} answers - Array of answer objects from Railway
     * @param {string} username - Current username
     */
    function mergeRailwayAnswers(answers, username) {
        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            console.log('⚠️ No answers to merge from Railway');
            return;
        }

        // Ensure classData structure exists
        if (!window.classData) {
            window.classData = { users: {} };
        }
        if (!window.classData.users[username]) {
            window.classData.users[username] = {
                answers: {},
                reasons: {},
                timestamps: {},
                attempts: {},
                charts: {}
            };
        }

        const userData = window.classData.users[username];
        let mergedCount = 0;
        let chartCount = 0;

        answers.forEach(answer => {
            const { question_id, answer_value, timestamp } = answer;

            // Skip if we have a newer local answer
            const localTimestamp = userData.timestamps[question_id];
            if (localTimestamp && localTimestamp > timestamp) {
                console.log(`⏭️ Skipping older Railway answer for ${question_id}`);
                return;
            }

            // Use SIF deserializer to safely parse answer_value
            let isChart = false;
            let chartData = null;

            if (window.sifDeserializer) {
                const result = window.sifDeserializer.deserializeAnswer(answer_value);
                isChart = result.isChart;
                chartData = result.data;
                if (isChart && !result.error) {
                    chartCount++;
                }
            } else {
                // Fallback to simple parsing if deserializer not available
                try {
                    const parsed = JSON.parse(answer_value);
                    if (parsed && parsed.type && (parsed.chartType || parsed.type)) {
                        isChart = true;
                        chartData = parsed;
                        chartCount++;
                    }
                } catch (e) {
                    // Not JSON, treat as regular answer
                }
            }

            // Update classData
            if (isChart) {
                // Store the parsed chart object in answers
                userData.answers[question_id] = chartData;
                // Also store in charts for quick access
                userData.charts[question_id] = chartData;
                console.log(`📊 Hydrated chart for ${question_id}`);
            } else {
                // Store regular answer
                userData.answers[question_id] = answer_value;
            }

            userData.timestamps[question_id] = timestamp;

            // Initialize attempts if not present
            if (!userData.attempts[question_id]) {
                userData.attempts[question_id] = 1;
            }

            mergedCount++;
        });

        // Save to localStorage
        try {
            localStorage.setItem('classData', JSON.stringify(window.classData));

            // Also update legacy answers storage if it exists
            const legacyKey = `answers_${username}`;
            const legacyData = JSON.parse(localStorage.getItem(legacyKey) || '{}');

            answers.forEach(answer => {
                const { question_id, answer_value, timestamp } = answer;

                // Skip if we have newer data in legacy storage
                if (legacyData[question_id] && legacyData[question_id].timestamp > timestamp) {
                    return;
                }

                legacyData[question_id] = {
                    answer: answer_value,
                    timestamp: timestamp
                };
            });

            localStorage.setItem(legacyKey, JSON.stringify(legacyData));

        } catch (error) {
            console.error('❌ Failed to save hydrated data to localStorage:', error);
        }

        console.log(`✅ Railway hydration merged ${mergedCount} answers (${chartCount} charts) for ${username}`);

        // Show user notification
        if (window.notifications && mergedCount > 0) {
            const message = chartCount > 0
                ? `Loaded ${mergedCount} answers (including ${chartCount} charts)`
                : `Loaded ${mergedCount} answers`;
            window.notifications.storage.hydrationSuccess(mergedCount);
        }

        // Dispatch event to notify that hydration is complete
        window.dispatchEvent(new CustomEvent('railwayHydrationComplete', {
            detail: {
                username,
                mergedCount,
                chartCount,
                timestamp: Date.now()
            }
        }));
    }

    /**
     * Main hydration function
     * Attempts to fetch and merge user's answers from Railway
     * @param {string} username - Current username
     * @returns {Promise<boolean>} - True if hydration succeeded
     */
    async function hydrateFromRailway(username) {
        if (!USE_RAILWAY) {
            console.log('⚠️ Railway hydration disabled (USE_RAILWAY=false)');
            return false;
        }

        if (!username) {
            console.log('⚠️ Railway hydration skipped: no username');
            return false;
        }

        console.log('🚂 Starting Railway hydration for', username);

        try {
            const result = await fetchUserAnswersFromRailway(username);

            if (!result || !result.data) {
                console.log('⚠️ Railway hydration returned no data');
                return false;
            }

            mergeRailwayAnswers(result.data, username);

            // Re-render current question if visible
            // Try various possible render functions
            if (typeof window.renderCurrentQuestionIfVisible === 'function') {
                window.renderCurrentQuestionIfVisible();
            } else if (typeof window.refreshCurrentQuestion === 'function') {
                window.refreshCurrentQuestion();
            } else {
                // Trigger a general UI update if specific functions don't exist
                console.log('📊 Hydration complete - refresh page to see charts');
            }

            return true;

        } catch (error) {
            console.error('❌ Railway hydration failed:', error);

            // Show user notification
            if (window.notifications) {
                window.notifications.storage.hydrationFailed(error.message || 'Unknown error');
            }

            return false;
        }
    }

    /**
     * Test Railway connection and availability
     * @returns {Promise<boolean>} - True if Railway server is available
     */
    async function testRailwayConnection() {
        if (!USE_RAILWAY) {
            return false;
        }

        try {
            const response = await fetch(`${RAILWAY_SERVER_URL}/health`, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });

            if (!response.ok) {
                console.log('⚠️ Railway server returned', response.status);
                return false;
            }

            const data = await response.json();
            console.log('✅ Railway server healthy:', data);
            return true;

        } catch (error) {
            console.error('❌ Railway server unavailable:', error);
            return false;
        }
    }

    // Export functions to global scope
    window.railwayHydration = {
        hydrateFromRailway,
        fetchUserAnswersFromRailway,
        mergeRailwayAnswers,
        testRailwayConnection
    };

    // Auto-initialize on DOMContentLoaded if USE_RAILWAY is true
    // Disabled - hydration is now handled by auth.js to avoid duplicate calls
    /*
    if (USE_RAILWAY && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            const username = window.currentUsername || localStorage.getItem('consensusUsername');
            if (username) {
                console.log('🚂 Auto-hydrating from Railway on page load');
                await hydrateFromRailway(username);
            }
        });
    }
    */

    console.log('✅ Railway hydration module loaded');

})();