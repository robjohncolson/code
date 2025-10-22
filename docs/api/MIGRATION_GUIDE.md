# Migration Guide: REST API v2.0

## Overview

This guide covers migrating from the legacy Railway server to the new REST API v2.0 architecture with JWT authentication, input validation, and standardized error handling.

**Migration Timeline:** Recommended 2-4 weeks
**Backward Compatibility:** Legacy endpoints maintained during transition

---

## What's New in v2.0

### 1. RESTful API Structure
- Proper HTTP methods (GET, POST, PATCH, DELETE)
- Resource-based URLs (`/api/profiles/:username`)
- Standardized response formats

### 2. JWT Authentication
- Token-based authentication for all users
- Anonymous student sessions with Fruit_Animal usernames
- Teacher authentication with access codes

### 3. Input Validation
- Comprehensive validation using express-validator
- PII detection and rejection
- Automatic error responses with field-level details

### 4. Rate Limiting
- Protection against abuse and DDoS
- Different limits for different operations
- Redis support for distributed limiting

### 5. Error Handling
- Standardized error response format
- Proper HTTP status codes
- Detailed validation error messages

---

## Migration Steps

### Phase 1: Server Deployment (Week 1)

#### Step 1: Install Dependencies

```bash
cd railway-server
npm install
```

New dependencies added:
- `express-validator` - Input validation
- `jsonwebtoken` - JWT authentication
- `express-rate-limit` - Rate limiting
- `redis` - Optional Redis support

#### Step 2: Environment Variables

Update your `.env` file:

```bash
# Existing
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
PORT=3000

# New Required
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRY=24h

# Optional
REDIS_URL=redis://localhost:6379
NODE_ENV=production
CORS_ORIGIN=*
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 3: Deploy New Server

The new server maintains backward compatibility:

```bash
# Option A: Use new server (recommended)
npm start

# Option B: Keep old server running
npm run start:old
```

Both servers can run simultaneously on different ports during migration.

#### Step 4: Verify Deployment

```bash
# Health check
curl http://localhost:3000/health

# Legacy endpoint (should still work)
curl http://localhost:3000/api/peer-data

# New REST endpoint
curl http://localhost:3000/api/answers/U1-L1-Q01
```

---

### Phase 2: Client Migration (Week 2-3)

#### Authentication Changes

**Before (Legacy):**
```javascript
// No authentication - direct Supabase calls
const username = localStorage.getItem('username');
```

**After (v2.0):**
```javascript
// 1. Create profile and get token
const response = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Apple_Penguin' })
});

const { token, profile } = await response.json();
localStorage.setItem('auth_token', token);

// 2. Use token in subsequent requests
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};
```

#### Submit Answer Changes

**Before (Legacy):**
```javascript
await fetch('/api/submit-answer', {
    method: 'POST',
    body: JSON.stringify({
        username: currentUsername,
        question_id: 'U1-L1-Q01',
        answer_value: 'B',
        timestamp: Date.now()
    })
});
```

**After (v2.0):**
```javascript
const token = localStorage.getItem('auth_token');

await fetch('/api/answers', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        question_id: 'U1-L1-Q01',
        answer_value: 'B',
        reasoning: 'Optional explanation'
    })
});
// Username automatically extracted from JWT token
```

#### Get Peer Data Changes

**Before (Legacy):**
```javascript
const response = await fetch('/api/peer-data');
const { data } = await response.json();
```

**After (v2.0):**
```javascript
// Option 1: Get answers for specific question
const response = await fetch('/api/answers/U1-L1-Q01');
const answers = await response.json();

// Option 2: Use legacy endpoint (still supported)
const response = await fetch('/api/peer-data');
const { data } = await response.json();
```

#### Vote Casting Changes

**Before (Legacy):**
```javascript
// Direct Supabase call
await supabase.from('votes').insert({
    question_id: 'U1-L1-Q01',
    voter_username: currentUsername,
    target_username: 'Banana_Koala',
    vote_type: 'helpful'
});
```

**After (v2.0):**
```javascript
const token = localStorage.getItem('auth_token');

