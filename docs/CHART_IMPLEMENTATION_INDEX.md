# Chart Hydration Implementation - Document Index

Quick navigation for the complete chart hydration implementation plan.

## Documents

### 1. IMPLEMENTATION_SUMMARY.md (Executive Overview)
**Purpose**: Quick reference, decision rationale, timeline  
**Audience**: Managers, stakeholders, reviewers  
**Key Sections**:
- Problem statement & solution overview
- What's working vs. what needs implementation
- Phased approach (4 weeks, 20-30 hours)
- Risk assessment & resource estimates
- Q&A section

**Read Time**: 15 minutes  
**Location**: `/docs/IMPLEMENTATION_SUMMARY.md`

---

### 2. CHART_HYDRATION_IMPLEMENTATION_PLAN.md (Detailed Plan)
**Purpose**: Complete technical specification with code samples  
**Audience**: Developers implementing the solution  
**Key Sections**:

| Part | Title | Lines | Purpose |
|------|-------|-------|---------|
| 1 | Architecture & Data Flow | 200 | Multi-layer storage, fallback chain |
| 2A | Railway Hydration (Task A) | 350 | Module code + integration |
| 2B | SIF Deserialization (Task B) | 250 | Parse stringified JSON safely |
| 2C | Storage Fallback (Task C) | 300 | Handle localStorage quota errors |
| 2D | User Notifications (Task D) | 150 | Storage status indicator |
| 2E | Testing & Validation (Task E) | 200 | 8 test scenarios + debug utilities |
| 3 | Implementation Sequence | 50 | Phased timeline |
| 4 | Error Handling | 50 | Logging standards |
| 5 | Monitoring | 100 | Analytics & metrics |
| 6 | Decision Trees | 50 | Visual flowcharts |

**Read Time**: 2-3 hours (during implementation)  
**Location**: `/docs/CHART_HYDRATION_IMPLEMENTATION_PLAN.md`

---

## Quick Links by Phase

### Phase 1: Foundation (Week 1)
**Create 3 new modules**

1. **sif_deserializer.js** (Task 2B1)
   - Safe JSON parsing for stringified charts
   - Schema validation for 14 chart types
   - Error handling & logging
   - Lines to implement: 300
   - Integration point: Used by other modules

2. **session_fallback.js** (Task 2C1)
   - Detect available storage at load time
   - Fallback chain: localStorage → sessionStorage → memory
   - User warning banner
   - Lines to implement: 250
   - Integration point: `index.html` early initialization

3. **railway_hydration.js** (Task 2A1)
   - Fetch peer data from Railway server
   - Convert to internal peerData format
   - Part of fallback chain
   - Lines to implement: 400
   - Integration point: Page load sequence (Part 2A2)

**Total new code**: ~950 lines

---

### Phase 2: Integration (Week 2)
**Update existing files**

1. **index.html** (Task 2A2)
   - Add 3 `<script>` tags
   - Update DOMContentLoaded load sequence
   - Fallback chain logic
   - Lines to modify: ~50

2. **js/chart_wizard.js** (Task 2B2)
   - Update renderChartWizardPreview()
   - Use sifDeserializer.deserialize()
   - Handle both native & stringified SIF
   - Lines to modify: ~30

3. **js/data_manager.js** (Task 2C2)
   - Use sessionFallback.getItem/setItem
   - Wrap localStorage calls
   - Lines to modify: ~20

---

### Phase 3: Polish (Week 3)
**User experience & documentation**

1. **index.html** (Task 2D1)
   - Add storage status indicator
   - Show in sync modal
   - Lines to add: ~30

2. **CLAUDE.md** (Task 2D2)
   - Add "Chart Hydration & Storage Modes" section
   - Explain storage hierarchy
   - Document fallback strategy
   - Lines to add: ~100

3. **docs/sync_diagnostics.js** (Task 2E2)
   - Add debug helpers
   - `debugChartHydration()`
   - `testChartPersistence()`
   - Lines to add: ~50

