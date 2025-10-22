# API Documentation

Complete reference for the AP Statistics Consensus Quiz REST API and WebSocket interface.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
  - [JWT Token Format](#jwt-token-format)
  - [Student Authentication Flow](#student-authentication-flow)
  - [Teacher Authentication Flow](#teacher-authentication-flow)
- [REST API Endpoints](#rest-api-endpoints)
  - [Profiles](#profiles)
  - [Answers](#answers)
  - [Votes](#votes)
  - [Progress](#progress)
  - [Legacy Endpoints](#legacy-endpoints)
- [WebSocket Interface](#websocket-interface)
  - [Connection](#connection)
  - [Events](#events)
  - [Presence System](#presence-system)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Overview

**Base URL:** `https://your-app.up.railway.app`

**API Version:** v2.0

**Protocols:**
- REST API over HTTP/HTTPS
- WebSocket for real-time updates

**Authentication:**
- JWT Bearer tokens
- Optional for read operations
- Required for write operations

**Content Type:** `application/json`

**Response Format:**
```json
{
    "success": true,
    "data": { ... },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Format:**
```json
{
    "error": "ValidationError",
    "message": "Invalid input data",
    "code": "VALIDATION_ERROR",
    "timestamp": "2024-01-15T10:30:00Z",
    "details": [...]
}
```

## Authentication

### JWT Token Format

**Token Structure:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Payload:**
```json
{
    "username": "Apple_Lion",
    "role": "student",
    "class_section_code": "STATS2024",
    "iat": 1705315200,
    "exp": 1705401600
}
```

**Expiration:** 24 hours (configurable)

**Token Storage:**
```javascript
// Store token after authentication
localStorage.setItem('auth_token', token);

// Include in requests
fetch('/api/answers', {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    }
});
```

### Student Authentication Flow

Students use anonymous authentication with Fruit_Animal usernames.

**1. Create Profile (Anonymous)**

```http
POST /api/profiles
Content-Type: application/json

{
    "username": "Apple_Penguin",
    "class_section_code": "STATS2024"
}
```

**Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "profile": {
        "username": "Apple_Penguin",
        "class_section_code": "STATS2024",
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

**2. Use Token for Subsequent Requests**

All write operations require the token:
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
        answer_value: 'B'
    })
});
```

### Teacher Authentication Flow

Teachers authenticate with a shared class code.

**1. Teacher Login**

```http
POST /api/auth/teacher
Content-Type: application/json

{
    "class_section_code": "STATS2024",
    "access_code": "teacher_secret_code"
}
```

**Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "role": "teacher",
    "class_section_code": "STATS2024"
}
```

**2. Access Teacher Endpoints**

```javascript
const token = localStorage.getItem('auth_token');

await fetch('/api/progress/class/STATS2024', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

## REST API Endpoints

### Profiles

#### Create Profile (Student Registration)

```http
POST /api/profiles
```

**Request Body:**
```json
{
    "username": "Apple_Lion",
    "class_section_code": "STATS2024"
}
```

**Validation:**
- `username`: 3-50 characters, Fruit_Animal format
- `class_section_code`: 3-20 characters, alphanumeric

**Response:** `201 Created`
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "profile": {
        "username": "Apple_Lion",
        "class_section_code": "STATS2024",
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

**Errors:**
- `400` - Invalid username format
- `409` - Username already exists
- `429` - Rate limit exceeded (5 per hour per IP)

#### Get Profile

```http
GET /api/profiles/:username
```

**Parameters:**
- `username` (path) - Username to retrieve

**Response:** `200 OK`
```json
{
    "success": true,
    "profile": {
        "username": "Apple_Lion",
        "class_section_code": "STATS2024",
        "created_at": "2024-01-15T10:30:00Z",
        "last_active": "2024-01-15T12:00:00Z"
    }
}
```

**Authentication:** Optional (own profile requires token)

#### Update Profile

```http
PATCH /api/profiles/:username
Authorization: Bearer <token>
```

**Request Body:**
```json
{
    "last_active": "2024-01-15T12:00:00Z"
}
```

**Response:** `200 OK`
```json
{
    "success": true,
    "profile": {
        "username": "Apple_Lion",
        "class_section_code": "STATS2024",
        "last_active": "2024-01-15T12:00:00Z"
    }
}
```

**Authentication:** Required (can only update own profile)

**Errors:**
- `401` - Unauthorized (no token)
- `403` - Forbidden (updating another user's profile)

---

### Answers

#### Get Peer Answers

```http
GET /api/answers/:question_id
```

**Parameters:**
- `question_id` (path) - Question ID (e.g., `U1-L1-Q01`)

**Response:** `200 OK`
```json
{
    "success": true,
    "answers": [
        {
            "username": "Apple_Lion",
            "answer_value": "A",
            "submitted_at": "2024-01-15T10:30:00Z"
        },
        {
            "username": "Banana_Bear",
            "answer_value": "B",
            "submitted_at": "2024-01-15T10:31:00Z"
        }
    ],
    "count": 2,
    "cached": true,
    "cache_age_ms": 15000
}
```

**Authentication:** Optional

**Caching:** 30-second TTL (configurable)

#### Submit Answer

```http
POST /api/answers
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
    "question_id": "U1-L1-Q01",
    "answer_value": "B"
}
```

**Validation:**
- `question_id`: Required, alphanumeric with hyphens
- `answer_value`: Required, 1-500 characters

**Response:** `201 Created`
```json
{
    "success": true,
    "answer": {
        "answer_id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "Apple_Lion",
        "question_id": "U1-L1-Q01",
        "answer_value": "B",
        "submitted_at": "2024-01-15T10:30:00Z"
    }
}
```

**Real-time:** WebSocket broadcast to all connected clients

**Authentication:** Required

**Rate Limit:** 30 requests per minute per user

**Errors:**
- `401` - Unauthorized
- `400` - Invalid input
- `429` - Rate limit exceeded

#### Get Answer Statistics

```http
GET /api/answers/:question_id/stats
```

**Parameters:**
- `question_id` (path) - Question ID

**Response:** `200 OK`
```json
{
    "success": true,
    "stats": {
        "question_id": "U1-L1-Q01",
        "total_answers": 30,
        "distribution": {
            "A": { "count": 12, "percentage": 40 },
            "B": { "count": 15, "percentage": 50 },
            "C": { "count": 3, "percentage": 10 }
        },
        "consensus": {
            "value": "B",
            "percentage": 50,
            "has_consensus": true
        }
    }
}
```

**Consensus Definition:** >50% agreement on single answer

**Authentication:** None required

---

### Votes

#### Get Votes for Question

```http
GET /api/votes/:question_id
```

**Parameters:**
- `question_id` (path) - Question ID

**Response:** `200 OK`
```json
{
    "success": true,
    "votes": [
        {
            "vote_id": "550e8400-e29b-41d4-a716-446655440000",
            "voter_username": "Apple_Lion",
            "target_username": "Banana_Bear",
            "question_id": "U1-L1-Q01",
            "created_at": "2024-01-15T10:30:00Z"
        }
    ],
    "vote_summary": {
        "Banana_Bear": 3,
        "Cherry_Tiger": 2
    }
}
```

**Authentication:** None required

#### Cast Vote

```http
POST /api/votes
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
    "question_id": "U1-L1-Q01",
    "target_username": "Banana_Bear"
}
```

**Validation:**
- Cannot vote for yourself
- One vote per question per user (updates existing vote)

**Response:** `201 Created`
```json
{
    "success": true,
    "vote": {
        "vote_id": "550e8400-e29b-41d4-a716-446655440000",
        "voter_username": "Apple_Lion",
        "target_username": "Banana_Bear",
        "question_id": "U1-L1-Q01",
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

**Real-time:** WebSocket broadcast to all connected clients

**Authentication:** Required

**Rate Limit:** 60 requests per minute per user

**Errors:**
- `400` - Cannot vote for yourself
- `401` - Unauthorized
- `404` - Target user not found

#### Remove Vote

```http
DELETE /api/votes/:vote_id
Authorization: Bearer <token>
```

**Parameters:**
- `vote_id` (path) - Vote UUID

**Response:** `200 OK`
```json
{
    "success": true,
    "message": "Vote removed"
}
```

**Authentication:** Required (can only delete own votes)

---

### Progress

#### Get User Progress

```http
GET /api/progress/:username
```

**Parameters:**
- `username` (path) - Username

**Response:** `200 OK`
```json
{
    "success": true,
    "progress": {
        "username": "Apple_Lion",
        "completed_questions": 45,
        "total_questions": 120,
        "percentage": 37.5,
        "units": {
            "U1": { "completed": 12, "total": 20 },
            "U2": { "completed": 18, "total": 25 }
        },
        "badges": [
            { "badge_type": "first_answer", "earned_date": "2024-01-10" },
            { "badge_type": "consensus_builder", "earned_date": "2024-01-12" }
        ]
    }
}
```

**Authentication:** Optional (own progress requires token)

#### Update Progress

```http
POST /api/progress
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
    "question_id": "U1-L1-Q01",
    "completed": true
}
```

**Response:** `200 OK`
```json
{
    "success": true,
    "progress": {
        "username": "Apple_Lion",
        "completed_questions": 46,
        "percentage": 38.3
    }
}
```

**Authentication:** Required

#### Get Class Progress (Teacher Only)

```http
GET /api/progress/class/:code
Authorization: Bearer <token>
```

**Parameters:**
- `code` (path) - Class section code

**Response:** `200 OK`
```json
{
    "success": true,
    "class_progress": {
        "class_section_code": "STATS2024",
        "total_students": 30,
        "average_progress": 42.5,
        "students": [
            {
                "username": "Apple_Lion",
                "completed": 45,
                "percentage": 37.5
            }
        ]
    }
}
```

**Authentication:** Required (teacher role)

**Errors:**
- `403` - Forbidden (not a teacher)

---

### Legacy Endpoints

Backward-compatible endpoints from v1.0.

#### Health Check

```http
GET /health
```

**Response:** `200 OK`
```json
{
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "uptime": 3600,
    "memory": {
        "rss": 50331648,
        "heapTotal": 35913728,
        "heapUsed": 20486656
    },
    "version": "2.0.0"
}
```

#### Get Peer Data (Cached)

```http
GET /api/peer-data
```

**Response:** `200 OK`
```json
{
    "answers": [...],
    "votes": [...],
    "cached_at": "2024-01-15T10:30:00Z"
}
```

**Caching:** 30-second TTL

#### Get Question Stats (Legacy)

```http
GET /api/question-stats/:id
```

**Response:** `200 OK`
```json
{
    "question_id": "U1-L1-Q01",
    "total_answers": 30,
    "consensus_percentage": 50
}
```

#### Submit Answer (Legacy)

```http
POST /api/submit-answer
Content-Type: application/json
```

**Request Body:**
```json
{
    "username": "Apple_Lion",
    "question_id": "U1-L1-Q01",
    "answer_value": "B"
}
```

**Note:** Use JWT authentication endpoints for new implementations.

---

## WebSocket Interface

Real-time updates via WebSocket connection.

### Connection

**URL:** `wss://your-app.up.railway.app`

**Protocol:** WebSocket (RFC 6455)

**Connection Example:**
```javascript
const ws = new WebSocket('wss://your-app.up.railway.app');

ws.onopen = () => {
    console.log('Connected');

    // Identify user
    ws.send(JSON.stringify({
        type: 'identify',
        username: 'Apple_Lion'
    }));
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected');
    // Implement reconnection logic
};
```

**Reconnection Strategy:**
```javascript
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

function connect() {
    const ws = new WebSocket('wss://your-app.up.railway.app');

    ws.onclose = () => {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(connect, RECONNECT_DELAY * reconnectAttempts);
        }
    };

    ws.onopen = () => {
        reconnectAttempts = 0; // Reset on successful connection
    };
}
```

### Events

#### Client → Server Events

**Identify User**

```json
{
    "type": "identify",
    "username": "Apple_Lion"
}
```

Sent immediately after connection to register user for presence tracking.

**Heartbeat (Ping)**

```json
{
    "type": "ping"
}
```

Sent every 30 seconds to keep connection alive.

#### Server → Client Events

**Connected**

```json
{
    "type": "connected",
    "message": "WebSocket connection established",
    "server_time": "2024-01-15T10:30:00Z"
}
```

Sent immediately after connection is established.

**Answer Submitted**

```json
{
    "type": "answer_submitted",
    "data": {
        "username": "Banana_Bear",
        "question_id": "U1-L1-Q01",
        "answer_value": "B",
        "submitted_at": "2024-01-15T10:30:00Z"
    }
}
```

Broadcasted when any student submits an answer.

**Vote Cast**

```json
{
    "type": "vote_cast",
    "data": {
        "voter_username": "Apple_Lion",
        "target_username": "Banana_Bear",
        "question_id": "U1-L1-Q01",
        "vote_id": "550e8400-e29b-41d4-a716-446655440000"
    }
}
```

Broadcasted when any student casts a vote.

**User Joined**

```json
{
    "type": "user_joined",
    "username": "Cherry_Tiger",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

Broadcasted when a new user connects.

**User Left**

```json
{
    "type": "user_left",
    "username": "Cherry_Tiger",
    "timestamp": "2024-01-15T10:32:00Z"
}
```

Broadcasted when a user disconnects or times out.

**Presence Snapshot**

```json
{
    "type": "presence_snapshot",
    "users": [
        {
            "username": "Apple_Lion",
            "status": "online",
            "current_question": "U1-L1-Q01",
            "last_seen": "2024-01-15T10:30:00Z"
        },
        {
            "username": "Banana_Bear",
            "status": "online",
            "current_question": "U1-L1-Q02",
            "last_seen": "2024-01-15T10:31:00Z"
        }
    ],
    "total_online": 2
}
```

Sent every 30 seconds with current online users.

**Heartbeat (Pong)**

```json
{
    "type": "pong",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

Response to ping message.

### Presence System

The WebSocket server tracks online users with automatic timeout.

**Presence TTL:** 45 seconds

**How it works:**
1. User connects and sends `identify` message
2. Server adds user to presence map with TTL
3. User sends ping every 30 seconds to stay active
4. If no ping received within 45 seconds, user marked offline
5. Other connected clients receive `user_left` event

**Client Implementation:**
```javascript
let heartbeatInterval;

ws.onopen = () => {
    // Identify
    ws.send(JSON.stringify({
        type: 'identify',
        username: username
    }));

    // Send heartbeat every 30 seconds
    heartbeatInterval = setInterval(() => {
        ws.send(JSON.stringify({ type: 'ping' }));
    }, 30000);
};

ws.onclose = () => {
    clearInterval(heartbeatInterval);
};
```

---

## Error Handling

### Standard Error Response

```json
{
    "error": "ValidationError",
    "message": "Invalid input data",
    "code": "VALIDATION_ERROR",
    "timestamp": "2024-01-15T10:30:00Z",
    "details": [
        {
            "field": "username",
            "message": "Username must be 3-50 characters",
            "value": "ab"
        }
    ]
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Database or service down |

### Client Error Handling

```javascript
async function submitAnswer(questionId, answerValue) {
    try {
        const response = await fetch('/api/answers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question_id: questionId,
                answer_value: answerValue
            })
        });

        if (!response.ok) {
            const error = await response.json();

            switch (error.code) {
                case 'UNAUTHORIZED':
                    // Redirect to login
                    window.location.href = '/login';
                    break;
                case 'RATE_LIMIT_EXCEEDED':
                    // Show rate limit message
                    alert('Please slow down. Try again in a minute.');
                    break;
                case 'VALIDATION_ERROR':
                    // Show validation errors
                    error.details.forEach(detail => {
                        console.error(`${detail.field}: ${detail.message}`);
                    });
                    break;
                default:
                    // Generic error
                    console.error('Error:', error.message);
            }

            return null;
        }

        const data = await response.json();
        return data.answer;

    } catch (err) {
        // Network error
        console.error('Network error:', err);
        return null;
    }
}
```

---

## Rate Limiting

Rate limits protect the server from abuse.

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1705315800
```

### Rate Limit Table

| Operation | Limit | Window | Strategy |
|-----------|-------|--------|----------|
| Profile creation | 5 | 1 hour | Per IP |
| Authentication | 10 | 15 minutes | Per IP |
| Answer submission | 30 | 1 minute | Per user (JWT) |
| Vote casting | 60 | 1 minute | Per user (JWT) |
| Read operations | 100 | 1 minute | Per IP |

### Rate Limit Response

When rate limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
    "error": "Rate limit exceeded",
    "code": "RATE_LIMIT_EXCEEDED",
    "retry_after_seconds": 60,
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### Client Rate Limit Handling

```javascript
async function makeRequest(url, options) {
    const response = await fetch(url, options);

    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        console.log(`Rate limited. Retry after ${retryAfter}s`);

        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return makeRequest(url, options);
    }

    return response;
}
```

---

## Examples

### Complete Student Flow

```javascript
// 1. Create profile
const registerResponse = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'Apple_Penguin',
        class_section_code: 'STATS2024'
    })
});

const { token, profile } = await registerResponse.json();
localStorage.setItem('auth_token', token);

// 2. Connect WebSocket
const ws = new WebSocket('wss://your-app.up.railway.app');

ws.onopen = () => {
    ws.send(JSON.stringify({
        type: 'identify',
        username: profile.username
    }));
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'answer_submitted') {
        console.log('Peer answered:', message.data);
        updatePeerAnswers(message.data);
    }
};

// 3. Submit answer
await fetch('/api/answers', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        question_id: 'U1-L1-Q01',
        answer_value: 'B'
    })
});

// 4. Vote for peer
await fetch('/api/votes', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        question_id: 'U1-L1-Q01',
        target_username: 'Banana_Bear'
    })
});

// 5. Check progress
const progressResponse = await fetch(`/api/progress/${profile.username}`, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

const { progress } = await progressResponse.json();
console.log('Progress:', progress.percentage + '%');
```

### Real-time Updates

```javascript
class QuizConnection {
    constructor(serverUrl, username) {
        this.serverUrl = serverUrl;
        this.username = username;
        this.ws = null;
        this.listeners = new Map();
    }

    connect() {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
            // Identify user
            this.send('identify', { username: this.username });

            // Start heartbeat
            this.startHeartbeat();
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };

        this.ws.onclose = () => {
            // Reconnect after delay
            setTimeout(() => this.connect(), 3000);
        };
    }

    send(type, data) {
        this.ws.send(JSON.stringify({ type, ...data }));
    }

    startHeartbeat() {
        setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.send('ping', {});
            }
        }, 30000);
    }

    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    handleMessage(message) {
        const listeners = this.listeners.get(message.type) || [];
        listeners.forEach(callback => callback(message));
    }
}

// Usage
const quiz = new QuizConnection('wss://your-app.up.railway.app', 'Apple_Lion');

quiz.on('answer_submitted', (message) => {
    console.log('New answer:', message.data);
});

quiz.on('presence_snapshot', (message) => {
    console.log('Online users:', message.users.length);
});

quiz.connect();
```

---

**For more examples, see the [test suite](../railway-server/tests/) or [client implementation](../railway_client.js).**

**Questions?** Open an issue or discussion on GitHub.
