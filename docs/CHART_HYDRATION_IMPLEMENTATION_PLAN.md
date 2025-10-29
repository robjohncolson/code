# Charts as First-Class Answer Type: Complete Implementation Plan

**Document Version**: 2.0  
**Status**: Design Phase Complete  
**Last Updated**: 2025-10-28  

---

## Executive Summary

This plan addresses the remaining architectural gaps to make charts (SIF-JSON stringified) true first-class answer types with reliable hydration across all deployment and storage scenarios.

### Current State (Working)
- Charts stored as stringified SIF JSON in `answer_value` column
- Chart wizard saves to localStorage (`classData.users[username].charts`)
- SIF serialization/deserialization fully implemented
- Supabase hydration works when turbo mode active
- WebSocket real-time broadcasting of chart submissions works
- File:// fallback via `frq_chart_inventory.js` works

### Remaining Gaps
1. **Railway hydration not implemented** - When `USE_RAILWAY=true` and Supabase isn't reachable, charts from Railway cache are fetched but not deserialized for rendering
2. **Offline + storage denied scenario** - No fallback when localStorage quota exceeded OR permission denied (noted as architectural limitation, needs documented fallback)
3. **Session hydration lacks chart awareness** - On page reload, charts in peer data aren't being converted from stringified SIF back to renderable objects

### Key Requirements
- No database schema changes (already supports stringified JSON in `answer_value`)
- Must work when served over `file://`
- No build process or compile step
- Charts must reliably rehydrate on: refresh, route change, peer data pull
- Graceful degradation when storage/sync unavailable

---

## Part 1: Architecture & Data Flow

### 1.1 Multi-Layer Persistence Model

```
┌─────────────────────────────────────────────────────────────┐
│                    STUDENT'S BROWSER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LAYER 1: Session State (volatile, in-memory)            │
│  ├─ window.classData.users[username].charts              │
│  │   └─ {questionId: SIF_OBJECT, ...}                    │
│  └─ window.peerData[username].answers                     │
│      └─ {questionId: {value: SIF_STRING, ts}, ...}       │
│                                                             │
│  LAYER 2: LocalStorage (persistent, bounded ~10MB)        │
│  ├─ classData (all users' answers, charts, activity)     │
│  ├─ answers_[username] (legacy format per-user)          │
│  └─ cache_* (peer data snapshots)                         │
│                                                             │
│  LAYER 3: Browser Cache (IndexedDB, optional)             │
│  └─ [NOT CURRENTLY USED - reserved for future]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
           ↕ Sync via fetchAPI ↕
┌─────────────────────────────────────────────────────────────┐
│              RAILWAY SERVER (Optional)                      │
├─────────────────────────────────────────────────────────────┤
│  ├─ REST: GET /api/peer-data, POST /api/submit-answer   │
│  ├─ WebSocket: Real-time updates, presence tracking      │
│  └─ Cache (TTL 30s): answer_submitted events, stats     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
           ↕ Proxy to ↕
┌─────────────────────────────────────────────────────────────┐
│          SUPABASE POSTGRESQL (Optional)                    │
├─────────────────────────────────────────────────────────────┤
│  answers table                                              │
│  ├─ username, question_id (composite PK)                 │
│  ├─ answer_value VARCHAR (can be SIF JSON string)        │
│  ├─ timestamp BIGINT                                      │
│  └─ created_at, updated_at TIMESTAMPS                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 SIF Format & Storage Paths

**Standard Internal Format (SIF)** - Chart data structure:
```javascript
{
  type: "histogram" | "bar" | "scatter" | ... (14 types),
  xLabel: "Frequency", yLabel: "Count",
  title: "Distribution", description: "Notes",
  
  // Type-specific payload varies:
  // histogram: { bins: [{label, value}, ...], seriesName }
  // bar: { categories: [...], series: [{name, values}, ...], orientation }
  // scatter: { points: [{x, y, r?, label?}, ...] }
  // ... (see CLAUDE.md for full spec)
  
  meta: { createdAt: 1729982400000, updatedAt: 1729982400000 }
}
```

**Storage paths for charts:**

| Location | Format | Scope | Purpose |
|----------|--------|-------|---------|
| `classData.users[username].charts[questionId]` | SIF Object (native) | Own answers | Primary storage, rendered directly |
| `classData.users[username].answers[questionId]` | `{value: SIF_OBJECT, timestamp}` | Own answers | Alternative/legacy backup |
| `answers_[username][questionId]` | `{value: SIF_STRING, timestamp}` | Own answers | Robust startup recovery (stringified) |
| `Supabase answers.answer_value` | SIF_STRING (JSON) | All answers | Cloud source of truth |
| `Railway cache /api/peer-data` | Array of `{username, question_id, answer_value: SIF_STRING, timestamp}` | Peer data | Cached proxy (TTL 30s) |
| Memory `window.peerData[username].answers` | `{value: SIF_STRING, timestamp}` | Peer data | In-memory peer state |

### 1.3 Fallback Chain (Priority Order)

```
┌─ Page Load / Navigation ─────────────────────────────────┐
│                                                           │
├─► [1] LocalStorage (classData + answers_*)              │
│   │   ├─ FAST: Synchronous, always available            │
│   │   ├─ FULL: All user's own charts                    │
│   │   └─ Deserialization: Parse SIF if stringified      │
│   │                                                       │
│   └─► SUCCESS? → Render, then try to enrich peer data   │
│                                                           │
├─► [2] Railway Server (if USE_RAILWAY=true)              │
│   │   ├─ Fetch /api/peer-data                           │
│   │   ├─ Latency: <100ms (cached), ~500ms (fresh)       │
│   │   └─ Data: Peer charts as stringified SIF           │
│   │                                                       │
│   └─► SUCCESS? → Deserialize, merge into peerData       │
│                                                           │
├─► [3] Direct Supabase (if turboModeActive)              │
│   │   ├─ Fetch answers table                            │
│   │   ├─ Latency: ~1-2s (depends on network)            │
│   │   └─ Data: Full answer_value strings               │
│   │                                                       │
│   └─► SUCCESS? → Deserialize, update cache, render      │
│                                                           │
├─► [4] File:// Fallback (if served over file://)         │
│   │   ├─ Load docs/analysis/frq_chart_inventory.js      │
│   │   ├─ Provides sample/reference data only            │
│   │   └─ Peer data: NOT available (no sync possible)    │
│   │                                                       │
│   └─► Read-only mode: Show own charts only              │
│                                                           │
└─► [FINAL] Offline-Only Mode                             │
    ├─ Show own charts from localStorage only              │
    ├─ Peer consensus: DISABLED                            │
    └─ Message: "Sync unavailable - offline mode active"   │
