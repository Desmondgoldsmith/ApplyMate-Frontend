# Apply Mate — detailed product & tech audit (frontend)

**Date:** 15 May 2026  
**Repository:** `applymate-frontend/packages/web` (Next.js **16.2**, React **19**, Tailwind **4**, TanStack Query **5**, Zustand **5**).  
**Backend companion:** `apply-mate-backend/docs/LAYMAN_PRODUCT_TECH_AUDIT.md`.  
**Duplicate note:** The same document is maintained at `apply-mate-backend/docs/LAYMAN_FRONTEND_TECH_AUDIT.md` — update **both** when conclusions change.

This document walks **routes → components → hooks → API calls** so engineers and stakeholders can follow the real implementation, not marketing copy.

---

## 1. Honesty box

| From code | Needs running app / design review |
|-----------|-----------------------------------|
| Folder structure, hooks, query keys, request paths | Visual hierarchy, spacing taste, motion taste, full a11y audit |

---

## 2. Monorepo placement

The marketing app is **`packages/web`** inside `applymate-frontend`. Shared types/utilities may live in **`packages/shared`** (`@applymate/shared` in `package.json`). This audit focuses on **`packages/web/src`**.

---

## 3. Folder structure (`src/`)

| Directory | Contents |
|-----------|----------|
| **`app/`** | Next.js App Router: layouts, `page.tsx` routes, `providers.tsx`, `global-error.tsx`, API routes (e.g. Sentry test). |
| **`app/(dashboard)/dashboard/**`** | Authenticated product surface — each subfolder is a route (see §4). |
| **`components/`** | Reusable UI: `ui/*` primitives, `dashboard/*`, `job-board/*`, `cv/*`, `onboarding/*`, … |
| **`hooks/`** | React Query wrappers (`useJobDiscovery`, `useAnalyzeJob`, `useCVProfile`, …), media queries, autosave. |
| **`lib/`** | `api.ts` (large typed client), `axios.ts`, domain helpers (`jobBoardAnalysisReuse.ts`, `today-plan.ts`, `executionMemory.ts`, …), pure functions with unit tests. |
| **`store/`** | Zustand stores (`useAuthStore`, `useUIStore`, …). |

---

## 4. App Router — dashboard routes (file → URL)

Base layout group: **`src/app/(dashboard)/`**. Primary URLs (from `page.tsx` files):

| URL path | `page.tsx` location | Main client component |
|----------|---------------------|------------------------|
| `/dashboard` | `dashboard/page.tsx` | Overview / today plan (various panels) |
| `/dashboard/job-board` | `dashboard/job-board/page.tsx` | Suspense → **`JobBoardContent`** |
| `/dashboard/jobs` | `dashboard/jobs/page.tsx` | Suspense → **`JobHub`** |
| `/dashboard/jobs/analyze` | `dashboard/jobs/analyze/page.tsx` | **`JobsAnalyzeContent`** (same folder) |
| `/dashboard/job-analyzer` | `dashboard/job-analyzer/page.tsx` | **Server redirect** → `/dashboard/jobs/analyze` (maps `jobAnalysisId`/`jobId`/`contextToken`/`openTailor` query params for backend deep links). |
| `/dashboard/job-hub` | `dashboard/job-hub/page.tsx` | **Server redirect** → `/dashboard/jobs` (or `/dashboard/follow-up-jobs` when `followUps`); normalises bookmark/analysis/application query keys. |
| `/dashboard/cv` | `dashboard/cv/page.tsx` | **Large** CV clinic + builder shell (see §9) |
| `/dashboard/cv-profiles` | `dashboard/cv-profiles/page.tsx` | Shelf of profiles |
| `/dashboard/cv-profiles/[id]` | `dashboard/cv-profiles/[id]/page.tsx` | Profile-scoped CV |
| `/dashboard/analyses` | `dashboard/analyses/page.tsx` | History-style analyses list |
| `/dashboard/settings` | `dashboard/settings/page.tsx` | User settings |
| `/dashboard/interview*` | under `dashboard/interview/*` | Interview flows |
| `/dashboard/follow-up-jobs` | `dashboard/follow-up-jobs/page.tsx` | Follow-up queue UI |
| `/dashboard/next-moves` | `dashboard/next-moves/page.tsx` | Next moves |
| … | … | … |

**Pattern:** Many pages wrap heavy client trees in **`<Suspense fallback={…}>`** so `useSearchParams()` and async-boundary rules in Next 16 do not block the shell.

**Navigation config:** `src/components/dashboard/dashboardNavConfig.ts` — array `DASHBOARD_NAV_ITEMS` maps **labels**, **short labels** (mobile bar), **`href`**, **`icon`**, optional **`feature`** (`jobs`, `interviews`, `student`) and **`comingSoon`**.

