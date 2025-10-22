# Authentication Flow

## Overview
The AP Statistics Consensus Quiz uses **anonymous username-based authentication** with no passwords, sessions, or server-side verification.

See `docs/architecture/adr-004-anonymous-auth.md` for the architectural decision and rationale.

## Authentication States

```
┌─────────────┐
│ New Visitor │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Check localStorage  │
│ currentUsername?    │
└──────┬──────┬───────┘
       │      │
    NO │      │ YES
       │      │
       ▼      ▼
┌──────────┐ ┌──────────────┐
│ Show     │ │ Auto-Login   │
│ Username │ │ (Silent)     │
│ Prompt   │ │              │
└─────┬────┘ └──────┬───────┘
      │             │
      ▼             │
┌──────────────┐    │
│ Validate     │    │
│ Username     │    │
└──────┬───────┘    │
       │            │
       ▼            │
┌──────────────┐    │
│ Store in     │    │
│ localStorage │    │
└──────┬───────┘    │
       │            │
       └────┬───────┘
            │
            ▼
    ┌───────────────┐
    │ Authenticated │
    │ (App Ready)   │
    └───────────────┘
```

## Detailed Flows

### 1. New User Flow

**Step 1: Check for existing session**
```javascript
// On page load
const currentUsername = localStorage.getItem('currentUsername');

if (!currentUsername) {
    // Show username prompt
    promptForUsername();
}
```

**Step 2: Username generation/entry**

User has two options:

**Option A: Auto-generate random username**
```javascript
function generateUsername() {
    const fruits = ['Apple', 'Banana', 'Cherry', 'Mango', 'Orange', 'Peach'];
    const animals = ['Penguin', 'Koala', 'Panda', 'Dolphin', 'Tiger', 'Bear'];

    const fruit = fruits[Math.floor(Math.random() * fruits.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];

    return `${fruit}_${animal}`;
}
```

**Option B: Enter custom username**
- User types preferred username
- Validation applied (see below)
- If valid, proceed; if invalid, show error and retry

**Step 3: Validation**
```javascript
function isValidUsername(username) {
    // Minimum length
    if (!username || username.length < 3) return false;

    // Block email patterns
    if (username.includes('@')) return false;

    // Block phone patterns (10+ digits)
    if (username.replace(/\D/g, '').length >= 10) return false;

    // Block name-like patterns
    if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(username)) return false;

    // Allow only alphanumeric and underscore
    return /^[A-Za-z0-9_]+$/.test(username);
}
```

**Step 4: Store and initialize**
```javascript
// Save username
localStorage.setItem('currentUsername', username);

// Initialize user data
initClassData();  // Creates user entry in classData
initializeProgressTracking();  // Sets up session tracking

// Show welcome message
showUsernameWelcome();
```

### 2. Returning User Flow

**Automatic silent login:**
```javascript
// On page load
const currentUsername = localStorage.getItem('currentUsername');

if (currentUsername) {
    // Validate data exists
    initClassData();  // Loads or creates classData

    // Auto-login - no prompt
    console.log(`Welcome back, ${currentUsername}!`);

    // Continue to app
    initializeFromEmbeddedData();
}
```

**No password check, no server verification.**

### 3. Logout / Switch User Flow

```javascript
function logout() {
    // Export data first (optional)
    const confirmExport = confirm('Export your data before logging out?');
    if (confirmExport) {
        exportPersonalData();
    }

    // Clear session
    localStorage.removeItem('currentUsername');

    // Reload page to show username prompt
    location.reload();
}
```

**Note:** This doesn't delete user data from `classData`, only clears the active session.

## Data Access Model

### Read Operations
**Anyone can read any user's answers** (by design for peer learning)

```javascript
// Get peer answers for a question
function getPeerAnswers(questionId) {
    const allUsers = classData.users;
    const peerAnswers = [];

    Object.keys(allUsers).forEach(username => {
        if (username !== currentUsername) {  // Exclude self
            const answer = allUsers[username].answers[questionId];
            if (answer) {
                peerAnswers.push({
                    username,
                    answer: answer.value,
                    timestamp: answer.timestamp
                });
            }
        }
    });

    return peerAnswers;
}
```

### Write Operations
**Users write only to their own username key**

```javascript
// Save answer
function saveAnswer(questionId, answer) {
    // Write to own data
    classData.users[currentUsername].answers[questionId] = {
        value: answer,
        timestamp: Date.now(),
        type: 'multiple-choice'
    };

    // Persist to localStorage
    saveClassData();

    // Optionally sync to cloud
    if (USE_SUPABASE) {
        syncAnswerToSupabase(questionId, answer);
    }
}
```

