# Backend handoff — Job Hub guidance + kanban pipeline (Teal-inspired)

**Date:** 2026-06-10  
**Frontend status:** ✅ Integrated (2026-06-10)  
**Backend status:** ✅ Done (2026-06-10)  
**Related:** [Dashboard UX overhaul](./BACKEND_HANDOFF_DASHBOARD_UX_OVERHAUL.md) (stale notices, follow-up deep links)

---

## Summary for backend team

Job Hub detail (`/dashboard/jobs?…`) needs two TealHQ-inspired surfaces on **every tracked job**:

| # | Feature | Goal |
|---|---------|------|
| 1 | **Kanban pipeline stepper** | Chevron-style progress bar showing where this job sits in the pipeline (past = done, current = active, future = upcoming). Click to advance/correct stage. |
| 2 | **Phase guidance checklist** | Collapsible coach panel with **stage-specific tasks**, auto-completion from real user data, progress %, and deep-link CTAs. **Collapsed by default** on the frontend — backend must supply rich payload so expanded state is immediately useful. |

**Do not** push checklist logic or phase copy selection to the frontend. The client will render and persist UI state (collapse, selected task); **eligibility, completion, ordering, and coaching copy** belong on the server.

---

## Problem today (frontend)

`JobHubDetailPanel` renders:

- A row of **small pill buttons** for all `HubStage` values (`bookmarked` → `rejected`) — hard to scan, not a linear journey.
- A static **“Apply assist”** box (`applicationAssist`) only during early apply prep — no guidance for Applied / Interviewing / Negotiating / Accepted.
- `staleApplicationNotice` on `GET /applications/:id` — good banner, but not integrated into a phase checklist.

We already have chevron CSS (`.pipeline-chevron` in `globals.css`) used on the **list filter strip** (`HubPipelineStrip`). The **detail panel** needs a **per-job stepper**, not counts.

---

## Reference UX (TealHQ — concepts to steal, not copy)

Teal shows, per job:

1. **Header** — title, company, saved metadata.
2. **Chevron pipeline** — Bookmarked → Applying → Applied → Interviewing → Negotiating → Accepted. Past stages filled, current highlighted, future outlined.
3. **Guidance** — `Guidance > {Phase} Steps: {n}% Complete`, lightbulb, collapsible. Left column = checklist; right column = tips for selected task. Applied phase includes **dated follow-up reminders** (1st / 2nd / 3rd follow-up, archive after 3 weeks).
4. **Tabs** below — Job info, Notes, Resumes, Email templates, etc.

**ApplyMate should be more helpful:** tie tasks to real signals (analysis done, CV tailored, cover letter, `appliedAt`, interview scheduled, email draft sent, stale/quiet rules) and deep-link into existing surfaces (Analyzer, CV Clinic, Email templates tab, Interview prep).

---

## Pipeline stages — canonical mapping

### Server enum today (`HubPipelineStage`)

`saved` | `applied` | `interviewing` | `offered` | `negotiating` | `accepted` | `rejected`

### Frontend UI columns today (`HubStage`)

`bookmarked` | `analyzed` | `applied` | `interviewing` | `offered` | `negotiating` | `accepted` | `rejected`

Mapping already exists in frontend (`hubPipelineStageToHubStage` / `hubStageToHubPipelineStage`). **Backend should emit stepper steps using the same canonical ids** the PATCH endpoints accept.

### Recommended stepper for detail kanban (happy path)

Show a **linear happy path** in the stepper (reject/withdraw as terminal actions outside the chevron, e.g. row menu — same as today):

| Order | Step `id` | Label (suggested) | Server stage anchor |
|------:|-----------|-------------------|---------------------|
| 1 | `bookmarked` | Saved | `saved`, no analysis |
| 2 | `preparing` | Preparing to apply | `saved` + has analysis / tailoring in progress |
| 3 | `applied` | Applied | `applied` |
| 4 | `interviewing` | Interviewing | `interviewing` |
| 5 | `negotiating` | Negotiating | `negotiating` or `offered` |
| 6 | `accepted` | Accepted | `accepted` |

**Notes:**

- Collapse `bookmarked` + `analyzed`/tailoring into **Preparing** for the chevron if that reads cleaner — but return `currentStepId` explicitly; do not make the frontend infer from multiple flags.
- `offered` can map to **Negotiating** chevron segment (Teal merges offer evaluation into negotiate) or a distinct segment — pick one and document it.
- `rejected` / archived: stepper shows terminal state (all segments muted + “Closed” badge) — not a clickable chevron step.

