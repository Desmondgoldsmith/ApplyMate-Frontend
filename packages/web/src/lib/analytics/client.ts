import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/api';
import { getLastRequestId } from '@/lib/observability/requestId';
import { getPostHog, initPostHog, isPostHogEnabled } from '@/lib/posthog';

import {
  isProductAnalyticsEvent,
  type AnalyticsEventName,
  type ProductAnalyticsEventName,
} from './events';

export function captureEvent(
  eventName: AnalyticsEventName | ProductAnalyticsEventName | string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  const client = getPostHog() ?? (isPostHogEnabled() ? initPostHog() : null);
  if (client) {
    const requestId = getLastRequestId();
    client.capture(eventName, {
      ...properties,
      $current_url: window.location.href,
      ...(requestId ? { requestId } : {}),
    });
  }

  if (isProductAnalyticsEvent(eventName)) {
    void (async () => {
      try {
        await api.analytics.trackEvent({
          eventName,
          context: properties,
        });
      } catch {
        /* ignore */
      }
    })();
  }
}

export function identifyUser(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  const client = getPostHog() ?? initPostHog();
  if (!client) return;

  client.identify(user.id, {
    email: user.email,
    onboarding_completed: user.onboardingCompleted ?? false,
    primary_goal: user.primaryGoal ?? undefined,
  });
}

export function resetAnalyticsUser(): void {
  if (typeof window === 'undefined') return;
  const client = getPostHog();
  if (!client) return;
  client.reset();
}

export function capturePageView(path: string, search?: string): void {
  captureEvent('page_viewed', {
    path,
    search: search || undefined,
    title: typeof document !== 'undefined' ? document.title : undefined,
  });
}
