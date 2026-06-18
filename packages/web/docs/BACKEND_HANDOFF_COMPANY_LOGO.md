# Backend handoff — Company logo on saved jobs

**Date:** 2026-06-03  
**Frontend status:** ✅ Shipped (2026-06-13) — `CompanyLogo` component + dashboard / hub / analyzer / extension  
**Backend status:** ✅ Shipped — migration `20260610160000_job_company_logo`  
**Related:** [Job description storage](./BACKEND_HANDOFF_JOB_DESCRIPTION_AND_ANALYZER_STUB.md), [Dashboard recent analyses](./BACKEND_HANDOFF_DASHBOARD_RECENT_ANALYSES.md)

---

## Frontend implementation (complete)

| Area | Files / notes |
|------|----------------|
| Normalizers | `packages/web/src/lib/companyLogo.ts`, `api.ts`, `today-plan.ts`, `weekly-stall-summary.ts`, `jobHubMerge.ts` |
| Shared UI | `packages/web/src/components/ui/CompanyLogo.tsx` |
| Dashboard | Recent analyses, top matches, upcoming interviews, stall summary, quiet apps, interview prep, follow-up jobs |
| Job Hub | Sidebar rows + detail header |
| Analyzer | Results header (`JobAnalysisCard`), history list (`JobInputForm`) |
| Applications | `ApplicationsTrackerTab` list cards |
| Extension | `logoCandidateUrl` in `extractor.ts` + save payload; `CompanyLogoBadge` in Job tab + History tab; save response `companyLogoUrl` shown after save |
| Tests | `packages/web/src/lib/companyLogo.test.ts` |
| Discovery board | Unchanged — still uses listing `logoUrl` only |

**Field naming:** owned job rows use `companyLogoUrl`; discovery listings keep `logoUrl`. Normalizer reads camelCase + snake_case.

---

## Summary for backend team

Persist a **company logo URL** on every tracked job record (JobAnalysis, JobBookmark, Application — same row the user sees in Job Hub / Analyzer / Dashboard). The frontend will render the image wherever we currently show **company initials** (teal circle with first letter). When no logo is stored, UI keeps the initials fallback.

**Logo must be resolved at job-ingest time** from the **specific job posting** the user saved (extension tab URL or job-board listing), not from a generic company-name guess.

---

## Problem today (frontend) — resolved

| Surface | Behaviour after ship |
|---------|------------------------|
| Dashboard — Recent analyses | ✅ `CompanyLogo` when `companyLogoUrl` set |
| Dashboard — Interview prep queue | ✅ Logo or initials fallback |
| Dashboard — Today’s plan / follow-ups / quiet apps | ✅ Logo or initials fallback |
| Job Hub list + detail header | ✅ `companyLogoUrl` from merged tracked job |
| Job Analyzer results header | ✅ Logo in `JobAnalysisCard` header |
| Job board discovery | ✅ `logoUrl` on `JobListingDto` (unchanged) |

Extension sends optional `logoCandidateUrl` on save; backend resolves favicon / DOM / listing sources into persisted `companyLogoUrl`.

---

## Product goal

When a user saves a job from:

1. **Job board** — use the listing’s company logo (already on discovery payload when available).  
2. **Browser extension** — extract logo from the **open job posting page** and persist with the save.

Render the stored logo anywhere we list a job with a company name. Fall back to **first letter of company** when `companyLogoUrl` is null or image fails to load.

---

## Logo resolution — priority order

Backend should implement a shared resolver used on ingest (and optional backfill). Try sources **in order**; store the first acceptable result.

| Priority | Source | Notes |
|----------|--------|--------|
| **1** | **Client-supplied `logoCandidateUrl`** | Extension / job-board client sends absolute URL found on the posting DOM. Server validates, optionally re-hosts. **Best for LinkedIn / Indeed per-posting logos.** |
| **2** | **Page favicon** | `https://www.google.com/s2/favicons?domain=…&sz=128` or fetch `<link rel="icon">` from posting `sourceUrl`. Reliable fallback, lower quality. |
| **3** | **Open Graph image** | Fetch posting HTML; read `og:image` / `twitter:image`. Often a banner, not a square logo — accept only if dimensions/aspect look logo-like OR no better source exists. |
| **4** | **Site-specific selectors** | Known boards (see below). Run on server when re-fetching posting HTML or trust extension DOM extraction. |

**Do not** use company name → Clearbit/logo.dev alone as primary — wrong logo for similarly named companies. Optional **last resort** only when all posting sources fail.

### Site-specific hints (posting page, not company homepage)