### Stepper item shape

```typescript
type JobHubPipelineStepState = 'complete' | 'current' | 'upcoming' | 'unavailable';

type JobHubPipelineStep = {
  id: string; // stable slug, e.g. 'applied'
  label: string; // "Applied"
  shortLabel?: string; // "Applied" | "Interview" for narrow screens
  state: JobHubPipelineStepState;
  order: number; // 0-based display order
  /** When user clicks this step, PATCH target stage (HubPipelineStage or extended id). */
  targetPipelineStage?: HubPipelineStage | null;
  /** False for steps that cannot be selected yet (future without prerequisites). */
  clickable: boolean;
};

type JobHubPipelineStepperPayload = {
  steps: JobHubPipelineStep[];
  currentStepId: string;
  /** Optional subtitle under stepper, e.g. "Applied 12 days ago". */
  statusHint?: string | null;
};
```

**Interaction rules (backend validates on PATCH):**

- User may move **forward** when prerequisites met (e.g. cannot jump to Interviewing without `appliedAt` unless manual override flag).
- User may move **backward** for corrections (with audit log / `updatedAt`).
- Forward transitions should **not** reset quiet-clock anchors (`appliedAt` unchanged when correcting metadata — see dashboard quiet handoff).

---

## Guidance checklist — required contract

Embed on the same payloads as the stepper (see § APIs). One object per job:

```typescript
type JobHubGuidanceTaskState = 'pending' | 'completed' | 'skipped' | 'blocked';

type JobHubGuidanceTask = {
  id: string; // stable per phase, e.g. 'applied_follow_up_1'
  label: string; // checkbox label
  state: JobHubGuidanceTaskState;
  /** True when derived from data (tailored CV exists, etc.). */
  autoCompleted: boolean;
  /** User toggled complete (optional persistence). */
  userCompleted?: boolean;
  completedAt?: string | null; // ISO
  optional?: boolean;
  /** Short coaching when this row is focused / expanded. */
  supporting?: string | null;
  /** Bullet tips (Teal right column). */
  tips?: string[];
  /** For follow-up rows: pre-formatted schedule copy. */
  scheduledLabel?: string | null; // "Send 1st follow-up on 16 Jun 2026"
  scheduledFor?: string | null; // ISO date used to build label
  /** Primary action — use canonical Job Hub deep links (§ Deep links). */
  ctaLabel?: string | null;
  ctaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
};

type JobHubGuidancePayload = {
  phaseId: string; // aligns with stepper phase, e.g. 'applied'
  phaseLabel: string; // "Applied"
  title: string; // "Guidance"
  headline: string; // "Applied steps"
  percentComplete: number; // 0–100 integer
  tasks: JobHubGuidanceTask[];
  /** Optional one-liner above tasks. */
  summary?: string | null;
  generatedAt: string;
};
```

**Frontend behavior (for your awareness):**

- Renders **collapsed by default** (`<details>` / accordion, `defaultCollapsed` not required).
- Header shows: `Guidance › {phaseLabel} steps · {percentComplete}% complete`.
- Expanded: task list + tips panel for focused task; checkboxes call PATCH when `userCompleted` tasks are supported.

---

## Suggested tasks per phase (starter content)

Backend should own copy; below is the **minimum** set ApplyMate needs. Expand with product voice later.

### Saved / Bookmarked (`phaseId: bookmarked`)

| Task id | Label | Auto-complete when |
|---------|-------|-------------------|
| `review_posting` | Review job description & requirements | User opened description tab or analysis exists |
| `research_company` | Research the company | Optional manual |
| `rate_fit` | Check match score / decide to pursue | `matchScore` present or analysis completed |

CTAs: `tab=description`, `tab=analysis`, external `applyUrl`.

### Preparing to apply (`phaseId: preparing`)

| Task id | Label | Auto-complete when |
|---------|-------|-------------------|
| `run_analysis` | Run job match analysis | `hasAnalysis` / completed analyze |
| `tailor_cv` | Tailor CV for this role | `applicationAssist.hasTailoredCv` |
| `draft_cover_letter` | Draft cover letter | `applicationAssist.hasCoverLetterDraft` |
| `identify_contacts` | Find recruiter or hiring manager | Optional manual |
| `submit_application` | Submit application on company site | User marks complete OR `appliedAt` set |

