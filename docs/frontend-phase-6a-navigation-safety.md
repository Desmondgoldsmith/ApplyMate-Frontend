# ApplyMate Frontend — Phase 6A: Navigation safety + clean labels

## Objective

Consume the corrected dashboard payload so the UI only renders **valid links** and **user-facing labels**.

## Requirements

### 1) Trust backend CTA fields

For all hero, continuation, and informational cards:

- Use `ctaHref` **exactly** as provided by the backend.
- Use `ctaLabel` **exactly** as provided by the backend.
- Do **not** infer routes from text (e.g. “Open analysis”).
- Do **not** hardcode legacy routes like `/dashboard/discovery`.
- Do **not** manually construct interview or CV profile routes from IDs unless using a server-provided href.

### 2) Route safety

Before rendering a CTA:

- Ensure `href` is a non-empty string.
- If missing or invalid, use a safe fallback route.
- Never render a link to a non-existent page.

### 3) Fix `Button` `asChild` warning

Problem: `Button.tsx` forwards `asChild` to a native `<button>`, causing React warnings.

Required fix: Use the Radix `Slot` pattern and **do not** forward `asChild` into DOM props.

### 4) Render clean labels

Do not display internal backend enum strings such as:

- `CV_IMPROVEMENT_STORED`
- `CV_SECTION_EXPERIENCE`

Render only user-facing labels from the backend (e.g. `statusLabel`, `tagLabel`).

### 5) Null-state handling

When metrics are `null`, display honest empty states like:

- “Not enough data yet”
- “No completed follow-ups yet”

Do not fabricate zeros unless the backend explicitly returns `0`.

### 6) CTA consistency

Hero CTA must match the narrative context, for example:

- CV narrative → “Open CV”
- Job discovery narrative → “Browse jobs”
- Job analysis narrative → “Open analysis”

## Acceptance criteria

- All dashboard CTAs navigate to valid pages.
- No route is inferred from CTA text.
- No broken links remain.
- The `Button` `asChild` warning is resolved.
- Internal labels / reason codes are hidden.
- Metrics show accurate values or honest empty states.

---

## Message to send frontend

Team — Phase 6A backend changes are ready to consume. The dashboard payload now includes **resolved, validated CTAs** and **clean CV clinic labels** so the UI never shows broken routes or internal enum strings.

### What changed on the backend (you can rely on this)

- **Hero CTA** is resolved + validated server-side on `assistantNarrative`:
  - `assistantNarrative.ctaHref` (string): fully resolved dashboard URL
  - `assistantNarrative.ctaValidated` (boolean): whether backend validation passed
  - `assistantNarrative.ctaSource` (string): provenance (e.g. `job_matching`, `cv_intelligence`, `job_discovery`, …)
  - `assistantNarrative.ctaLabel` remains and is aligned to hero context
- Legacy/non-existent routes are removed from dashboard-generated CTAs:
  - No more `/dashboard/discovery`, `/dashboard/interview`, `/dashboard/jobs`, `/dashboard/cv` coming from dashboard surfaces.
  - Replacements are real routes: `/dashboard/job-board`, `/dashboard/job-analyzer`, `/dashboard/job-hub`, `/dashboard/cv-profiles(/:id)`, `/dashboard/interviews(/:id)`
- **CV Clinic nudge** no longer exposes internal enums:
  - Action items may now include `statusLabel` + `tagLabel` for clean display.

### What the frontend should do

- **Hero CTA click target**
  - Use `assistantNarrative.ctaHref` for the destination.
  - Use `assistantNarrative.ctaLabel` for the button text.
  - Optional: log `ctaValidated` / `ctaSource` for telemetry (no UI required).
- **Assistant guidance / “next action” deep link**
  - Prefer backend-provided `assistantGuidance.href` when present (validated server-side).
- **Job discovery CTA**
  - Remove any client-side hardcoding of discovery routes; use backend hrefs.
  - Anywhere you still navigate to `/dashboard/discovery`, update to `/dashboard/job-board`.
- **CV Clinic card labels**
  - Stop rendering `reasonCodes` like `CV_IMPROVEMENT_STORED` / `CV_SECTION_*`.
  - Display:
    - `statusLabel` as the primary status line (fallback to existing subtitle if missing)
    - `tagLabel` as the tag/chip (fallback to a generic “CV improvement” label)

### Notes / compatibility

These changes are additive (existing renders won’t crash if you don’t update immediately), but you won’t get the “no broken links / no internal labels” guarantee until you consume them.

Safe fallback routes are always one of:
`/dashboard/job-board`, `/dashboard/job-analyzer`, `/dashboard/job-hub`, `/dashboard/cv-profiles`, `/dashboard/interviews`.

