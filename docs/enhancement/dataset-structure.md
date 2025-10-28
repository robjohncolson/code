# Embedded Dataset Structures Documentation

**Date**: 2024-10-28
**Task**: P1-ASSESS-DATA-STRUCTURE-03
**Auditor**: Project-Side Sonnet

## Executive Summary

This document catalogs all embedded dataset structures in the AP Statistics Consensus Quiz application. Datasets are embedded directly in question objects within `data/curriculum.js` (37,918 lines) under the `attachments` property. This documentation enables the Chart Wizard enhancement to intelligently detect variable types and present data selection interfaces.

---

## Primary Data Structure

### Question Object Schema

```javascript
{
  "id": "U1-L3-Q01",              // Unit-Lesson-Question ID
  "type": "multiple-choice",       // Question type
  "prompt": "Question text...",    // Question prompt
  "answerKey": "B",                // Correct answer for MC
  "reasoning": "Explanation...",   // Optional: Why answer is correct
  "attachments": {                 // ⭐ Contains embedded datasets
    // Various attachment types documented below
  }
}
```

### Attachments Object Types

Questions can have several types of attachments:
1. **Tables** - 2D array of data (most relevant for Chart Wizard)
2. **Choices** - Multiple choice options
3. **Charts** - Pre-configured chart visualizations
4. **Mixed** - Combination of above

---

## Table Structure (Primary Dataset Type)

### Format

Tables are stored as **2D arrays** where:
- **First row** = Column headers (variable names)
- **Subsequent rows** = Data values

```javascript
"attachments": {
  "table": [
    ["Column1", "Column2", "Column3"],  // Headers
    ["Value1A", "Value2A", "Value3A"],  // Row 1
    ["Value1B", "Value2B", "Value3B"],  // Row 2
    // ...
  ]
}
```

### Example 1: Categorical and Quantitative Variables

**Question**: U1-L2-Q01 (Roller coaster data)

```javascript
"attachments": {
  "table": [
    [
      "Length (feet)",    // Quantitative
      "Type",            // Categorical
      "Speed (miles per hour)",  // Quantitative
      "Height (feet)",   // Quantitative
      "Drop (feet)",     // Quantitative
      "Continent"        // Categorical
    ],
    ["8,133", "Steel", "95", "318", "310", "Asia"],
    ["7,442", "Steel", "50", "107", "102", "Europe"],
    ["7,359", "Wood", "65", "110", "135", "North America"],
    // ... 8 rows total
  ]
}
```

**Variable Type Analysis**:
- **Quantitative**: Length, Speed, Height, Drop (numeric measurements)
- **Categorical**: Type (Steel/Wood), Continent (Asia/Europe/North America)

---

### Example 2: Frequency Table (Categorical + Count)

**Question**: U1-L3-Q01 (Ice cream flavors)

```javascript
"attachments": {
  "table": [
    ["Flavor", "Frequency"],  // Column 1: Categorical, Column 2: Quantitative (count)
    ["Vanilla", "100"],
    ["Chocolate", "65"],
    ["Strawberry", "35"],
    ["Mint chip", "45"],
    ["Coffee", "30"],
    ["Butter pecan", "25"]
  ]
}
```

**Variable Type Analysis**:
- **Categorical**: Flavor (nominal categories)
- **Quantitative**: Frequency (discrete counts)

**Chart Suitability**: Perfect for bar chart showing counts or relative frequencies.

---

### Example 3: Scatterplot Data

**Question**: U2-PC-MCQ-B-Q15 (Age vs Net Worth)

```javascript
"attachments": {
  "scatterplotData": [
    {"x": 48, "y": 22},
    {"x": 55, "y": 33},
    {"x": 61, "y": 18},
    {"x": 83, "y": 14, "label": "Q"},  // Point Q labeled
    // ... more points
  ],
  "chartConfig": {
    "xAxis": {
      "min": 40,
      "max": 85,
      "tickInterval": 10,
      "title": "Age (years)"
    },
    "yAxis": {
      "min": 10,
      "max": 70,
      "tickInterval": 10,
      "title": "Net Worth ($ billions)"
    }
  }
}
```

**Variable Type Analysis**:
- **Both Quantitative**: Age (continuous), Net Worth (continuous)

**Chart Suitability**: Scatter plot

---

## Variable Type Detection Rules

### Categorical Variables

Categorical variables represent categories or groups. Characteristics:

**Nominal** (no natural order):
- Text values: "Male", "Female", "Other"
- Colors: "Red", "Blue", "Green"
- Types: "Steel", "Wood", "Composite"
- Geographic: "North America", "Europe", "Asia"

**Ordinal** (natural order):
- Ratings: "Poor", "Fair", "Good", "Excellent"
- Sizes: "Small", "Medium", "Large"
- Education levels: "High School", "Bachelor's", "Master's", "PhD"

