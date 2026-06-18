# Backend handoff — Dashboard UX overhaul (sections, copy, stale jobs, timelines)

**Date:** 2026-06-03 (backend done 2026-06-09; frontend integrated 2026-06-09)  
**Frontend status:** ✅ Integrated per backend handoff (2026-06-09)  
**Backend status:** ✅ Done (2026-06-09)  
**Primary API:** `GET /dashboard/today-plan` (+ job/application detail payloads used by Job Hub)

---

## Summary for backend team

The dashboard home page needs **server-authored structure and copy** so the frontend can:

1. Show sections in a fixed order with **active vs stale (21+ days)** jobs separated.
2. Display **human-readable labels** (not internal product terms like “Career momentum”).
3. Show **accurate relative timestamps** on every actionable row.
4. Cap the home page at **2 items per section** with “View all” deep links (frontend will build list pages once payloads are stable).
5. Replace generic follow-up copy (“Application submitted 48 days ago…”) with **actionable coaching** and deep links that open Job Hub on the **email template** tab with the correct template pre-selected.
6. Surface a **stale-application notice** anywhere a job/application is opened after 21+ days with no employer reply.

**Do not** rely on the frontend to infer stale state, rewrite coaching copy, or merge/split focus queues — that logic belongs in today-plan and application APIs.

---

## Frontend fix already shipped (no backend action)

### Dashboard stuck on shimmer after navigation

**Cause:** A loading gate used React Query `isFetchedAfterMount`. On client-side return to `/dashboard`, cached today-plan data was still “fresh” (`staleTime: 60s`), so no refetch ran, `isFetchedAfterMount` stayed `false`, and the main column never left the skeleton state (15–60+ seconds).

**Fix:** Gate only on `isBootstrapping || todayPlan.isPending` (no cached data yet). Warm cache now renders immediately on navigation.

---

## 1. Section order on dashboard home

After the **five stat cards** (vitals row), the frontend will render sections in this **fixed order**:

| Order | Section | Show when |
|------:|---------|-----------|
| 1 | **Pick up where you left off** | `continuationItems.length > 0` |
| 2 | **Latest activity** (interviews, pending results, interview prep) | `upcomingInterviews`, interview banners, or `interviewPreparationCards` |
| 3 | **Recommended move** | `recommendedMove` / strategic recommendation resolved |
| 4 | **Your focus** | Active focus items only (see §2) |
| 5 | **Quiet applications** (new) | Stale items only — 21+ days no update (see §2) |

Everything else (pipeline summary, CV teaser, growth, etc.) stays **below** this execution stack.

**Backend action:** None for ordering itself — frontend owns layout once payloads are split. Backend **must** stop mixing stale jobs into `focusItems`.

---

## 2. Split active focus vs stale (21+ day) applications

### Problem today

- Jobs with no updates for **21+ days** appear inside **`focusItems`** / “Your tasks”.
- Frontend also runs a **client-side** archive nudge (`DashboardStaleArchiveNudgeCards`) from `GET /applications` — duplicated, inconsistent copy, and merged into focus UI.

### Required contract

Add a **separate queue** on today-plan (name suggestion: `staleApplicationItems` or `quietApplicationItems`).

```typescript
type DashboardStaleApplicationItemPayload = {
  id: string; // stable row id
  applicationId: string;
  jobAnalysisId?: string | null;
  jobTitle: string;
  company: string;
  /** ISO-8601 — last meaningful pipeline event (status change, note, email, interview). */
  lastActivityAt: string;
  /** Pre-formatted for accessibility, e.g. "22 days ago" — frontend may also format from ISO. */
  lastActivityLabel: string;
  daysSinceActivity: number; // >= 21
  /** Human coaching — see §5 */
  headline: string;
  supporting: string;
  /** Primary CTA */
  ctaLabel: string; // e.g. "Send follow-up" | "Archive job"
  ctaHref: string;  // canonical Job Hub deep link — see §6
  /** Secondary CTA optional */
  secondaryCtaLabel?: string | null; // e.g. "Archive instead"
  secondaryCtaHref?: string | null;
  priority: number;
};
```

**Rules:**

