# Backend handoff — Extension logo on analyze + cover letter 400

**Date:** 2026-06-13  
**Backend status:** ✅ Verified + enhanced  
**Frontend status:** ✅ Shipped — score sends `logoCandidateUrl`; save fallback retained  
**Related:** [Company logo](./BACKEND_HANDOFF_COMPANY_LOGO.md), [Extension sync](./FRONTEND_HANDOFF_CHROME_EXTENSION_SYNC.md)

---

## Summary

| Issue | Backend | Extension |
|-------|---------|-----------|
| Logo missing after Analyze | ✅ `logoCandidateUrl` on `POST /extension/cv/score`; check returns `companyLogoUrl` | ✅ Sends logo on score; merges response + check; save fallback if still unset |
| Cover letter 400 | ✅ DTO unchanged; `sourceSite` added | ✅ Whitelisted payload (no `action` key) |
| Save upsert clears analysis | ✅ Confirmed safe | Post-score save only when logo still missing after score + check |

---

## Extension implementation (complete)

| Change | File |
|--------|------|
| `logoCandidateUrl` on score POST | `cv-score-payload.ts`, `service-worker.ts` |
| Map `companyLogoUrl` from score + check | `api.ts`, `types.ts` |
| Merge logo into session after score | `service-worker.ts` (`mergeScoreLogoIntoSession`) |
| Save fallback when score/check have no logo | `save-job-payload.ts`, `syncJobLogoAfterAnalyze` |
| Cover letter whitelisted payload + UI gates | `cover-letter-payload.ts`, `CVTab.tsx` |

### Score request (includes logo)

```json
{
  "cvId": "uuid",
  "jobTitle": "Frontend Developer",
  "jobDescription": "…",
  "company": "Acme Corp",
  "sourceUrl": "https://www.linkedin.com/jobs/view/4426991316",
  "sourceSite": "linkedin.com",
  "logoCandidateUrl": "https://media.licdn.com/…"
}
```

### Flow after Analyze

1. `POST /extension/cv/score` with `logoCandidateUrl`
2. Merge `companyLogoUrl` from score response into extension session
3. `GET /extension/jobs/check` (force refresh)
4. If check still has no `companyLogoUrl` → `POST /extension/jobs/save` with logo (fallback)

---

## Backend contracts (reference)

### Score response fields used by extension

- `companyLogoUrl` / `company_logo_url`
- `jobAnalysisId`, `matchScore`, `persisted`, etc. (unchanged)

### Check response

- `companyLogoUrl` (null when unset) — extension skips save fallback when present

### Cover letter — `POST /extension/cover-letter`

Required: `cvId`, `jobTitle`, `jobDescription`, `company`  
Optional: `jobLocation`, `jobType`, `jobAnalysisId`, `sourceUrl`, `sourceSite`  
Do **not** send `action` or other keys.

---

## Acceptance

- [x] Backend: score accepts `logoCandidateUrl`; check returns `companyLogoUrl`
- [x] Backend: save on analyzed row updates logo only
- [x] Extension: logo on score POST
- [x] Extension: cover letter payload whitelisted
- [ ] Manual QA: Analyze on LinkedIn → dashboard shows company logo without manual Save

Questions → request/response JSON from Network tab.
