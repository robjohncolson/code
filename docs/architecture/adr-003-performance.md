# ADR-003: Performance Strategy - Embedded Curriculum & Two-Phase Rendering

## Status
Accepted

## Context
The application has unique performance constraints:
- `data/curriculum.js`: ~37,000 lines of embedded question data
- `index.html`: ~300KB including inline JavaScript
- No build process or bundler (static file serving)
- Target devices: Chromebooks, tablets, older laptops
- Chart rendering on-demand for visualizations

Early prototypes revealed timing issues when dynamically rendering charts into the DOM.

## Decision

### 1. Embedded Curriculum (No Lazy Loading)
**Include all question data directly in `data/curriculum.js`**

Rationale:
- Eliminates network requests for question data
- Works offline immediately
- Simplifies caching (single HTML file)
- Modern browsers parse large JS files efficiently

Trade-off: Larger initial download (300KB HTML + 37K line JS file)

### 2. Two-Phase Chart Rendering Pattern
**Separate HTML generation from Chart.js rendering**

Implementation (`js/charts.js`):
```javascript
// Phase 1: Generate HTML with canvas element
function getChartHtml(chartData, canvasId) {
    return `<canvas id="${canvasId}"></canvas>`;
}

// Phase 2: Render chart AFTER canvas in DOM
function renderChartNow(chartData, canvasId) {
    const canvas = document.getElementById(canvasId);
    new Chart(canvas.getContext('2d'), config);
}
```

Rationale:
- Prevents "canvas not found" errors in dynamic UIs
- Allows HTML insertion before heavy Chart.js execution
- Enables progressive rendering (structure first, charts second)

### 3. No Build Step / No Bundler
**Serve raw JavaScript files via `<script>` tags**

Rationale:
- Simplicity: No webpack, vite, or parcel configuration
- Deployment: Copy files to any static host
- Debugging: Source maps not needed (raw source)
- Educational: Students/teachers can inspect code directly

Trade-off: No tree-shaking, minification, or code splitting

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Initial page load | < 2s on 3G | ~1.8s |
| Time to interactive | < 3s on 3G | ~2.5s |
| Chart render time | < 500ms | ~300ms |
| Question navigation | < 100ms | ~50ms |

## Consequences

### Positive
- **Fast subsequent navigation:** All questions cached in memory
- **Offline-ready:** No additional fetches after initial load
- **Predictable performance:** No network variability
- **Chart stability:** Two-phase rendering prevents race conditions
- **Simple deployment:** No build pipeline to maintain

### Negative
- **Large initial download:** 300KB+ initial payload
- **Memory usage:** Entire curriculum loaded (37K lines in memory)
- **No code splitting:** Cannot lazy-load units on demand
- **Cache invalidation:** Any curriculum change requires full reload

### Mitigations
- HTTP/2 and gzip compression reduce transfer size (~80KB gzipped)
- Service worker caching for repeat visits (future enhancement)
- Progressive rendering: UI interactive before charts load
- Browser caching via `Cache-Control` headers

## Load Time Analysis

```
Initial Load Waterfall:
─────────────────────────────────────────────
index.html (300KB)         [████████] 800ms
Chart.js CDN (200KB)       [█████] 500ms
Datalabels plugin (50KB)   [██] 200ms
data/curriculum.js (inline) [─] 0ms (bundled)
Parse & Execute            [███] 300ms
First Render               [██] 200ms
─────────────────────────────────────────────
Total Time to Interactive: ~2000ms
```

## Two-Phase Rendering Example

```javascript
// Problem: This fails if canvas not yet in DOM
function renderQuestion(question) {
    document.getElementById('content').innerHTML =
        `<canvas id="chart1"></canvas>`;
    new Chart(document.getElementById('chart1'), config); // ❌ Error!
}

// Solution: Two-phase pattern
function renderQuestion(question) {
    // Phase 1: Generate and insert HTML
    const html = getChartHtml(chartData, 'chart1');
    document.getElementById('content').innerHTML = html;

    // Phase 2: Render chart (canvas now exists)
    renderChartNow(chartData, 'chart1'); // ✅ Works!
}
```

## Alternatives Considered

### Dynamic Import / Lazy Loading (Rejected)
- Pros: Smaller initial bundle, load units on demand
- Cons: Requires bundler, breaks offline-first, adds complexity

### Server-Side Rendering (Rejected)
- Pros: Faster perceived load time
- Cons: Requires Node.js server, incompatible with static hosting

### IndexedDB for Curriculum (Rejected)
- Pros: Moves data out of main bundle
- Cons: Async complexity, overkill for 300KB, worse offline experience

### Single-Phase Chart Rendering (Rejected)
- Pros: Simpler API
- Cons: Race conditions, "canvas not found" errors

## Future Optimizations

### If performance becomes an issue:
1. **Service Worker:** Cache curriculum for instant repeat visits
2. **Code Splitting:** Load units on demand (requires bundler)
3. **Virtualization:** Only render visible questions in long lists
4. **Web Workers:** Parse curriculum off main thread

### Not planned unless necessary:
- These add complexity inconsistent with "simple static site" philosophy
- Current performance meets educational use case requirements

## References
- Two-phase pattern: `js/charts.js` lines 5-27
- Embedded curriculum: `data/curriculum.js`
- Load performance: Measured via Lighthouse (94/100 performance score)