| Site | Suggested selectors / patterns |
|------|--------------------------------|
| **LinkedIn** | Job detail company lockup img (`img[class*="EntityPhoto"]`, `.jobs-unified-top-card__company-logo`, `a[data-tracking-control-name="public_jobs_topcard_logo"] img`) |
| **Indeed** | `[data-testid="inlineHeader-companyLogo"] img`, `.jobsearch-CompanyAvatar img` |
| **Greenhouse** | `.logo img`, `#logo img` |
| **Lever** | `.posting-headline .logo img`, `.main-header-logo img` |
| **Workday** | `[data-automation-id="companyLogo"] img` |
| **Generic** | `[itemprop="logo"]`, `img[alt*="logo" i]`, header img near company name |

Extension team will mirror these selectors client-side and send `logoCandidateUrl` on save; backend should still validate and re-host.

---

## Database & storage

### Canonical field (JobAnalysis + related)

Add to the **job record** the user owns (same entity as `title`, `company`, `description`):

```typescript
type CompanyLogo = {
  /** HTTPS URL served by ApplyMate CDN (preferred) or trusted remote URL. */
  companyLogoUrl: string | null;
  /** Where we resolved it from — for debugging and refresh policy. */
  companyLogoSource?: 'posting_dom' | 'favicon' | 'open_graph' | 'site_selector' | 'discovery_listing' | 'manual' | null;
  /** ISO timestamp when logo was last resolved. */
  companyLogoFetchedAt?: string | null;
};
```

**Migration:** e.g. `20260603120000_job_company_logo` — columns on `JobAnalysis` (and denormalized read on `JobBookmark` / `Application` if those tables don’t join analysis every list query).

### Re-hosting (recommended)

- Fetch candidate URL server-side (SSRF-safe allowlist: `https:` only, block private IPs).
- Store bytes in object storage (S3 / R2) under `company-logos/{jobAnalysisId}.{webp|png}`.
- Return **stable ApplyMate CDN URL** in API responses so logos don’t break when LinkedIn URLs expire.
- Max size ~256 KB; resize to 128×128 or 256×256 square crop contain.

---

## Ingestion flows

### 1. Chrome extension — `POST /extension/jobs/save`

**Extend request body:**

```json
{
  "title": "Senior ML Engineer",
  "company": "Aya Data",
  "description": "...",
  "sourceUrl": "https://www.linkedin.com/jobs/view/1234567890/",
  "sourceSite": "linkedin",
  "logoCandidateUrl": "https://media.licdn.com/dms/image/.../company-logo_200_200/..."
}
```

**Backend:**

1. Accept optional `logoCandidateUrl` (alias `logo_candidate_url`).
2. Run resolver (candidate → favicon → OG → site selector on fetched HTML).
3. Persist on created/updated JobAnalysis (+ bookmark if created).
4. Echo in response:

```json
{
  "id": "uuid",
  "status": "saved",
  "companyLogoUrl": "https://cdn.applymate.com/company-logos/uuid.webp",
  "companyLogoSource": "posting_dom"
}
```

### 2. Job board → save / bookmark / analyze

When user bookmarks or analyzes from discovery:

- Copy `logoUrl` from `JobListing` → `JobAnalysis.companyLogoUrl` with `companyLogoSource: 'discovery_listing'`.
- If listing has no logo, attempt resolver using listing `url` + `company` domain.

**Endpoints:**

- `POST /job-discovery/bookmarks` (or equivalent create)
- `POST /jobs/analyze`
- Any path that creates a JobAnalysis from a listing id

### 3. Manual analyze / paste job

When analyze payload includes `applyUrl` or company careers URL, run resolver once on create.

### 4. Refresh policy

- **Do not** re-fetch on every GET.
- Re-resolve when: `companyLogoUrl` is null and user opens detail; or `logoCandidateUrl` changes on extension re-save; or explicit `POST /jobs/:id/refresh-logo` (optional, low priority).

---

## API responses — embed `companyLogoUrl`

Use **camelCase** in JSON; accept snake_case on input. Frontend normalizer will read both.

| Endpoint | Include field |
|----------|----------------|
| `GET /jobs/history` (each item) | `companyLogoUrl` |
| `GET /jobs/:jobAnalysisId` | `companyLogoUrl` on top level **and** inside `analysis` if nested |
| `GET /applications` / `GET /applications/:id` | `companyLogoUrl` (denormalized from linked analysis) |
| `GET /job-discovery/bookmarks` (each item) | `companyLogoUrl` |
| `GET /job-discovery/listings/:id` | keep existing `logoUrl`; **alias** to same resolver output for consistency |
| `GET /dashboard/today-plan` | `companyLogoUrl` on job-scoped cards (interview prep, follow-ups, quiet apps, top matches) |
| `GET /dashboard/interview-prep` | `companyLogoUrl` per row |
| `GET /dashboard/follow-up-jobs` | `companyLogoUrl` per row |
| `GET /dashboard/quiet-applications` | `companyLogoUrl` per row |
| `POST /extension/jobs/save` response | `companyLogoUrl` |
| `POST /extension/jobs/recent` items | `companyLogoUrl` |