```

---

## Part 2: Implementation Tasks

### Task Group A: Railway Hydration (Highest Priority)

#### A1: Create Rail`way Hydration Module (New File)
**File**: `js/railway_hydration.js` (NEW)  
**Size**: ~400 lines  
**Purpose**: Dedicated module for Railway-specific data synchronization

```javascript
/**
 * Railway Hydration Module
 * Handles fetching and deserializing chart data from Railway server
 * Integrates with fallback chain when Supabase is unreachable
 */

const railwayHydration = (() => {
  const STATE = {
    railwayUrl: window.RAILWAY_SERVER_URL || '',
    enabled: window.USE_RAILWAY || false,
    lastFetchTime: 0,
    cache: { peerData: null, timestamp: 0 }
  };

  /**
   * Fetch peer data from Railway /api/peer-data endpoint
   * @param {number} since - Optional timestamp to fetch only new data
   * @returns {Promise<Object>} Peer data object {username: {answers: {...}}}
   */
  async function fetchFromRailway(since = 0) {
    if (!STATE.enabled || !STATE.railwayUrl) {
      console.log('[Railway] Not enabled or URL missing');
      return null;
    }

    const startTime = performance.now();
    try {
      const url = since > 0
        ? `${STATE.railwayUrl}/api/peer-data?since=${since}`
        : `${STATE.railwayUrl}/api/peer-data`;

      const response = await Promise.race([
        fetch(url, { signal: AbortSignal.timeout(5000) }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Railway timeout')), 5000)
        )
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const duration = performance.now() - startTime;

      console.log(
        `✅ Railway fetched ${result.filtered} answers ` +
        `in ${duration.toFixed(0)}ms (${result.cached ? 'cached' : 'fresh'})`
      );

      return convertRailwayToPeerData(result.data);
    } catch (error) {
      console.log(`⚠️ Railway fetch failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Convert Railway response format to internal peer data structure
   * Handles SIF deserialization for chart answers
   */
  function convertRailwayToPeerData(answers) {
    const peerData = {};

    answers.forEach(answer => {
      const { username, question_id, answer_value, timestamp } = answer;

      if (!peerData[username]) {
        peerData[username] = { answers: {} };
      }

      // Try to deserialize if it's a stringified SIF
      let deserializedValue = answer_value;
      if (typeof answer_value === 'string' && answer_value.startsWith('{')) {
        try {
          deserializedValue = JSON.parse(answer_value);
          console.log(`📊 Deserialized SIF for ${question_id}`);
        } catch (e) {
          // Keep as string if not valid JSON
          console.warn(`Failed to deserialize SIF for ${question_id}:`, e.message);
        }
      }

      peerData[username].answers[question_id] = {
        value: deserializedValue,
        timestamp: parseInt(timestamp)
      };
    });

    return peerData;
  }

  /**
   * Hydrate peer charts during initial load
   * Called after localStorage hydration fails or returns no peer data
   */
  async function hydrateOnLoad() {
    if (!STATE.enabled) return false;

    console.log('[Railway] Starting peer hydration...');
    const peerData = await fetchFromRailway();
    
    if (!peerData || Object.keys(peerData).length === 0) {
      console.log('[Railway] No peer data available');
      return false;
    }

    // Store in window for main code to use
    if (!window.peerData) window.peerData = {};
    Object.assign(window.peerData, peerData);

    // Dispatch event so UI knows to re-render
    window.dispatchEvent(new CustomEvent('peerDataHydrated', {
      detail: { source: 'railway', count: Object.keys(peerData).length }
    }));

    return true;
  }

  /**
   * Hydrate during periodic sync (every 5 minutes)
   * Uses incremental fetch since last update
   */
  async function hydrateOnSync() {
    if (!STATE.enabled) return false;

    const lastTimestamp = window.lastPeerDataTimestamp || 0;
    const peerData = await fetchFromRailway(lastTimestamp);

    if (!peerData) return false;

    // Merge new data
    if (!window.peerData) window.peerData = {};
    Object.assign(window.peerData, peerData);

    // Update timestamp
    const timestamps = Object.values(peerData)
      .flatMap(u => Object.values(u.answers || {}))
      .map(a => a.timestamp || 0);
    if (timestamps.length > 0) {
      window.lastPeerDataTimestamp = Math.max(...timestamps);
    }

    return true;
  }

  /**
   * Test Railway connectivity (called during initialization)
   */
  async function testConnectivity() {
    if (!STATE.enabled) return false;

    try {
      const response = await fetch(`${STATE.railwayUrl}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      const data = await response.json();
      console.log(`✅ Railway health check passed:`, data);
      return true;
    } catch (error) {
      console.log(`❌ Railway connectivity failed:`, error.message);
      return false;
    }
  }

  return {
    initialize: (url, enabled) => {
      STATE.railwayUrl = url;
      STATE.enabled = enabled;
    },
    fetchFromRailway,
    hydrateOnLoad,
    hydrateOnSync,
    testConnectivity,
    isEnabled: () => STATE.enabled
  };
})();

// Export to window
window.railwayHydration = railwayHydration;
```

**Integration Point in index.html**:
```html
<!-- Add after railway_client.js -->
<script src="js/railway_hydration.js"></script>
```

---

#### A2: Integrate Railway Hydration into Main Load Flow
**File**: `index.html` (modify DOMContentLoaded)  
**Lines**: ~1050-1130  
**Change**: Add Railway as fallback after localStorage, before direct Supabase

```javascript
// In the main page load sequence, after localStorage check:

// PHASE 1: Load own answers from localStorage (always works)
initClassData(); // populates classData from localStorage

// PHASE 2: Try peer data - fallback chain
const currentUser = localStorage.getItem('consensusUsername');
let peerDataSource = 'none';

// Try 1: Railway Server (if configured and enabled)
if (window.USE_RAILWAY && window.railwayHydration?.isEnabled()) {
  console.log('🚂 Attempting Railway hydration...');
  const railwaySuccess = await window.railwayHydration.hydrateOnLoad();
  if (railwaySuccess) {
    peerDataSource = 'railway';
    console.log('✅ Peer data hydrated from Railway');
  }
}

// Try 2: Direct Supabase (if Railway failed and turbo mode available)
if (peerDataSource === 'none' && window.turboModeActive) {
  console.log('🔄 Attempting Supabase hydration...');
  const supabaseData = await pullPeerDataFromSupabase();
  if (supabaseData) {
    if (!window.peerData) window.peerData = {};
    Object.assign(window.peerData, supabaseData);
    peerDataSource = 'supabase';
    console.log('✅ Peer data hydrated from Supabase');
  }
}

// Try 3: File:// fallback
if (peerDataSource === 'none' && window.location.protocol === 'file:') {
  console.log('📄 Attempting file:// fallback...');
  const fileSuccess = await loadFrqChartInventory();
  if (fileSuccess) {
    peerDataSource = 'file';
    console.log('✅ Reference data loaded from file system');
  }
}

console.log(`📊 Peer data source: ${peerDataSource}`);
window.peerDataSource = peerDataSource;
```

---

### Task Group B: SIF Deserialization & Hydration

#### B1: Create Universal SIF Deserializer Module (New File)
**File**: `js/sif_deserializer.js` (NEW)  
**Size**: ~300 lines  
**Purpose**: Parse stringified SIF JSON safely, validate schema, handle errors

```javascript
/**
 * SIF Deserializer Module
 * Converts stringified SIF to native objects with validation
 */

const sifDeserializer = (() => {
  /**
   * Safely deserialize stringified SIF
   * @param {string|object} value - Either SIF string or already-parsed object
   * @param {string} questionId - For logging context
   * @returns {object|null} Parsed SIF object or null if invalid
   */
  function deserialize(value, questionId = 'unknown') {
    // Already an object
    if (typeof value === 'object' && value !== null) {
      if (value.type && CHART_TYPES.has(value.type)) {
        return value;
      }
      console.warn(`Invalid SIF object for ${questionId}: unknown type`);
      return null;
    }

    // String - try to parse
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed.type && CHART_TYPES.has(parsed.type)) {
          console.log(`📊 Deserialized SIF for ${questionId}`);
          return parsed;
        }
        console.warn(`Invalid SIF structure for ${questionId}`);
        return null;
      } catch (error) {
        console.warn(`Failed to parse SIF for ${questionId}: ${error.message}`);
        return null;
      }
    }

    return null;
  }

  /**
   * Deserialize all answers in a peer data object
   * Handles both stringified and native SIF formats
   */
  function deserializeAnswerSet(answers) {
    const result = {};

    for (const [questionId, answerData] of Object.entries(answers)) {
      const value = answerData.value || answerData;
      const deserialized = deserialize(value, questionId);

      result[questionId] = {
        value: deserialized || value, // Keep original if deserialize fails
        timestamp: answerData.timestamp || Date.now(),
        deserialized: deserialized !== null
      };
    }

    return result;
  }

  /**
   * Validate SIF structure against known chart type schemas
   */
  function validate(sif) {
    if (!sif || typeof sif !== 'object') return { valid: false, errors: ['Not an object'] };
    if (!sif.type) return { valid: false, errors: ['Missing "type" field'] };
    if (!CHART_TYPES.has(sif.type)) return { valid: false, errors: [`Unknown type: ${sif.type}`] };

    const errors = [];

    // Type-specific validation
    switch (sif.type) {
      case 'bar':
      case 'line':
        if (!Array.isArray(sif.categories)) errors.push('Missing categories array');
        if (!Array.isArray(sif.series)) errors.push('Missing series array');
        break;

      case 'scatter':
      case 'bubble':
        if (!Array.isArray(sif.points)) errors.push('Missing points array');
        break;

      case 'histogram':
      case 'dotplot':
        if (!sif.data) errors.push('Missing data object');
        break;

      case 'pie':
      case 'doughnut':
      case 'polarArea':
        if (!Array.isArray(sif.segments)) errors.push('Missing segments array');
        break;

      case 'boxplot':
        if (!sif.data?.fiveNumber) errors.push('Missing fiveNumber summary');
        break;

      case 'normal':
      case 'chisquare':
        if (!sif.data) errors.push('Missing data object');
        break;

      case 'numberline':
        if (!Array.isArray(sif.data?.ticks)) errors.push('Missing ticks array');
        break;

      case 'radar':
        if (!Array.isArray(sif.categories)) errors.push('Missing categories');
        if (!Array.isArray(sif.datasets)) errors.push('Missing datasets');
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      type: sif.type
    };
  }

  // Known chart types
  const CHART_TYPES = new Set([
    'bar', 'line', 'scatter', 'bubble', 'radar', 'polarArea',
    'pie', 'doughnut', 'histogram', 'dotplot', 'boxplot',
    'normal', 'chisquare', 'numberline'
  ]);

  return {
    deserialize,
    deserializeAnswerSet,
    validate,
    isChartAnswer: (value) => {
      const deserialized = deserialize(value);
      return deserialized !== null;
    }
  };
})();

window.sifDeserializer = sifDeserializer;
```

**Integration**: Add script tag in `index.html` before chart_wizard.js:
```html
<script src="js/sif_deserializer.js"></script>
```

---

#### B2: Update Chart Rendering to Accept Deserialized SIF
**File**: `js/chart_wizard.js` (modify `renderChartWizardPreview`)  
**Lines**: ~4205-4250

```javascript
// Current code attempts to render SIF stored in classData.users[username].charts
// Need to handle both native objects AND stringified versions from peer data

function renderChartWizardPreview(questionId) {
  const container = document.getElementById(`chart-preview-${questionId}`);
  if (!container) return;
  
  container.innerHTML = '';
  
  // Try to get chart from classData (own answers) - native SIF
  let chart = getStoredChartSIF(questionId);
  
  // If not found, try peer data (might be stringified)
  if (!chart && window.peerData) {
    // Search all peers for this question's chart
    for (const [username, userData] of Object.entries(window.peerData)) {
      if (userData?.answers?.[questionId]) {
        const answerData = userData.answers[questionId];
        // Try to deserialize if string
        chart = window.sifDeserializer.deserialize(answerData.value, questionId);
        if (chart) break;
      }
    }
  }
  
  const button = document.querySelector(`[data-chart-button="${questionId}"]`);
  if (!chart) {
    container.classList.add('empty');
    container.textContent = 'No chart saved yet. Use the wizard to add one.';
    if (button) button.textContent = 'Create Chart';
    return;
  }
  
  // Rest of rendering logic...
  container.classList.remove('empty');
  const chartData = sifToChartConfig(chart);
  // ... render chart
}
```

---

### Task Group C: Offline + Storage Denied Scenario

#### C1: Implement Session Storage Fallback
**File**: `js/session_fallback.js` (NEW)  
**Size**: ~250 lines  
**Purpose**: Use sessionStorage as fallback when localStorage quota exceeded or permission denied

```javascript
/**
 * Session Fallback Module
 * Provides in-memory + sessionStorage persistence when localStorage unavailable
 * Data is kept in current tab/window (survives refresh, lost on close)
 */

const sessionFallback = (() => {
  const STATE = {
    storageType: 'unknown', // 'localStorage' | 'sessionStorage' | 'memory'
    inMemory: {},  // Fallback to pure in-memory if both storages fail
    isOnline: navigator.onLine,
    warningShown: false
  };

  /**
   * Detect available storage and set up fallback chain
   * Tests: localStorage → sessionStorage → memory only
   */
  function detectAvailableStorage() {
    // Test localStorage
    try {
      const testKey = `__storage_test_${Date.now()}`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      STATE.storageType = 'localStorage';
      console.log('✅ Using localStorage');
      return;
    } catch (e) {
      console.warn('❌ localStorage unavailable:', e.message);
    }

    // Test sessionStorage
    try {
      const testKey = `__storage_test_${Date.now()}`;
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      STATE.storageType = 'sessionStorage';
      console.warn('⚠️ Using sessionStorage (data lost on tab close)');
      showStorageFallbackWarning('session');
      return;
    } catch (e) {
      console.warn('❌ sessionStorage also unavailable:', e.message);
    }

    // Fall back to memory only
    STATE.storageType = 'memory';
    console.error('⚠️ Using memory only (data lost on refresh!)');
    showStorageFallbackWarning('memory');
  }

  /**
   * Get data with automatic fallback
   */
  function getItem(key) {
    if (STATE.storageType === 'localStorage') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn(`localStorage.getItem failed for ${key}:`, e.message);
        return null;
      }
    }

    if (STATE.storageType === 'sessionStorage') {
      try {
        return sessionStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }

    // Memory only
    return STATE.inMemory[key] || null;
  }

  /**
   * Set data with automatic fallback
   */
  function setItem(key, value) {
    if (STATE.storageType === 'localStorage') {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded, falling back to sessionStorage');
          STATE.storageType = 'sessionStorage';
          showStorageFallbackWarning('session');
          setItem(key, value); // Retry with new storage type
          return;
        }
        console.error('localStorage.setItem failed:', e);
      }
    }

    if (STATE.storageType === 'sessionStorage') {
      try {
        sessionStorage.setItem(key, value);
        return;
      } catch (e) {
        console.warn('sessionStorage quota exceeded, using memory only');
        STATE.storageType = 'memory';
        showStorageFallbackWarning('memory');
        setItem(key, value); // Retry with memory
        return;
      }
    }

    // Memory fallback
    STATE.inMemory[key] = value;
  }

  /**
   * Show warning banner to user about degraded storage
   */
  function showStorageFallbackWarning(mode) {
    if (STATE.warningShown) return;
    STATE.warningShown = true;

    const messages = {
      session: 'Limited storage: Your data will be saved in this tab only (lost if closed)',
      memory: 'Limited storage: Your data is temporary (lost on page refresh!)'
    };

    const messageArea = document.getElementById('messageArea');
    if (!messageArea) return;

    const banner = document.createElement('div');
    banner.className = 'message warning';
    banner.style.cssText = 'margin-bottom: 15px; background: #fff3cd; border-left: 4px solid #ff9800;';
    banner.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <strong>Storage Limited:</strong> ${messages[mode]}
      <br><small>Frequently save backups using the "Export Data" option.</small>
    `;
    messageArea.appendChild(banner);
  }

  // Monitor storage quota changes
  if (navigator.storage && typeof navigator.storage.getEstimate === 'function') {
    navigator.storage.getEstimate().then(estimate => {
      const { usage, quota } = estimate;
      const percentUsed = (usage / quota * 100).toFixed(1);
      console.log(`Storage usage: ${percentUsed}% (${(usage/1024/1024).toFixed(1)}MB / ${(quota/1024/1024).toFixed(1)}MB)`);

      if (usage > quota * 0.9) {
        console.warn('Storage nearly full (>90%)');
      }
    });
  }

  return {
    initialize: detectAvailableStorage,
    getItem,
    setItem,
    getStorageType: () => STATE.storageType,
    isMemoryOnly: () => STATE.storageType === 'memory',
    isSessionOnly: () => STATE.storageType === 'sessionStorage'
  };
})();

