# Backend handoff — Daily “next moves,” stalled-job intelligence, and return hooks

**Audience:** Backend / platform team  
**Goal:** Power a **unified “what to do today”** experience, **rule-based stalled-job signals**, and **credible re-engagement** (email/push) so the product feels **smarter and more helpful** without relying on opaque LLM calls for core logic.

**Product north star (one sentence):** After login, the user should see **one prioritized list** of *new opportunities*, *pipeline items that need attention*, and *due follow-ups* — with **explainable** reasons and **suggested next actions**.

---

## 1. Why the backend is involved

- The web app can **compose** some of this from existing endpoints, but **staleness**, **ranking**, **notification triggers**, and **cross-entity “due today”** are better **server-owned** so:
  - Mobile / future clients get the same truth.
  - **Email / push** can fire from **one** place.
  - Rules stay **auditable** (for support and trust).

---

## 2. Pillar A — Stalled-job intelligence (rules, not magic)

**User-facing idea:** “This job hasn’t moved in *N* days” + a **short reason** + **1–3 suggested actions** (e.g. set follow-up reminder, draft follow-up email context, move stage, flag “waiting on employer”).

### 2.1 Suggested server-side outputs (per tracked entity)

Attach to entities you already expose to the hub pipeline (at minimum **Application**, **JobAnalysis**, **HubBookmark** as relevant):

| Field | Purpose |
|--------|---------|
| `stalled` | boolean |
| `stallSince` | ISO timestamp — first day we consider “no meaningful movement” (define rule set below) |
| `stallReasonCodes` | string[] — machine-readable (see §2.3) |
| `suggestedActions` | discriminated union or enum list — **deterministic** CTAs the client can route |

### 2.2 Example rules (initial set — product can tune thresholds)

Implement as **configuration** (constants / remote config) where possible:

1. **Applied, no interview signal for X days** → stall reason `NO_PROGRESS_AFTER_APPLY`; suggest `SET_REMINDER`, `DRAFT_FOLLOW_UP`, optionally `MOVE_STAGE` if product maps withdrawn/rejected.
2. **Saved / analyzed, never applied or bookmark inactive for X days** → `LONG_DWELL_PRE_APPLY`; suggest `OPEN_TAILOR`, `OPEN_JOB_HUB`.
3. **Interviewing stage with no update for X days** → `INTERVIEW_STALLED`; suggest `SET_REMINDER`, `DRAFT_FOLLOW_UP`.
4. **High match / strong fit** (if score exists) **but no tailor / low engagement** → `HIGH_FIT_LOW_ACTION`; suggest `OPEN_TAILOR`.

**Important:** Each rule should log **which inputs** fired (dates, stage, presence of reminders) so support can explain “why am I seeing this?”

### 2.3 Reason codes (starter catalog — align with analytics)

Examples: `NO_PROGRESS_AFTER_APPLY`, `LONG_DWELL_PRE_APPLY`, `INTERVIEW_STALLED`, `HIGH_FIT_LOW_ACTION`, `REMINDER_OVERDUE_AGGREGATE`.  
Frontend Today’s Plan already uses **reason codes** in places — **reuse naming** where overlap exists.

---

## 3. Pillar B — Unified “next moves” feed (optional composite API)

**Option 1 — Prefer composition (minimal backend change):**  
Document that the web app calls existing endpoints (`GET /api/dashboard/today-plan`, `GET /api/jobs/history`, applications list, `GET /api/jobs/hub-reminders`, discovery) and **only** needs **stall fields** from §2.

**Option 2 — Single aggregate endpoint (recommended for consistency + notifications parity):**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/dashboard/next-moves` | Single ranked feed for “today” |

**Suggested response shape (illustrative — refine with OpenAPI):**

- `generatedAt`, `timezone`, `digestVersion` (same spirit as today-plan for freshness).
- `sections[]` or flat `items[]` each with:
  - `kind`: `NEW_MATCH` | `STALLED_JOB` | `DUE_REMINDER` | `TODAY_PLAN_ACTION` | …
  - `priority` / `rank` (integer)
  - `title`, `subtitle`
  - `reasonCodes[]`
  - `cta`: `{ type: OPEN_JOB_HUB | OPEN_JOB_ANALYZE | OPEN_TAILOR | OPEN_DISCOVERY | …, ids… }` aligned with existing Today’s Plan CTA contract.
  - `sourceRefs`: `{ applicationId?, jobAnalysisId?, bookmarkId?, jobListingId? }`

**Caching:** Same philosophy as Today’s Plan — **invalidate** this aggregate when stages, bookmarks, analyses, applications, or hub reminders change (you may already invalidate today-plan on those mutations).

---

## 4. Pillar C — Return hooks (email + push)

**Goal:** Meaningful re-engagement, not spam.

### 4.1 Triggers (MVP)

1. **Hub reminder due** (CRM reminders from `/api/jobs/hub-reminders`, not application email reminders).
2. **Digest:** “N new listings matching your CV + location” (if discovery supports cheap counts — optional).
3. **Weekly stall summary** (optional): “You have K jobs with no update in 14 days” with deep link to `/dashboard/jobs` or next-moves.

### 4.2 User controls (required for trust)

- Per-channel opt-in: email vs push.
- **Quiet hours** (optional MVP: timezone only).
- Frequency cap (e.g. max N non-transactional emails per week).
- Unsubscribe / pause (“pause nudges for 7 days”) — product wants **forgiving** tone; backend should support **pause** state.

### 4.3 Implementation notes

- Prefer **idempotent** sends (dedupe by `userId + reminderId + date`).
- **Transactional** vs **marketing** classification for compliance.

---

## 5. Pillar D — Trust / “speed” claims (FYI)

Real **apply acceleration** (extension/autofill) is mostly client + partner work. Backend may later need **secure credential/session** patterns — **out of scope** for this handoff unless product commits to an ATS integration.

**Backend ask:** avoid blocking Pillars A–C on extension work.

---

## 6. Acceptance criteria (MVP)

1. **Stall signals** are exposed on **list or detail** payloads the hub already consumes **or** documented fields on `GET …/next-moves`.
2. **Reason codes + suggested actions** are stable enough for **frontend routing** and **analytics**.
3. **Hub reminder due** can trigger **at least email OR push** with user preference respected.
4. **Invalidation:** changing stage / bookmark / reminder updates **next-moves** and **today-plan** freshness within one refresh cycle (align with existing cache invalidation story).

---

## 7. Open questions for backend

1. Single **`/dashboard/next-moves`** vs **enrich existing** `today-plan` — which fits your cache and ownership model?
2. Where should **stall rules** live — **read-time computed** vs **nightly job** writing flags?
3. **Notification** delivery: existing provider vs new queue; **template** ownership (product copy).
4. **Privacy:** stall summaries in email — **minimum PII** (titles optional, company optional).

---

## 8. References (frontend context)

- Today’s Plan: `GET /api/dashboard/today-plan` — CTA routing uses discriminated `action.type` (no `cta.href` in schema).
- Hub pipeline + reminders are already integrated on web; see repo audit **`docs/applymate-job-flows-audit.md` §10**.

---

*This handoff is intentionally **rules-first** and **explainable**. LLM features can layer on later; they should not block the MVP.*
