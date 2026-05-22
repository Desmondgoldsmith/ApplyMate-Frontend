# Frontend handoff — Phase 5 (Career OS / integration layer)

**Audience:** `applymate-frontend` (`packages/web`)  
**Backend:** `apply-mate-backend`  
**Goal:** Connect Job Board → Analyze → Tailor → Apply → Job Hub into one lifecycle view **without new mandatory screens or breaking existing flows.**

---

## 1. What Phase 5 is (and is not)

**Phase 5 is not a new product area.** It is a **read + light-action layer** on top of flows you already have.

| Yes | No |
|-----|-----|
| Job Hub shows pipeline / accepted / activity | New top-level “Career OS” nav required |
| Optional “I accepted this offer” button | Replacing Job Hub kanban |
| Optional LinkedIn verification form | Changing analyze/tailor/discovery contracts |
| Backend logs journey **automatically** on existing actions | Frontend must call journey API on every click |

**Design rule:** If `ENABLE_CAREER_FLOW` is off, the app must look and behave exactly as today.

---

## 2. Backend setup (coordinate before QA)

### Feature flag

```env
ENABLE_CAREER_FLOW=true
```

Backend only writes journey events and returns meaningful dashboard data when this is `true`.

### Migration

```bash
# In apply-mate-backend
npx prisma migrate deploy
```

Migration name: `20260516120000_career_flow_phase5`  
Creates: `JobJourneyEvent`, `PlacementVerification`, `UserReward`, `UserAchievement`.

### API base

All paths below are under **`/api`** (e.g. `NEXT_PUBLIC_API_URL=https://host/api`).  
Auth: Bearer token (same as rest of app).  
Responses use the usual envelope: `{ success: true, data: { ... } }` — use `unwrapApiDataEnvelope` / existing `api.ts` patterns.

---

## 3. What happens automatically (no new frontend calls)

When the flag is on, the backend records **`JobJourneyEvent`** rows as **side effects** of actions users already take:

| User action (existing UI) | Journey stage recorded |
|---------------------------|-------------------------|
| Job board **Apply / Maybe** on a listing | `VIEWED` |
| Job board **Skip** | `REJECTED` |
| **Analyze** completes (`POST /jobs/analyze`) | `ANALYZED` |
| **Tailor** — accept a section | `TAILORED` |
| **Job Hub** — create application or move status to applied+ | `APPLIED`, `INTERVIEW`, `NEGOTIATING`, or `REJECTED` |

So: shipping Phase 5 UI is **additive**. Existing buttons already feed the pipeline if the flag is on.

**Optional but recommended:** keep calling `api.jobDiscovery.recordDecision` on Apply/Maybe/Skip (Phase 2) — that path also emits journey events.

---

## 4. What the frontend must build

### P0 — Job Hub “control center” (read-only)

**`GET /api/career/dashboard`**

Use this to show:

- **Active pipeline** — jobs in progress (analyzed, tailored, applied, interviewing, etc.)
- **Accepted** — jobs the user marked as accepted
- **Recent activity** — last ~25 events
- **Insights** — lightweight stats (optional widgets)
- **Badges** — earned achievements (share copy included)

No new route required — a section on existing Job Hub is enough.

### P1 — Mark offer accepted

**`POST /api/jobs/:jobAnalysisId/mark-accepted`**

Call when the user confirms they **accepted an offer** (e.g. on analysis detail or Hub row when status is “offered”).

- `:id` = **job analysis id** (same id as `GET /jobs/:id`, analyze history, tailor flow).
- May return a **first-time badge** in the response.

### P2 — LinkedIn verification (growth)

**`POST /api/career/verification/submit`**

Form: LinkedIn post URL + optional screenshot URL + optional `jobId`.

Submission stays **`pendingApproval: true`** until approved (v1 has a dev approve endpoint — do not expose approve to normal users in prod).

### P3 — Discovery listing extras (optional UI)

Accepted jobs on **`GET /job-discovery`** may include:

```ts
pipelineStage?: 'ACCEPTED';
rankingFrozen?: true;
```

You can show a small “Accepted” label; ranking fields may still be present but lifecycle is frozen server-side.

---

## 5. API reference

### 5.1 `GET /career/dashboard`

**Response `data`:**

