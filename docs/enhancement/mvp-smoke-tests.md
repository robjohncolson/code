# Chart Wizard MVP - Smoke Test Checklist

**Date**: 2025-10-28
**Version**: MVP v1.0
**Scope**: 6 core enhancement tasks (P2-P4)

## Executive Summary

This document provides a lightweight QA checklist for verifying the Chart Wizard MVP enhancements. All tests should complete without console errors and within the 60-second usability goal.

---

## Pre-Test Setup

### Requirements
- Browser: Chrome, Firefox, Safari, or Edge (modern versions with ES6 support)
- Test environment: Local development server or static file host
- Test data: Use questions with embedded `attachments.table` datasets

### Recommended Test Questions

From `data/curriculum.js`, use questions with embedded datasets:

1. **U1-L2-Q01**: Roller coaster data (6 columns: Length, Type, Speed, Height, Drop, Continent)
   - Mixed categorical and quantitative
   - 8 rows of data
   - Good for testing type detection

2. **U1-L3-Q01**: Ice cream flavors (2 columns: Flavor, Frequency)
   - Perfect bar chart candidate
   - Categorical + count data
   - 6 rows

3. **U2-PC-MCQ-B-Q15**: Age vs Net Worth scatterplot data
   - Quantitative variables
   - Tests non-bar chart eligibility

### Opening the Test Environment

```bash
# Start local server
cd /mnt/c/Users/rober/OneDrive/Desktop/code
python -m http.server 8000

# Navigate to: http://localhost:8000/index.html
```

---

## Core Workflow Tests

### Test 1: Basic Bar Chart Creation (Happy Path)

**Goal**: Create a bar chart from embedded dataset in <60 seconds with zero errors.

**Steps**:
1. Navigate to question U1-L3-Q01 (Ice cream flavors)
2. Click "Add Chart" or "Edit Chart" button
3. Verify Chart Wizard modal opens
4. Select "Bar Chart" from type selector
5. **Verify**: Column picker appears with searchable dropdown
6. **Verify**: Two columns visible: "Flavor" (📊 categorical), "Frequency" (🔢 quantitative)
7. Click "Flavor" column
8. **Verify**: Data preview appears showing first 10 rows
9. **Verify**: Preview shows "Vanilla", "Chocolate", "Strawberry", etc.
10. **Verify**: Bar chart auto-fills with 6 categories and counts
11. **Verify**: Manual data entry section appears below with "— OR —" divider
12. Click "Preview" or "Next"
13. **Verify**: Chart renders correctly with all 6 flavors
14. Click "Save Chart"
15. **Verify**: Chart saves to localStorage
16. **Verify**: Preview appears in question area

**Expected Results**:
- ✅ No console errors
- ✅ Workflow completes in <60 seconds
- ✅ Chart accurately represents data
- ✅ Preview shows correct categories and values

**Console Check**:
```javascript
// Verify chart stored correctly
const username = localStorage.getItem('username');
const classData = JSON.parse(localStorage.getItem('classData'));
console.log(classData.users[username].charts['U1-L3-Q01']);
// Should show SIF object with type: "bar", categories, series
```

---

### Test 2: Column Search and Filtering

**Goal**: Verify column search functionality works correctly.

**Steps**:
1. Open Chart Wizard for U1-L2-Q01 (Roller coaster data - 6 columns)
2. Select "Bar Chart"
3. **Verify**: Column picker shows 6 columns
4. Type "Type" in search box
5. **Verify**: Only "Type" column visible
6. Type "Height" in search box
7. **Verify**: Only "Height" column visible (but grayed out if not categorical)
8. Clear search box
9. **Verify**: All 6 columns reappear

**Expected Results**:
- ✅ Search filters columns in real-time
- ✅ No console errors during typing
- ✅ Column visibility updates immediately

---

### Test 3: Variable Type Detection

**Goal**: Verify type inference system correctly identifies column roles.

**Steps**:
1. Open Chart Wizard for U1-L2-Q01 (Roller coaster data)
2. Select "Bar Chart"
3. **Verify column badges**:
   - "Type" → 📊 Categorical (Steel/Wood)
   - "Continent" → 📊 Categorical (Asia/Europe/North America)
   - "Length (feet)" → 🔢 Quantitative (numeric with commas)
   - "Speed (miles per hour)" → 🔢 Quantitative
   - "Height (feet)" → 🔢 Quantitative
   - "Drop (feet)" → 🔢 Quantitative

**Expected Results**:
- ✅ Categorical columns show 📊 icon
- ✅ Quantitative columns show 🔢 icon
- ✅ Confidence scores visible in column meta
- ✅ Cardinality counts accurate

