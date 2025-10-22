/**
 * progress_chart_adapter.js - Progress Chart Data Adapters
 * Part of AP Statistics Consensus Quiz
 *
 * Transforms P7 progress data into Chart.js compatible datasets.
 * Functions are pure (no side effects) and testable.
 */

class ProgressChartAdapter {
    constructor() {
        // Cache for expensive calculations
        this._cache = {
            unitCompletion: null,
            timeSeries: null,
            successRate: null,
            learningVelocity: null
        };
        this._cacheTimestamp = null;
    }

    /**
     * Clear cache (call when progress data changes)
     */
    clearCache() {
        this._cache = {
            unitCompletion: null,
            timeSeries: null,
            successRate: null,
            learningVelocity: null
        };
        this._cacheTimestamp = null;
    }

    /**
     * Unit Completion Data
     * Calculate percentage of questions answered per unit
     *
     * @param {Array} progressData - Array of progress items from P7
     * @param {Object} unitsMetadata - Optional metadata about total questions per unit
     * @returns {Object} Chart.js dataset for bar chart
     */
    unitCompletionData(progressData, unitsMetadata = null) {
        if (!progressData || !Array.isArray(progressData)) {
            return this._emptyDataset('No progress data available');
        }

        // Check cache
        if (this._cache.unitCompletion && this._cacheTimestamp === Date.now()) {
            return this._cache.unitCompletion;
        }

        // Extract unit numbers from question IDs (format: U1-L3-Q01)
        const unitCounts = {};
        const unitTotals = {};

        progressData.forEach(item => {
            const match = item.question_id?.match(/^U(\d+)-/);
            if (match) {
                const unitNum = parseInt(match[1]);
                unitCounts[unitNum] = (unitCounts[unitNum] || 0) + 1;
            }
        });

        // Get total questions per unit from metadata or estimate
        if (unitsMetadata) {
            Object.keys(unitsMetadata).forEach(unitNum => {
                unitTotals[unitNum] = unitsMetadata[unitNum].totalQuestions || 0;
            });
        } else {
            // Estimate totals from data (assume answered questions represent progress)
            // This is a fallback; actual metadata is preferred
            Object.keys(unitCounts).forEach(unitNum => {
                unitTotals[unitNum] = unitCounts[unitNum];
            });
        }

        // Calculate percentages
        const units = Object.keys(unitCounts).sort((a, b) => a - b);
        const labels = units.map(u => `Unit ${u}`);
        const percentages = units.map(u => {
            const total = unitTotals[u] || unitCounts[u];
            return total > 0 ? Math.round((unitCounts[u] / total) * 100) : 0;
        });

        const result = {
            labels: labels,
            datasets: [{
                label: 'Completion %',
                data: percentages,
                backgroundColor: this._generateProgressColors(percentages),
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1
            }],
            counts: unitCounts,
            totals: unitTotals
        };

        // Cache result
        this._cache.unitCompletion = result;
        this._cacheTimestamp = Date.now();

        return result;
    }

    /**
     * Time Series Data
     * Group progress by date for line chart
     *
     * @param {Array} progressData - Array of progress items
     * @param {String} aggregation - 'daily', 'weekly', 'monthly'
     * @returns {Object} Chart.js dataset for line chart
     */
    timeSeriesData(progressData, aggregation = 'daily') {
        if (!progressData || !Array.isArray(progressData) || progressData.length === 0) {
            return this._emptyDataset('No activity data available');
        }

        // Parse timestamps and group by date
        const dateCounts = {};

        progressData.forEach(item => {
            if (!item.timestamp) return;

            const date = new Date(item.timestamp);
            if (isNaN(date.getTime())) return; // Invalid date

            const dateKey = this._formatDateKey(date, aggregation);
            dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
        });

        // Sort dates
        const dates = Object.keys(dateCounts).sort();

        if (dates.length === 0) {
            return this._emptyDataset('No valid timestamps');
        }

        // Fill gaps for better visualization
        const filledDates = this._fillDateGaps(dates, aggregation);
        const values = filledDates.map(d => dateCounts[d] || 0);

        // Format labels
        const labels = filledDates.map(d => this._formatDateLabel(d, aggregation));

        return {
            labels: labels,
            datasets: [{
                label: 'Questions Answered',
                data: values,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5
            }],
            raw: {
                dates: filledDates,
                counts: dateCounts
            }
        };
    }