### Example — history item

```json
{
  "id": "8245485f-10ae-44ba-93ad-60e0bad67ffa",
  "jobTitle": "Gmail Search Tab Help Community Manager",
  "company": "Google",
  "companyLogoUrl": "https://cdn.applymate.com/company-logos/8245485f.webp",
  "companyLogoSource": "posting_dom",
  "hasAnalysis": true,
  "matchScore": 26
}
```

When `companyLogoUrl` is `null`, frontend shows **“G”** for Google (current behaviour).

---

## Frontend plan — ✅ done

| Step | Work | Status |
|------|------|--------|
| 1 | Add `companyLogoUrl` to types + normalizers in `api.ts`, today-plan, weekly stall, job hub merge | ✅ |
| 2 | Shared `<CompanyLogo />` — image + initials fallback + `onError` | ✅ |
| 3 | Wire dashboard, Job Hub, analyzer, applications, follow-up / quiet / interview-prep pages | ✅ |
| 4 | Extension: `logoCandidateUrl` in `extractor.ts` + `SaveJobPayload`; show save response logo in Job tab | ✅ |
| 5 | Job board bookmark/analyze: backend copies listing `logoUrl` at persist (no extra client threading) | ✅ backend |

---

## Extension follow-up — ✅ done

1. ✅ `logoCandidateUrl?: string | null` on `ExtractedJob` and `SaveJobPayload`.
2. ✅ Site extractors + generic fallback in `extractor.ts` (LinkedIn, Indeed, Greenhouse, Lever, Workday, favicon).
3. ✅ Save response `companyLogoUrl` shown in Job tab header and “Saved to Job Hub” state; History tab uses same badge component.

---

## Acceptance checklist

### Backend

- [x] Extension save with LinkedIn posting stores square company logo (not blank).
- [x] Job board bookmark copies listing logo onto saved job.
- [x] `GET /jobs/history` returns `companyLogoUrl` for rows that have logos.
- [x] `GET /applications/:id` returns `companyLogoUrl` when linked to analysis.
- [x] Dashboard interview-prep / follow-up / quiet list payloads include `companyLogoUrl`.
- [x] Null logo does not error — field present as `null`.
- [ ] Logo URLs are HTTPS and served from stable CDN (remote hotlinks acceptable for v0 only if documented).
- [ ] SSRF-safe fetch when server retrieves candidate URLs.
- [ ] Optional: backfill job for existing JobAnalysis rows with `sourceUrl` set.

### Frontend

- [x] Recent analyses show logo when `companyLogoUrl` is set; initials when `null`.
- [x] Image load failure falls back to first letter without layout shift (`onError` in `CompanyLogo`).
- [x] Job Hub list + detail header use `companyLogoUrl`.
- [x] Analyzer header uses `companyLogoUrl` from job detail / analysis.
- [x] Follow-up, quiet, and interview-prep list pages show logos.
- [x] Applications list shows logo from linked analysis.
- [x] Bookmarks tab (Job Hub sidebar) shows logo from bookmark / analysis merge.
- [x] Discovery board still uses `logoUrl` only — no regression.
- [x] Extension save displays returned `companyLogoUrl` when present.
- [x] Extension sends `logoCandidateUrl` on LinkedIn / Indeed / other supported saves.

---

## Suggested backend files (indicative)

| Area | Suggestion |
|------|------------|
| Types | `company-logo.types.ts` |
| Resolver | `company-logo.resolver.service.ts` (favicon, OG, site registry) |
| Storage | `company-logo.storage.service.ts` (S3 upload) |
| Extension save | `extension-jobs.service.ts` — call resolver on save |
| Discovery → analysis | copy `logoUrl` on bookmark/analyze |
| Dashboard DTOs | include denormalized `companyLogoUrl` on list builders |

---

## Questions for backend

1. Prefer **one column** `company_logo_url` on `JobAnalysis` only, with joins for lists — or denormalize onto `Application` / `JobBookmark` for read performance?
2. Is CDN re-host **required** for v1, or can we ship with validated remote URLs first?
3. Should expired LinkedIn media URLs trigger lazy refresh on first 404 from the client?

**Follow-up (out of scope v1):** CDN re-host, lazy refresh on 404, `POST /jobs/:id/refresh-logo`, backfill for pre-migration saves.
