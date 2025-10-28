# Chart Wizard Bug Inventory

**Date**: 2024-10-28
**Task**: P1-ASSESS-BUG-INVENTORY-02
**Auditor**: Project-Side Sonnet

## Summary

This document catalogs all identified bugs, issues, and potential crashes in the Chart Wizard implementation. Bugs are categorized by severity: **Blocking** (prevents functionality), **High** (causes errors/crashes), **Medium** (UX issues), and **Low** (minor inconsistencies).

**Total Bugs Identified**: 15
- Blocking: 3
- High: 5
- Medium: 4
- Low: 3

---

## BLOCKING BUGS (Must Fix)

### BUG-001: Null Reference Errors on Boxplot Initialization
**Severity**: Blocking
**Location**: `js/chart_wizard.js:2566`
**Component**: Boxplot data entry

**Description**:
```javascript
const { min, q1, median, q3, max } = wizardState.boxplot;
```
If `wizardState.boxplot` is undefined or null, this destructuring assignment throws a TypeError, crashing the wizard.

**Reproduction Steps**:
1. Open Chart Wizard
2. Select "Box Plot" type
3. If `wizardState.boxplot` not initialized → crash

**Expected Behavior**: Wizard should initialize boxplot data structure with empty strings.

**Actual Behavior**: TypeError: Cannot destructure property 'min' of 'undefined'

**Fix Priority**: P0 (Blocks boxplot functionality)

---

### BUG-002: Null Reference on Normal Distribution Initialization
**Severity**: Blocking
**Location**: `js/chart_wizard.js:3005`
**Component**: Normal curve data entry

**Description**:
```javascript
const { mean, sd, xMin, xMax, tickInterval, shadeLower, shadeUpper } = wizardState.normal;
```
Same issue as BUG-001 - destructuring undefined object crashes wizard.

**Reproduction Steps**:
1. Open Chart Wizard
2. Select "Normal Curve"
3. If `wizardState.normal` not initialized → crash

**Expected Behavior**: Initialize normal data with default values (mean=0, sd=1)

**Actual Behavior**: TypeError

**Fix Priority**: P0

---

### BUG-003: Chi-Square Settings Not Initialized
**Severity**: Blocking
**Location**: `js/chart_wizard.js:3047-3052`
**Component**: Chi-square curve

**Description**:
```javascript
const settings = wizardState.chisquareSettings;
if (settings.xMin !== '') chartConfig.xMin = parseFloat(settings.xMin);
```
Accessing properties of potentially undefined `chisquareSettings` object.

**Reproduction Steps**:
1. Select Chi-Square curve
2. Attempt to configure settings → crash

**Expected Behavior**: Initialize with empty settings object

**Actual Behavior**: TypeError: Cannot read property 'xMin' of undefined

**Fix Priority**: P0

---

## HIGH SEVERITY BUGS

### BUG-004: Number Line Range Undefined Access
**Severity**: High
**Location**: `js/chart_wizard.js:3075-3078`
**Component**: Number line

**Description**:
```javascript
const range = wizardState.numberlineRange;
if (range.min !== '') data.xMin = parseFloat(range.min);
```
If `numberlineRange` is undefined, accessing `range.min` throws error.

**Reproduction Steps**:
1. Select "Number Line" chart type
2. Try to set range → potential crash

**Fix Priority**: P0

---

### BUG-005: Unsafe ParseFloat Without NaN Validation
**Severity**: High
**Location**: Multiple locations (3015-3017, 3049-3052, 3077-3078)
**Component**: All numeric input parsing

**Description**:
Values parsed with `parseFloat()` are used without checking if result is NaN. This can lead to invalid chart data being passed to Chart.js, causing rendering failures.

**Example**:
```javascript
if (xMin !== '') chartConfig.xMin = parseFloat(xMin);  // Could be NaN
```

**Reproduction Steps**:
1. Enter non-numeric text in any numeric field (e.g., "abc" in mean)
2. Values pass through as NaN
3. Chart rendering fails silently or displays incorrect data

**Expected Behavior**: Validate parseFloat result is valid number, show error if not

**Actual Behavior**: Invalid data passed to Chart.js

**Fix Priority**: P0 (affects all numeric charts)

---

### BUG-006: Array Index Out of Bounds in Category Mapping
**Severity**: High
**Location**: `js/chart_wizard.js:3118-3133`
**Component**: Bar/Line chart SIF conversion

**Description**:
When mapping categories to series values, code assumes array indices align:
```javascript
valuesArray.forEach((entry, index) => {
    if (categories[index]) {  // What if categories array is shorter?
        categorySet.add(categories[index]);
    }
});
```
If `values` array is longer than `categories`, undefined categories get created.

**Reproduction Steps**:
1. Create bar chart with 5 values but only 3 category labels
2. Categories array accessed beyond bounds
3. Fallback creates "Category 4", "Category 5" labels

