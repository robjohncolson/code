### Decisions and Unknowns

Category	Decision/Question	Recommendation / Default	Owner	Status
Architecture	Direct Chart.js vs Adapter	Direct Chart.js for MVP; add tiny sifToChartConfig() later.	Tech Lead	Decided
UX Container	Modal vs Side Panel	Ship Modal first; keep CSS hooks for Side Panel on desktop.	FE/Design	Decided
Data Model	SIF storage location	Store SIF as answers[qid].value; set type: "chart-response".	FE	Decided
Sketch	Include in MVP?	Yes—Minimal Sketch (freehand, small thumbnail).	Product	Decided
Scope	Initial chart types	Histogram only for MVP; others later.	Product	Decided
A11y	Focus trap & ARIA	Add role="dialog", labels, and announcements; keyboard pass.	FE/QA	Decided
Security	Sanitization	No innerHTML for labels; textContent/escape; optional DOMPurify.	Security	Open
Perf	Lazy-load wizard code	Yes; load on first open; reuse global Chart.js.	FE	Decided
Unknown	Sketch size limits	Cap at 300 KB, JPEG compress, downscale to ≤600×300.	FE	Open
Unknown	Touch/pointer events	Use Pointer Events; test Chromebook + iPad.	FE	Open
Curriculum	Auto‑suggest triggers	Show CTA for Unit 1 topics 1‑5/1‑6/1‑7/1‑8.	PM/FE	Decided

What changed vs. the three drafts?

We dropped the Web Audio repo assumptions (Codex) and retained the AP Stats app facts (Claude/ Cursor).

We stabilized the SIF (adds binning.mode, renderOptions, size guidance for sketch).

We made a11y requirements explicit (focus trap + announcements), and kept the modal‑first shipping plan with an easy path to a side panel.
