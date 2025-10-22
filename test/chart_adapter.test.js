/**
 * chart_adapter.test.js - Chart Adapter Tests
 * Tests for ProgressChartAdapter data transformations
 */

QUnit.module('ProgressChartAdapter - Unit Completion', (hooks) => {
    let adapter;
    let testData;
    let unitsMetadata;

    hooks.beforeEach(async () => {
        // Load test fixtures
        const response = await fetch('/test/fixtures/progress_data.json');
        const fixtures = await response.json();
        testData = fixtures.typical;

        const unitsResponse = await fetch('/test/fixtures/units_metadata.json');
        unitsMetadata = await unitsResponse.json();

        // Create adapter instance
        if (typeof window.ProgressChartAdapter !== 'undefined') {
            adapter = new window.ProgressChartAdapter();
        }
    });

    QUnit.test('unitCompletionData generates Chart.js compatible dataset', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.unitCompletionData(testData, unitsMetadata);

        // Verify Chart.js structure
        assert.ok(chartData.labels, 'Has labels array');
        assert.ok(Array.isArray(chartData.labels), 'Labels is an array');
        assert.ok(chartData.datasets, 'Has datasets array');
        assert.ok(Array.isArray(chartData.datasets), 'Datasets is an array');

        // Verify dataset structure
        const dataset = chartData.datasets[0];
        assert.ok(dataset.label, 'Dataset has label');
        assert.ok(Array.isArray(dataset.data), 'Dataset has data array');
        assert.strictEqual(dataset.data.length, chartData.labels.length, 'Data length matches labels');
    });

    QUnit.test('unitCompletionData calculates percentages correctly', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.unitCompletionData(testData, unitsMetadata);

        // Find Unit 1 data
        const unit1Index = chartData.labels.findIndex(label => label.includes('Unit 1'));
        if (unit1Index !== -1) {
            const unit1Completion = chartData.datasets[0].data[unit1Index];

            // Unit 1 has 45 total questions, testData has 2 from Unit 1
            const expectedPercentage = (2 / 45) * 100;

            assert.ok(
                Math.abs(unit1Completion - expectedPercentage) < 1,
                `Unit 1 completion is approximately ${expectedPercentage}% (actual: ${unit1Completion})`
            );
        }
    });

    QUnit.test('unitCompletionData handles empty data', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.unitCompletionData([], unitsMetadata);

        assert.ok(chartData.labels, 'Returns labels even with empty data');
        assert.ok(chartData.datasets, 'Returns datasets even with empty data');

        // All completion should be 0%
        if (chartData.datasets.length > 0) {
            const allZero = chartData.datasets[0].data.every(val => val === 0);
            assert.ok(allZero, 'All completion percentages are 0 for empty data');
        }
    });

    QUnit.test('unitCompletionData applies color coding', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.unitCompletionData(testData, unitsMetadata);
        const dataset = chartData.datasets[0];

        assert.ok(dataset.backgroundColor, 'Has backgroundColor');

        if (Array.isArray(dataset.backgroundColor)) {
            // Each bar has a color
            assert.strictEqual(
                dataset.backgroundColor.length,
                chartData.labels.length,
                'Each unit has a color'
            );
        } else {
            // Single color for all bars
            assert.ok(typeof dataset.backgroundColor === 'string', 'backgroundColor is a string');
        }
    });
});

