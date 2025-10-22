# ADR-004: Anonymous Authentication Model

## Status
Accepted

## Context
This application serves K-12 students in an educational setting. Traditional authentication systems pose several challenges:

**Legal & Privacy Concerns:**
- COPPA (Children's Online Privacy Protection Act) restricts data collection for users under 13
- FERPA (Family Educational Rights and Privacy Act) governs student education records
- School districts have strict policies on student PII collection

**Practical Concerns:**
- Password management burden on students and teachers
- Forgotten password support requires email access (often unavailable)
- Account creation friction reduces classroom adoption
- Students share devices (lab computers, Chromebooks)

**Educational Goals:**
- Focus on learning statistics, not account management
- Peer collaboration requires some form of identity
- Anonymous participation encourages honest engagement

## Decision

### Anonymous Username-Based Authentication

**No passwords, sessions, or JWT tokens.**

Students are identified by:
- **Username format:** `Fruit_Animal` (e.g., `Apple_Penguin`, `Banana_Koala`)
- **Storage:** Browser `localStorage` only
- **Generation:** Auto-generated or custom (validated for PII)

### Authentication Flow

**New User:**
1. User visits app
2. Prompted for username (generate random or enter custom)
3. Username validated (alphanumeric + underscore, no email/phone patterns)
4. Stored in `localStorage.currentUsername`
5. No server verification

**Returning User:**
1. Check `localStorage.currentUsername`
2. If exists, auto-login
3. If cleared, re-prompt (no password recovery)

**Data Access:**
- **Read:** Anyone can read any user's answers (by design for peer learning)
- **Write:** Users write to their own username key in data structures
- **No enforcement:** Trust model - impersonation possible but not incentivized

### Security Model

**What We Protect:**
- Student identity (no real names collected)
- PII leakage (email, phone, SSN patterns blocked)
- Cross-site data access (CORS, CSP)

**What We Don't Protect:**
- Impersonation (not a concern in collaborative learning)
- Password security (no passwords exist)
- Session hijacking (no sessions exist)

## Consequences

### Positive
✅ **Zero PII collected** - COPPA/FERPA compliant by design
✅ **No password resets** - Eliminates entire support category
✅ **Instant onboarding** - Students start learning immediately
✅ **Shared device friendly** - No account lockout on lab computers
✅ **Privacy-first** - Cannot track students across devices
✅ **Simple implementation** - No auth server, session management, or token logic

### Negative
❌ **No cross-device sync** - Username tied to single browser (unless cloud sync)
❌ **Impersonation possible** - Students can guess peers' usernames
❌ **No account recovery** - Clearing browser data loses identity
❌ **Data ownership unclear** - Anyone can write to any username (mitigated by Supabase RLS)

### Mitigations

**For cross-device sync:**
- Optional Supabase sync allows same username on multiple devices
- Export/import feature for manual data transfer

**For impersonation:**
- Not a security concern in collaborative learning context
- Teachers can monitor via class dashboard (future feature)
- Fruit_Animal format makes guessing harder than simple names

**For data loss:**
- Export functionality allows backup
- Teachers can export master class data
- Cloud sync (optional) provides automatic backup

**For data ownership:**
- Supabase RLS policies enforce username-based access control
- Client-side validation prevents accidental overwrites
- Timestamp-based conflict resolution

## Trust Model

This application uses a **collaborative trust model**:

```
Traditional Auth:       Anonymous Auth (This App):
─────────────────       ──────────────────────────
Password ────────►      Username ───────►
Session Token ───►      No Session
Server Validates ►      Client-Only
Locked Down ─────►      Open by Design
```

**Assumption:** Students in a classroom setting are cooperating learners, not adversaries.

**Risk Acceptance:** Impersonation is theoretically possible but:
- Not incentivized (no grades, no stakes)
- Detectable (timestamps, activity patterns)
- Mitigated by teacher oversight

## Examples

### Username Validation

```javascript
// ✅ Valid usernames
"Apple_Penguin"
"StudentA"
"Stats2024"
"alice_wonder_2"

// ❌ Invalid usernames (rejected)
"john.doe@email.com"    // Email pattern
"555-1234"              // Phone pattern
"John Smith"            // Real name pattern
"a"                     // Too short
"user@domain"           // Contains @
```

### Data Structure

```javascript
// localStorage.classData
{
  "users": {
    "Apple_Penguin": {
      "answers": {
        "U1-L2-Q01": {
          "value": "B",
          "timestamp": 1697865600000,
          "type": "multiple-choice"
        }
      },
      "reasons": {},
      "timestamps": {},
      "currentActivity": {
        "state": "answering",
        "questionId": "U1-L2-Q01",
        "lastUpdate": 1697865600000
      }
    }
  }
}
```

### Username in Supabase (Optional Cloud Sync)

```sql
-- Supabase RLS policy (Row-Level Security)
CREATE POLICY "Users can only update their own data"
ON answers FOR UPDATE
USING (username = current_setting('request.jwt.claim.username'));
```

**Note:** With anonymous auth, we use `SUPABASE_ANON_KEY` (public key) and rely on client-side username filtering. Server-side enforcement in future versions.

## Alternatives Considered

### Email/Password Authentication (Rejected)
**Pros:** Industry standard, secure, cross-device
**Cons:** COPPA violations, password reset complexity, onboarding friction
**Why Rejected:** Incompatible with K-12 privacy requirements

### Social Login (Google/Microsoft) (Rejected)
**Pros:** Single sign-on, managed by school district
**Cons:** Requires OAuth setup, ties to real identity, not all schools use
**Why Rejected:** Defeats anonymous learning goal

### Unique Device ID (Rejected)
**Pros:** Automatic, no user input
**Cons:** Ties to device (not user), creepy tracking, browser fingerprinting concerns
**Why Rejected:** Privacy invasive, not transparent to users

### Magic Link Email (Rejected)
**Pros:** Passwordless, secure
**Cons:** Requires email (often unavailable for K-12), onboarding delay
**Why Rejected:** Email assumption invalid for target users

## Future Considerations

### If anonymous model proves insufficient:
1. **Teacher accounts:** Password-protected admin for class management
2. **Class codes:** Join code per class section for light access control
3. **LTI integration:** Learning Management System (Canvas, Schoology) SSO

### If impersonation becomes a problem:
1. **IP-based rate limiting:** Prevent mass impersonation
2. **Activity fingerprinting:** Detect anomalous behavior
3. **Teacher dashboard:** Monitor and flag suspicious patterns

**Current stance:** Wait for real-world usage before adding complexity.

## References
- Implementation: `js/auth.js` (username generation and validation)
- Data model: `js/data_manager.js` (localStorage structure)
- Privacy policy: `docs/security/logging-policy.md` (PII handling)
- Legal compliance: COPPA 15 U.S.C. §§ 6501–6506, FERPA 20 U.S.C. § 1232g
