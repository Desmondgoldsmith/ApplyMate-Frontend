/**
 * Conversion funnel events (PostHog 4.5).
 *
 * Event names must match backend `product-analytics.constants.ts` exactly.
 * Backend also emits many of these server-side (`properties.source = "backend"`).
 * Client captures use `source: "client"` at the UX moment for funnel timing.
 *
 * PostHog funnel tip: filter by `source` or dedupe by user + step when both fire.
 */

import { getPostHog, initPostHog, isPostHogEnabled } from '@/lib/posthog';
import { getLastRequestId } from '@/lib/observability/requestId';

export type ConversionFunnelEventName =
  | 'cv_created'
  | 'job_analyzed'
  | 'cv_tailored'
  | 'cover_letter_generated'
  | 'job_saved_to_hub'
  | 'interview_started'
  | 'upgrade_prompted'
  | 'upgrade_completed';

const firedUpgradePromptSurfaces = new Set<string>();

/**
 * PostHog-only conversion funnel capture. Does not call `/analytics/events`
 * (backend already forwards server-side events to PostHog where noted).
 */
export function trackConversionFunnelEvent(
  eventName: ConversionFunnelEventName,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  const client = getPostHog() ?? (isPostHogEnabled() ? initPostHog() : null);
  if (!client) return;

  const requestId = getLastRequestId();
  client.capture(eventName, {
    ...properties,
    source: 'client',
    app: 'applymate-web',
    ...(requestId ? { requestId } : {}),
  });
}

/** Fire once per surface per page load when a paywall / limit CTA is shown. */
export function trackUpgradePrompted(
  surface: string,
  context?: Record<string, unknown>,
): void {
  const key = surface.trim() || 'unknown';
  if (firedUpgradePromptSurfaces.has(key)) return;
  firedUpgradePromptSurfaces.add(key);
  trackConversionFunnelEvent('upgrade_prompted', {
    surface: key,
    ...context,
  });
}

/**
 * Call when paid upgrade succeeds (Stripe checkout webhook / success page).
 * Backend does not emit this yet — client is the source of truth today.
 */
export function trackUpgradeCompleted(
  context?: Record<string, unknown>,
): void {
  trackConversionFunnelEvent('upgrade_completed', context);
}
