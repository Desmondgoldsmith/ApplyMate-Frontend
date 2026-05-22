# Frontend handoff — Phase 1 (Location) & Phase 2 (Job ranking)

**Audience:** Frontend team (`applymate-frontend`, mainly `packages/web`)  
**Backend repo:** `apply-mate-backend`  
**Date:** May 2026  
**Goal:** Ship smarter job search location + ranked job board without breaking existing flows.

Use this document as the single source of truth for APIs, data shapes, what is already wired, and what you still need to build.

---

## 1. Executive summary

| Area | Backend | Frontend (current) |
|------|---------|-------------------|
| **Phase 1 — Location** | IP resolve endpoint, effective-location priority in job discovery, `uiPrefs.jobSearchLocation` | Store, bootstrap hook, confirm modal, Job Board filter init — **mostly wired** |
| **Phase 2 — Ranking** | Weighted score + tiers + explainability on every discovery item; decision feedback endpoint | API types + card tier badges — **partial**; detail panel + decision UI **not wired** |

**Important:** Job Board still has its own **on-demand AI match** (`useJobBoardAiMatch` → `GET /jobs/:id/match-score`). That is separate from the new **discovery ranking** (`ranking` / `explanation` on `GET /job-discovery`). Do not conflate them in UI copy or analytics.

---

## 2. Prerequisites (coordinate with backend / DevOps)

1. **Database migration** must be applied before `POST /job-discovery/:id/decision` works:
   - `apply-mate-backend/src/prisma/migrations/20260515120000_job_listing_decision/migration.sql`
   - Run: `npx prisma migrate deploy` (or `migrate dev` locally)

2. **IP geolocation env** (backend `.env`):
   - `IP_GEO_PROVIDER` — `ipapi` (default) or `ipinfo`
   - `IP_GEO_API_KEY` — required for `ipinfo`; optional for some `ipapi` tiers

3. **API base URL** — all routes below are under global prefix **`/api`** (e.g. `NEXT_PUBLIC_API_URL=https://host/api`).

4. **Auth** — `GET /location/resolve` and job discovery require Bearer token (same as rest of app).

---

## 3. Phase 1 — Location

### 3.1 Product behaviour

When a user opens the app and has no explicit job-search location:

1. Client may call **`GET /location/resolve`** once per session (server caches ~12h per hashed IP; **raw IP is never stored**).
2. If we get a usable city/country and the user has not dismissed the prompt, show **“We detected {city, country} — use this?”**
3. On **Use this location**:
   - Save label in local Zustand store (`selectedLocation`)
   - Persist cross-device via **`PATCH /users/me`** → `uiPrefs.jobSearchLocation`
4. Job discovery on the server picks location using the **same priority** as the client helper (see §3.3).

User can always override via Job Board location filter (= `user_override`).

### 3.2 API — `GET /location/resolve`

**Request:** authenticated GET, no body. Server reads `X-Forwarded-For` or socket IP.

**Response** (`200`, envelope as per existing API pattern — use `unwrapApiDataEnvelope` / `api.location.resolve()`):

```ts
type ResolvedGeoLocation = {
  country: string | null;      // e.g. "Ghana"
  countryCode: string | null;  // e.g. "GH"
  city: string | null;         // e.g. "Accra"
  region: string | null;       // e.g. "Greater Accra"
  timezone: string | null;     // e.g. "Africa/Accra"
  confidence: 'high' | 'medium' | 'low';
};
```

**Client wrapper:** `api.location.resolve()` in `packages/web/src/lib/api.ts`.

### 3.3 Effective location priority (client + server must match)

| Priority | Source key | Where it comes from |
|----------|------------|---------------------|
| 1 | `user_override` | Job Board `location` query param / applied filter |
| 2 | `saved_preference` | `me.uiPrefs.jobSearchLocation` and/or `useLocationStore.selectedLocation` |
| 3 | `ip_detected` | `GET /location/resolve` → `useLocationStore.detectedLocation` |
| 4 | `cv_profile` | Default CV profile `location` or `me.location` |
| 5 | `role_default` | Empty — server falls back (e.g. US for JSearch country) |

**Client helper:** `packages/web/src/lib/resolve-effective-location-client.ts`  
**Server:** `apply-mate-backend/src/common/location/resolve-effective-location.ts`

### 3.4 Persisting saved preference — `PATCH /users/me`

```ts
// Partial patch — merges uiPrefs
await api.users.updateMe({
  uiPrefs: { jobSearchLocation: 'Accra, Ghana' },
});
```