await fetch('/api/votes', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        question_id: 'U1-L1-Q01',
        target_username: 'Banana_Koala',
        vote_type: 'helpful'
    })
});
// Voter username extracted from JWT
```

#### Progress Tracking Changes

**Before (Legacy):**
```javascript
// Direct localStorage
localStorage.setItem('progress_unit1_lesson1', JSON.stringify({
    completed: 8,
    total: 10
}));
```

**After (v2.0):**
```javascript
const token = localStorage.getItem('auth_token');

await fetch('/api/progress', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        unit_id: 'unit1',
        lesson_id: 'lesson1',
        questions_completed: 8,
        questions_total: 10
    })
});
```

#### Error Handling Changes

**Before (Legacy):**
```javascript
try {
    const response = await fetch('/api/submit-answer', { ... });
    if (!response.ok) {
        throw new Error('Request failed');
    }
} catch (error) {
    alert('Error: ' + error.message);
}
```

**After (v2.0):**
```javascript
try {
    const response = await fetch('/api/answers', { ... });

    if (!response.ok) {
        const error = await response.json();

        if (error.error === 'Validation failed') {
            // Show field-specific errors
            error.details.forEach(detail => {
                console.error(`${detail.field}: ${detail.message}`);
            });
        } else if (error.error === 'Unauthorized') {
            // Token expired - refresh or re-authenticate
            await refreshToken();
        } else if (error.error === 'Too Many Requests') {
            // Rate limited - wait and retry
            setTimeout(() => retry(), error.retryAfter * 1000);
        }

        throw new Error(error.message);
    }

    return await response.json();
} catch (error) {
    console.error('API Error:', error);
}
```

---

### Phase 3: Testing (Week 3-4)

#### Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

#### Integration Testing

Create a test user and verify all endpoints:

```bash
# 1. Create test profile
curl -X POST http://localhost:3000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"username":"Test_User_123"}'

# 2. Extract token from response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 3. Submit answer
curl -X POST http://localhost:3000/api/answers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question_id":"U1-L1-Q01","answer_value":"B"}'

# 4. Get peer answers
curl http://localhost:3000/api/answers/U1-L1-Q01

# 5. Cast vote
curl -X POST http://localhost:3000/api/votes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question_id":"U1-L1-Q01","target_username":"Another_User","vote_type":"helpful"}'
```

#### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test endpoint performance
ab -n 1000 -c 10 http://localhost:3000/api/health
ab -n 100 -c 5 -T application/json -p answer.json http://localhost:3000/api/answers
```

---

### Phase 4: Rollout (Week 4)

#### Gradual Rollout Strategy

1. **Internal Testing (Day 1-2)**
   - Deploy to staging environment
   - Test with teacher accounts
   - Verify all functionality

2. **Beta Testing (Day 3-5)**
   - Deploy to production alongside legacy server
   - Enable for 10% of users (feature flag)
   - Monitor error rates and performance

3. **Staged Rollout (Day 6-10)**
   - Increase to 25% of users
   - Increase to 50% of users
   - Increase to 100% of users
   - Monitor at each stage

4. **Legacy Deprecation (Week 5+)**
   - Announce deprecation date (30 days notice)
   - Show migration warnings to legacy users
   - Disable legacy endpoints after grace period

---

## Backward Compatibility

The new server maintains backward compatibility with legacy endpoints:

| Legacy Endpoint | Status | v2.0 Alternative |
|----------------|--------|------------------|
| `/api/peer-data` | ✅ Supported | `/api/answers/:question_id` |
| `/api/submit-answer` | ✅ Supported | `POST /api/answers` |
| `/api/batch-submit` | ✅ Supported | Multiple `POST /api/answers` |
| `/api/question-stats/:id` | ✅ Supported | `/api/answers/:id/stats` |
| `/api/stats` | ✅ Supported | `/api/health` |

WebSocket functionality remains unchanged and fully compatible.

---

## Breaking Changes

### 1. Authentication Required

Most endpoints now require JWT authentication:

```javascript
// Before: No auth needed
fetch('/api/submit-answer', {...});

// After: Auth required
fetch('/api/answers', {
    headers: { 'Authorization': 'Bearer ' + token }
});
```

**Affected Endpoints:**
- POST /api/answers
- POST /api/votes
- POST /api/progress
- PATCH /api/profiles/:username