**Manual Verification**:
```javascript
// In browser console after opening wizard
const tableData = [
  ["Type", "Length (feet)", "Speed (miles per hour)"],
  ["Steel", "8,133", "95"],
  ["Wood", "7,359", "65"],
  // ... etc
];

const headers = tableData[0];
const rows = tableData.slice(1);
const typeColumn = rows.map(r => r[0]);

// Test type detection
const profile = inferColumnRole(typeColumn, "Type");
console.log(profile);
// Should show: { role: 'categorical', confidence: ~0.9, cardinality: 2 }
```

---

### Test 4: Data Validation and Edge Cases

**Goal**: Verify validation system handles missing/invalid data gracefully.

**Steps**:
1. Create test question with problematic data:
   ```javascript
   attachments: {
     table: [
       ["Category", "Value"],
       ["A", "10"],
       ["B", ""],        // Empty value
       ["C", "N/A"],     // Invalid marker
       ["", "20"],       // Empty category
       ["D", "abc"]      // Non-numeric in numeric column
     ]
   }
   ```
2. Open Chart Wizard and select "Bar Chart"
3. Select "Category" column
4. **Verify**: Validation notes appear (e.g., "25% empty (1/4)")
5. **Verify**: Preview shows empty cells as `<em>empty</em>`
6. **Verify**: Invalid values handled gracefully

**Expected Results**:
- ✅ Validation warnings displayed
- ✅ No crashes on invalid data
- ✅ Empty cells rendered safely
- ✅ Invalid markers detected (N/A, --, null)

---

### Test 5: Count Computation and Top-N Aggregation

**Goal**: Verify count computation and "Other" bucket creation.

**Steps**:
1. Create test question with high-cardinality categorical data (>12 unique values)
2. Open Chart Wizard, select "Bar Chart"
3. Select the high-cardinality column
4. **Verify**: Only top 12 categories shown
5. **Verify**: "Other" category appears with aggregated count
6. **Verify**: Counts are sorted descending (highest first)

**Manual Test Data**:
```javascript
attachments: {
  table: [
    ["State"],
    ["California"], ["Texas"], ["Florida"], ["New York"],
    ["Pennsylvania"], ["Illinois"], ["Ohio"], ["Georgia"],
    ["North Carolina"], ["Michigan"], ["New Jersey"], ["Virginia"],
    ["Washington"], ["Arizona"], ["Massachusetts"] // 15 states total
  ]
}
```

**Expected Results**:
- ✅ Top 12 states displayed
- ✅ "Other" bucket aggregates remaining 3
- ✅ Counts accurate (all = 1 in this case)
- ✅ Descending sort order

---

### Test 6: Switch Columns and Clear Selection

**Goal**: Verify column switching works without errors.

**Steps**:
1. Open Chart Wizard for U1-L2-Q01 (Roller coaster data)
2. Select "Bar Chart"
3. Click "Type" column
4. **Verify**: Data preview shows Steel/Wood values
5. **Verify**: Bar chart auto-fills with 2 categories
6. Click "Continent" column
7. **Verify**: Data preview updates to show Asia/Europe/North America
8. **Verify**: Bar chart auto-fills with 3 categories (overwrites previous)
9. Click "Type" again
10. **Verify**: Bar chart reverts to 2 categories

**Expected Results**:
- ✅ No console errors on column switch
- ✅ Data preview updates correctly
- ✅ Bar chart data resets each time
- ✅ No stale state from previous selection

---

### Test 7: Manual Entry Fallback

**Goal**: Verify manual data entry still works when column picker not used.

**Steps**:
1. Open Chart Wizard for any question
2. Select "Bar Chart"
3. **Ignore** column picker
4. Scroll to manual data entry section (below "— OR —" divider)
5. Click "Add Row"
6. Enter label "Test A", value "10"
7. Click "Add Row"
8. Enter label "Test B", value "20"
9. Preview chart
10. **Verify**: Chart shows 2 bars with correct values

**Expected Results**:
- ✅ Manual entry still functional
- ✅ Column picker and manual entry independent
- ✅ Can use either method

---

### Test 8: Destroy Wizard and State Cleanup

**Goal**: Verify wizard cleanup doesn't leave errors or memory leaks.

**Steps**:
1. Open Chart Wizard
2. Select "Bar Chart"
3. Select a column (triggers data preview and auto-fill)
4. Click "Cancel" or close button (X)
5. **Verify**: Modal disappears
6. **Verify**: No console errors
7. Re-open Chart Wizard
8. **Verify**: State reset (no previous selections)
9. **Verify**: Column picker loads fresh

**Expected Results**:
- ✅ Clean modal dismissal
- ✅ No lingering event listeners
- ✅ Fresh state on reopen
- ✅ No console errors

---

## Edge Case Tests

### Test 9: No Embedded Dataset

**Goal**: Verify graceful degradation when question lacks `attachments.table`.