```ts
type JobJourneyStage =
  | 'DISCOVERED'
  | 'VIEWED'
  | 'ANALYZED'
  | 'TAILORED'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'REJECTED';

type CareerPipelineJob = {
  jobId: string;
  pipelineStage: JobJourneyStage;
  company: string | null;
  title: string | null;
  matchScore: number | null;
  lastEventAt: string; // ISO 8601
};

type CareerDashboard = {
  activePipelineJobs: CareerPipelineJob[];
  acceptedJobs: CareerPipelineJob[];
  recentActivity: Array<{
    id: string;
    jobId: string;
    stage: JobJourneyStage;
    createdAt: string;
    metadata: Record<string, unknown> | null;
  }>;
  badges: Array<{
    code: string;
    title: string;
    description: string;
    shareText: string;
    shareLink: string | null;
    earnedAt: string;
  }>;
  insights: {
    strongestSkill: string | null;
    conversionRate: number | null;       // % analyzed → applied (from events)
    avgMatchScoreOfAppliedJobs: number | null;
  };
};
```

**Pipeline stage logic (for labels/tooltips):**  
Backend collapses many events per `jobId` into **one** stage using priority:

`ACCEPTED` → `NEGOTIATING` → `INTERVIEW` → `APPLIED` → `TAILORED` → `ANALYZED` → `VIEWED` → `DISCOVERED`  
(`REJECTED` only when that is the effective terminal state.)

**Empty state:** Flag off, new user, or no activity yet → arrays `[]`, insights `null`. Show nothing or a subtle empty message — **not an error**.

---

### 5.2 `POST /jobs/:jobAnalysisId/mark-accepted`

**Request:** empty body `{}`

**Response `data`:**

```ts
{
  stage: 'ACCEPTED';
  badge: {
    code: string;           // e.g. FIRST_JOB_ACCEPTED
    title: string;
    description: string;
    shareText: string;
    shareLink: string | null;
  } | null;                 // null if user already had this badge
}
```

**When to call:** User explicitly confirms offer accepted (not the same as moving Hub status to “applied”).

**After success:** Refresh `GET /career/dashboard` and/or job detail; job should appear under `acceptedJobs`.

---

### 5.3 `POST /career/verification/submit`

**Request body:**

```ts
{
  jobId?: string;              // optional — job analysis or listing id
  linkedinPostUrl: string;     // required — must be linkedin.com URL
  screenshotUrl?: string;      // optional — https URL
}
```

**Response `data`:**

```ts
{
  id: string;
  pendingApproval: boolean;  // true on submit
  verified: boolean;           // false until approved
}
```

**Validation errors:** Invalid LinkedIn URL → `400`.

---

### 5.4 `POST /career/verification/:id/approve` (dev/admin only)

Approves pending verification, grants **5 days premium-style access** (`UserReward`), may award badge `FIRST_VERIFIED_PLACEMENT`.

**Do not ship a user-facing “Approve” button in production** without an admin guard. Documented for staging/testing.

After approve, `getUserTier()` on the server treats the user as **PAID** until reward expires (affects AI daily limits).

---

## 6. Linking `jobId` to your existing entities

`jobId` in career APIs is a **canonical key** for one job “thread”:

| Situation | Use as `jobId` |
|-----------|----------------|
| Row from job board | `jobListing.id` |
| Job with saved analysis | `jobListingId` if set, else `jobAnalysis.id` |
| Application with `jobAnalysisId` | Same as analysis listing/analysis id |
| Application only (no analysis) | `application.id` |

**`recentActivity[].metadata`** may include:

```ts
{
  entityType?: 'job_listing' | 'job_analysis' | 'application';
  jobAnalysisId?: string;
  jobListingId?: string;
  applicationId?: string;
  company?: string;
  title?: string;
  matchScore?: number;
  decision?: 'APPLY' | 'MAYBE' | 'SKIP';
  recruiterVerdict?: string;
  applyStrategy?: string;
}
```

Use these to deep-link: Job Board card, `/dashboard/job-analyzer/[id]`, Hub application row.

---

## 7. Badge codes

| `code` | When earned |
|--------|-------------|
| `FIRST_JOB_ACCEPTED` | First successful `mark-accepted` |
| `FIRST_VERIFIED_PLACEMENT` | Verification approved |

**Share UI:** Use `shareText` + `shareLink` from badge object (native share or copy — no social SDK required in v1).

---

## 8. Suggested `api.ts` additions

Add types above, then:

```ts
const career = {
  getDashboard: async (): Promise<CareerDashboard> => {
    const res = await axiosClient.get<unknown>('/career/dashboard');
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data) as CareerDashboard;
  },

  submitVerification: async (payload: {
    jobId?: string;
    linkedinPostUrl: string;
    screenshotUrl?: string;
  }): Promise<{ id: string; pendingApproval: boolean; verified: boolean }> => {
    const res = await axiosClient.post<unknown>('/career/verification/submit', payload);
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapApiDataEnvelope(res.data) as { id: string; pendingApproval: boolean; verified: boolean };
  },
};

// On existing jobs client:
markAccepted: async (jobAnalysisId: string) => {
  const res = await axiosClient.post<unknown>(
    `/jobs/${encodeURIComponent(jobAnalysisId)}/mark-accepted`,
    {},
  );
  throwIfApiFailureResponse(res.data, res.status);
  return unwrapApiDataEnvelope(res.data) as {
    stage: 'ACCEPTED';
    badge: { code: string; title: string; description: string; shareText: string; shareLink: string | null } | null;
  };
},
```

Export: `api.career` and `api.jobs.markAccepted` (or `api.jobs.markJobAccepted` — name consistently).

**React Query suggestion:**

```ts
useQuery({ queryKey: ['career', 'dashboard'], queryFn: () => api.career.getDashboard() });
```

Invalidate after: `markAccepted`, application status change, analyze complete (optional).

---

## 9. UI guidance (minimal clutter)

### Job Hub

- **One strip or sidebar block** — “Your pipeline” from `activePipelineJobs` (max 5–8 rows, link to job).
- **“Accepted”** — `acceptedJobs` (collapsed section).
- **Insights** — small text: e.g. “Avg match on applied roles: 68%” from `insights.avgMatchScoreOfAppliedJobs`.
- Do **not** duplicate full kanban — Hub status on `Application` remains source of truth for reminders/email.

### Mark accepted

- Button: “I accepted this offer” on analysis page or Hub when user is in offered/late stage.
- On success: toast + optional badge modal if `badge` is non-null.

### Verification

- Settings or post-accept modal: “Share on LinkedIn” → paste URL → submit.
- Show “Pending review” after submit.

### Stage labels (user-facing)

| `pipelineStage` | Label idea |
|-----------------|------------|
| VIEWED | Interested |
| ANALYZED | Analyzed |
| TAILORED | CV tailored |
| APPLIED | Applied |
| INTERVIEW | Interviewing |
| NEGOTIATING | Offer stage |
| ACCEPTED | Accepted |
| REJECTED | Passed |

---

## 10. What you do **not** need to change

- `POST /jobs/analyze` request/response shape (except optional read of journey-driven UI).
- Tailor draft API contract.
- Job discovery filters.
- Application CRUD.
- Phase 2 `ranking` / `explanation` (still independent; accepted listings may show `rankingFrozen`).

---

## 11. Testing checklist

1. Backend: `ENABLE_CAREER_FLOW=true` + migration applied.
2. Analyze a job → `GET /career/dashboard` shows row with `pipelineStage: 'ANALYZED'`.
3. Apply on job board (decision) → stage moves toward `VIEWED`.
4. Create/update application to applied → `APPLIED`.
5. `POST /jobs/:id/mark-accepted` → appears in `acceptedJobs`, badge on first time.
6. Flag off → dashboard returns empty arrays; app does not crash.
7. `verification/submit` with bad URL → 400 with message.

---

## 12. Paste-ready prompt for implementation

> Implement **Phase 5 Career OS** on ApplyMate web only. Backend flag: `ENABLE_CAREER_FLOW=true`. Add `api.career.getDashboard()`, `api.jobs.markAccepted(jobAnalysisId)`, `api.career.submitVerification()`. On Job Hub, add a compact “Pipeline” section from `activePipelineJobs` and “Accepted” from `acceptedJobs`; use `recentActivity` for a small activity feed optional. Add “I accepted this offer” calling `mark-accepted` with `jobAnalysisId`; show badge modal when response includes `badge`. Optional: LinkedIn verification form. Journey events are **automatic** for analyze, tailor accept, applications, and job board decisions — do not build a separate event POST client. Handle empty dashboard when flag off or no data. Deep-link via `jobId` + `metadata.jobAnalysisId` / `jobListingId`. Do not add a new top-level nav item.

---

## 13. Backend contact / docs

- Backend summary: `apply-mate-backend/docs/PHASE5_CAREER_FLOW_HANDOFF.md`
- Questions: journey not updating → check `ENABLE_CAREER_FLOW` and migration; `mark-accepted` 404 → wrong id (must be job **analysis** id)