**Not Affected (optional auth):**
- GET /api/answers/:question_id
- GET /api/profiles/:username
- GET /api/health

### 2. Response Format Changes

Error responses now use standardized format:

```javascript
// Before
{ error: "Something went wrong" }

// After
{
    error: "ValidationError",
    message: "Invalid input data",
    code: "VALIDATION_ERROR",
    details: [
        { field: "username", message: "Too short" }
    ],
    timestamp: "2024-01-15T10:30:00Z"
}
```

### 3. Username in JWT Claims

Username no longer needs to be sent in request body:

```javascript
// Before
body: { username: "Apple_Penguin", question_id: "...", ... }

// After (username from JWT)
body: { question_id: "...", ... }
```

---

## Troubleshooting

### Issue: "Authentication required" Error

**Cause:** Missing or invalid JWT token

**Solution:**
```javascript
// Check if token exists
const token = localStorage.getItem('auth_token');
if (!token) {
    // Create new profile
    await createProfile();
}

// Check if token is expired
try {
    const response = await fetch('/api/answers', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
} catch (error) {
    if (error.status === 401) {
        // Token expired, get new one
        await refreshToken();
    }
}
```

### Issue: Rate Limit Exceeded

**Cause:** Too many requests from same IP/user

**Solution:**
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (error.status === 429) {
                const retryAfter = error.retryAfter || (2 ** i);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
            } else {
                throw error;
            }
        }
    }
}
```

### Issue: Validation Errors

**Cause:** Invalid input data

**Solution:**
```javascript
// Check validation error details
const response = await fetch('/api/profiles', {...});
const error = await response.json();

if (error.details) {
    error.details.forEach(detail => {
        console.log(`Field ${detail.field}: ${detail.message}`);
        // Show user-friendly error in UI
    });
}
```

### Issue: WebSocket Disconnects

**Cause:** Server shutdown or network issues

**Solution:**
```javascript
// Implement reconnection logic
let ws;
let reconnectAttempts = 0;

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('Connected');
        reconnectAttempts = 0;
    };

    ws.onclose = () => {
        if (reconnectAttempts < 5) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, 1000 * reconnectAttempts);
        }
    };
}
```

---

## Performance Considerations

### Caching Strategy

The new API includes 30-second caching for peer data:

```javascript
// First request - hits database
await fetch('/api/answers/U1-L1-Q01'); // ~50ms

// Subsequent requests within 30s - from cache
await fetch('/api/answers/U1-L1-Q01'); // ~5ms
```

### Rate Limits

Be aware of rate limits for different operations:

| Operation | Limit | Window |
|-----------|-------|--------|
| Profile creation | 5 | 1 hour |
| Answer submission | 30 | 1 minute |
| Voting | 60 | 1 minute |
| Read operations | 100 | 1 minute |

**Best Practice:** Batch operations when possible and implement client-side caching.

---

## Migration Checklist

### Server Side
- [ ] Install new dependencies (`npm install`)
- [ ] Configure environment variables (JWT_SECRET)
- [ ] Deploy new server to staging
- [ ] Run integration tests
- [ ] Deploy to production
- [ ] Monitor error logs

### Client Side
- [ ] Update authentication flow (JWT tokens)
- [ ] Update API endpoints (REST format)
- [ ] Update error handling (standardized format)
- [ ] Add retry logic for rate limits
- [ ] Update WebSocket message handlers (if needed)
- [ ] Test on staging environment
- [ ] Gradual rollout to production users

### Documentation
- [ ] Update API documentation
- [ ] Update client code examples
- [ ] Notify users of migration
- [ ] Provide migration assistance

---

## Support

For migration assistance:
- **Documentation:** `/docs/api/openapi.yaml`
- **Examples:** `/docs/api/API_IMPLEMENTATION_SUMMARY.md`
- **Issues:** GitHub Issues

---

## Timeline

| Week | Phase | Tasks |
|------|-------|-------|
| 1 | Deployment | Install deps, configure env, deploy server |
| 2 | Client Migration | Update auth, API calls, error handling |
| 3 | Testing | Unit tests, integration tests, load tests |
| 4 | Rollout | Staged rollout, monitoring, support |
| 5+ | Cleanup | Deprecate legacy endpoints |

Total estimated time: 4-5 weeks for full migration