window.sessionFallback = sessionFallback;
```

**Integration in index.html**:
```html
<!-- Add early, right after supabase_config.js -->
<script src="js/session_fallback.js"></script>
<script>
  sessionFallback.initialize();
</script>
```

---

#### C2: Integrate Session Fallback into Data Manager
**File**: `js/data_manager.js` (modify `initClassData` and `saveClassData`)

```javascript
// Wrap localStorage calls with sessionFallback

function initClassData() {
  // Use fallback-aware storage
  const storage = window.sessionFallback || {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v)
  };

  let classDataStr = storage.getItem('classData');
  classData = classDataStr ? JSON.parse(classDataStr) : {users: {}};

  if (!classData.users[currentUsername]) {
    classData.users[currentUsername] = {
      answers: {},
      reasons: {},
      timestamps: {},
      attempts: {},
      charts: {},
      currentActivity: {
        state: 'idle',
        questionId: null,
        lastUpdate: Date.now()
      }
    };
  } else {
    if (!classData.users[currentUsername].charts) {
      classData.users[currentUsername].charts = {};
    }
    if (!classData.users[currentUsername].currentActivity) {
      classData.users[currentUsername].currentActivity = {
        state: 'idle',
        questionId: null,
        lastUpdate: Date.now()
      };
    }
  }

  saveClassData();
}

