# Chart Wizard Implementation Audit

**Date**: 2024-10-28
**Task**: P1-ASSESS-WIZARD-STATE-01
**Auditor**: Project-Side Sonnet

## Executive Summary

The Chart Wizard is a comprehensive modal-based interface for creating statistical visualizations within the AP Statistics Consensus Quiz application. It supports 14 chart types and follows a step-based workflow: type selection → data entry → preview → save. The implementation is ~3,587 lines in `js/chart_wizard.js` and integrates with Chart.js for rendering.

### Current State
- **Architecture**: Self-contained IIFE (Immediately Invoked Function Expression) that exports global window functions
- **Storage**: Uses Standard Internal Format (SIF) stored in localStorage via `classData.users[username].charts[questionId]`
- **UI Pattern**: Modal overlay with multi-step wizard (Step 0: Type selection, Step 1: Data entry, Step 2: Preview)
- **Integration**: Integrates with FRQ questions marked as chart-eligible in `data/chart_questions.js`

## Supported Chart Types (14 total)

### Primary Types (shown by default)
1. **Normal Curve** - normal distribution with optional shading
2. **Histogram** - binned numeric data with frequency display
3. **Scatter Plot** - paired (x,y) data points
4. **Bar Chart** - categorical data with values
5. **Chi-Square Curve** - statistical distribution curves

### Secondary Multi Types
6. **Dot Plot** - stacked dots for numeric values
7. **Box Plot** - five-number summary visualization

### Hidden by Default (expandable "more" section)
8. **Pie Chart** - part-to-whole with circular sectors
9. **Line Chart** - connected points across categories
10. **Number Line** - labeled axis with custom ticks
11. **Doughnut Chart** - pie with center cutout
12. **Polar Area Chart** - sectors with equal angles, variable radius
13. **Bubble Chart** - (x,y,r) three-variable plot
14. **Radar Chart** - multivariate comparison on circular axes

## Architecture & Data Flow

### File Structure
```
js/
  chart_wizard.js       (3,587 lines) - Main wizard implementation
  chart_registry.js     (216 lines)   - Type definitions and schemas

data/
  chart_questions.js    (22 lines)    - Eligible FRQ questions mapping
```

### Data Flow Diagram

```
Student Action
     ↓
openChartWizard(questionId)
     ↓
Initialize wizardState
     ↓
Render Modal (Step 0: Type Selection)
     ↓
User selects chart type → applyDefaultOptionsForType()
     ↓
Step 1: Data Entry (manual table or CSV paste)
     ↓
User fills data → attachDataEntryHandlers() stores in wizardState
     ↓
Step 2: Preview (optional)
     ↓
buildSIF() creates Standard Internal Format object
     ↓
sifToChartConfig() converts to Chart.js config
     ↓
renderChartNow() via window.charts.renderChartNow()
     ↓
Save button → storeChartSIF(questionId, sif)
     ↓
localStorage: classData.users[username].charts[questionId] = sif
     ↓
window.saveClassData() persists to localStorage
```

### Integration Points

1. **Question System**
   - FRQ questions check `window.CHART_QUESTIONS[questionId]` for eligibility
   - Chart hints suggest appropriate chart types
   - `data/chart_questions.js` maps questionId → {required, chartHints, allowCategorical, prompt}

2. **Data Layer**
   - Questions contain `attachments.table` as 2D arrays (first row = headers)
   - Chart Wizard accesses embedded datasets via question structure
   - Currently NO direct dataset selection UI (data entry is manual)

3. **Rendering System**
   - Uses `window.charts.renderChartNow(chartData, canvasId)` from `js/charts.js`
   - Chart.js library handles actual rendering
   - SIF → Chart.js config conversion in `sifToChartConfig()` function

4. **Storage System**
   - Charts stored as SIF objects in `classData.users[username].charts`
   - localStorage key: `'classData'`
   - Persistence via `window.saveClassData()`

## Standard Internal Format (SIF) Structure

Each chart type has a specific SIF structure. Common fields:

```javascript
{
  type: "bar",              // Chart type key
  title: "...",
  xLabel: "Category",
  yLabel: "Frequency",
  description: "...",

  // Type-specific data
  // Bar chart example:
  series: [{
    name: "Series 1",
    values: [10, 20, 30]
  }],
  categories: ["A", "B", "C"],
  orientation: "vertical",

  meta: {
    createdAt: 1698765432000,
    updatedAt: 1698765432000
  }
}
```