---

## 5. Global providers and cross-cutting behaviour

- **`src/app/providers.tsx`** — wraps children with React Query `QueryClientProvider`, toast context, etc.; imports **`@/lib/posthog`** for analytics init when env key present.  
- **`src/lib/axios.ts`** — **`axiosClient`**:  
  - `baseURL` = `NEXT_PUBLIC_API_URL` or default `http://localhost:3000/api/` (**must include `/api`** to match Nest `setGlobalPrefix('api')`).  
  - `withCredentials: true` for cookie-backed flows.  
  - Request interceptor: attaches **`Authorization: Bearer`** from `useAuthStore` or `readApplymateTokenFromCookie()`.  
  - Second interceptor: for mutating **`/cv/`** requests, injects **`X-Request-Id`** (UUID) if absent — pairs with backend request logging.  
  - Response interceptor: on **401** (except login/register URLs), clears auth and redirects to **`/login`**.  
- **`src/lib/api.ts`** — thousands of lines: **types** (`JobAnalysis`, `HubBookmarkItem`, …) + **functions** that call `axiosClient` (`api.jobs.analyze`, `api.jobDiscovery.discover`, …). **Single import surface** for the app; trade-off is file size.

---

## 6. Feature: Job Board — step-by-step (user + code)

### 6.1 User journey (happy path)

1. User opens **`/dashboard/job-board`**.  
2. Page shows skeleton until client bundle hydrates **`JobBoardContent`**.  
3. **`useCVProfiles`** loads profiles; effect picks **default** profile id into local `selectedProfileId`.  
4. **`useCurrentUser`** + profile location + **`localStorage`** key `applymate:job-board:last-location:{userId}` bootstrap **`locationInput`** / `appliedFilters.location` (see effects starting ~L79 in `JobBoardContent.tsx`).  
5. User adjusts filters / hits Search → **`useJobDiscovery`** refetches **GET `/api/job-discovery`** with query params (`cvProfileId`, `location`, `q`, pagination, `remoteFirst`, …).  
6. User clicks a listing card → **`activeJobId`** + optional mobile detail sheet; **`JobDetailPanel`** loads richer text via **GET `/api/job-discovery/:id`** when needed.  
7. **`useJobBoardAiMatch`** (debounced) tries to show a fit score (§7).

### 6.2 Key files

| File | Responsibility |
|------|----------------|
| `app/(dashboard)/dashboard/job-board/page.tsx` | Route shell + Suspense fallback. |
| `app/(dashboard)/dashboard/job-board/JobBoardContent.tsx` | All board UI state, banners, pagination, profile picker, discovery query wiring. |
| `components/job-board/JobBoardFilters.tsx` | Filter controls. |
| `components/job-board/JobListingCard.tsx` | Row UI. |
| `components/job-board/JobDetailPanel.tsx` | Detail pane + hooks into match score UI. |
| `hooks/useJobDiscovery.ts` | React Query wrapper around `api.jobDiscovery.*`. |
| `hooks/useJobBoardAiMatch.ts` | Debounced AI / reuse / quota logic. |
| `lib/jobBoardAnalysisReuse.ts` | Pure helpers: `jobDescriptionsLikelySame`, `pickAnalysisIdForListing`, `resolveExistingJobAnalysisId`. |
| `lib/jobBoardDiscoverQuery.ts` | `compactLocationForJobSearch` etc. |

### 6.3 Server calls used on the board

- **Discovery list:** `GET /api/job-discovery?...`  
- **Mark seen (novelty):** `POST /api/job-discovery/mark-seen` (wired where the product resets “new” badges).  
- **Bookmark:** `POST /api/job-discovery/:id/bookmark`, **DELETE** to remove.  
- **Analyze quick action:** `POST /api/job-discovery/:id/analyze-start` → client navigates using returned **route** object (backend builds path with `jobListingId` query).  
- **Tailor quick action:** `POST /api/job-discovery/:id/tailor-start` — similar deep link.

---

## 7. `useJobBoardAiMatch` — detailed algorithm

**File:** `src/hooks/useJobBoardAiMatch.ts`.

**Constants:** `DEBOUNCE_MS = 480`. **`inflightAnalyzeByKey`** module Map dedupes concurrent **`POST /jobs/analyze`** for the same `(cvProfileId, discoveryJobId)` string key.

**State A — Debounce gate:** `debouncedJobId` only equals `opts.discoveryJobId` after the user pauses on a card for **480ms** → `settledOnJob`.

**State B — Preconditions for full AI query:** `enabled` when: `jobDetailReady`, `settledOnJob`, non-empty `cv`, description trimmed **≥ 30** chars, and **`canUseAiFromDailyAiUsage(aiUsage)`** is true.

