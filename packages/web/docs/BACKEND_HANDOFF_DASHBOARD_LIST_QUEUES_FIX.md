# Backend handoff — Dashboard list pages, follow-up queue, quiet apps after restore

**Date:** 2026-06-09  
**Frontend status:** ✅ Integrated (2026-06-09)  
**Backend status:** ✅ Done (2026-06-09)  
**Related:** [Dashboard UX overhaul](./BACKEND_HANDOFF_DASHBOARD_UX_OVERHAUL.md)

---

## Summary

All three issues are fixed end-to-end. Home snapshot caps stay at **2 items**; list pages call dedicated endpoints and return the **full queue**.

| # | Issue | Fix |
|---|--------|-----|
| 1 | Interview prep “View all” opened interview launcher | `GET /dashboard/interview-prep` + `/dashboard/interview-prep` list page |
| 2 | Follow-up page showed 2 of 15 (today-plan snapshot) | `GET /dashboard/follow-up-jobs` + fixed `followUpJobsTotalCount` |
| 3 | Restored archive missing from quiet queue | Quiet clock anchored to `appliedAt` only (`quietEligibilityAnchorAt`, `quietEligibilityReason`) |

---

## Issue 1 — Interview prep list page

### User expectation

Dashboard **Interview prep** section shows up to 2 rows. **View all** should open a **list of every interview-prep row** (upcoming interviews + interview preparation cards), not the generic Interview Prep launcher (`/dashboard/interview`).

### Frontend (done)

- Route: **`/dashboard/interview-prep`**
- API client: **`GET /api/dashboard/interview-prep`**
- Query params: same as today-plan (`cvProfileId`, `timezone`, `locale`, optional `focusFeedMaxItems` default 100)

### Backend — implement `GET /dashboard/interview-prep`

Lightweight endpoint (do **not** run full today-plan enrichment). Return merged interview activity:

```typescript
type DashboardInterviewPrepResponse = {
  generatedAt: string;
  /** Full list — not home-capped */
  upcomingInterviews: UpcomingInterviewItem[];
  upcomingInterviewCount: number;
  interviewPreparationCards: InterviewPreparationCardPayload[];
  interviewPreparationCardsTotalCount: number;
};
```

| Field | Notes |
|-------|--------|
| `upcomingInterviews` | Same shape as today-plan; include `lastUpdatedAt` + `lastUpdatedLabel` |
| `upcomingInterviewCount` | Total before any client cap |
| `interviewPreparationCards` | Same shape as today-plan |
| `interviewPreparationCardsTotalCount` | Total prep cards |

**Home snapshot** (`GET /dashboard/today-plan`) should continue capping at 2 for both arrays. **List endpoint** returns full ranked lists.

**Acceptance:** User with 6 upcoming interviews sees all 6 on `/dashboard/interview-prep`, while dashboard home still shows 2 + “View all”.

---

## Issue 2 — Follow-up / priority queue shows 15 but list page shows 2

### What the user saw

- Dashboard **Recommended move** or **Priority / follow-up** strip: badge or “View all (15)”.
- `/dashboard/follow-up-jobs` opens but only **2 rows** appear.
- Banner: *“Snapshot shows 2 of 15 queued roles…”*

### What that message meant (bug, not feature)

The follow-up list page was loading **`GET /dashboard/today-plan`**, which only includes a **home snapshot** of `followUpJobs` (max **2** items) while `followUpJobsTotalCount` correctly reports the **full queue size** (e.g. 15).

So the UI honestly reported “2 loaded, 15 total” — but users expect **View all** to load **all 15**, not a truncated snapshot.

This is the same class of bug we fixed for quiet applications with `GET /dashboard/quiet-applications`.

### Frontend (done)

- `/dashboard/follow-up-jobs` now calls **`GET /api/dashboard/follow-up-jobs`** with `focusFeedMaxItems=100`.
- Removed dependency on capped `today-plan.followUpJobs` for the list page.