**Read back on GET /users/me:**

```ts
type UserUiPrefs = {
  tourCompleted?: boolean;
  jobSearchLocation?: string; // max 240 chars on server
  [key: string]: unknown;
};
```

### 3.5 Discovery impact (server-side — you do not call this separately)

`GET /job-discovery` accepts existing filters (`location`, `remoteFirst`, `cvProfileId`, etc.). The server builds `searchContext` on the response (see §4.2) using effective location. **You should still send `location` when the user sets the filter** so priority (1) applies.

### 3.6 Frontend files already added

| File | Role |
|------|------|
| `src/store/useLocationStore.ts` | Zustand + persist: `selectedLocation`, `promptDismissedAt` (detected geo is session-only) |
| `src/hooks/useLocationBootstrap.ts` | Calls resolve API after login |
| `src/components/location/LocationBootstrap.tsx` | Modal orchestration + `updateMe` on confirm |
| `src/components/location/LocationConfirmPrompt.tsx` | UI modal |
| `src/app/(dashboard)/layout.tsx` | Renders `<LocationBootstrap enabled={!!accessToken} />` (`'use client'`) |
| `src/app/(dashboard)/dashboard/job-board/JobBoardContent.tsx` | Bootstraps `location` filter from effective location |
| `src/lib/resolve-effective-location-client.test.ts` | Unit test for priority |

**Persist key:** `applymate:location-store` (partial: `selectedLocation`, `promptDismissedAt` only).

---

## 4. Phase 2 — Job ranking

### 4.1 Product behaviour

Every job in **`GET /job-discovery`** (and cached rediscovery) is now:

1. **Scored** 0–100 with a fixed weighted formula (deterministic, **no extra Gemini call** for ranking).
2. **Tiered** for UI: Apply now / Consider / Low match.
3. **Explained** with skills, gaps, risks, seniority, recommendation text.
4. **Sorted** by `ranking.score` descending (server-side).

Optional feedback: user taps Apply / Maybe / Skip → **`POST /job-discovery/:jobListingId/decision`**.

### 4.2 Scoring formula (for UI tooltips / docs)

When AI match exists on a saved `JobAnalysis` for that listing:

| Signal | Weight |
|--------|--------|
| Semantic similarity (CV tokens vs job text) | 40% |
| Heuristic skill overlap | 30% |
| AI match score (from prior analyzer run) | 20% |
| Preference fit (location remote/local, filters) | 10% |

When **no** AI score: weights are renormalized over the three remaining signals.

**Tier thresholds:**

| Tier | `ranking.tier` | Min score |
|------|----------------|-----------|
| Apply now | `APPLY_NOW` | ≥ 78 |
| Consider | `CONSIDER` | ≥ 55 |
| Low match | `LOW_MATCH` | < 55 |

### 4.3 API — `GET /job-discovery` (extended response)

Existing query params unchanged (`q`, `location`, `page`, `pageSize`, `cvProfileId`, `remoteFirst`, `workMode`, `employmentType`, `datePosted`, …).

**New / enriched top-level fields:**

```ts
type DiscoverJobsResponse = {
  items: JobListingDto[];
  total: number;
  page: number;
  pageSize: number;
  locationFallback?: boolean;
  remoteFirst?: boolean;
  freshness?: {
    newSinceLastVisitCount: number;
    updatedSinceLastVisitCount: number;
    lastSeenAt: string | null;
  };
  qualityState?: {
    mode: 'healthy' | 'low_quality' | 'empty';
    reasonCodes: string[];
    suggestedActions: Array<{
      type: 'improve_cv' | 'expand_location' | 'adjust_filters' | 'refresh_preferences';
      label: string;
      route: string;
      impactHint: string | null;
    }>;
  };
  // NEW — explains what location/query the server used
  searchContext?: {
    locationLabel: string;   // e.g. "Accra, Ghana"
    locationSource: EffectiveLocationSource; // see §3.3
    countryCode: string;     // e.g. "GH"
    roleQuery: string;       // role string sent to JSearch
  };
};
```

### 4.4 Per-item shape — `JobListingDto` additions

```ts
type JobListingRanking = {
  score: number;           // 0–100 integer
  tier: 'APPLY_NOW' | 'CONSIDER' | 'LOW_MATCH';
  recommendation: string; // short CTA-style line from server
};

type JobListingExplanation = {
  matchedSkills: string[];   // up to ~12
  missingSkills: string[];   // up to ~10
  riskFactors: string[];       // up to ~5
  seniorityMismatch: 'none' | 'under' | 'over' | 'unknown';
  whyThisJob: string;        // full sentence(s)
  recommendation: string;    // longer guidance
};
```

