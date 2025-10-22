/**
 * test_progress_charts.js - Test Harness for Progress Charts
 * Part of AP Statistics Consensus Quiz
 *
 * Static JSON fixtures and test functions for progress chart development.
 */

/**
 * Get test progress data with various edge cases
 */
window.getTestProgressData = function() {
    const now = new Date();
    const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    return [
        // Unit 1 - Well populated
        { question_id: 'U1-L1-Q01', answer: 'A', reason: 'Test reason 1', timestamp: daysAgo(14), attempt: 1 },
        { question_id: 'U1-L1-Q02', answer: 'B', reason: 'Test reason 2', timestamp: daysAgo(14), attempt: 1 },
        { question_id: 'U1-L1-Q03', answer: 'C', reason: 'Test reason 3', timestamp: daysAgo(13), attempt: 1 },
        { question_id: 'U1-L2-Q01', answer: 'D', reason: 'Test reason 4', timestamp: daysAgo(13), attempt: 2 },
        { question_id: 'U1-L2-Q02', answer: 'A', reason: 'Test reason 5', timestamp: daysAgo(12), attempt: 1 },
        { question_id: 'U1-L3-Q01', answer: 'B', reason: 'Test reason 6', timestamp: daysAgo(12), attempt: 1 },
        { question_id: 'U1-L3-Q02', answer: 'C', reason: 'Test reason 7', timestamp: daysAgo(11), attempt: 3 },
        { question_id: 'U1-L3-Q03', answer: 'D', reason: 'Test reason 8', timestamp: daysAgo(11), attempt: 1 },

        // Unit 2 - Moderate
        { question_id: 'U2-L1-Q01', answer: 'A', reason: 'Test reason 9', timestamp: daysAgo(10), attempt: 1 },
        { question_id: 'U2-L1-Q02', answer: 'B', reason: 'Test reason 10', timestamp: daysAgo(10), attempt: 1 },
        { question_id: 'U2-L2-Q01', answer: 'C', reason: 'Test reason 11', timestamp: daysAgo(9), attempt: 2 },
        { question_id: 'U2-L2-Q02', answer: 'D', reason: 'Test reason 12', timestamp: daysAgo(8), attempt: 1 },
        { question_id: 'U2-L3-Q01', answer: 'A', reason: 'Test reason 13', timestamp: daysAgo(7), attempt: 1 },

        // Unit 3 - Sparse
        { question_id: 'U3-L1-Q01', answer: 'B', reason: 'Test reason 14', timestamp: daysAgo(6), attempt: 1 },
        { question_id: 'U3-L1-Q02', answer: 'C', reason: 'Test reason 15', timestamp: daysAgo(5), attempt: 1 },
        { question_id: 'U3-L2-Q01', answer: 'D', reason: 'Test reason 16', timestamp: daysAgo(4), attempt: 2 },

        // Unit 4 - Recent activity
        { question_id: 'U4-L1-Q01', answer: 'A', reason: 'Test reason 17', timestamp: daysAgo(3), attempt: 1 },
        { question_id: 'U4-L1-Q02', answer: 'B', reason: 'Test reason 18', timestamp: daysAgo(2), attempt: 1 },
        { question_id: 'U4-L1-Q03', answer: 'C', reason: 'Test reason 19', timestamp: daysAgo(1), attempt: 1 },
        { question_id: 'U4-L2-Q01', answer: 'D', reason: 'Test reason 20', timestamp: daysAgo(1), attempt: 1 },
        { question_id: 'U4-L2-Q02', answer: 'A', reason: 'Test reason 21', timestamp: daysAgo(0), attempt: 1 },

        // Some retries scattered throughout
        { question_id: 'U1-L1-Q01', answer: 'B', reason: 'Retry 1', timestamp: daysAgo(7), attempt: 2 },
        { question_id: 'U2-L1-Q01', answer: 'C', reason: 'Retry 2', timestamp: daysAgo(5), attempt: 2 },
        { question_id: 'U3-L1-Q01', answer: 'D', reason: 'Retry 3', timestamp: daysAgo(3), attempt: 2 },
    ];
};

/**
 * Get minimal test data (edge case: very sparse)
 */
window.getMinimalTestData = function() {
    return [
        { question_id: 'U1-L1-Q01', answer: 'A', timestamp: new Date().toISOString(), attempt: 1 }
    ];
};

/**
 * Get empty test data (edge case: no progress)
 */
window.getEmptyTestData = function() {
    return [];
};

/**
 * Get test data with gaps (edge case: irregular activity)
 */
