/**
 * Test Script for Railway User Answers Endpoint
 * Run this in the browser console to test if the endpoint is deployed
 */

(function() {
    'use strict';

    console.log('🧪 Testing Railway /api/user-answers endpoint...\n');

    const RAILWAY_URL = window.RAILWAY_SERVER_URL || 'https://code-production-2468.up.railway.app';
    const testUsername = window.currentUsername || localStorage.getItem('consensusUsername') || 'Test_User';

    console.log('Railway URL:', RAILWAY_URL);
    console.log('Testing with username:', testUsername);
    console.log('-'.repeat(50));

    // Test the endpoint
    fetch(`${RAILWAY_URL}/api/user-answers/${encodeURIComponent(testUsername)}`)
        .then(response => {
            console.log('Response status:', response.status);

            if (response.status === 404) {
                console.error('❌ Endpoint NOT FOUND (404)');
                console.error('\n⚠️ ACTION REQUIRED:');
                console.error('1. The Railway server needs to be redeployed');
                console.error('2. See railway-server/DEPLOYMENT.md for instructions');
                console.error('3. Quick fix: Go to https://railway.app and click "Redeploy"');
                return null;
            }

            if (response.ok) {
                console.log('✅ Endpoint is WORKING!');
                return response.json();
            } else {
                console.warn('⚠️ Endpoint returned error:', response.statusText);
                return response.json();
            }
        })
        .then(data => {
            if (data) {
                console.log('\n📊 Response Data:');
                console.log('- Username:', data.username);
                console.log('- Answer count:', data.count || 0);
                console.log('- Timestamp:', new Date(data.timestamp).toLocaleString());

                if (data.data && data.data.length > 0) {
                    console.log('\n📝 Sample answers:');
                    data.data.slice(0, 3).forEach(answer => {
                        console.log(`  - ${answer.question_id}: ${answer.answer_value.substring(0, 50)}...`);
                    });
                }
            }
        })
        .catch(error => {
            console.error('❌ Network error:', error.message);
            console.error('The Railway server may be down or unreachable');
        })
        .finally(() => {
            console.log('\n' + '='.repeat(50));
            console.log('Test complete!');
        });

})();