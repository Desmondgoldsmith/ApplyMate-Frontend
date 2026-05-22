# ApplyMate Job Flow Audit

**Scope:** `packages/web` — Job Board (`/dashboard/job-board`) and Job Hub (`/dashboard/jobs` + merged pipeline).  
**Method:** Code-path review, navigation config, hooks touching AI and discovery, and product judgment vs. Teal / Kickresume / JobSuit-class tools.

---

## 1. Overview

ApplyMate splits **discovery** (Job Board) from **pipeline** (Job Hub) plus **deep work** (Analyze / tailor under `/dashboard/jobs/analyze`). That separation is strategically sound: users can browse without committing, then graduate wins into a tracker.

**Strengths observed in code**

- Job Board defers default search semantics to the backend (`cvProfileId` + `location`, optional keyword `q` only on explicit Search) — aligns with scalable JSearch-style queries.
- Job Board AI match (`useJobBoardAiMatch`) debounces list skim, reuses `GET` analyses, separates **over-quota reuse** from **heuristic `match-score`**, and avoids surfacing cached match-score when the user regains quota.
- Job Hub merges **applications**, **job history**, and **hub bookmarks**; **pipeline stage** is read from the **API** when present (`hubPipelineStage` on bookmarks, `status` on job analysis, application status when an application row exists). **`localStorage` overrides** in `jobHubMerge.ts` are a **fallback** only for rows with no server stage target (not the primary source of truth).

**Structural risks**

- **Cognitive split:** Sidebar exposes both **Job Hub** (`/dashboard/jobs`) and **Job Board** (`/dashboard/job-board`); “Jobs” in mobile short label vs “Board” adds vocabulary overhead.
- **Analyze lives under `/dashboard/jobs/analyze`** while the hub list is `/dashboard/jobs` — active nav stays on “Job Hub” (nested route rule), but first-time users may not map “Job Hub” = tracker + “Analyze Job” entry, not “the board.”
- **Large surface files:** `JobsContent.tsx` / `JobsAnalyzeContent.tsx` / `JobHubDetailPanel.tsx` are multi-thousand-line orchestrators — velocity and bug risk compound.

---

## 2. Job Board Flow Analysis

### 2.1 Step-by-step journey (as implemented)

| Step | User action | System behavior |
|------|-------------|-----------------|
| 1 | Lands `/dashboard/job-board` | `JobBoardContent`: loads CV profiles (`useCVProfiles`), user `me` for default city, bootstraps location once. |
| 2 | Sees collapsed “Search & Filters · {city} · {CV name}” | Quick context; expand for full filters. |
| 3 | Selects CV in filter | `cvProfileId` in discovery params changes → new `GET /job-discovery` (no auto `q`; backend builds role query). |
| 4 | Sets location / mode / date / remote-first | Immediate filters patch `appliedFilters`; discovery refetches. |
| 5 | Types keywords / city and clicks **Search** | Applies `q` + location (explicit override path); no per-keystroke discover. |
| 6 | Scrolls list, clicks a card | `activeJobId` set; desktop shows `JobDetailPanel` beside list; mobile opens sheet. |
| 7 | Reads detail + match UI | `GET /job-discovery/:id`; `useJobBoardAiMatch` debounces then: reuse analyses → else `POST /jobs/analyze` if quota + JD length; over quota: GET reuse only then optional `POST /jobs/match-score`. |
| 8 | Save / Tailor / View original / Share | Bookmark mutation; router to `/dashboard/jobs/analyze?jobId=…` or `?new=1` with prefill; external link; share helper. |
| 9 | Pagination | Page param only; placeholder data allowed when other discovery dimensions unchanged. |

### 2.2 Friction points (brutally honest)

1. **Time-to-first “aha”** depends on backend discovery quality — the UI cannot compensate if results are empty or irrelevant; users still blame the product.
2. **“Search” is mandatory to apply text** — correct for cost, but **easy to miss** for first-timers who expect live filtering; collapsed header helps context but not “click Search.”
3. **Match score latency:** debounce (~480ms) + network + possible analyze = **not instant gratification**; power users may skim faster than the debounce, feeling “lag.”
4. **Two mental models for “jobs”:** Job Board vs Job Hub naming; Teal-style products often unify “Discover” and “Pipeline” with one narrative.
5. **Extension CTA** is toast-only (“coming soon”) — **breaks trust** on the critical “apply faster” promise vs competitors shipping extensions or autofill.