Reuse / supersede existing `applicationAssist` + `suggestedNextStep` — fold into this structure so frontend can remove the separate “Apply assist” box.

### Applied (`phaseId: applied`)

| Task id | Label | Auto-complete when |
|---------|-------|-------------------|
| `confirm_applied_date` | Confirm application date | `appliedAt` present |
| `follow_up_1` | Send 1st follow-up | Email draft generated/sent OR manual |
| `follow_up_2` | Send 2nd follow-up | Scheduled `appliedAt + 7d` |
| `follow_up_3` | Send 3rd follow-up | Scheduled `appliedAt + 14d` |
| `archive_if_silent` | Archive if no reply after 3 weeks | `staleApplicationNotice.show` OR archived |

**Follow-up schedule:** Compute `scheduledFor` from `appliedAt` (timezone-aware). Emit `scheduledLabel` server-side. Integrate with `staleApplicationNotice` (21-day quiet rule) — task copy should match dashboard coaching (“No word from {Company} in {n} days”).

Primary CTA for follow-ups:

```
/dashboard/jobs?applicationId={id}&tab=email&template=follow-up-no-response
```

### Interviewing (`phaseId: interviewing`)

| Task id | Label | Auto-complete when |
|---------|-------|-------------------|
| `research_prepare` | Research company & interviewers | Optional / manual |
| `practice_interview` | Practice for this role | Interview prep session linked to `jobAnalysisId` |
| `tech_check` | Test audio/video (virtual) | Optional manual |
| `thank_you` | Send thank-you email | Template `thank-you-post-interview` used |
| `follow_up_interview` | Follow up after interview | Manual or scheduled |

CTAs: `/dashboard/interview?jobAnalysisId=…`, email template tab.

### Negotiating / Offer (`phaseId: negotiating`)

| Task id | Label | Auto-complete when |
|---------|-------|-------------------|
| `research_market_rate` | Research market rate | Optional |
| `evaluate_offer` | Evaluate offer details | `offered` stage or offer fields present |
| `negotiate` | Negotiate compensation | Manual |
| `decline_or_accept` | Accept or decline in writing | Templates `accept_offer` / `decline_offer` |

### Accepted (`phaseId: accepted`)

| Task id | Label | Auto-complete when |
|---------|-------|-------------------|
| `confirm_acceptance` | Confirm acceptance sent | Stage `accepted` |
| `share_win` | Share your win (optional) | Optional |
| `verify_placement` | Verify placement (ApplyMate) | Verification status from existing flow |

---

## APIs to extend

### 1. Embed on existing detail payloads (preferred)

Add **`pipelineStepper`** and **`guidance`** to each response the Job Hub detail already hydrates:

| Endpoint | When |
|----------|------|
| `GET /jobs/:jobAnalysisId` | Analysis-backed jobs |
| `GET /applications/:applicationId` | Applied jobs (already has `staleApplicationNotice`) |
| `GET /job-discovery/bookmarks` items or `GET …/bookmarks/:id` | Bookmark-only rows |

```typescript
type JobHubDetailEnrichment = {
  pipelineStepper: JobHubPipelineStepperPayload;
  guidance: JobHubGuidancePayload;
};
```

Frontend merge key: `jobAnalysisId` > `applicationId` > `hubBookmarkId` (same as today-plan deep links).

### 2. Optional dedicated endpoint (if enrichment is heavy)

`GET /job-hub/context?jobAnalysisId=&applicationId=&bookmarkId=&timezone=&locale=`

Returns `{ pipelineStepper, guidance, staleApplicationNotice? }` in one round-trip. Use if building guidance is expensive and should not run on list endpoints.

### 3. Persist user checklist toggles

`PATCH /applications/:id/guidance` or `PATCH /job-hub/guidance`

```json
{
  "taskId": "research_company",
  "userCompleted": true
}
```

Scope tasks per `jobAnalysisId` / `applicationId` / `bookmarkId`. Idempotent. Return updated `guidance` object (or invalidate via standard cache headers).

### 4. Stage changes (existing)

Keep using:

- `PATCH /job-discovery/bookmarks/:id` with `{ hubPipelineStage }`
- `PATCH /jobs/:id` with `{ status }` (pipeline)
- `PATCH /applications/:id/status`

