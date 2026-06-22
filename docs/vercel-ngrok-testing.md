# Vercel frontend + local API (ngrok) — testing only

Use this when **Next.js is on Vercel** and **Nest runs locally** exposed with free ngrok.

## Vercel environment (no spaces in values!)

| Variable                       | Example                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`          | `https://YOUR-SUBDOMAIN.ngrok-free.dev/api/`                     |
| `NEXT_PUBLIC_USE_NGROK_TUNNEL` | `true`                                                           |
| `NEXTAUTH_URL`                 | `https://your-app.vercel.app/api/auth`                           |
| `NEXT_PUBLIC_SITE_URL`         | `https://your-app.vercel.app`                                    |
| `GOOGLE_CLIENT_ID`             | Same Web OAuth client as Nest                                    |
| `GOOGLE_CLIENT_SECRET`         | Same as local                                                    |
| `NEXTAUTH_SECRET`              | Same as local                                                    |

**Wrong:** `NEXT_PUBLIC_API_URL= https://foo.ngrok-free.dev /api/` (spaces break the URL)  
**Right:** `NEXT_PUBLIC_API_URL=https://prudence-monostome-donella.ngrok-free.dev/api/`

Redeploy after changing `NEXT_PUBLIC_*` variables.

## Backend (local Nest)

- `npm run start:dev` on port 3000
- `ngrok http 3000`
- `CORS_ORIGIN=https://apply-mate-frontend.vercel.app` (exact, no trailing slash)
- `GOOGLE_CLIENT_ID` = **same** Web client as Vercel (restart Nest after changing)

## What the frontend does

- Browser on Vercel uses same-origin `/backend-api/*` → Vercel serverless → ngrok → Nest (avoids CORS + ngrok HTML interstitial).
- Google finish route calls ngrok directly with `ngrok-skip-browser-warning`.
- URLs are normalized (all whitespace stripped from `NEXT_PUBLIC_API_URL`).

## Verify

1. `GET https://your-app.vercel.app/api/auth/google/status`  
   - `apiUrlHadWhitespace: false`  
   - `vercelNgrokBrowserProxy: true`  
   - `apiReachable: true`
2. Network → login → `/backend-api/auth/login` → JSON (not HTML)

## When ngrok URL changes

Update `NEXT_PUBLIC_API_URL` on Vercel and redeploy.