**QueryFn (normal quota path):**

1. Call **`fetchJobBoardReuseOnlyMatch`** (no POST):  
   - `ensureQueryData` **`['job-analyses', 'listing', discoveryJobId]`** → `api.jobs.listAnalyses({ jobListingId })`.  
   - **`pickAnalysisIdForListing`** chooses best analysis id for this CV (prefers tailored). If found → **`api.jobs.getJob(id)`** → return `{ analysis, matchSource: 'reused' }`.  
   - Else load **`['job-analyses']`** (global list) + **`['hub-bookmarks']`**.  
   - **`resolveExistingJobAnalysisId`** finds a candidate analysis id from bookmarks + title/company heuristics.  
   - If candidate → **`getJob`**, then **`jobDescriptionsLikelySame(storedDescription, currentListingDescription)`** — if false, **do not reuse** (avoid wrong score when JD text drifted).  
2. If still no reuse → **`runAnalyzePostOnce`** → **`api.jobs.analyze({…, jobListingId})`**.  
3. On fresh analyze success (not `reusedExistingAnalysis`), invalidate `job-analyses`, `me`, `analytics`, `job-history`, `cv-profiles`, `hub-bookmarks`, **`invalidateTodayPlanQueries`**.

**Over-quota path:** Separate `useQuery` when `quotaHit`: first same **`fetchJobBoardReuseOnlyMatch`**; if no saved AI analysis, **`api.jobs.matchScore`** (heuristic) with description slice in **queryKey** for cache stability. Comments document **not** mislabelling heuristic as full AI when user still has quota.

**Return shape:** Spreads main `useQuery` plus **`isDebouncing`**, **`savedAnalysisOverQuota`**, **`quotaFitScore`**, fetch flags.

---

## 8. Feature: Job Hub — step-by-step

### 8.1 Route

- **`/dashboard/jobs`** → `JobHub.tsx` (not `job-hub/page.tsx` only — both may exist; nav `href` for Hub is **`/dashboard/jobs`** per `dashboardNavConfig.ts`).

### 8.2 Data sources merged client-side

**`mergeTrackedJobs`** (`jobHubMerge.ts`) combines:

1. **`useApplications()`** — formal applications from API.  
2. **`useJobHistory()`** — saved **`JobAnalysis`** rows / summaries.  
3. **`useHubBookmarks()`** — discovery bookmarks.  
4. **`overrides`** — `loadStageOverrides()` from **`localStorage`** (user-drag overrides when server has no `Application` yet).

Output: unified **`TrackedJob`** list with a **`HubStage`** used for kanban columns.

### 8.3 Mutations and cache coherence

**`patchBookmarkPipeline`** → **`api.jobDiscovery.patchBookmark`** → `onSuccess` invalidates:

`['hub-bookmarks']`, `['job-history']`, `['applications']`, `['hub-reminders']`, plus **`invalidateGrowthQueries`**, **`invalidateTodayPlanQueries`**.

**`patchJobPipeline`** → **`api.jobs.updateAnalysisStatus`** → similar invalidation including **`['job', jobAnalysisId]'`**.

This is **correct** React Query hygiene — dashboard cards stay in sync.

### 8.4 Local reminders UI

**`notifyDueLocalReminders`** on interval (8s) + window focus — purely client UX layer on top of whatever reminder model you store (browser notifications / local storage — see `lib/jobHubLocalReminders.ts`).

### 8.5 Key files

| File | Role |
|------|------|
| `app/(dashboard)/dashboard/jobs/JobHub.tsx` | Shell: view toggle, search, merged list, detail panel. |
| `JobHubKanban.tsx` / `JobHubTable.tsx` | Layout modes. |
| `JobHubDetailPanel.tsx` | Tabs: analysis, JD, cover, notes, email, resume. |
| `jobHubMerge.ts` | Merge + stage mapping helpers. |
| `jobHubPrefill.ts` | Analyzer prefill from hub (`prefillJobAnalyzerInStorage`, context tokens). |
| `hooks/useHubBookmarks.ts`, `useJobHistory.ts`, `useApplications.ts` | Server state. |

---

## 9. Feature: Job Analyzer page — step-by-step

**Route:** **`/dashboard/jobs/analyze`** → `JobsAnalyzeContent.tsx` (very large file: **~1.7k+** lines — high cognitive load for maintainers).

### 9.1 Responsibilities bundled in one component

