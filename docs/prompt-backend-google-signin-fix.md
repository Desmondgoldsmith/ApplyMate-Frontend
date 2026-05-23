# Backend prompt — Google sign-in returns 401 / fails after Google account picker

**When to use this:** The user completes Google’s account screen, then lands on `/login` with an error. Frontend diagnostics show `googleAuthConfigured: true` and `/api/auth/providers` includes `"google"`. The failure happens on **`POST /api/auth/google`**.

**When this is NOT a backend issue:** `/api/auth/providers` is `{}`, or `/api/auth/google/status` shows `googleAuthConfigured: false` — fix frontend env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3001`) and restart `npm run dev`.

---

## What the frontend does

1. NextAuth (Next.js on port **3001**) completes Google OAuth.
2. `GET /api/auth/google/finish` reads the Google **ID token** from the NextAuth JWT cookie.
3. Server-side `fetch` to **`POST {API}/auth/google`** with body:

```json
{
  "idToken": "<Google ID token JWT>",
  "name": "optional",
  "image": "optional"
}
```

`NEXT_PUBLIC_API_URL` example: `http://localhost:3000/api/` → full URL `http://localhost:3000/api/auth/google`.

4. On **200**, frontend sets `applymate_token` and redirects to `/oauth-complete`.

---

## What we need from backend (200)

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

---

## Errors we map in the UI

| HTTP | `error.code`                | User sees                   |
| ---- | --------------------------- | --------------------------- |
| 400  | `GOOGLE_SIGNIN_UNAVAILABLE` | Sign-in unavailable         |
| 401  | `GOOGLE_TOKEN_INVALID`      | Google sign-in failed       |
| 409  | `GOOGLE_ACCOUNT_EXISTS`     | Use password for this email |
| 429  | `RATE_LIMITED`              | Wait and retry              |

Error shape:

```json
{
  "success": false,
  "requestId": "uuid",
  "error": {
    "statusCode": 401,
    "message": "Google token verification failed",
    "code": "GOOGLE_TOKEN_INVALID"
  }
}
```

---

## Checklist (most common production failures)

1. **`GOOGLE_CLIENT_ID` on the API** must be the **same** OAuth 2.0 **Web client** ID as the frontend / NextAuth (token `aud` must match).
   - Frontend client ID (example): check Vercel env + repo root `.env`.
   - Backend `.env` must not use a different client (Android/iOS/other project).

2. **Route exists:** `POST /api/auth/google` (with global `api` prefix if you use one).

3. **DB migration applied:** `googleId` on user, nullable password, etc. (`prisma migrate deploy`).

4. **CORS** allows the Next.js origin (e.g. `http://localhost:3001` in dev, production frontend URL in prod).

5. **Logs:** For a failed attempt, grep by `requestId` from the error JSON.

---

## Reproduce without the browser

Invalid token (expect **401** `GOOGLE_TOKEN_INVALID` — proves route + verifier are live):

```bash
curl -sS -X POST "http://localhost:3000/api/auth/google" \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"invalid-token-for-test\"}"
```

Real token test:

1. Sign in with Google once in the browser (or OAuth Playground with the **same Web client ID**).
2. Copy the ID token from the finish-route server log (dev) or from the OAuth Playground.
3. `curl` with `"idToken": "<paste>"` — expect `success: true` and `data.accessToken`.

If curl with a **fresh** ID token fails, the bug is backend/config before involving Next.js.

---

## What we do **not** send to the API

- `GOOGLE_CLIENT_SECRET` (NextAuth only)
- NextAuth session cookies
- NextAuth callback URLs

---

## Reference

- Contract: `docs/backend-handoff-google-auth.md`
- Frontend finish route: `packages/web/src/app/api/auth/google/finish/route.ts`
