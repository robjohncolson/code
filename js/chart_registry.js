(function() {
    const registryList = [
        {
            key: 'histogram',
            displayName: 'Histogram',
            description: 'Bin numeric data and visualize the frequency in each interval.',
            schema: {
                kind: 'bins',
                axes: { x: { label: 'Interval' }, y: { label: 'Frequency' } },
                csv: 'interval,frequency'
            },
            renderer: 'histogram',
            defaults: {
                xLabel: 'Interval',
                yLabel: 'Frequency',
                seriesName: 'Frequency',
                orientation: 'vertical'
            }
        },
        {
            key: 'bar',
            displayName: 'Bar Chart',
            description: 'Compare categories using rectangular bars for numeric values.',
            schema: {
                kind: 'categorical',
                axes: { x: { label: 'Category' }, y: { label: 'Value' } },
                csv: 'category,value'
            },
            renderer: 'bar',
            defaults: {
                xLabel: 'Category',
                yLabel: 'Value',
                seriesName: 'Series 1',
                orientation: 'vertical'
            }
        },
        {
            key: 'pie',
            displayName: 'Pie Chart',
            description: 'Show how categorical parts contribute to the whole.',
            schema: {
                kind: 'categorical',
                axes: null,
                csv: 'category,value'
            },
            renderer: 'pie',
            defaults: {
                seriesName: 'Slices'
            }
        },
        {
            key: 'dotplot',
            displayName: 'Dot Plot',
            description: 'Plot individual numeric observations as stacked dots.',
            schema: {
                kind: 'numeric-list',
                axes: { x: { label: 'Value' }, y: null },
                csv: 'value,value,value'
            },
            renderer: 'dotplot',
            defaults: {
                xLabel: 'Value'
            }
        },
        {
            key: 'scatter',
            displayName: 'Scatter Plot',
            description: 'Display paired (x, y) data to show relationships.',
            schema: {
                kind: 'xy',
                axes: { x: { label: 'X Value' }, y: { label: 'Y Value' } },
                csv: 'x,y'
            },
            renderer: 'scatter',
            defaults: {
                xLabel: 'X Value',
                yLabel: 'Y Value'
            }
        },
        {
            key: 'boxplot',
            displayName: 'Box Plot',
            description: 'Summarize a distribution with the five-number summary.',
            schema: {
                kind: 'five-number',
                axes: { x: null, y: { label: 'Value' } },
                csv: null
            },
            renderer: 'boxplot',
            defaults: {
                yLabel: 'Value'
            }
        },
        {
            key: 'normal',
            displayName: 'Normal Curve',
            description: 'Plot a normal distribution with optional shaded region.',
            schema: {
                kind: 'distribution',
                axes: { x: { label: 'Value' }, y: null },
                csv: null
            },
            renderer: 'normal',
            defaults: {
                xLabel: 'Value'
            }
        },
        {
            key: 'chisquare',
            displayName: 'Chi-Square Curve',
            description: 'Overlay chi-square density curves for one or more degrees of freedom.',
            schema: {
                kind: 'distribution-list',
                axes: { x: { label: 'χ²' }, y: { label: 'Density' } },
                csv: null
            },
            renderer: 'chisquare',
            defaults: {
                xLabel: 'χ² Value',
                yLabel: 'Density'
            }
        },
        {
            key: 'numberline',
            displayName: 'Number Line',
            description: 'Render a custom number line with labeled ticks.',
            schema: {
                kind: 'numberline',
                axes: { x: { label: 'Number Line' }, y: null },
                csv: null
            },
            renderer: 'numberline',
            defaults: {
                xLabel: 'Value'
            }
        }
    ];

    const frozenList = registryList.map(item => Object.freeze({ ...item }));
    const registry = {};
    frozenList.forEach(item => {
        registry[item.key] = item;
    });

    window.CHART_TYPE_LIST = Object.freeze(frozenList);
    window.CHART_TYPES = Object.freeze(registry);
})();