### Backend — implement `GET /dashboard/follow-up-jobs`

Mirror quiet-applications pattern:

```typescript
type DashboardFollowUpJobsResponse = {
  generatedAt: string;
  followUpJobs: FollowUpJobRowPayload[];  // up to focusFeedMaxItems (default 100)
  followUpJobsTotalCount: number;
};
```

| Rule | Detail |
|------|--------|
| Ranking | Same order as home snapshot / `followUpIntelligence` |
| Cap param | `focusFeedMaxItems` 1–100 (default 100) |
| Home vs list | `today-plan.followUpJobs` stays max **2**; this endpoint returns **full queue** |
| `followUpJobsViewAllHref` | Should remain `/dashboard/follow-up-jobs` |

**Also verify:** `followUpJobsTotalCount` on today-plan matches the length of the full queue from this endpoint (not the snapshot length).

**Acceptance:** User with 15 follow-ups sees 15 rows on the list page; no snapshot warning.

### Optional copy / UX

If `followUpJobsTotalCount > followUpJobs.length` on **today-plan only**, that is expected on the home page. It must **never** happen on the list endpoint response.

---

## Issue 3 — Quiet application missing after archive → restore

### User report

1. **Applications going quiet** showed 3 items.
2. User archived one from the quiet section.
3. User restored it from **Jobs → Archive**.
4. Job no longer appears in **Applications going quiet** (expected to return if still 21+ days without reply).

### Frontend behavior (for reference)

- Archive from quiet section: `POST /jobs/archive` + invalidates today-plan + quiet-applications queries.
- Restore from archive: `POST /jobs/restore` (via `api.jobs.restoreArchive`) + **`invalidateTodayPlanQueries`** (today-plan, quiet-applications, focus, etc.).

Frontend cache invalidation is correct. This is almost certainly **server-side eligibility**, not stale React Query data.

### Likely root causes (please investigate)

#### A. Activity clock uses `updatedAt` (most likely)

Prior handoff documented quiet detection as:

> **21 days** since last meaningful activity (`max(appliedAt, updatedAt)`)

If **archive** or **restore** writes a fresh `updatedAt` (or `lastActivityAt`), then:

```text
daysSinceActivity = now - max(appliedAt, updatedAt)  →  drops to 0–1 days
```

The application **falls below the 21-day threshold** even though the user has not heard back since they originally applied.

**Recommended fix:**

| Field | Use for quiet queue? |
|-------|----------------------|
| `appliedAt` / `submittedAt` | **Primary anchor** — days since application submitted |
| Employer reply / interview events | Reset or exclude from quiet (already excluded for interview stage) |
| `updatedAt` from archive/restore/metadata | **Must NOT** reset quiet eligibility |
| User notes, email drafts, hub navigation | Optional: do not reset quiet clock unless they represent real employer contact |

Expose in API for debugging:

```typescript
daysSinceActivity: number;
quietEligibilityAnchorAt: string;  // ISO — which timestamp was used
quietEligibilityReason: 'days_since_applied' | 'days_since_last_employer_signal' | ...
```

#### B. Archive restore does not clear `archivedAt` synchronously

Quiet builder excludes rows with `archivedAt` set. If restore leaves `archivedAt` populated in the snapshot used by quiet builder, the row stays excluded.

**Verify:** After restore, application row has `archivedAt: null` before today-plan / quiet-applications is rebuilt.

#### C. Stage / status after restore

Restore may place the job in a stage that excludes quiet detection (`interview`, `offer`, `closed`) even when the user considers it “still applied, no reply”.

**Verify:** Restored submitted applications return to the same stage they had before archive (typically `applied`).

#### D. Dismissal / suppression ledger

If backend tracks “user archived from quiet nudge” or dismissed quiet coaching, restore might need to **clear that suppression** so the row can re-enter `staleApplicationItems`.

### Required behavior after fix