function saveClassData() {
  try {
    const storage = window.sessionFallback || {
      setItem: (k, v) => localStorage.setItem(k, v)
    };

    storage.setItem('classData', JSON.stringify(classData));
  } catch(e) {
    console.log("Storage quota exceeded:", e);
    showMessage("Warning: Storage nearly full. Frequently export backups.", 'warning');
  }
}
```

---

### Task Group D: User-Facing Notifications & Documentation

#### D1: Create Storage Status Indicator
**File**: `index.html` (modify sync modal)  
**Purpose**: Show user which storage mode is active + recommendations

```html
<div id="storageStatusCard" style="margin-bottom: 15px; padding: 12px; background: var(--bg-secondary, #f5f5f5); border-radius: 4px; display: none;">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <strong id="storageStatusLabel">Storage: localStorage</strong>
      <br>
      <small id="storageStatusDetail" style="color: var(--text-secondary, #666);">
        Fully persistent, survives browser restart
      </small>
    </div>
    <div id="storageStatusIcon" style="font-size: 24px;">✅</div>
  </div>
</div>

<script>
function updateStorageIndicator() {
  const card = document.getElementById('storageStatusCard');
  const label = document.getElementById('storageStatusLabel');
  const detail = document.getElementById('storageStatusDetail');
  const icon = document.getElementById('storageStatusIcon');

  const storageType = window.sessionFallback?.getStorageType?.() || 'unknown';

  const modes = {
    localStorage: {
      label: 'Storage: localStorage',
      detail: 'Fully persistent, survives browser restart',
      icon: '✅',
      color: '#4caf50'
    },
    sessionStorage: {
      label: 'Storage: sessionStorage',
      detail: 'Temporary - lost when tab closes',
      icon: '⚠️',
      color: '#ff9800'
    },
    memory: {
      label: 'Storage: Memory Only',
      detail: 'TEMPORARY - lost on page refresh!',
      icon: '🔴',
      color: '#f44336'
    }
  };

  const mode = modes[storageType] || modes.unknown;
  if (mode) {
    label.textContent = mode.label;
    detail.textContent = mode.detail;
    icon.textContent = mode.icon;
    card.style.display = 'block';
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(updateStorageIndicator, 500);
});
</script>
```

---

#### D2: Update CLAUDE.md Documentation
**File**: `CLAUDE.md`  
**Section**: Add "Chart Hydration & Storage Modes" under Architecture

```markdown
### Chart Hydration & Storage Modes