**Expected Behavior**: Either require matching lengths or handle gracefully

**Actual Behavior**: Silent creation of generic categories

**Fix Priority**: P1

---

### BUG-007: Radar Dataset Values Not Initialized
**Severity**: High
**Location**: `js/chart_wizard.js:1641-1647`
**Component**: Radar chart data entry

**Description**:
```javascript
if (!Array.isArray(wizardState.radarDatasets[datasetIndex].values)) {
    wizardState.radarDatasets[datasetIndex].values = [];
}
wizardState.radarDatasets[datasetIndex].values[index] = target.value;
```
Defensive check exists but parent `radarDatasets[datasetIndex]` may be undefined.

**Reproduction Steps**:
1. Select radar chart
2. Try to enter values before datasets properly initialized

**Fix Priority**: P1

---

### BUG-008: CSV Text Not Cleared Between Chart Types
**Severity**: High
**Location**: `js/chart_wizard.js` (wizardState management)
**Component**: CSV paste functionality

**Description**:
When switching between chart types, `wizardState.csvText` persists from previous type. This can cause confusion or parsing errors when CSV format differs between types.

**Reproduction Steps**:
1. Select bar chart, paste CSV data
2. Switch to scatter plot
3. Old bar CSV data still in textarea
4. Format mismatch causes parsing errors

**Expected Behavior**: Clear or warn about CSV format change

**Actual Behavior**: Stale CSV data persists

**Fix Priority**: P1

---

## MEDIUM SEVERITY BUGS

### BUG-009: No Validation for Empty Chart Data
**Severity**: Medium
**Location**: Multiple chart type handlers in `buildSIF()`
**Component**: All charts

**Description**:
Many chart types only check if arrays are empty but don't validate data quality:
```javascript
if (rows.length === 0) { ... }  // But what if all values are empty strings?
```

**Reproduction Steps**:
1. Add rows to bar chart but leave all values empty
2. `rows.length > 0` passes check
3. Chart has no meaningful data

**Expected Behavior**: Validate at least one row has non-empty, valid data

**Actual Behavior**: Allows creation of empty charts

**Fix Priority**: P1

---

### BUG-010: Inline Event Handlers Break CSP
**Severity**: Medium
**Location**: `js/chart_wizard.js:3561-3562`
**Component**: Chart preview buttons

**Description**:
```javascript
<button type="button" onclick="openChartWizard('${questionId}')">Edit</button>
<button type="button" onclick="deleteChartForQuestion('${questionId}')">Delete</button>
```
Inline onclick handlers violate Content Security Policy if enabled and are bad practice.

**Reproduction Steps**:
1. Enable strict CSP
2. Inline handlers blocked
3. Edit/Delete buttons don't work

**Expected Behavior**: Use addEventListener pattern

**Actual Behavior**: CSP violation, buttons non-functional

**Fix Priority**: P2 (only if CSP enabled)

---

### BUG-011: No Error Recovery from Chart.js Rendering Failures
**Severity**: Medium
**Location**: `js/chart_wizard.js:2741-2746, 3571-3576`
**Component**: Chart preview rendering

**Description**:
```javascript
try {
    window.charts.renderChartNow(chartConfig, canvasId);
} catch (error) {
    console.warn('Chart preview failed:', error);
}
```
Error caught but no user feedback. Preview container remains empty with no explanation.

**Reproduction Steps**:
1. Create chart with data that causes Chart.js error
2. Preview fails silently
3. User sees blank preview with no error message

**Expected Behavior**: Show error message in preview container

**Actual Behavior**: Silent failure, console warning only

**Fix Priority**: P2

---

### BUG-012: Wizard Modal Not Keyboard-Accessible on Close
**Severity**: Medium
**Location**: Chart wizard modal implementation
**Component**: Modal close functionality

**Description**:
While wizard has keyboard navigation, there's no documented Escape key to close modal. Users must click close button.

**Reproduction Steps**:
1. Open wizard
2. Press Escape → nothing happens
3. Must use mouse to close

**Expected Behavior**: Escape key closes modal

**Actual Behavior**: No keyboard close shortcut

**Fix Priority**: P2 (accessibility)

---

## LOW SEVERITY BUGS

### BUG-013: Inconsistent Error Message Formatting
**Severity**: Low
**Location**: Multiple locations in `buildSIF()`
**Component**: Error display

**Description**:
Error messages set in `wizardState.error` have inconsistent formatting:
- Some end with periods, others don't
- Some use "Provide X", others use "Add X"
- Inconsistent capitalization

**Example**:
```javascript
wizardState.error = 'Add at least one category with a numeric value.';
wizardState.error = 'Provide positive numeric degrees of freedom.';
```

**Expected Behavior**: Consistent error message style

**Actual Behavior**: Mixed styles

**Fix Priority**: P3

---