| Scenario | Expected |
|----------|----------|
| Applied 30 days ago, no reply, archived from quiet section | Removed from quiet queue while archived |
| Same job restored from archive | **Reappears** in quiet queue if still ≥ 21 days since **apply/submit** |
| Applied 10 days ago, archived and restored | Still **not** in quiet queue (< 21 days) |
| Applied 30 days ago, user sent follow-up email yesterday | Product decision: either stay in follow-up queue (14–20d) or drop from quiet if employer signal — document rule |

### Acceptance tests

1. Create application in `applied` state with `appliedAt` = 25 days ago, no employer events.
2. Confirm in `staleApplicationItems` on today-plan.
3. Archive → confirm removed from quiet queue.
4. Restore → confirm **back** in quiet queue with `daysSinceActivity >= 21`.
5. Confirm `lastActivityLabel` still reflects time since apply, not time since restore.

---

## How should the 21-day quiet clock work? (Product + backend contract)

### User expectation (confirmed with product)

> Count from the day the job was moved to **Applied**, until there is an **employer reply** (or interview / offer signal).

### Recommended server rules

```text
quietEligible =
  stage is submitted/applied-like
  AND status not in (rejected, withdrawn, accepted, offer_received, ghosted)
  AND archivedAt is null
  AND daysSince(submittedAt) >= 21
  AND no employerReplyAt (or interview scheduled, offer, etc.)
```

| Event | Affects quiet clock? |
|-------|----------------------|
| User moves job to **Applied** | **Starts** clock |
| User edits CV, notes, opens Job Hub | No |
| User archives / restores | No reset of apply anchor |
| User sends follow-up email (no reply) | No reset — still quiet |
| Employer reply / interview scheduled | **Removes** from quiet queue |
| 14–20 days since apply | May appear in `focusItems` / follow-up (per prior handoff) |
| 21+ days since apply, no reply | **`staleApplicationItems` only** |

**Do not** use `max(appliedAt, updatedAt)` if `updatedAt` changes on archive, restore, or internal metadata writes.

Prefer explicit fields:

- `submittedAt` / `appliedAt` — anchor for “how long since I applied”
- `lastEmployerSignalAt` — optional; when set, exclude from quiet

---

## API checklist

| Endpoint | Status | Purpose |
|----------|--------|---------|
| `GET /dashboard/today-plan` | ✅ | Home snapshot (caps at 2 per execution section) |
| `GET /dashboard/quiet-applications` | ✅ | Full quiet queue |
| `GET /dashboard/follow-up-jobs` | ✅ | Full follow-up queue |
| `GET /dashboard/interview-prep` | ✅ | Full interview activity list |
| `GET /applications/:id` | ✅ | `staleApplicationNotice` for Job Hub |

---

## Frontend files (for backend QA)

| Area | Path |
|------|------|
| Interview prep list | `packages/web/src/app/(dashboard)/dashboard/interview-prep/page.tsx` |
| Follow-up list | `packages/web/src/app/(dashboard)/dashboard/follow-up-jobs/page.tsx` |
| Quiet list | `packages/web/src/app/(dashboard)/dashboard/quiet-applications/page.tsx` |
| API client | `packages/web/src/lib/api.ts` → `dashboard.getInterviewPrep`, `getFollowUpJobs` |
| Normalizers | `packages/web/src/lib/today-plan.ts` |

---

## Frontend integration (2026-06-09)

- Parses `quietEligibilityAnchorAt` / `quietEligibilityReason` on stale application items.
- Home passes `interviewPreparationCardsTotalCount` to interview prep section “View all”.
- Follow-up list page uses `useDashboardFollowUpJobs`; cap note only when `loaded < serverTotal`.
- Error + retry UI on follow-up list page (matches quiet-applications / interview-prep).

**Smoke test:** With 15 follow-ups, `/dashboard/follow-up-jobs` shows all 15 with no amber cap banner. Archive → restore → job reappears in quiet section with days-since-applied label (not “1 day ago”).