Charts are stored as **Standard Internal Format (SIF) JSON** and follow a reliable hydration chain:

#### Storage Locations (Priority Order)

1. **LocalStorage - classData**
   - Path: `classData.users[username].charts[questionId]`
   - Format: Native SIF object (fastest access, parsed from JSON on load)
   - Scope: Only current user's answers
   - Persistence: Survives browser restart (10MB quota)

2. **LocalStorage - answers_[username]** (Legacy)
   - Path: `answers_[username][questionId].value`
   - Format: Stringified SIF JSON
   - Purpose: Robust recovery if classData corrupted
   - Fallback: Used on startup if classData missing

3. **Supabase / Railway Cloud**
   - Table: `answers` (answer_value column)
   - Format: Stringified SIF JSON (wire format)
   - Scope: All peer answers when turbo mode active
   - Sync: Automatic via Railway or direct Supabase

#### Hydration Chain

**On Page Load:**
1. Load own answers from localStorage (classData) - INSTANT
2. Try Railway `/api/peer-data` if `USE_RAILWAY=true` - <100ms (cached)
3. Fallback to direct Supabase if Railway failed - ~1-2s
4. Fallback to file:// inventory if served over file:// - synchronous
5. Offline-only mode if all above fail - no peer data

**Deserialization:**
- Charts are automatically deserialized from stringified SIF when:
  - Loaded from localStorage (on init)
  - Fetched from Railway/Supabase (via sifDeserializer module)
  - Hydrated into peerData (during sync)