### Schema Kinds (from chart_registry.js)
- `categorical` - bar charts
- `categorical-series` - line charts
- `xy` - scatter plots
- `xyr` - bubble charts (x, y, radius)
- `segments` - pie/doughnut/polar area
- `bins` - histogram
- `numeric-list` - dot plot
- `five-number` - box plot
- `distribution` - normal curve
- `distribution-list` - chi-square
- `numberline` - number line
- `categories-datasets` - radar

## Current Features

### Wizard Steps

**Step 0: Chart Type Selection**
- Grid display of chart type cards
- Shows primary types by default
- "Show more types" toggle for hidden types
- Displays FRQ inventory recommendations (if available)
- Pill badges for recommended types
- Click to select → advances to Step 1

**Step 1: Data Entry**
- Two input modes:
  1. **Manual table entry** - add/remove rows with input fields
  2. **CSV paste** - textarea for pasting CSV data
- Type-specific fields (e.g., bar has label+value, scatter has x+y+label)
- Chart-specific options (e.g., scatter regression line, normal shading)
- Add row / Remove row buttons
- For radar: Add/remove datasets
- Real-time validation (minimal)

**Step 2: Preview (implicit)**
- Preview shown when advancing from data entry
- Uses Chart.js to render actual chart
- Preview actions: Edit data, Delete chart

### FRQ Inventory Integration

- Loads `docs/analysis/frq_chart_inventory.json` asynchronously
- Provides intelligent chart type recommendations based on question analysis
- Falls back gracefully if inventory unavailable
- Maps questionId → {id, chartType, types[], subFlags, subFlagsByType}

### Current Bar Chart Implementation

From `js/chart_wizard.js` lines 1528-1535:

```javascript
if (selectedType === 'bar') {
    if (!wizardState.barSeriesName) {
        wizardState.barSeriesName = defaults.seriesName || 'Series 1';
    }
    if (!wizardState.barOrientation) {
        wizardState.barOrientation = defaults.orientation || 'vertical';
    }
}
```

**Current capabilities**:
- Manual data entry (label + value pairs)
- Series name configuration
- Orientation toggle (vertical/horizontal)
- CSV paste support

**Missing capabilities** (per project requirements):
- ❌ No variable type detection (categorical vs quantitative)
- ❌ No count vs relative frequency toggle
- ❌ No sort options (alphabetical or by frequency)
- ❌ No automatic column selection from embedded datasets
- ❌ No data preview before charting
- ❌ No copyable figure caption generation

## Current Issues & Gaps

### 1. No Embedded Dataset Selection
- Students must **manually type** data from question tables
- No UI to select columns from `attachments.table`
- High friction, prone to transcription errors
- **Impact**: Does not meet 60-second goal

### 2. No Variable Type Detection
- No distinction between categorical vs quantitative variables
- Students must infer correct chart type
- No inline guidance on variable types
- **Impact**: Students may choose inappropriate chart types

### 3. Limited Bar Chart Functionality
- No count calculation from categorical data
- No relative frequency conversion
- No sorting options
- **Impact**: Cannot meet "bar chart with counts & relative frequency" requirement

### 4. No Data Preview
- Students enter data blind without seeing what they're plotting
- Preview only shown after full data entry
- No feedback during data selection
- **Impact**: Increases errors and time-to-chart

### 5. No Caption Generation
- Charts created without proper figure captions
- Students must write captions manually
- No standardized caption format
- **Impact**: Missing requirement for "copyable figure caption"

### 6. Minimal Data Validation
- No type checking (numbers vs strings)
- No range validation
- Minimal error messages
- **Impact**: Crashes possible with malformed data

### 7. CSV Parsing Limitations
- Basic CSV parsing (split on commas/newlines)
- No handling of quoted fields
- No error recovery
- **Impact**: Student CSV paste may fail silently

## Chart.js Integration

### Renderer Functions (inferred from code)

Located in `js/chart_registry.js` and referenced as:
- `window.renderBar()` - not directly visible, but referenced
- Actual rendering delegated to `window.charts.renderChartNow()`

### Dependencies
- Chart.js 3.9.1 (from CLAUDE.md)
- No custom Chart.js plugins visible in audit
- Uses default Chart.js chart types

## Code Quality Observations

### Strengths
✅ Well-structured wizard state management
✅ Comprehensive chart type support (14 types)
✅ Graceful fallbacks for missing dependencies
✅ Clean separation of concerns (wizard logic, SIF, rendering)
✅ Accessible keyboard navigation
✅ Dark mode support via CSS custom properties