**Still present (unchanged contract, enriched values):**

```ts
// Short line for cards — now often derived from explanation
whyThisJobShort?: string;
whyThisJobSignals?: string[]; // includes e.g. "tier_apply_now"

// Match preview — version now "v2-ranking" for discovery list
matchPreview?: {
  instantScore: number | null;      // === ranking.score
  instantBand: 'high' | 'medium' | 'low' | null; // maps from tier
  refinedScore: number | null;      // prior JobAnalysis match if any
  refinedReady: boolean;
  refinedEtaMs: number | null;
  version: string | null;           // "v2-ranking"
};

highlight?: {
  isTopMatch: boolean;              // top 3 + APPLY_NOW
  emphasisLevel: 'none' | 'subtle' | 'strong';
  label: string | null;             // e.g. "Apply now"
};
```

**Normalization:** `normalizeJobListingDto` / `normalizeDiscoverJobsResponse` in `src/lib/api.ts` — always consume types from there, not raw axios bodies.

### 4.5 API — `POST /job-discovery/:jobListingId/decision`

**Body:**

```json
{ "decision": "APPLY" | "MAYBE" | "SKIP" }
```

**Response:** upserted Prisma row (id, userId, jobListingId, decision, timestamps). Client wrapper:

```ts
await api.jobDiscovery.recordDecision(jobListingId, 'APPLY');
// → { id: string, decision: string }
```

**Errors:** `404` if listing id unknown. `500` if migration not applied.

**Note:** Backend stores decisions for future personalization; no ranking recalculation in v1. Safe to call fire-and-forget with toast on failure.

### 4.6 `matchPreview.version === 'v2-ranking'` — migration guide for UI

| Old mental model | New behaviour |
|------------------|---------------|
| `instantScore` from debounced AI/heuristic fetch | Discovery list: use **`ranking.score`** as primary; `instantScore` mirrors it |
| Poll/wait for `refinedReady` on list | `refinedScore` = saved analyzer score if exists; optional badge “AI verified” |
| `useJobBoardAiMatch` on card | **Still valid** for user-triggered deep match / quota UX — do not remove unless product says so |

Suggested UI hierarchy on **list cards**:

1. Tier badge from `ranking.tier` (+ optional `ranking.score`%)
2. `explanation.whyThisJob` or `whyThisJobShort` as subtitle
3. Optional: show `matchedSkills` chips (max 3–4)

Suggested **detail panel**:

- Section “Why this job” → `explanation.whyThisJob`
- “Skills you match” → `matchedSkills`
- “Gaps” → `missingSkills`
- “Watch outs” → `riskFactors` (if non-empty)
- Seniority note when `seniorityMismatch !== 'none'`
- Actions: Apply / Maybe / Skip → `recordDecision`

### 4.7 Frontend files already touched

| File | Status |
|------|--------|
| `src/lib/api.ts` | Types, normalizers, `api.location`, `api.jobDiscovery.recordDecision` |
| `src/components/job-board/JobListingCard.tsx` | Tier badges on list |
| `src/lib/resolve-effective-location-client.test.ts` | Location priority test |

---

## 5. What the frontend team still needs to do

### 5.1 Must-do before release

- [ ] **Run migration** on staging/prod (backend); verify decision endpoint.
- [ ] **Job detail panel** — render `explanation` (see §4.6).
- [ ] **Decision buttons** — wire Apply / Maybe / Skip to `api.jobDiscovery.recordDecision`.
- [ ] **`searchContext` banner** on Job Board — e.g. “Showing jobs near Accra, Ghana (from your saved preference)” with link to change location. Data: `discoverQ.data?.searchContext`.
- [ ] **Location filter UX** — when user changes location in filters, call `setSelectedLocation` + `updateMe({ uiPrefs: { jobSearchLocation } })` so server and client stay aligned.
- [ ] **`focusLocation=1` query** — `LocationBootstrap` navigates to `/dashboard/job-board?focusLocation=1` on “Change location”; implement focus/highlight on location input if not already.
- [ ] **QA behind proxy** — `GET /location/resolve` needs correct `X-Forwarded-For` in staging/production.

### 5.2 Should-do / polish