- Form state for title / company / JD (with **`localStorage`** persistence under keys like `applymate:dashboard:jobs:analyze-form`).  
- **Analyze** mutation path via **`useAnalyzeJob`**.  
- **Generate** answers + cover letter via **`useGenerateContent`**.  
- **Tailoring** sidebar **`CvTailoringSidebar`** + tailor draft APIs.  
- **Session storage** fingerprint `tailoringSessionFingerprint(cv, title, company, jd)` for completed tailor drafts map `STORAGE_COMPLETED_TAILOR_KEY`.  
- **Execution memory** checkpoints (`executionMemory.ts`) aligned with backend continuity.  
- **PDF** export for cover letter (`downloadCoverLetterPdf`).  
- **Zod** validation for inbound search params / context.  
- **Funnel** analytics `trackFunnelEvent`.

### 9.2 Typical API sequence (fresh analyze)

1. User submits JD → **`api.jobs.analyze`** (POST).  
2. UI shows **`JobAnalysisCard`** with score + gaps.  
3. Optional: **`api.jobs.generate`** → then fetch **`api.jobs.generated/:jobId`**.  
4. Optional tailor: **`api.cv`** tailor-draft create/accept routes (see `api.ts` method names in your codebase).

---

## 10. Feature: CV Clinic (`/dashboard/cv`)

### 10.1 Route shell

**`dashboard/cv/page.tsx`** is a **client** page that composes:

- **`CvClinicHub`** when in “hub” mode (tiles: open analyzer, board, history, new CV).  
- **`CVBuilder`** triple-column layout when editing.  
- **`CVScoreCard`**, **`ImprovementsPanel`**, **`CvClinicTripleRightPanel`**, **`AISectionAssistantPanel`**, **`AIChatDrawer`**, **`CvClinicToolbar`**, upload/create modals, etc.

**Size warning:** This `page.tsx` is **thousands of lines** — same class of maintainability risk as `JobsAnalyzeContent.tsx`.

### 10.2 Representative hooks

| Hook | Role |
|------|------|
| `useCVProfile` / `useCVProfileById` | Load single profile + sections meta. |
| `useCVProfiles` | Shelf list. |
| `useCVScore` / `useRunCvDetailedScore` | Score endpoints; optional job context. |
| `useCVAutosave` | Debounced saves (tested in `useCVAutosave.test.tsx`). |
| `useExportCV` | Export pipeline. |

### 10.3 Client-side scoring mirror

**`lib/atsSimulation.ts`** (+ tests) mirrors backend ATS heuristics for **instant** UI feedback. **Risk:** logic drift vs Nest `ats-simulation.ts` — treat as “best effort preview” unless you add contract tests comparing sample payloads.

---

## 11. Tests and quality gates

- **Unit / component tests:** `npm run test` (Vitest). **35+** test files under `src/` covering CV apply flows, today plan wiring, axios error parsing, auth store, dashboard label helpers, etc.  
- **E2E:** `npm run test:e2e` (Playwright) — ensure CI runs against a disposable env with backend + DB when you want release confidence.

---

## 12. Performance notes (frontend-specific)

- **Job board:** Debounce + reuse + long `staleTime` on match query reduce network + AI cost.  
- **React Query:** Prefer explicit **`invalidateQueries`** after mutations (already done in Hub) over short `staleTime` everywhere.  
- **Framer Motion:** Used in board/hub — if profiling shows jank, reduce nested `motion.div` on long lists or use `layout` props sparingly.

---

## 13. Accessibility (what we can cite from code)

- **`CvClinicHub`**: `role="group"`, `aria-label="View mode"`, `aria-pressed` on toggle buttons.  
- **Full product a11y:** not proven from code alone — schedule **axe-core** in CI + manual keyboard pass on Job Hub DnD (`@dnd-kit`).

---

## 14. Security (frontend)

- **Tokens:** memory + cookie fallback pattern in axios interceptor.  
- **401 handling:** avoids clearing session on failed login attempt URLs (`isLoginOrRegisterAttemptUrl` in `axios.ts`).  
- **Request IDs:** on CV mutations for traceability.

---

## 15. Maintainability backlog (concrete)

1. Split **`lib/api.ts`** into `lib/api/jobs.ts`, `lib/api/cv.ts`, `lib/api/dashboard.ts`, re-export `api` object from `lib/api/index.ts`.  
2. Extract **`useJobBoardState`** from `JobBoardContent.tsx` (filters + pagination + location bootstrap).  
3. Extract **`useJobAnalyzeFlow`** from `JobsAnalyzeContent.tsx` (form + analysis + generate + tailor session).  
4. Split **`dashboard/cv/page.tsx`** into route + `CvClinicPageShell.tsx` + smaller hooks.  
5. Playwright smoke: **board → detail → match bar visible OR quota message**.

---

## 16. Cross-reference

- Backend step-by-step for the same features: **`apply-mate-backend/docs/LAYMAN_PRODUCT_TECH_AUDIT.md`** (sibling repo).

---

*End of frontend audit.*
