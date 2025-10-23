(function() {
    const MODAL_ID = 'chart-wizard-modal';
    const OVERLAY_ID = 'chart-wizard-overlay';
    const CONTENT_ID = 'chart-wizard-content';
    const PREVIEW_PREFIX = 'chart-preview-canvas-';
    let wizardState = null;
    let stylesInjected = false;

    function getChartTypeList() {
        if (Array.isArray(window.CHART_TYPE_LIST) && window.CHART_TYPE_LIST.length > 0) {
            return window.CHART_TYPE_LIST;
        }
        return [
            { key: 'bar', displayName: 'Bar Chart', description: 'Compare categories using rectangular bars.', schema: { kind: 'categorical', axes: { x: {}, y: {} } }, defaults: { xLabel: 'Category', yLabel: 'Value', seriesName: 'Series 1', orientation: 'vertical' } },
            { key: 'line', displayName: 'Line Chart', description: 'Connect points to show change over categories.', schema: { kind: 'categorical-series', axes: { x: {}, y: {} } }, defaults: { xLabel: 'Category', yLabel: 'Value', seriesName: 'Series 1' } },
            { key: 'scatter', displayName: 'Scatter Plot', description: 'Display paired (x, y) data.', schema: { kind: 'xy', axes: { x: {}, y: {} } }, defaults: { xLabel: 'X Value', yLabel: 'Y Value' } },
            { key: 'bubble', displayName: 'Bubble Chart', description: 'Visualize relationships with bubble size.', schema: { kind: 'xyr', axes: { x: {}, y: {} } }, defaults: { xLabel: 'X Value', yLabel: 'Y Value' } },
            { key: 'radar', displayName: 'Radar Chart', description: 'Compare categories around a circular axis.', schema: { kind: 'categories-datasets', axes: { x: null, y: null } }, defaults: {} },
            { key: 'polarArea', displayName: 'Polar Area Chart', description: 'Show parts of a whole with equal angles.', schema: { kind: 'segments', axes: null }, defaults: {} },
            { key: 'pie', displayName: 'Pie Chart', description: 'Show categorical parts of a whole.', schema: { kind: 'segments', axes: null }, defaults: {} },
            { key: 'doughnut', displayName: 'Doughnut Chart', description: 'Show parts of a whole with a center cutout.', schema: { kind: 'segments', axes: null }, defaults: {} },
            { key: 'histogram', displayName: 'Histogram', description: 'Group numeric data into bins.', schema: { kind: 'bins', axes: { x: {}, y: {} } }, defaults: { xLabel: 'Interval', yLabel: 'Frequency' } },
            { key: 'dotplot', displayName: 'Dot Plot', description: 'Plot numeric values with stacked dots.', schema: { kind: 'numeric-list', axes: { x: {}, y: null } }, defaults: { xLabel: 'Value' } },
            { key: 'boxplot', displayName: 'Box Plot', description: 'Summarize distribution with five-number summary.', schema: { kind: 'five-number', axes: { x: null, y: {} } }, defaults: { yLabel: 'Value' } },
            { key: 'normal', displayName: 'Normal Curve', description: 'Plot a normal distribution.', schema: { kind: 'distribution', axes: { x: {}, y: null } }, defaults: { xLabel: 'Value' } },
            { key: 'chisquare', displayName: 'Chi-Square Curve', description: 'Overlay chi-square density curves.', schema: { kind: 'distribution-list', axes: { x: {}, y: {} } }, defaults: { xLabel: 'χ² Value', yLabel: 'Density' } },
            { key: 'numberline', displayName: 'Number Line', description: 'Render a labeled number line.', schema: { kind: 'numberline', axes: { x: {}, y: null } }, defaults: { xLabel: 'Value' } }
        ];
    }

    function getChartTypeConfig(typeKey) {
        if (window.CHART_TYPES && window.CHART_TYPES[typeKey]) {
            return window.CHART_TYPES[typeKey];
        }
        return getChartTypeList().find(type => type.key === typeKey);
    }

    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            .chart-wizard-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            .chart-wizard-modal {
                background: var(--modal-bg, #fff);
                color: var(--text-color, #333);
                width: min(720px, 94%);
                max-height: 90vh;
                overflow: hidden;
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
            }
            .chart-wizard-header {
                padding: 16px 20px;
                border-bottom: 1px solid rgba(0,0,0,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .chart-wizard-body {
                padding: 20px;
                overflow-y: auto;
            }
            .chart-wizard-footer {
                padding: 16px 20px;
                border-top: 1px solid rgba(0,0,0,0.1);
                display: flex;
                justify-content: space-between;
                gap: 12px;
            }
            .chart-wizard-title {
                font-size: 1.2rem;
                font-weight: 600;
            }
            .chart-wizard-close {
                background: none;
                border: none;
                font-size: 1.4rem;
                cursor: pointer;
            }
            .chart-type-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 12px;
            }
            .chart-type-option {
                border: 2px solid transparent;
                border-radius: 8px;
                padding: 12px;
                background: rgba(0,0,0,0.04);
                cursor: pointer;
                text-align: left;
                transition: transform 0.1s ease, border-color 0.1s ease;
            }
            .chart-type-option.active {
                border-color: #4b7bec;
                background: rgba(75, 123, 236, 0.1);
            }
            .chart-type-option:focus-visible {
                outline: 2px solid #4b7bec;
                outline-offset: 2px;
            }
            .chart-type-option h4 {
                margin: 0 0 6px;
                font-size: 1rem;
            }
            .chart-type-option p {
                margin: 0;
                font-size: 0.85rem;
                color: rgba(0,0,0,0.7);
            }
            .chart-form-group {
                margin-bottom: 16px;
            }
            .chart-form-group label {
                display: block;
                font-weight: 600;
                margin-bottom: 6px;
            }
            .chart-form-group input,
            .chart-form-group textarea {
                width: 100%;
                padding: 8px 10px;
                border-radius: 6px;
                border: 1px solid rgba(0,0,0,0.2);
                font-size: 0.95rem;
            }
            .chart-form-group textarea {
                min-height: 90px;
                resize: vertical;
            }
            .chart-data-table {
                width: 100%;
                border-collapse: collapse;
            }
            .chart-data-table th,
            .chart-data-table td {
                border: 1px solid rgba(0,0,0,0.1);
                padding: 6px;
                text-align: left;
            }
            .chart-data-table input {
                width: 100%;
                box-sizing: border-box;
            }
            .chart-data-actions {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }
            .chart-wizard-footer button {
                padding: 10px 16px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-weight: 600;
            }
            .chart-wizard-footer button.primary {
                background: #4b7bec;
                color: #fff;
            }
            .chart-wizard-footer button.secondary {
                background: rgba(0,0,0,0.08);
            }
            .chart-preview-container {
                margin-top: 16px;
                padding: 12px;
                border: 1px dashed rgba(0,0,0,0.2);
                border-radius: 10px;
                background: rgba(0,0,0,0.03);
            }
            .chart-preview-container.empty {
                text-align: center;
                color: rgba(0,0,0,0.6);
                font-size: 0.95rem;
            }
            .chart-preview-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .chart-preview-actions {
                display: flex;
                gap: 8px;
            }
            .chart-preview-actions button {
                padding: 6px 10px;
                font-size: 0.85rem;
                border-radius: 6px;
                border: none;
                cursor: pointer;
            }
            .chart-wizard-controls {
                margin-top: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .chart-wizard-button {
                align-self: flex-start;
                background: #4b7bec;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 8px 14px;
                cursor: pointer;
                font-weight: 600;
            }
            .chart-wizard-button:hover {
                background: #3867d6;
            }
            .chart-wizard-prompt {
                font-size: 0.9rem;
                color: rgba(0,0,0,0.7);
            }
            .chart-wizard-error {
                color: #d63031;
                background: rgba(214, 48, 49, 0.1);
                border: 1px solid rgba(214, 48, 49, 0.2);
                padding: 10px;
                border-radius: 8px;
                margin-bottom: 12px;
            }
            @media (prefers-color-scheme: dark) {
                .chart-wizard-modal {
                    background: #1f1f1f;
                    color: #f5f5f5;
                }
                .chart-wizard-controls .chart-wizard-prompt {
                    color: rgba(255,255,255,0.75);
                }
                .chart-preview-container {
                    border-color: rgba(255,255,255,0.2);
                    background: rgba(255,255,255,0.04);
                }
                .chart-type-option {
                    background: rgba(255,255,255,0.05);
                }
                .chart-type-option p {
                    color: rgba(255,255,255,0.7);
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureModal() {
        if (document.getElementById(OVERLAY_ID)) return;
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'chart-wizard-overlay';

        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'chart-wizard-modal';

        const content = document.createElement('div');
        content.id = CONTENT_ID;
        content.className = 'chart-wizard-body';

        modal.appendChild(content);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeWizard();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && overlay.style.display === 'flex') {
                closeWizard();
            }
        });
    }

    function getCurrentUserRecord() {
        const username = window.currentUsername || localStorage.getItem('consensusUsername') || '';
        if (!username) {
            return { username: '', user: null };
        }
        if (!window.classData) {
            window.classData = { users: {} };
        }
        if (!window.classData.users) {
            window.classData.users = {};
        }
        if (!window.classData.users[username]) {
            window.classData.users[username] = {
                answers: {},
                reasons: {},
                timestamps: {},
                attempts: {},
                charts: {},
                currentActivity: {
                    state: 'idle',
                    questionId: null,
                    lastUpdate: Date.now()
                }
            };
        }
        const user = window.classData.users[username];
        if (!user.answers) user.answers = {};
        if (!user.charts) user.charts = {};
        return { username, user };
    }

    function getStoredChartSIF(questionId) {
        const { username, user } = getCurrentUserRecord();
        if (!username || !user) return null;
        const answerEntry = user.answers?.[questionId];
        if (answerEntry && answerEntry.type === 'chart-response') {
            const value = answerEntry.value;
            if (value && typeof value === 'object') {
                return value;
            }
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch (error) {
                    console.warn('Unable to parse stored chart SIF string:', error);
                }
            }
        }
        if (user.charts && user.charts[questionId]) {
            return user.charts[questionId];
        }
        return null;
    }

    function setStoredChartSIF(questionId, sif) {
        const { username, user } = getCurrentUserRecord();
        if (!username || !user) return;
        const timestamp = new Date().toISOString();
        try {
            user.answers[questionId] = {
                value: sif,
                timestamp,
                type: 'chart-response'
            };
        } catch (error) {
            console.warn('Unable to set chart answer entry:', error);
        }
        if (!user.charts) {
            user.charts = {};
        }
        user.charts[questionId] = sif;
    }

    function deleteStoredChartSIF(questionId) {
        const { username, user } = getCurrentUserRecord();
        if (!username || !user) return;
        if (user.answers && user.answers[questionId]?.type === 'chart-response') {
            delete user.answers[questionId];
        }
        if (user.charts && user.charts[questionId]) {
            delete user.charts[questionId];
        }
    }

    function openChartWizard(questionId) {
        injectStyles();
        ensureModal();

        const metadata = window.CHART_QUESTIONS?.[questionId] || null;

        const username = window.currentUsername || localStorage.getItem('consensusUsername') || '';
        if (!username) {
            if (typeof window.showMessage === 'function') {
                window.showMessage('Please set your username before creating a chart.', 'error');
            } else {
                alert('Please set your username before creating a chart.');
            }
            return;
        }

        const existingChart = getStoredChartSIF(questionId);
        wizardState = createInitialState(questionId, metadata, existingChart);
        renderWizard();
        showOverlay();
    }

    function createInitialState(questionId, metadata, existingChart) {
        const availableTypes = getChartTypeList();
        const fallbackType = availableTypes[0]?.key || 'histogram';
        const hintedType = (metadata?.chartHints || []).find(hint => !!getChartTypeConfig(hint));
        const existingType = existingChart?.type && getChartTypeConfig(existingChart.type) ? existingChart.type : null;
        const initialType = existingType || hintedType || fallbackType;
        const defaults = getChartTypeConfig(initialType)?.defaults || {};

        const existingFirstSeries = Array.isArray(existingChart?.series) ? existingChart.series[0] : null;
        const histogramSeriesName = existingChart?.data?.seriesName || defaults.seriesName || 'Frequency';
        const baseSeriesName = existingFirstSeries?.name || existingChart?.data?.seriesName || defaults.seriesName || 'Series 1';
        const baseOrientation = existingChart?.orientation || existingChart?.data?.orientation || defaults.orientation || 'vertical';
        const baseXLabel = existingChart?.xLabel ?? existingChart?.options?.xLabel ?? defaults.xLabel ?? '';
        const baseYLabel = existingChart?.yLabel ?? existingChart?.options?.yLabel ?? defaults.yLabel ?? '';

        const baseState = {
            questionId,
            metadata,
            step: 0,
            chartType: initialType,
            histogram: [{ label: '', value: '' }],
            bar: [{ label: '', value: '' }],
            line: [{ label: '', value: '' }],
            pie: [{ label: '', value: '' }],
            doughnut: [{ label: '', value: '' }],
            polarArea: [{ label: '', value: '' }],
            dotplot: [''],
            scatter: [{ x: '', y: '', label: '' }],
            bubble: [{ x: '', y: '', r: '', label: '' }],
            boxplot: { min: '', q1: '', median: '', q3: '', max: '' },
            normal: { mean: '', sd: '', shadeLower: '', shadeUpper: '', xMin: '', xMax: '', tickInterval: '' },
            chisquareRows: [{ df: '', label: '' }],
            chisquareSettings: { xMin: '', xMax: '', tickInterval: '', numPoints: '' },
            numberline: [{ position: '', label: '', bottomLabel: '' }],
            numberlineRange: { min: '', max: '' },
            seriesName: histogramSeriesName,
            barSeriesName: baseSeriesName,
            lineSeriesName: existingFirstSeries?.name || defaults.seriesName || 'Series 1',
            barOrientation: baseOrientation,
            radarCategories: [''],
            radarDatasets: [{ name: 'Series 1', values: [''] }],
            xLabel: baseXLabel,
            yLabel: baseYLabel,
            title: existingChart?.options?.title || '',
            description: existingChart?.options?.description || '',
            csvText: '',
            originalMeta: existingChart?.meta || null,
            error: ''
        };

        if (existingChart) {
            applySifToState(baseState, existingChart);
        }

        const activeDefaults = getChartTypeConfig(baseState.chartType)?.defaults || {};
        if (!baseState.xLabel && activeDefaults.xLabel) {
            baseState.xLabel = activeDefaults.xLabel;
        }
        if (!baseState.yLabel && activeDefaults.yLabel) {
            baseState.yLabel = activeDefaults.yLabel;
        }

        return baseState;
    }

    function normalizeNumeric(value) {
        if (value === null || value === undefined || value === '') return '';
        return `${value}`;
    }

    function applySifToState(state, sif) {
        if (!state || !sif || typeof sif !== 'object') return;
        if (sif.type && getChartTypeConfig(sif.type)) {
            state.chartType = sif.type;
        }

        if (sif.xLabel && !state.xLabel) {
            state.xLabel = sif.xLabel;
        }
        if (sif.yLabel && !state.yLabel) {
            state.yLabel = sif.yLabel;
        }
        if (sif.title && !state.title) {
            state.title = sif.title;
        }
        if (sif.description && !state.description) {
            state.description = sif.description;
        }
        if (sif.meta) {
            state.originalMeta = sif.meta;
        }

        const type = sif.type;
        const legacyData = sif.data || {};

        switch (type) {
            case 'histogram': {
                const bins = Array.isArray(legacyData.bins) ? legacyData.bins : [];
                if (bins.length) {
                    state.histogram = bins.map(bin => ({
                        label: bin.label ?? '',
                        value: normalizeNumeric(bin.value)
                    }));
                }
                if (legacyData.seriesName) {
                    state.seriesName = legacyData.seriesName;
                }
                break;
            }
            case 'bar': {
                let rows = [];
                let orientation = sif.orientation || legacyData.orientation || state.barOrientation;
                let seriesName = state.barSeriesName;
                if (Array.isArray(sif.series) && sif.series.length > 0) {
                    const primary = sif.series[0];
                    if (primary && typeof primary === 'object') {
                        if (primary.name) {
                            seriesName = primary.name;
                        }
                        if (Array.isArray(primary.values)) {
                            if (primary.values.length && typeof primary.values[0] === 'object') {
                                rows = primary.values.map(entry => ({
                                    label: entry.label ?? '',
                                    value: normalizeNumeric(entry.value)
                                }));
                            } else {
                                const categories = Array.isArray(sif.categories) ? sif.categories : [];
                                rows = primary.values.map((value, index) => ({
                                    label: categories[index] ?? `Category ${index + 1}`,
                                    value: normalizeNumeric(value)
                                }));
                            }
                        }
                    }
                } else if (Array.isArray(legacyData.categories)) {
                    const categories = legacyData.categories;
                    const values = Array.isArray(legacyData.values) ? legacyData.values : [];
                    rows = categories.map((label, index) => ({
                        label: label ?? '',
                        value: normalizeNumeric(values[index] ?? '')
                    }));
                    if (legacyData.seriesName) {
                        seriesName = legacyData.seriesName;
                    }
                    if (legacyData.orientation) {
                        orientation = legacyData.orientation;
                    }
                }
                if (rows.length) {
                    state.bar = rows;
                }
                state.barSeriesName = seriesName || state.barSeriesName;
                state.barOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
                break;
            }
            case 'line': {
                let rows = [];
                let seriesName = state.lineSeriesName;
                if (Array.isArray(sif.series) && sif.series.length > 0) {
                    const primary = sif.series[0];
                    if (primary) {
                        if (primary.name) {
                            seriesName = primary.name;
                        }
                        if (Array.isArray(primary.values)) {
                            if (primary.values.length && typeof primary.values[0] === 'object') {
                                rows = primary.values.map(entry => ({
                                    label: entry.label ?? '',
                                    value: normalizeNumeric(entry.value)
                                }));
                            } else {
                                const categories = Array.isArray(sif.categories) ? sif.categories : [];
                                rows = primary.values.map((value, index) => ({
                                    label: categories[index] ?? `Category ${index + 1}`,
                                    value: normalizeNumeric(value)
                                }));
                            }
                        }
                    }
                }
                if (rows.length) {
                    state.line = rows;
                }
                state.lineSeriesName = seriesName || state.lineSeriesName;
                break;
            }
            case 'pie':
            case 'doughnut':
            case 'polarArea': {
                const segments = Array.isArray(sif.segments)
                    ? sif.segments
                    : Array.isArray(legacyData.slices)
                        ? legacyData.slices
                        : [];
                const mapped = segments.map(segment => ({
                    label: segment.label ?? '',
                    value: normalizeNumeric(segment.value)
                }));
                if (type === 'pie' && mapped.length) {
                    state.pie = mapped;
                } else if (type === 'doughnut' && mapped.length) {
                    state.doughnut = mapped;
                } else if (type === 'polarArea' && mapped.length) {
                    state.polarArea = mapped;
                }
                break;
            }
            case 'dotplot': {
                const values = Array.isArray(legacyData.values) ? legacyData.values : [];
                if (values.length) {
                    state.dotplot = values.map(value => normalizeNumeric(value));
                }
                break;
            }
            case 'scatter': {
                const points = Array.isArray(sif.points) ? sif.points : Array.isArray(legacyData.points) ? legacyData.points : [];
                if (points.length) {
                    state.scatter = points.map(point => ({
                        x: normalizeNumeric(point.x),
                        y: normalizeNumeric(point.y),
                        label: point.label ? `${point.label}` : ''
                    }));
                }
                break;
            }
            case 'bubble': {
                const points = Array.isArray(sif.points) ? sif.points : [];
                if (points.length) {
                    state.bubble = points.map(point => ({
                        x: normalizeNumeric(point.x),
                        y: normalizeNumeric(point.y),
                        r: normalizeNumeric(point.r),
                        label: point.label ? `${point.label}` : ''
                    }));
                }
                break;
            }
            case 'radar': {
                const categories = Array.isArray(sif.categories) ? sif.categories.map(label => `${label}`) : state.radarCategories;
                const datasets = Array.isArray(sif.datasets) ? sif.datasets : [];
                if (categories.length) {
                    state.radarCategories = categories;
                }
                if (datasets.length) {
                    state.radarDatasets = datasets.map(dataset => ({
                        name: dataset.name || 'Series',
                        values: Array.isArray(dataset.values)
                            ? dataset.values.map(value => normalizeNumeric(value))
                            : new Array(categories.length).fill('')
                    }));
                }
                break;
            }
            case 'boxplot': {
                const five = legacyData.fiveNumber || state.boxplot;
                state.boxplot = {
                    min: normalizeNumeric(five.min ?? five.minimum ?? ''),
                    q1: normalizeNumeric(five.q1 ?? five.Q1 ?? ''),
                    median: normalizeNumeric(five.median ?? ''),
                    q3: normalizeNumeric(five.q3 ?? five.Q3 ?? ''),
                    max: normalizeNumeric(five.max ?? five.maximum ?? '')
                };
                break;
            }
            case 'normal': {
                const data = legacyData || sif;
                state.normal = {
                    mean: normalizeNumeric(data.mean ?? ''),
                    sd: normalizeNumeric(data.sd ?? ''),
                    shadeLower: normalizeNumeric(data.shade?.lower ?? data.shadeLower ?? ''),
                    shadeUpper: normalizeNumeric(data.shade?.upper ?? data.shadeUpper ?? ''),
                    xMin: normalizeNumeric(data.xMin ?? ''),
                    xMax: normalizeNumeric(data.xMax ?? ''),
                    tickInterval: normalizeNumeric(data.tickInterval ?? '')
                };
                break;
            }
            case 'chisquare': {
                const dfList = Array.isArray(legacyData.dfList) ? legacyData.dfList : [];
                const labels = Array.isArray(legacyData.labels) ? legacyData.labels : [];
                if (dfList.length) {
                    state.chisquareRows = dfList.map((df, index) => ({
                        df: normalizeNumeric(df),
                        label: labels[index] ? `${labels[index]}` : ''
                    }));
                }
                state.chisquareSettings = {
                    xMin: normalizeNumeric(legacyData.xMin ?? ''),
                    xMax: normalizeNumeric(legacyData.xMax ?? ''),
                    tickInterval: normalizeNumeric(legacyData.tickInterval ?? ''),
                    numPoints: normalizeNumeric(legacyData.numPoints ?? '')
                };
                break;
            }
            case 'numberline': {
                const ticks = Array.isArray(legacyData.ticks) ? legacyData.ticks : [];
                if (ticks.length) {
                    state.numberline = ticks.map(tick => ({
                        position: normalizeNumeric(tick.x ?? tick.position ?? ''),
                        label: tick.label ? `${tick.label}` : '',
                        bottomLabel: tick.bottomLabel ? `${tick.bottomLabel}` : (tick.valueLabel ? `${tick.valueLabel}` : '')
                    }));
                }
                state.numberlineRange = {
                    min: normalizeNumeric(legacyData.xMin ?? ''),
                    max: normalizeNumeric(legacyData.xMax ?? '')
                };
                break;
            }
            default:
                break;
        }
    }

    function showOverlay() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    function closeWizard() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            overlay.style.display = 'none';
        }
        wizardState = null;
    }

    function renderWizard() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay || !wizardState) return;

        const modal = overlay.querySelector(`#${MODAL_ID}`);
        const header = document.createElement('div');
        header.className = 'chart-wizard-header';
        header.innerHTML = `
            <div class="chart-wizard-title">Chart Wizard · ${wizardState.questionId}</div>
            <button class="chart-wizard-close" aria-label="Close chart wizard">&times;</button>
        `;

        const body = document.createElement('div');
        body.className = 'chart-wizard-body';
        body.id = CONTENT_ID;
        body.innerHTML = getStepContent();

        const footer = document.createElement('div');
        footer.className = 'chart-wizard-footer';
        footer.innerHTML = getFooterContent();

        modal.innerHTML = '';
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);

        header.querySelector('button').addEventListener('click', closeWizard);
        attachEventHandlers(body, footer);

        if (wizardState.step === 2) {
            renderPreviewCanvas();
        }
    }

    function getStepContent() {
        if (!wizardState) return '';
        const { step, metadata, chartType, error } = wizardState;
        const prompt = metadata?.prompt ? `<p>${metadata.prompt}</p>` : '';

        const errorHtml = error ? `<div class="chart-wizard-error">${error}</div>` : '';

        if (step === 0) {
            const hints = metadata?.chartHints || [];
            const types = getChartTypeList();
            return `
                ${prompt}
                ${errorHtml}
                <div class="chart-type-grid">
                    ${types.map(typeInfo => {
                        const active = chartType === typeInfo.key ? 'active' : '';
                        const suggested = hints.includes(typeInfo.key)
                            ? '<span style="font-size:0.8rem;color:#3867d6;">Suggested</span>'
                            : '';
                        return `
                            <button type="button" class="chart-type-option ${active}" data-chart-type="${typeInfo.key}">
                                <h4>${typeInfo.displayName || typeInfo.key}</h4>
                                ${suggested}
                                <p>${typeInfo.description || ''}</p>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (step === 1) {
            return `
                ${prompt}
                ${errorHtml}
                ${getDataEntryContent(chartType)}
            `;
        }

        return `
            ${prompt}
            ${errorHtml}
            ${getPreviewContent()}
        `;
    }

    function getFooterContent() {
        if (!wizardState) return '';
        const { step } = wizardState;
        const prevDisabled = step === 0 ? 'disabled' : '';
        const nextLabel = step === 2 ? 'Save Chart' : 'Next';
        const nextClass = step === 2 ? 'primary' : 'primary';
        return `
            <div>
                <button type="button" class="secondary" data-action="back" ${prevDisabled}>Back</button>
            </div>
            <div>
                ${step === 2 && wizardState.metadata?.required ? '<span style="font-size:0.85rem;color:#3867d6;margin-right:8px;">Chart required for scoring</span>' : ''}
                ${wizardState.step === 2 && hasExistingChart() ? '<button type="button" class="secondary" data-action="delete">Delete</button>' : ''}
                <button type="button" class="${nextClass}" data-action="next">${nextLabel}</button>
            </div>
        `;
    }

    function hasExistingChart() {
        if (!wizardState) return false;
        return !!getStoredChartSIF(wizardState.questionId);
    }

    function attachEventHandlers(body, footer) {
        if (!wizardState) return;

        if (wizardState.step === 0) {
            body.querySelectorAll('[data-chart-type]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const selectedType = btn.getAttribute('data-chart-type');
                    wizardState.chartType = selectedType;
                    const typeConfig = getChartTypeConfig(selectedType) || {};
                    const defaults = typeConfig.defaults || {};
                    if (!wizardState.xLabel && defaults.xLabel) {
                        wizardState.xLabel = defaults.xLabel;
                    }
                    if (!wizardState.yLabel && defaults.yLabel) {
                        wizardState.yLabel = defaults.yLabel;
                    }
                    if (selectedType === 'bar') {
                        if (!wizardState.barSeriesName) {
                            wizardState.barSeriesName = defaults.seriesName || 'Series 1';
                        }
                        if (!wizardState.barOrientation) {
                            wizardState.barOrientation = defaults.orientation || 'vertical';
                        }
                    }
                    if (selectedType === 'histogram' && !wizardState.seriesName) {
                        wizardState.seriesName = defaults.seriesName || 'Frequency';
                    }
                    wizardState.error = '';
                    renderWizard();
                });
            });
        }

        if (wizardState.step === 1) {
            attachDataEntryHandlers(body);
        }

        footer.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                handleFooterAction(action);
            });
        });

        body.querySelectorAll('[data-action="edit-data"]').forEach(btn => {
            btn.addEventListener('click', () => {
                handleEditDataAction();
            });
        });
    }

    function attachDataEntryHandlers(body) {
        const csvTextarea = body.querySelector('[data-chart-csv]');
        if (csvTextarea) {
            csvTextarea.addEventListener('input', (event) => {
                wizardState.csvText = event.target.value;
            });
        }

        body.querySelectorAll('[data-chart-input]').forEach(input => {
            input.addEventListener('input', (event) => {
                const target = event.target;
                const field = target.getAttribute('data-chart-input');
                const group = target.getAttribute('data-group') || wizardState.chartType;
                const indexRaw = target.getAttribute('data-index');
                const index = indexRaw !== null ? parseInt(indexRaw, 10) : NaN;

                if (group === 'histogram') {
                    if (!isNaN(index)) {
                        if (field === 'label') {
                            wizardState.histogram[index].label = target.value;
                        } else if (field === 'value') {
                            wizardState.histogram[index].value = target.value;
                        }
                    }
                } else if (group === 'bar') {
                    if (!isNaN(index)) {
                        wizardState.bar[index][field] = target.value;
                    }
                } else if (group === 'line') {
                    if (!isNaN(index)) {
                        wizardState.line[index][field] = target.value;
                    }
                } else if (group === 'pie') {
                    if (!isNaN(index)) {
                        wizardState.pie[index][field] = target.value;
                    }
                } else if (group === 'doughnut') {
                    if (!isNaN(index)) {
                        wizardState.doughnut[index][field] = target.value;
                    }
                } else if (group === 'polarArea') {
                    if (!isNaN(index)) {
                        wizardState.polarArea[index][field] = target.value;
                    }
                } else if (group === 'dotplot') {
                    if (!isNaN(index)) {
                        wizardState.dotplot[index] = target.value;
                    }
                } else if (group === 'scatter') {
                    if (!isNaN(index)) {
                        wizardState.scatter[index][field] = target.value;
                    }
                } else if (group === 'bubble') {
                    if (!isNaN(index)) {
                        wizardState.bubble[index][field] = target.value;
                    }
                } else if (group === 'boxplot') {
                    wizardState.boxplot[field] = target.value;
                } else if (group === 'normal') {
                    wizardState.normal[field] = target.value;
                } else if (group === 'chisquare') {
                    if (!isNaN(index)) {
                        wizardState.chisquareRows[index][field] = target.value;
                    }
                } else if (group === 'chisquare-settings') {
                    wizardState.chisquareSettings[field] = target.value;
                } else if (group === 'numberline') {
                    if (!isNaN(index)) {
                        wizardState.numberline[index][field] = target.value;
                    }
                } else if (group === 'numberline-range') {
                    wizardState.numberlineRange[field] = target.value;
                } else if (group === 'radar-category') {
                    if (!isNaN(index)) {
                        wizardState.radarCategories[index] = target.value;
                    }
                } else if (group === 'radar-value') {
                    const datasetIndex = parseInt(target.getAttribute('data-dataset-index'), 10);
                    if (!isNaN(index) && !isNaN(datasetIndex) && wizardState.radarDatasets[datasetIndex]) {
                        if (!Array.isArray(wizardState.radarDatasets[datasetIndex].values)) {
                            wizardState.radarDatasets[datasetIndex].values = [];
                        }
                        wizardState.radarDatasets[datasetIndex].values[index] = target.value;
                    }
                } else if (group === 'radar-dataset') {
                    if (field === 'name') {
                        const datasetIndex = !isNaN(index) ? index : parseInt(target.getAttribute('data-index'), 10);
                        if (!isNaN(datasetIndex) && wizardState.radarDatasets[datasetIndex]) {
                            wizardState.radarDatasets[datasetIndex].name = target.value;
                        }
                    }
                }
            });
        });

        body.querySelectorAll('[data-action="add-row"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.getAttribute('data-group') || wizardState.chartType;
                if (group === 'histogram') {
                    wizardState.histogram.push({ label: '', value: '' });
                } else if (group === 'bar') {
                    wizardState.bar.push({ label: '', value: '' });
                } else if (group === 'line') {
                    wizardState.line.push({ label: '', value: '' });
                } else if (group === 'pie') {
                    wizardState.pie.push({ label: '', value: '' });
                } else if (group === 'doughnut') {
                    wizardState.doughnut.push({ label: '', value: '' });
                } else if (group === 'polarArea') {
                    wizardState.polarArea.push({ label: '', value: '' });
                } else if (group === 'dotplot') {
                    wizardState.dotplot.push('');
                } else if (group === 'scatter') {
                    wizardState.scatter.push({ x: '', y: '', label: '' });
                } else if (group === 'bubble') {
                    wizardState.bubble.push({ x: '', y: '', r: '', label: '' });
                } else if (group === 'chisquare') {
                    wizardState.chisquareRows.push({ df: '', label: '' });
                } else if (group === 'numberline') {
                    wizardState.numberline.push({ position: '', label: '', bottomLabel: '' });
                } else if (group === 'radar-category') {
                    wizardState.radarCategories.push('');
                    wizardState.radarDatasets.forEach(dataset => {
                        if (!Array.isArray(dataset.values)) {
                            dataset.values = [];
                        }
                        dataset.values.push('');
                    });
                }
                renderWizard();
            });
        });

        body.querySelectorAll('[data-action="remove-row"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.getAttribute('data-group') || wizardState.chartType;
                const index = parseInt(btn.getAttribute('data-index'), 10);
                if (group === 'histogram' && wizardState.histogram.length > 1) {
                    wizardState.histogram.splice(index, 1);
                } else if (group === 'bar' && wizardState.bar.length > 1) {
                    wizardState.bar.splice(index, 1);
                } else if (group === 'line' && wizardState.line.length > 1) {
                    wizardState.line.splice(index, 1);
                } else if (group === 'pie' && wizardState.pie.length > 1) {
                    wizardState.pie.splice(index, 1);
                } else if (group === 'doughnut' && wizardState.doughnut.length > 1) {
                    wizardState.doughnut.splice(index, 1);
                } else if (group === 'polarArea' && wizardState.polarArea.length > 1) {
                    wizardState.polarArea.splice(index, 1);
                } else if (group === 'dotplot' && wizardState.dotplot.length > 1) {
                    wizardState.dotplot.splice(index, 1);
                } else if (group === 'scatter' && wizardState.scatter.length > 1) {
                    wizardState.scatter.splice(index, 1);
                } else if (group === 'bubble' && wizardState.bubble.length > 1) {
                    wizardState.bubble.splice(index, 1);
                } else if (group === 'chisquare' && wizardState.chisquareRows.length > 1) {
                    wizardState.chisquareRows.splice(index, 1);
                } else if (group === 'numberline' && wizardState.numberline.length > 1) {
                    wizardState.numberline.splice(index, 1);
                } else if (group === 'radar-category' && wizardState.radarCategories.length > 1) {
                    wizardState.radarCategories.splice(index, 1);
                    wizardState.radarDatasets.forEach(dataset => {
                        if (Array.isArray(dataset.values)) {
                            dataset.values.splice(index, 1);
                        }
                    });
                }
                renderWizard();
            });
        });

        body.querySelectorAll('[data-action="add-dataset"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const values = wizardState.radarCategories.map(() => '');
                const nextIndex = wizardState.radarDatasets.length + 1;
                wizardState.radarDatasets.push({ name: `Series ${nextIndex}`, values });
                renderWizard();
            });
        });

        body.querySelectorAll('[data-action="remove-dataset"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'), 10);
                if (!isNaN(index) && wizardState.radarDatasets.length > 1) {
                    wizardState.radarDatasets.splice(index, 1);
                    renderWizard();
                }
            });
        });

        body.querySelectorAll('[data-action="parse-csv"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.getAttribute('data-group') || wizardState.chartType;
                parseCSVData(group);
            });
        });

        const xInput = body.querySelector('input[data-role="xLabel"]');
        if (xInput) {
            xInput.addEventListener('input', (event) => {
                wizardState.xLabel = event.target.value;
            });
        }
        const yInput = body.querySelector('input[data-role="yLabel"]');
        if (yInput) {
            yInput.addEventListener('input', (event) => {
                wizardState.yLabel = event.target.value;
            });
        }
        const titleInput = body.querySelector('input[data-role="title"]');
        if (titleInput) {
            titleInput.addEventListener('input', (event) => {
                wizardState.title = event.target.value;
            });
        }
        const descInput = body.querySelector('textarea[data-role="description"]');
        if (descInput) {
            descInput.addEventListener('input', (event) => {
                wizardState.description = event.target.value;
            });
        }
        const seriesInput = body.querySelector('input[data-role="seriesName"]');
        if (seriesInput) {
            seriesInput.addEventListener('input', (event) => {
                wizardState.seriesName = event.target.value;
            });
        }
        const barSeriesInput = body.querySelector('input[data-role="barSeriesName"]');
        if (barSeriesInput) {
            barSeriesInput.addEventListener('input', (event) => {
                wizardState.barSeriesName = event.target.value;
            });
        }
        const lineSeriesInput = body.querySelector('input[data-role="lineSeriesName"]');
        if (lineSeriesInput) {
            lineSeriesInput.addEventListener('input', (event) => {
                wizardState.lineSeriesName = event.target.value;
            });
        }
        const barOrientationSelect = body.querySelector('select[data-role="barOrientation"]');
        if (barOrientationSelect) {
            barOrientationSelect.addEventListener('change', (event) => {
                wizardState.barOrientation = event.target.value || 'vertical';
            });
        }
    }

    function parseCSVData(groupOverride) {
        if (!wizardState?.csvText) {
            wizardState.error = 'Paste CSV data before parsing.';
            renderWizard();
            return;
        }

        const rows = wizardState.csvText.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
        if (rows.length === 0) {
            wizardState.error = 'No rows detected in CSV input.';
            renderWizard();
            return;
        }

        try {
            const targetType = groupOverride || wizardState.chartType;
            if (targetType === 'histogram') {
                const parsedBins = rows.map(row => {
                    const [label, value] = row.split(/,|\t/);
                    return { label: (label || '').trim(), value: value !== undefined ? value.trim() : '' };
                }).filter(bin => bin.label);
                if (parsedBins.length === 0) {
                    throw new Error('Each row should include a label and value separated by a comma.');
                }
                wizardState.histogram = parsedBins;
            } else if (targetType === 'bar' || targetType === 'line') {
                const parsedRows = rows.map(row => {
                    const [label, value] = row.split(/,|\t/);
                    return { label: (label || '').trim(), value: value !== undefined ? value.trim() : '' };
                }).filter(item => item.label);
                if (parsedRows.length === 0) {
                    throw new Error('Each row should include a category and value separated by a comma.');
                }
                if (targetType === 'bar') {
                    wizardState.bar = parsedRows;
                } else {
                    wizardState.line = parsedRows;
                }
            } else if (targetType === 'pie' || targetType === 'doughnut' || targetType === 'polarArea') {
                const parsedRows = rows.map(row => {
                    const [label, value] = row.split(/,|\t/);
                    return { label: (label || '').trim(), value: value !== undefined ? value.trim() : '' };
                }).filter(item => item.label);
                if (parsedRows.length === 0) {
                    throw new Error('Each row should include a segment label and value separated by a comma.');
                }
                if (targetType === 'pie') {
                    wizardState.pie = parsedRows;
                } else if (targetType === 'doughnut') {
                    wizardState.doughnut = parsedRows;
                } else {
                    wizardState.polarArea = parsedRows;
                }
            } else if (targetType === 'dotplot') {
                const values = rows.flatMap(row => row.split(/,|\s+/).map(v => v.trim()).filter(Boolean));
                if (values.length === 0) {
                    throw new Error('Provide numeric values separated by commas or spaces.');
                }
                wizardState.dotplot = values;
            } else if (targetType === 'scatter') {
                const points = rows.map(row => {
                    const [x, y, label] = row.split(/,|\t/);
                    return {
                        x: x !== undefined ? x.trim() : '',
                        y: y !== undefined ? y.trim() : '',
                        label: label !== undefined ? label.trim() : ''
                    };
                }).filter(point => point.x !== '' && point.y !== '');
                if (points.length === 0) {
                    throw new Error('Each row should include x and y values separated by a comma.');
                }
                wizardState.scatter = points;
            } else if (targetType === 'bubble') {
                const points = rows.map(row => {
                    const parts = row.split(/,|\t/).map(part => part.trim());
                    const [x, y, r, label] = parts;
                    return {
                        x: x || '',
                        y: y || '',
                        r: r || '',
                        label: label || ''
                    };
                }).filter(point => point.x !== '' && point.y !== '' && point.r !== '');
                if (points.length === 0) {
                    throw new Error('Each row should include x, y, and radius values separated by commas.');
                }
                wizardState.bubble = points;
            } else {
                throw new Error('CSV parsing is not supported for this chart type.');
            }
            wizardState.error = '';
        } catch (error) {
            wizardState.error = error.message;
        }
        renderWizard();
    }

    function handleFooterAction(action) {
        if (!wizardState) return;

        if (action === 'back') {
            wizardState.error = '';
            if (wizardState.step > 0) {
                wizardState.step -= 1;
                renderWizard();
            }
            return;
        }

        if (action === 'delete') {
            confirmAndDelete();
            return;
        }

        if (action === 'next') {
            if (wizardState.step < 2) {
                if (wizardState.step === 0 && !wizardState.chartType) {
                    wizardState.error = 'Select a chart type to continue.';
                    renderWizard();
                    return;
                }
                if (wizardState.step === 1) {
                    const valid = validateCurrentData();
                    if (!valid) {
                        renderWizard();
                        return;
                    }
                }
                wizardState.step += 1;
                wizardState.error = '';
                renderWizard();
            } else {
                saveChart();
            }
        }
    }

    function handleEditDataAction() {
        if (!wizardState) return;
        wizardState.step = 1;
        wizardState.error = '';
        renderWizard();
    }

    function validateCurrentData() {
        if (!wizardState) return false;
        const type = wizardState.chartType;

        if (type === 'bar' || type === 'line') {
            const rows = (type === 'bar' ? wizardState.bar : wizardState.line).filter(row => row.label && row.value !== '');
            if (rows.length === 0) {
                wizardState.error = 'Add at least one category with a value.';
                return false;
            }
            const invalid = rows.find(row => isNaN(parseFloat(row.value)));
            if (invalid) {
                wizardState.error = `Value for "${invalid.label}" must be numeric.`;
                return false;
            }
        } else if (type === 'pie' || type === 'doughnut' || type === 'polarArea') {
            const rowsSource = type === 'pie' ? wizardState.pie : (type === 'doughnut' ? wizardState.doughnut : wizardState.polarArea);
            const rows = rowsSource.filter(row => row.label && row.value !== '');
            if (rows.length === 0) {
                wizardState.error = 'Add at least one segment with a value.';
                return false;
            }
            const invalid = rows.find(row => isNaN(parseFloat(row.value)));
            if (invalid) {
                wizardState.error = `Value for "${invalid.label}" must be numeric.`;
                return false;
            }
        } else if (type === 'histogram') {
            const bins = wizardState.histogram.filter(bin => bin.label && bin.value !== '');
            if (bins.length === 0) {
                wizardState.error = 'Add at least one bin with a label and value.';
                return false;
            }
            const invalid = bins.find(bin => isNaN(parseFloat(bin.value)));
            if (invalid) {
                wizardState.error = `Value for "${invalid.label}" must be numeric.`;
                return false;
            }
        } else if (type === 'dotplot') {
            const values = wizardState.dotplot.filter(v => v !== '');
            if (values.length === 0) {
                wizardState.error = 'Add at least one numeric value.';
                return false;
            }
            if (values.some(v => isNaN(parseFloat(v)))) {
                wizardState.error = 'Dotplot values must be numeric.';
                return false;
            }
        } else if (type === 'scatter') {
            const points = wizardState.scatter.filter(pt => pt.x !== '' && pt.y !== '');
            if (points.length === 0) {
                wizardState.error = 'Add at least one (x, y) pair.';
                return false;
            }
            if (points.some(pt => isNaN(parseFloat(pt.x)) || isNaN(parseFloat(pt.y)))) {
                wizardState.error = 'Scatterplot coordinates must be numeric.';
                return false;
            }
        } else if (type === 'bubble') {
            const points = wizardState.bubble.filter(pt => pt.x !== '' && pt.y !== '' && pt.r !== '');
            if (points.length === 0) {
                wizardState.error = 'Add at least one bubble with x, y, and radius.';
                return false;
            }
            if (points.some(pt => isNaN(parseFloat(pt.x)) || isNaN(parseFloat(pt.y)) || isNaN(parseFloat(pt.r)))) {
                wizardState.error = 'Bubble chart values must be numeric.';
                return false;
            }
        } else if (type === 'boxplot') {
            const { min, q1, median, q3, max } = wizardState.boxplot;
            const values = [min, q1, median, q3, max].map(v => parseFloat(v));
            if (values.some(v => isNaN(v))) {
                wizardState.error = 'Enter numeric values for the five-number summary.';
                return false;
            }
        } else if (type === 'radar') {
            const categories = (wizardState.radarCategories || []).map(cat => cat.trim()).filter(Boolean);
            if (categories.length === 0) {
                wizardState.error = 'Add at least one category for the radar chart.';
                return false;
            }
            if (!Array.isArray(wizardState.radarDatasets) || wizardState.radarDatasets.length === 0) {
                wizardState.error = 'Add at least one dataset for the radar chart.';
                return false;
            }
            for (const dataset of wizardState.radarDatasets) {
                const values = (dataset.values || []).slice(0, categories.length);
                if (values.length !== categories.length || values.some(v => v === '')) {
                    wizardState.error = `Provide values for every category in ${dataset.name || 'each dataset'}.`;
                    return false;
                }
                if (values.some(v => isNaN(parseFloat(v)))) {
                    wizardState.error = 'Radar chart values must be numeric.';
                    return false;
                }
            }
        } else if (type === 'normal') {
            const { mean, sd, xMin, xMax, tickInterval, shadeLower, shadeUpper } = wizardState.normal;
            const meanValue = parseFloat(mean);
            const sdValue = parseFloat(sd);
            if (isNaN(meanValue)) {
                wizardState.error = 'Provide a numeric mean for the normal curve.';
                return false;
            }
            if (isNaN(sdValue) || sdValue <= 0) {
                wizardState.error = 'Standard deviation must be a positive number.';
                return false;
            }
            const optionalNumbers = [
                { value: xMin, label: 'X min' },
                { value: xMax, label: 'X max' },
                { value: tickInterval, label: 'Tick interval' },
                { value: shadeLower, label: 'Shade lower bound' },
                { value: shadeUpper, label: 'Shade upper bound' }
            ];
            for (const opt of optionalNumbers) {
                if (opt.value !== '' && isNaN(parseFloat(opt.value))) {
                    wizardState.error = `${opt.label} must be numeric if provided.`;
                    return false;
                }
            }
            if (xMin !== '' && xMax !== '' && parseFloat(xMin) >= parseFloat(xMax)) {
                wizardState.error = 'Ensure X min is less than X max.';
                return false;
            }
        } else if (type === 'chisquare') {
            const rows = wizardState.chisquareRows.filter(row => row.df !== '');
            if (rows.length === 0) {
                wizardState.error = 'Add at least one degrees-of-freedom value.';
                return false;
            }
            const invalid = rows.find(row => {
                const df = parseFloat(row.df);
                return isNaN(df) || df <= 0;
            });
            if (invalid) {
                wizardState.error = 'Degrees of freedom must be positive numbers.';
                return false;
            }
            const { xMin, xMax, tickInterval, numPoints } = wizardState.chisquareSettings;
            const optional = [
                { value: xMin, label: 'X min' },
                { value: xMax, label: 'X max' },
                { value: tickInterval, label: 'Tick interval' },
                { value: numPoints, label: 'Points per curve', validator: val => parseInt(val, 10) > 10 }
            ];
            for (const opt of optional) {
                if (opt.value !== '') {
                    if (isNaN(parseFloat(opt.value))) {
                        wizardState.error = `${opt.label} must be numeric.`;
                        return false;
                    }
                    if (opt.label === 'Points per curve') {
                        const parsed = parseInt(opt.value, 10);
                        if (!(parsed > 10)) {
                            wizardState.error = 'Points per curve must be greater than 10.';
                            return false;
                        }
                    }
                }
            }
            if (xMin !== '' && xMax !== '' && parseFloat(xMin) >= parseFloat(xMax)) {
                wizardState.error = 'Ensure X min is less than X max.';
                return false;
            }
        } else if (type === 'numberline') {
            const ticks = wizardState.numberline.filter(tick => tick.position !== '');
            if (ticks.length === 0) {
                wizardState.error = 'Add at least one tick position for the number line.';
                return false;
            }
            const invalid = ticks.find(tick => isNaN(parseFloat(tick.position)));
            if (invalid) {
                wizardState.error = 'Tick positions must be numeric.';
                return false;
            }
            const { min, max } = wizardState.numberlineRange;
            if (min !== '' && isNaN(parseFloat(min))) {
                wizardState.error = 'Number line minimum must be numeric.';
                return false;
            }
            if (max !== '' && isNaN(parseFloat(max))) {
                wizardState.error = 'Number line maximum must be numeric.';
                return false;
            }
            if (min !== '' && max !== '' && parseFloat(min) >= parseFloat(max)) {
                wizardState.error = 'Ensure minimum is less than maximum for the number line.';
                return false;
            }
        }

        wizardState.error = '';
        return true;
    }

    function getDataEntryContent(chartType) {
        const typeConfig = getChartTypeConfig(chartType) || {};
        const axes = typeConfig.schema?.axes;
        const axisParts = [];

        if (axes !== null) {
            const showXAxis = axes === undefined || axes.x !== null;
            const showYAxis = axes === undefined || axes.y !== null;
            if (showXAxis) {
                const placeholder = axes?.x?.label || 'X-axis label';
                axisParts.push(`
                    <div class="chart-form-group">
                        <label>${placeholder}</label>
                        <input type="text" data-role="xLabel" value="${wizardState.xLabel || ''}" placeholder="${placeholder}">
                    </div>
                `);
            }
            if (showYAxis) {
                const placeholder = axes?.y?.label || 'Y-axis label';
                axisParts.push(`
                    <div class="chart-form-group">
                        <label>${placeholder}</label>
                        <input type="text" data-role="yLabel" value="${wizardState.yLabel || ''}" placeholder="${placeholder}">
                    </div>
                `);
            }
        }

        const axisSection = `
            ${axisParts.join('')}
            <div class="chart-form-group">
                <label>Chart title (optional)</label>
                <input type="text" data-role="title" value="${wizardState.title || ''}">
            </div>
            <div class="chart-form-group">
                <label>Description / notes (optional)</label>
                <textarea data-role="description" placeholder="Add context for reviewers...">${wizardState.description || ''}</textarea>
            </div>
        `;

        if (chartType === 'histogram') {
            const rows = wizardState.histogram.map((bin, index) => `
                <tr>
                    <td><input data-chart-input="label" data-group="histogram" data-index="${index}" value="${bin.label || ''}" placeholder="Interval"></td>
                    <td><input data-chart-input="value" data-group="histogram" data-index="${index}" value="${bin.value || ''}" placeholder="Frequency"></td>
                    <td><button type="button" data-action="remove-row" data-group="histogram" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            const defaultSeries = typeConfig.defaults?.seriesName || 'Frequency';
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Series name</label>
                    <input type="text" data-role="seriesName" value="${wizardState.seriesName || ''}" placeholder="${defaultSeries}">
                </div>
                <div class="chart-form-group">
                    <label>Histogram bins</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Label</th><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="histogram">Add bin</button>
                        <button type="button" data-action="parse-csv" data-group="histogram">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'label,value'} rows">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'bar') {
            const rows = wizardState.bar.map((row, index) => `
                <tr>
                    <td><input data-chart-input="label" data-group="bar" data-index="${index}" value="${row.label || ''}" placeholder="Category"></td>
                    <td><input data-chart-input="value" data-group="bar" data-index="${index}" value="${row.value || ''}" placeholder="Value"></td>
                    <td><button type="button" data-action="remove-row" data-group="bar" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            const defaultSeries = typeConfig.defaults?.seriesName || 'Series 1';
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Series name</label>
                    <input type="text" data-role="barSeriesName" value="${wizardState.barSeriesName || ''}" placeholder="${defaultSeries}">
                </div>
                <div class="chart-form-group">
                    <label>Orientation</label>
                    <select data-role="barOrientation">
                        <option value="vertical" ${wizardState.barOrientation === 'horizontal' ? '' : 'selected'}>Vertical (default)</option>
                        <option value="horizontal" ${wizardState.barOrientation === 'horizontal' ? 'selected' : ''}>Horizontal</option>
                    </select>
                </div>
                <div class="chart-form-group">
                    <label>Bar categories</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Category</th><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="bar">Add category</button>
                        <button type="button" data-action="parse-csv" data-group="bar">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'category,value'} rows">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'line') {
            const rows = wizardState.line.map((row, index) => `
                <tr>
                    <td><input data-chart-input="label" data-group="line" data-index="${index}" value="${row.label || ''}" placeholder="Category"></td>
                    <td><input data-chart-input="value" data-group="line" data-index="${index}" value="${row.value || ''}" placeholder="Value"></td>
                    <td><button type="button" data-action="remove-row" data-group="line" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            const defaultSeries = typeConfig.defaults?.seriesName || 'Series 1';
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Series name</label>
                    <input type="text" data-role="lineSeriesName" value="${wizardState.lineSeriesName || ''}" placeholder="${defaultSeries}">
                </div>
                <div class="chart-form-group">
                    <label>Line data</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Category</th><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="line">Add point</button>
                        <button type="button" data-action="parse-csv" data-group="line">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'category,value'} rows">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'pie') {
            const rows = wizardState.pie.map((slice, index) => `
                <tr>
                    <td><input data-chart-input="label" data-group="pie" data-index="${index}" value="${slice.label || ''}" placeholder="Slice label"></td>
                    <td><input data-chart-input="value" data-group="pie" data-index="${index}" value="${slice.value || ''}" placeholder="Value"></td>
                    <td><button type="button" data-action="remove-row" data-group="pie" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Pie slices</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Label</th><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="pie">Add slice</button>
                        <button type="button" data-action="parse-csv" data-group="pie">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'label,value'} rows">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'doughnut') {
            const rows = wizardState.doughnut.map((segment, index) => `
                <tr>
                    <td><input data-chart-input="label" data-group="doughnut" data-index="${index}" value="${segment.label || ''}" placeholder="Segment label"></td>
                    <td><input data-chart-input="value" data-group="doughnut" data-index="${index}" value="${segment.value || ''}" placeholder="Value"></td>
                    <td><button type="button" data-action="remove-row" data-group="doughnut" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Doughnut segments</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Label</th><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="doughnut">Add segment</button>
                        <button type="button" data-action="parse-csv" data-group="doughnut">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'label,value'} rows">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'polarArea') {
            const rows = wizardState.polarArea.map((segment, index) => `
                <tr>
                    <td><input data-chart-input="label" data-group="polarArea" data-index="${index}" value="${segment.label || ''}" placeholder="Segment label"></td>
                    <td><input data-chart-input="value" data-group="polarArea" data-index="${index}" value="${segment.value || ''}" placeholder="Value"></td>
                    <td><button type="button" data-action="remove-row" data-group="polarArea" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Polar area segments</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Label</th><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="polarArea">Add segment</button>
                        <button type="button" data-action="parse-csv" data-group="polarArea">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'label,value'} rows">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'dotplot') {
            const rows = wizardState.dotplot.map((value, index) => `
                <tr>
                    <td><input data-chart-input="value" data-group="dotplot" data-index="${index}" value="${value || ''}" placeholder="Value"></td>
                    <td><button type="button" data-action="remove-row" data-group="dotplot" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Dotplot values</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="dotplot">Add value</button>
                        <button type="button" data-action="parse-csv" data-group="dotplot">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'values separated by commas'}">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'scatter') {
            const rows = wizardState.scatter.map((point, index) => `
                <tr>
                    <td><input data-chart-input="x" data-group="scatter" data-index="${index}" value="${point.x || ''}" placeholder="X"></td>
                    <td><input data-chart-input="y" data-group="scatter" data-index="${index}" value="${point.y || ''}" placeholder="Y"></td>
                    <td><input data-chart-input="label" data-group="scatter" data-index="${index}" value="${point.label || ''}" placeholder="Label (optional)"></td>
                    <td><button type="button" data-action="remove-row" data-group="scatter" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Scatterplot points</label>
                    <table class="chart-data-table">
                        <thead><tr><th>X</th><th>Y</th><th>Label</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="scatter">Add point</button>
                        <button type="button" data-action="parse-csv" data-group="scatter">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'x,y'} rows (optional third column for label)">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'bubble') {
            const rows = wizardState.bubble.map((point, index) => `
                <tr>
                    <td><input data-chart-input="x" data-group="bubble" data-index="${index}" value="${point.x || ''}" placeholder="X"></td>
                    <td><input data-chart-input="y" data-group="bubble" data-index="${index}" value="${point.y || ''}" placeholder="Y"></td>
                    <td><input data-chart-input="r" data-group="bubble" data-index="${index}" value="${point.r || ''}" placeholder="Radius"></td>
                    <td><input data-chart-input="label" data-group="bubble" data-index="${index}" value="${point.label || ''}" placeholder="Label (optional)"></td>
                    <td><button type="button" data-action="remove-row" data-group="bubble" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Bubble points</label>
                    <table class="chart-data-table">
                        <thead><tr><th>X</th><th>Y</th><th>Radius</th><th>Label</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="bubble">Add bubble</button>
                        <button type="button" data-action="parse-csv" data-group="bubble">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste ${typeConfig.schema?.csv || 'x,y,r'} rows (optional fourth column for label)">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'radar') {
            const categories = wizardState.radarCategories || [];
            const datasets = wizardState.radarDatasets || [];
            const datasetHeader = datasets.map((dataset, datasetIndex) => `
                <th>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <input data-chart-input="name" data-group="radar-dataset" data-index="${datasetIndex}" value="${dataset.name || ''}" placeholder="Series ${datasetIndex + 1}">
                        ${datasets.length > 1 ? `<button type="button" data-action="remove-dataset" data-group="radar-dataset" data-index="${datasetIndex}" aria-label="Remove dataset">&times;</button>` : ''}
                    </div>
                </th>
            `).join('');
            const rows = categories.map((category, categoryIndex) => `
                <tr>
                    <td><input data-chart-input="category" data-group="radar-category" data-index="${categoryIndex}" value="${category || ''}" placeholder="Category"></td>
                    ${datasets.map((dataset, datasetIndex) => {
                        const val = Array.isArray(dataset.values) ? (dataset.values[categoryIndex] || '') : '';
                        return `<td><input data-chart-input="value" data-group="radar-value" data-index="${categoryIndex}" data-dataset-index="${datasetIndex}" value="${val}" placeholder="Value"></td>`;
                    }).join('')}
                    <td><button type="button" data-action="remove-row" data-group="radar-category" data-index="${categoryIndex}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Radar data</label>
                    <div class="chart-data-table" style="overflow-x:auto;">
                        <table class="chart-data-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    ${datasetHeader}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <div class="chart-data-actions" style="flex-wrap:wrap;">
                        <button type="button" data-action="add-row" data-group="radar-category">Add category</button>
                        <button type="button" data-action="add-dataset" data-group="radar-dataset">Add dataset</button>
                    </div>
                </div>
            `;
        }

        if (chartType === 'boxplot') {
            const { min, q1, median, q3, max } = wizardState.boxplot;
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Five-number summary</label>
                    <table class="chart-data-table">
                        <tbody>
                            <tr><th>Minimum</th><td><input data-chart-input="min" data-group="boxplot" value="${min || ''}" placeholder="Minimum"></td></tr>
                            <tr><th>Q1</th><td><input data-chart-input="q1" data-group="boxplot" value="${q1 || ''}" placeholder="First quartile"></td></tr>
                            <tr><th>Median</th><td><input data-chart-input="median" data-group="boxplot" value="${median || ''}" placeholder="Median"></td></tr>
                            <tr><th>Q3</th><td><input data-chart-input="q3" data-group="boxplot" value="${q3 || ''}" placeholder="Third quartile"></td></tr>
                            <tr><th>Maximum</th><td><input data-chart-input="max" data-group="boxplot" value="${max || ''}" placeholder="Maximum"></td></tr>
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (chartType === 'normal') {
            const normal = wizardState.normal || {};
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Normal distribution parameters</label>
                    <div class="chart-data-table" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
                        <div><label>Mean (μ)</label><input data-chart-input="mean" data-group="normal" value="${normal.mean || ''}" placeholder="e.g., 0"></div>
                        <div><label>Std. deviation (σ)</label><input data-chart-input="sd" data-group="normal" value="${normal.sd || ''}" placeholder="e.g., 1"></div>
                        <div><label>X min (optional)</label><input data-chart-input="xMin" data-group="normal" value="${normal.xMin || ''}" placeholder="Auto"></div>
                        <div><label>X max (optional)</label><input data-chart-input="xMax" data-group="normal" value="${normal.xMax || ''}" placeholder="Auto"></div>
                        <div><label>Tick interval (optional)</label><input data-chart-input="tickInterval" data-group="normal" value="${normal.tickInterval || ''}" placeholder="σ"></div>
                        <div><label>Shade lower bound</label><input data-chart-input="shadeLower" data-group="normal" value="${normal.shadeLower || ''}" placeholder="None"></div>
                        <div><label>Shade upper bound</label><input data-chart-input="shadeUpper" data-group="normal" value="${normal.shadeUpper || ''}" placeholder="None"></div>
                    </div>
                </div>
            `;
        }

        if (chartType === 'chisquare') {
            const rows = wizardState.chisquareRows.map((row, index) => `
                <tr>
                    <td><input data-chart-input="df" data-group="chisquare" data-index="${index}" value="${row.df || ''}" placeholder="Degrees of freedom"></td>
                    <td><input data-chart-input="label" data-group="chisquare" data-index="${index}" value="${row.label || ''}" placeholder="Label (optional)"></td>
                    <td><button type="button" data-action="remove-row" data-group="chisquare" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            const settings = wizardState.chisquareSettings || {};
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Chi-square curves</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Degrees of freedom</th><th>Label</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="chisquare">Add curve</button>
                    </div>
                </div>
                <div class="chart-form-group">
                    <label>Axis & resolution (optional)</label>
                    <div class="chart-data-table" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
                        <div><label>X min</label><input data-chart-input="xMin" data-group="chisquare-settings" value="${settings.xMin || ''}" placeholder="Auto"></div>
                        <div><label>X max</label><input data-chart-input="xMax" data-group="chisquare-settings" value="${settings.xMax || ''}" placeholder="Auto"></div>
                        <div><label>Tick interval</label><input data-chart-input="tickInterval" data-group="chisquare-settings" value="${settings.tickInterval || ''}" placeholder="Auto"></div>
                        <div><label>Points per curve</label><input data-chart-input="numPoints" data-group="chisquare-settings" value="${settings.numPoints || ''}" placeholder="120"></div>
                    </div>
                </div>
            `;
        }

        if (chartType === 'numberline') {
            const rows = wizardState.numberline.map((tick, index) => `
                <tr>
                    <td><input data-chart-input="position" data-group="numberline" data-index="${index}" value="${tick.position || ''}" placeholder="Position"></td>
                    <td><input data-chart-input="label" data-group="numberline" data-index="${index}" value="${tick.label || ''}" placeholder="Top label"></td>
                    <td><input data-chart-input="bottomLabel" data-group="numberline" data-index="${index}" value="${tick.bottomLabel || ''}" placeholder="Bottom label"></td>
                    <td><button type="button" data-action="remove-row" data-group="numberline" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            const range = wizardState.numberlineRange || {};
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Number line ticks</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Position</th><th>Top label</th><th>Bottom label</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row" data-group="numberline">Add tick</button>
                    </div>
                </div>
                <div class="chart-form-group">
                    <label>Optional axis overrides</label>
                    <div class="chart-data-table" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
                        <div><label>Minimum</label><input data-chart-input="min" data-group="numberline-range" value="${range.min || ''}" placeholder="Auto"></div>
                        <div><label>Maximum</label><input data-chart-input="max" data-group="numberline-range" value="${range.max || ''}" placeholder="Auto"></div>
                    </div>
                </div>
            `;
        }

        return `${axisSection}<p>Unsupported chart type.</p>`;
    }

    function getPreviewContent() {
        const chartData = buildSIF(false);
        if (!chartData) {
            return '<p>Provide data before previewing.</p>';
        }
        return `
            <div class="chart-preview-header">
                <div>
                    <strong>Preview</strong>
                    <div style="font-size:0.85rem;color:rgba(0,0,0,0.6);">${chartData.type.toUpperCase()} · ${wizardState.questionId}</div>
                </div>
                <div class="chart-preview-actions">
                    <button type="button" data-action="edit-data">Edit data</button>
                </div>
            </div>
            <div id="chart-wizard-preview" class="chart-preview-container"></div>
        `;
    }

    function renderPreviewCanvas() {
        const container = document.getElementById('chart-wizard-preview');
        if (!container) return;
        const sif = buildSIF(false);
        if (!sif) {
            container.classList.add('empty');
            container.textContent = 'Add chart data to view the preview.';
            return;
        }
        const chartConfig = sifToChartConfig(sif);
        if (!chartConfig || typeof window.charts?.getChartHtml !== 'function') {
            container.classList.add('empty');
            container.textContent = 'Preview unavailable. Save to store chart data.';
            return;
        }
        const canvasId = `${PREVIEW_PREFIX}${wizardState.questionId}-modal`;
        container.classList.remove('empty');
        container.innerHTML = window.charts.getChartHtml(chartConfig, canvasId);
        setTimeout(() => {
            try {
                window.charts.renderChartNow(chartConfig, canvasId);
            } catch (error) {
                console.warn('Chart preview failed:', error);
            }
        }, 50);
    }

    function buildSIF(showError = true) {
        if (!wizardState) return null;
        const now = new Date().toISOString();
        const baseMeta = wizardState.originalMeta
            ? { ...wizardState.originalMeta, updatedAt: now }
            : { version: 1, createdAt: now, updatedAt: now };

        const trimmedXLabel = wizardState.xLabel?.trim();
        const trimmedYLabel = wizardState.yLabel?.trim();
        const trimmedTitle = wizardState.title?.trim();
        const trimmedDescription = wizardState.description?.trim();

        const commonOptions = {
            xLabel: trimmedXLabel || undefined,
            yLabel: trimmedYLabel || undefined,
            title: trimmedTitle || undefined,
            description: trimmedDescription || undefined
        };

        const attachCommon = (payload) => {
            const enriched = { ...payload, options: commonOptions, meta: baseMeta };
            if (commonOptions.xLabel !== undefined) enriched.xLabel = commonOptions.xLabel;
            if (commonOptions.yLabel !== undefined) enriched.yLabel = commonOptions.yLabel;
            if (commonOptions.title !== undefined) enriched.title = commonOptions.title;
            if (commonOptions.description !== undefined) enriched.description = commonOptions.description;
            return enriched;
        };

        const type = wizardState.chartType;

        if (type === 'bar') {
            const rows = wizardState.bar
                .filter(row => row.label && row.value !== '')
                .map(row => ({ label: row.label.trim(), value: parseFloat(row.value) }));
            if (rows.length === 0 || rows.some(row => isNaN(row.value))) {
                if (showError) {
                    wizardState.error = 'Add at least one category with a numeric value.';
                }
                return null;
            }
            const seriesName = wizardState.barSeriesName?.trim() || 'Series 1';
            const orientation = wizardState.barOrientation === 'horizontal' ? 'horizontal' : 'vertical';
            return attachCommon({
                type: 'bar',
                orientation,
                categories: rows.map(row => row.label),
                series: [
                    {
                        name: seriesName,
                        values: rows.map(row => ({ label: row.label, value: row.value }))
                    }
                ]
            });
        }

        if (type === 'line') {
            const rows = wizardState.line
                .filter(row => row.label && row.value !== '')
                .map(row => ({ label: row.label.trim(), value: parseFloat(row.value) }));
            if (rows.length === 0 || rows.some(row => isNaN(row.value))) {
                if (showError) {
                    wizardState.error = 'Add at least one category with a numeric value.';
                }
                return null;
            }
            const seriesName = wizardState.lineSeriesName?.trim() || 'Series 1';
            return attachCommon({
                type: 'line',
                categories: rows.map(row => row.label),
                series: [
                    {
                        name: seriesName,
                        values: rows.map(row => ({ label: row.label, value: row.value }))
                    }
                ]
            });
        }

        if (type === 'pie') {
            const slices = wizardState.pie
                .filter(row => row.label && row.value !== '')
                .map(row => ({ label: row.label.trim(), value: parseFloat(row.value) }));
            if (slices.length === 0 || slices.some(slice => isNaN(slice.value))) {
                if (showError) {
                    wizardState.error = 'Add at least one slice with a numeric value.';
                }
                return null;
            }
            return attachCommon({
                type: 'pie',
                segments: slices
            });
        }

        if (type === 'doughnut') {
            const segments = wizardState.doughnut
                .filter(row => row.label && row.value !== '')
                .map(row => ({ label: row.label.trim(), value: parseFloat(row.value) }));
            if (segments.length === 0 || segments.some(segment => isNaN(segment.value))) {
                if (showError) {
                    wizardState.error = 'Add at least one segment with a numeric value.';
                }
                return null;
            }
            return attachCommon({
                type: 'doughnut',
                segments
            });
        }

        if (type === 'polarArea') {
            const segments = wizardState.polarArea
                .filter(row => row.label && row.value !== '')
                .map(row => ({ label: row.label.trim(), value: parseFloat(row.value) }));
            if (segments.length === 0 || segments.some(segment => isNaN(segment.value))) {
                if (showError) {
                    wizardState.error = 'Add at least one segment with a numeric value.';
                }
                return null;
            }
            return attachCommon({
                type: 'polarArea',
                segments
            });
        }

        if (type === 'histogram') {
            const bins = wizardState.histogram
                .filter(bin => bin.label && bin.value !== '')
                .map(bin => ({ label: bin.label.trim(), value: parseFloat(bin.value) }));
            if (bins.length === 0) {
                if (showError) {
                    wizardState.error = 'Add at least one bin to preview the chart.';
                }
                return null;
            }
            if (bins.some(bin => isNaN(bin.value))) {
                if (showError) {
                    wizardState.error = 'All histogram values must be numeric.';
                }
                return null;
            }
            return attachCommon({
                type: 'histogram',
                data: {
                    bins,
                    seriesName: wizardState.seriesName?.trim() || 'Frequency'
                }
            });
        }

        if (type === 'dotplot') {
            const values = wizardState.dotplot
                .map(v => v.trim())
                .filter(Boolean)
                .map(v => parseFloat(v));
            if (values.length === 0 || values.some(v => isNaN(v))) {
                if (showError) {
                    wizardState.error = 'Enter numeric values for the dotplot.';
                }
                return null;
            }
            return attachCommon({
                type: 'dotplot',
                data: { values }
            });
        }

        if (type === 'scatter') {
            const points = wizardState.scatter
                .map(pt => ({ x: pt.x.trim(), y: pt.y.trim(), label: pt.label?.trim() }))
                .filter(pt => pt.x !== '' && pt.y !== '')
                .map(pt => ({ x: parseFloat(pt.x), y: parseFloat(pt.y), label: pt.label }));
            if (points.length === 0 || points.some(pt => isNaN(pt.x) || isNaN(pt.y))) {
                if (showError) {
                    wizardState.error = 'Enter numeric x and y values for the scatterplot.';
                }
                return null;
            }
            return attachCommon({
                type: 'scatter',
                points
            });
        }

        if (type === 'bubble') {
            const points = wizardState.bubble
                .map(pt => ({ x: pt.x.trim(), y: pt.y.trim(), r: pt.r.trim(), label: pt.label?.trim() }))
                .filter(pt => pt.x !== '' && pt.y !== '' && pt.r !== '')
                .map(pt => ({ x: parseFloat(pt.x), y: parseFloat(pt.y), r: parseFloat(pt.r), label: pt.label }));
            if (points.length === 0 || points.some(pt => isNaN(pt.x) || isNaN(pt.y) || isNaN(pt.r))) {
                if (showError) {
                    wizardState.error = 'Enter numeric x, y, and radius values for the bubble chart.';
                }
                return null;
            }
            return attachCommon({
                type: 'bubble',
                points
            });
        }

        if (type === 'radar') {
            const categories = (wizardState.radarCategories || []).map(cat => cat.trim()).filter(Boolean);
            if (categories.length === 0) {
                if (showError) {
                    wizardState.error = 'Add at least one category for the radar chart.';
                }
                return null;
            }
            const datasets = (wizardState.radarDatasets || []).map(dataset => ({
                name: dataset.name?.trim() || 'Series',
                values: (dataset.values || []).slice(0, categories.length).map(value => parseFloat(value))
            }));
            if (datasets.length === 0 || datasets.some(ds => ds.values.length !== categories.length || ds.values.some(v => isNaN(v)))) {
                if (showError) {
                    wizardState.error = 'Provide numeric values for each category in every dataset.';
                }
                return null;
            }
            return attachCommon({
                type: 'radar',
                categories,
                datasets
            });
        }

        if (type === 'boxplot') {
            const { min, q1, median, q3, max } = wizardState.boxplot;
            const parsed = [min, q1, median, q3, max].map(v => parseFloat(v));
            if (parsed.some(v => isNaN(v))) {
                if (showError) {
                    wizardState.error = 'Provide numeric values for min, Q1, median, Q3, and max.';
                }
                return null;
            }
            return attachCommon({
                type: 'boxplot',
                data: {
                    fiveNumber: {
                        min: parsed[0],
                        q1: parsed[1],
                        median: parsed[2],
                        q3: parsed[3],
                        max: parsed[4]
                    }
                }
            });
        }

        if (type === 'normal') {
            const { mean, sd, xMin, xMax, tickInterval, shadeLower, shadeUpper } = wizardState.normal;
            const meanValue = parseFloat(mean);
            const sdValue = parseFloat(sd);
            if (isNaN(meanValue) || isNaN(sdValue) || sdValue <= 0) {
                if (showError) {
                    wizardState.error = 'Normal curve requires numeric mean and positive standard deviation.';
                }
                return null;
            }
            const normalData = { mean: meanValue, sd: sdValue };
            if (xMin !== '') normalData.xMin = parseFloat(xMin);
            if (xMax !== '') normalData.xMax = parseFloat(xMax);
            if (tickInterval !== '') normalData.tickInterval = parseFloat(tickInterval);
            if (shadeLower !== '' || shadeUpper !== '') {
                normalData.shade = {
                    lower: shadeLower !== '' ? parseFloat(shadeLower) : null,
                    upper: shadeUpper !== '' ? parseFloat(shadeUpper) : null
                };
            }
            return attachCommon({
                type: 'normal',
                data: normalData
            });
        }

        if (type === 'chisquare') {
            const rows = wizardState.chisquareRows
                .filter(row => row.df !== '')
                .map(row => ({ df: parseFloat(row.df), label: row.label?.trim() || '' }));
            if (rows.length === 0 || rows.some(row => isNaN(row.df) || row.df <= 0)) {
                if (showError) {
                    wizardState.error = 'Provide positive numeric degrees of freedom.';
                }
                return null;
            }
            const settings = wizardState.chisquareSettings;
            const data = {
                dfList: rows.map(row => row.df),
                labels: rows.map((row, index) => row.label || `df = ${rows[index].df}`)
            };
            if (settings.xMin !== '') data.xMin = parseFloat(settings.xMin);
            if (settings.xMax !== '') data.xMax = parseFloat(settings.xMax);
            if (settings.tickInterval !== '') data.tickInterval = parseFloat(settings.tickInterval);
            if (settings.numPoints !== '') data.numPoints = parseInt(settings.numPoints, 10);
            return attachCommon({
                type: 'chisquare',
                data
            });
        }

        if (type === 'numberline') {
            const ticks = wizardState.numberline
                .filter(tick => tick.position !== '')
                .map(tick => ({
                    x: parseFloat(tick.position),
                    label: tick.label?.trim() || '',
                    bottomLabel: tick.bottomLabel?.trim() || ''
                }));
            if (ticks.length === 0 || ticks.some(tick => isNaN(tick.x))) {
                if (showError) {
                    wizardState.error = 'Add numeric tick positions for the number line.';
                }
                return null;
            }
            const range = wizardState.numberlineRange;
            const data = { ticks };
            if (range.min !== '') data.xMin = parseFloat(range.min);
            if (range.max !== '') data.xMax = parseFloat(range.max);
            return attachCommon({
                type: 'numberline',
                data
            });
        }

        if (showError) {
            wizardState.error = 'Unsupported chart type.';
        }
        return null;
    }

    function sifToChartConfig(sif) {
        if (!sif) return null;
        const options = sif.options || {};
        const xLabel = sif.xLabel !== undefined ? sif.xLabel : options.xLabel;
        const yLabel = sif.yLabel !== undefined ? sif.yLabel : options.yLabel;
        const title = sif.title !== undefined ? sif.title : options.title;
        const description = sif.description !== undefined ? sif.description : options.description;

        const baseConfig = {
            title: title || undefined,
            chartConfig: {
                description: description || undefined,
                xAxis: { title: xLabel || undefined },
                yAxis: { title: yLabel || undefined }
            }
        };

        const legacyData = sif.data || {};

        if (sif.type === 'bar') {
            const orientation = (sif.orientation || legacyData.orientation) === 'horizontal' ? 'horizontal' : 'vertical';
            const categories = Array.isArray(sif.categories) && sif.categories.length > 0
                ? sif.categories.slice()
                : Array.isArray(legacyData.categories) ? legacyData.categories.slice() : [];
            const rawSeries = Array.isArray(sif.series) && sif.series.length > 0
                ? sif.series
                : legacyData.seriesName || Array.isArray(legacyData.values)
                    ? [{ name: legacyData.seriesName || 'Series 1', values: (legacyData.values || []).map((value, idx) => ({ label: categories[idx] || `Category ${idx + 1}`, value })) }]
                    : [];

            const categorySet = new Set(categories);
            rawSeries.forEach(dataset => {
                const valuesArray = Array.isArray(dataset.values) ? dataset.values : [];
                valuesArray.forEach((entry, index) => {
                    if (entry && typeof entry === 'object' && entry.label !== undefined) {
                        categorySet.add(entry.label);
                    } else if (categories[index]) {
                        categorySet.add(categories[index]);
                    } else {
                        categorySet.add(`Category ${index + 1}`);
                    }
                });
            });
            const orderedCategories = categorySet.size > 0 ? Array.from(categorySet) : rawSeries[0]?.values?.map((_, idx) => `Category ${idx + 1}`) || [];

            const series = rawSeries.map(dataset => {
                const valuesArray = Array.isArray(dataset.values) ? dataset.values : [];
                const normalizedValues = orderedCategories.map((label, index) => {
                    const directMatch = valuesArray.find(value => value && typeof value === 'object' && value.label === label);
                    if (directMatch) {
                        return Number(directMatch.value) || 0;
                    }
                    const rawValue = valuesArray[index];
                    if (rawValue && typeof rawValue === 'object') {
                        return Number(rawValue.value) || 0;
                    }
                    return Number(rawValue) || 0;
                });
                return {
                    name: dataset.name || legacyData.seriesName || 'Series 1',
                    values: normalizedValues
                };
            });

            return {
                chartType: 'bar',
                title: baseConfig.title,
                xLabels: orderedCategories,
                series,
                chartConfig: {
                    ...baseConfig.chartConfig,
                    orientation,
                    xAxis: { title: xLabel || 'Category' },
                    yAxis: { title: yLabel || 'Value' }
                }
            };
        }

        if (sif.type === 'line') {
            const categories = Array.isArray(sif.categories) && sif.categories.length > 0
                ? sif.categories.slice()
                : Array.isArray(legacyData.categories) ? legacyData.categories.slice() : [];
            const rawSeries = Array.isArray(sif.series) && sif.series.length > 0
                ? sif.series
                : legacyData.seriesName || Array.isArray(legacyData.values)
                    ? [{ name: legacyData.seriesName || 'Series 1', values: (legacyData.values || []).map((value, idx) => ({ label: categories[idx] || `Category ${idx + 1}`, value })) }]
                    : [];

            const categorySet = new Set(categories);
            rawSeries.forEach(dataset => {
                (dataset.values || []).forEach((entry, idx) => {
                    if (entry && typeof entry === 'object' && entry.label !== undefined) {
                        categorySet.add(entry.label);
                    } else if (categories[idx]) {
                        categorySet.add(categories[idx]);
                    } else {
                        categorySet.add(`Category ${idx + 1}`);
                    }
                });
            });
            const orderedCategories = categorySet.size > 0 ? Array.from(categorySet) : rawSeries[0]?.values?.map((_, idx) => `Category ${idx + 1}`) || [];

            const series = rawSeries.map(dataset => {
                const valuesArray = Array.isArray(dataset.values) ? dataset.values : [];
                const normalizedValues = orderedCategories.map((label, index) => {
                    const directMatch = valuesArray.find(value => value && typeof value === 'object' && value.label === label);
                    if (directMatch) {
                        return Number(directMatch.value) || 0;
                    }
                    const rawValue = valuesArray[index];
                    if (rawValue && typeof rawValue === 'object') {
                        return Number(rawValue.value) || 0;
                    }
                    return Number(rawValue) || 0;
                });
                return {
                    name: dataset.name || legacyData.seriesName || 'Series 1',
                    values: normalizedValues
                };
            });

            return {
                chartType: 'line',
                title: baseConfig.title,
                xLabels: orderedCategories,
                series,
                chartConfig: {
                    ...baseConfig.chartConfig,
                    xAxis: { title: xLabel || 'Category' },
                    yAxis: { title: yLabel || 'Value' }
                }
            };
        }

        if (sif.type === 'pie' || sif.type === 'doughnut' || sif.type === 'polarArea') {
            const segments = Array.isArray(sif.segments) && sif.segments.length > 0
                ? sif.segments
                : legacyData.slices || [];
            const values = segments.map(segment => ({
                name: segment.label,
                value: Number(segment.value) || 0
            }));
            return {
                chartType: sif.type,
                title: baseConfig.title,
                series: [{ values }],
                chartConfig: {
                    ...baseConfig.chartConfig
                }
            };
        }

        if (sif.type === 'histogram') {
            const bins = legacyData.bins || [];
            const seriesName = legacyData.seriesName || 'Frequency';
            return {
                chartType: 'histogram',
                title: baseConfig.title,
                xLabels: bins.map(bin => bin.label),
                series: [{
                    name: seriesName,
                    values: bins.map(bin => Number(bin.value) || 0)
                }],
                chartConfig: {
                    ...baseConfig.chartConfig,
                    yAxis: { title: yLabel || 'Frequency' },
                    xAxis: { title: xLabel || 'Category' }
                }
            };
        }

        if (sif.type === 'dotplot') {
            return {
                chartType: 'dotplot',
                title: baseConfig.title,
                values: (legacyData.values || []).map(v => Number(v) || 0),
                chartConfig: {
                    ...baseConfig.chartConfig,
                    xAxis: { title: xLabel || 'Value' },
                    gridLines: { horizontal: false, vertical: false }
                }
            };
        }

        if (sif.type === 'scatter') {
            const points = Array.isArray(sif.points) ? sif.points : legacyData.points || [];
            return {
                chartType: 'scatter',
                title: baseConfig.title,
                points: points.map(pt => ({
                    x: Number(pt.x) || 0,
                    y: Number(pt.y) || 0,
                    label: pt.label
                })),
                chartConfig: {
                    ...baseConfig.chartConfig,
                    xAxis: { title: xLabel || 'X Value' },
                    yAxis: { title: yLabel || 'Y Value' }
                }
            };
        }

        if (sif.type === 'bubble') {
            const points = Array.isArray(sif.points) ? sif.points : [];
            return {
                chartType: 'bubble',
                title: baseConfig.title,
                points: points.map(pt => ({
                    x: Number(pt.x) || 0,
                    y: Number(pt.y) || 0,
                    r: Number(pt.r) || 0,
                    label: pt.label
                })),
                chartConfig: {
                    ...baseConfig.chartConfig,
                    xAxis: { title: xLabel || 'X Value' },
                    yAxis: { title: yLabel || 'Y Value' }
                }
            };
        }

        if (sif.type === 'radar') {
            const categories = Array.isArray(sif.categories) ? sif.categories : [];
            const datasets = Array.isArray(sif.datasets) ? sif.datasets : [];
            return {
                chartType: 'radar',
                title: baseConfig.title,
                categories,
                datasets: datasets.map(dataset => ({
                    name: dataset.name || 'Series',
                    values: (dataset.values || []).map(value => Number(value) || 0)
                })),
                chartConfig: {
                    ...baseConfig.chartConfig
                }
            };
        }

        if (sif.type === 'boxplot') {
            const five = legacyData.fiveNumber || {};
            return {
                chartType: 'boxplot',
                title: baseConfig.title,
                chartConfig: {
                    ...baseConfig.chartConfig,
                    orientation: 'horizontal',
                    boxplotData: {
                        min: five.min,
                        Q1: five.q1 ?? five.Q1,
                        median: five.median,
                        Q3: five.q3 ?? five.Q3,
                        max: five.max
                    }
                }
            };
        }

        if (sif.type === 'normal') {
            const data = legacyData || {};
            const shade = data.shade;
            const xAxisConfig = {
                ...baseConfig.chartConfig.xAxis,
                min: data.xMin,
                max: data.xMax,
                tickInterval: data.tickInterval
            };
            return {
                chartType: 'normal',
                title: baseConfig.title,
                mean: Number(data.mean) || 0,
                sd: Number(data.sd) || 1,
                shade: shade ? { lower: shade.lower, upper: shade.upper } : undefined,
                chartConfig: {
                    ...baseConfig.chartConfig,
                    xAxis: xAxisConfig,
                    yAxis: baseConfig.chartConfig.yAxis
                }
            };
        }

        if (sif.type === 'chisquare') {
            const data = legacyData || {};
            const dfList = data.dfList || [];
            const labels = data.labels || [];
            return {
                chartType: 'chisquare',
                title: baseConfig.title,
                chartConfig: {
                    ...baseConfig.chartConfig,
                    dfList,
                    labels,
                    xAxis: {
                        ...baseConfig.chartConfig.xAxis,
                        min: data.xMin,
                        max: data.xMax,
                        tickInterval: data.tickInterval
                    },
                    yAxis: baseConfig.chartConfig.yAxis,
                    numPoints: data.numPoints
                }
            };
        }

        if (sif.type === 'numberline') {
            const data = legacyData || {};
            return {
                chartType: 'numberline',
                title: baseConfig.title,
                ticks: data.ticks || [],
                chartConfig: {
                    ...baseConfig.chartConfig,
                    xAxis: {
                        ...baseConfig.chartConfig.xAxis,
                        min: data.xMin,
                        max: data.xMax
                    }
                }
            };
        }

        return null;
    }


    function saveChart() {
        const sif = buildSIF();
        if (!sif) {
            renderWizard();
            return;
        }

        const username = window.currentUsername || localStorage.getItem('consensusUsername') || '';
        if (!username) {
            wizardState.error = 'Set your username before saving charts.';
            renderWizard();
            return;
        }

        setStoredChartSIF(wizardState.questionId, sif);
        if (typeof window.saveClassData === 'function') {
            window.saveClassData();
        }

        if (typeof window.showMessage === 'function') {
            window.showMessage('Chart saved to your response.', 'success');
        }

        if (typeof window.renderChartWizardPreview === 'function') {
            window.renderChartWizardPreview(wizardState.questionId);
        }

        closeWizard();
    }

    function confirmAndDelete() {
        if (!wizardState) return;
        const confirmed = confirm('Remove the saved chart for this question?');
        if (!confirmed) return;
        deleteChartForQuestion(wizardState.questionId, true);
    }

    function deleteChartForQuestion(questionId, fromWizard) {
        deleteStoredChartSIF(questionId);
        if (typeof window.saveClassData === 'function') {
            window.saveClassData();
        }
        if (typeof window.showMessage === 'function') {
            window.showMessage('Chart removed.', 'info');
        }
        if (typeof window.renderChartWizardPreview === 'function') {
            window.renderChartWizardPreview(questionId);
        }
        if (fromWizard) {
            closeWizard();
        }
    }

    function renderChartWizardPreview(questionId) {
        const container = document.getElementById(`chart-preview-${questionId}`);
        if (!container) return;
        container.innerHTML = '';
        const chart = getStoredChartSIF(questionId);
        const button = document.querySelector(`[data-chart-button="${questionId}"]`);
        if (!chart) {
            container.classList.add('empty');
            container.textContent = 'No chart saved yet. Use the wizard to add one.';
            if (button) {
                button.textContent = 'Create Chart';
            }
            return;
        }
        container.classList.remove('empty');
        const chartData = sifToChartConfig(chart);
        if (!chartData || typeof window.charts?.getChartHtml !== 'function') {
            container.textContent = 'Saved chart detected, but preview is unavailable.';
            return;
        }
        const canvasId = `${PREVIEW_PREFIX}${questionId}`;
        container.innerHTML = `
            <div class="chart-preview-header">
                <strong>Saved Chart</strong>
                <div class="chart-preview-actions">
                    <button type="button" onclick="openChartWizard('${questionId}')">Edit</button>
                    <button type="button" onclick="deleteChartForQuestion('${questionId}')">Delete</button>
                </div>
            </div>
            ${window.charts.getChartHtml(chartData, canvasId)}
        `;
        if (button) {
            button.textContent = 'Edit Chart';
        }
        setTimeout(() => {
            try {
                window.charts.renderChartNow(chartData, canvasId);
            } catch (error) {
                console.warn('Unable to render chart preview:', error);
            }
        }, 50);
    }

    window.openChartWizard = openChartWizard;
    window.renderChartWizardPreview = renderChartWizardPreview;
    window.deleteChartForQuestion = function(questionId) {
        deleteChartForQuestion(questionId, false);
    };
    window.convertChartSIFToChartData = sifToChartConfig;
})();