- [ ] Filter/sort jobs client-side only when necessary — **server already sorts by rank**; avoid re-sorting unless you have a explicit “sort by date” product requirement.
- [ ] Analytics events for: location prompt shown/accepted/dismissed; tier impressions; decision clicks.
- [ ] Empty state when `qualityState.mode === 'empty'` — use `suggestedActions` from API.
- [ ] Handle `locationFallback` / `remoteFirst` banners together with `searchContext` (existing banners in `JobBoardContent`).
- [ ] i18n for tier labels and explanation strings (server strings are English today).

### 5.3 Do not break

- Job Hub bookmarks, analyze-start, tailor-start, focus tokens — unchanged routes.
- `useJobBoardAiMatch` — still used for quota + on-demand scoring; coordinate copy so users are not confused by two percentages.
- Guest/unauthenticated paths — location bootstrap only runs when `accessToken` is set (layout gate).

---

## 6. TypeScript quick reference (import from `@/lib/api`)

```ts
import type {
  JobListingDto,
  JobListingRanking,
  JobListingExplanation,
  JobRankingTier,
  DiscoverJobsResponse,
  ResolvedGeoLocationDto,
  UserUiPrefs,
} from '@/lib/api';

import { api } from '@/lib/api';
import { resolveEffectiveLocationClient } from '@/lib/resolve-effective-location-client';
import { useLocationStore } from '@/store/useLocationStore';
```

---

## 7. Example payloads

### 7.1 Discovery item (trimmed)

```json
{
  "id": "clx…",
  "title": "Senior React Developer",
  "company": "Acme",
  "location": "Remote",
  "ranking": {
    "score": 81,
    "tier": "APPLY_NOW",
    "recommendation": "Strong fit — prioritize this application."
  },
  "explanation": {
    "matchedSkills": ["React", "TypeScript", "Next.js"],
    "missingSkills": ["Kotlin"],
    "riskFactors": [],
    "seniorityMismatch": "none",
    "whyThisJob": "Your CV aligns well with React and TypeScript requirements…",
    "recommendation": "Tailor your summary to emphasize lead-level delivery…"
  },
  "matchPreview": {
    "instantScore": 81,
    "instantBand": "high",
    "refinedScore": 76,
    "refinedReady": true,
    "refinedEtaMs": 0,
    "version": "v2-ranking"
  },
  "highlight": {
    "isTopMatch": true,
    "emphasisLevel": "strong",
    "label": "Apply now"
  }
}
```

### 7.2 Discovery response `searchContext`

```json
{
  "searchContext": {
    "locationLabel": "Accra, Ghana",
    "locationSource": "saved_preference",
    "countryCode": "GH",
    "roleQuery": "software engineer"
  }
}
```

---

## 8. Testing checklist

```bash
# Frontend unit test
cd packages/web
npx vitest run src/lib/resolve-effective-location-client.test.ts

# Manual
# 1. New user, no uiPrefs.jobSearchLocation → login → location prompt
# 2. Accept → filter shows city/country, discover returns searchContext
# 3. Cards show tier badges; top jobs sorted by score
# 4. POST decision → 200 (after migration)
# 5. Dismiss prompt → no re-prompt until store cleared (promptDismissedAt)
```

---

## 9. Prompt you can paste to an AI / contractor

> You are working on ApplyMate `packages/web`. Phase 1 added location resolution (`GET /api/location/resolve`), Zustand store `useLocationStore`, and `LocationBootstrap` with a confirmation modal; effective location priority is user override → `uiPrefs.jobSearchLocation` → IP → CV → default (`resolve-effective-location-client.ts`). Phase 2 added server-side job ranking on `GET /api/job-discovery`: each `JobListingDto` may include `ranking` { score, tier, recommendation }, `explanation` { matchedSkills, missingSkills, riskFactors, seniorityMismatch, whyThisJob, recommendation }, and response-level `searchContext`. Tiers: APPLY_NOW ≥78, CONSIDER ≥55, LOW_MATCH otherwise. `matchPreview.version` is `v2-ranking`; `instantScore` equals `ranking.score`. Implement Job Board detail explainability UI and Apply/Maybe/Skip buttons calling `api.jobDiscovery.recordDecision`. Do not remove `useJobBoardAiMatch`. Persist location changes via `api.users.updateMe({ uiPrefs: { jobSearchLocation } })`. Types and normalizers live in `src/lib/api.ts`. Follow existing Job Board components and dark teal design tokens.

---

## 10. Questions / backend contacts

- Ranking weights or thresholds change → `job-ranking.constants.ts` (backend).
- Location provider issues → `IP_GEO_*` env vars, `LocationService`.
- New decision types → requires backend enum + migration.

---

*Document generated for frontend handoff. Update this file when API contracts change.*
