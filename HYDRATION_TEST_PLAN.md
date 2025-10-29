# Chart Submission Hydration - Test Plan

## Overview
This document describes how to test the chart submission hydration feature implemented in response to the requirements.

## Implementation Summary

### What Was Implemented

1. **Supabase Hydration** (`hydrateCurrentUserAnswersFromSupabase`)
   - Fetches current user's answers from Supabase on page load
   - Merges cloud answers into `localStorage` and `classData`
   - Detects and caches chart submissions (JSON with `chartType`)
   - Re-renders current question after hydration

2. **Railway Hydration** (`hydrateCurrentUserAnswersFromRailway`)
   - Fetches ALL user answers from Railway `/api/peer-data` endpoint
   - Filters for current user's answers
   - Same merge and cache logic as Supabase hydration
   - Falls back to Supabase if Railway fails

3. **Master Hydration** (`hydrateCurrentUserAnswers`)
   - Smart routing: tries Railway first if enabled, then Supabase
   - Called at the start of `initializeTurboMode()` before other sync operations

4. **Initialization Changes**
   - `initializeTurboMode()` now calls hydration BEFORE smart sync
   - Hydration happens regardless of Supabase connection status (Railway fallback)

## Test Scenarios

### Scenario 1: Chart Hydration with Supabase
**Prerequisites:**
- `USE_RAILWAY = false` in `railway_config.js`
- Valid Supabase credentials in `supabase_config.js`
- Existing chart submission in Supabase for current user

**Steps:**
1. Open the app in a browser
2. Log in with a username that has chart submissions in Supabase
3. Navigate to a question with a chart answer
4. Observe browser console for:
   - `💧 Hydrating answers for [username] from Supabase...`
   - `📊 Hydrated chart for [question-id]`
   - `✅ Hydration complete: X answers restored`
   - `🔄 Re-rendering question [question-id] after hydration`
5. Verify "Your Chart" section displays the chart

**Expected Results:**
- Chart appears immediately after page load without manual refresh
- Console shows successful hydration messages
- Chart data matches what was submitted previously

### Scenario 2: Chart Hydration with Railway
**Prerequisites:**
- `USE_RAILWAY = true` in `railway_config.js`
- Valid `RAILWAY_SERVER_URL` in `railway_config.js`
- Railway server is running and accessible
- Existing chart submission in database

**Steps:**
1. Open the app in a browser
2. Log in with a username that has chart submissions
3. Navigate to a question with a chart answer
4. Observe browser console for:
   - `💧 Hydrating answers for [username] from Railway...`
   - `📊 Hydrated chart for [question-id]`
   - `✅ Railway hydration complete: X answers restored`
   - `🔄 Re-rendering question [question-id] after hydration`
5. Verify "Your Chart" section displays the chart

**Expected Results:**
- Chart appears via Railway endpoint
- Console shows Railway hydration messages
- Chart data matches database

### Scenario 3: Railway Fallback to Supabase
**Prerequisites:**
- `USE_RAILWAY = true` but Railway server is unreachable
- Valid Supabase credentials

**Steps:**
1. Stop the Railway server or set invalid URL
2. Open the app in a browser
3. Log in with a username that has chart submissions
4. Observe browser console for:
   - `❌ Railway hydration failed: [error]`
   - `⚠️ Railway hydration failed, falling back to Supabase`
   - `💧 Hydrating answers for [username] from Supabase...`

**Expected Results:**
- Automatic fallback to Supabase
- Hydration succeeds via Supabase
- Chart displays correctly

### Scenario 4: Timestamp Conflict Resolution
**Prerequisites:**
- Chart submission exists in cloud with timestamp T1
- Local storage has same question with timestamp T2

**Test Cases:**

**4a. Cloud is Newer (T1 > T2)**
- **Expected:** Cloud version overwrites local
- **Console:** Shows "X answers restored"

