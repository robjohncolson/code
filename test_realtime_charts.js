/**
 * Test Script for Real-Time Chart Updates Between Peers
 * Run this in the browser console to test peer chart sharing
 */

(function() {
    'use strict';

    console.log('🔄 Testing Real-Time Chart Updates...\n');

    // Test configuration
    const testQuestionId = 'U1-L10-Q04';
    const testPeerUsername = 'Peer_Tester';

    // Sample chart data from a peer
    const peerChartData = {
        type: 'scatter',
        chartType: 'scatter',
        title: 'Peer Scatter Plot',
        xLabel: 'X Values',
        yLabel: 'Y Values',
        points: [
            { x: 1, y: 2, label: 'Point A' },
            { x: 3, y: 5, label: 'Point B' },
            { x: 5, y: 3, label: 'Point C' },
            { x: 7, y: 8, label: 'Point D' },
            { x: 9, y: 6, label: 'Point E' }
        ],
        meta: {
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
    };

    /**
     * Simulate receiving a peer's chart answer
     */
    function simulatePeerChartAnswer() {
        console.log('📤 Simulating peer chart submission...');

        // Create peer answer event
        const peerAnswerEvent = {
            detail: {
                username: testPeerUsername,
                question_id: testQuestionId,
                answer_value: JSON.stringify(peerChartData),
                timestamp: Date.now()
            }
        };

        // Check if SIF deserializer is available
        if (window.sifDeserializer) {
            const result = window.sifDeserializer.deserializeAnswer(peerAnswerEvent.detail.answer_value);

            if (result.isChart) {
                console.log('✅ Peer chart recognized as valid SIF');
                console.log('   Type:', result.data.type);
                console.log('   Title:', result.data.title);
                console.log('   Points:', result.data.points?.length || 0);
            } else {
                console.log('❌ Peer data not recognized as chart');
            }
        }

        // Dispatch peer answer event
        console.log('📡 Dispatching peer:answer event...');
        window.dispatchEvent(new CustomEvent('peer:answer', peerAnswerEvent));

        // Check if peer data was stored
        setTimeout(() => {
            checkPeerDataStorage();
        }, 100);
    }

    /**
     * Check if peer chart data was properly stored
     */
    function checkPeerDataStorage() {
        console.log('\n📥 Checking peer data storage...');

        if (window.classData && window.classData.users) {
            const peerData = window.classData.users[testPeerUsername];

            if (peerData) {
                console.log('✅ Peer data found in classData');

                // Check answers
                const answer = peerData.answers[testQuestionId];
                if (answer) {
                    console.log('✅ Peer answer stored');

                    // Check if chart was properly parsed
                    if (typeof answer === 'object' && answer.type) {
                        console.log('✅ Chart stored as object');
                        console.log('   Type:', answer.type);
                        console.log('   Title:', answer.title);
                    } else {
                        console.log('⚠️ Chart stored as string, needs parsing');
                    }
                }

                // Check charts cache
                const chart = peerData.charts && peerData.charts[testQuestionId];
                if (chart) {
                    console.log('✅ Chart cached in charts collection');
                    console.log('   Type:', chart.type);
                }
            } else {
                console.log('❌ Peer data not found in classData');
            }
        } else {
            console.log('❌ classData not initialized');
        }
    }

    /**
     * Test WebSocket connection for real-time updates
     */
    function testWebSocketConnection() {
        console.log('\n🔌 Testing WebSocket Connection...');

        if (window.USE_RAILWAY) {
            if (window.ws && window.ws.readyState === WebSocket.OPEN) {
                console.log('✅ WebSocket connected to Railway');
                console.log('   URL:', window.ws.url);

                // Send test ping
                window.ws.send(JSON.stringify({ type: 'ping' }));
                console.log('📡 Sent ping to Railway server');
            } else {
                console.log('❌ WebSocket not connected');
                console.log('   Check Railway configuration');
            }
        } else {
            console.log('ℹ️ Railway disabled (USE_RAILWAY=false)');
        }
    }

    /**
     * Test real-time broadcast of chart
     */
    function testChartBroadcast() {
        console.log('\n📢 Testing Chart Broadcast...');

        // Create a test chart submission
        const testSubmission = {
            username: window.currentUsername || 'Test_User',
            question_id: testQuestionId,
            answer_value: JSON.stringify(peerChartData),
            timestamp: Date.now()
        };

        console.log('📤 Submitting chart to cloud...');

        // Try Railway submission
        if (window.USE_RAILWAY && window.pushAnswerToRailway) {
            window.pushAnswerToRailway(
                testSubmission.question_id,
                testSubmission.answer_value
            ).then(result => {
                console.log('✅ Chart submitted via Railway');
            }).catch(error => {
                console.log('❌ Railway submission failed:', error);
            });
        }
        // Try Supabase submission
        else if (window.pushAnswerToSupabase) {
            window.pushAnswerToSupabase(
                testSubmission.question_id,
                testSubmission.answer_value
            ).then(result => {
                console.log('✅ Chart submitted via Supabase');
            }).catch(error => {
                console.log('❌ Supabase submission failed:', error);
            });
        } else {
            console.log('⚠️ No cloud sync available');
        }
    }

    /**
     * Run all tests
     */
    function runAllTests() {
        console.log('='.repeat(50));
        console.log('Real-Time Chart Update Tests');
        console.log('='.repeat(50));

        // Test 1: Simulate peer chart
        simulatePeerChartAnswer();

        // Test 2: WebSocket connection
        setTimeout(() => {
            testWebSocketConnection();
        }, 200);

        // Test 3: Chart broadcast
        setTimeout(() => {
            testChartBroadcast();
        }, 400);

        // Summary
        setTimeout(() => {
            console.log('\n' + '='.repeat(50));
            console.log('Test Complete!');
            console.log('Check the following:');
            console.log('1. Peer chart data is stored in classData');
            console.log('2. WebSocket connection is active (if Railway enabled)');
            console.log('3. Chart submissions are broadcast to peers');
            console.log('4. Chart renders correctly when viewing peer answers');
            console.log('='.repeat(50));
        }, 1000);
    }

    // Run tests
    runAllTests();

    // Export for manual testing
    window.chartTests = {
        simulatePeerChartAnswer,
        checkPeerDataStorage,
        testWebSocketConnection,
        testChartBroadcast,
        runAllTests
    };

})();