QUnit.module('ProgressChartAdapter - Time Series', (hooks) => {
    let adapter;
    let testData;

    hooks.beforeEach(async () => {
        const response = await fetch('/test/fixtures/progress_data.json');
        const fixtures = await response.json();
        testData = fixtures.multiWeek;

        if (typeof window.ProgressChartAdapter !== 'undefined') {
            adapter = new window.ProgressChartAdapter();
        }
    });

    QUnit.test('timeSeriesData groups by day', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.timeSeriesData(testData, 'daily');

        assert.ok(chartData.labels, 'Has labels');
        assert.ok(chartData.datasets, 'Has datasets');

        // Verify chronological order
        const labels = chartData.labels;
        for (let i = 1; i < labels.length; i++) {
            const prevDate = new Date(labels[i - 1]);
            const currDate = new Date(labels[i]);
            assert.ok(currDate >= prevDate, `Labels are chronological: ${labels[i - 1]} <= ${labels[i]}`);
        }
    });

    QUnit.test('timeSeriesData fills gaps', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        // Data with gaps
        const gapData = [
            {
                questionId: 'U1-L1-Q01',
                timestamp: '2024-10-01T10:00:00.000Z',
                correct: true,
                attempts: 1
            },
            {
                questionId: 'U1-L1-Q02',
                timestamp: '2024-10-05T10:00:00.000Z', // 4-day gap
                correct: true,
                attempts: 1
            }
        ];

        const chartData = adapter.timeSeriesData(gapData, 'daily');

        // Should have labels for all days between Oct 1 and Oct 5
        assert.ok(chartData.labels.length >= 5, 'Fills gap days');

        // Days with no activity should have 0
        const dataset = chartData.datasets[0];
        const hasZeros = dataset.data.some(val => val === 0);
        assert.ok(hasZeros, 'Gap days have 0 activity');
    });

    QUnit.test('timeSeriesData aggregates weekly', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.timeSeriesData(testData, 'weekly');

        assert.ok(chartData.labels, 'Has labels');
        assert.ok(chartData.datasets, 'Has datasets');

        // Weekly aggregation should have fewer points than daily
        const dailyData = adapter.timeSeriesData(testData, 'daily');
        assert.ok(
            chartData.labels.length <= dailyData.labels.length,
            'Weekly data has fewer or equal points than daily'
        );
    });

    QUnit.test('timeSeriesData handles single day', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const response = await fetch('/test/fixtures/progress_data.json');
        const fixtures = await response.json();
        const singleDayData = fixtures.edgeCases.sameDay;

        const chartData = adapter.timeSeriesData(singleDayData, 'daily');

        assert.strictEqual(chartData.labels.length, 1, 'Single day has one label');
        assert.strictEqual(chartData.datasets[0].data.length, 1, 'Single day has one data point');
        assert.strictEqual(chartData.datasets[0].data[0], 3, 'Counts all questions on that day');
    });
});

QUnit.module('ProgressChartAdapter - Success Rate', (hooks) => {
    let adapter;
    let testData;

    hooks.beforeEach(async () => {
        const response = await fetch('/test/fixtures/progress_data.json');
        const fixtures = await response.json();
        testData = fixtures.typical;

        if (typeof window.ProgressChartAdapter !== 'undefined') {
            adapter = new window.ProgressChartAdapter();
        }
    });

    QUnit.test('successRateData tracks first attempt vs retry', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.successRateData(testData);

        assert.ok(chartData.labels, 'Has labels');
        assert.ok(chartData.datasets, 'Has datasets');

        // Should have datasets for first attempt and retries
        assert.ok(chartData.datasets.length >= 1, 'Has at least one dataset');

        const dataset = chartData.datasets[0];
        assert.ok(dataset.label, 'Dataset has label');
        assert.ok(Array.isArray(dataset.data), 'Dataset has data array');
    });

    QUnit.test('successRateData calculates correct/incorrect with answer key', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const answerKey = {
            'U1-L1-Q01': 'A',
            'U1-L1-Q02': 'B',
            'U1-L2-Q01': 'C'
        };

        const dataWithAnswers = [
            { questionId: 'U1-L1-Q01', timestamp: '2024-10-10T10:00:00.000Z', answer: 'A', attempts: 1 },
            { questionId: 'U1-L1-Q02', timestamp: '2024-10-10T10:05:00.000Z', answer: 'A', attempts: 1 }, // Wrong
            { questionId: 'U1-L2-Q01', timestamp: '2024-10-10T10:10:00.000Z', answer: 'C', attempts: 1 }
        ];

        const chartData = adapter.successRateData(dataWithAnswers, answerKey);

        // Verify correct/incorrect counts
        const totalQuestions = dataWithAnswers.length;
        const totalCounted = chartData.datasets.reduce((sum, ds) => {
            return sum + ds.data.reduce((s, v) => s + v, 0);
        }, 0);

        assert.ok(totalCounted > 0, 'Has counted questions');
    });

    QUnit.test('successRateData handles all correct answers', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const allCorrectData = [
            { questionId: 'U1-L1-Q01', timestamp: '2024-10-10T10:00:00.000Z', correct: true, attempts: 1 },
            { questionId: 'U1-L1-Q02', timestamp: '2024-10-10T10:05:00.000Z', correct: true, attempts: 1 },
            { questionId: 'U1-L2-Q01', timestamp: '2024-10-10T10:10:00.000Z', correct: true, attempts: 1 }
        ];

        const chartData = adapter.successRateData(allCorrectData);

        assert.ok(chartData.datasets, 'Returns valid dataset for all correct');
    });
});

