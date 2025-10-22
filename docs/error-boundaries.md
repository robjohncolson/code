# Error Boundaries & Graceful Degradation

## Overview
This document defines error handling strategies for each layer of the AP Statistics Consensus Quiz application. The goal is **graceful degradation** - the app should continue functioning even when components fail.

## Core Principle
**Never crash the entire application due to a component failure.**

Each layer has defined fallback behavior that allows the app to continue operating, possibly with reduced functionality.

## Error Boundary Layers

### 1. Presentation Layer (Charts & UI)

#### Chart Rendering Failures
**Scenario:** Chart.js fails to render due to invalid data, missing canvas, or library error

**Fallback:**
```javascript
// Instead of crashing, show placeholder
function renderChart(data) {
    try {
        return new Chart(ctx, config);
    } catch (error) {
        return ErrorBoundary.chartFallback(error);
        // Returns: <div class="chart-error">Chart unavailable</div>
    }
}
```

**User Impact:** Chart section shows placeholder instead of visualization
**App Continues:** Yes - questions still answerable, other charts still render

#### DOM Manipulation Errors
**Scenario:** Invalid selector, missing element, or DOM state mismatch

**Fallback:**
- Log error to console
- Continue execution
- Element remains unchanged

**User Impact:** Minimal - specific UI element may not update
**App Continues:** Yes

---

### 2. Business Logic Layer (Data & Auth)

#### localStorage Quota Exceeded
**Scenario:** Browser storage limit reached (~5-10MB)

**Fallback:**
```javascript
try {
    localStorage.setItem('classData', JSON.stringify(data));
} catch (error) {
    ErrorBoundary.quotaFallback(error);
    // Attempts to clean old session data
    // Shows warning message to user
}
```

**User Impact:**
- Warning: "Storage space low. Old data cleaned up."
- If cleanup fails: "Storage full. Please export your data."

**App Continues:** Yes - can still answer questions (data in memory)
**Data Loss Risk:** New answers may not persist until space freed

#### Data Corruption / Migration Failure
**Scenario:** localStorage contains invalid or corrupted JSON

**Fallback:**
```javascript
try {
    classData = JSON.parse(localStorage.getItem('classData'));
} catch (error) {
    console.error('Data corrupted, resetting:', error);
    classData = {users: {}};  // Empty state
    showMessage('Local data reset. Import backup if available.', 'warning');
}
```

**User Impact:** Progress appears lost; export/import can restore
**App Continues:** Yes - starts fresh

---

### 3. Infrastructure Layer (Cloud Sync)

#### Railway Server Connection Failed
**Scenario:** Railway server unreachable, timeout, or 5xx error

**Fallback:**
```javascript
try {
    return await fetchFromRailway();
} catch (error) {
    ErrorBoundary.railwayFallback(error);
    // Falls back to direct Supabase
    return await fetchFromSupabase();
}
```

**User Impact:** "Connecting to backup server..." (invisible to user)
**App Continues:** Yes - seamless fallback to Supabase

#### Supabase Connection Failed
**Scenario:** Supabase unreachable, invalid credentials, or network failure

**Fallback:**
```javascript
try {
    return await supabase.from('answers').select();
} catch (error) {
    ErrorBoundary.syncFallback(error);
    // Returns: {offline: true}
    showMessage('Continuing in offline mode', 'info');
}
```

**User Impact:**
- Message: "Continuing in offline mode"
- No peer data visible
- Own answers still saved locally

**App Continues:** Yes - fully functional offline

#### WebSocket Disconnect
**Scenario:** WebSocket connection lost (Railway)

**Fallback:**
- Automatic reconnection with exponential backoff
- Fallback to HTTP polling if reconnect fails
- Fallback to offline mode if both fail

**User Impact:** Peer data may be stale until reconnect
**App Continues:** Yes

---

## Error Handling Patterns

### Pattern 1: Try-Catch with Fallback
```javascript
const safeFunction = ErrorBoundary.wrap(
    riskyFunction,          // Original function
    fallbackFunction,       // Fallback if error
    'Feature Name'          // Context for logging
);
```