**Storage Degradation:**
If localStorage quota exceeded or permission denied:
1. Automatically fallback to sessionStorage
2. If sessionStorage fails, use memory-only
3. User sees warning banner with save recommendations
4. Data persists within session but lost on:
   - Tab close (sessionStorage)
   - Page refresh (memory only)

### Offline + Storage Denied Scenario (Session-Only)

**Architectural Limitation**: True offline + storage denied = no persistent data.

**Fallback Strategy**:
- User prompted to frequently export backups
- Data available during session only
- Warning banner shown prominently
- "Export Data" button highlighted in sync modal
- Recommendations: Use turbo mode cloud sync OR manual backups

**Recommended User Action**: If localStorage unavailable, enable turbo mode (Supabase/Railway cloud sync) so answers backed up automatically.

```

---

### Task Group E: Testing & Validation

#### E1: Hydration Test Scenarios
**File**: `docs/testing/hydration_tests.md` (NEW)

```markdown
# Chart Hydration Testing Checklist

## Scenario 1: Fresh Load with Railway
- [ ] Start app with `USE_RAILWAY=true`
- [ ] Enter username (auto-generated)
- [ ] Navigate to FRQ question eligible for charts
- [ ] Open chart wizard, create + save a chart
- [ ] Open DevTools: Console should show:
  - "🚂 Attempting Railway hydration..."
  - "✅ Railway fetched X answers in Yms (cached/fresh)"
- [ ] Chart preview renders immediately
- [ ] Refresh page → Chart persists