### 2.3 Addictiveness

| Mechanism | Present? | Notes |
|-----------|----------|--------|
| Variable reward (good listings) | Partial | Depends on provider + CV fit; UI shows fallback banners. |
| Progress / streak | Weak | Daily AI cap in header — **punitive** more than **gameful**; no streak, no “3 applications this week.” |
| Instant feedback | Partial | List refetch overlay + gauge; analyze is not instant. |
| Reason to return daily | Weak | No digest email / “new jobs since yesterday” surface in this flow (may exist elsewhere). |

### 2.4 Problem-solving power

- **Does help get hired faster** when: discovery is accurate, user tailors CV, and hub tracks follow-ups — **the chain is there**.
- **Risks “feels helpful”** when: users treat board match % as truth without tailoring, or hit quota and see heuristic fit — must keep copy honest (you largely do).

### 2.5 Flow improvements (actionable)

1. **First-run 10-second ribbon:** “Default list uses your CV + city — use Search only for company/title keywords.” (You have hint under reset; mirror a one-time dismissible callout at top of board.)
2. **Keyboard:** Cmd/Ctrl+Enter in filter inputs to Search (reduces mouse friction).
3. **Empty state CTA:** Primary button “Open Job Hub” + secondary “Adjust CV headline” linking to CV profiles — ties board to outcomes.
4. **Saved signal on cards:** If bookmarked, persistent badge without opening detail (if API provides flag on list items).

---

## 3. Job Hub Flow Analysis

### 3.1 Step-by-step journey

| Step | User action | System behavior |
|------|-------------|-----------------|
| 1 | `/dashboard/jobs` | `JobHub` loads `useApplications`, `useJobHistory`, `useHubBookmarks`; merges via `mergeTrackedJobs` + `loadStageOverrides()`. |
| 2 | Sees empty or populated hub | Empty `GlowCard` → board CTA to analyze or implied board bookmark path. |
| 3 | Search / pipeline filter / view toggle | Client-side filter on merged list; `HubPipelineStrip` for stage counts; board vs table. |
| 4 | Opens a job (card/row) | URL `?jobId=` / `?applicationId=` / `?jobKey=`; sidebar + `JobHubDetailPanel` (sheet mobile / stacked desktop). |
| 5 | Changes stage | **Server-persisted** when the row can be targeted: `PATCH` **application** status if `applicationId` exists; else `PATCH` **bookmark** `hubPipelineStage` if a hub bookmark row exists; else `PATCH` **JobAnalysis** status for a saved analysis. `localStorage` / `saveStageOverride` only for edge rows with no id to PATCH. See §10. |
| 6 | Notes / emails / tailor links | `JobHubDetailPanel` — includes generate email template (`api.jobs.generateEmailTemplate`), links to analyze route. |
| 7 | Reminders | **Hub CRM reminders** (`GET/POST/PATCH/DELETE /api/jobs/hub-reminders`) when the row has `jobAnalysisId` or `hubBookmarkId`; **device-local** reminders remain for rows without those ids (`notifyDueLocalReminders`). See §10. |
| 8 | Unbookmark discovery item | `removeBookmark` + cache invalidation. |

### 3.2 Friction points

1. **Merge complexity:** One `TrackedJob` from four sources — edge cases (duplicate keys, missing `jobAnalysisId`, stage overrides out of sync with server status) are **support magnets**.
2. **Stage truth:** Residual **local-only** rows (no PATCH target) can still diverge until every hub row maps to bookmark/analysis/application — **mitigation:** expand linkage coverage + UI cue “Local only” for those keys (see §10 for API-backed paths).
3. **Hub without detail URL:** Full hub UI (filters, board) hidden when `detailRequested && selectedJob` — deep-linking to a job **replaces** the overview layout; some users expect split view always on desktop.
4. **“Analyze Job”** duplicates entry points with Job Board tailors — fine, but **onboarding** should explain when to use which.
5. **Job Hub vs Applications tab** inside older `JobsContent` (Analyze | Applications) — if still linked from anywhere, **duplicate mental models** for “saved.”

### 3.3 Addictiveness