**Detection Algorithm**:
```javascript
function isCategorical(columnData) {
  // Remove header (index 0)
  const values = columnData.slice(1);

  // Check if values are repeated (characteristic of categories)
  const uniqueValues = new Set(values);

  // If < 50% unique values → likely categorical
  // OR if all values are non-numeric strings
  const uniqueRatio = uniqueValues.size / values.length;
  const allNonNumeric = values.every(val => isNaN(parseFloat(val)));

  return uniqueRatio < 0.5 || allNonNumeric;
}
```

---

### Quantitative Variables

Quantitative variables represent numeric measurements or counts. Characteristics:

**Discrete** (countable):
- Counts: 0, 1, 2, 3, ...
- Frequencies: Number of students, items, occurrences
- Whole numbers

**Continuous** (measurable):
- Measurements: Height, weight, temperature
- Money: Prices, salaries
- Time: Duration, age
- Can have decimal values

**Detection Algorithm**:
```javascript
function isQuantitative(columnData) {
  const values = columnData.slice(1);  // Skip header

  // Count how many values are numeric
  const numericCount = values.filter(val => {
    const num = parseFloat(val.replace(/,/g, ''));  // Remove commas
    return !isNaN(num);
  }).length;

  // If > 80% numeric → quantitative
  return (numericCount / values.length) > 0.8;
}
```

---

## Common Data Patterns

### Pattern 1: Single Categorical Variable (for frequency tables)

**Structure**:
```javascript
["Category", "Count"]
["A", "10"]
["B", "15"]
["C", "8"]
```

**Use Cases**:
- Bar chart (counts)
- Bar chart (relative frequencies)
- Pie chart
- Doughnut chart

**Variable Types**: Categorical (Column 1), Quantitative (Column 2)

---

### Pattern 2: Multiple Quantitative Variables

**Structure**:
```javascript
["Variable1", "Variable2", "Variable3"]
["10.5", "20.3", "15.7"]
["12.1", "18.9", "14.2"]
```

