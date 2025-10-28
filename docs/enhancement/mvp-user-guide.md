# Chart Wizard MVP - User Guide

**For Students**: How to create charts from embedded datasets in <60 seconds

---

## What's New in the Chart Wizard MVP

The enhanced Chart Wizard now helps you quickly create bar charts directly from data tables embedded in quiz questions. Instead of manually typing data, you can now:

✨ **Select columns** from question datasets with a single click
🔍 **Search** through available columns
👁️ **Preview** your data before charting
🤖 **Auto-detect** variable types (categorical vs quantitative)
📊 **Auto-fill** bar charts with frequency counts

---

## Quick Start: Create a Bar Chart in 4 Steps

### Step 1: Open the Chart Wizard

1. Navigate to an FRQ question with embedded data (e.g., U1-L3-Q01 - Ice Cream Flavors)
2. Click the **"Add Chart"** button in the question area
3. The Chart Wizard modal will open

### Step 2: Select "Bar Chart"

1. Click the **"Bar Chart"** card in the type selector
2. The data entry interface will appear

### Step 3: Pick Your Column

1. You'll see a **column picker** showing all available columns from the question's dataset
2. Each column shows:
   - **Icon**: 📊 for categorical data (like flavor names), 🔢 for numbers
   - **Name**: The column header (e.g., "Flavor")
   - **Badge**: Number of unique values (e.g., "6 unique")
   - **Metadata**: Variable type and confidence score

3. **Search** (optional): Type in the search box to filter columns
4. **Click** the column you want to chart (usually a categorical column like "Flavor" or "Type")

### Step 4: Preview and Save

1. After clicking a column:
   - **Data preview** appears showing the first 10 rows
   - **Bar chart auto-fills** with frequency counts
   - You'll see categories and how many times each appears

2. Click **"Preview"** to see the rendered chart
3. If it looks good, click **"Save Chart"**
4. Your chart now appears in the question area!

**Total time**: ~30-45 seconds ⚡

---

## Understanding the Column Picker

### Icon Guide

| Icon | Type | Use For |
|------|------|---------|
| 📊 | Categorical | Text categories, groups, labels (good for bar charts) |
| 🔢 | Quantitative | Numbers, measurements, counts |
| 📄 | Text | Long text descriptions (not suitable for charting) |
| 📅 | Date | Dates and times |

### What to Look For

**For Bar Charts**, select columns with:
- 📊 Categorical icon
- Low cardinality (2-20 unique values is ideal)
- Clear categories (e.g., "Red, Blue, Green" or "Male, Female")

**Avoid** for bar charts:
- 🔢 Quantitative columns (use scatter plots or histograms instead)
- High cardinality (>50 unique values gets messy)
- ID columns or unique identifiers

---

## Data Preview Explained

After selecting a column, you'll see a **data preview table**:

```
┌─────────────────────┐
│ Flavor              │ ← Column name (sticky header)
├─────────────────────┤
│ Vanilla             │
│ Chocolate           │
│ Strawberry          │
│ Mint chip           │
│ Coffee              │
│ Butter pecan        │
├─────────────────────┤
│ ... 0 more rows     │ ← Shows total row count
└─────────────────────┘
```

**What it shows**:
- First 10 rows of your selected column
- Empty cells appear as *(empty)*
- Total row count at the bottom

**Why it's useful**:
- Verify you selected the right column
- Spot data quality issues (missing values, typos)
- See what categories will appear in your chart

---

## Auto-Fill Bar Charts with Counts

When you select a categorical column, the wizard **automatically computes frequency counts**:

**Example**: Ice Cream Flavors
- Input column: `["Vanilla", "Vanilla", "Chocolate", "Vanilla", "Chocolate", "Strawberry"]`
- Auto-filled chart:
  ```
  Vanilla:     3
  Chocolate:   2
  Strawberry:  1
  ```