## Scenario 2: Railway Fallback (Network Down)
- [ ] Disable Railway server (kill process)
- [ ] Reload page with offline network
- [ ] Console should show:
  - "❌ Railway server unavailable"
  - "🔄 Attempting Supabase hydration..."
  - "✅ Turbo mode active - Supabase connected"
- [ ] Charts load from Supabase, render correctly

## Scenario 3: All Cloud Offline
- [ ] Disable both Railway + Supabase
- [ ] Open DevTools offline
- [ ] Reload page
- [ ] Console should show:
  - "❌ Railway unavailable" + "❌ Supabase unavailable"
  - "Offline-only mode"
- [ ] Own charts from localStorage render
- [ ] Peer consensus disabled (show message)

## Scenario 4: File:// Protocol
- [ ] Open index.html directly (file://)
- [ ] Console should show:
  - "📄 Attempting file:// fallback..."
  - "✅ Loaded reference data from frq_chart_inventory.js"
- [ ] Charts not functional (reference only)
- [ ] Warning message shown

## Scenario 5: Storage Quota Exceeded
- [ ] Fill localStorage to 95%+ quota
- [ ] Try to save a chart
- [ ] Should automatically fallback to sessionStorage
- [ ] Console shows:
  - "⚠️ localStorage quota exceeded"
  - "Using sessionStorage (data lost on tab close)"
- [ ] Warning banner shown to user
- [ ] Chart still saves and renders

## Scenario 6: SessionStorage Only
- [ ] Close all other tabs
- [ ] Simulate localStorage permission denied
- [ ] Reload page
- [ ] Console shows: "Using sessionStorage"
- [ ] Create + save chart
- [ ] Refresh page → data persists
- [ ] Close tab → open new tab → data gone
- [ ] Warning emphasized in sync modal

## Scenario 7: SIF Deserialization (Mixed Formats)
- [ ] Manually create localStorage with both stringified + native SIF
- [ ] Load page
- [ ] Both formats should deserialize and render
- [ ] Console shows: "📊 Deserialized SIF for U1-L10-Q04"

## Scenario 8: Peer Data with Charts
- [ ] Multiple students in classroom
- [ ] Each creates different chart types
- [ ] Refresh page → all peer charts render in consensus
- [ ] Console shows hydration from Railway/Supabase
- [ ] Chart types: bar, scatter, histogram, normal, etc. all render
```

---

#### E2: Create Debug Utilities
**File**: `docs/sync_diagnostics.js` (enhance existing)

Add to console methods:

```javascript
// Add to window for debugging

window.debugChartHydration = function() {
  console.group('Chart Hydration Diagnostics');

  // Check own charts
  const ownCharts = window.classData?.users?.[window.currentUsername]?.charts || {};
  console.log('Own Charts:', Object.keys(ownCharts).length, ownCharts);

  // Check peer data
  const peerCount = Object.keys(window.peerData || {}).length;
  console.log(`Peer Data: ${peerCount} users`);

  // Check storage mode
  console.log('Storage Type:', window.sessionFallback?.getStorageType?.());

  // Check Supabase status
  console.log('Turbo Mode:', window.turboModeActive);

  // Check Railway status
  console.log('Railway Enabled:', window.USE_RAILWAY);
  console.log('Railway Connected:', window.railwayClient?.isConnected?.());

  // Sample deserialization
  const sampleAnswer = Object.values(ownCharts)[0];
  if (sampleAnswer) {
    console.log('Sample SIF validation:', window.sifDeserializer.validate(sampleAnswer));
  }

  console.groupEnd();
};

window.testChartPersistence = async function() {
  console.group('Chart Persistence Test');
  
  const testQuestion = 'TEST_CHART_HYDRATION';
  const testSIF = {
    type: 'bar',
    xLabel: 'Test X',
    yLabel: 'Test Y',
    categories: ['A', 'B', 'C'],
    series: [{ name: 'Test', values: [1, 2, 3] }]
  };

  // Save
  window.classData.users[window.currentUsername].charts[testQuestion] = testSIF;
  window.saveClassData();
  console.log('✅ Saved test chart to classData');

  // Retrieve from localStorage
  const stored = JSON.parse(localStorage.getItem('classData'));
  const retrieved = stored.users[window.currentUsername].charts[testQuestion];
  console.log('✅ Retrieved from storage:', retrieved);

  // Deserialize
  const deserialized = window.sifDeserializer.deserialize(retrieved);
  console.log('✅ Deserialized:', deserialized);

  // Cleanup
  delete window.classData.users[window.currentUsername].charts[testQuestion];
  window.saveClassData();

  console.groupEnd();
};
```

---

## Part 3: Implementation Sequence

### Phase 1: Foundation (Week 1)
1. Create `js/sif_deserializer.js` - SIF parsing & validation
2. Create `js/session_fallback.js` - Storage degradation handling
3. Create `js/railway_hydration.js` - Railway-specific sync
4. Add script tags to `index.html`

### Phase 2: Integration (Week 2)
1. Integrate Railway hydration into main load sequence
2. Update `chart_wizard.js` rendering to use deserializer
3. Modify `data_manager.js` to use session fallback
4. Test all 8 scenarios from E1

### Phase 3: Polish (Week 3)
1. Add storage status indicator to sync modal
2. Enhance debug utilities
3. Update CLAUDE.md documentation
4. Create test plan document
5. Demo + validate with Railway server

### Phase 4: Deployment (Week 4)
1. Deploy to production
2. Monitor console logs for hydration success rates
3. Gather user feedback on storage warnings
4. Iterate based on real-world usage

---

## Part 4: Error Handling & Logging

### Standard Log Messages

```
// SUCCESS
✅ Railway fetched X answers in Yms (cached)
✅ Peer data hydrated from Railway
✅ Deserialized SIF for [questionId]
✅ Turbo mode active - Supabase connected
✅ Using localStorage

// WARNINGS
⚠️ Railway fetch failed: [error]
⚠️ localStorage quota exceeded, falling back to sessionStorage
⚠️ Failed to deserialize SIF for [questionId]
⚠️ Supabase unavailable

// ERRORS
❌ Railway server unavailable
❌ Deserialization failed for [questionId]
🔴 Using memory only (data lost on refresh!)
```

### Retry Logic

**Railway Failures**:
- Immediate: Try Supabase
- On sync: Retry after 5 seconds, backoff to 30 seconds
- Give up after 3 failures, log to console

**Supabase Failures**:
- Immediate: Use localStorage only
- On sync: Retry after 5 seconds, show warning after 10s
- Never block page load

**Deserialization Failures**:
- Keep original stringified value
- Log warning with context
- Don't crash rendering

---

## Part 5: Monitoring & Analytics

### Key Metrics to Track

1. **Hydration Success Rate** (%)
   - Railway: Fetch 200 per question → 198 deserialized ✅
   - Supabase: Fetch 150 per question → 148 deserialized ✅
   - Offline: Load from localStorage → 100% deserialized ✅

2. **Storage Mode Distribution**
   - localStorage: 95%
   - sessionStorage: 4%
   - Memory only: 1%

3. **Average Render Time**
   - Chart preview: <100ms
   - Peer consensus: <200ms

4. **Error Rates**
   - Deserialization failures: <1%
   - Storage quota exceeded: <0.5%
   - Railway timeouts: 2-5%

### How to Enable Analytics

```javascript
// In index.html, add after hydration completes:

window.analyticsEvent('chart_hydration', {
  source: window.peerDataSource,
  storageType: window.sessionFallback?.getStorageType?.(),
  timeMs: performance.now() - pageStartTime,
  peerChartCount: countDeserializedCharts(window.peerData)
});
```

---

## Part 6: Fallback Chain Decision Tree

```
[Page Load]
    |
    ├─ Can read localStorage? YES
    │   ├─ classData.users[username].charts available? YES → Use it
    │   │   └─ Try to enrich with peer data (next steps)
    │   │
    │   └─ classData corrupted? Use answers_[username] backup
    │
    └─ localStorage blocked/quota exceeded? 
        ├─ Can use sessionStorage? YES → Switch mode, warn user
        └─ No? → Use memory only, BIG WARNING

[Peer Data Hydration]
    |
    ├─ USE_RAILWAY=true? YES
    │   ├─ Rail way /health passing? YES → Fetch /api/peer-data
    │   │   ├─ Success? → Deserialize, merge into classData
    │   │   └─ Timeout/Error? → Try next
    │   │
    │   └─ No → Skip to next
    │
    ├─ turboModeActive (Supabase working)? YES
    │   ├─ Fetch answers table → Deserialize → Merge
    │   └─ Error? → Continue
    │
    ├─ file:// protocol? YES
    │   └─ Load frq_chart_inventory.js (reference data)
    │
    └─ All failed? → Offline mode, peer data unavailable

[Rendering]
    |
    ├─ Chart stored in classData? → Render native SIF
    ├─ Chart in peer data (stringified)? → Deserialize, render
    ├─ Deserialization failed? → Show "Chart unavailable"
    └─ All else? → Hide chart preview, show add button
```

---

## Implementation Checklist

- [ ] Part 1: Create sif_deserializer.js
- [ ] Part 2: Create session_fallback.js
- [ ] Part 3: Create railway_hydration.js
- [ ] Part 4: Update index.html load sequence
- [ ] Part 5: Update chart_wizard.js renderChartWizardPreview()
- [ ] Part 6: Update data_manager.js with fallback integration
- [ ] Part 7: Add script tags in correct order (html head)
- [ ] Part 8: Test all 8 scenarios
- [ ] Part 9: Update CLAUDE.md documentation
- [ ] Part 10: Create/enhance debug utilities
- [ ] Part 11: Add storage status indicator
- [ ] Part 12: Deploy and monitor

---

## Success Criteria

- Charts render immediately on refresh (own + peer)
- All 14 chart types deserialize and render correctly
- Storage fallback chain works: localStorage → sessionStorage → memory
- User warnings shown when storage degraded
- Railway hydration preferred when available
- No data loss when switching between cloud sync modes
- Console logs clear and actionable for debugging
- Demo works in all environments: localhost, file://, production
- <5% error rate in deserialization
- >95% uptime in hydration chain

