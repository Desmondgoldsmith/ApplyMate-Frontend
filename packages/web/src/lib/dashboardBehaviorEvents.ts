import { api } from '@/lib/api';

/** Drop undefined so JSON payloads match strict backend validators. */
function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export type DashboardBehaviorEventName =
  | 'dashboard_hero_clicked'
  | 'dashboard_strategic_recommendation_viewed'
  | 'dashboard_strategic_recommendation_clicked'
  | 'dashboard_continuation_clicked'
  | 'dashboard_priority_completed'
  | 'dashboard_priority_ignored'
  | 'dashboard_insight_dismissed'
  | 'workflow_started'
  | 'workflow_resumed'
  | 'workflow_completed'
  | 'job_saved'
  | 'job_analyzed'
  | 'application_started'
  | 'application_submitted'
  | 'cv_edit_started'
  | 'cv_edit_completed';

function isoNow(): string {
  return new Date().toISOString();
}

function getOrCreateFrontendSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const key = 'applymate:dashboard:frontend-session-id';
    const existing = window.sessionStorage.getItem(key);
    if (existing && existing.trim()) return existing;
    const id = `fe_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Fire-and-forget deterministic behavior event.
 * Never blocks UI; backend is source of truth for any learning.
 */
export function emitDashboardBehaviorEvent(input: {
  eventName: DashboardBehaviorEventName;
  context: Record<string, unknown>;
  occurredAt?: string;
}): void {
  const payload = {
    eventName: input.eventName,
    context: sanitizeContext(input.context),
    occurredAt: input.occurredAt ?? isoNow(),
    sessionId: getOrCreateFrontendSessionId(),
  };
  void api.dashboard.behaviorEvent(payload).catch(() => {
    /* Analytics-only; never surface to UI */
  });
}

