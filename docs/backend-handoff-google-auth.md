# Backend handoff: Google sign-in (`POST /api/auth/google`)

**Status: backend + frontend complete** (contract: `intent`, `GOOGLE_ACCOUNT_NOT_FOUND`, onboarding routing).

NextAuth handles the Google OAuth redirect on the Next.js app. After Google returns an ID token, the finish route calls **`POST /api/auth/google`** and returns the same session as email login.

## Endpoint

```
POST /api/auth/google
Content-Type: application/json
```

### Request body

```json
{
  "idToken": "<Google ID token JWT>",
  "name": "Optional display name from Google profile",
  "image": "Optional avatar URL from Google profile",
  "intent": "login | register"
}
```

- **`intent: "register"`** — create account if new; return tokens + `onboardingCompleted: false` for new users.
- **`intent: "login"`** — only sign in existing Google-linked users; return **404** / `GOOGLE_ACCOUNT_NOT_FOUND` if no account (do not auto-create).

### Success response (200)

Standard API envelope (same as login):

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

Normalized in `packages/web/src/lib/auth-response.ts` (supports snake_case and nested `data`).

### Error codes

| HTTP | Backend `error.code`        | Frontend redirect param   |
| ---- | --------------------------- | ------------------------- |
| 400  | `GOOGLE_SIGNIN_UNAVAILABLE` | `GoogleSignInUnavailable` |
| 401  | `GOOGLE_TOKEN_INVALID`      | `GoogleSignInFailed`      |
| 404  | `GOOGLE_ACCOUNT_NOT_FOUND`  | `GoogleAccountNotFound`   |
| 409  | `GOOGLE_ACCOUNT_EXISTS`     | `GoogleAccountExists`     |
| 429  | `RATE_LIMITED`              | `GoogleRateLimited`       |

Error body: `{ success: false, requestId, error: { statusCode, message, code? } }`.

## Frontend flow

1. **Continue with Google** on `/login` or `/register`.
2. NextAuth → Google → `/api/auth/callback/google`.
3. `GET /api/auth/google/finish` → `POST {API}/auth/google` with `idToken`.
4. Sets `applymate_token` cookie → `/oauth-complete` → `GET /users/me` + `GET /onboarding/status` → `/dashboard` or `/onboarding`.

**Backend prompt (sign-up vs sign-in / onboarding):** [`prompt-backend-google-auth-signup-onboarding.md`](./prompt-backend-google-auth-signup-onboarding.md)

Email/password login unchanged.

## Env

| Variable                           | Notes                                                        |
| ---------------------------------- | ------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`                 | Same on frontend + backend (token `aud`)                     |
| `GOOGLE_CLIENT_SECRET`             | Frontend only (NextAuth)                                     |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Frontend only — **must be the Next.js app URL**, not the API |
| `NEXT_PUBLIC_API_URL`              | Backend base including `/api/`                               |

Google Cloud redirect URI: `{NEXTAUTH_URL or http://localhost:3001}/api/nextauth/callback/google`

### Troubleshooting `OAuthSignin` / `error=undefined`

NextAuth routes run on **Next.js**, not Nest. If `NEXTAUTH_URL` points at the API host, sign-in hits the backend and fails.

1. API on `:3000`, Next on `:3001` → `NEXTAUTH_URL=http://localhost:3001`
2. Google redirect URI must match that port
3. Env vars in **repo root** `.env` (loaded via `packages/web/next.config.ts`)
4. No empty `GOOGLE_*` / `NEXTAUTH_*` in `packages/web/.env` or `.env.local`
5. Restart dev server after env changes

## Key frontend files

| File                                      | Role                               |
| ----------------------------------------- | ---------------------------------- |
| `src/lib/auth-google-exchange.ts`         | Server `POST /auth/google`         |
| `src/lib/google-auth-errors.ts`           | Backend codes → UI messages        |
| `src/lib/api.ts` → `auth.google`          | Client helper                      |
| `src/app/api/auth/google/finish/route.ts` | Cookie + redirect                  |
| `src/app/(auth)/oauth-complete/page.tsx`  | Hydrate user + route by onboarding |

## Incident debugging

Copy [`prompt-backend-google-signin-debug.md`](./prompt-backend-google-signin-debug.md) for backend when finish route reaches the API and fails.

## QA checklist

- [ ] `intent: "register"` creates user with `onboardingCompleted: false` and `onboarding/status.completed: false`
- [ ] `intent: "login"` with unknown Google user → **404** `GOOGLE_ACCOUNT_NOT_FOUND` (no auto-create)
- [ ] New Google account (register) → **onboarding** in browser, API calls work
- [ ] Returning Google user (onboarding done) → **dashboard**
- [ ] `users/me` and `onboarding/status` agree on `completed` / `onboardingCompleted`
- [ ] Same email, password account → **409** / password message
- [ ] Email login still works
- [ ] `GOOGLE_CLIENT_ID` matches frontend OAuth client and backend `.env`
