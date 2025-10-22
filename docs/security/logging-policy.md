# Logging Policy - PII Protection

## Overview
This application serves K-12 students and must comply with COPPA (Children's Online Privacy Protection Act) and FERPA (Family Educational Rights and Privacy Act).

**Core Principle:** Never log Personally Identifiable Information (PII).

## What is PII?

Personally Identifiable Information includes:

✅ **PII (Never Log):**
- Real student names (First Last)
- Email addresses (user@domain.com)
- Phone numbers (xxx-xxx-xxxx)
- Social Security Numbers (xxx-xx-xxxx)
- Street addresses (123 Main Street)
- IP addresses (log hashed version only)
- Device IDs
- Student ID numbers
- CSV mapping data (real name → username)

✅ **Non-PII (Safe to Log):**
- Anonymous usernames (Fruit_Animal format)
- Question IDs (U1-L2-Q01)
- Timestamps (2024-01-15T10:30:00Z)
- Answer choices (A, B, C, D)
- Aggregate statistics (class average: 75%)
- Feature usage metrics (chart viewed 5 times)

## Logging Rules by Layer

### Client-Side (Browser Console)

**Automatic Sanitization:**
All `console.log` statements are automatically sanitized via `js/safe_logger.js`:

```javascript
// Before sanitization
console.log("Email: john.doe@email.com");

// After sanitization (automatic)
// Output: "Email: [EMAIL]"
```

**Patterns Redacted:**
- Email: `user@domain.com` → `[EMAIL]`
- Phone: `555-1234` → `[PHONE]`
- SSN: `123-45-6789` → `[SSN]`
- Name: `John Smith` → `[NAME]`

**Safe Logging Methods:**
```javascript
// ✅ SAFE: Use SafeLogger for events
SafeLogger.event('answer_submitted', {
    questionId: 'U1-L2-Q01',
    answer: 'B',
    timestamp: Date.now()
});

// ✅ SAFE: Anonymous username
console.log('User:', 'Apple_Penguin');

// ❌ UNSAFE: Real name
console.log('Student:', 'John Smith');  // Auto-redacted to [NAME]

// ❌ UNSAFE: Email
console.log('Email:', 'john@school.com');  // Auto-redacted to [EMAIL]
```

**Bypass for Debugging (Use Sparingly):**
```javascript
// Only for local debugging - raw output
console.raw('Debug:', dataWithPotentialPII);
```

### Server-Side (Railway Server)

**Never Log:**
- Request bodies containing user data
- Query parameters with usernames
- Full request headers (may contain tokens)

**Safe Logging:**
```javascript
// ✅ SAFE: Sanitized headers
const safeHeaders = sanitizeHeaders(req.headers);
console.log('Request headers:', safeHeaders);

// ✅ SAFE: Endpoint only
console.log('Request:', req.method, req.path);

// ✅ SAFE: Aggregate stats
console.log('Cache hit rate:', cacheHits / totalRequests);

// ❌ UNSAFE: Full request
console.log('Request:', req);  // May contain PII

// ❌ UNSAFE: Query params
console.log('Query:', req.query);  // May contain usernames
```

**Use Logging Functions:**
```javascript
import { logError, sanitizeBody } from './middleware/secrets.js';

// Log errors safely
try {
    // ... operation
} catch (error) {
    logError(error, { endpoint: req.path });
}

// Sanitize before logging
console.log('Body:', sanitizeBody(req.body));
```

### CSV Student Mapping

**CRITICAL:** Never log CSV student mapping data

```javascript
// ❌ NEVER DO THIS
console.log('Student mapping:', csvData);  // Contains real names!

// ❌ NEVER DO THIS
console.log('Processing:', studentName);   // PII!

// ✅ SAFE: Only log count
console.log('Loaded mapping entries:', csvData.length);

// ✅ SAFE: Validate without logging
const valid = validateStudentCSV(csvContent);
console.log('Validation result:', valid ? 'OK' : 'Errors found');
```

## Implementation

### Client-Side Auto-Sanitization

**File:** `js/safe_logger.js`

Automatically loaded before other scripts:
```html
<script src="js/error_handler.js"></script>
<script src="js/safe_logger.js"></script>  <!-- Must be early -->
<script src="js/auth.js"></script>
```

### Server-Side Sanitization

**File:** `railway-server/middleware/secrets.js`

```javascript
import { sanitizeHeaders, sanitizeBody, logError } from './middleware/secrets.js';

app.use((req, res, next) => {
    // Log sanitized request
    console.log(req.method, req.path);
    console.log('Headers:', sanitizeHeaders(req.headers));
    next();
});
```

## Testing PII Detection

### Manual Tests

```javascript
// Test username validation
AuthValidator.isValidUsername('john.doe@email.com');  // false (email)
AuthValidator.isValidUsername('Apple_Penguin');       // true

// Test PII detection
AuthValidator.containsPII('John Smith');         // true (name)
AuthValidator.containsPII('555-1234');          // true (phone)
AuthValidator.containsPII('Question U1-L2-Q01'); // false

// Test sanitization
SafeLogger.sanitizeText('Email me at john@email.com');
// Output: "Email me at [EMAIL]"
```

### Automated Tests

**File:** `tools/pii_scanner.js`

```bash
# Scan codebase for PII in logs
node tools/pii_scanner.js

# Should detect:
# ❌ console.log("Email: john@email.com")
# ❌ console.log("Student: John Smith")

# Should allow:
# ✅ console.log("User: Apple_Penguin")
# ✅ console.log("Question: U1-L2-Q01")
```

Run automatically in CI:
```yaml
# .github/workflows/pii-check.yml
- name: Check for PII in logs
  run: node tools/pii_scanner.js
```

## Analytics & Metrics

### Safe Metrics to Collect

✅ **Allowed:**
- Question completion rates
- Average time per question
- Chart view counts
- Peer voting participation
- Badge earn counts
- Feature usage (modals opened, exports clicked)

❌ **Not Allowed:**
- Individual student performance tracking
- Username → IP address mapping
- Session duration per real name
- Real name in any analytics event

### Example Analytics Events

```javascript
// ✅ SAFE
SafeLogger.event('question_answered', {
    questionId: 'U1-L2-Q01',
    questionType: 'multiple-choice',
    timeSpent: 45000,  // ms
    attemptNumber: 1
});

// ✅ SAFE: Aggregate
SafeLogger.event('class_summary', {
    totalStudents: 30,
    avgScore: 0.75,
    completionRate: 0.90
});

// ❌ UNSAFE: Individual student
SafeLogger.event('student_performance', {
    name: 'John Smith',     // PII!
    score: 85
});
```

## Data Exports

### Teacher Data Exports (Master File)

**Contains:** Anonymous usernames only
**Format:** JSON with username keys

```json
{
  "users": {
    "Apple_Penguin": {
      "answers": {...},
      "timestamps": {...}
    },
    "Banana_Koala": {...}
  }
}
```

**Does NOT contain:** Real names, emails, student IDs

### Student Data Exports (Personal File)

**Contains:** User's own data only
**Format:** JSON with anonymous username

```json
{
  "username": "Apple_Penguin",
  "answers": {...},
  "exportDate": "2024-01-15T10:30:00Z"
}
```

## CSV Import Privacy

When importing student mappings (CSV with real names):

**Rule:** Process in memory, never log, never sync to cloud

```javascript
// ✅ SAFE: Process locally only
function loadStudentMapping(csvContent) {
    const mapping = parseCSV(csvContent);

    // Store in memory only
    window.studentMapping = mapping;  // Not in localStorage!

    // Log count only
    console.log('Loaded entries:', mapping.length);

    // NEVER log the actual mapping
}
```

## Incident Response

### If PII Accidentally Logged

**Client-Side (Browser Console):**
1. Clear browser console (user's local machine only)
2. No persistent storage - no further action needed

**Server-Side (Railway Logs):**
1. Contact Railway support to purge logs
2. Rotate any exposed credentials
3. Notify affected users if required by law
4. Document incident and update logging policy

**In Git History:**
1. If PII committed to git:
   ```bash
   git filter-branch --force --index-filter \
       "git rm --cached --ignore-unmatch path/to/file" \
       --prune-empty --tag-name-filter cat -- --all
   ```
2. Force push (⚠️ coordinate with team)
3. Notify all developers to re-clone
4. Consider repository as compromised, start fresh if critical

## Compliance Checklist

Before deploying:

- [ ] ✅ `safe_logger.js` loaded before other scripts
- [ ] ✅ All `console.log` statements reviewed
- [ ] ✅ CSV data never logged or synced
- [ ] ✅ Server logs use `sanitizeHeaders()` and `sanitizeBody()`
- [ ] ✅ Analytics events use anonymous identifiers only
- [ ] ✅ `pii_scanner.js` passes without warnings
- [ ] ✅ Export files contain only anonymous usernames
- [ ] ✅ Teacher understands: real names stay in CSV, never in app

## Legal References

**COPPA (Children's Online Privacy Protection Act):**
- Prohibits collection of PII from children under 13 without parental consent
- Our compliance: We collect zero PII, only anonymous usernames

**FERPA (Family Educational Rights and Privacy Act):**
- Protects student education records
- Our compliance: No education records stored server-side; all data anonymous

**State Laws (e.g., CCPA):**
- May require disclosure of data collection practices
- Our compliance: Privacy policy states "no personal data collected"

## References
- Implementation: `js/safe_logger.js`, `railway-server/middleware/secrets.js`
- Validation: `tools/pii_scanner.js`
- CSV handling: `index.html` CSV import modal
- ADR: `docs/architecture/adr-004-anonymous-auth.md`
