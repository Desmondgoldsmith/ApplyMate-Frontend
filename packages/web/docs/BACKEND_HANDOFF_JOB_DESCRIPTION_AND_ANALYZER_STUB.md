# Backend handoff — Job description storage & analyzer stub rows

**Date:** 2026-06-03  
**Backend status:** ✅ Done (2026-06-03)  
**Frontend status:** ✅ Aligned — session prefill + `hasAnalysis` / `matchScore: null` handling  

---

## Problem

When a user **saves a job from the Chrome extension** (bookmark-only, `hasAnalysis: false`):

1. **Job Hub → Description tab** shows *“No description stored for this role yet”* even though the extension extracted the full job ad text.
2. **Job Analyzer** opened with `?jobId=<savedJobAnalysisId>` shows **0% match / Low match** in Results before the user runs analysis — because the API returns a **heuristic placeholder** analysis row, not a real AI analysis.

The frontend now avoids showing fake scores and injects raw description from the extension session when possible. **Backend should persist and return the full description** so this works across devices, tabs, and after refresh.

---

## Expected behaviour

| Scenario | Expected |
|----------|----------|
| Extension `POST` save job (with `description` in body) | Store full plain-text job description on the JobAnalysis / bookmark record |
| `GET /jobs/:id` for bookmark-only row | Return `description` (or `jobDescription`) with full text, not empty |
| `GET /job-discovery/bookmarks` (hub list) | Return `descriptionSnippet` with meaningful excerpt **or** full `description` field |
| Bookmark-only row (`hasAnalysis: false`) | Do **not** return heuristic `matchScore: 0` as if user analyzed; omit analysis block or set `scoreSource: 'heuristic'` consistently (frontend treats heuristic as “not analyzed”) |
| After user runs real analyze | `hasAnalysis: true`, `scoreSource: 'ai'`, populated `analysisV2` / factors |

---

## API contracts the frontend consumes

### `GET /jobs/:id` (Job detail)

Frontend reads description from (in order):

- `description`
- `jobDescription` / `job_description`
- nested `job.description`
- nested `analysis.description`
- `salaryEstimate.postingText` (fallback only)

**Ask:** For extension saves, populate top-level `description` with the text sent on save.

### `GET /jobs/history` & hub bookmarks

Frontend uses:

- `hasAnalysis` — when `false`, hub shows “No analysis yet” (not 0% ring)
- `descriptionSnippet` — shown in hub list / detail when full description missing

**Ask:** When saving from extension with description, set `descriptionSnippet` to at least first ~500 chars and persist full text for detail endpoint.

### Extension save payload (already sent)

```json
{
  "title": "...",
  "company": "...",
  "description": "<full job ad text>",
  "sourceUrl": "...",
  "sourceSite": "..."
}
```

Confirm this field is written to DB and returned on subsequent reads.

---

## Optional improvements

1. **`descriptionHighlights`** — structured sections for Description tab (frontend renders when present; plain text fallback is fine).
2. **`POST /extension/jobs/save` response** — include `description` echo so clients can verify persistence.
3. **Avoid creating heuristic analysis stub on bookmark-only save** — bookmark row without `matchScore` is enough; reduces confusion for all clients.

---

## Frontend mitigations (already implemented)

| Mitigation | Location |
|------------|----------|
| Extension injects raw JD into dashboard `sessionStorage` when opening Job Hub | `packages/extension/src/shared/web-hub-prefill.ts` |
| Job Hub reads session prefill + waits for `GET /jobs/:id` before empty state | `JobHubDetailPanel.tsx`, `jobHubPrefill.ts` |
| Analyzer ignores heuristic/stub analysis via `isCompletedJobAnalysis()` | `JobsAnalyzeContent.tsx`, `jobAnalysisComplete.ts` |
| Analyzer Results empty state until real analyze | `JobsAnalyzeContent.tsx` |
| URL `description` param fallback when opening analyzer from extension | `JobsAnalyzeContent.tsx` |

These are **one-tab, same-session fallbacks**. Backend persistence is required for production reliability.

---

## Verification (backend)

1. Save job from extension with 2k+ char description.
2. `GET /jobs/:id` → `description` length matches saved text.
3. `GET /job-discovery/bookmarks` → row has non-empty `descriptionSnippet` or `description`.
4. Same job: `hasAnalysis: false`, no AI factors / `analysisV2` until user analyzes.
5. After analyze: `hasAnalysis: true`, `scoreSource: 'ai'`, non-zero or meaningful match data.

---

## Contact

Frontend owner can demo repro: extension save → View in Job Hub → Description tab empty (without session prefill) / Analyzer shows 0% (without frontend stub guard).