---

### Phase 4: Deploy (Week 4)
**Production & monitoring**

1. Create test environment
2. Run all 8 test scenarios (Task 2E1)
3. Deploy to production
4. Monitor hydration success rates
5. Collect user feedback

---

## Test Scenarios (Part 2E1)

All 8 scenarios must pass before deployment:

```
Scenario 1: Fresh Load with Railway
  └─ Charts load immediately via Railway cache

Scenario 2: Railway Fallback
  └─ Falls back to Supabase when Railway down

Scenario 3: All Cloud Offline
  └─ Uses localStorage, shows offline warning

Scenario 4: File:// Protocol
  └─ Loads reference data only (read-only mode)

Scenario 5: Storage Quota Exceeded
  └─ Auto-switches to sessionStorage

Scenario 6: SessionStorage Only
  └─ Charts persist in tab, lost on close

Scenario 7: Mixed SIF Formats
  └─ Both native & stringified SIF deserialize

Scenario 8: Peer Data with Charts
  └─ All 14 chart types render from peer data
```

---

## Architecture Diagrams

### Storage Hierarchy (Part 1.1)
```
Browser Session (volatile)
    ↓ Persisted to ↓
Browser Storage (persistent, bounded)
    ↓ Synced to ↓
Cloud Servers (authoritative)
```

### Fallback Chain (Part 1.3)
```
[1] LocalStorage (fast, complete)
  ↓ Failed/Empty?
[2] Railway Server (cached, <100ms)
  ↓ Failed/Down?
[3] Direct Supabase (authoritative, ~1-2s)
  ↓ Failed/Offline?
[4] File:// Fallback (reference only)
  ↓ Offline?
[5] Offline-Only Mode (own data only)
```

---

## Code Structure

### New Files
```
js/
├─ sif_deserializer.js (300 lines)
│  └─ window.sifDeserializer API
├─ session_fallback.js (250 lines)
│  └─ window.sessionFallback API
└─ railway_hydration.js (400 lines)
   └─ window.railwayHydration API
```

### Modified Files
```
index.html
├─ Add script tags (3 new modules)
├─ Initialize sessionFallback
├─ Update page load sequence
└─ Add storage status indicator

js/
├─ chart_wizard.js
│  └─ renderChartWizardPreview() enhancement
└─ data_manager.js
   └─ initClassData/saveClassData enhancement

CLAUDE.md
└─ Add "Chart Hydration & Storage Modes" section
```

---

## API Reference

### window.sifDeserializer
```javascript
// Parse stringified SIF → native object
sifDeserializer.deserialize(value, questionId)

// Batch deserialize with error tracking
sifDeserializer.deserializeAnswerSet(answers)

// Validate SIF schema
sifDeserializer.validate(sif) // → {valid, errors, type}

// Quick type check
sifDeserializer.isChartAnswer(value) // → boolean
```

### window.sessionFallback
```javascript
// Initialize at page load
sessionFallback.initialize()

// Get/set with automatic fallback
sessionFallback.getItem(key)
sessionFallback.setItem(key, value)

// Detect current storage mode
sessionFallback.getStorageType() // 'localStorage'|'sessionStorage'|'memory'
sessionFallback.isMemoryOnly()  // boolean
sessionFallback.isSessionOnly() // boolean
```

### window.railwayHydration
```javascript
// Initialize (usually done automatically)
railwayHydration.initialize(url, enabled)

// Hydration during page load
railwayHydration.hydrateOnLoad() // → Promise<boolean>

// Hydration during periodic sync
railwayHydration.hydrateOnSync() // → Promise<boolean>

// Low-level fetch
railwayHydration.fetchFromRailway(since) // → Promise<peerData>

// Health check
railwayHydration.testConnectivity() // → Promise<boolean>

// Query state
railwayHydration.isEnabled() // boolean
```