### Pattern 2: Safe localStorage Operations
```javascript
// Instead of:
localStorage.setItem('key', value);  // May throw QuotaExceededError

// Use:
ErrorBoundary.safeLocalStorage.setItem('key', value);  // Returns true/false
```

### Pattern 3: Async Operation with Fallback
```javascript
async function fetchData() {
    try {
        return await primarySource();
    } catch (error) {
        console.warn('Primary failed, trying fallback');
        try {
            return await fallbackSource();
        } catch (fallbackError) {
            return offlineData();  // Last resort
        }
    }
}
```

## Global Error Handlers

### Uncaught Exceptions
```javascript
window.addEventListener('error', function(event) {
    // Log error
    console.error('Uncaught error:', event.error);

    // Prevent browser default (page crash)
    event.preventDefault();

    // Show message
    showMessage('An error occurred. The app will continue.', 'error');
});
```

### Unhandled Promise Rejections
```javascript
window.addEventListener('unhandledrejection', function(event) {
    // Log rejection
    console.error('Unhandled rejection:', event.reason);

    // Prevent browser warning
    event.preventDefault();

    // Assume network error, go offline
    showMessage('Connection error. Continuing in offline mode.', 'warning');
});
```

## Fallback Priority Chain

### For Data Operations:
1. **Primary:** localStorage (instant, always available)
2. **Secondary:** Railway server cache (fast, optional)
3. **Tertiary:** Direct Supabase (slower, optional)
4. **Fallback:** In-memory only (session-only, no persistence)

### For Chart Rendering:
1. **Primary:** Chart.js render
2. **Fallback:** Static placeholder HTML

### For Network Operations:
1. **Primary:** Railway WebSocket (real-time)
2. **Secondary:** Railway HTTP (cached)
3. **Tertiary:** Direct Supabase (uncached)
4. **Fallback:** Offline mode (localStorage only)

## User-Facing Error Messages

### Severity Levels

**Error (Red):**
- "Storage full. Please export your data."
- "Unable to save answer. Try again."

**Warning (Yellow):**
- "Storage space low. Old data cleaned up."
- "Sync unavailable. Working offline."

**Info (Blue):**
- "Continuing in offline mode"
- "Reconnecting to server..."

**Success (Green):**
- "Sync restored"
- "Data exported successfully"

## Testing Error Boundaries

### Manual Tests

1. **localStorage Quota:**
   ```javascript
   // Fill localStorage until quota exceeded
   for (let i = 0; i < 10000; i++) {
       localStorage.setItem('test' + i, 'x'.repeat(10000));
   }
   ```

2. **Chart Rendering:**
   ```javascript
   // Pass invalid data to chart
   renderChartNow({chartType: 'invalid'}, 'nonexistent-canvas');
   ```

3. **Network Failure:**
   ```javascript
   // Disconnect network, try to sync
   // Should show "Continuing in offline mode"
   ```

### Automated Tests (Future)

```javascript
// Example test
test('chart renders fallback on error', () => {
    const result = ErrorBoundary.wrap(
        () => { throw new Error('Test'); },
        ErrorBoundary.chartFallback,
        'test-chart'
    )();

    expect(result).toContain('Chart unavailable');
});
```

## Recovery Mechanisms

### From localStorage Corruption:
1. User exports data before corruption (preventive)
2. Import previously exported file
3. If no backup: start fresh (unavoidable data loss)

### From Network Outage:
1. App detects offline state
2. Continues with localStorage
3. Auto-sync when connection restored

### From localStorage Quota:
1. Auto-cleanup of session markers
2. User exports and clears old data
3. If critical: continue in-memory (session only)

## Monitoring & Logging

### What to Log:
- Error type and message
- Module/function where error occurred
- Fallback action taken
- User impact level

### What NOT to Log:
- Student names or PII (see `docs/security/logging-policy.md`)
- Full stack traces in production (console only)
- Supabase credentials or tokens

### Example Log Entry:
```javascript
console.error('Error in charts.js renderChartNow:', error.message);
console.log('Fallback: Showing placeholder for chart-123');
console.log('User impact: Chart section unavailable, quiz continues');
```

## References
- Implementation: `js/error_handler.js`
- Module boundaries: `docs/module-boundaries.md`
- Security logging: `docs/security/logging-policy.md`
