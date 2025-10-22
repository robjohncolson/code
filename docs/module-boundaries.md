# Module Boundaries & Dependencies

## Overview
This document defines module boundaries for the AP Statistics Consensus Quiz application. The app uses a **global namespace pattern** without ES modules or a bundler.

## Architecture Layers

### PRESENTATION LAYER (Global Scope)
**Responsibility:** DOM manipulation, user interaction, visual rendering

- **`index.html`** - Main entry point, event handlers, inline scripts
  - Dependencies: All modules
  - Exports: Global functions (`renderQuestion`, `showMessage`, etc.)

- **`js/charts.js`** - Chart.js wrapper with two-phase rendering pattern
  - Dependencies: Chart.js (CDN), chartjs-plugin-datalabels (CDN)
  - Exports: `getChartHtml()`, `renderChartNow()`, `window.chartInstances`
  - Pattern: Phase 1 HTML generation, Phase 2 canvas rendering

- **`css/styles.css`** - Theming, layout, modal system
  - Dependencies: None
  - Exports: CSS variables (`--bg-primary`, `--accent-primary`, etc.)
  - Features: Dark mode, responsive modals, grid layouts

### BUSINESS LOGIC LAYER (Window Namespaced)
**Responsibility:** Data operations, user session, curriculum management

- **`js/auth.js`** - Session and username management
  - Dependencies: `data_manager.js` (requires `initClassData()`, `initializeProgressTracking()`)
  - Exports: Global functions (`promptForUsername()`, `generateUsername()`)
  - Storage: `localStorage.currentUsername`
  - Pattern: Anonymous Fruit_Animal usernames, no passwords

- **`js/data_manager.js`** - localStorage persistence, import/export
  - Dependencies: None (foundation module)
  - Exports: Global functions (`initClassData()`, `saveClassData()`, `exportPersonalData()`)
  - Storage: `localStorage.classData` (JSON object)
  - Migration: Auto-migrates old data formats

- **`data/curriculum.js`** - Embedded question data (~37K lines)
  - Dependencies: None
  - Exports: `EMBEDDED_CURRICULUM` (array of question objects)
  - Format: JSON-like JavaScript array
  - Size: ~300KB uncompressed

- **`data/units.js`** - Course structure and unit metadata
  - Dependencies: None
  - Exports: `ALL_UNITS_DATA` (array of unit objects)
  - Contains: Unit IDs, display names, topics, video links

### INFRASTRUCTURE LAYER (Conditional Load)
**Responsibility:** Optional cloud sync, external service integration

- **`railway_client.js`** - WebSocket client for Railway server
  - Dependencies: Patches functions from `data_manager.js`
  - Exports: Patches global functions at runtime (non-invasive)
  - Load condition: `USE_RAILWAY === true` in `railway_config.js`
  - Pattern: Runtime monkey-patching for backward compatibility

- **`railway_config.js`** - Feature flag for Railway integration
  - Dependencies: None
  - Exports: `USE_RAILWAY` (boolean), `RAILWAY_SERVER_URL` (string)
  - Configuration only, no logic

- **`supabase_config.js`** - Supabase credentials (public keys only)
  - Dependencies: None
  - Exports: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - Security: Public anon keys safe for client (RLS policies protect data)

## Module Load Order

**Critical:** Scripts must load in this order to satisfy dependencies:

```html
<!-- 1. Foundation: Data & Utilities -->
<script src="data/curriculum.js"></script>
<script src="data/units.js"></script>

<!-- 2. Business Logic: Core First -->
<script src="js/data_manager.js"></script>  <!-- No dependencies -->
<script src="js/auth.js"></script>          <!-- Depends on data_manager -->

<!-- 3. Presentation: Rendering -->
<script src="js/charts.js"></script>        <!-- Independent -->

<!-- 4. Infrastructure: Optional Features (conditional) -->
<script src="railway_config.js"></script>
<script src="railway_client.js"></script>   <!-- Patches data_manager functions -->
```

## Dependency Rules

### ✅ Allowed Dependencies
- Presentation → Business Logic (read-only)
- Business Logic → Foundation modules
- Infrastructure → Business Logic (patching only, documented)

### ❌ Prohibited Dependencies
- Business Logic → Presentation (violates separation of concerns)
- Foundation → Business Logic (creates cycles)
- Infrastructure → Presentation (bypass business logic)

### ⚠️ Special Case: Runtime Patching
`railway_client.js` patches global functions from other modules:
```javascript
// Original function in data_manager.js
window.originalGetPeerData = window.getPeerData;

// Patched in railway_client.js
window.getPeerData = function() {
    if (railwayAvailable) return fetchFromRailway();
    return window.originalGetPeerData();
};
```

**Documentation requirement:** All patches must be documented in this file.

## Current Runtime Patches

| Patched Function | Original Module | Patch Module | Purpose |
|-----------------|-----------------|--------------|---------|
| `getPeerData()` | `data_manager.js` | `railway_client.js` | Route through Railway cache |
| `syncToSupabase()` | `data_manager.js` | `railway_client.js` | WebSocket broadcast |

## Module Communication Patterns

### Direct Function Calls (Preferred)
```javascript
// auth.js calls data_manager.js
function initUserSession() {
    initClassData();  // Direct global call
    saveClassData();
}
```

### Event-Based Communication (Future)
Not currently used, but recommended for:
- Cross-module notifications
- Decoupling presentation from business logic
- Plugin architecture

### Shared State (Controlled)
Global state managed by specific modules:
- `classData` - Owned by `data_manager.js`
- `currentUsername` - Owned by `auth.js`
- `chartInstances` - Owned by `charts.js`

**Rule:** Only owning module can write; others can read.

## Error Boundaries

Each layer has defined error handling:

### Presentation Layer
- Chart rendering failures → Placeholder `<div class="chart-error">`
- DOM manipulation errors → Log and continue

### Business Logic Layer
- localStorage quota exceeded → Warning message, fallback to memory
- Data corruption → Attempt migration, fallback to empty state

### Infrastructure Layer
- Railway connection failed → Fallback to direct Supabase
- Supabase unavailable → Offline mode (localStorage only)

## Testing Module Boundaries

Run validation script to check boundaries:
```bash
node tools/verify_boundaries.js
```

Checks:
- Load order in `index.html`
- No infrastructure calls in presentation layer
- No circular dependencies

## Future Refactoring Considerations

### If complexity grows:
1. **ES Modules:** Convert to `import/export` syntax
2. **Bundler:** Add Vite for tree-shaking and code splitting
3. **TypeScript:** Add type safety for module interfaces

### If maintaining static architecture:
1. **Namespace pattern:** `window.APStats = {auth: {}, data: {}}`
2. **Registry pattern:** Explicit dependency injection
3. **Event bus:** Decouple module communication

## References
- ADR-001: Client-First Architecture
- ADR-002: Data Flow Pattern
- ADR-003: Performance Strategy