window.getGappyTestData = function() {
    return [
        { question_id: 'U1-L1-Q01', answer: 'A', timestamp: '2024-01-01T10:00:00Z', attempt: 1 },
        { question_id: 'U1-L1-Q02', answer: 'B', timestamp: '2024-01-01T10:05:00Z', attempt: 1 },
        { question_id: 'U2-L1-Q01', answer: 'C', timestamp: '2024-01-08T14:00:00Z', attempt: 1 }, // 7-day gap
        { question_id: 'U2-L1-Q02', answer: 'D', timestamp: '2024-01-15T09:00:00Z', attempt: 1 }, // Another 7-day gap
        { question_id: 'U3-L1-Q01', answer: 'A', timestamp: '2024-01-30T11:00:00Z', attempt: 1 }, // 15-day gap
    ];
};

/**
 * Get units metadata for testing
 */
window.getTestUnitsMetadata = function() {
    return {
        1: { name: 'Unit 1: Exploring Data', totalQuestions: 10 },
        2: { name: 'Unit 2: Sampling and Experimentation', totalQuestions: 8 },
        3: { name: 'Unit 3: Probability', totalQuestions: 6 },
        4: { name: 'Unit 4: Random Variables', totalQuestions: 7 },
        5: { name: 'Unit 5: Sampling Distributions', totalQuestions: 0 } // Not started
    };
};

/**
 * Get answer key for testing success rates
 */
window.getTestAnswerKey = function() {
    return {
        'U1-L1-Q01': 'A',
        'U1-L1-Q02': 'B',
        'U1-L1-Q03': 'C',
        'U1-L2-Q01': 'D',
        'U1-L2-Q02': 'A',
        'U1-L3-Q01': 'B',
        'U1-L3-Q02': 'C',
        'U1-L3-Q03': 'D',
        'U2-L1-Q01': 'A',
        'U2-L1-Q02': 'B',
        'U2-L2-Q01': 'C',
        'U2-L2-Q02': 'D',
        'U2-L3-Q01': 'A',
        'U3-L1-Q01': 'B',
        'U3-L1-Q02': 'C',
        'U3-L2-Q01': 'D',
        'U4-L1-Q01': 'A',
        'U4-L1-Q02': 'B',
        'U4-L1-Q03': 'C',
        'U4-L2-Q01': 'D',
        'U4-L2-Q02': 'A'
    };
};

/**
 * Test all adapter functions with various datasets
 */
window.testProgressChartAdapters = function() {
    console.group('📊 Testing Progress Chart Adapters');

    const adapter = new window.ProgressChartAdapter();

    // Test with full dataset
    console.group('Test 1: Full Dataset');
    const testData = window.getTestProgressData();
    console.log('Input data:', testData);
    console.log('Data points:', testData.length);

    console.log('\n1. Unit Completion:');
    const unitCompletion = adapter.unitCompletionData(testData, window.getTestUnitsMetadata());
    console.log(unitCompletion);

    console.log('\n2. Time Series (Daily):');
    const timeSeries = adapter.timeSeriesData(testData, 'daily');
    console.log(timeSeries);

    console.log('\n3. Success Rate:');
    const successRate = adapter.successRateData(testData, window.getTestAnswerKey());
    console.log(successRate);

    console.log('\n4. Learning Velocity:');
    const velocity = adapter.learningVelocityData(testData, 7);
    console.log(velocity);

    console.log('\n5. Stats Summary:');
    const stats = adapter.getStatsSummary(testData);
    console.log(stats);
    console.groupEnd();

    // Test with minimal data
    console.group('Test 2: Minimal Data (Single Point)');
    const minimalData = window.getMinimalTestData();
    console.log('Unit Completion:', adapter.unitCompletionData(minimalData));
    console.log('Time Series:', adapter.timeSeriesData(minimalData));
    console.groupEnd();

    // Test with empty data
    console.group('Test 3: Empty Data');
    const emptyData = window.getEmptyTestData();
    console.log('Unit Completion:', adapter.unitCompletionData(emptyData));
    console.log('Time Series:', adapter.timeSeriesData(emptyData));
    console.log('Stats Summary:', adapter.getStatsSummary(emptyData));
    console.groupEnd();

    // Test with gappy data
    console.group('Test 4: Gappy Data (Irregular Activity)');
    const gappyData = window.getGappyTestData();
    console.log('Time Series:', adapter.timeSeriesData(gappyData, 'daily'));
    console.log('Learning Velocity:', adapter.learningVelocityData(gappyData, 3));
    console.groupEnd();

    // Test different aggregations
    console.group('Test 5: Different Time Aggregations');
    const fullData = window.getTestProgressData();
    console.log('Weekly:', adapter.timeSeriesData(fullData, 'weekly'));
    console.log('Monthly:', adapter.timeSeriesData(fullData, 'monthly'));
    console.groupEnd();

    console.log('\n✅ All adapter tests complete! Check output above.');
    console.groupEnd();

    return {
        adapter,
        testData,
        results: {
            unitCompletion,
            timeSeries,
            successRate,
            velocity,
            stats
        }
    };
};