| Rule | Detail |
|------|--------|
| Threshold | **21 days** (3 weeks) since last activity **after application submitted** with **no employer reply** |
| Exclude | `rejected`, `withdrawn`, `archived`, `offer_received`, `accepted`, `ghosted` (terminal states) |
| `focusItems` | Must **exclude** all rows that belong in `staleApplicationItems` |
| Section title | Provide `normalizedSectionTitles.quiet_applications` (suggested: **“Applications going quiet”** or **“Time to follow up or archive”**) |
| Empty state | When queue empty, omit array or send `[]` — frontend hides section |

**Dashboard snapshot cap:** Return **max 2** items in `staleApplicationItems` on the home snapshot. Add:

```json
{
  "staleApplicationItems": [ /* max 2 */ ],
  "staleApplicationItemsTotalCount": 7,
  "staleApplicationItemsViewAllHref": "/dashboard/quiet-applications"
}
```

Frontend will add `/dashboard/quiet-applications` list page (same pattern as `/dashboard/focus`, `/dashboard/continuation`).

---

## 3. Human-readable labels (stats row + sections)

### Problem today

Users still see internal terms:

- “Career momentum”
- “Predictive outlook”

Frontend fallbacks are already human-friendly when backend titles are missing:

| Section key (`normalizedSectionTitles`) | Required user-facing title |
|----------------------------------------|----------------------------|
| `career_momentum` | **Search momentum** |
| `predictive_outlook` | **Where your search is heading** |
| `best_match` | **Best match** |
| `applications` | **Applications in progress** |
| `consistency` | **Daily streak** |
| `focus` | **Your focus** |
| `continuation` | **Pick up where you left off** |
| `recommended_move` | **Recommended move** |
| `quiet_applications` | **Applications going quiet** (new) |

**Backend action:**

1. Populate `normalizedSectionTitles` with the table above (sentence case, no jargon).
2. Ensure `dashboardVitals.careerMomentum.label` and `dashboardVitals.interviewOutlook.label` are **supporting lines**, not duplicates of the tile title (frontend hides redundant label text).
3. Stop emitting product codenames in `headline`, `supporting`, `description` fields shown on the home page.

---

## 4. Relative timestamps on every actionable row

### Problem today

Continuation rows can show `lastActiveLabel`, but focus items, recommended move, stale jobs, and follow-up coaching often lack a consistent “how long ago” line. Users cannot tell if a CV draft was touched **10 minutes** or **3 days** ago.

### Required fields (all queues)

Add ISO timestamp + optional preformatted label on **every** home-page row type:

| Queue | Fields to add / enforce |
|-------|-------------------------|
| `continuationItems` | `lastActiveAt` (ISO, required for sort), `lastActiveLabel` (e.g. `"2 hours ago"`) |
| `focusItems` | `lastActivityAt`, `lastActivityLabel` |
| `staleApplicationItems` | `lastActivityAt`, `lastActivityLabel`, `daysSinceActivity` |
| `upcomingInterviews` | Already has `lastUpdatedAt` — also send `lastUpdatedLabel` |
| `interviewPreparationCards` | `lastActivityAt`, `lastActivityLabel` |
| Recommended move | `generatedAt` or `relevantActivityAt` + label on strategic recommendation payload |

**Formatting rules (backend or shared contract):**

- &lt; 1 hour → `"N min ago"`
- &lt; 48 hours → `"N hours ago"`
- &lt; 14 days → `"N days ago"`
- else → locale date string

Frontend will use `lastActivityAt` for sort and display `lastActivityLabel` when present (same pattern as continuation).

---

## 5. Smart coaching copy for stale / follow-up jobs

### Problem today (user-visible)

```
Application submitted 48 days ago

This thread has been quiet long enough that a polite follow-up may help bring your application back to attention.
```

Issues:

- **“Application submitted”** is a system status, not a job/company name.
- Copy does not tell the user **what to do** (archive vs follow-up).
- No deep link to generate a follow-up email.

### Required behavior

For applications **≥ 21 days** since submit with **no employer reply**:

**Headline (example):**

> No word from **{Company}** in **{N} days**

**Supporting (example):**

> If you have not heard back on **{Job title}**, send a short follow-up or archive it so your dashboard stays focused on active roles.

**CTAs:**