- **Local reminders + pipeline strip** = strongest in-flow loop in this audit — **actually brings users back**.
- Missing: **win/loss analytics**, interview calendar sync, or “nudges” based on stalled stages (e.g. “Applied 14 days ago — follow up?”).

### 3.4 Problem-solving power

- **High** for organized job seekers who already bookmark/analyze — rivals spreadsheet + Teal board **if** email/notes are used.
- **Medium** for passive users — hub empty until they engage with board or analyzer.

### 3.5 Flow improvements

1. **Stage override badge:** “Synced” vs “Local only” when `applicationId` missing.
2. **Bulk actions:** Select multiple → set stage / export CSV — enterprise wedge vs Teal.
3. **Deep link preserves context:** Desktop `?jobId=` opens detail **and** keeps kanban visible (split) rather than only sidebar+detail.
4. **One-line onboarding** above pipeline: “Stages update the tracker; with a linked application we also sync status to your profile.”

---

## 4. UX / UI Recommendations

### Navigation & information architecture

- **Rename or group:** Consider primary nav **“Jobs”** with children **Discover** (board) and **Pipeline** (hub) in a flyout — reduces parallel top-level concepts.
- **Breadcrumbs** on analyze page: `Job Hub › Acme Corp › Tailor` — restores orientation.

### First-time user (zero confusion)

1. **Single checklist modal** post-signup: (1) Set home city (2) Pick default CV (3) Open Job Board — store completion in user flags.
2. **Job Board:** First visit tooltip on **Search** button specifically.
3. **Job Hub:** Short Loom-style inline help (30s) on stage strip — what each column means for *their* job search.

### Speed of action (<30s to value)

- **One-click “Tailor from board”** already routes with analysis id when present — excellent; ensure **prefill** path when no analysis is equally fast (minimal fields, skip intros).
- **Job Hub:** Quick-add “Paste job URL” → background fetch description (backend permitting) — beats manual paste in analyzer.

### Clearer CTAs

- Replace generic **“Apply with extension”** toast with **disabled + “Join waitlist”** or hide until real — **unfinished CTAs hurt conversion**.
- **Save job** vs **Bookmark** language: align with hub copy (“Saved roles”) everywhere.

---

## 5. Product Improvements

### MUST HAVE

| Item | Rationale |
|------|-----------|
| **Ship autofill extension or remove CTA** | Competitors win on “one click apply”; placeholder erodes PMF story. |
| **Unified “my next 3 actions” widget** on dashboard | Board + Hub + overdue reminders in one glance — daily return driver. |
| **Server-persisted hub stages + reminders** | **Shipped (API + web wired):** bookmarks/analysis/application pipeline + hub reminders; Today’s Plan invalidated on mutation. Further polish: badges (“Synced”), stalled-job nudges, digest surfacing. |
| **Server-side batch or cached match scores for list cards** (optional `matchScore` on discovery list from backend) | Reduces repeated client work; Teal-like immediacy on scroll. |
| **Explicit rejection / archived stage** | Users fear losing jobs; “Closed” stage improves trust vs deleting. |

### HIGH IMPACT

| Item | Rationale |
|------|-----------|
| **Email digest: “N new jobs for {role} in {city}”** | Habit loop without opening app. |
| **Interview prep hook** from stage `interviewing` → existing Interviews feature | Cross-sell + differentiated workflow. |
| **CV version diff** after tailor | “Before/after” is shareable and emotionally rewarding. |
| **Employer response tracking** (ghosted / replied) with one tap | Simple CRM beats spreadsheet. |
| **Referral: “Compare your CV to this job posting” share link** | Viral B2C loop (see Growth). |

### OPTIONAL

| Item | Notes |
|------|--------|
| Salary transparency overlay | Regulatory + data heavy. |
| Team / agency mode | Multi-seat — later. |
| Chrome new-tab dashboard | Habit stacking for power users. |

---

## 6. Growth & Viral Strategy

### Current state (from code)

- **Share** on job detail (link / native share) — **weak viral loop** (private utility, not identity).
- **No referral codes** or invite flows observed in audited paths.
- **CV Clinic / profiles** exist — potential loop if “CV score” becomes shareable image.

### Suggested loops