/**
 * Quick test of a single adapter function
 */
window.testAdapter = function(functionName, ...args) {
    const adapter = new window.ProgressChartAdapter();
    const testData = args[0] || window.getTestProgressData();

    console.group(`Testing ${functionName}`);
    const result = adapter[functionName](testData, ...args.slice(1));
    console.log('Input:', testData.length, 'data points');
    console.log('Output:', result);
    console.groupEnd();

    return result;
};

/**
 * Verify data shape matches Chart.js spec
 */
window.verifyChartJsDataShape = function(dataset) {
    console.group('🔍 Verifying Chart.js Data Shape');

    const checks = {
        hasLabels: Array.isArray(dataset.labels),
        hasDatasets: Array.isArray(dataset.datasets),
        datasetsNotEmpty: dataset.datasets?.length > 0,
        firstDatasetHasData: dataset.datasets?.[0]?.data !== undefined,
        dataIsArray: Array.isArray(dataset.datasets?.[0]?.data),
        labelsMatchData: dataset.labels?.length === dataset.datasets?.[0]?.data?.length
    };

    console.table(checks);

    const allPassed = Object.values(checks).every(v => v === true);
    if (allPassed) {
        console.log('✅ Dataset structure is valid for Chart.js');
    } else {
        console.warn('⚠️ Dataset structure has issues');
    }

    console.groupEnd();

    return allPassed;
};

/**
 * Performance test for large datasets
 */
window.testAdapterPerformance = function(dataSize = 1000) {
    console.group(`⚡ Performance Test (${dataSize} data points)`);

    // Generate large dataset
    const largeData = [];
    const now = Date.now();
    for (let i = 0; i < dataSize; i++) {
        const daysAgo = Math.floor(i / 10);
        const unitNum = (i % 5) + 1;
        const lessonNum = (i % 3) + 1;
        const questionNum = (i % 10) + 1;

        largeData.push({
            question_id: `U${unitNum}-L${lessonNum}-Q${String(questionNum).padStart(2, '0')}`,
            answer: ['A', 'B', 'C', 'D'][i % 4],
            timestamp: new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
            attempt: (i % 3) + 1
        });
    }

    const adapter = new window.ProgressChartAdapter();

    // Test each function
    const tests = [
        { name: 'unitCompletionData', fn: () => adapter.unitCompletionData(largeData) },
        { name: 'timeSeriesData', fn: () => adapter.timeSeriesData(largeData) },
        { name: 'successRateData', fn: () => adapter.successRateData(largeData) },
        { name: 'learningVelocityData', fn: () => adapter.learningVelocityData(largeData) },
        { name: 'getStatsSummary', fn: () => adapter.getStatsSummary(largeData) }
    ];

    const results = tests.map(test => {
        const start = performance.now();
        test.fn();
        const duration = performance.now() - start;
        return { name: test.name, duration: duration.toFixed(2) + 'ms' };
    });

    console.table(results);

    const totalTime = results.reduce((sum, r) => sum + parseFloat(r.duration), 0);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);

    if (totalTime < 100) {
        console.log('✅ Performance is excellent (< 100ms)');
    } else if (totalTime < 500) {
        console.log('✔️ Performance is acceptable (< 500ms)');
    } else {
        console.warn('⚠️ Performance may need optimization (> 500ms)');
    }

    console.groupEnd();

    return results;
};

console.log('[TestProgressCharts] Test harness loaded');
console.log('Available test functions:');
console.log('  - window.testProgressChartAdapters()');
console.log('  - window.testAdapter(functionName, data, ...args)');
console.log('  - window.verifyChartJsDataShape(dataset)');
console.log('  - window.testAdapterPerformance(dataSize)');
console.log('  - window.getTestProgressData()');
console.log('  - window.getMinimalTestData()');
console.log('  - window.getEmptyTestData()');
console.log('  - window.getGappyTestData()');
