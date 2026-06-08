# Frontend handoff — Chrome extension ↔ dashboard sync

**Date:** 2026-06-07  
**Backend status:** Done  
**Frontend status:** Implemented in extension + web Job Hub merge  

See backend sections in the original handoff for API contracts. This doc notes **what the frontend implemented**.

---

## Web app (`packages/web`)

| Change | File |
|--------|------|
| Use `hasAnalysis` from `GET /jobs/history` for column placement | `jobHubMerge.ts` |
| Type `hasAnalysis`, `analyzeSource`, `savedVia` on history items | `lib/api.ts` |
| Silent session restore from API refresh cookie | `lib/authRefresh.ts`, `providers.tsx`, `ExtensionAuthBridge.tsx` |

Bookmark-only extension saves (`hasAnalysis: false`) appear in **Bookmarked**, not **Analyzed**.

---

## Extension (`packages/extension`)

| Change | File |
|--------|------|
| Per-URL job session in `chrome.storage.session` | `shared/job-session.ts` |
| Pass `jobAnalysisId` + `sourceUrl` on score / cover letter | `shared/api.ts`, service worker |
| Hydrate score from enriched `GET /extension/jobs/check` | service worker, `JobSessionContext` |
| Tab state persists (tabs stay mounted + session hydrate) | `MainView.tsx`, `JobSessionContext.tsx` |
| Summary score UI + “View full analysis in ApplyMate” | `CVTab.tsx` |
| SPA job detection (URL + DOM watch) | `content/job-bridge.ts` |

---

## Testing

1. Save job from extension → Job Hub **Bookmarked** column (`hasAnalysis: false`).
2. Score from extension → same `matchScore` in dashboard job detail.
3. Switch Job → CV → History → CV — score and cover letter remain.
4. Open LinkedIn job without refresh — sidebar populates within ~1s.
5. Navigate away from job page — job card persists until **Clear**.