**Sorting**: Categories are sorted by frequency (highest first)

**Top-N Aggregation**: If you have >12 unique categories, the wizard shows the top 12 and groups the rest into "Other"

---

## Manual Data Entry (Still Available!)

Don't have embedded data? No problem! You can still enter data manually:

1. Select "Bar Chart"
2. **Scroll past** the column picker
3. Look for the **"— OR —"** divider
4. Use the **manual data entry** section below:
   - Click "Add Row"
   - Enter label and value
   - Repeat for all data points

The column picker and manual entry are **independent** - use whichever fits your workflow.

---

## Switching Columns

Changed your mind? You can switch columns anytime:

1. Click a different column in the picker
2. Data preview updates immediately
3. Bar chart auto-fills with new counts
4. Previous data is **replaced** (not merged)

---

## Searching Columns

For questions with many columns (>5), use the **search box**:

1. Type part of the column name (e.g., "Type")
2. Column list filters in real-time
3. Clear the search to see all columns again

**Search tips**:
- Case-insensitive (typing "height" finds "Height")
- Matches anywhere in the name ("Speed" finds "Speed (mph)")
- Searches column names only (not data values)

---

## Example Walkthrough: Ice Cream Flavors

Let's create a bar chart showing ice cream flavor preferences:

### The Data (U1-L3-Q01)

| Flavor        | Frequency |
|---------------|-----------|
| Vanilla       | 100       |
| Chocolate     | 65        |
| Strawberry    | 35        |
| Mint chip     | 45        |
| Coffee        | 30        |
| Butter pecan  | 25        |

### Using the Column Picker

1. **Open Chart Wizard** → Select "Bar Chart"
2. **Column Picker appears** with two options:
   - 📊 Flavor (6 unique) - categorical
   - 🔢 Frequency (6 unique) - quantitative

3. **Click "Flavor"** (we want to chart flavor distribution)
4. **Data Preview** shows:
   ```
   Vanilla
   Chocolate
   Strawberry
   Mint chip
   Coffee
   Butter pecan
   ```

5. **Bar chart auto-fills** with:
   ```
   Vanilla:       1
   Chocolate:     1
   Strawberry:    1
   Mint chip:     1
   Coffee:        1
   Butter pecan:  1
   ```

   **Wait, all counts are 1?** That's correct! Each flavor appears once in the "Flavor" column. The "Frequency" column has the actual counts.

### Adjusting the Approach

If you want to **use the pre-calculated frequencies** from the "Frequency" column:

**Option A**: Manually enter the data using the frequencies
1. Don't use column picker
2. Scroll to manual entry
3. Add 6 rows with labels from "Flavor" and values from "Frequency"

**Option B**: Use "Frequency" column (if it has repeated values)
- Only works if the data is structured as repeated rows (one row per observation)

### The Right Choice

For this dataset, the "Frequency" column already contains counts, so:
- **Use manual entry** to create a bar chart with the given frequencies
- **Or** use column picker if you want to show that each flavor appears once in the list

**Learning Point**: Understanding your data structure is key to choosing the right approach!

---

## Troubleshooting

### "No suitable columns found in question data"

**Cause**: The question doesn't have an embedded dataset (`attachments.table`)

**Solution**: Use manual data entry instead

---

### "100% empty" validation warning

**Cause**: The selected column has no data (all cells are empty)

**Solution**: Choose a different column or check if the question data is correct

---

### All counts are 1

**Cause**: You selected a column where each value appears only once (like a unique ID column)

**Solution**:
- Choose a column with repeated categories (e.g., "Type", "Category", "Group")
- Or verify your data structure - you might need to use the frequency column differently

---

### Chart shows "Other" category

**Cause**: Your column has >12 unique values, so the wizard aggregated the bottom ones

**Solution**:
- This is normal for high-cardinality data
- "Other" represents the sum of all categories beyond the top 12
- If you need all categories, use manual entry

---

