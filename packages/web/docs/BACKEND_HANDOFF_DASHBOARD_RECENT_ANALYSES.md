# Backend handoff — Dashboard “Recent analyses” for bookmark-only jobs

**Date:** 2026-06-03  
**Backend status:** ✅ Done (2026-06-03)  
**Frontend status:** ✅ Aligned — trusts `hasAnalysis`, `matchScore: null`, `applicationAssist.suggestedNextStep`  

Related: `BACKEND_HANDOFF_JOB_DESCRIPTION_AND_ANALYZER_STUB.md` (description storage + analyzer stubs).

---

## Frontend alignment (2026-06-03)

| Area | Change |
|------|--------|
| `normalizeJobHistoryItem` | Preserves `matchScore: null`; trusts `hasAnalysis` boolean only |
| `JobHistoryItem` type | `matchScore` and `recommendation` nullable |
| `historyItemHasCompletedAnalysis` | AI-only (`hasAnalysis`, `analyzeSource: ai`) |
| `isCompletedJobAnalysis` | Respects `hasAnalysis`; treats `gemini` as AI; ignores skillCoverage-only stubs |
| `RecentAnalysesPanel` | — score, “Not analyzed”, “Analyze this job” for `hasAnalysis: false` |
| `jobHubMerge` | Uses shared `historyItemHasCompletedAnalysis` helper |

---

## Problem (original)

Jobs saved from the Chrome extension **without running AI analysis** appear in **Recent analyses** with:

- **0% match score** (red ring)
- Badge: **“NEEDS COVER LETTER”**
- Next step: **“Generate cover letter →”**

These rows are **bookmarks**, not completed analyses. Showing 0% and cover-letter CTAs misleads users.

---

## Expected behaviour

| Field / behaviour | Bookmark-only save (`hasAnalysis: false`) | After real analyze (`hasAnalysis: true`) |
|-------------------|-------------------------------------------|------------------------------------------|
| `hasAnalysis` | `false` | `true` |
| `analyzeSource` | absent, or `'heuristic'` — **not** `'ai'` | `'ai'` |
| `matchScore` | **`null` or omit** — do not send `0` | `0–100` from AI |
| `recommendation` | omit or empty | populated |
| `analysisV2` | omit | populated when v2 enabled |
| `hasCoverLetter` | `false` (OK) | per actual state |
| `applicationAssist.suggestedNextStep` | e.g. `"analyze"` — not `"cover_letter"` | pipeline-appropriate |
| List placement | May appear in “recent activity” but UI treats as **not analyzed** | Full analysis workflow |

---

## API: `GET /jobs/history`

Frontend now uses:

```typescript
historyItemHasCompletedAnalysis(item)
```

Logic (in order):

1. `hasAnalysis === false` → **not analyzed**
2. `hasAnalysis === true` → analyzed
3. `analyzeSource === 'heuristic'` → **not analyzed**
4. `analyzeSource === 'ai'` → analyzed
5. `analysisV2` present → analyzed
6. `matchScore > 0` **and** non-empty `recommendation` → analyzed (legacy fallback)
7. Otherwise → **not analyzed**

**Backend should set `hasAnalysis` explicitly on every row** so clients do not rely on heuristics.

### Required response shape (per item)

```json
{
  "id": "8245485f-10ae-44ba-93ad-60e0bad67ffa",
  "jobTitle": "Senior ML Engineer",
  "company": "Aya Data",
  "hasAnalysis": false,
  "analyzeSource": null,
  "matchScore": null,
  "recommendation": "",
  "hasCoverLetter": false,
  "isTailored": false,
  "description": "<full job ad text when stored>",
  "createdAt": "2026-06-03T..."
}
```

**Do not** return `matchScore: 0` for bookmark-only rows — use `null` or omit the field.

---

## Frontend mitigation (shipped)

File: `packages/web/src/components/dashboard/overview/RecentAnalysesPanel.tsx`

| Before | After (unanalyzed row) |
|--------|-------------------------|
| 0% ring | **—** (no score) |
| “Needs cover letter” badge | **“Not analyzed”** |
| “Generate cover letter →” | **“Analyze this job →”** (opens analyzer with prefill) |

Prefill uses `description` / `jobDescription` from the history row when present.

---

## What we need from backend (checklist)

1. **`hasAnalysis: false`** on extension bookmark saves in `GET /jobs/history`.
2. **`matchScore: null`** (not `0`) when `hasAnalysis === false`.
3. **Full `description`** on history rows for extension saves (so “Analyze this job” can prefill the form).
4. **`analyzeSource`** — use `'ai'` only after real analyze; omit or `'heuristic'` for stubs (frontend treats heuristic as not analyzed).
5. Optional: **`suggestedNextStep: "analyze"`** in `applicationAssist` for bookmark-only rows.
6. Optional: separate **`GET /jobs/recent-activity`** vs analyzed-only list — if product wants bookmark saves out of “Recent analyses” entirely, say so and we will filter client-side on `hasAnalysis`.

---

## Verification

1. Save job from extension (no analyze).
2. `GET /jobs/history` → row has `hasAnalysis: false`, `matchScore: null`, non-empty `description`.
3. Dashboard Recent analyses → **—** score, “Not analyzed”, “Analyze this job”.
4. Run analyze on that job → `hasAnalysis: true`, real score, normal pipeline CTAs.

---

## After backend ships

Frontend will:

- Prefer `hasAnalysis` over all heuristics (already does when field is present).
- Optionally filter Recent analyses to analyzed-only if product requests.
- Wire `suggestedNextStep` from API when available.

Please reply with sample `GET /jobs/history` JSON for one bookmark-only and one analyzed row after your changes.