| CTA | Label | When |
|-----|-------|------|
| Primary | `Send follow-up` | Default when follow-up is appropriate |
| Secondary | `Archive job` | Always available |

**Do not:**

- Use `"Application submitted X days ago"` as the job/company substitute in narrative copy.
- Emit generic “quiet long enough” text without naming company + role.
- Put stale jobs in `focusItems` with follow-up copy that omits actionable CTAs.

### Follow-up intelligence / command bar

Apply the same rules to:

- `followUpIntelligence`
- `followUpJobs[]`
- `strategicRecommendation` when `category === 'follow_up'`
- Any `focusItems` with `type: 'follow_up'`

Include real **`companyName`**, **`jobTitle`**, **`daysSinceLastActivity`**, and stage-aware wording (only say “applied” when `stage === 'submitted'`).

---

## 6. Deep links — Job Hub + email template tab

When the user taps **Send follow-up**, the frontend will open Job Hub with:

```
/dashboard/jobs?applicationId={id}&tab=email-templates&template=follow-up-no-response
```

(Also accepts `jobId` / `jobAnalysisId` when `applicationId` is absent.)

Frontend alias map (`jobHubEmailTemplates.ts`):

| Query `template` | API `templateType` |
|------------------|-------------------|
| `follow-up-no-response` | `follow_up_after_silence` |

**Backend action:** Set `ctaHref` on stale/follow-up rows to the canonical URL above. Do not rely on frontend to inject query params.

**Archive CTA:** `ctaHref` → Job Hub or archive mutation endpoint; if archive is inline, use `POST /applications/:id/archive` and invalidate today-plan.

---

## 7. Stale notice on Job Hub / job detail surfaces

Whenever the user opens a job/application that meets the **21-day stale** rule, the detail payload should include:

```typescript
type StaleApplicationNoticePayload = {
  show: boolean;
  daysSinceActivity: number;
  headline: string;    // e.g. "No updates in 24 days"
  supporting: string;  // archive vs follow-up guidance
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
};
```

**Suggested endpoints:**

- `GET /applications/:id` (or merged Job Hub bootstrap payload)
- `GET /jobs/history` items (optional `staleNotice` per row)

Frontend will render a calm banner (not blocking) at the top of Job Hub detail — **only when `show: true`**.

---

## 8. Home page density — max 2 items per section

Frontend will cap display at **2 items** per section on the dashboard home. Backend should:

| Field | Cap on home snapshot | Total count field | View-all href |
|-------|---------------------|-------------------|---------------|
| `continuationItems` | 2 | `continuationCount` (existing) | `/dashboard/continuation` (existing) |
| `focusItems` | 2 | `focusItemsTotalCount` (new) | `/dashboard/focus` (existing) |
| `staleApplicationItems` | 2 | `staleApplicationItemsTotalCount` (new) | `/dashboard/quiet-applications` (new) |
| `upcomingInterviews` | 2 | `upcomingInterviewCount` (existing) | existing interviews routes |
| `followUpJobs` | 2 | `followUpJobsTotalCount` (existing) | existing |

Return items **already sorted** by priority/recency. Frontend will not re-rank beyond defensive dedupe.

---

## 9. `GET /dashboard/today-plan` — example shape (illustrative)

