# Chart Wizard MVP Usage

## Launching the Wizard
- Navigate to an eligible FRQ (currently `U1-L10-Q04` and `U1-L10-Q06`).
- Click **Create Chart** (or **Edit Chart**) to open the chart wizard modal.
- The wizard is keyboard-friendly: use <kbd>Tab</kbd> to move between controls and <kbd>Enter</kbd> to activate buttons.

## Workflow Overview
1. **Chart type** – pick from the suggested chart types for the question. The suggested type is highlighted but you can choose any of the supported options (bar, histogram, pie, dotplot, scatter, box plot, normal curve, chi-square curve, number line).
2. **Data entry** – enter labels/values or points. You can paste CSV data (comma or tab-separated) and use the “Parse CSV” helper, or add rows manually. Provide axis labels, series name, and optional title/description.
3. **Preview & save** – review the rendered preview. Use **Save Chart** to persist the configuration, or **Delete** to remove the saved chart.

The chart list is driven by the read-only registry at `window.CHART_TYPE_LIST` (defined in `js/chart_registry.js`), so adding a renderer only requires updating the registry entry.

The wizard stores charts immediately in localStorage. Saved charts are rendered below the FRQ prompt and can be edited or deleted without reopening the wizard.

## Standard Internal Format (SIF)
Each chart is saved as a JSON object with the shape:

```json
{
  "type": "bar" | "histogram" | "pie" | "dotplot" | "scatter" | "boxplot" | "normal" | "chisquare" | "numberline",
  "data": {
    "categories": ["A", "B"],
    "values": [12, 8],
    "seriesName": "Series 1",
    "orientation": "vertical",
    "bins": [{ "label": "0-5", "value": 12 }],
    "slices": [{ "label": "Yes", "value": 18 }],
    "points": [{ "x": 3.2, "y": 7.5, "label": "Trial" }],
    "fiveNumber": { "min": 4, "q1": 6, "median": 8, "q3": 10, "max": 12 },
    "mean": 0,
    "sd": 1,
    "shade": { "lower": -1, "upper": 1 },
    "dfList": [4, 6],
    "labels": ["df = 4", "df = 6"],
    "ticks": [{ "x": -2, "label": "A", "bottomLabel": "-2" }]
  },
  "options": {
    "xLabel": "Order total ($)",
    "yLabel": "Frequency",
    "title": "Food truck orders",
    "description": "Histogram built from the frequency table"
  },
  "meta": {
    "version": 1,
    "createdAt": "2024-11-16T15:04:05.123Z",
    "updatedAt": "2024-11-16T15:04:05.123Z"
  }
}
```

Fields that do not apply to a chart type are omitted (for example, `dfList` appears only for chi-square curves, `ticks` only for number lines, and `bins` only for histograms).

## Storage Location
Charts are persisted offline at:

```
classData.users[USERNAME].charts[QUESTION_ID]
```

The wizard automatically creates the `charts` map when needed and calls `saveClassData()` after every save or delete.

## Submission & Sync
When you submit an answer:
- The saved chart (if any) is attached as `chart_json` in the standard submission payload.
- Railway and Supabase both receive the optional `chart_json` column, so remote storage stays in sync with local edits.
- Deleting a chart updates localStorage immediately. To clear the remote copy, submit the FRQ again after deleting.

## Tips
- Use meaningful axis labels so the preview is self-explanatory.
- CSV parsing expects `label,value` rows for histograms, a list of numbers for dotplots, and `x,y` pairs for scatterplots.
- Boxplots require the five-number summary; the wizard validates that each entry is numeric.
- All features work offline (`file://`) and reuse existing Chart.js helpers—no extra dependencies required.
