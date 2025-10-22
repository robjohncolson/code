# JWT Authentication Flow

## Overview

The AP Statistics Quiz application uses JWT (JSON Web Tokens) for stateless authentication, supporting both anonymous students and authenticated teachers.

## Token Structure

### JWT Payload

```json
{
  "username": "Apple_Penguin",
  "is_teacher": false,
  "class_section_id": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1699564800,
  "exp": 1699651200,
  "iss": "apstats-quiz",
  "aud": "apstats-client"
}
```

### Token Claims

| Claim | Type | Description | Required |
|-------|------|-------------|----------|
| `username` | string | Unique user identifier (Fruit_Animal format) | ✅ |
| `is_teacher` | boolean | Teacher role flag | ✅ |
| `class_section_id` | string/null | UUID of class section | ❌ |
| `iat` | number | Issued at timestamp | ✅ |
| `exp` | number | Expiration timestamp | ✅ |
| `iss` | string | Issuer (always "apstats-quiz") | ✅ |
| `aud` | string | Audience (always "apstats-client") | ✅ |

## Authentication Flows

### 1. Anonymous Student Authentication

Students use anonymous authentication with auto-generated usernames:

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Supabase

    Client->>Client: Generate Fruit_Animal username
    Client->>API: POST /api/profiles<br/>{username: "Apple_Penguin"}
    API->>Supabase: Insert profile
    Supabase-->>API: Profile created
    API->>API: Generate JWT
    API-->>Client: 201 Created<br/>{token: "eyJ...", profile: {...}}
    Client->>Client: Store token in localStorage
```

**Request:**
```http
POST /api/profiles
Content-Type: application/json

