# Peer Chart Display - Testing Guide

## What Was Fixed

### 1. **CRITICAL: Raw JSON Display Issue**
- **Problem**: Peer charts were displaying as raw JSON text instead of rendered charts
- **Root Cause**: Chart data wasn't being properly parsed from JSON strings when syncing peer data
- **Fix**: Updated `mergePeerDataIntoStores()` in index.html (lines 848-888) to:
  - Handle nested value structures
  - Parse JSON strings before storing in charts collection
  - Preserve reasoning text in the `reasons` collection
  - Better error handling and logging

### 2. **CRITICAL: File Protocol Support**
- **Problem**: Peer data wasn't loading when using file:// protocol (no server)
- **Fix**: Added `loadAllPeerDataFromLocalStorage()` function (lines 904-946) that:
  - Scans all `answers_[username]` keys in localStorage
  - Loads peer data from other users
  - Automatically runs 2 seconds after page load
  - Works completely offline

### 3. **FRQ Reasoning Text Display**
- **Problem**: Reasoning/explanation text wasn't shown with peer charts
- **Fix**: Updated `renderPeerCharts()` in chart_wizard.js to:
  - Check for reasoning text in `classData.users[username].reasons[questionId]`
  - Display reasoning below chart in a styled section
  - Escape HTML to prevent XSS attacks

### 4. **Chart Rendering Enhancement**
- **Fix**: Added explicit JSON parsing check in renderPeerCharts:
  - Detects if chart is still a string
  - Parses it before converting to chart config
  - Better error messages for debugging

### 5. **CSS Styling**
- Added comprehensive styling for reasoning text (styles.css lines 5000-5042):
  - Professional card layout
  - Scrollable text area for long reasoning
  - Custom scrollbar styling
  - Dark theme support

## How to Test

### Test 1: File Protocol (No Server Required)

1. **Open directly in browser**:
   ```
   file:///C:/Users/rober/OneDrive/Desktop/code/index.html
   ```

2. **Create User 1**:
   - Set username (e.g., "Alice_Bear")
   - Navigate to U1-L10-Q04 (or any chart-eligible FRQ)
   - Create a histogram chart
   - Export class data (Sync button → Save)

3. **Create User 2** (new browser profile/incognito):
   - Open same file:// URL
   - Set different username (e.g., "Bob_Cat")
   - Import User 1's class data (Sync button → Open)
   - Navigate to same question
   - You should see User 1's chart displayed!

4. **Verify**:
   - Chart displays as visual chart (NOT JSON text)
   - Username shows above chart
   - Chart type badge displays
   - If User 1 added reasoning, it shows below chart

### Test 2: With Server (Python)

1. **Start server**:
   ```bash
   cd /mnt/c/Users/rober/OneDrive/Desktop/code
   python -m http.server 8000
   ```

2. **Open two browser windows**:
   - Window 1: `http://localhost:8000`
   - Window 2: `http://localhost:8000` (incognito)

3. **Create charts in both windows** on same question

4. **Verify peer charts appear** after:
   - Page refresh
   - Navigating away and back
   - Should see peer's chart automatically

### Test 3: Reasoning Text

1. For an FRQ that asks for a chart AND explanation:
   - Create a chart
   - Add text reasoning in the textarea
   - Submit

2. **As a peer**:
   - Navigate to same question
   - Should see both:
     - The peer's chart (rendered visually)
     - The peer's reasoning text below the chart

### Test 4: Multiple Peers

1. Create 3+ users with different charts
2. Import all data or wait for sync
3. Navigate to question
4. Should see grid of peer charts
5. Each chart should have:
   - Username header
   - Chart type badge
   - Rendered chart
   - Optional reasoning text

## Debugging

### Check if charts are stored correctly:

Open browser console and run:
```javascript
// Get current classData
console.log(classData);

// Check specific peer's charts
const peerUsername = Object.keys(classData.users).find(u => u !== currentUsername);
console.log('Peer charts:', classData.users[peerUsername]?.charts);

// Check if chart is string or object
const chart = classData.users[peerUsername]?.charts?.['U1-L10-Q04'];
console.log('Chart type:', typeof chart);
console.log('Chart data:', chart);

// Test SIF conversion
if (chart) {
    console.log('Converted:', window.convertChartSIFToChartData(chart));
}
```

### Expected console logs:

When peer charts load, you should see:
```
📂 Loading peer data from localStorage (offline mode)...
✅ Loaded data from X peer(s) from localStorage
[Peer Charts] Question U1-L10-Q04: Current user = "Alice_Bear", Found 2 peer chart(s)
[Peer Charts] ✅ Rendered chart for Bob_Cat
```

### If charts still show as JSON:

1. Check console for errors
2. Verify chart is in classData.users[username].charts (not just answers)
3. Check that `typeof chart === 'object'` (not string)
4. Verify `window.charts.getChartHtml` and `window.charts.renderChartNow` exist

## Known Limitations

1. **Turbo mode sync**: Real-time sync requires Supabase/Railway setup
2. **localStorage quota**: Limited storage (~5-10MB per origin)
3. **Import/export**: Manual step required for file:// protocol
4. **Chart types**: All 14 chart types should work, but test your specific type

## Success Criteria

✅ Charts display as visual charts, NOT JSON text
✅ Works with file:// protocol (no server)
✅ Reasoning text displays below charts
✅ Multiple peer charts display in grid
✅ Chart updates after import/refresh
✅ Error messages are helpful (not blank screens)

## Files Changed

1. **index.html**:
   - Lines 848-888: Fixed JSON parsing in mergePeerDataIntoStores
   - Lines 904-946: Added loadAllPeerDataFromLocalStorage function
   - Lines 7428-7435: Call localStorage loading on page init

2. **js/chart_wizard.js**:
   - Lines 4357-4442: Enhanced renderPeerCharts with reasoning and better parsing

3. **css/styles.css**:
   - Lines 5000-5042: Added reasoning text styling

## Rollback Plan

If issues occur, revert these commits or:
1. Comment out line 7430-7435 (localStorage loading)
2. The old JSON parsing will still run, just less robust
