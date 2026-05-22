import { api } from '@/lib/api';

const SESSION_KEY = 'applymate:analytics-session-id';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing?.trim()) return existing;
    const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return `${Date.now()}-fallback`;
  }
}

export function trackFunnelEvent(
  eventName:
    | 'dashboard_cta_clicked'
    | 'analyze_completed'
    | 'apply_completed'
    | 'jobhub_row_prefetched'
    | 'jobboard_card_prefetched'
    | 'topmatch_prefetched'
    | 'jobboard_quick_action_clicked'
    | 'jobboard_refined_score_ready'
    | 'jobboard_focus_opened'
    | 'jobboard_empty_guidance_clicked',
  context?: Record<string, unknown>,
): void {
  void api.analytics.trackEvent({
    eventName,
    context,
    occurredAt: new Date().toISOString(),
    sessionId: getSessionId(),
  });
}