### Weaknesses
⚠️ File size (3,587 lines) - difficult to maintain
⚠️ Minimal input validation
⚠️ No unit tests visible
⚠️ Inline event handlers (e.g., `onclick="openChartWizard('${questionId}')"`)
⚠️ Large wizard state object with many chart-specific properties
⚠️ No error boundary for Chart.js rendering failures

## Performance Characteristics

- **Modal load time**: <50ms (styles injected once)
- **Render time**: Depends on Chart.js (typically <100ms for small datasets)
- **Storage impact**: Minimal (SIF objects are compact JSON)
- **Memory**: Wizard state held in closure, cleaned on close

## Browser Compatibility

- Requires ES6: `const`, `let`, arrow functions, template literals, async/await
- Uses modern DOM APIs: `querySelectorAll`, `classList`, `addEventListener`
- CSS Grid for layout
- No apparent polyfills for older browsers

## Recommendations for Enhancement

Based on audit findings, the following enhancements align with project requirements:

### High Priority (Must-Have)
1. **Variable Type Detection System** → P3-IMPL-VARIABLE-TYPING-01
   - Detect categorical vs quantitative from table data
   - Add type badges/indicators to UI

2. **Column Selector UI** → P4-UI-SEARCHABLE-PICKER-01
   - Allow selecting columns from `attachments.table`
   - Searchable dropdown for tables with many columns

3. **Data Preview Component** → P4-UI-DATA-PREVIEW-02
   - Show first 10 rows of selected data
   - Highlight selected columns

4. **Bar Chart Enhancements** → P3-IMPL-BAR-CHART-COUNTS-03, P3-IMPL-BAR-CHART-RELATIVE-04
   - Calculate counts from categorical data
   - Toggle between counts and relative frequencies
   - Add sort options (alphabetical, frequency ascending/descending)

5. **Input Validation** → P2-FIX-DATA-VALIDATION-03
   - Type checking (ensure numbers are numeric)
   - Range validation
   - Clear error messages

### Medium Priority
6. **Caption Generator** → P3-IMPL-CAPTION-GENERATOR-06
   - Auto-generate figure captions
   - Copy-to-clipboard functionality

7. **Bug Fixes** → P2-FIX-BLOCKING-ERRORS-01, P2-FIX-CONSOLE-ERRORS-02
   - Fix crashes and console errors (to be identified in bug inventory)

### Low Priority (Future)
8. **Code Refactoring**
   - Split chart_wizard.js into modules
   - Extract chart-specific logic into separate files
   - Add unit tests

## Appendix: Key Functions

### Global Exports (window.*)
- `window.openChartWizard(questionId)` - Opens wizard for a question
- `window.renderChartWizardPreview(questionId)` - Renders saved chart preview
- `window.deleteChartForQuestion(questionId)` - Deletes saved chart
- `window.convertChartSIFToChartData(sif)` - Converts SIF to Chart.js config

### Internal Key Functions
- `injectStyles()` - Injects wizard CSS once
- `buildFallbackTypeGroups(existingType)` - Generates type selection groups
- `attachEventHandlers(body, footer)` - Wires up wizard event listeners
- `attachDataEntryHandlers(body)` - Handles data input events
- `buildSIF()` - Constructs SIF object from wizard state
- `sifToChartConfig(sif)` - Converts SIF to Chart.js config
- `storeChartSIF(questionId, sif)` - Saves chart to localStorage
- `getStoredChartSIF(questionId)` - Retrieves saved chart

### State Management
- `wizardState` - Global wizard state object (closure variable)
- Properties include: `questionId`, `chartType`, `step`, `bar`, `histogram`, `scatter`, etc.

## Conclusion

The Chart Wizard is a functional but incomplete implementation. It provides a solid foundation for chart creation but lacks key features needed for the enhanced student experience:
- No automated dataset selection
- No variable type detection
- Limited bar chart capabilities
- No data preview
- No caption generation

The planned enhancements will transform the wizard from a manual data entry tool into an intelligent, student-friendly visualization builder that meets the 60-second creation goal.

---

**Next Steps**:
1. Create bug inventory (P1-ASSESS-BUG-INVENTORY-02)
2. Document embedded dataset structures (P1-ASSESS-DATA-STRUCTURE-03)
3. Begin stabilization phase (P2)
