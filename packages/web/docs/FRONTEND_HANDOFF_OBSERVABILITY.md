# Handoff — Observability (4.5): Sentry, PostHog, logging

**Frontend (this repo):** configured via env vars. **Backend:** see backend observability handoff for server-side events and log aggregation.

---

## Environment variables

Set in production host (Vercel, etc.) and CI:

```env
# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Sentry — omit DSN locally to disable
NEXT_PUBLIC_SENTRY_DSN=https://xxx@o000.ingest.sentry.io/000
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=applymate-web@${VERCEL_GIT_COMMIT_SHA}
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1

# Source map upload (CI secret — `withSentryConfig` in next.config.ts)
SENTRY_AUTH_TOKEN=
SENTRY_ORG=mlt-group
SENTRY_PROJECT=javascript-nextjs
```

Release name is auto-derived from `SENTRY_RELEASE`, `VERCEL_GIT_COMMIT_SHA`, or `GITHUB_SHA` when unset.

---

## Sentry

| File | Role |
|------|------|
| `sentry.shared.config.ts` | Shared init (DSN, environment, release, sample rates) |
| `instrumentation-client.ts` | Browser + Session Replay |
| `sentry.server.config.ts` | Node SSR |
| `sentry.edge.config.ts` | Edge / middleware |
| `next.config.ts` | `withSentryConfig` — source maps on `next build` when `SENTRY_AUTH_TOKEN` is set |
| `AuthAnalytics.tsx` | `Sentry.setUser` on login; clears on logout |

**Alerts (Sentry UI):** new issue in production, error-rate spike, P95 regression — configure per project.

---

## PostHog conversion funnel

Canonical event names (must match backend):

| Event | Client fires? | Where |
|-------|---------------|-------|
| `cv_created` | Yes | `useCreateCVProfile`, CV upload, onboarding |
| `job_analyzed` | Backend only | Server fires on persist — no client duplicate |
| `cv_tailored` | Yes | Job Analyzer + Jobs tab after tailor draft |
| `cover_letter_generated` | Yes | Job Analyzer generate success |
| `job_saved_to_hub` | Yes | Save to hub + cover-letter save path |
| `interview_started` | Yes | `useCreateInterview` + interview analytics batch |
| `upgrade_prompted` | Yes | AI limit toasts, usage badge, interview weekly gate |
| `upgrade_completed` | **Client only today** | Call `trackUpgradeCompleted()` from Stripe/checkout success |

Helpers: `@/lib/analytics` → `trackConversionFunnelEvent`, `trackUpgradePrompted`, `trackUpgradeCompleted`.

All client funnel events include `source: 'client'` and `requestId` when available.

**PostHog funnel (dashboard):**

1. Product analytics → Funnels → New funnel
2. Steps: `cv_created` → `job_analyzed` → `cv_tailored` → `cover_letter_generated` → `job_saved_to_hub` → `interview_started` → `upgrade_prompted` → `upgrade_completed`
3. Break down by `source` (`backend` vs `client`) or `environment`

---

## Request correlation

Axios response interceptor stores `X-Request-Id` from API responses (`src/lib/observability/requestId.ts`). PostHog events and support tickets can include `requestId` to match backend JSON logs.

---

## Billing hook (when Stripe ships)

```typescript
import { trackUpgradeCompleted } from '@/lib/analytics';

trackUpgradeCompleted({
  plan: 'pro',
  interval: 'monthly',
  stripeSessionId: session.id,
});
```

---

## Verification checklist

- [ ] `NEXT_PUBLIC_SENTRY_DSN` + release set in staging/production
- [ ] `SENTRY_AUTH_TOKEN` in CI — stack traces show TypeScript lines
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` set — Live events show funnel captures
- [ ] Login → PostHog `identify` + Sentry user id match JWT `sub`
- [ ] Complete analyze flow → `job_analyzed` in PostHog (`source: backend`)
- [ ] Tailor CV → `cv_tailored` (`source: client`)
- [ ] Copy `X-Request-Id` from Network tab → search backend logs
