# ADR-001: Client-First Architecture

## Status
Accepted

## Context
This AP Statistics Consensus Quiz is designed for educational environments where:
- Students may have intermittent internet connectivity (Chromebooks, school networks)
- Offline learning is critical for equitable access
- No server infrastructure should be required for core functionality
- Cloud features are "nice to have" but not essential
- Teachers need a simple, zero-configuration deployment option

The application must work reliably in offline mode while supporting optional cloud synchronization when available.

## Decision
**Primary Storage: localStorage**
- All student data (answers, progress, timestamps) stored in browser localStorage
- Application remains fully functional without internet connection
- No server dependency for core quiz functionality

**Secondary Storage: Supabase (Optional)**
- Cloud sync enabled via feature flag (`USE_RAILWAY` or direct Supabase)
- Peer data sharing for consensus features
- Optional backup/restore for students

**Data Flow:**
1. User interactions write to localStorage immediately
2. If cloud sync enabled, background sync to Supabase
3. Peer data fetched from Supabase (or Railway proxy) on demand
4. Conflicts resolved client-side (timestamp-based)

## Consequences

### Positive
- **Offline-first:** Works without internet, critical for education settings
- **Zero setup:** Static file hosting, no database required for basic use
- **Performance:** Instant reads/writes from localStorage
- **Privacy:** Student data stays on device unless explicitly synced
- **Simplicity:** No auth server, session management, or complex infrastructure

### Negative
- **Storage limits:** localStorage typically 5-10MB per origin
- **No cross-device:** Data tied to single browser unless cloud sync enabled
- **Sync complexity:** Conflict resolution needed for peer data
- **Data loss risk:** Clearing browser data loses all progress (mitigated by export feature)

### Mitigations
- Export/import functionality for data portability (already implemented: `js/data_manager.js`)
- Warning messages when approaching localStorage quota
- Optional Supabase sync for users who want cloud backup
- Railway caching proxy to reduce API costs (95% query reduction)

## Alternatives Considered

### Backend-First (Rejected)
- Pros: Centralized data, easier multi-device support
- Cons: Requires always-on server, breaks offline, deployment complexity

### IndexedDB Primary Storage (Rejected)
- Pros: Larger storage limits (50MB+)
- Cons: Async API complexity, overkill for current data size, localStorage sufficient

## References
- Implementation: `js/data_manager.js` lines 15-57
- Cloud sync: `railway_client.js`, `supabase_config.js`
- Export/import: `index.html` lines 2000-2100
