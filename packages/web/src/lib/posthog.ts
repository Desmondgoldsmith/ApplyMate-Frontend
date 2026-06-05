import posthog from 'posthog-js';

import { resolveObservabilityEnvironment } from '@/lib/observability/env';

export type PostHogClient = typeof posthog;

let initialized = false;

function posthogHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    'https://us.i.posthog.com'
  );
}

export function isPostHogEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}

/** Browser-only init; safe to call multiple times. */
export function initPostHog(): PostHogClient | null {
  if (typeof window === 'undefined') return null;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return null;
  if (initialized) return posthog;

  posthog.init(key, {
    api_host: posthogHost(),
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: true,
    loaded: (client) => {
      client.register({
        app: 'applymate-web',
        environment: resolveObservabilityEnvironment(),
      });
    },
  });
  initialized = true;
  return posthog;
}

export function getPostHog(): PostHogClient | null {
  if (typeof window === 'undefined') return null;
  if (!isPostHogEnabled()) return null;
  if (!initialized) return initPostHog();
  return posthog;
}

export default posthog;
