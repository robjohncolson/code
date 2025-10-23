(function() {
    const MODAL_ID = 'chart-wizard-modal';
    const OVERLAY_ID = 'chart-wizard-overlay';
    const CONTENT_ID = 'chart-wizard-content';
    const PREVIEW_PREFIX = 'chart-preview-canvas-';
    let wizardState = null;
    let stylesInjected = false;

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

    function openChartWizard(questionId) {
        injectStyles();
        ensureModal();

        const metadata = window.CHART_QUESTIONS?.[questionId];
        if (!metadata) {
            alert('No chart metadata available for this question yet.');
            return;
        }

        const username = window.currentUsername || localStorage.getItem('consensusUsername') || '';
        if (!username) {
            if (typeof window.showMessage === 'function') {
                window.showMessage('Please set your username before creating a chart.', 'error');
            } else {
                alert('Please set your username before creating a chart.');
            }
            return;
        }

        const existingChart = window.classData?.users?.[username]?.charts?.[questionId] || null;
        wizardState = createInitialState(questionId, metadata, existingChart);
        renderWizard();
        showOverlay();
    }

    function createInitialState(questionId, metadata, existingChart) {
        const baseState = {
            questionId,
            metadata,
            step: 0,
            chartType: metadata.chartHints?.[0] || 'histogram',
            histogram: [{ label: '', value: '' }],
            dotplot: [''],
            scatter: [{ x: '', y: '' }],
            boxplot: { min: '', q1: '', median: '', q3: '', max: '' },
            seriesName: existingChart?.data?.seriesName || 'Frequency',
            xLabel: existingChart?.options?.xLabel || '',
            yLabel: existingChart?.options?.yLabel || '',
            title: existingChart?.options?.title || '',
            description: existingChart?.options?.description || '',
            csvText: '',
            originalMeta: existingChart?.meta || null,
            error: ''
        };

        if (existingChart) {
            baseState.chartType = existingChart.type || baseState.chartType;
            if (existingChart.type === 'histogram') {
                baseState.histogram = (existingChart.data?.bins || []).map(bin => ({
                    label: bin.label,
                    value: bin.value
                }));
                if (baseState.histogram.length === 0) {
                    baseState.histogram = [{ label: '', value: '' }];
                }
            } else if (existingChart.type === 'dotplot') {
                baseState.dotplot = (existingChart.data?.values || []).map(v => `${v}`);
                if (baseState.dotplot.length === 0) {
                    baseState.dotplot = [''];
                }
            } else if (existingChart.type === 'scatter') {
                baseState.scatter = (existingChart.data?.points || []).map(point => ({
                    x: point.x,
                    y: point.y,
                    label: point.label
                }));
                if (baseState.scatter.length === 0) {
                    baseState.scatter = [{ x: '', y: '' }];
                }
            } else if (existingChart.type === 'boxplot') {
                const five = existingChart.data?.fiveNumber || existingChart.options?.boxplotData || {};
                baseState.boxplot = {
                    min: five.min ?? '',
                    q1: five.q1 ?? five.Q1 ?? '',
                    median: five.median ?? '',
                    q3: five.q3 ?? five.Q3 ?? '',
                    max: five.max ?? ''
                };
            }
        }

        return baseState;
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
            const hints = metadata?.chartHints || ['histogram', 'dotplot', 'boxplot', 'scatter'];
            return `
                ${prompt}
                ${errorHtml}
                <div class="chart-type-grid">
                    ${['histogram', 'dotplot', 'boxplot', 'scatter'].map(type => {
                        const active = chartType === type ? 'active' : '';
                        const suggested = hints.includes(type) ? '<span style="font-size:0.8rem;color:#3867d6;">Suggested</span>' : '';
                        const descriptions = {
                            histogram: 'Group numeric data into bins and visualize frequencies.',
                            dotplot: 'Plot individual numeric observations with stacked dots.',
                            boxplot: 'Summarize distribution using five-number summary.',
                            scatter: 'Show relationship between two numeric variables.'
                        };
                        return `
                            <button type="button" class="chart-type-option ${active}" data-chart-type="${type}">
                                <h4>${type.charAt(0).toUpperCase() + type.slice(1)}</h4>
                                ${suggested}
                                <p>${descriptions[type]}</p>
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
        const username = window.currentUsername || localStorage.getItem('consensusUsername') || '';
        return !!window.classData?.users?.[username]?.charts?.[wizardState.questionId];
    }

    function attachEventHandlers(body, footer) {
        if (!wizardState) return;

        if (wizardState.step === 0) {
            body.querySelectorAll('[data-chart-type]').forEach(btn => {
                btn.addEventListener('click', () => {
                    wizardState.chartType = btn.getAttribute('data-chart-type');
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
                const index = parseInt(target.getAttribute('data-index'), 10);
                if (wizardState.chartType === 'histogram') {
                    if (field === 'label') {
                        wizardState.histogram[index].label = target.value;
                    } else if (field === 'value') {
                        wizardState.histogram[index].value = target.value;
                    }
                } else if (wizardState.chartType === 'dotplot') {
                    wizardState.dotplot[index] = target.value;
                } else if (wizardState.chartType === 'scatter') {
                    wizardState.scatter[index][field] = target.value;
                } else if (wizardState.chartType === 'boxplot') {
                    wizardState.boxplot[field] = target.value;
                }
            });
        });

        body.querySelectorAll('[data-action="add-row"]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (wizardState.chartType === 'histogram') {
                    wizardState.histogram.push({ label: '', value: '' });
                } else if (wizardState.chartType === 'dotplot') {
                    wizardState.dotplot.push('');
                } else if (wizardState.chartType === 'scatter') {
                    wizardState.scatter.push({ x: '', y: '' });
                }
                renderWizard();
            });
        });

        body.querySelectorAll('[data-action="remove-row"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'), 10);
                if (wizardState.chartType === 'histogram' && wizardState.histogram.length > 1) {
                    wizardState.histogram.splice(index, 1);
                } else if (wizardState.chartType === 'dotplot' && wizardState.dotplot.length > 1) {
                    wizardState.dotplot.splice(index, 1);
                } else if (wizardState.chartType === 'scatter' && wizardState.scatter.length > 1) {
                    wizardState.scatter.splice(index, 1);
                }
                renderWizard();
            });
        });

        const parseButton = body.querySelector('[data-action="parse-csv"]');
        if (parseButton) {
            parseButton.addEventListener('click', () => {
                parseCSVData();
            });
        }

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
    }

    function parseCSVData() {
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
            if (wizardState.chartType === 'histogram') {
                const parsedBins = rows.map(row => {
                    const [label, value] = row.split(/,|\t/);
                    return { label: (label || '').trim(), value: value !== undefined ? value.trim() : '' };
                }).filter(bin => bin.label);
                if (parsedBins.length === 0) {
                    throw new Error('Each row should include a label and value separated by a comma.');
                }
                wizardState.histogram = parsedBins;
            } else if (wizardState.chartType === 'dotplot') {
                const values = rows.flatMap(row => row.split(/,|\s+/).map(v => v.trim()).filter(Boolean));
                if (values.length === 0) {
                    throw new Error('Provide numeric values separated by commas or spaces.');
                }
                wizardState.dotplot = values;
            } else if (wizardState.chartType === 'scatter') {
                const points = rows.map(row => {
                    const [x, y] = row.split(/,|\t/);
                    return { x: x !== undefined ? x.trim() : '', y: y !== undefined ? y.trim() : '' };
                }).filter(point => point.x !== '' && point.y !== '');
                if (points.length === 0) {
                    throw new Error('Each row should include x and y values separated by a comma.');
                }
                wizardState.scatter = points;
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

    function validateCurrentData() {
        if (!wizardState) return false;
        const type = wizardState.chartType;
        if (type === 'histogram') {
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
        } else if (type === 'boxplot') {
            const { min, q1, median, q3, max } = wizardState.boxplot;
            const values = [min, q1, median, q3, max].map(v => parseFloat(v));
            if (values.some(v => isNaN(v))) {
                wizardState.error = 'Enter numeric values for the five-number summary.';
                return false;
            }
        }
        wizardState.error = '';
        return true;
    }

    function getDataEntryContent(chartType) {
        const axisSection = `
            <div class="chart-form-group">
                <label>X-axis label</label>
                <input type="text" data-role="xLabel" value="${wizardState.xLabel || ''}" placeholder="e.g., Order amount ($)">
            </div>
            ${chartType !== 'dotplot' ? `<div class="chart-form-group">
                <label>Y-axis label</label>
                <input type="text" data-role="yLabel" value="${wizardState.yLabel || ''}" placeholder="e.g., Frequency">
            </div>` : ''}
            ${chartType === 'histogram' ? `<div class="chart-form-group">
                <label>Series name</label>
                <input type="text" data-role="seriesName" value="${wizardState.seriesName || ''}" placeholder="Frequency">
            </div>` : ''}
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
                    <td><input data-chart-input="label" data-index="${index}" value="${bin.label || ''}" placeholder="Interval"></td>
                    <td><input data-chart-input="value" data-index="${index}" value="${bin.value || ''}" placeholder="Frequency"></td>
                    <td><button type="button" data-action="remove-row" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Histogram bins</label>
                    <table class="chart-data-table">
                        <thead><tr><th>Label</th><th>Value</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row">Add row</button>
                        <button type="button" data-action="parse-csv">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste label,value rows">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'dotplot') {
            const rows = wizardState.dotplot.map((value, index) => `
                <tr>
                    <td><input data-chart-input="value" data-index="${index}" value="${value || ''}" placeholder="Value"></td>
                    <td><button type="button" data-action="remove-row" data-index="${index}">Remove</button></td>
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
                        <button type="button" data-action="add-row">Add value</button>
                        <button type="button" data-action="parse-csv">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste values (comma or space separated)">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        if (chartType === 'scatter') {
            const rows = wizardState.scatter.map((point, index) => `
                <tr>
                    <td><input data-chart-input="x" data-index="${index}" value="${point.x || ''}" placeholder="X"></td>
                    <td><input data-chart-input="y" data-index="${index}" value="${point.y || ''}" placeholder="Y"></td>
                    <td><button type="button" data-action="remove-row" data-index="${index}">Remove</button></td>
                </tr>
            `).join('');
            return `
                ${axisSection}
                <div class="chart-form-group">
                    <label>Scatterplot points</label>
                    <table class="chart-data-table">
                        <thead><tr><th>X</th><th>Y</th><th></th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="chart-data-actions">
                        <button type="button" data-action="add-row">Add point</button>
                        <button type="button" data-action="parse-csv">Parse CSV</button>
                    </div>
                    <textarea data-chart-csv placeholder="Paste x,y pairs">${wizardState.csvText || ''}</textarea>
                </div>
            `;
        }

        const { min, q1, median, q3, max } = wizardState.boxplot;
        return `
            ${axisSection}
            <div class="chart-form-group">
                <label>Five-number summary</label>
                <table class="chart-data-table">
                    <tbody>
                        <tr><th>Minimum</th><td><input data-chart-input="min" value="${min || ''}" placeholder="Minimum"></td></tr>
                        <tr><th>Q1</th><td><input data-chart-input="q1" value="${q1 || ''}" placeholder="First quartile"></td></tr>
                        <tr><th>Median</th><td><input data-chart-input="median" value="${median || ''}" placeholder="Median"></td></tr>
                        <tr><th>Q3</th><td><input data-chart-input="q3" value="${q3 || ''}" placeholder="Third quartile"></td></tr>
                        <tr><th>Maximum</th><td><input data-chart-input="max" value="${max || ''}" placeholder="Maximum"></td></tr>
                    </tbody>
                </table>
            </div>
        `;
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
                    <button type="button" data-action="back">Edit data</button>
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
        const chartConfig = convertSIFToChartData(sif);
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

        const commonOptions = {
            xLabel: wizardState.xLabel?.trim() || '',
            yLabel: wizardState.yLabel?.trim() || '',
            title: wizardState.title?.trim() || '',
            description: wizardState.description?.trim() || ''
        };

        if (wizardState.chartType === 'histogram') {
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
            return {
                type: 'histogram',
                data: {
                    bins,
                    seriesName: wizardState.seriesName?.trim() || 'Frequency'
                },
                options: commonOptions,
                meta: baseMeta
            };
        }

        if (wizardState.chartType === 'dotplot') {
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
            return {
                type: 'dotplot',
                data: { values },
                options: commonOptions,
                meta: baseMeta
            };
        }

        if (wizardState.chartType === 'scatter') {
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
            return {
                type: 'scatter',
                data: { points },
                options: commonOptions,
                meta: baseMeta
            };
        }

        const { min, q1, median, q3, max } = wizardState.boxplot;
        const parsed = [min, q1, median, q3, max].map(v => parseFloat(v));
        if (parsed.some(v => isNaN(v))) {
            if (showError) {
                wizardState.error = 'Provide numeric values for min, Q1, median, Q3, and max.';
            }
            return null;
        }
        return {
            type: 'boxplot',
            data: {
                fiveNumber: {
                    min: parsed[0],
                    q1: parsed[1],
                    median: parsed[2],
                    q3: parsed[3],
                    max: parsed[4]
                }
            },
            options: commonOptions,
            meta: baseMeta
        };
    }

    function convertSIFToChartData(sif) {
        if (!sif) return null;
        const options = sif.options || {};
        const baseConfig = {
            title: options.title || undefined,
            chartConfig: {
                description: options.description || undefined,
                xAxis: { title: options.xLabel || undefined },
                yAxis: { title: options.yLabel || undefined }
            }
        };

        if (sif.type === 'histogram') {
            const bins = sif.data?.bins || [];
            const seriesName = sif.data?.seriesName || 'Frequency';
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
                    yAxis: { title: options.yLabel || 'Frequency' },
                    xAxis: { title: options.xLabel || 'Category' }
                }
            };
        }

        if (sif.type === 'dotplot') {
            return {
                chartType: 'dotplot',
                title: baseConfig.title,
                values: (sif.data?.values || []).map(v => Number(v) || 0),
                chartConfig: {
                    ...baseConfig.chartConfig,
                    xAxis: { title: options.xLabel || 'Value' },
                    gridLines: { horizontal: false, vertical: false }
                }
            };
        }

        if (sif.type === 'scatter') {
            const points = sif.data?.points || [];
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
                    xAxis: { title: options.xLabel || 'X Value' },
                    yAxis: { title: options.yLabel || 'Y Value' }
                }
            };
        }

        if (sif.type === 'boxplot') {
            const five = sif.data?.fiveNumber || {};
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
        if (!window.classData.users[username].charts) {
            window.classData.users[username].charts = {};
        }

        window.classData.users[username].charts[wizardState.questionId] = sif;
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
        const username = window.currentUsername || localStorage.getItem('consensusUsername') || '';
        if (!username) return;
        if (!window.classData?.users?.[username]?.charts?.[questionId]) return;
        delete window.classData.users[username].charts[questionId];
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
        const username = window.currentUsername || localStorage.getItem('consensusUsername') || '';
        const chart = window.classData?.users?.[username]?.charts?.[questionId];
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
        const chartData = convertSIFToChartData(chart);
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
    window.convertChartSIFToChartData = convertSIFToChartData;
})();