**Steps**:
1. Open Chart Wizard for question without embedded data
2. Select "Bar Chart"
3. **Verify**: Column picker shows message "No suitable columns found in question data."
4. **Verify**: Manual data entry section still visible and functional

**Expected Results**:
- ✅ No crash
- ✅ Helpful message displayed
- ✅ Manual entry still works

---

### Test 10: Empty Dataset

**Goal**: Verify handling of dataset with headers but no data rows.

**Steps**:
1. Test with dataset:
   ```javascript
   attachments: {
     table: [
       ["Column1", "Column2"]  // Headers only, no data rows
     ]
   }
   ```
2. Open Chart Wizard, select "Bar Chart"
3. **Verify**: Column picker shows columns
4. Click a column
5. **Verify**: Data preview shows "0 rows" message
6. **Verify**: Bar chart auto-fill handles empty data gracefully

**Expected Results**:
- ✅ No crash
- ✅ Empty state handled
- ✅ Validation report shows 100% null

---

### Test 11: All Null Values

**Goal**: Verify handling of column with all empty/null values.

**Steps**:
1. Test with dataset:
   ```javascript
   attachments: {
     table: [
       ["Category", "Value"],
       ["", ""],
       ["", ""],
       ["", ""]
     ]
   }
   ```
2. Select "Category" column
3. **Verify**: Validation warning "100% empty"
4. **Verify**: No crash

**Expected Results**:
- ✅ Validation report accurate
- ✅ No rendering errors
- ✅ Helpful warning message

---

### Test 12: Mixed Type Column (Numeric with Text)

**Goal**: Verify type detection handles ambiguous columns.

**Steps**:
1. Test with dataset:
   ```javascript
   attachments: {
     table: [
       ["ID"],
       ["1"],
       ["2"],
       ["N/A"],
       ["3"]
     ]
   }
   ```
2. Select "ID" column
3. **Verify**: Type detected as categorical (numeric codes with low cardinality)
4. **Verify**: Confidence score < 1.0
5. **Verify**: Note indicates "Numeric codes with low cardinality"

**Expected Results**:
- ✅ Correctly categorized as categorical
- ✅ Note explains reasoning
- ✅ N/A handled as category

---

## Performance Tests

### Test 13: Large Dataset (100+ Rows)

**Goal**: Verify performance with large embedded datasets.

**Steps**:
1. Create test question with 100+ row dataset
2. Open Chart Wizard, select "Bar Chart"
3. Select a column
4. **Verify**: Data preview shows first 10 rows only
5. **Verify**: "... 90 more rows" indicator visible
6. **Verify**: Count computation completes in <1 second
7. **Verify**: Chart renders smoothly

**Expected Results**:
- ✅ Preview truncation works (max 10 rows)
- ✅ Count aggregation fast (<1s)
- ✅ No UI freezing
- ✅ Smooth chart rendering

---

### Test 14: High Cardinality (50+ Unique Categories)

**Goal**: Verify top-N aggregation with many unique values.

**Steps**:
1. Create dataset with 50+ unique categorical values
2. Select column
3. **Verify**: Top 12 categories shown
4. **Verify**: "Other" bucket aggregates remaining 38+
5. **Verify**: Count accurate

**Expected Results**:
- ✅ Top-N logic works
- ✅ "Other" count = sum of remaining categories
- ✅ No performance issues

---

## Browser Compatibility Tests

### Test 15: Cross-Browser Verification

**Goal**: Verify Chart Wizard works in all modern browsers.

**Browsers to Test**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Steps** (repeat for each browser):
1. Run Test 1 (Basic Bar Chart Creation)
2. **Verify**: No console errors
3. **Verify**: CSS renders correctly (column picker, data preview)
4. **Verify**: Event handlers work (search, click)

**Expected Results**:
- ✅ Consistent behavior across browsers
- ✅ No CSS layout issues
- ✅ All features functional

---

## Regression Tests

### Test 16: Other Chart Types Still Work

**Goal**: Verify existing chart types unaffected by enhancements.

**Chart Types to Test**:
1. Histogram
2. Scatter Plot
3. Normal Curve
4. Pie Chart
5. Box Plot

**Steps** (for each type):
1. Open Chart Wizard
2. Select chart type
3. Enter sample data manually
4. Preview chart
5. **Verify**: Renders correctly
6. **Verify**: No console errors
7. **Verify**: Save/load works

**Expected Results**:
- ✅ All 14 chart types still functional
- ✅ No regressions introduced
- ✅ Manual data entry still works for all types

---

## Accessibility Tests

### Test 17: Keyboard Navigation

**Goal**: Verify wizard is keyboard-accessible.

**Steps**:
1. Open Chart Wizard
2. Use Tab key to navigate
3. **Verify**: Focus visible on all interactive elements
4. **Verify**: Search input accepts keyboard input
5. **Verify**: Column options clickable via Enter/Space
6. **Verify**: Modal dismissible via Escape (if implemented)

