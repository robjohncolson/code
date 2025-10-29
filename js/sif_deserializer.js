/**
 * SIF Deserializer Module
 * Safely parses and validates Chart Standard Internal Format (SIF) data
 * Supports all 14 chart types used in the AP Statistics app
 */

(function() {
    'use strict';

    // Valid chart types
    const VALID_CHART_TYPES = [
        'bar', 'line', 'scatter', 'bubble', 'radar', 'polarArea',
        'pie', 'doughnut', 'histogram', 'dotplot', 'boxplot',
        'normal', 'chisquare', 'numberline'
    ];

    /**
     * Safely parse a JSON string with error handling
     * @param {string} jsonString - The JSON string to parse
     * @returns {Object|null} - Parsed object or null if invalid
     */
    function safeParse(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') {
            return null;
        }

        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Failed to parse JSON:', error.message);
            return null;
        }
    }

    /**
     * Check if a value is a valid chart SIF object
     * @param {*} value - The value to check
     * @returns {boolean} - True if valid SIF
     */
    function isValidSIF(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }

        // Must have a valid chart type
        const chartType = value.type || value.chartType;
        if (!chartType || !VALID_CHART_TYPES.includes(chartType)) {
            return false;
        }

        // Basic structure validation
        return true;
    }

    /**
     * Validate chart-specific data structure
     * @param {Object} sif - The SIF object to validate
     * @returns {boolean} - True if valid for its type
     */
    function validateChartData(sif) {
        const type = sif.type || sif.chartType;

        switch (type) {
            case 'bar':
            case 'line':
                return Array.isArray(sif.series) && Array.isArray(sif.categories);

            case 'scatter':
            case 'bubble':
                return Array.isArray(sif.points);

            case 'radar':
                return Array.isArray(sif.categories) && Array.isArray(sif.datasets);

            case 'pie':
            case 'doughnut':
            case 'polarArea':
                return Array.isArray(sif.segments);

            case 'histogram':
                return sif.data && Array.isArray(sif.data.bins);

            case 'dotplot':
                return sif.data && Array.isArray(sif.data.values);

            case 'boxplot':
                return sif.data && sif.data.fiveNumber &&
                       typeof sif.data.fiveNumber.min === 'number' &&
                       typeof sif.data.fiveNumber.max === 'number';

            case 'normal':
                return sif.data &&
                       typeof sif.data.mean === 'number' &&
                       typeof sif.data.sd === 'number';

            case 'chisquare':
                return sif.data && Array.isArray(sif.data.dfList);

            case 'numberline':
                return sif.data && Array.isArray(sif.data.ticks);

            default:
                return false;
        }
    }

    /**
     * Normalize SIF object to ensure consistent structure
     * @param {Object} sif - The SIF object to normalize
     * @returns {Object} - Normalized SIF
     */
    function normalizeSIF(sif) {
        // Ensure 'type' property exists (some may use 'chartType')
        if (!sif.type && sif.chartType) {
            sif.type = sif.chartType;
        }

        // Ensure labels exist
        if (!sif.xLabel) sif.xLabel = '';
        if (!sif.yLabel) sif.yLabel = '';
        if (!sif.title) sif.title = '';

        // Add metadata if missing
        if (!sif.meta) {
            sif.meta = {
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }

        return sif;
    }

    /**
     * Deserialize an answer_value that might be a chart
     * @param {string|Object} answerValue - The answer value from database
     * @returns {Object} - { isChart: boolean, data: Object|string, error: string? }
     */
    function deserializeAnswer(answerValue) {
        // Handle null/undefined
        if (answerValue == null) {
            return { isChart: false, data: '', error: null };
        }

        // If already an object, check if it's a valid SIF
        if (typeof answerValue === 'object') {
            if (isValidSIF(answerValue)) {
                const normalized = normalizeSIF(answerValue);
                if (validateChartData(normalized)) {
                    return { isChart: true, data: normalized, error: null };
                } else {
                    return {
                        isChart: true,
                        data: normalized,
                        error: 'Invalid chart data structure'
                    };
                }
            }
            // Not a chart, return as string
            return { isChart: false, data: JSON.stringify(answerValue), error: null };
        }

        // If it's a string, try to parse it
        if (typeof answerValue === 'string') {
            // Check if it looks like JSON
            if (answerValue.startsWith('{') || answerValue.startsWith('[')) {
                const parsed = safeParse(answerValue);
                if (parsed && isValidSIF(parsed)) {
                    const normalized = normalizeSIF(parsed);
                    if (validateChartData(normalized)) {
                        return { isChart: true, data: normalized, error: null };
                    } else {
                        return {
                            isChart: true,
                            data: normalized,
                            error: 'Invalid chart data structure'
                        };
                    }
                }
            }
            // Not a chart, return as regular answer
            return { isChart: false, data: answerValue, error: null };
        }

        // Unknown type, convert to string
        return { isChart: false, data: String(answerValue), error: null };
    }

    /**
     * Batch deserialize multiple answers
     * @param {Array} answers - Array of answer objects with answer_value property
     * @returns {Array} - Array of deserialized answers
     */
    function deserializeAnswers(answers) {
        if (!Array.isArray(answers)) {
            return [];
        }

        return answers.map(answer => {
            const result = deserializeAnswer(answer.answer_value);
            return {
                ...answer,
                isChart: result.isChart,
                parsedData: result.data,
                parseError: result.error
            };
        });
    }

    /**
     * Serialize a SIF object for storage
     * @param {Object} sif - The SIF object to serialize
     * @returns {string} - JSON string
     */
    function serializeSIF(sif) {
        if (!sif || typeof sif !== 'object') {
            throw new Error('Invalid SIF object for serialization');
        }

        // Update metadata
        if (!sif.meta) {
            sif.meta = {};
        }
        sif.meta.updatedAt = Date.now();

        return JSON.stringify(sif);
    }

    /**
     * Get a human-readable chart type name
     * @param {string} type - The chart type
     * @returns {string} - Display name
     */
    function getChartDisplayName(type) {
        const names = {
            'bar': 'Bar Chart',
            'line': 'Line Chart',
            'scatter': 'Scatter Plot',
            'bubble': 'Bubble Chart',
            'radar': 'Radar Chart',
            'polarArea': 'Polar Area Chart',
            'pie': 'Pie Chart',
            'doughnut': 'Doughnut Chart',
            'histogram': 'Histogram',
            'dotplot': 'Dot Plot',
            'boxplot': 'Box Plot',
            'normal': 'Normal Distribution',
            'chisquare': 'Chi-Square Distribution',
            'numberline': 'Number Line'
        };
        return names[type] || type;
    }

    // Export to global scope
    window.sifDeserializer = {
        safeParse,
        isValidSIF,
        validateChartData,
        normalizeSIF,
        deserializeAnswer,
        deserializeAnswers,
        serializeSIF,
        getChartDisplayName,
        VALID_CHART_TYPES
    };

    console.log('✅ SIF Deserializer module loaded');

})();