# Backend prompt — follow-up intelligence: company + role for dashboard copy

## Problem

`GET /dashboard/today-plan` drives the **priority notice** (“Follow-up” strip) on the dashboard. The web client builds user-facing copy from **`followUpIntelligence`** when the command bar source is **`follow_up_intelligence`**.

Today, when **`companyName`** and **`jobTitle`** are missing and headline/supporting do not contain parseable employer + role, the UI correctly falls back to:

> It’s been {N} days since you last applied. A short follow-up today could revive this opportunity.

That is **intentionally generic** because the client refuses to show bogus targets such as **“Application submitted 18 days ago”** as if it were a company name.

## Goal

Populate **`followUpIntelligence`** with **stable structured fields** so the dashboard can say, for example:

> It’s been 18 days since you last applied to **{Company}** for the **{Job title}** position. A short follow-up today could revive this opportunity.

…without relying on fragile prose parsing.

## Required payload shape (`followUpIntelligence`)

Extend the existing object (do **not** remove current fields). Add or guarantee:

| Field | Type | Required when | Notes |
|-------|------|-----------------|--------|
| `daysSinceApplication` | integer ≥ 0 | follow-up strip shown | Already used; keep accurate. |
| `companyName` | string | **Whenever** the follow-up refers to a specific employer | Human-readable legal or brand name (e.g. `Stripe`, `Acme Corp`). **Not** a status sentence. |
| `jobTitle` | string | **Whenever** the follow-up refers to a specific opening | Role line only (e.g. `Senior Software Engineer`). **Not** “Application submitted…”. |
| `headline` | string | optional | Short coaching line; may echo the structured sentence but must **not** be the only place company/title live. |
| `supporting` | string | optional | Extra context; same hygiene as headline. |
| `ctaLabel` | string | yes | e.g. `Send follow-up` |
| `ctaHref` | string | yes | Deep link to the application / follow-up composer. |
| `confidence` | number 0–100 | recommended | Unchanged semantics. |
| `reason` | enum string | optional | Unchanged allowed values. |

### Accepted key aliases (if you prefer snake_case in JSON)

The frontend parser also accepts:

- **Company:** `companyName`, `company_name`, `company`, `employerName`, `employer_name`, `organizationName`, `organization_name`
- **Title:** `jobTitle`, `job_title`, `roleTitle`, `role_title`, `positionTitle`, `position_title`

Prefer **`companyName`** + **`jobTitle`** in camelCase for consistency with the rest of today-plan.

## Command bar alignment (`commandBar`)

When you emit **`commandBar`** with:

- `source: "follow_up_intelligence"`

…the dashboard **prefers** to assemble copy from **`followUpIntelligence`** (not from a free-form `message` alone). Therefore:

1. **`followUpIntelligence.companyName`** and **`followUpIntelligence.jobTitle`** must be set whenever `commandBar.source` is follow-up and a concrete application exists.
2. **`commandBar.message`** may still be sent for logging or older clients, but **must not** be the only carrier of company/title if you want the new sentence shape everywhere.

## Forbidden values (treat as bugs if emitted)

Do **not** put these in `companyName`, `jobTitle`, or in prose where the client might scrape them as “company”:

- `Application submitted {N} days ago`
- Any string that is **only** application state / relative time
- Raw IDs (UUID) as the “company” or “title”

If the application record truly has no employer or title in your DB, omit `companyName` / `jobTitle` and expect the generic fallback — that is better than a fake label.

## Copy rules the frontend will apply (for QA)

Given `daysSinceApplication`, `companyName`, `jobTitle`:

| Data | Resulting first sentence (conceptually) |
|------|----------------------------------------|
| company + title | …since you last applied to **Company** for the **Title** position. |
| company only | …since you last applied to **Company**. |
| title only | …since you applied for the **Title** position. |
| neither | …since you last applied. |

Trailing sentence is fixed: **A short follow-up today could revive this opportunity.**

## Acceptance checks

1. Fixture: real application with employer `Globex` and title `Product Designer` → response includes `followUpIntelligence.companyName: "Globex"`, `jobTitle: "Product Designer"`, `daysSinceApplication: 18` → dashboard shows **both** in one sentence (no generic fallback).
2. Fixture: missing employer in DB → omit `companyName`; if `jobTitle` present → title-only sentence; if both missing → generic fallback (acceptable).
3. Regression: never send `companyName: "Application submitted 18 days ago"` — that string is explicitly treated as invalid on the client.

## Reference (frontend)

- Types / parsing: `packages/web/src/lib/today-plan.ts` → `FollowUpIntelligencePayload`, `pickFollowUpIntelligence`
- Sentence assembly: `packages/web/src/lib/dashboardCommandCopy.ts` → `directiveFromFollowUpIntelligence`
- Notice UI: `packages/web/src/components/dashboard/DashboardCommandBar.tsx` (uses structured follow-up when `commandBar.source === "follow_up_intelligence"` and `followUpIntelligence.ctaHref` is present)

Related narrative hygiene: `docs/backend-human-copy-dashboard-prompt.md`