### Column picker is empty

**Cause**: No columns match the required type for the selected chart

**Solution**:
- For bar charts, you need at least one categorical column
- Try a different chart type (scatter plot for quantitative data)
- Or use manual entry

---

## Tips for Success

### ✅ Do This

- **Start with the column picker** for embedded datasets (faster than manual entry)
- **Preview your data** before finalizing (catches errors early)
- **Check the icon** - 📊 for bar charts, 🔢 for scatter plots
- **Use search** for questions with many columns (saves time)
- **Verify counts** in the auto-filled chart match your expectations

### ❌ Avoid This

- **Don't select quantitative columns** for bar charts (use histogram instead)
- **Don't skip the preview** - it catches data quality issues
- **Don't select ID columns** or unique identifiers (they'll all have count=1)
- **Don't expect column picker** on every question (only works with embedded datasets)

---

## Keyboard Shortcuts

- **Tab**: Navigate between search box and column options
- **Enter/Space**: Select highlighted column
- **Escape**: Close modal (if implemented)
- **Type to search**: Focus search box, start typing

---

## Accessibility

The Chart Wizard MVP supports:
- ✅ Full keyboard navigation
- ✅ Screen reader labels
- ✅ High contrast mode
- ✅ Zoom up to 200%

If you encounter accessibility issues, please report them!

---

## What's NOT in the MVP

The following features are **not yet implemented** (planned for future phases):

- ❌ Relative frequency toggle (counts only for now)
- ❌ Sort options (alphabetical or by frequency)
- ❌ Caption generator (write captions manually)
- ❌ Multi-column selection (one column at a time)
- ❌ Data filtering/transformation (use what's in the dataset)

These may be added in future updates based on student feedback.

---

## Getting Help

### Still Stuck?

1. **Try manual entry**: Works for all questions, no embedded data required
2. **Check the question**: Verify it has a data table
3. **Console errors**: Open browser DevTools (F12) and check for red error messages
4. **Ask your teacher**: They can verify the question data is correct

### Reporting Issues

If you find a bug:
1. Note the question ID (e.g., "U1-L3-Q01")
2. Describe what you were trying to do
3. Include any console errors (F12 → Console tab)
4. Report to your teacher or the development team

---

## Summary: 60-Second Workflow

```
1. Click "Add Chart" (2 seconds)
2. Select "Bar Chart" (2 seconds)
3. Click a categorical column (3 seconds)
4. Review data preview (10 seconds)
5. Verify auto-filled chart (5 seconds)
6. Click "Preview" (2 seconds)
7. Review rendered chart (10 seconds)
8. Click "Save Chart" (2 seconds)

Total: ~36 seconds ⚡
```

**You did it!** You've created a professional bar chart from embedded data in under a minute.

---

## Examples by Question

### U1-L3-Q01: Ice Cream Flavors
- **Best column**: Flavor (categorical)
- **Chart type**: Bar chart
- **Expected result**: 6 bars showing flavor distribution

### U1-L2-Q01: Roller Coaster Data
- **Best columns**: Type (Steel/Wood) or Continent (Asia/Europe/NA)
- **Chart type**: Bar chart
- **Expected result**: 2-3 bars showing counts by category

### U2-PC-MCQ-B-Q15: Age vs Net Worth
- **Best columns**: Age (x-axis), Net Worth (y-axis)
- **Chart type**: Scatter plot (not bar chart!)
- **Expected result**: Points showing age-wealth relationship

---

## Need More Chart Types?

The Chart Wizard supports 14 chart types total:

**For Categorical Data**:
- Bar Chart
- Pie Chart
- Doughnut Chart

**For Quantitative Data**:
- Histogram
- Dot Plot
- Box Plot
- Scatter Plot

**For Distributions**:
- Normal Curve
- Chi-Square Curve

Explore the full type selector to find the right chart for your data!

---

**Happy charting! 📊**