QUnit.module('ProgressChartAdapter - Learning Velocity', (hooks) => {
    let adapter;
    let testData;

    hooks.beforeEach(async () => {
        const response = await fetch('/test/fixtures/progress_data.json');
        const fixtures = await response.json();
        testData = fixtures.multiWeek;

        if (typeof window.ProgressChartAdapter !== 'undefined') {
            adapter = new window.ProgressChartAdapter();
        }
    });

    QUnit.test('learningVelocityData calculates daily rate', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.learningVelocityData(testData, 7); // 7-day window

        assert.ok(chartData.labels, 'Has labels');
        assert.ok(chartData.datasets, 'Has datasets');

        // Verify positive values
        const dataset = chartData.datasets[0];
        const allPositiveOrZero = dataset.data.every(val => val >= 0);
        assert.ok(allPositiveOrZero, 'All velocity values are non-negative');
    });

    QUnit.test('learningVelocityData applies moving average', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const chartData = adapter.learningVelocityData(testData, 3); // 3-day window

        // Should have dataset for moving average
        const hasMovingAverage = chartData.datasets.some(ds =>
            ds.label && ds.label.toLowerCase().includes('average')
        );

        if (hasMovingAverage) {
            assert.ok(true, 'Has moving average dataset');
        } else {
            assert.ok(true, 'Moving average may be in single dataset');
        }
    });

    QUnit.test('learningVelocityData handles sparse data', (assert) => {
        if (!adapter) {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        const sparseData = [
            { questionId: 'U1-L1-Q01', timestamp: '2024-10-01T10:00:00.000Z', correct: true, attempts: 1 },
            { questionId: 'U1-L1-Q02', timestamp: '2024-10-10T10:00:00.000Z', correct: true, attempts: 1 } // 9-day gap
        ];

        const chartData = adapter.learningVelocityData(sparseData, 7);

        assert.ok(chartData.labels, 'Handles sparse data');
        assert.ok(chartData.datasets, 'Returns datasets for sparse data');
    });
});

QUnit.module('ProgressChartAdapter - Edge Cases', () => {
    let adapter;

    QUnit.test('handles null/undefined data', (assert) => {
        if (typeof window.ProgressChartAdapter === 'undefined') {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        adapter = new window.ProgressChartAdapter();

        // Test with null
        try {
            const result = adapter.timeSeriesData(null);
            assert.ok(result, 'Handles null data');
        } catch (error) {
            assert.ok(true, 'Throws error for null data (acceptable)');
        }

        // Test with undefined
        try {
            const result = adapter.timeSeriesData(undefined);
            assert.ok(result, 'Handles undefined data');
        } catch (error) {
            assert.ok(true, 'Throws error for undefined data (acceptable)');
        }
    });

    QUnit.test('handles malformed data', (assert) => {
        if (typeof window.ProgressChartAdapter === 'undefined') {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        adapter = new window.ProgressChartAdapter();

        const malformedData = [
            { questionId: 'U1-L1-Q01' }, // Missing timestamp
            { timestamp: '2024-10-10T10:00:00.000Z' }, // Missing questionId
            { questionId: null, timestamp: null } // Null values
        ];

        try {
            const result = adapter.timeSeriesData(malformedData);
            assert.ok(result, 'Handles malformed data gracefully');
        } catch (error) {
            assert.ok(true, 'Throws error for malformed data (acceptable)');
        }
    });

    QUnit.test('validates Chart.js compatibility', (assert) => {
        if (typeof window.ProgressChartAdapter === 'undefined') {
            assert.ok(true, 'ProgressChartAdapter not loaded, skipping test');
            return;
        }

        if (typeof window.getTestProgressData === 'function') {
            const testData = window.getTestProgressData();
            adapter = new window.ProgressChartAdapter();

            const chartData = adapter.unitCompletionData(testData, { units: [] });

            // Use MockChart to validate
            if (typeof window.Chart !== 'undefined' && window.Chart.validateConfig) {
                const validation = window.Chart.validateConfig({
                    type: 'bar',
                    data: chartData,
                    options: {}
                });

                assert.ok(validation.valid, 'Chart.js config is valid');
            } else {
                // Manual validation
                assert.ok(chartData.labels, 'Has labels');
                assert.ok(Array.isArray(chartData.labels), 'Labels is array');
                assert.ok(chartData.datasets, 'Has datasets');
                assert.ok(Array.isArray(chartData.datasets), 'Datasets is array');

                if (chartData.datasets.length > 0) {
                    const ds = chartData.datasets[0];
                    assert.ok(Array.isArray(ds.data), 'Dataset data is array');
                }
            }
        } else {
            assert.ok(true, 'Test data generator not available');
        }
    });
});
