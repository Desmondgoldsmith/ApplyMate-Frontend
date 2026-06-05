# Backend response — Product tour (dashboard)

**Date:** 2026-06-05  
**Status:** Confirmed and hardened

---

## Summary for frontend

The backend **already supported** product tour gates. This pass adds:

1. **Explicit `uiPrefs.tourCompleted: false`** on `GET/PATCH /users/me` when unset (was `null` uiPrefs).
2. **Snake_case aliases** on `/users/me`: `onboarding_completed`, `ui_prefs.tour_completed`.
3. **On onboarding complete** (`POST /onboarding` with `completed: true`): sets `onboardingCompleted: true` and **`tourCompleted: false`** atomically.

No tour steps API, no new endpoints.

---

## Gates the frontend checks

| Gate | Backend field | Endpoint |
|------|---------------|----------|
| Onboarding done | `onboardingCompleted` / `onboarding_completed` | `GET /api/users/me`, auth user object |
| Tour not finished | `uiPrefs.tourCompleted === false` (or absent → now **false**) | `GET /api/users/me` |
| Mark tour done | `PATCH /api/users/me` `{ "tourCompleted": true }` | Persists to `User.uiPrefs` |

---

## `GET /api/users/me` (after fix)

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "onboardingCompleted": true,
  "onboarding_completed": true,
  "uiPrefs": {
    "tourCompleted": false,
    "jobSearchLocation": "London, UK"
  },
  "ui_prefs": {
    "tourCompleted": false,
    "tour_completed": false,
    "jobSearchLocation": "London, UK"
  }
}
```

After user finishes tour:

```http
PATCH /api/users/me
{ "tourCompleted": true }
```

→ `uiPrefs.tourCompleted: true` on next GET.

Also accepts nested patch:

```json
{ "uiPrefs": { "tourCompleted": true } }
```

---

## New user / signup

- `User.onboardingCompleted` defaults to **`false`** (Prisma).
- `User.uiPrefs` defaults to **`null`** — API returns **`tourCompleted: false`** explicitly.
- **Never** seeds `tourCompleted: true` on register, Google sign-up, or onboarding start.

---

## Onboarding completion

`POST /api/onboarding` with `{ "completed": true, … }`:

- Sets `User.onboardingCompleted = true`
- Merges session fields (`selectedFeatures`, `primaryGoal`, etc.)
- Sets **`uiPrefs.tourCompleted = false`** (fresh tour for new accounts)

`GET /api/onboarding/status` → `{ "completed": true }` when `User.onboardingCompleted` is true (unchanged).

---

## Auth payloads (login / register / Google)

Auth responses include **`user.onboardingCompleted`** only (no `uiPrefs`).  
Dashboard should **`GET /users/me`** for tour flags (as your handoff specifies).

---

## QA checklist (backend)

| # | Step | Expected |
|---|------|----------|
| 1 | New user → `GET /users/me` | `onboardingCompleted: false`, `uiPrefs.tourCompleted: false` |
| 2 | Complete onboarding | `onboardingCompleted: true`, `tourCompleted: false` |
| 3 | `GET /onboarding/status` | `completed: true` |
| 4 | `PATCH /me` `{ tourCompleted: true }` | `uiPrefs.tourCompleted: true` |
| 5 | Next `GET /me` | tour stays completed |

---

## Code touchpoints

| File | Change |
|------|--------|
| `src/modules/users/serialize-user-me.ts` | Normalize uiPrefs + snake_case aliases |
| `src/modules/users/users.controller.ts` | Use serializer on GET/PATCH `/me` |
| `src/modules/onboarding/onboarding.service.ts` | Reset `tourCompleted: false` on complete |
| `src/modules/users/users.service.ts` | PATCH merge (unchanged) |
| `prisma/schema.prisma` | `uiPrefs Json?`, `onboardingCompleted Boolean` |

---

## What we did *not* build

- Tour step definitions
- Per-route tour state
- Server-driven tour progress

Tour remains **100% client-driven** (driver.js); backend only exposes durable user flags.
