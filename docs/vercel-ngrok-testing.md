# Vercel frontend + local API (ngrok) — testing only

Use this when **Next.js is on Vercel** and **Nest runs locally** exposed with free ngrok.

## Vercel environment

| Variable                                          | Example                                     |
| ------------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                             | `https://YOUR-SUBDOMAIN.ngrok-free.dev/api` |
| `NEXT_PUBLIC_USE_NGROK_TUNNEL`                    | `true`                                      |
| `NEXTAUTH_URL`                                    | `https://your-app.vercel.app`               |
| `NEXT_PUBLIC_SITE_URL`                            | `https://your-app.vercel.app`               |
| `GOOGLE_CLIENT_ID` / `SECRET` / `NEXTAUTH_SECRET` | Same as local                               |

Redeploy after changing `NEXT_PUBLIC_*` variables.

## Backend

- `npm run start:dev` on port 3000
- `ngrok http 3000`
- `CORS_ORIGIN=https://your-app.vercel.app` (exact, no trailing slash)
- Same `GOOGLE_CLIENT_ID` as Vercel

## What the frontend does

`packages/web/src/lib/ngrokTunnel.ts` adds header `ngrok-skip-browser-warning: true` on:

- Browser requests (`axiosClient`)
- Server routes that call the API (`auth-google-exchange`)

Only when the API base URL is `*.ngrok-free.app` or `*.ngrok-free.dev` **and** `NEXT_PUBLIC_USE_NGROK_TUNNEL=true` (required on Vercel because `NODE_ENV=production`).

## Verify

Network → `users/me` → `Content-Type: application/json` (not `text/html`, no `ERR_NGROK_6024`).

## When ngrok URL changes

Update `NEXT_PUBLIC_API_URL` on Vercel and redeploy.