1. **Shareable fit card:** PNG/Web image: “I’m a 87% match for {role} at {company} — scored with ApplyMate” — **HIGH** virality if tasteful and truthful (use AI score only when real analysis).
2. **Referral credit:** Extra AI runs for invitee’s first analyze — aligns with marginal cost controls if capped.
3. **Public job board clip** (read-only): “Trending roles this week for React in London” — SEO + top-of-funnel (OPTIONAL, compliance heavy).

---

## 7. AI Cost Optimization

### Current patterns (good)

- Job Board: **debounced** analyze; **GET reuse** before POST; **inflight dedupe** for analyze; **match-score only** after quota + no saved analysis + JD length floor.
- Job Board: **no `q`** on default discover — fewer mismatched round-trips.
- React Query **staleTime** on discovery and analyses — reduces refetch churn.

### Recommendations

| Tactic | Detail |
|--------|--------|
| **Server batch match-score** | One POST with array of `{listingId, descriptionHash}` → amortize network + cold starts (backend ticket). |
| **Raise cache tier for `GET /jobs/analyses?jobListingId=`** | Same listing revisited in-session should be `staleTime` ≥ session length when CV unchanged. |
| **Conditional prefetch** | On list hover (200ms dwell), prefetch discovery detail JSON only — **not** analyze — improves perceived speed without AI cost. |
| **Model tiering** | Short JD summaries via small model; full rubric on demand — **requires backend** contract. |
| **Prompt compression** | Send structured bullets to analyze instead of raw HTML if backend supports extraction — token savings at same quality. |
| **Client guardrails** | Already have quota + reuse; add **max concurrent analyze = 1** globally across tabs (BroadcastChannel) to stop double spend. |

**Goal alignment:** Above cuts cost **without** lowering perceived quality if reuse and prefetch hit rates rise.

---

## 8. Code Quality Audit

### A. Code smells

- **Duplication:** `JobsContent.tsx` vs `JobsAnalyzeContent.tsx` share large patterns (history row selection, analyze guards) — consolidate hooks (`useJobAnalyzeFlow`).
- **Naming:** `JobHub` lives in `jobs/page.tsx` while route is “Job Hub” — file/route naming ok but **domain language** should match exports/docs.
- **Large components:** `JobHubDetailPanel.tsx`, `JobsContent.tsx` — split by concern: data hooks / presentation / mutations.

### B. Performance

- **Job Hub:** `mergeTrackedJobs` on every apps/history/bookmarks change — acceptable at small N; **memoize keyed** or virtualize sidebar when N > 100.
- **Job Board:** Discovery query key is full params object — fine; watch **serialization** if optional fields fluctuate.
- **Intervals:** Job Hub `setInterval` 8s for reminders — light; ensure cleared (it is on unmount).

### C. Security (quick pass)

- **No secrets in audited client paths** for these flows.
- **XSS:** Job descriptions in panels should keep sanitization (verify DOMPurify or equivalent on rich HTML if added).
- **Auth:** Queries keyed with `accessToken` scope (`me`) — good pattern; ensure discovery endpoints always send Bearer.
- **Validation:** Client trusts API for job IDs — ensure server validates UUIDs / ownership (backend).

### D. Maintainability

- **Extract:** `fetchJobBoardReuseOnlyMatch` style extraction for Job Hub merge steps → unit-testable pure functions.
- **Feature flags:** Extension, digest, batch score — gate in config for staged rollout.

---

## 9. Final Verdict

### Can these features compete with top platforms?

**Yes, on the “CV-aware pipeline + discovery” axis** — the architecture (board → analyze → hub + reminders) is coherent and **more technical-job-seeker oriented** than Kickresume’s resume-only story. Versus **Teal**, you match on tracker + stages but need **extension + digest + polish** to feel “effortless.” Versus **JobSuit-style AI**, you compete when **reuse + quota discipline** keeps scores trustworthy and costs sustainable.

### What is missing for “market-winning”?

1. **Proof of speed:** real application automation (extension or partner autofill), not a toast.  
2. **Habit:** proactive “jobs for you” loop outside the session (email/push).  
3. **Clarity:** one narrative that connects Board → Hub → Analyze without thinking about URLs.

### The ONE thing that could make users obsessed?

**A daily “priority stack” that combines: (a) new high-fit listings, (b) stalled pipeline items with one-tap next action, (c) one free “AI push” — all above the fold in <10 seconds.**  
Obsession comes from **closing the loop every day**, not from another static list.

---

