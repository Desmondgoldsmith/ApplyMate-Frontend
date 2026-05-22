# Frontend spec — Follow-up v2: honest pipeline copy, primary card, queue, job-board CTAs

**Title:** Integrate Follow-up v2: honest pipeline copy, primary card + “View all” queue, job-board CTAs

## Context

The dashboard **today-plan** API now separates **orchestration position** from **truth on the application row**. The backend emits **`followUpIntelligence.coachingStage`**. The UI must **never** say the user **“applied”** unless **`coachingStage === 'submitted'`**.

This doc is the handoff for frontend implementation and QA. Backend payload details align with `docs/backend-follow-up-intelligence-payload.md` where they overlap.

---

## Data model (`GET /dashboard/today-plan` JSON)

### `followUpIntelligence` (optional)

Single **“best”** follow-up row — same product purpose as today’s hero follow-up slot.

| Field | Use |
|-------|-----|
| **`coachingStage`** | **Source of truth** for all user-facing “applied / pipeline” wording. See [Copy rules](#copy-rules). |
| **`companyName`**, **`jobTitle`** | **Prefer** these over parsing `headline` / `supporting`. |
| **`ctaHref`**, **`ctaLabel`** | Primary action. Expected to target **`/dashboard/job-board?…`** with resolver-validated **`jobAnalysisId`** and/or **`applicationId`** (and other ids as applicable). |
| Existing fields | `headline`, `supporting`, `confidence`, `daysSinceApplication`, `reason`, etc. — unchanged semantics unless superseded below. |

**Types / parsing:** extend `FollowUpIntelligencePayload` and `pickFollowUpIntelligence` in `packages/web/src/lib/today-plan.ts` to include `coachingStage` (and confirm `companyName` / `jobTitle` pickers match backend keys, including snake_case aliases if any).

### `followUpJobs` (optional array, max 50)

Full follow-up **queue** for the “View all” experience.

### `followUpJobsTotalCount` (optional number)

Count **before** the cap — use for **“View all (N)”** (or equivalent). When **`totalCount > followUpJobs.length`**, indicate truncation (e.g. **“Showing 50 of 72”**) or plan lazy-load — **product decision**.

### Each `followUpJobs[]` item

Include at minimum what the API guarantees; the UI should deep-link using **whichever id is non-null**:

- `id`
- **`source`**: `application` \| `bookmark` \| `analysis`
- **`coachingStage`** (same semantics as primary row)
- `headline`, `supporting`, `ctaLabel`, `ctaHref`, `confidence`, `daysSinceApplication`, `reason`
- Optional: **`applicationId`**, **`jobAnalysisId`**, **`jobListingId`**, **`bookmarkId`**

**Types / parsing:** add `FollowUpJobRowPayload` (name TBD) + `pickFollowUpJobs` on `TodayPlanPayload` in `today-plan.ts`; wire into dashboard data hooks.

---

## UI spec

### Primary card

- Render **one** card from **`followUpIntelligence`** when present — same slot as today’s priority follow-up / hero follow-up (see `DashboardPriorityIntelligenceZone`, `DashboardFollowUpIntelligenceCard`, `DashboardCommandBar`).
- Card copy and CTA must respect **`coachingStage`** (not only the command bar).

### “View all”

- When **`followUpJobsTotalCount > 1`** **or** **`followUpJobs.length > 1`**, show a **View all** affordance.
- Opening it should show a **list** (modal, drawer, or dedicated page — **product call**) populated from **`followUpJobs`**.
- If **`followUpJobsTotalCount > followUpJobs.length`**, show that the list is **truncated** (copy above) unless lazy-load is implemented.

### Dedup with Focus / layout

- When layout dedup **clears** `followUpIntelligence` because Focus already shows follow-up, **mirror today’s behavior**: do **not** duplicate coaching.
- If the API sends **`followUpIntelligence` empty** but **`followUpJobs`** populated, only surface queue UX if product + API contract allow that combination; otherwise hide queue or show empty state per existing dedupe rules (`dashboardFocusMerge`, `dashboardPrimaryDedupeHrefs`, phase-14 layout).

---

## Copy rules {#copy-rules}

| `coachingStage` | Allowed language |
|-----------------|-------------------|
| **`submitted`** | You may say they **applied** *N* days ago (e.g. “since you last applied to …”). |
| **Any other stage** (especially **`pre_application`**) | Use **neutral pipeline** language: finish, move forward, revisit, nudge — **do not** say **“applied”** unless `coachingStage === 'submitted'`. |

**Assembly:**

- Any **client-assembled** copy (e.g. `directiveFromFollowUpIntelligence` in `packages/web/src/lib/dashboardCommandCopy.ts`) must branch on **`coachingStage`** before using “applied” / “last applied”.
- Prefer **`companyName`** / **`jobTitle`**; use **`headline` / `supporting`** only as **last resort** when structured fields are missing.

### Command bar

- When consuming **`commandBar`** from the API, **`message`** is already **stage-aware** — prefer it for display **or** align custom assembly with the same rules.
- Any **custom** copy next to the command bar CTA must still consult **`followUpIntelligence.coachingStage`** when that payload is the source of truth (`DashboardCommandBar` rebuild path for `follow_up_intelligence`).

---

## Navigation

- Every row’s **`ctaHref`** should open the job board with the given **query string** so the board can **focus** that job.
- **Implement or extend** parsing on **`/dashboard/job-board`** for:
  - `jobAnalysisId`
  - `applicationId`
  - `bookmarkId`
  - `jobListingId`

**Current frontend note (audit):** `JobBoardContent.tsx` already reads **`jobListingId`** and **`focusToken`** from the URL. **`jobAnalysisId`**, **`applicationId`**, and **`bookmarkId`** may still need resolver-backed selection / scroll-to-row behavior — confirm with job-board owners and add tests.

---

## Edge cases

- **Missing `companyName` / `jobTitle`:** omit in templated copy; fall back per product (headline/supporting last resort); never invent placeholders.
- **`followUpIntelligence` cleared, queue only:** respect API + dedupe contract; avoid duplicate follow-up coaching vs Focus.
- **Truncation:** communicate cap vs `followUpJobsTotalCount` clearly.

---

## Implementation checklist (repo map)

| Area | Files / notes |
|------|----------------|
| Types + pickers | `packages/web/src/lib/today-plan.ts` — `FollowUpIntelligencePayload`, `pickFollowUpIntelligence`; add `coachingStage`, `followUpJobs`, `followUpJobsTotalCount`, row type. |
| Command bar + copy | `DashboardCommandBar.tsx`, `dashboardCommandCopy.ts` — stage-aware strings; align with `commandBar.message` when from API. |
| Primary follow-up card | `DashboardFollowUpIntelligenceCard.tsx`, `DashboardPriorityIntelligenceZone.tsx` |
| Dedup / section visibility | `dashboardFocusMerge.ts`, `dashboardPhase14Layout.ts`, `dashboard/page.tsx` (dedupe href sets) |
| Job board deep links | `packages/web/src/app/(dashboard)/dashboard/job-board/JobBoardContent.tsx` (+ any resolver API) |
| Queue UI | **New** component(s) + route/modal entry — not present at time of this doc. |
| Analytics | Reuse / extend `trackProductEvent` / funnel events for “view all” and row clicks. |

---

## QA scenarios

1. **`coachingStage: 'submitted'`** + company + title → copy may include “applied”; deep link opens board with correct focus.
2. **`coachingStage: 'pre_application'`** (or non-submitted) → **no** “applied” in assembled copy; neutral pipeline wording only.
3. **`followUpJobsTotalCount: 72`**, `followUpJobs.length === 50` → “View all (72)” + “Showing 50 of 72” (or lazy-load path).
4. Dedup: Focus already shows follow-up → primary strip hidden; no duplicate CTA for same `canonicalDashboardHref`.
5. Row with only `jobAnalysisId` in query → board resolves and highlights the right row.

---

## Related docs

- `docs/backend-follow-up-intelligence-payload.md` — backend fields for company/title and forbidden placeholders.
- `docs/backend-human-copy-dashboard-prompt.md` — general dashboard human-copy hygiene.