### BUG-014: No Loading State During FRQ Inventory Fetch
**Severity**: Low
**Location**: `js/chart_wizard.js:358-410`
**Component**: FRQ inventory loading

**Description**:
When fetching `docs/analysis/frq_chart_inventory.json`, there's no loading indicator. User sees nothing until fetch completes or fails.

**Reproduction Steps**:
1. Open wizard with slow network
2. No indication of data loading
3. Recommendations appear suddenly

**Expected Behavior**: Show loading spinner or "Loading recommendations..."

**Actual Behavior**: No feedback

**Fix Priority**: P3

---

### BUG-015: Redundant Type Information in Preview
**Severity**: Low
**Location**: `js/chart_wizard.js:2712`
**Component**: Preview header

**Description**:
```javascript
<div style="font-size:0.85rem;color:rgba(0,0,0,0.6);">${chartData.type.toUpperCase()} · ${wizardState.questionId}</div>
```
Shows both chart type and question ID in preview, which is redundant and clutters UI.

**Expected Behavior**: Show only one identifier

**Actual Behavior**: Shows both

**Fix Priority**: P3

---

## ISSUES NOT YET TESTED (Manual Testing Required)

These potential issues require browser testing to confirm:

1. **CSV Parsing Edge Cases**
   - Quoted fields with commas
   - Escaped quotes
   - Empty lines
   - Different line endings (CRLF vs LF)

2. **Browser Compatibility**
   - Safari: ES6 features
   - Firefox: CSS Grid
   - Edge: Chart.js rendering

3. **Mobile Responsiveness**
   - Touch targets for add/remove buttons
   - Modal scrolling on small screens
   - Keyboard focus on mobile

4. **Performance**
   - Large datasets (100+ rows)
   - Many radar datasets
   - Chart rendering time

5. **LocalStorage Edge Cases**
   - Quota exceeded
   - Corrupted data
   - Schema migration failures

---

## Root Causes Analysis

### Pattern 1: Missing Null/Undefined Checks
**Affected Bugs**: BUG-001, BUG-002, BUG-003, BUG-004, BUG-007

**Root Cause**: Wizard state initialization doesn't guarantee all nested objects exist before destructuring or property access.

**Systematic Fix**:
```javascript
// Bad
const { min, max } = wizardState.boxplot;

// Good
const boxplot = wizardState.boxplot || {};
const { min, max } = boxplot;
```

---

### Pattern 2: Weak Data Validation
**Affected Bugs**: BUG-005, BUG-009

**Root Cause**: Input values converted to numbers without validating conversion success. Empty/invalid data allowed through.

**Systematic Fix**:
```javascript
// Add validation helper
function parseValidNumber(value, errorMsg) {
    const num = parseFloat(value);
    if (value === '' || isNaN(num)) {
        throw new Error(errorMsg);
    }
    return num;
}
```

---

### Pattern 3: Silent Failures
**Affected Bugs**: BUG-011

**Root Cause**: Errors caught but not communicated to user.

**Systematic Fix**: Always show user-friendly error messages in UI, not just console.

---

## Test Data for Reproduction

Create test datasets for bug verification:

```javascript
// Edge case datasets
const testData = {
    emptyValues: { labels: ['A', 'B'], values: ['', ''] },
    nonNumeric: { labels: ['A', 'B'], values: ['abc', '10'] },
    mismatchedLengths: { labels: ['A'], values: [10, 20, 30] },
    nullValues: { labels: ['A', null], values: [10, null] },
    specialChars: { labels: ['A"B', 'C,D'], values: [10, 20] }
};
```

---

## Recommended Fix Order

**Phase 1 (Blocking - Day 1)**:
1. BUG-001: Boxplot initialization
2. BUG-002: Normal curve initialization
3. BUG-003: Chi-square settings initialization
4. BUG-004: Number line range initialization

**Phase 2 (High - Day 2)**:
5. BUG-005: Add parseValidNumber helper, apply everywhere
6. BUG-007: Radar dataset safety checks
7. BUG-008: Clear CSV on type change
8. BUG-006: Array bounds checking

**Phase 3 (Medium - Day 3)**:
9. BUG-009: Enhanced data validation
10. BUG-011: User-facing error messages
11. BUG-010: Replace inline handlers (if CSP needed)
12. BUG-012: Add Escape key handler

**Phase 4 (Low - Optional)**:
13. BUG-013: Standardize error messages
14. BUG-014: Loading indicators
15. BUG-015: Simplify preview header

---

## Next Steps

1. ✅ Bug inventory complete
2. ⏳ Begin P2-FIX-BLOCKING-ERRORS-01 (fix bugs 001-004)
3. ⏳ Manual browser testing to confirm suspected issues
4. ⏳ Create unit tests to prevent regressions

---

**Sign-off**: This inventory represents static code analysis findings. Manual testing will reveal additional issues, particularly around user interaction flows and edge cases.
