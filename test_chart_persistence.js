/**
 * Test Script for Chart Persistence Implementation
 * Run this in the browser console to test all storage modes
 */

(function() {
    'use strict';

    console.log('📊 Starting Chart Persistence Tests...\n');

    // Test data
    const testUsername = 'Test_User';
    const testQuestionId = 'U1-L10-Q04';
    const testChartSIF = {
        type: 'histogram',
        chartType: 'histogram',
        title: 'Test Distribution',
        xLabel: 'Values',
        yLabel: 'Frequency',
        data: {
            bins: [
                { label: '0-10', value: 5 },
                { label: '10-20', value: 8 },
                { label: '20-30', value: 12 },
                { label: '30-40', value: 7 },
                { label: '40-50', value: 3 }
            ],
            seriesName: 'Frequency'
        },
        meta: {
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
    };

    // Test results
    const results = {
        sifDeserializer: false,
        sessionFallback: false,
        railwayHydration: false,
        localStorage: false,
        chartSerialization: false,
        chartDeserialization: false
    };

    // Test 1: Check if modules are loaded
    console.log('Test 1: Module Loading');
    console.log('-'.repeat(40));

    if (window.sifDeserializer) {
        console.log('✅ SIF Deserializer loaded');
        results.sifDeserializer = true;
    } else {
        console.log('❌ SIF Deserializer not loaded');
    }

    if (window.sessionFallback) {
        console.log('✅ Session Fallback loaded');
        results.sessionFallback = true;
        console.log('   Storage type:', window.sessionFallback.getStorageType());
    } else {
        console.log('❌ Session Fallback not loaded');
    }

    if (window.railwayHydration) {
        console.log('✅ Railway Hydration loaded');
        results.railwayHydration = true;
    } else {
        console.log('❌ Railway Hydration not loaded');
    }

    console.log('');

    // Test 2: Storage availability
    console.log('Test 2: Storage Availability');
    console.log('-'.repeat(40));

    if (window.sessionFallback) {
        const storageInfo = window.sessionFallback.getStorageInfo();
        console.log('Storage Type:', storageInfo.type);
        console.log('Keys Count:', storageInfo.keyCount);
        console.log('Total Size:', storageInfo.sizeInKB, 'KB');

        if (storageInfo.type === 'localStorage') {
            console.log('✅ LocalStorage available');
            results.localStorage = true;
        } else if (storageInfo.type === 'sessionStorage') {
            console.log('⚠️ Using SessionStorage (data will be lost on browser close)');
            results.localStorage = false;
        } else {
            console.log('⚠️ Using Memory storage (data will be lost on refresh)');
            results.localStorage = false;
        }
    }

    console.log('');

    // Test 3: Chart serialization
    console.log('Test 3: Chart Serialization');
    console.log('-'.repeat(40));

    if (window.sifDeserializer) {
        try {
            const serialized = window.sifDeserializer.serializeSIF(testChartSIF);
            console.log('✅ Chart serialized successfully');
            console.log('   Serialized length:', serialized.length, 'chars');
            results.chartSerialization = true;
        } catch (e) {
            console.log('❌ Chart serialization failed:', e.message);
        }
    }

    console.log('');

    // Test 4: Chart deserialization
    console.log('Test 4: Chart Deserialization');
    console.log('-'.repeat(40));

    if (window.sifDeserializer) {
        const serialized = JSON.stringify(testChartSIF);
        const result = window.sifDeserializer.deserializeAnswer(serialized);

        if (result.isChart && !result.error) {
            console.log('✅ Chart deserialized successfully');
            console.log('   Chart type:', result.data.type || result.data.chartType);
            console.log('   Data valid:', window.sifDeserializer.validateChartData(result.data));
            results.chartDeserialization = true;
        } else {
            console.log('❌ Chart deserialization failed:', result.error);
        }
    }

    console.log('');

    // Test 5: Railway connection
    console.log('Test 5: Railway Connection');
    console.log('-'.repeat(40));

    if (window.USE_RAILWAY && window.railwayHydration) {
        window.railwayHydration.testRailwayConnection().then(connected => {
            if (connected) {
                console.log('✅ Railway server connected');
            } else {
                console.log('⚠️ Railway server not reachable');
            }
        });
    } else {
        console.log('ℹ️ Railway disabled or not configured');
    }

    console.log('');

    // Test 6: Save and retrieve chart
    console.log('Test 6: Save and Retrieve Chart');
    console.log('-'.repeat(40));

    if (window.sessionFallback) {
        try {
            // Save chart
            const testKey = 'test_chart_' + Date.now();
            const chartJson = JSON.stringify(testChartSIF);
            window.sessionFallback.setItem(testKey, chartJson);
            console.log('✅ Chart saved to storage');

            // Retrieve chart
            const retrieved = window.sessionFallback.getItem(testKey);
            if (retrieved) {
                const parsed = JSON.parse(retrieved);
                console.log('✅ Chart retrieved successfully');
                console.log('   Title:', parsed.title);
                console.log('   Type:', parsed.type);

                // Clean up
                window.sessionFallback.removeItem(testKey);
            } else {
                console.log('❌ Failed to retrieve chart');
            }
        } catch (e) {
            console.log('❌ Storage test failed:', e.message);
        }
    }

    console.log('');

    // Summary
    console.log('Test Summary');
    console.log('='.repeat(40));

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    console.log(`Tests passed: ${passed}/${total}`);
    console.log('');

    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}`);
    });

    console.log('');

    // Recommendations
    console.log('Recommendations');
    console.log('='.repeat(40));

    if (!results.localStorage) {
        console.log('⚠️ LocalStorage not available. Consider:');
        console.log('   - Enabling cookies/storage in browser settings');
        console.log('   - Using Railway/Supabase for cloud persistence');
        console.log('   - Exporting data frequently');
    }

    if (!results.railwayHydration) {
        console.log('ℹ️ Railway hydration not available. Check:');
        console.log('   - Railway server configuration');
        console.log('   - Network connectivity');
    }

    console.log('\n📊 Chart Persistence Tests Complete!');

    // Return results for programmatic use
    return {
        passed: passed,
        total: total,
        results: results
    };

})();