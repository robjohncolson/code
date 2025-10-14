(function () {
    const modalId = 'graphSandboxModal';
    const previewContainerId = 'graphSandboxPreview';
    const messageId = 'graphSandboxMessage';
    const chartQuestionId = 'graph-sandbox-preview';

    function $(id) {
        return document.getElementById(id);
    }

    function showMessage(text, type = 'info') {
        const messageEl = $(messageId);
        if (!messageEl) return;
        messageEl.textContent = text || '';
        messageEl.dataset.variant = type;
    }

    function parseNumberList(value) {
        if (!value) return { values: [], errors: ['No numbers provided.'] };
        const tokens = value.split(/[^-?\d\.eE]+/).filter(Boolean);
        const numbers = [];
        const errors = [];
        tokens.forEach((token) => {
            const numeric = Number(token);
            if (Number.isFinite(numeric)) {
                numbers.push(numeric);
            } else {
                errors.push(`Unable to parse "${token}" as a number.`);
            }
        });
        if (numbers.length === 0) {
            errors.push('Provide at least one numeric value.');
        }
        return { values: numbers, errors };
    }

    function parseStringList(value) {
        if (!value) return [];
        return value
            .split(/\s*,\s*|\r?\n/)
            .map((entry) => entry.trim())
            .filter(Boolean);
    }

    function computeQuantile(sortedValues, quantile) {
        if (sortedValues.length === 0) return null;
        const pos = (sortedValues.length - 1) * quantile;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (sortedValues[base + 1] !== undefined) {
            return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
        }
        return sortedValues[base];
    }

    function buildHistogram(values, binWidth) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const start = Math.floor(min / binWidth) * binWidth;
        let end = Math.ceil(max / binWidth) * binWidth;
        if (end === start) {
            end = start + binWidth;
        }
        const bins = [];
        for (let edge = start; edge < end; edge += binWidth) {
            bins.push({
                lower: edge,
                upper: edge + binWidth,
                count: 0
            });
        }

        values.forEach((value) => {
            const index = Math.min(
                Math.floor((value - start) / binWidth),
                bins.length - 1
            );
            bins[index].count += 1;
        });

        return bins;
    }

    function buildChartData() {
        const chartType = $('graphSandboxType').value;
        const title = $('graphSandboxTitle').value.trim();
        const xAxis = $('graphSandboxXAxis').value.trim();
        const yAxis = $('graphSandboxYAxis').value.trim();

        const primary = parseNumberList($('graphSandboxPrimaryInput').value);
        if (primary.errors.length > 0) {
            return { error: primary.errors.join(' ') };
        }

        const baseConfig = {
            title: title || undefined
        };

        if (chartType === 'histogram') {
            const rawWidth = Number($('graphSandboxBinWidth').value);
            const binWidth = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : null;
            if (!binWidth) {
                return { error: 'Enter a positive bin width for the histogram.' };
            }
            const bins = buildHistogram(primary.values, binWidth);
            const labels = bins.map((bin) => `${bin.lower.toFixed(2)} – ${(bin.upper).toFixed(2)}`);
            const counts = bins.map((bin) => bin.count);

            return {
                chartData: {
                    ...baseConfig,
                    chartType: 'histogram',
                    xLabels: labels,
                    series: [
                        {
                            name: yAxis || 'Frequency',
                            values: counts
                        }
                    ],
                    chartConfig: {
                        xAxis: {
                            title: xAxis || 'Value',
                            labelType: 'range'
                        },
                        yAxis: {
                            title: yAxis || 'Frequency',
                            min: 0
                        },
                        description: 'Histogram created in the Graphing Sandbox'
                    }
                }
            };
        }

        if (chartType === 'dotplot') {
            return {
                chartData: {
                    ...baseConfig,
                    chartType: 'dotplot',
                    values: primary.values,
                    chartConfig: {
                        xAxis: {
                            title: xAxis || 'Value'
                        },
                        description: 'Dot plot created in the Graphing Sandbox'
                    }
                }
            };
        }

        if (chartType === 'boxplot') {
            const sorted = [...primary.values].sort((a, b) => a - b);
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            const median = computeQuantile(sorted, 0.5);
            const q1 = computeQuantile(sorted, 0.25);
            const q3 = computeQuantile(sorted, 0.75);

            return {
                chartData: {
                    ...baseConfig,
                    chartType: 'boxplot',
                    chartConfig: {
                        orientation: 'horizontal',
                        xAxis: {
                            min,
                            max,
                            title: xAxis || 'Value'
                        },
                        yAxis: {
                            title: yAxis || 'Distribution'
                        },
                        boxplotData: {
                            Q1: q1,
                            Q3: q3,
                            median,
                            min,
                            max
                        },
                        description: 'Box plot created in the Graphing Sandbox'
                    }
                }
            };
        }

        if (chartType === 'bar') {
            const categories = parseStringList($('graphSandboxCategoriesInput').value);
            if (categories.length === 0) {
                return { error: 'Provide at least one category label for the bar chart.' };
            }
            if (categories.length !== primary.values.length) {
                return { error: 'Number of category labels must match the number of values.' };
            }

            return {
                chartData: {
                    ...baseConfig,
                    chartType: 'bar',
                    xLabels: categories,
                    series: [
                        {
                            name: yAxis || 'Value',
                            values: primary.values
                        }
                    ],
                    chartConfig: {
                        xAxis: {
                            title: xAxis || 'Category'
                        },
                        yAxis: {
                            title: yAxis || 'Value',
                            min: 0
                        },
                        description: 'Bar chart created in the Graphing Sandbox'
                    }
                }
            };
        }

        if (chartType === 'scatter') {
            const secondary = parseNumberList($('graphSandboxSecondaryInput').value);
            if (secondary.errors.length > 0) {
                return { error: secondary.errors.join(' ') };
            }
            if (secondary.values.length !== primary.values.length) {
                return { error: 'X and Y lists must contain the same number of values.' };
            }
            const points = primary.values.map((x, index) => ({ x, y: secondary.values[index] }));

            return {
                chartData: {
                    ...baseConfig,
                    chartType: 'scatter',
                    points,
                    chartConfig: {
                        gridLines: true,
                        xAxis: {
                            title: xAxis || 'X Value'
                        },
                        yAxis: {
                            title: yAxis || 'Y Value'
                        },
                        description: 'Scatter plot created in the Graphing Sandbox'
                    }
                }
            };
        }

        return { error: 'Unsupported chart type selected.' };
    }

    function renderPreview(chartData) {
        const preview = $(previewContainerId);
        if (!preview) return;

        const chartMarkup = renderChart(chartData, chartQuestionId);
        preview.innerHTML = chartMarkup;

        const chartId = `chart-${chartQuestionId}`;
        setTimeout(() => {
            if (typeof window.renderChartNow === 'function') {
                try {
                    window.renderChartNow(chartId);
                } catch (error) {
                    console.warn('Graph sandbox chart render failed via renderChartNow, falling back to default renderer.', error);
                }
            }
        }, 0);
    }

    window.openGraphSandbox = function () {
        const modal = $(modalId);
        if (!modal) return;
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        syncControlsWithChartType();
        showMessage('', 'info');
    };

    window.closeGraphSandbox = function () {
        const modal = $(modalId);
        if (!modal) return;
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    };

    window.updateGraphSandboxPreview = function () {
        const { chartData, error } = buildChartData();
        if (error) {
            showMessage(error, 'error');
            return;
        }
        renderPreview(chartData);
        showMessage('Preview updated. The chart uses the configuration shown on the right.', 'success');
    };

    window.copyGraphSandboxJson = async function () {
        const result = buildChartData();
        if (result.error) {
            showMessage(result.error, 'error');
            return;
        }
        try {
            const json = JSON.stringify(result.chartData, null, 2);
            await navigator.clipboard.writeText(json);
            showMessage('Chart configuration copied to clipboard.', 'success');
        } catch (error) {
            console.error('Clipboard error', error);
            showMessage('Unable to copy to clipboard in this environment.', 'error');
        }
    };

    function syncControlsWithChartType() {
        const chartType = $('graphSandboxType').value;
        const secondaryGroup = $('graphSandboxSecondaryGroup');
        const categoriesGroup = $('graphSandboxCategoriesGroup');
        const histogramOptions = $('graphSandboxHistogramOptions');
        const primaryHint = $('graphSandboxPrimaryHint');
        const secondaryLabel = $('graphSandboxSecondaryLabel');
        const secondaryHint = $('graphSandboxSecondaryHint');

        secondaryGroup.hidden = chartType !== 'scatter';
        categoriesGroup.hidden = chartType !== 'bar';
        histogramOptions.hidden = chartType !== 'histogram';

        if (chartType === 'scatter') {
            primaryHint.textContent = 'Provide X-values (e.g., 1, 2, 3).';
            if (secondaryLabel) secondaryLabel.textContent = 'Y-values';
            if (secondaryHint) secondaryHint.textContent = 'Provide the same number of Y-values as X-values.';
        } else if (chartType === 'bar') {
            primaryHint.textContent = 'Provide numeric values for each category.';
        } else if (chartType === 'boxplot') {
            primaryHint.textContent = 'Provide numeric values; quartiles will be computed for you.';
        } else if (chartType === 'histogram') {
            primaryHint.textContent = 'Provide numeric values; adjust bin width to shape the histogram.';
        } else {
            primaryHint.textContent = 'Separate numbers with commas, spaces, or new lines.';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const typeSelect = $('graphSandboxType');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                syncControlsWithChartType();
                showMessage('', 'info');
            });
        }

        const modal = $(modalId);
        if (modal) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    closeGraphSandbox();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const modalEl = $(modalId);
                if (modalEl && modalEl.style.display === 'block') {
                    closeGraphSandbox();
                }
            }
        });

        syncControlsWithChartType();
    });
})();
