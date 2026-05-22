import {
  normalizeDashboardCardId,
  type ResolvedDashboardPhase14Layout,
} from '@/lib/dashboardPhase14Layout';
import type { TodayPlanPayload } from '@/lib/today-plan';

const URGENT_PRIORITY_LEVELS = new Set(['critical', 'urgent', 'very_high']);

/** Minimum explicit confidence (when provided) for priority intelligence cards to surface. */
const PRIORITY_CONFIDENCE_MIN = 25;

export type DashboardMidSectionKey =
  | 'continuation'
  | 'priority_intelligence'
  | 'today_plan'
  | 'follow_up_intelligence';

export function isConfidenceMeaningfulForPriority(confidence: number | null | undefined): boolean {
  if (confidence == null || !Number.isFinite(confidence)) return true;
  return confidence >= PRIORITY_CONFIDENCE_MIN;
}

export function isPriorityCardActionable(plan: TodayPlanPayload | null | undefined, rawId: string): boolean {
  const id = normalizeDashboardCardId(rawId);
  switch (id) {
    case 'strategic_recommendation': {
      const sr = plan?.strategicRecommendation;
      if (!sr) return false;
      if (!sr.headline?.trim() || !sr.supporting?.trim() || !sr.ctaLabel?.trim() || !sr.ctaHref?.trim()) {
        return false;
      }
      return isConfidenceMeaningfulForPriority(sr.confidence);
    }
    case 'opportunity_detection': {
      const od = plan?.opportunityDetection;
      if (!od) return false;
      if (!od.headline?.trim() || !od.supporting?.trim() || !od.ctaLabel?.trim() || !od.ctaHref?.trim()) {
        return false;
      }
      return isConfidenceMeaningfulForPriority(od.confidence);
    }
    case 'follow_up_intelligence': {
      const fu = plan?.followUpIntelligence;
      const jobs = plan?.followUpJobs ?? [];
      const first = jobs[0];
      if (first) {
        const hasPreview =
          Boolean(first.companyName?.trim()) ||
          Boolean(first.jobTitle?.trim()) ||
          Boolean(first.headline?.trim()) ||
          Boolean(first.supporting?.trim());
        const hasCta = Boolean(first.ctaHref?.trim());
        if (hasPreview && hasCta) {
          return isConfidenceMeaningfulForPriority(first.confidence ?? fu?.confidence);
        }
      }
      if (!fu) return false;
      const hasCopy =
        Boolean(fu.headline?.trim()) ||
        Boolean(fu.supporting?.trim()) ||
        fu.daysSinceApplication != null;
      return Boolean(hasCopy && fu.ctaLabel?.trim() && fu.ctaHref?.trim());
    }
    default:
      return false;
  }
}

export function selectActionablePriorityCardIds(
  plan: TodayPlanPayload | null | undefined,
  layout: ResolvedDashboardPhase14Layout,
  max = 3,
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  const out: string[] = [];
  for (const rawId of layout.priorityOrder) {
    const id = normalizeDashboardCardId(rawId);
    if (exclude.has(id)) continue;
    if (layout.hidden.has(id)) continue;
    if (!isPriorityCardActionable(plan, id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function computeDashboardPriorityUrgent(plan: TodayPlanPayload | null | undefined): boolean {
  const meta = plan?.priorityIntelligence;
  if (!meta) return false;
  if (meta.promoteToTop === true) return true;
  const u = (meta.urgencyLevel ?? '').trim().toLowerCase();
  return URGENT_PRIORITY_LEVELS.has(u);
}

/** Deterministic mid-column section order (after hero): default vs urgent priority intelligence. */
export function buildDashboardSectionOrder(args: {
  urgentPriority: boolean;
  showPriorityIntelligence: boolean;
  showContinuation: boolean;
  showFollowUpIntelligence: boolean;
}): DashboardMidSectionKey[] {
  const {
    urgentPriority,
    showPriorityIntelligence,
    showContinuation,
    showFollowUpIntelligence,
  } = args;
  const urgent = urgentPriority && showPriorityIntelligence;

  if (urgent) {
    return [
      ...(showPriorityIntelligence ? (['priority_intelligence'] as const) : []),
      ...(showContinuation ? (['continuation'] as const) : []),
      'today_plan',
      ...(showFollowUpIntelligence ? (['follow_up_intelligence'] as const) : []),
    ];
  }

  return [
    ...(showContinuation ? (['continuation'] as const) : []),
    'today_plan',
    ...(showPriorityIntelligence ? (['priority_intelligence'] as const) : []),
    ...(showFollowUpIntelligence ? (['follow_up_intelligence'] as const) : []),
  ];
}