**Expected Results**:
- ✅ Full keyboard navigation
- ✅ Visible focus indicators
- ✅ No keyboard traps

---

### Test 18: Screen Reader Compatibility

**Goal**: Verify basic screen reader support.

**Steps** (with screen reader enabled):
1. Open Chart Wizard
2. **Verify**: Chart type labels announced
3. **Verify**: Column picker labels announced
4. **Verify**: Search input has aria-label
5. **Verify**: Data preview table has proper headers

**Expected Results**:
- ✅ Semantic HTML used
- ✅ ARIA labels where needed
- ✅ Table structure accessible

---

## Console Error Monitoring

### Zero Tolerance Error List

The following console errors should **NEVER** appear:

❌ **Blocking Errors** (must fix immediately):
- `TypeError: Cannot read property 'X' of undefined`
- `TypeError: Cannot destructure property 'X' of 'undefined'`
- `ReferenceError: X is not defined`
- `Uncaught Error: ...`

⚠️ **Warnings** (acceptable but should minimize):
- `[Chart Wizard] Invalid selector: ...` (from warnOnce)
- `[Chart Wizard] Chart preview failed: ...` (from try-catch)

✅ **Allowed**:
- Info logs from Chart.js library
- Network warnings (expected when offline)

---

## Testing Checklist Summary

Use this quick checklist for each code change:

```
[ ] Test 1: Basic bar chart creation (U1-L3-Q01)
[ ] Test 2: Column search functionality
[ ] Test 3: Variable type detection accuracy
[ ] Test 6: Switch columns without errors
[ ] Test 8: Destroy wizard cleanly
[ ] Console: Zero blocking errors
[ ] Console: Zero new warnings
[ ] Performance: <60 second workflow
[ ] Regression: Other chart types still work
```

---

## Automated Testing (Future)

**Not implemented yet**, but recommended for future phases:

### Unit Tests (Jest)

```javascript
describe('Variable Type Detection', () => {
  test('detects categorical from text values', () => {
    const values = ['Red', 'Blue', 'Red', 'Green', 'Blue'];
    const result = inferColumnRole(values, 'Color');
    expect(result.role).toBe('categorical');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('detects quantitative from numeric values', () => {
    const values = ['10.5', '20.3', '15.7', '18.2'];
    const result = inferColumnRole(values, 'Weight');
    expect(result.role).toBe('quantitative');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});

describe('Count Computation', () => {
  test('counts categorical values correctly', () => {
    const values = ['A', 'B', 'A', 'C', 'A', 'B'];
    const result = computeCounts(values);
    expect(result).toEqual([
      { key: 'A', count: 3 },
      { key: 'B', count: 2 },
      { key: 'C', count: 1 }
    ]);
  });

  test('aggregates beyond top-N into Other', () => {
    const values = Array.from({length: 20}, (_, i) => `Cat${i}`);
    const result = computeCounts(values, { topN: 5 });
    expect(result.length).toBe(6); // 5 + "Other"
    expect(result[5].key).toBe('Other');
    expect(result[5].count).toBe(15);
  });
});

describe('Data Validation', () => {
  test('detects null values', () => {
    const values = ['A', '', 'B', null, 'C'];
    const result = validateColumn(values, 'Category');
    expect(result.nullCount).toBe(2);
  });

  test('detects invalid markers', () => {
    const values = ['A', 'N/A', 'B', '--', 'C'];
    const result = validateColumn(values, 'Category');
    expect(result.invalidCount).toBe(2);
  });
});
```

### Integration Tests (Cypress)

```javascript
describe('Chart Wizard Integration', () => {
  it('creates bar chart from embedded dataset', () => {
    cy.visit('/index.html');
    cy.contains('U1-L3-Q01').click();
    cy.contains('Add Chart').click();
    cy.contains('Bar Chart').click();
    cy.contains('Flavor').click();
    cy.get('.data-preview-table').should('be.visible');
    cy.contains('Vanilla').should('be.visible');
    cy.contains('Preview').click();
    cy.get('canvas').should('be.visible');
    cy.contains('Save Chart').click();
    cy.get('.chart-preview').should('exist');
  });
});
```

---

## Sign-Off

**Status**: All 6 MVP tasks complete and testable.

**Testing Responsibility**: Manual testing required for initial verification. Automated tests recommended for Phase 5+.

**Next Steps**:
1. Run Tests 1-8 (core workflow) on localhost
2. Fix any discovered issues
3. Run edge case tests (9-12)
4. Verify zero console errors
5. Mark MVP as production-ready

---

**Document Version**: 1.0
**Last Updated**: 2025-10-28
**Maintained By**: Chart Wizard Enhancement Team
