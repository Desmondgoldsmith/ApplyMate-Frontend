# Frontend team handoff — Phases 1–5 (Location → Ranking → Analysis V2 → CV patches → Career OS)

**Audience:** `applymate-frontend` (`packages/web`)  
**Backend:** `apply-mate-backend` (all routes under `/api`)  
**Design principle:** Enhance existing screens. No new mandatory flows. Everything degrades gracefully when feature flags are off.

**Related docs:**
- Phases 1–2 detail: [`FRONTEND_HANDOFF_PHASE1_PHASE2.md`](./FRONTEND_HANDOFF_PHASE1_PHASE2.md)
- Backend Phase 3–4: `apply-mate-backend/docs/PHASE3_PHASE4_BACKEND_HANDOFF.md`
- Backend Phase 5: `apply-mate-backend/docs/PHASE5_CAREER_FLOW_HANDOFF.md`

---

## 1. Feature flags (backend `.env`)

| Flag | Effect when `true` |
|------|---------------------|
| `ENABLE_ANALYSIS_V2` | `POST /jobs/analyze` adds optional `analysisV2` (recruiter intelligence) |
| `ENABLE_CAREER_FLOW` | Journey events recorded; career APIs return real data |

When flags are **off**, existing APIs and UI keep working; new fields are simply absent.

**Migrations required (backend):**
- `20260515120000_job_listing_decision` (Phase 2 decisions)
- `20260516120000_career_flow_phase5` (Phase 5 journey + rewards + badges)

---

## 2. Master map — what talks to what

```text
Job Board ──GET /job-discovery──► ranking + explanation + searchContext
         ──POST …/decision──────► APPLY / MAYBE / SKIP (+ journey event if Phase 5)

Analyze  ──POST /jobs/analyze───► matchScore + analysisV2 (if flag)
         ──POST …/mark-accepted► ACCEPTED (+ badge)

Tailor   ──POST /cv/tailor-draft► per-section patches (patchId on each draft entry)
         ──accept-section──────► applies patch, re-scores CV, rematch job

Job Hub  ──applications───────► APPLIED / INTERVIEW / … journey events
         ──GET /career/dashboard► pipeline + accepted + insights (Phase 5)
```

---

## 3. Phase 1 — Location

### APIs

| Method | Path | Notes |
|--------|------|--------|
| GET | `/location/resolve` | Auth required; no raw IP stored |

**Response:**

```ts
type ResolvedGeoLocation = {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  confidence: 'high' | 'medium' | 'low';
};
```

**Persist preference:** `PATCH /users/me` → `{ uiPrefs: { jobSearchLocation: "Accra, Ghana" } }`

### Client priority (must match server)

1. User override — Job Board `location` filter  
2. `me.uiPrefs.jobSearchLocation` + `useLocationStore.selectedLocation`  
3. IP — `detectedLocation` from resolve  
4. CV / account location  
5. Default (empty)

### Frontend status

| Item | Status |
|------|--------|
| `useLocationStore`, `LocationBootstrap`, `LocationConfirmPrompt` | Wired |
| Job Board filter init via `resolveEffectiveLocationClient` | Wired |
| `api.location.resolve()` | Wired |
| `searchContext` banner on Job Board | **TODO** |
| Sync filter change → `updateMe` + store | **TODO** |

---

## 4. Phase 2 — Job discovery ranking

### Per listing (`JobListingDto`)

```ts
type JobRankingTier = 'APPLY_NOW' | 'CONSIDER' | 'LOW_MATCH';

type JobListingRanking = {
  score: number;           // 0–100
  tier: JobRankingTier;
  recommendation: string;
};

type JobListingExplanation = {
  matchedSkills: string[];
  missingSkills: string[];
  riskFactors: string[];
  seniorityMismatch: 'none' | 'under' | 'over' | 'unknown';
  whyThisJob: string;
  recommendation: string;
};
```

**Discovery response** also includes:

```ts
searchContext?: {
  locationLabel: string;
  locationSource: string;  // user_override | saved_preference | ip_detected | …
  countryCode: string;
  roleQuery: string;
};
```

**Tier thresholds:** Apply now ≥ 78 · Consider ≥ 55 · Low match &lt; 55

**`matchPreview` on list items:** `version: "v2-ranking"`, `instantScore` = `ranking.score`

**Phase 5 addition on accepted jobs:**

```ts
pipelineStage?: 'ACCEPTED';
rankingFrozen?: true;   // ranking still present; server marks frozen lifecycle
```