    /**
     * Success Rate Data
     * Calculate correct answer rates per unit (if answer correctness is tracked)
     *
     * @param {Array} progressData - Array of progress items
     * @param {Object} answerKey - Map of question_id to correct answer
     * @returns {Object} Chart.js dataset for stacked bar chart
     */
    successRateData(progressData, answerKey = null) {
        if (!progressData || !Array.isArray(progressData)) {
            return this._emptyDataset('No progress data available');
        }

        // Group by unit
        const unitStats = {};

        progressData.forEach(item => {
            const match = item.question_id?.match(/^U(\d+)-/);
            if (!match) return;

            const unitNum = parseInt(match[1]);
            if (!unitStats[unitNum]) {
                unitStats[unitNum] = {
                    total: 0,
                    correct: 0,
                    incorrect: 0,
                    firstTry: 0,
                    multipleAttempts: 0
                };
            }

            unitStats[unitNum].total++;

            // Track attempt count
            if (item.attempt === 1) {
                unitStats[unitNum].firstTry++;
            } else if (item.attempt > 1) {
                unitStats[unitNum].multipleAttempts++;
            }

            // If answer key provided, check correctness
            if (answerKey && answerKey[item.question_id]) {
                if (item.answer === answerKey[item.question_id]) {
                    unitStats[unitNum].correct++;
                } else {
                    unitStats[unitNum].incorrect++;
                }
            }
        });

        const units = Object.keys(unitStats).sort((a, b) => a - b);
        const labels = units.map(u => `Unit ${u}`);

        // If we have correctness data, show correct/incorrect
        if (answerKey) {
            const correctData = units.map(u => unitStats[u].correct);
            const incorrectData = units.map(u => unitStats[u].incorrect);

            return {
                labels: labels,
                datasets: [
                    {
                        label: 'Correct',
                        data: correctData,
                        backgroundColor: '#4CAF50',
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Incorrect',
                        data: incorrectData,
                        backgroundColor: '#f44336',
                        stack: 'Stack 0'
                    }
                ]
            };
        }

        // Otherwise show first try vs multiple attempts
        const firstTryData = units.map(u => unitStats[u].firstTry);
        const retryData = units.map(u => unitStats[u].multipleAttempts);

        return {
            labels: labels,
            datasets: [
                {
                    label: 'First Attempt',
                    data: firstTryData,
                    backgroundColor: '#2196F3',
                    stack: 'Stack 0'
                },
                {
                    label: 'Retries',
                    data: retryData,
                    backgroundColor: '#FF9800',
                    stack: 'Stack 0'
                }
            ],
            stats: unitStats
        };
    }

    /**
     * Learning Velocity Data
     * Calculate questions answered per day over time
     *
     * @param {Array} progressData - Array of progress items
     * @param {Number} windowDays - Moving average window in days
     * @returns {Object} Chart.js dataset for area chart
     */
    learningVelocityData(progressData, windowDays = 7) {
        if (!progressData || !Array.isArray(progressData) || progressData.length === 0) {
            return this._emptyDataset('No activity data available');
        }

        // Group by date
        const dailyCounts = {};

        progressData.forEach(item => {
            if (!item.timestamp) return;

            const date = new Date(item.timestamp);
            if (isNaN(date.getTime())) return;

            const dateKey = this._formatDateKey(date, 'daily');
            dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
        });

        const dates = Object.keys(dailyCounts).sort();

        if (dates.length === 0) {
            return this._emptyDataset('No valid timestamps');
        }

        // Fill gaps
        const filledDates = this._fillDateGaps(dates, 'daily');
        const values = filledDates.map(d => dailyCounts[d] || 0);

        // Calculate moving average
        const movingAvg = this._calculateMovingAverage(values, windowDays);

        // Format labels
        const labels = filledDates.map(d => this._formatDateLabel(d, 'daily'));

        return {
            labels: labels,
            datasets: [
                {
                    label: 'Daily Activity',
                    data: values,
                    borderColor: 'rgba(33, 150, 243, 0.5)',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 1,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: `${windowDays}-Day Average`,
                    data: movingAvg,
                    borderColor: '#FF9800',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }
            ],
            raw: {
                dates: filledDates,
                dailyCounts: dailyCounts,
                movingAverage: movingAvg
            }
        };
    }