**4b. Local is Newer (T2 > T1)**
- **Expected:** Local version preserved
- **Console:** Shows "X answers already current"

**4c. Timestamps Equal**
- **Expected:** Local version preserved (no change)
- **Console:** Shows answer as "already current"

### Scenario 5: File Protocol (file://)
**Prerequisites:**
- App served via `file://` protocol (not http/https)

**Steps:**
1. Open `index.html` directly in browser (file:// protocol)
2. Enable turbo mode (if Supabase configured)
3. Log in with a username
4. Create and submit a chart
5. Refresh the page
6. Navigate to the same question

**Expected Results:**
- Hydration works with file:// protocol
- Chart reappears after refresh
- No CORS errors in console

### Scenario 6: New User (No Cloud Data)
**Prerequisites:**
- Username has no existing answers in Supabase/Railway

**Steps:**
1. Open the app
2. Create a new username
3. Observe console during initialization

**Expected Results:**
- Console shows: `✅ No cloud answers found for [username] (new user or local-only)`
- No errors thrown
- App continues to work normally

### Scenario 7: Offline/No Connection
**Prerequisites:**
- No network connection or Supabase/Railway unavailable

**Steps:**
1. Disable network or stop servers
2. Open the app with existing local data
3. Navigate to a question with local chart answer

**Expected Results:**
- Hydration fails gracefully
- Console shows connection errors
- Local data still accessible
- App functions in offline mode

## Debugging

### Console Messages to Watch For

**Success Indicators:**
- `💧 Hydrating answers for [username] from [Supabase|Railway]...`
- `📊 Hydrated chart for [question-id]`
- `✅ Hydration complete: X answers restored, Y already current`
- `🔄 Re-rendering question [question-id] after hydration`

**Warning Indicators:**
- `⚠️ No current user - skipping hydration`
- `⚠️ Railway hydration failed, falling back to Supabase`
- `✅ No cloud answers found for [username] (new user or local-only)`

**Error Indicators:**
- `❌ Hydration failed: [error message]`
- `❌ Railway hydration failed: [error message]`

### Verification Queries

**Check Supabase Data:**
```sql
SELECT username, question_id,
       LEFT(answer_value, 50) as answer_preview,
       timestamp
FROM answers
WHERE username = 'YourUsername'
ORDER BY timestamp DESC;
```

**Check Local Storage (Browser DevTools):**
```javascript
// Check current user's answers
const user = localStorage.getItem('consensusUsername');
const answers = JSON.parse(localStorage.getItem(`answers_${user}`) || '{}');
console.log(answers);

// Check classData
console.log(classData.users[user].answers);
console.log(classData.users[user].charts);
```

## Known Limitations

1. **Refresh Timing**: Hydration happens during `initializeTurboMode()`, which requires turbo mode to be active
2. **Question Navigation**: Re-render only triggers if the question is currently visible (via `getCurrentQuestionId()`)
3. **Chart Recognition**: Only detects charts if `answer_value` is valid JSON with a `chartType` property
4. **Railway Endpoint**: Railway hydration uses `/api/peer-data` which returns ALL users, then filters client-side

## Future Enhancements

Potential improvements identified during implementation:

1. **Dedicated Railway Endpoint**: Add `/api/user-answers/:username` endpoint to Railway for more efficient single-user hydration
2. **Offline Recovery**: Implement session storage fallback for when localStorage is denied
3. **Batch Hydration**: Optimize hydration by fetching only questions in current unit/lesson
4. **Progressive Rendering**: Show charts as they hydrate instead of waiting for all answers

## Related Files

- `/home/user/code/index.html` (lines 876-1162): Hydration functions and `initializeTurboMode()`
- `/home/user/code/railway_config.js`: Railway configuration
- `/home/user/code/railway-server/server.js` (lines 69-124): `/api/peer-data` endpoint
- `/home/user/code/railway_client.js` (lines 237-291): Railway client that may override functions