**Client-side validation prevents accidental overwrites**, but **no enforcement** against intentional impersonation.

### Supabase (Optional Cloud Sync)

When Supabase sync is enabled:

**Read:**
```javascript
// Fetch peer data from Supabase
const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('question_id', questionId);
```

**Write:**
```javascript
// Upsert own answer
const { error } = await supabase
    .from('answers')
    .upsert({
        username: currentUsername,
        question_id: questionId,
        answer_value: answer,
        timestamp: new Date()
    });
```

**Row-Level Security (RLS) in Supabase:**
```sql
-- Future: Enforce username-based write access
-- Currently: Trust client, use ANON_KEY with read-only policies
```

## Security Considerations

### What This Model Protects

✅ **Privacy:** No real names, emails, or PII collected
✅ **COPPA compliance:** No personal data from minors
✅ **Simplicity:** No password leaks, credential stuffing, or session hijacking

### What This Model Does NOT Protect

❌ **Impersonation:** Anyone can claim any username
❌ **Data ownership:** No proof username represents same person over time
❌ **Cross-device identity:** Username on Device A ≠ Username on Device B

### Risk Mitigation

**For impersonation:**
- Low stakes (no grades, no money)
- Timestamp and activity patterns can detect abuse
- Teacher oversight (future dashboard)

**For data loss:**
- Export/import functionality
- Optional cloud backup via Supabase
- Warning messages before clearing data

**For multi-device:**
- Optional Supabase sync allows same username on multiple browsers
- Manual export/import as fallback

## Example Scenarios

### Scenario 1: Student on Lab Computer
1. Sits at computer, opens app
2. Generates username `Mango_Tiger`
3. Answers questions, data saved to localStorage
4. Closes browser at end of class
5. Next day, different computer:
   - Must generate new username (or import data)
   - Cannot access yesterday's `Mango_Tiger` data (unless exported)

**Solution:** Enable Supabase sync OR export data before leaving.

### Scenario 2: Student at Home
1. Opens app on personal laptop
2. Uses username `Alice_Stats`
3. Answers questions over multiple days
4. localStorage persists (same browser, same device)
5. Seamless experience, no re-login needed

### Scenario 3: Peer Collaboration
1. Student A (`Apple_Penguin`) submits answer "B"
2. Student B (`Banana_Koala`) views peer answers
3. Sees `Apple_Penguin` chose "B" (anonymous)
4. Cannot determine who `Apple_Penguin` is in real life
5. Votes on `Apple_Penguin`'s reasoning

**Privacy preserved:** Real identity not revealed.

### Scenario 4: Teacher Use
1. Teacher generates username `Teacher_Demo`
2. Exports master class data (all students)
3. Analyzes in CSV or re-imports on different device
4. Uses admin features (future) with teacher account

## Implementation Files

- **Username generation:** `js/auth.js` function `generateUsername()`
- **Validation:** `js/auth.js` function `isValidUsername()`
- **Session init:** `js/auth.js` function `promptForUsername()`
- **Data storage:** `js/data_manager.js` function `initClassData()`
- **Logout:** `index.html` inline functions

## Future Enhancements

### Planned:
- **Teacher accounts:** Password-protected admin with class roster
- **Class codes:** Students join with code, teacher sees roster
- **Activity dashboard:** Teacher monitors student progress

### Considered:
- **LTI integration:** SSO from Canvas/Schoology
- **Magic links:** Email-based passwordless auth
- **Device fingerprinting:** Detect returning users

**Current stance:** Keep simple until evidence of need.

## Testing

### Manual Test: New User
1. Open app in incognito window
2. Should see username prompt
3. Click "Generate Random"
4. Should create and store username
5. Check `localStorage.currentUsername` in DevTools

### Manual Test: Returning User
1. Set `localStorage.currentUsername = "TestUser"`
2. Reload page
3. Should NOT see username prompt
4. Should auto-login as `TestUser`

### Manual Test: Validation
```javascript
// In console
isValidUsername("Apple_Penguin");  // true
isValidUsername("test@email.com"); // false
isValidUsername("555-1234");       // false
isValidUsername("John Smith");     // false
```

## References
- ADR-004: Anonymous Authentication Model
- `js/auth.js`: Implementation
- `docs/security/logging-policy.md`: PII handling