{
  "username": "Apple_Penguin",
  "class_section_code": "STATS2024"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "profile": {
    "username": "Apple_Penguin",
    "is_teacher": false,
    "class_section_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Teacher Authentication

Teachers authenticate with a special flow:

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Supabase

    Client->>API: POST /api/auth/teacher<br/>{access_code: "TEACHER-2024"}
    API->>API: Validate access code
    API->>Supabase: Get/Create teacher profile
    Supabase-->>API: Teacher profile
    API->>API: Generate JWT with is_teacher=true
    API-->>Client: 200 OK<br/>{token: "eyJ...", profile: {...}}
    Client->>Client: Store token in localStorage
```

**Request:**
```http
POST /api/auth/teacher
Content-Type: application/json

{
  "access_code": "TEACHER-2024-SECRET",
  "username": "Teacher_Demo"  // Optional custom username
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "profile": {
    "username": "Teacher_Demo",
    "is_teacher": true,
    "permissions": ["view_all_students", "grant_badges", "manage_classes"],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Token Refresh Flow

Tokens can be refreshed before expiration:

```mermaid
sequenceDiagram
    participant Client
    participant API

    Client->>API: POST /api/auth/refresh<br/>Authorization: Bearer {old_token}
    API->>API: Verify old token
    API->>API: Generate new token
    API-->>Client: 200 OK<br/>{token: "eyJ..."}
    Client->>Client: Update stored token
```

**Request:**
```http
POST /api/auth/refresh
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

## Using Tokens

### Request Authorization

Include the token in the Authorization header:

```http
GET /api/progress/Apple_Penguin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Client Implementation

```javascript
// Store token after authentication
localStorage.setItem('auth_token', response.token);

// Include in API requests
const token = localStorage.getItem('auth_token');
const response = await fetch('/api/answers', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(answerData)
});
```

## Token Validation

### Server-Side Validation

The API validates tokens on each request:

1. **Extract token** from Authorization header
2. **Verify signature** using JWT secret
3. **Check expiration** (default 24 hours)
4. **Validate claims** (issuer, audience)
5. **Set user context** for request

### Validation Errors

| Error | Status | Description |
|-------|--------|-------------|
| Missing token | 401 | No Authorization header |
| Invalid token | 401 | Signature verification failed |
| Expired token | 401 | Token past expiration time |
| Invalid issuer | 401 | Token not from apstats-quiz |
| Invalid audience | 401 | Token not for apstats-client |
| Insufficient role | 403 | User lacks required permissions |

## Security Considerations

### Token Storage

**DO:**
- Store tokens in localStorage for persistence
- Clear tokens on logout
- Implement token refresh before expiration

**DON'T:**
- Store tokens in cookies (CORS issues)
- Include tokens in URL parameters
- Log tokens to console in production

### Token Expiration

| Token Type | Expiration | Use Case |
|------------|------------|----------|
| Student token | 24 hours | Regular student sessions |
| Teacher token | 8 hours | Higher security for admin access |
| Refresh token | 7 days | Background token renewal |

### Environment Variables

```bash
# Required for production
JWT_SECRET=your-256-bit-secret-key-here
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d

# Optional
JWT_ALGORITHM=HS256
JWT_ISSUER=apstats-quiz
JWT_AUDIENCE=apstats-client
```

## Supabase RLS Integration

Tokens are passed to Supabase for Row Level Security:

```sql
-- RLS policies use JWT claims
CREATE POLICY "Users can read own data"
ON profiles FOR SELECT
USING (
    username = current_setting('request.jwt.claims.username', true)
);
```

The Railway server sets the Supabase context:

```javascript
// Middleware sets username context for RLS
const { data, error } = await supabase
    .from('answers')
    .select('*')
    .rpc('set_user_context', { username: req.user.username });
```

## Migration from localStorage

For existing users with localStorage data:

1. **Check for existing session:**
   ```javascript
   const existingUsername = localStorage.getItem('username');
   ```

2. **Create profile and get token:**
   ```javascript
   const response = await fetch('/api/profiles', {
       method: 'POST',
       body: JSON.stringify({ username: existingUsername })
   });
   const { token } = await response.json();
   ```

3. **Migrate localStorage data:**
   ```javascript
   await migrateAnswersToSupabase(token);
   await migrateProgressToSupabase(token);
   ```

## Token Refresh Strategy

Implement automatic token refresh:

```javascript
class TokenManager {
    constructor() {
        this.token = null;
        this.refreshTimer = null;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);

        // Decode to get expiration
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresIn = (payload.exp * 1000) - Date.now();

        // Refresh 5 minutes before expiration
        const refreshIn = expiresIn - (5 * 60 * 1000);

        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => this.refresh(), refreshIn);
    }

    async refresh() {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (response.ok) {
            const { token } = await response.json();
            this.setToken(token);
        } else {
            // Token refresh failed, redirect to login
            this.logout();
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('auth_token');
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        // Redirect to login or generate new anonymous session
    }
}
```

## Testing JWT Flow

### Generate Test Token

```javascript
// Development only - generate test token
const jwt = require('jsonwebtoken');

const testToken = jwt.sign(
    {
        username: 'Test_User',
        is_teacher: false,
        class_section_id: null
    },
    'dev-secret-change-in-production',
    {
        expiresIn: '1h',
        issuer: 'apstats-quiz',
        audience: 'apstats-client'
    }
);

console.log('Test token:', testToken);
```

### Verify Token

```bash
# Decode token (no verification)
echo "eyJhbGciOiJ..." | cut -d. -f2 | base64 -d | jq

# Test with curl
curl -H "Authorization: Bearer eyJhbGciOiJ..." \
     http://localhost:3000/api/profile/Test_User
```

## Error Handling

### Client-Side Error Handler

```javascript
class APIClient {
    async request(url, options = {}) {
        const token = localStorage.getItem('auth_token');

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': token ? `Bearer ${token}` : undefined
            }
        });

        if (response.status === 401) {
            // Token expired or invalid
            const refreshed = await this.refreshToken();
            if (refreshed) {
                // Retry with new token
                return this.request(url, options);
            } else {
                // Redirect to login
                window.location.href = '/login';
            }
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'API request failed');
        }

        return response.json();
    }
}
```

## Monitoring and Logging

### Token Metrics

Track token usage for security monitoring:

```javascript
// Log token events (server-side)
const tokenEvents = {
    issued: 0,
    refreshed: 0,
    expired: 0,
    invalid: 0
};

// Log without exposing sensitive data
console.log('Token issued for user:', username);
console.log('Token validation failed:', error.message);
// Never log the actual token!
```

### Security Alerts

Monitor for suspicious patterns:
- Multiple failed validations from same IP
- Rapid token refresh attempts
- Token reuse after expiration
- Tokens with manipulated claims

## References

- [JWT.io - JSON Web Token Introduction](https://jwt.io/introduction/)
- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [Supabase RLS with JWT](https://supabase.com/docs/guides/auth/row-level-security)