---

## Console Logging Standards (Part 4)

### Success Messages
```
✅ Railway fetched X answers in Yms (cached)
✅ Peer data hydrated from Railway
✅ Deserialized SIF for U1-L10-Q04
✅ Turbo mode active - Supabase connected
✅ Using localStorage
```

### Warnings
```
⚠️ Railway fetch failed: [error]
⚠️ localStorage quota exceeded, falling back to sessionStorage
⚠️ Failed to deserialize SIF for [questionId]
⚠️ Supabase unavailable
```

### Errors
```
❌ Railway server unavailable
❌ Deserialization failed for [questionId]
🔴 Using memory only (data lost on refresh!)
```

---

## Metrics to Track (Part 5)

**Hydration Success Rate** (%)
- Railway: Target >95%
- Supabase: Target >95%
- File://: Target 100%
- Overall: Target >98%

**Storage Mode Distribution** (%)
- localStorage: Target >95%
- sessionStorage: Target <4%
- memory: Target <1%

**Performance** (ms)
- Chart preview render: <100ms
- Peer consensus render: <200ms
- SIF deserialization: <10ms for 50 charts

**Error Rates** (%)
- Deserialization failures: <1%
- Storage quota exceeded: <0.5%
- Railway timeouts: 2-5%

---

## Troubleshooting

### Charts not rendering
→ Check console for deserialization errors
→ Run `window.debugChartHydration()`
→ Verify SIF structure with `window.sifDeserializer.validate()`

### Storage warnings appearing
→ Check localStorage quota: `navigator.storage.getEstimate()`
→ Export backups via sync modal
→ Clear old data if quota exceeded

### Railway not loading charts
→ Check Railway health: `curl https://your-app.up.railway.app/health`
→ Verify `USE_RAILWAY=true` in `railway_config.js`
→ Check WebSocket connection in DevTools

### Multiple tabs not syncing
→ sessionStorage doesn't sync across tabs
→ Enable turbo mode (Supabase/Railway cloud sync)
→ Or use same-tab navigation

---

## Success Checklist

Phase 1 Complete?
- [ ] sif_deserializer.js written & tested
- [ ] session_fallback.js written & tested
- [ ] railway_hydration.js written & tested

Phase 2 Complete?
- [ ] Script tags added to index.html
- [ ] Page load sequence updated
- [ ] chart_wizard.js updated
- [ ] data_manager.js updated
- [ ] All 8 test scenarios passing

Phase 3 Complete?
- [ ] Storage status indicator added
- [ ] CLAUDE.md updated
- [ ] Debug utilities enhanced
- [ ] Documentation complete

Phase 4 Complete?
- [ ] Deployed to production
- [ ] Monitoring in place
- [ ] <1% error rate observed
- [ ] >95% success rate observed

---

## Document Maintenance

**Last Updated**: 2025-10-28  
**Maintained By**: Claude Code  
**Version**: 1.0  

**Updates Needed**:
- [ ] After Phase 1: Add code review notes
- [ ] After Phase 2: Update test results
- [ ] After Phase 3: Add performance metrics
- [ ] After Phase 4: Add production monitoring data

---

## Related Documentation

- **Project Overview**: `/CLAUDE.md`
- **Database Schema**: `/docs/supabase_schema.sql`
- **Chart Wizard Guide**: `/docs/chart-wizard-usage.md`
- **PDF Integration**: `/docs/pdf-integration-guide.md`
- **Sync Diagnostics**: `/docs/sync_diagnostics.js`

---

## Questions?

Refer to the appropriate document:
- **"How do I implement this?"** → CHART_HYDRATION_IMPLEMENTATION_PLAN.md
- **"What are we doing and why?"** → IMPLEMENTATION_SUMMARY.md
- **"How do I navigate the plan?"** → This file (CHART_IMPLEMENTATION_INDEX.md)
- **"How does the app work overall?"** → CLAUDE.md

