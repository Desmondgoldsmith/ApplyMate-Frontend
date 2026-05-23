# Prompt for backend team — Google sign-up vs sign-in & onboarding routing

> **Update:** Backend shipped this contract. Frontend sends `intent`, handles `GOOGLE_ACCOUNT_NOT_FOUND` (404), and routes via `/users/me` + `/onboarding/status`. Use this doc for QA only.

**Copy everything below the line into Slack/email/Jira.**

---

## Summary (please read first)

Users report that **“Sign up with Google”** on `/register` signs them in but sends them to the **dashboard** instead of **onboarding**, with empty/shimmer UI (no CV data). That usually means the API is treating every Google OAuth call as “log in an existing user” and/or returning **`onboardingCompleted: true`** (or omitting it) for **brand-new** Google accounts.

The frontend is now wired to send **`intent: "login" | "register"`** on `POST /api/auth/google` and routes post-auth using **`GET /api/onboarding/status`** (`completed`) as the source of truth. **We need backend behavior to match** — see requirements below.

**Contract reference:** `docs/backend-handoff-google-auth.md`

---

## What the frontend sends today

After NextAuth + Google, our Next.js finish route calls:

```http
POST /api/auth/google
Content-Type: application/json
Accept: application/json
```

```json
{
  "idToken": "<Google ID token JWT>",
  "name": "Optional display name",
  "image": "Optional avatar URL",
  "intent": "login"
}
```

or

```json
{
  "idToken": "<Google ID token JWT>",
  "name": "Optional display name",
  "image": "Optional avatar URL",
  "intent": "register"
}
```

| UI                      | Page        | `intent` value |
| ----------------------- | ----------- | -------------- |
| **Sign in with Google** | `/login`    | `"login"`      |
| **Sign up with Google** | `/register` | `"register"`   |

Base URL: `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:3000/api/` → `http://localhost:3000/api/auth/google`).

**Note:** Google’s consent screen always says “Sign in to &lt;domain&gt;” — we cannot change that. Our buttons distinguish sign-up vs sign-in; the API must enforce the difference.

---

## Required backend behavior

### 1. `intent: "register"` (sign-up)

- If **no user** exists for this Google account (`googleId` / verified email):
  - **Create** the user (same as first-time Google sign-in today).
  - Return **200** with tokens + user.
  - Set **`onboardingCompleted: false`** on the user record.
  - Ensure **`GET /api/onboarding/status`** returns **`completed: false`** (and a sensible `step`, e.g. `1`) until the user finishes onboarding in the app.
- If user **already exists** (Google-linked or same email with password-only — existing rules):
  - Return **409** `GOOGLE_ACCOUNT_EXISTS` (or existing behavior) so the UI can tell them to sign in with password / use login flow.

### 2. `intent: "login"` (sign-in only)

- If user **exists** and is Google-linked (or your rules allow Google login for that user):
  - Return **200** with tokens + user.
  - Return accurate **`onboardingCompleted`** (and keep **`GET /api/onboarding/status`** in sync).
- If **no account** exists for this Google identity:
  - **Do not auto-create** a user.
  - Return **404** with:

```json
{
  "success": false,
  "requestId": "<uuid>",
  "error": {
    "statusCode": 404,
    "message": "No account found for this Google email",
    "code": "GOOGLE_ACCOUNT_NOT_FOUND"
  }
}
```

The frontend maps this to: _“We did not find an account for this Google email. Create an account on the sign-up page.”_

### 3. If `intent` is omitted (backward compatibility)

Document chosen behavior (recommend: treat as **`register`** for backward compat, or reject **400** with a clear message). Frontend always sends `intent` in new builds.

---

