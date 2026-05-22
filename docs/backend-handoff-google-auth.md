# Backend handoff: Google sign-in (`POST /auth/google`)

The web app uses **NextAuth** for the Google OAuth redirect only. After Google returns an ID token, the Next.js server calls your API to create or sign in the user — **same JWT + user payload as email login/register**.

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
  "image": "Optional avatar URL from Google profile"
}
```

### Success response (200)

Use the **same envelope** as `POST /auth/login`:

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "name": "Jane Doe",
    "image": "https://...",
    "onboardingCompleted": false
  }
}
```

Snake_case variants (`access_token`, nested `data`) are already normalized on the frontend.

### Behaviour

1. Verify `idToken` with Google (`https://oauth2.googleapis.com/tokeninfo?id_token=...` or official library).
2. Read `email`, `sub` (Google user id), optional `name`, `picture`.
3. If no user exists for that email → **create user** (same defaults as `POST /auth/register`: `onboardingCompleted: false`, default `selectedFeatures`, etc.).
4. If user exists → issue session (link Google account if you store `googleId`).
5. Return `accessToken` + `user` (include `onboardingCompleted` so new Google users are sent to `/onboarding`).

### Errors

| Status | When |
|--------|------|
| 400 | Missing/invalid token |
| 401 | Token verification failed |
| 409 | Optional: email exists with password-only account (message for “Sign in with password”) |
| 429 | Rate limit (same as login) |

## Frontend flow

1. User clicks **Continue with Google** on `/login` or `/register`.
2. NextAuth → Google → callback `/api/auth/google/finish`.
3. Finish route calls `POST /auth/google` with `idToken`.
4. Sets `applymate_token` cookie and redirects:
   - `onboardingCompleted === true` → `/dashboard`
   - else → `/onboarding`

Email/password login is unchanged (`api.auth.login` / `api.auth.register`).

## Env (frontend)

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

Google Cloud Console → OAuth client → Authorized redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

Production: `https://<your-domain>/api/auth/callback/google`
