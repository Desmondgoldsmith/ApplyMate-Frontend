# `lib/`

| File        | Role |
| ----------- | ---- |
| `utils.ts`  | `cn()` for shadcn/ui (re-export from `@applymate/shared`). |
| `api.ts`    | Axios instance for the ApplyMate API (`NEXT_PUBLIC_API_URL`). |
| `posthog.ts` | **Placeholder** — PostHog browser client init (feature flags / analytics). |

Add Sentry-specific client helpers next to feature code or under `src/app` as needed; server Sentry config stays at the package root (`sentry.*.config.ts`).
