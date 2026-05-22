import { captureEvent } from '@/lib/analytics';
import type { ProductAnalyticsEventName } from '@/lib/analytics/events';

export type { ProductAnalyticsEventName };

/**
 * Fire-and-forget product events (PostHog + backend ingestion).
 * Never blocks UX if ingestion fails.
 */
export function trackProductEvent(
  eventName: ProductAnalyticsEventName,
  context?: Record<string, unknown>,
): void {
  captureEvent(eventName, context);
}