    /**
     * Get statistics summary
     *
     * @param {Array} progressData - Array of progress items
     * @returns {Object} Summary statistics
     */
    getStatsSummary(progressData) {
        if (!progressData || !Array.isArray(progressData)) {
            return {
                totalQuestions: 0,
                totalAttempts: 0,
                uniqueQuestions: 0,
                avgAttemptsPerQuestion: 0,
                dateRange: null,
                unitsStarted: 0
            };
        }

        const uniqueQuestions = new Set();
        const units = new Set();
        let totalAttempts = 0;
        let minDate = null;
        let maxDate = null;

        progressData.forEach(item => {
            uniqueQuestions.add(item.question_id);
            totalAttempts += (item.attempt || 1);

            // Track units
            const match = item.question_id?.match(/^U(\d+)-/);
            if (match) {
                units.add(parseInt(match[1]));
            }

            // Track dates
            if (item.timestamp) {
                const date = new Date(item.timestamp);
                if (!isNaN(date.getTime())) {
                    if (!minDate || date < minDate) minDate = date;
                    if (!maxDate || date > maxDate) maxDate = date;
                }
            }
        });

        return {
            totalQuestions: progressData.length,
            totalAttempts: totalAttempts,
            uniqueQuestions: uniqueQuestions.size,
            avgAttemptsPerQuestion: uniqueQuestions.size > 0
                ? (totalAttempts / uniqueQuestions.size).toFixed(1)
                : 0,
            dateRange: minDate && maxDate ? {
                start: minDate.toISOString().split('T')[0],
                end: maxDate.toISOString().split('T')[0],
                days: Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1
            } : null,
            unitsStarted: units.size
        };
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Generate empty dataset for charts with no data
     */
    _emptyDataset(message = 'No data available') {
        return {
            labels: [],
            datasets: [],
            empty: true,
            message: message
        };
    }

    /**
     * Generate progress colors based on completion percentage
     */
    _generateProgressColors(percentages) {
        return percentages.map(p => {
            if (p >= 80) return '#4CAF50'; // Green
            if (p >= 50) return '#2196F3'; // Blue
            if (p >= 25) return '#FF9800'; // Orange
            return '#f44336'; // Red
        });
    }

    /**
     * Format date as key for grouping
     */
    _formatDateKey(date, aggregation) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        switch (aggregation) {
            case 'daily':
                return `${year}-${month}-${day}`;
            case 'weekly':
                // Get ISO week number
                const weekNum = this._getISOWeek(date);
                return `${year}-W${String(weekNum).padStart(2, '0')}`;
            case 'monthly':
                return `${year}-${month}`;
            default:
                return `${year}-${month}-${day}`;
        }
    }

    /**
     * Format date key as display label
     */
    _formatDateLabel(dateKey, aggregation) {
        switch (aggregation) {
            case 'daily':
                // Convert YYYY-MM-DD to M/D
                const [y, m, d] = dateKey.split('-');
                return `${parseInt(m)}/${parseInt(d)}`;
            case 'weekly':
                // Convert YYYY-Wnn to "Week nn"
                const week = dateKey.split('-W')[1];
                return `Week ${week}`;
            case 'monthly':
                // Convert YYYY-MM to "Mon YYYY"
                const [year, month] = dateKey.split('-');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${monthNames[parseInt(month) - 1]} ${year}`;
            default:
                return dateKey;
        }
    }

    /**
     * Fill gaps in date series for smooth charts
     */
    _fillDateGaps(dates, aggregation) {
        if (dates.length === 0) return [];
        if (dates.length === 1) return dates;

        const filled = [];
        const start = dates[0];
        const end = dates[dates.length - 1];

        let current = this._parseDate(start, aggregation);
        const endDate = this._parseDate(end, aggregation);

        while (current <= endDate) {
            const key = this._formatDateKey(current, aggregation);
            filled.push(key);

            // Increment based on aggregation
            switch (aggregation) {
                case 'daily':
                    current.setDate(current.getDate() + 1);
                    break;
                case 'weekly':
                    current.setDate(current.getDate() + 7);
                    break;
                case 'monthly':
                    current.setMonth(current.getMonth() + 1);
                    break;
            }
        }

        return filled;
    }

    /**
     * Parse date key back to Date object
     */
    _parseDate(dateKey, aggregation) {
        switch (aggregation) {
            case 'weekly':
                // Parse YYYY-Wnn format
                const [year, weekStr] = dateKey.split('-W');
                const week = parseInt(weekStr);
                return this._getDateFromWeek(parseInt(year), week);
            default:
                // Parse YYYY-MM-DD or YYYY-MM format
                return new Date(dateKey + (aggregation === 'monthly' ? '-01' : ''));
        }
    }

    /**
     * Get ISO week number
     */
    _getISOWeek(date) {
        const d = new Date(date.getTime());
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * Get date from ISO week number
     */
    _getDateFromWeek(year, week) {
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        return ISOweekStart;
    }

    /**
     * Calculate moving average
     */
    _calculateMovingAverage(data, windowSize) {
        if (data.length === 0) return [];

        const result = [];
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
            const window = data.slice(start, end);
            const avg = window.reduce((a, b) => a + b, 0) / window.length;
            result.push(Math.round(avg * 10) / 10);
        }
        return result;
    }
}

// Export for use in other modules
window.ProgressChartAdapter = ProgressChartAdapter;

console.log('[ProgressChartAdapter] Module loaded');