### APIs

| Method | Path | Body |
|--------|------|------|
| POST | `/job-discovery/:jobListingId/decision` | `{ decision: "APPLY" \| "MAYBE" \| "SKIP" }` |

Client: `api.jobDiscovery.recordDecision(id, decision)`

### Frontend status

| Item | Status |
|------|--------|
| Types + normalizers in `api.ts` | Wired |
| Tier badges on `JobListingCard` | Wired |
| Detail panel explainability | **TODO** |
| Decision buttons (Apply/Maybe/Skip) | **TODO** |
| `searchContext` banner | **TODO** |

### Do not confuse

| Source | Use |
|--------|-----|
| `job.ranking.score` | Server-ranked list (Phase 2) |
| `useJobBoardAiMatch` / `GET /jobs/match-score` | On-demand heuristic; separate quota story |

---

## 5. Phase 3 — Analysis V2 (“recruiter UI”)

**Not a new app.** Extra block on analyze results when `ENABLE_ANALYSIS_V2=true`.

### On `POST /jobs/analyze` response (and rematch)

Existing fields unchanged. Optional add-on:

```ts
analysisV2?: {
  recruiterVerdict: 'STRONG' | 'COMPETITIVE' | 'WEAK';
  axes: {
    skillMatch: number;
    experienceFit: number;
    industryFit: number;
    evidenceStrength: number;
  };
  attackPlan: {
    topCVFixes: string[];      // max 3
    interviewRisks: string[];    // max 3
    missingEvidence: string[];   // max 3
    salaryRange?: string;
  };
  applyStrategy: 'APPLY_NOW' | 'TAILOR_FIRST' | 'SKIP';
};
```

**Not persisted in DB** — only in API response (and analyze cache when flag was on at write time).

### Frontend status

| Item | Status |
|------|--------|
| `parseJobAnalysisV2` (`lib/jobAnalysisV2.ts`) | Wired |
| `JobAnalysisV2Panel`, `JobAnalysisCard` integration | Wired |
| Ensure `JobAnalysis` type includes `analysisV2?: JobAnalysisV2` | Verify in `api.ts` |
| Wire CTAs: `applyStrategy` → tailor / apply / skip | **Polish TODO** |
| Hide panel when flag off / field missing | Should already no-op |

### UI copy guide

| `recruiterVerdict` | Suggested label |
|--------------------|-----------------|
| STRONG | Strong fit |
| COMPETITIVE | Competitive |
| WEAK | Weak fit |

| `applyStrategy` | Suggested CTA |
|-----------------|---------------|
| APPLY_NOW | Apply now |
| TAILOR_FIRST | Tailor CV first |
| SKIP | Skip this role |

Use `ANALYSIS_AXIS_META` in `jobAnalysisV2.ts` for axis tooltips.

---

## 6. Phase 4 — Grammarly-style CV patches (tailor)

### Concepts

- **`cvMode`:** `'clinic' | 'tailor'` — UI/session only (not in DB).
- Each tailor AI suggestion → **`CvPatch`** with `patchId` on `CvTailorDraft.drafts[]`.
- Accept applies section, syncs structured CV, **async re-score**, emits `cv.patch.applied` (server-side).

### Tailor draft entry (extended)

```ts
type CvTailorDraftEntry = {
  sectionId: string;
  sectionType: string;
  before: string;       // JSON string
  after: string;        // JSON string
  status: 'pending' | 'accepted' | 'rejected';
  changedFields: string[];
  patchId?: string;     // Phase 4 — use for revert
};
```

### New CV APIs

| Method | Path | Notes |
|--------|------|--------|
| GET | `/cv/patches?profileId=` | List in-memory patches for profile |
| POST | `/cv/patches/:patchId/revert` | Undo accepted patch |

**Patch shape (server in-memory):**

```ts
type CvPatch = {
  id: string;
  profileId: string;
  section: string;
  sectionId?: string;
  before: unknown;
  after: unknown;
  status: 'pending' | 'accepted' | 'rejected';
  source: 'clinic' | 'tailor' | 'manual';
};
```

### Frontend status

| Item | Status |
|------|--------|
| Existing tailor accept/reject flow | Works (server uses patches internally) |
| `api.cv.listPatches` / `revertPatch` | **Add to `api.ts` if missing** |
| Per-section diff UI + Undo button | **TODO** |
| `cvMode` toggle in tailor vs clinic routes | **TODO** (conceptual) |