**Use Cases**:
- Scatter plot (select 2 variables)
- Bubble chart (select 3 variables: x, y, radius)
- Line chart (if there's a time/sequential variable)
- Histogram (for single variable)

**Variable Types**: All Quantitative

---

### Pattern 3: Mixed Categorical + Quantitative

**Structure**:
```javascript
["Category", "Measure1", "Measure2", "Type"]
["A", "10.5", "20", "Group1"]
["B", "15.2", "18", "Group2"]
```

**Use Cases**:
- Bar chart grouped by category
- Box plot by category
- Histogram faceted by category

**Variable Types**: Mixed

---

## Data Access Patterns

### From Chart Wizard Context

```javascript
// Get current question
const questionId = wizardState.questionId;

// Access question object
const question = EMBEDDED_CURRICULUM.find(q => q.id === questionId);

// Access table data
const tableData = question?.attachments?.table;

if (Array.isArray(tableData) && tableData.length > 0) {
  // First row = headers
  const headers = tableData[0];

  // Data rows = everything after first row
  const rows = tableData.slice(1);

  // Column access (e.g., get column index 2)
  const columnIndex = 2;
  const columnName = headers[columnIndex];
  const columnValues = rows.map(row => row[columnIndex]);

  // Detect variable type
  const isCat = isCategorical([columnName, ...columnValues]);
  const isQuant = isQuantitative([columnName, ...columnValues]);
}
```

---

## Edge Cases & Special Handling

### 1. Numbers Stored as Strings with Formatting

**Issue**: "8,133" (comma separator), "$45.99" (currency), "10%" (percentage)

**Solution**:
```javascript
function cleanNumericString(str) {
  // Remove commas, dollar signs, percent signs
  return str.replace(/[$,%]/g, '').replace(/,/g, '');
}
```

---

### 2. Empty Cells

**Issue**: Missing data represented as "" or undefined

**Solution**:
```javascript
function handleMissingData(values) {
  return values.map(val => {
    if (val === '' || val === null || val === undefined) {
      return null;  // Explicit null for missing data
    }
    return val;
  });
}
```

---

### 3. Mixed Types in Same Column

**Issue**: "Most columns have numbers, but some have text"

**Example**:
```javascript
["Age", ...]
["25", "30", "N/A", "28"]
```

**Solution**: Determine dominant type (>50% rule) or flag as mixed type requiring user confirmation.

---

### 4. Headers Without Data

**Issue**: Table with only header row (rare but possible)

**Solution**:
```javascript
if (tableData.length < 2) {
  throw new Error('Table must have at least one data row');
}
```

---

## Column Selection UI Requirements

Based on dataset structures, the column selector must:

### 1. Display Column Names
- Show all column headers from `table[0]`
- Indicate variable type with badge (🔢 Quantitative | 📊 Categorical)

### 2. Filter by Type
- For bar charts: Allow selection of 1 categorical variable
- For scatter: Require 2 quantitative variables
- For histogram: Require 1 quantitative variable

### 3. Preview Data
- Show first 5-10 rows of selected column(s)
- Highlight selected columns in preview table

### 4. Search/Filter
- Searchable dropdown for tables with many columns (10+)
- Type-ahead filtering

---

## Data Preview Component Requirements

### Minimal Preview Table

```html
<div class="data-preview">
  <table>
    <thead>
      <tr>
        <th class="selected">Flavor <span class="type-badge">Categorical</span></th>
        <th class="selected">Frequency <span class="type-badge">Quantitative</span></th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Vanilla</td><td>100</td></tr>
      <tr><td>Chocolate</td><td>65</td></tr>
      <tr><td>Strawberry</td><td>35</td></tr>
      <!-- ... first 5 rows -->
      <tr class="preview-more"><td colspan="2">... 2 more rows</td></tr>
    </tbody>
  </table>
</div>
```

### Preview Data

- **Rows to show**: First 5-10 rows (configurable)
- **Highlight selected columns**: Add `.selected` class
- **Type badges**: Show categorical vs quantitative
- **Row count indicator**: "Showing 5 of 50 rows"

---

## Sample Test Datasets

For development and testing, create these test datasets:

### Test Dataset 1: Pure Categorical
```javascript
const testCategorical = [
  ["Fruit", "Color", "Origin"],
  ["Apple", "Red", "USA"],
  ["Banana", "Yellow", "Ecuador"],
  ["Grape", "Purple", "Chile"],
  ["Orange", "Orange", "Spain"]
];
```

### Test Dataset 2: Pure Quantitative
```javascript
const testQuantitative = [
  ["Height", "Weight", "Age"],
  ["5.8", "150", "25"],
  ["6.1", "180", "30"],
  ["5.5", "140", "22"],
  ["5.9", "165", "28"]
];
```

### Test Dataset 3: Mixed
```javascript
const testMixed = [
  ["Name", "Score", "Grade", "Pass"],
  ["Alice", "92", "A", "true"],
  ["Bob", "85", "B", "true"],
  ["Charlie", "78", "C", "true"],
  ["Diana", "65", "D", "true"]
];
```

### Test Dataset 4: Edge Cases
```javascript
const testEdgeCases = [
  ["Amount", "Status", "Count"],
  ["$1,234.56", "Active", "10"],
  ["$999.99", "", "5"],      // Empty cell
  ["N/A", "Inactive", "0"],  // Non-numeric in numeric column
  ["$2,500.00", "Active", ""]  // Empty count
];
```

---

## Integration with Variable Typing System

### Type Detection Flow

```
1. User selects chart type (e.g., "Bar Chart")
   ↓
2. Chart Wizard determines required variable types
   - Bar chart → 1 categorical variable needed
   ↓
3. Load question's table data
   ↓
4. For each column:
   - Extract header and values
   - Run isCategorical() and isQuantitative()
   - Assign type badge
   ↓
5. Filter column list to show only compatible types
   - Bar chart → show only categorical columns
   ↓
6. User selects column
   ↓
7. Preview shows selected data + type
   ↓
8. On confirmation, calculate counts/frequencies
   ↓
9. Populate chart with data
```

---

## Variable Type Metadata Storage

Suggestion: Cache detected types to avoid re-computation.

```javascript
// In wizard state
wizardState.columnTypes = {
  "Flavor": "categorical",
  "Frequency": "quantitative",
  "Price": "quantitative"
};
```

---

## Recommendations

### For Bar Chart Implementation

1. **Detect categorical column**: Use `isCategorical()`
2. **Calculate counts**:
   ```javascript
   const counts = {};
   columnValues.forEach(val => {
     counts[val] = (counts[val] || 0) + 1;
   });
   ```
3. **Calculate relative frequencies**:
   ```javascript
   const total = columnValues.length;
   const relativeFreq = {};
   Object.keys(counts).forEach(key => {
     relativeFreq[key] = counts[key] / total;
   });
   ```
4. **Sort options**:
   - Alphabetical: `Object.keys(counts).sort()`
   - By frequency: `Object.entries(counts).sort((a,b) => b[1] - a[1])`

### For Scatter Plot Implementation

1. **Require 2 quantitative columns**
2. **Extract paired values**:
   ```javascript
   const points = rows.map(row => ({
     x: parseFloat(row[xColumnIndex]),
     y: parseFloat(row[yColumnIndex])
   }));
   ```
3. **Filter out invalid points** (NaN values)

---

## Conclusion

Embedded datasets in this application follow consistent patterns:
- **Tables as 2D arrays** with headers in first row
- **Variable types** clearly identifiable through heuristics
- **Mixed data types** common (categorical + quantitative)
- **Edge cases** exist (formatting, missing data) but are manageable

The Chart Wizard enhancement can leverage these patterns to provide intelligent column selection and automatic data preparation for chart generation.

---

**Next Steps**:
1. ✅ Dataset structure documentation complete
2. ⏭ Implement variable type detection (P3-IMPL-VARIABLE-TYPING-01)
3. ⏭ Build column selector UI (P4-UI-SEARCHABLE-PICKER-01)
4. ⏭ Create data preview component (P4-UI-DATA-PREVIEW-02)