## Success response (200) — must match email login

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Jane Doe",
      "image": "https://...",
      "onboardingCompleted": false
    }
  },
  "error": null
}
```

**Critical for new Google sign-ups:**

- `data.user.onboardingCompleted` must be **`false`** until onboarding is finished in the app.
- Support **camelCase** `onboardingCompleted` and/or **snake_case** `onboarding_completed` (frontend normalizes both on `/users/me`).

When the user completes onboarding, the app calls **`POST /api/onboarding`** with `completed: true`. After that:

- `GET /api/onboarding/status` → `{ "completed": true, ... }`
- `GET /api/users/me` → `onboardingCompleted: true`

**These two must stay aligned.** If `users/me` says onboarding done but `onboarding/status` says not completed (or vice versa), the user gets sent to the wrong place (dashboard with no data = shimmers).

---

## Error codes (full set frontend handles)

| HTTP    | `error.code`                   | When                                          |
| ------- | ------------------------------ | --------------------------------------------- |
| 400     | `GOOGLE_SIGNIN_UNAVAILABLE`    | Misconfig / missing `GOOGLE_CLIENT_ID` on API |
| 401     | `GOOGLE_TOKEN_INVALID`         | Bad/expired token or wrong `aud`              |
| **404** | **`GOOGLE_ACCOUNT_NOT_FOUND`** | **`intent: "login"`** and no existing account |
| 409     | `GOOGLE_ACCOUNT_EXISTS`        | Email already registered with password only   |
| 429     | `RATE_LIMITED`                 | Same as login rate limit                      |

Standard error envelope:

```json
{
  "success": false,
  "requestId": "uuid",
  "error": {
    "statusCode": 404,
    "message": "Human-readable message",
    "code": "GOOGLE_ACCOUNT_NOT_FOUND"
  }
}
```

---

## How the frontend routes after success

1. `POST /api/auth/google` → sets auth cookie.
2. `/oauth-complete` → `GET /api/users/me` + **`GET /api/onboarding/status`**.
3. If **`onboarding/status.completed !== true`** → **`/onboarding`**.
4. If **`completed === true`** → **`/dashboard`**.

So a new Google user with `onboardingCompleted: true` or `onboarding/status.completed: true` incorrectly set will skip onboarding and hit an empty dashboard.

---

## Reproduction steps (backend QA)

### A. New user — register intent

1. Use a Google account **never used** on ApplyMate.
2. Frontend: `/register` → **Sign up with Google**.
3. Expect:
   - `POST /api/auth/google` body includes `"intent": "register"`.
   - **200**, `onboardingCompleted: false`.
   - `GET /api/onboarding/status` → `completed: false`.
4. User should land on **`/onboarding`** in the browser (frontend).

### B. Same user — login intent

1. `/login` → **Sign in with Google** (same Google account).
2. Expect **200** and tokens.

### C. Login intent — no account

1. New Google account, call API directly:

```bash
curl -sS -X POST "http://localhost:3000/api/auth/google" \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<VALID_ID_TOKEN>","intent":"login"}'
```

2. Expect **404** `GOOGLE_ACCOUNT_NOT_FOUND` (not **200** with a new user).

### D. Register intent — creates user

```bash
curl -sS -X POST "http://localhost:3000/api/auth/google" \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<VALID_ID_TOKEN>","intent":"register"}'
```

Expect **200**, new user, `onboardingCompleted: false`.

### E. Config sanity

- **`GOOGLE_CLIENT_ID`** on API = same OAuth **Web client** as frontend (verify JWT `aud`).
- `prisma migrate deploy` applied (`googleId`, nullable password, etc.).

---

## Likely root cause of the reported bug

One or more of:

1. **`POST /api/auth/google` ignores `intent`** and always upserts/creates → register and login behave the same.
2. **New users get `onboardingCompleted: true`** by default in DB or in the auth response.
3. **`GET /api/onboarding/status`** returns `completed: true` for users who never finished onboarding.
4. **`GET /api/users/me`** does not expose `onboardingCompleted` / `onboarding_completed` correctly after Google auth.

Please fix and confirm with the QA steps above. Include **`requestId`** from failing responses in your reply.

---

## Out of scope for backend

- NextAuth routes (`/api/auth/callback/google`, etc.) — run on Next.js only.
- `GOOGLE_CLIENT_SECRET` — never sent to the API.
- Google Cloud redirect URI configuration (frontend/DevOps) — must be `{NEXTAUTH_URL}/api/auth/callback/google`.

---

## Related docs

- `docs/backend-handoff-google-auth.md` — full contract
- `docs/prompt-backend-google-signin-debug.md` — token/env/401 debugging
- `docs/prompt-backend-google-signin-fix.md` — finish-route / API reachability