**Note:** Patches are **lost on server restart**; `patchId` remains on draft JSON for display only until re-tailor.

---

## 7. Phase 5 — Career OS (integration layer)

Connects actions into one journey log. **No new screens required** — enrich Job Hub.

### Enable

```env
ENABLE_CAREER_FLOW=true
```

### Journey stages

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
```

**Computed pipeline state** (one per `jobId`, highest stage wins):

`ACCEPTED > NEGOTIATING > INTERVIEW > APPLIED > TAILORED > ANALYZED > VIEWED > DISCOVERED`

(`REJECTED` only when it is the sole terminal signal.)

### `jobId` convention

| Source | `jobId` value |
|--------|----------------|
| Job Board listing | `jobListingId` |
| Job analysis | `jobListingId` if linked, else `jobAnalysisId` |
| Application without analysis | `application.id` |

Check `metadata.entityType`, `jobAnalysisId`, `jobListingId` on events when linking UI.

### Automatic backend hooks (no extra client calls)

| User action | Event stage |
|-------------|-------------|
| `recordDecision` APPLY/MAYBE | `VIEWED` |
| `recordDecision` SKIP | `REJECTED` |
| Analyze saved | `ANALYZED` |
| Tailor section accepted | `TAILORED` |
| Application create / status update | `APPLIED`, `INTERVIEW`, … |
| `POST /jobs/:id/mark-accepted` | `ACCEPTED` |

### New APIs — add to `api.ts`

#### `GET /career/dashboard`

```ts
type CareerDashboard = {
  activePipelineJobs: Array<{
    jobId: string;
    pipelineStage: JobJourneyStage;
    company: string | null;
    title: string | null;
    matchScore: number | null;
    lastEventAt: string; // ISO
  }>;
  acceptedJobs: Array</* same shape */>;
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
    conversionRate: number | null;        // analyzed → applied %
    avgMatchScoreOfAppliedJobs: number | null;
  };
};
```

When flag off or no events yet: arrays empty, insights null — **render empty states, not errors**.

#### `POST /jobs/:jobAnalysisId/mark-accepted`

```ts
// Response
{
  stage: 'ACCEPTED';
  badge: {
    code: 'FIRST_JOB_ACCEPTED';
    title: string;
    description: string;
    shareText: string;
    shareLink: string | null;
  } | null;
}
```

Call when user confirms they accepted an offer (Job Hub or analysis detail).

#### `POST /career/verification/submit`

```ts
// Request
{
  jobId?: string;
  linkedinPostUrl: string;
  screenshotUrl?: string;
}

// Response
{
  id: string;
  pendingApproval: boolean;
  verified: boolean;
}
```

#### `POST /career/verification/:id/approve`

Dev/admin v1 — approves pending verification, grants **5 days premium** (`UserReward`), badge `FIRST_VERIFIED_PLACEMENT`.  
**Do not expose to end users in production without an admin guard.**

### Badge codes

| Code | When |
|------|------|
| `FIRST_JOB_ACCEPTED` | First `mark-accepted` |
| `FIRST_VERIFIED_PLACEMENT` | Verification approved |

### Premium reward

Active `UserReward` with `rewardType: PREMIUM_ACCESS_DAYS` makes `getUserTier()` return **PAID** for AI limits until `expiresAt`.

### Frontend status (Phase 5)

| Item | Status |
|------|--------|
| `api.career.getDashboard()` | **TODO** |
| `api.jobs.markAccepted()` | **TODO** |
| `api.career.submitVerification()` | **TODO** |
| Job Hub “Active pipeline” / “Accepted” sections | **TODO** |
| Offer accepted CTA | **TODO** |
| LinkedIn verification form | **TODO** |
| Share badge modal (use `shareText` / `shareLink`) | **TODO** |

---

## 8. Suggested `api.ts` additions (copy-paste starting point)

```ts
// --- Career (Phase 5) ---
export type JobJourneyStage = 'DISCOVERED' | 'VIEWED' | 'ANALYZED' | 'TAILORED' | 'APPLIED' | 'INTERVIEW' | 'NEGOTIATING' | 'ACCEPTED' | 'REJECTED';

export type CareerDashboard = { /* see §7 */ };

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
  }) => { /* POST /career/verification/submit */ },
};

