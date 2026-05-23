# Prompt for backend team — Google sign-in debugging

Copy the section below into Slack/email when Google sign-in fails **after** the user returns from Google (or when testing `POST /api/auth/google` directly).

---

## Context

The web app uses **NextAuth** only for the Google OAuth redirect. Our Next.js server then calls **`POST /api/auth/google`** with the Google **ID token** and expects the same auth envelope as email login.

If the user lands on `/login?error=undefined` or `/login?error=GoogleSignInFailed` **immediately** after clicking “Continue with Google” (without seeing Google’s account picker), that is usually a **frontend/NextAuth/env** issue — not this API. See `docs/backend-handoff-google-auth.md` (Troubleshooting).

If the user **completes Google sign-in** and is then sent back to `/login` with `GoogleAccountExists`, `GoogleRateLimited`, or `GoogleSignInUnavailable`, the frontend **did** call this endpoint — please investigate using the request id from logs.

---

## What we send

```http
POST /api/auth/google
Content-Type: application/json
Accept: application/json

{
  "idToken": "<Google ID token JWT>",
  "name": "Optional",
  "image": "Optional avatar URL"
}
```

Base URL: `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:3000/api/` → full path `http://localhost:3000/api/auth/google`).

---

## What we expect (200)

Same envelope as `POST /api/auth/login`:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "uuid",
      "email": "user@gmail.com",
      "name": "Jane Doe",
      "image": "https://...",
      "onboardingCompleted": false
    }
  },
  "error": null
}
```

We read tokens and `user` from `data` (snake_case variants are normalized on the frontend).

---

## Please verify on your side

1. **`GOOGLE_CLIENT_ID`** in backend `.env` is the **same** OAuth 2.0 Web client ID as the frontend (used to verify token `aud`).
2. **Migration applied**: `googleId` on user, nullable `password`, etc. (`prisma migrate deploy`).
3. **Route live**: `POST /api/auth/google` (not only `/auth/google` without prefix, if you use global prefix `api`).
4. **CORS** allows the Next.js origin if frontend and API are on different hosts/ports.
5. **Logs** for the failing request — include `requestId` from the error JSON if the frontend surfaces it.

---

## Error codes we surface in the UI

| HTTP    | Meaning                                                       | Frontend message            |
| ------- | ------------------------------------------------------------- | --------------------------- |
| **400** | Missing/invalid body, or `GOOGLE_CLIENT_ID` not set on server | Sign-in unavailable         |
| **401** | Token invalid, expired, or wrong audience                     | Google sign-in failed       |
| **409** | Email already registered with password only                   | Use password for this email |
| **429** | Rate limit (same as login)                                    | Wait a minute               |

Error body should match existing API shape: `{ "success": false, "error": { "message": "...", "statusCode": N, "code": "GOOGLE_*" | "RATE_LIMITED" } }`.

Codes: `GOOGLE_SIGNIN_UNAVAILABLE`, `GOOGLE_TOKEN_INVALID`, `GOOGLE_ACCOUNT_EXISTS`, `RATE_LIMITED`.

---

## Quick manual test (backend)

1. Sign in with Google once in the browser (or use a fresh ID token from Google OAuth Playground — same Web client ID).
2. From a terminal:

```bash
curl -sS -X POST "http://localhost:3000/api/auth/google" \
  -H "Content-Type: application/json" \
  -d '{"idToken":"PASTE_ID_TOKEN_HERE"}'
```

3. Expect `success: true` and `data.accessToken` + `data.user.onboardingCompleted`.

If this curl fails, the issue is backend/config before involving the frontend.

---

## What we do **not** need from backend

- NextAuth routes (`/api/auth/callback/google`, etc.) — those run on Next.js only.
- `GOOGLE_CLIENT_SECRET` — frontend/NextAuth only; never send to our API.

---

## Contact

- Handoff spec: `docs/backend-handoff-google-auth.md`
- Swagger tag: **auth** → `POST /auth/google` (when enabled)