## 10. Persisted pipeline stages & hub reminders — **implementation status**

**Goal (unchanged):** Job Hub is a **cross-device tracker**. “Where this job is” and CRM-style follow-ups must survive refresh, reinstall, and multiple devices.

### 10.1 Pipeline stages — **wired**

| Case | Source of truth | Client mutation |
|------|------------------|-----------------|
| Row has **application** | `Application.status` | `PATCH /api/applications/:id/status` |
| **Bookmark-only** (no application) | `hubPipelineStage` on bookmark (`saved` \| `applied` \| `interviewing` \| `offered` \| `rejected`) | `PATCH /api/job-discovery/bookmarks/:bookmarkId` with `hubPipelineStage` |
| **Saved analysis**, no application on that merge key | `JobAnalysis.status` (same enum conceptually) | `PATCH /api/jobs/:jobId/status` with `{ status }` |

- **Reads:** `GET /api/job-discovery/bookmarks` includes `hubPipelineStage`; `GET /api/jobs/history` can expose analysis pipeline via row `status` → merged as `pipelineStatus`; applications continue to drive canonical stage when linked.
- **Client merge:** `jobHubMerge.ts` prefers **API** values when present; **`saveStageOverride` / `localStorage`** remain only as a **shim** for rows that cannot be PATCHed yet.
- **Today’s Plan:** client **invalidates** today-plan queries after stage mutations so dashboard stays aligned with the server cache invalidation story.
- **Conflict policy:** **last-write-wins** until versioning exists (product/backend).

### 10.2 Hub CRM reminders — **wired**

Not the same resource as **application email reminders** (`POST …/applications/:id/reminders`).

| Action | Route |
|--------|--------|
| List | `GET /api/jobs/hub-reminders` (optional filters: `status`, `dueBefore`, `jobBookmarkId`, `jobAnalysisId`) |
| Create | `POST /api/jobs/hub-reminders` — exactly one of `jobBookmarkId` \| `jobAnalysisId`, required `remindAt`, optional `title`, `note` |
| Update | `PATCH /api/jobs/hub-reminders/:reminderId` |
| Delete | `DELETE /api/jobs/hub-reminders/:reminderId` |

- **`GET /api/jobs/:jobId`** includes **`hubReminders`** (pending, analysis-scoped) for the detail panel.
- **Job Hub UI:** when `jobAnalysisId` or `hubBookmarkId` exists, `JobHubDetailPanel` uses the **hub reminders** API; otherwise **device-local** reminders + optional legacy “sync to account” path still apply.

### 10.3 Residual product gaps

- Surface **due hub reminders** on dashboard / Today’s Plan explicitly (beyond invalidation).
- **Snooze** UX if backend adds it (today: `pending` \| `completed` \| `dismissed`).
- Optional **browser notifications** for due hub reminders (local notifications remain for device-only rows).

---

## 11. Highest-impact features (smart + genuinely helpful)

Prioritized for **job seekers**: clarity, speed, and habit — not feature count.

1. **Daily priority stack** — Above the fold in seconds: new strong-fit listings, stalled pipeline rows with one obvious next step, and due follow-ups (ties Board + Hub + reminders into one narrative).
2. **Real apply acceleration** — Browser extension or partner autofill that matches the product promise; placeholder CTAs hurt trust until this ships.
3. **Email / push habit loop** — “N new roles for you” + “follow-ups due today” so users return without remembering to open the app.
4. **Unified dashboard widget** — One glance: board + hub + reminders + Today’s Plan CTAs with correct routing (`OPEN_*` actions).
5. **Honest, fast fit feedback** — Server or batch match scores on discovery cards where affordable; clear distinction between full analyze vs heuristic score (you already bias toward reuse + quota discipline).
6. **Lightweight CRM signals** — One-tap employer outcome (ghosted / replied), optional rejection/archive stage clarity (psychological safety vs deleting rows).
7. **Interview prep bridge** — From `interviewing` stage into existing interview prep flows (differentiated workflow vs generic trackers).
8. **Shareable proof of progress** — Tailor before/after or tasteful “match card” sharing — emotional payoff + weak viral loop.

---

*Document generated from repository review (web package). Revisit after major backend contracts change (discovery shape, analyze batching, extension launch); **hub stage + hub reminder APIs are reflected in §10**.*