// jobs.markAccepted
markAccepted: async (jobAnalysisId: string) => {
  const res = await axiosClient.post<unknown>(
    `/jobs/${encodeURIComponent(jobAnalysisId)}/mark-accepted`,
    {},
  );
  throwIfApiFailureResponse(res.data, res.status);
  return unwrapApiDataEnvelope(res.data);
},
```

Export `career` on `api` object.

---

## 9. UI integration checklist (priority order)

### P0 — Ship with flags on staging

- [ ] Confirm `ENABLE_ANALYSIS_V2` + `JobAnalysisV2Panel` on analyze screen
- [ ] Job Board tier badges + `whyThisJob` / `explanation.whyThisJob` subtitle
- [ ] `recordDecision` on Apply/Maybe/Skip (feeds Phase 5 automatically)
- [ ] `GET /career/dashboard` in Job Hub sidebar or top strip (read-only)

### P1 — Polish

- [ ] `searchContext` chip on Job Board (“Searching near …”)
- [ ] Job detail explainability panel (`explanation` chips)
- [ ] `mark-accepted` on offered jobs
- [ ] Location filter ↔ `updateMe` sync

### P2 — Growth

- [ ] Tailor per-section undo via `POST /cv/patches/:id/revert`
- [ ] LinkedIn verification + share badges
- [ ] Analytics events for verdict shown, decision clicked, accepted

---

## 10. Example payloads

### Analyze with V2

```json
{
  "matchScore": 72,
  "recommendation": "MEDIUM_MATCH",
  "analysisV2": {
    "recruiterVerdict": "COMPETITIVE",
    "axes": { "skillMatch": 68, "experienceFit": 70, "industryFit": 55, "evidenceStrength": 48 },
    "attackPlan": {
      "topCVFixes": ["Add quantified outcomes to your last role."],
      "interviewRisks": ["Prepare for seniority gap questions."],
      "missingEvidence": ["Limited proof of Kubernetes on CV."]
    },
    "applyStrategy": "TAILOR_FIRST"
  }
}
```

### Career dashboard (trimmed)

```json
{
  "activePipelineJobs": [
    {
      "jobId": "listing-uuid",
      "pipelineStage": "ANALYZED",
      "company": "Acme",
      "title": "Senior Engineer",
      "matchScore": 72,
      "lastEventAt": "2026-05-15T12:00:00.000Z"
    }
  ],
  "acceptedJobs": [],
  "insights": { "strongestSkill": "react", "conversionRate": 40, "avgMatchScoreOfAppliedJobs": 68 },
  "badges": []
}
```

---

## 11. Paste-ready prompt for AI / contractors

> You are working on ApplyMate `packages/web`. Implement against backend Phases 1–5 without new mandatory routes.
>
> **Phase 1:** Location via `GET /location/resolve`, `useLocationStore`, `uiPrefs.jobSearchLocation`, `resolveEffectiveLocationClient`. Show `searchContext` on Job Board from discovery response.
>
> **Phase 2:** Each discovery item has `ranking`, `explanation`, optional `searchContext`. Sort is server-side. Wire `api.jobDiscovery.recordDecision` for Apply/Maybe/Skip. Do not replace `useJobBoardAiMatch`.
>
> **Phase 3:** When `analysisV2` is present on analyze, render `JobAnalysisV2Panel` (verdict, 4 axes, attack plan, apply strategy CTAs). Requires backend `ENABLE_ANALYSIS_V2=true`.
>
> **Phase 4:** Tailor drafts may include `patchId`. Optional undo: `POST /cv/patches/:patchId/revert`. Clinic vs tailor is UI `cvMode` only.
>
> **Phase 5:** Add `api.career.getDashboard`, `api.jobs.markAccepted`, verification submit. Enrich Job Hub with `activePipelineJobs` / `acceptedJobs` — no new top-level nav required. Journey events are automatic when `ENABLE_CAREER_FLOW=true`.
>
> Types/normalizers live in `src/lib/api.ts` and `src/lib/jobAnalysisV2.ts`. Match existing dark teal UI. Graceful empty states when flags off or arrays empty.

---

## 12. Questions?

- Backend feature flags: `ENABLE_ANALYSIS_V2`, `ENABLE_CAREER_FLOW`
- Migrations: listing decision + career flow
- Phase 1–2 deep dive: [`FRONTEND_HANDOFF_PHASE1_PHASE2.md`](./FRONTEND_HANDOFF_PHASE1_PHASE2.md)

*Last updated: May 2026 — Phases 1–5 backend implemented; frontend partial (V2 panel + location + tier badges wired).*
