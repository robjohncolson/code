/**
 * Test script to debug chart storage and persistence
 * Run this in the browser console after creating a chart
 */

(function() {
    'use strict';

    console.log('='.repeat(60));
    console.log('CHART STORAGE DIAGNOSTIC TEST');
    console.log('='.repeat(60));

    // Get current username
    const username = window.currentUsername || localStorage.getItem('consensusUsername');
    console.log('Current username:', username);

    if (!username) {
        console.error('❌ No username found. Please log in first.');
        return;
    }

    // Check if classData exists
    if (!window.classData) {
        console.error('❌ window.classData not found');
        return;
    }

    console.log('\n1. CHECKING IN-MEMORY STORAGE (window.classData):');
    console.log('-'.repeat(50));

    const userData = window.classData.users?.[username];
    if (!userData) {
        console.error('❌ No user data found for', username);
    } else {
        console.log('✅ User data found');

        // Check answers
        if (userData.answers) {
            const answerCount = Object.keys(userData.answers).length;
            console.log(`  - Answers: ${answerCount} total`);

            // Look for charts in answers
            let chartCount = 0;
            Object.entries(userData.answers).forEach(([qid, answer]) => {
                if (answer && typeof answer === 'object' &&
                    (answer.type || answer.chartType)) {
                    chartCount++;
                    console.log(`    📊 Chart found: ${qid}`);
                    console.log(`       Type: ${answer.type || answer.chartType}`);
                    console.log(`       Title: ${answer.title || 'No title'}`);
                }
            });

            if (chartCount === 0) {
                console.log('  ⚠️ No charts found in answers');
            } else {
                console.log(`  ✅ ${chartCount} charts found in answers`);
            }
        } else {
            console.log('  ⚠️ No answers property');
        }

        // Check charts collection
        if (userData.charts) {
            const chartCount = Object.keys(userData.charts).length;
            console.log(`  - Charts collection: ${chartCount} charts`);
            Object.entries(userData.charts).forEach(([qid, chart]) => {
                console.log(`    📊 ${qid}: ${chart.type || chart.chartType}`);
            });
        } else {
            console.log('  ⚠️ No charts collection');
        }
    }

    console.log('\n2. CHECKING LOCALSTORAGE:');
    console.log('-'.repeat(50));

    // Check raw localStorage
    const classDataStr = localStorage.getItem('classData');
    if (classDataStr) {
        console.log('✅ classData in localStorage:', classDataStr.length, 'bytes');
        try {
            const classDataParsed = JSON.parse(classDataStr);
            const userInStorage = classDataParsed.users?.[username];
            if (userInStorage) {
                console.log('✅ User data in localStorage');

                // Count charts in localStorage
                let storageChartCount = 0;
                if (userInStorage.answers) {
                    Object.entries(userInStorage.answers).forEach(([qid, answer]) => {
                        if (answer && typeof answer === 'object' &&
                            (answer.type || answer.chartType)) {
                            storageChartCount++;
                        }
                    });
                }
                console.log(`  - Charts in answers: ${storageChartCount}`);

                if (userInStorage.charts) {
                    console.log(`  - Charts collection: ${Object.keys(userInStorage.charts).length}`);
                }
            } else {
                console.log('❌ User not found in localStorage classData');
            }
        } catch (e) {
            console.error('❌ Failed to parse classData:', e);
        }
    } else {
        console.error('❌ No classData in localStorage');
    }

    console.log('\n3. TESTING SAVE FUNCTION:');
    console.log('-'.repeat(50));

    // Check if saveClassData is available
    if (typeof window.saveClassData === 'function') {
        console.log('✅ window.saveClassData is available');
        // Try to save
        try {
            window.saveClassData();
            console.log('✅ saveClassData() executed successfully');
        } catch (e) {
            console.error('❌ saveClassData() failed:', e);
        }
    } else {
        console.error('❌ window.saveClassData is NOT available');
        console.log('   This means charts cannot be saved to localStorage!');
    }

    console.log('\n4. TESTING CHART WIZARD FUNCTIONS:');
    console.log('-'.repeat(50));

    if (typeof window.openChartWizard === 'function') {
        console.log('✅ window.openChartWizard is available');
    } else {
        console.error('❌ window.openChartWizard is NOT available');
    }

    if (typeof window.renderChartWizardPreview === 'function') {
        console.log('✅ window.renderChartWizardPreview is available');
    } else {
        console.error('❌ window.renderChartWizardPreview is NOT available');
    }

    console.log('\n5. SPECIFIC QUESTION CHECK (U1-L10-Q04):');
    console.log('-'.repeat(50));

    const testQid = 'U1-L10-Q04';
    const answer = userData?.answers?.[testQid];
    const chart = userData?.charts?.[testQid];

    if (answer || chart) {
        console.log('✅ Data found for', testQid);
        if (answer) {
            console.log('  Answer type:', typeof answer);
            console.log('  Answer value:', answer);
        }
        if (chart) {
            console.log('  Chart type:', chart.type || chart.chartType);
            console.log('  Chart title:', chart.title);
        }
    } else {
        console.log('❌ No data found for', testQid);
    }

    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60));

    console.log('\n📋 SUMMARY:');
    const hasData = !!userData;
    const hasCharts = userData?.charts && Object.keys(userData.charts).length > 0;
    const hasSaveFunction = typeof window.saveClassData === 'function';
    const hasWizardFunction = typeof window.openChartWizard === 'function';

    if (hasData && hasCharts && hasSaveFunction && hasWizardFunction) {
        console.log('✅ Chart system appears functional');
        console.log('   - Charts are being saved to memory');
        console.log('   - Save function is available');
        console.log('   - Chart wizard is available');
        console.log('\n⚠️ BUT: Charts may not be displaying on questions!');
        console.log('   The integration between questions and charts is missing.');
    } else {
        console.log('❌ Chart system has issues:');
        if (!hasData) console.log('   - User data not found');
        if (!hasCharts) console.log('   - No charts saved');
        if (!hasSaveFunction) console.log('   - Save function missing');
        if (!hasWizardFunction) console.log('   - Chart wizard not loaded');
    }

})();