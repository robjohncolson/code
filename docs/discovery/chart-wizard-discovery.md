1) Repo & Runtime Portrait

Framework & app type: Vanilla JS + HTML + CSS; static site (no bundler).

Scripts: CDN (Chart.js + plugins) or inline files referenced via <script>; globals (no ES modules).

Persistence: Client‑side via localStorage with per‑user answer maps; optional cloud sync may exist behind a lightweight proxy.

Tooling: No enforced lint/tests yet (ESLint/Jest/Playwright not detected).

Deploy: Any static host (GitHub Pages/Netlify/Vercel). Optional Node sidecar for caching/proxy if configured.

Targets: Modern Chromium‑class browsers (Chromebooks included); offline‑friendly (localStorage).

2) Existing UI Surfaces & Insertion Points

Modal primitive: Present and reusable (overlay + content container + ESC close; add focus trap + ARIA).

Side panel option: Feasible if you prefer not to occlude question text; requires a slim CSS addition.

Launch points:

Inline: near FRQ/graph prompts (“Open Chart Wizard”).

Global: command palette/FAB/toolbar button (“Chart Wizard”).

Recommendation: Start with modal to ship fast; keep CSS hooks ready for a right‑side panel variant if UX prefers adjacent context on desktop.

3) Student Answer Data Model & Persistence

Current answer shape (baseline):

answers[questionId] = {
  value: /* string for MC, text for FRQ, object for complex types */,
  timestamp: Number,   // ms since epoch
  type: "multiple-choice" | "free-response" | /* extensible */
}


Chart Wizard storage (new type):

answers[questionId] = {
  value: <SIF object>,          // see SIF v0.1 schema below
  timestamp: Date.now(),
  type: "chart-response"
}


Where: Same classData.users[username].answers object used today, so export/merge/sync flows keep working.

4) SIF v0.1 (Standard Internal Format) for Histograms
{
  "type": "histogram",
  "version": "0.1",
  "xLabel": "string",
  "yLabel": "string",
  "binning": {
    "mode": "explicit",           // "explicit" (bins provided) | "width" (start,width,count) | "edges" (array)
    "bins": [
      {"start": 0, "end": 10, "frequency": 5},
      {"start": 10, "end": 20, "frequency": 8}
    ]
  },
  "sketch": {
    "dataUri": "data:image/png;base64,...",   // optional, small thumbnail
    "width": 600,                              // canvas px
    "height": 300
  },
  "renderOptions": {
    "showDatalabels": true,
    "barGap": 0,               // 0 for histogram look via Chart.js bar options
    "theme": "auto"            // "light" | "dark" | "auto"
  },
  "meta": {
    "created": 0,
    "modified": 0,
    "source": "chart-wizard"
  }
}


Notes
• Keep sketch.dataUri under ~300 KB; compress or downscale if larger.
• If future charts arrive, extend type and add shape‑specific sections.

5) Charting Capabilities & Approach

Library: Chart.js 3.x via CDN, with chartjs‑plugin‑datalabels available.

Already handled in app: bar/histogram (bar with no gaps), pie, scatter, dotplot, and a custom boxplot; all rendered directly with Chart.js options.

MVP approach: Direct Chart.js calls. No adapter needed for first release; we can add a slim sifToChartConfig() boundary later for new chart types.

6) MVP Scope (confirmed)

Data‑Driven Histogram (manual bins + frequencies)

Minimal Sketch overlay (freehand annotate on a small canvas; save thumbnail to SIF)

Export (rendered chart → PNG via canvas.toDataURL(); attach to answer if needed)

7) Accessibility & QA

Requirements (WCAG AA):

Keyboard‑only completion: Tab order, visible focus, ESC to close, return focus to invoker.

Focus trap in modal; role="dialog" with aria-labelledby/aria-describedby".

Live region or polite announcement on “Chart preview updated”.

Sufficient color contrast in bars/labels; respect dark mode.

Testing: Manual keyboard walkthrough + axe/Lighthouse a11y pass on Wizard surface (≥90).

Labels: Put every input (x/y label, bins, frequencies) behind <label for> or aria-label.

8) Performance & Footprint

Page already ships sizable content; load Wizard code on demand (defer or dynamically add <script>).

Chart.js already present; Wizard adds modest JS + one small canvas.

Mobile: keep canvas sizes conservative (e.g., 600×300 px) and throttle dataURI size.

9) Security & Privacy

Sanitize/escape any user‑supplied labels (use textContent or a tiny sanitizer for rare innerHTML).

Consider a Content Security Policy (CSP) allowing img-src 'self' data: to enable sketch thumbnails; avoid unsafe-inline where possible.

No PII collected; answers live in localStorage unless user explicitly syncs.

10) Curriculum Alignment Hooks

The repo’s curriculum map (ALL_UNITS_DATA) lists Unit 1 topics including 1‑5 (Representing a Quantitative Variable with Graphs), 1‑6 (Describing distributions), 1‑7 (Summary statistics), and 1‑8 (Graphical representations of summaries)—ideal triggers for showing a “Build a histogram” CTA near FRQs on those topics. 

units

11) Implementation Plan (3 short sprints)

Sprint 1 — Foundation

Modal scaffold + keyboard/focus trap.

SIF v0.1 + persistence in answers[questionId] (type: "chart-response").

Data entry form (bins + frequencies) with validation.

Sprint 2 — Rendering & Sketch

SIF → Chart.js config → live preview histogram (bar with gap=0).

Sketch canvas (draw/erase/clear) + save thumbnail to SIF.sketch.dataUri.

Export button (PNG).

Sprint 3 — Polish

A11y pass (ARIA, announcements, labels).

Dark‑mode polish and theming.

Optional: light adapter function sifToChartConfig() for future chart types.

12) Risks, Unknowns & Mitigations
Item	Likelihood	Impact	Mitigation
Sketch thumbnails exceed localStorage quota	Med	Med	Downscale to ≤600×300, JPEG at ~0.8, cap at 300 KB with warning
Mobile pointer events jitter	Med	Med	Use Pointer Events; smooth stroke; throttle to requestAnimationFrame
A11y regressions in modal	Low	High	Dedicated keyboard test & axe run before release
Chart.js change/upgrade risk	Low	Med	Pin version; test preview with sample SIF