```json
{
  "normalizedSectionTitles": {
    "career_momentum": "Search momentum",
    "predictive_outlook": "Where your search is heading",
    "best_match": "Best match",
    "applications": "Applications in progress",
    "consistency": "Daily streak",
    "continuation": "Pick up where you left off",
    "recommended_move": "Recommended move",
    "focus": "Your focus",
    "quiet_applications": "Applications going quiet"
  },
  "dashboardVitals": { "...": "unchanged structure; human labels only" },
  "continuationItems": [
    {
      "id": "cont-cv-1",
      "type": "cv",
      "title": "Finish your Software Engineer CV",
      "description": "Summary and skills still need polish.",
      "lastActiveAt": "2026-06-03T09:12:00.000Z",
      "lastActiveLabel": "45 min ago",
      "ctaLabel": "Continue CV",
      "ctaHref": "/dashboard/cv?profileId=..."
    }
  ],
  "continuationCount": 4,
  "focusItems": [
    {
      "id": "focus-1",
      "type": "opportunity",
      "priority": 1,
      "urgency": "high",
      "title": "Strong match: Senior Frontend Engineer",
      "description": "92% fit — tailor your CV before applying.",
      "lastActivityAt": "2026-06-02T14:00:00.000Z",
      "lastActivityLabel": "1 day ago",
      "ctaLabel": "Review match",
      "ctaHref": "/dashboard/jobs/analyze?jobId=..."
    }
  ],
  "focusItemsTotalCount": 5,
  "staleApplicationItems": [
    {
      "id": "stale-1",
      "applicationId": "app-uuid",
      "jobTitle": "Front-End Engineer",
      "company": "Himalayas",
      "lastActivityAt": "2026-04-10T10:00:00.000Z",
      "lastActivityLabel": "24 days ago",
      "daysSinceActivity": 24,
      "headline": "No word from Himalayas in 24 days",
      "supporting": "If you have not heard back on Front-End Engineer, send a short follow-up or archive it.",
      "ctaLabel": "Send follow-up",
      "ctaHref": "/dashboard/jobs?applicationId=app-uuid&tab=email-templates&template=follow-up-no-response",
      "secondaryCtaLabel": "Archive job",
      "secondaryCtaHref": "/dashboard/jobs?applicationId=app-uuid&focus=archive",
      "priority": 1
    }
  ],
  "staleApplicationItemsTotalCount": 3,
  "staleApplicationItemsViewAllHref": "/dashboard/quiet-applications"
}
```

---

## 10. Acceptance criteria (backend)

- [ ] `normalizedSectionTitles` uses human labels; no “Career momentum” / “Predictive outlook” in user-visible titles.
- [ ] Stale applications (≥ 21 days, no reply) are **only** in `staleApplicationItems`, never in `focusItems`.
- [ ] Every continuation/focus/stale row includes `lastActivityAt` + `lastActivityLabel`.
- [ ] Follow-up/stale copy names **company + role**; never uses “Application submitted X days ago” as the target name.
- [ ] Follow-up CTA deep links include `tab=email-templates&template=follow-up-no-response`.
- [ ] Home snapshot returns **max 2** items per queue + total counts + view-all hrefs.
- [ ] Job/application detail includes `staleApplicationNotice` when applicable.
- [ ] After changes, `GET /dashboard/today-plan` validates against existing OpenAPI/DTO tests.

---

## 11. Frontend integration (completed 2026-06-09)

1. ✅ Removed client-side stale nudge merge from `TodaysPlanSection` — `QuietApplicationsSection` uses server `staleApplicationItems`.
2. ✅ Section order: continuation → interview activity → recommended move → focus → quiet applications.
3. ✅ Home caps at **2 items** per execution section; `/dashboard/quiet-applications` list page (search + card/table views).
4. ✅ `lastActivityLabel` on focus rows; `lastUpdatedLabel` on upcoming interviews; `relevantActivityLabel` on recommended move.
5. ✅ Job Hub `StaleApplicationNoticeBanner` from `GET /applications/:id`.
6. ✅ Route normalization for `/dashboard/jobs/{applicationId}` deep links.
7. ⏳ `dashboardCommandCopy` sanitizers retained as defense-in-depth until QA confirms backend copy is clean everywhere.

---

## 12. Return handoff format

When complete, please return a short doc with:

1. DTO field names as implemented (if different from above).
2. Sample `GET /dashboard/today-plan` JSON from staging.
3. Stale detection rules (exact timestamps/statuses used).
4. Which endpoints expose `staleApplicationNotice`.
5. Any feature flags or migration notes.

Frontend will integrate from that doc.

---

## References (frontend)

| Area | Path |
|------|------|
| Dashboard orchestrator | `packages/web/src/components/dashboard/overview/DashboardOverviewContent.tsx` |
| Focus merge (legacy) | `packages/web/src/lib/dashboardFocusMerge.ts` |
| Client stale nudge (to retire) | `packages/web/src/lib/dashboardStaleApplicationNudges.ts` |
| Job Hub template deep links | `packages/web/src/app/(dashboard)/dashboard/jobs/jobHubEmailTemplates.ts` |
| Today-plan types | `packages/web/src/lib/today-plan.ts` |
| Follow-up copy sanitizers | `packages/web/src/lib/dashboardCommandCopy.ts` |
