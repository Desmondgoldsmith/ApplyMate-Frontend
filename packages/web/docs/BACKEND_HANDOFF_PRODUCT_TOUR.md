# Backend handoff — Product tour (dashboard)

**Frontend:** Global dashboard tour (driver.js) runs once after onboarding on `/dashboard`.  
**Status (2026-06-04):** Tour did not appear for new users due to a **frontend** bug (missing `data-tour="todays-plan"` on the live dashboard). That is fixed. Backend must still expose correct user flags or the tour will stay blocked.

---

## When the frontend shows the tour

All of the following must be true:

| Gate | Source |
|------|--------|
| User is on `/dashboard` | Routing |
| `user.id` present | `GET /api/users/me` (or auth login payload) |
| Onboarding finished | `onboardingCompleted === true` on user **or** optimistic client state after wizard |
| Tour not finished | See below |

Tour does **not** run on Job Analyzer, CV Clinic, Job Hub, etc. (single global tour only).

---

## Backend fields the frontend reads

### 1. `onboardingCompleted` (required)

**Endpoints:** `GET /api/users/me`, login/register/OAuth user object, ideally `PATCH`/`POST` onboarding completion.

```json
{
  "onboardingCompleted": true
}
```

Snake case `onboarding_completed` is also accepted.

**When to set `true`:** When the user finishes the onboarding wizard (`POST /onboarding` with `completed: true`). Must persist on the user row and be returned on the next `GET /users/me`.

**If missing or `false` after onboarding:** User lands on `/dashboard` but the tour never starts.

**Cross-check:** `GET /onboarding/status` should return `{ "completed": true }` in sync with the user record (login flow already uses this as a fallback).

---

### 2. `uiPrefs.tourCompleted` (must NOT be true for new users)

**Endpoint:** `GET /api/users/me` → `uiPrefs.tourCompleted` (or `ui_prefs.tour_completed`).

```json
{
  "uiPrefs": {
    "tourCompleted": false
  }
}
```

**If `true` for a brand-new account:** Frontend treats the product tour as already done and **never** shows it.

**When to set `true`:** Only after the user completes or skips the tour. Frontend calls:

```http
PATCH /api/users/me
{ "tourCompleted": true }
```

when the user finishes the last step (confetti). Skipping only sets **localStorage** unless you also want server sync on skip (optional; not required today).

**Do not** default `tourCompleted: true` on signup or seed data.

---

## Local-only flags (no backend)

Frontend also uses (no API):

- `applymate:tour:v1:completed`
- `applymate:tour:v1:skipped`

Legacy keys `applymate:tour:dashboard:*` etc. are treated as completed for migration.

Users can reset via **Settings → Features → Restart product tour**.

---

## What backend does *not* need to build

- No new tour API or tour step payloads
- No per-page tour endpoints
- No WebSocket / job for tour

The tour is entirely client-driven; backend only supplies accurate **user state**.

---

## Verification checklist (backend QA)

1. Create a fresh user → complete onboarding → `GET /users/me`:
   - `onboardingCompleted: true`
   - `uiPrefs.tourCompleted` absent or `false`
2. Open `/dashboard` in a clean browser profile → tour should start ~1.2s after load.
3. Complete tour → `PATCH /me` with `tourCompleted: true` → subsequent visits: no tour.
4. New user with `uiPrefs.tourCompleted: true` → tour must **not** show (confirms flag works).

---

## Optional improvement (nice to have)

On `POST /onboarding` with `completed: true`, atomically:

- set `onboarding_completed = true`
- ensure `ui_prefs.tour_completed` is `false` or unset

This avoids drift between onboarding status and `/users/me`.

---

## Frontend contact

Tour code: `packages/web/src/components/onboarding/FeatureTour.tsx`, `featureTourStorage.ts`, `featureTourDefinitions.ts`.  
Mount point: `DashboardShell` (all dashboard routes).
