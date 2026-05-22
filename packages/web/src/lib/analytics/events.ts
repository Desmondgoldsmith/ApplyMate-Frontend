/** Product funnel + navigation events (PostHog + optional backend). */

export type ProductAnalyticsEventName =
  | 'mission_completed'
  | 'recommendation_clicked'
  | 'recommendation_completed'
  | 'recommendation_dismissed'
  | 'followup_started'
  | 'followup_sent'
  | 'followup_ignored'
  | 'stale_action_blocked'
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_abandoned'
  | 'modal_opened'
  | 'modal_closed'
  | 'stale_execution_detected'
  | 'degraded_execution_opened'
  | 'degraded_route_opened'
  | 'fallback_route_used'
  | 'missing_context_detected'
  | 'stalled_recovery_success'
  | 'continuation_resumed'
  | 'continuation_abandoned'
  | 'fast_path_used';

export type FunnelAnalyticsEventName =
  | 'landing_page_viewed'
  | 'marketing_cta_clicked'
  | 'auth_login_started'
  | 'auth_login_completed'
  | 'auth_login_failed'
  | 'auth_register_started'
  | 'auth_register_completed'
  | 'auth_register_failed'
  | 'auth_logout'
  | 'onboarding_entered'
  | 'dashboard_entered'
  | 'page_viewed';

export type AnalyticsEventName = FunnelAnalyticsEventName | ProductAnalyticsEventName;

export const PRODUCT_ANALYTICS_EVENTS = new Set<string>([
  'mission_completed',
  'recommendation_clicked',
  'recommendation_completed',
  'recommendation_dismissed',
  'followup_started',
  'followup_sent',
  'followup_ignored',
  'stale_action_blocked',
  'execution_started',
  'execution_completed',
  'execution_failed',
  'execution_abandoned',
  'modal_opened',
  'modal_closed',
  'stale_execution_detected',
  'degraded_execution_opened',
  'degraded_route_opened',
  'fallback_route_used',
  'missing_context_detected',
  'stalled_recovery_success',
  'continuation_resumed',
  'continuation_abandoned',
  'fast_path_used',
]);

export function isProductAnalyticsEvent(name: string): name is ProductAnalyticsEventName {
  return PRODUCT_ANALYTICS_EVENTS.has(name);
}