Stepper clicks on the frontend will continue to call these; backend validates `clickable` rules and returns refreshed `pipelineStepper` + `guidance`.

---

## Deep links (canonical — frontend will not guess)

| Intent | `ctaHref` pattern |
|--------|-------------------|
| Email follow-up | `/dashboard/jobs?applicationId={id}&tab=email&template=follow-up-no-response` |
| Thank-you | `…&template=thank-you-post-interview` |
| Salary / offer | `…&template=salary-negotiation` |
| Job description | `/dashboard/jobs?jobId={analysisId}&tab=description` |
| Match & gaps | `…&tab=analysis` |
| Tailor CV | `/dashboard/jobs/analyze?jobId={analysisId}&openTailor=1` |
| Interview prep | `/dashboard/interview?jobAnalysisId={analysisId}` |
| CV Clinic | `/dashboard/cv?profileId={cvProfileId}` |

Alias map lives in `packages/web/src/app/(dashboard)/dashboard/jobs/jobHubEmailTemplates.ts`.

---

## Completion & percent rules

```
percentComplete = round(100 * completedRequired / totalRequired)
```

- Count only tasks where `optional !== true` unless all required are done (then include optional in denominator — product choice; document in response).
- `autoCompleted` tasks count toward % without user action.
- When phase changes, recompute tasks server-side; do not cache stale phase checklist client-side only.

---

## Acceptance criteria

1. **Kanban:** Opening any Job Hub detail shows a chevron stepper with correct past/current/future styling for that job’s stage.
2. **Click stage:** PATCH updates pipeline; stepper + guidance refresh; `appliedAt` preserved on archive/restore (quiet clock handoff).
3. **Guidance:** Checklist matches **current phase**; % complete updates when user tailors CV, applies, sends email, etc.
4. **Applied phase:** Shows 3 scheduled follow-up rows with dates derived from `appliedAt`; stale jobs surface archive task + `staleApplicationNotice` alignment.
5. **Collapse:** Frontend collapsed by default; expanding shows tasks without extra fetch if embedded enrichment is used.
6. **Deep links:** Every task with a CTA opens the correct Job Hub tab / template / analyzer route from table above.
7. **List endpoints:** Unchanged — do **not** add guidance to `GET /jobs/history` list rows (detail only).

---

## Frontend integration (2026-06-10)

| Area | Path |
|------|------|
| Kanban stepper | `packages/web/src/components/job-hub/JobHubPipelineStepper.tsx` |
| Guidance panel | `packages/web/src/components/job-hub/JobHubGuidancePanel.tsx` (collapsed by default) |
| Detail wiring | `packages/web/src/app/(dashboard)/dashboard/jobs/JobHubDetailPanel.tsx` |
| Types / parsers | `packages/web/src/lib/jobHubGuidance.ts` + `api.ts` |
| Task PATCH hook | `packages/web/src/hooks/usePatchJobHubGuidance.ts` |

Removed legacy stage pills and the separate **Apply assist** box when server `guidance` is present. Guidance CTAs open in-panel tabs when the href is a Job Hub deep link.

---

## Return handoff format

When complete, please return:

1. Sample JSON for `pipelineStepper` + `guidance` for **one job in each phase** (bookmarked, preparing, applied, interviewing, negotiating, accepted).
2. Confirmation of which endpoints embed the payload vs dedicated `GET /job-hub/context`.
3. PATCH contract for manual task completion (if supported).
4. Follow-up date math example (`appliedAt` → 1st/2nd/3rd follow-up labels) with timezone param.
5. Note on how `applicationAssist` relates to guidance (deprecated, merged, or both during transition).

---

## Key frontend files (for QA)

| Area | Path |
|------|------|
| Job Hub detail | `packages/web/src/app/(dashboard)/dashboard/jobs/JobHubDetailPanel.tsx` |
| Stage mapping | `packages/web/src/app/(dashboard)/dashboard/jobs/jobHubMerge.ts` |
| List chevron CSS | `packages/web/src/app/globals.css` (`.pipeline-chevron`) |
| Email template deep links | `packages/web/src/app/(dashboard)/dashboard/jobs/jobHubEmailTemplates.ts` |
| Stale notice | `packages/web/src/components/dashboard/StaleApplicationNoticeBanner.tsx` |
