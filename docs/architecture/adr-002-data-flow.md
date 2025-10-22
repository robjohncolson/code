# ADR-002: Data Flow Pattern - Railway as Caching Proxy

## Status
Accepted

## Context
Supabase free tier provides 500MB database and limited API calls. With 30 students polling every 5 minutes for peer data, the app would generate:
- 30 students × 12 queries/hour = 360 queries/hour
- 8,640 queries/day per class
- Rapid consumption of free tier quota

Additionally, Supabase charges based on bandwidth and API calls. Direct client-to-Supabase architecture becomes expensive at scale.

## Decision
**Railway Server as Caching Proxy (Not Authentication)**

The Railway server (`railway-server/server.js`) serves as a lightweight caching layer between clients and Supabase:

1. **Caching Strategy:**
   - Server queries Supabase once
   - Caches results in-memory (30-60 second TTL)
   - Serves cached data to all clients
   - Reduces Supabase queries by ~95%

2. **WebSocket Real-Time Updates:**
   - Server maintains persistent Supabase subscription
   - Broadcasts changes to connected clients via WebSocket
   - Eliminates client polling entirely

3. **Authentication Responsibility:**
   - ⚠️ **Railway does NOT handle authentication**
   - Auth remains client-side (anonymous usernames)
   - Railway trusts all requests (appropriate for anonymous model)

4. **Fallback Mechanism:**
   - If Railway unavailable, client falls back to direct Supabase
   - Feature flag: `railway_config.js` `USE_RAILWAY = true/false`

## Consequences

### Positive
- **95% cost reduction:** 12 queries/hour instead of 360
- **Real-time updates:** WebSocket push instead of polling
- **Scalability:** One server supports unlimited classes
- **Supabase tier preservation:** Free tier lasts longer

### Negative
- **Single point of failure:** Railway outage affects all classes (mitigated by fallback)
- **Server maintenance:** Additional deployment and monitoring
- **Cache invalidation:** Stale data risk (mitigated by short TTL)
- **WebSocket complexity:** Connection management, reconnection logic

### Mitigations
- Direct Supabase fallback when Railway unreachable (`railway_client.js`)
- Short cache TTL (30s) balances freshness and efficiency
- WebSocket reconnection with exponential backoff
- Health check endpoint for monitoring (`/health`)

## Data Flow Diagrams

### Without Railway (Direct Supabase)
```
Student 1 ──┐
Student 2 ──┼─> Supabase (360 queries/hour)
Student 3 ──┘
```

### With Railway (Caching Proxy)
```
Student 1 ──┐
Student 2 ──┼─> Railway Server ──> Supabase (12 queries/hour)
Student 3 ──┘     (WebSocket)
```

## Implementation Notes

### Railway Server Responsibilities
- Cache peer data (answers, votes, badges)
- Aggregate question statistics
- WebSocket connection management
- Health checks and metrics

### Railway Server Does NOT Handle
- User authentication (client-side only)
- Session management
- Password verification
- Token generation/validation

### Security Model
- Supabase RLS policies enforce data access rules
- Railway server uses `SUPABASE_ANON_KEY` (row-level security applies)
- No privileged operations on Railway server
- Client-side username determines data ownership

## Alternatives Considered

### Edge Functions (Rejected)
- Pros: Supabase-native, auto-scaling
- Cons: Cold starts, complexity, limited caching control

### Redis Cache (Rejected)
- Pros: Persistent cache, shared across instances
- Cons: Additional cost, overkill for current scale

### Client-Side Caching Only (Rejected)
- Pros: No server needed
- Cons: Doesn't solve Supabase query limit problem

## References
- Implementation: `railway-server/server.js`
- Client integration: `railway_client.js`
- Configuration: `railway_config.js`
- Deployment: `railway-server/README.md`
