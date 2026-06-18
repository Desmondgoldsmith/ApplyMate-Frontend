import type { DashboardContinuationView } from '@/lib/dashboardViewModel';
import { orchestratePriorities } from '@/lib/dashboardOrchestration';
import { resolveExecutionDestination } from '@/lib/executionRouting';
import { weeklyStallItemHref } from '@/lib/weekly-stall-summary';
import type { WeeklyStallSummaryPayload } from '@/lib/weekly-stall-summary';
import type { DashboardFocusItemPayload, UnifiedPriorityItem } from '@/lib/today-plan';
import { isPriorityInvalidByState, unifiedPriorityDedupeKey } from '@/lib/today-plan';
import { isFollowUpCoachingSubmitted } from '@/lib/dashboardCommandCopy';
import type { TodayPlanPayload } from '@/lib/today-plan';

export type FocusUrgencyDot = 'red' | 'amber' | 'teal';

export type FocusItemSource =
  | 'strategic_recommendation'
  | 'opportunity_detection'
  | 'follow_up_intelligence'
  | 'unified_priority'
  | 'weekly_stall'
  | 'phase15_focus';

export type FocusItem = {
  id: string;
  source: FocusItemSource;
  sortScore: number;
  dot: FocusUrgencyDot;
  title: string;
  subtitle: string;
  metaLine: string;
  ctaLabel: string;
  ctaHref: string;
  /** Phase 15 server-authoritative ordering + accent */
  phase15?: Pick<DashboardFocusItemPayload, 'type' | 'priority' | 'urgency'>;
};

function dotFromScore(score: number): FocusUrgencyDot {
  if (score >= 900) return 'red';
  if (score >= 650) return 'amber';
  return 'teal';
}

function urgencyToDot(u: DashboardFocusItemPayload['urgency']): FocusUrgencyDot {
  if (u === 'high') return 'red';
  if (u === 'medium') return 'amber';
  return 'teal';
}

function phase15MetaLine(row: DashboardFocusItemPayload): string {
  const parts: string[] = [];
  const activity = row.lastActivityLabel?.trim();
  if (activity) parts.push(activity);
  if (typeof row.confidence === 'number' && Number.isFinite(row.confidence)) {
    parts.push(`Confidence ${Math.round(row.confidence)}%`);
  }
  if (row.estimatedMinutes != null) parts.push(`~${row.estimatedMinutes} min`);
  return parts.length ? parts.join(' · ') : 'Focused action';
}

/** Phase 15 server feed — priority ascending (lower number = higher priority). */
export function mapPhase15FocusItems(rows: DashboardFocusItemPayload[]): FocusItem[] {
  const sorted = [...rows].sort((a, b) => a.priority - b.priority);
  return sorted.map((row) => ({
    id: `focus-p15-${row.id}`,
    source: 'phase15_focus',
    sortScore: 10_000 - Math.min(9999, Math.max(0, row.priority)),
    dot: urgencyToDot(row.urgency),
    title: row.title,
    subtitle: row.description,
    metaLine: phase15MetaLine(row),
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    phase15: { type: row.type, priority: row.priority, urgency: row.urgency },
  }));
}

function minutesEstimate(item: UnifiedPriorityItem): number | null {
  const em = item.executionContext?.estimatedMinutes;
  if (typeof em === 'number' && Number.isFinite(em)) return Math.max(1, Math.round(em));
  return null;
}

function unifiedHref(item: UnifiedPriorityItem, defaultCvProfileId: string | null): string {
  return resolveExecutionDestination({
    cta: item.cta,
    kind: item.kind,
    reasonCodes: item.reasonCodes,
    actionType: item.ctaHint,
    executionContext: item.executionContext,
    executionPayload: item.executionPayload,
    journeyNextRoute: item.journey?.nextRoute ?? null,
    ids: item.ids,
    defaultCvProfileId,
    safeFallback: '/dashboard/jobs',
  }).href;
}

export function buildDashboardFocusItems(args: {
  plan: TodayPlanPayload | null | undefined;
  continuation: DashboardContinuationView | null;
  weeklyStall: WeeklyStallSummaryPayload | undefined;
  defaultCvProfileId: string | null;
  heroClusterId?: string | null;
}): FocusItem[] {
  const { plan, weeklyStall, defaultCvProfileId, heroClusterId } = args;
  if (plan?.focusItems != null) {
    if (plan.focusItems.length === 0) return [];
    // Defensive: older cached payloads may still include continuation entries.
    return mapPhase15FocusItems(plan.focusItems.filter((i) => i.type !== 'continuation'));
  }
  const out: FocusItem[] = [];
  const seenHref = new Set<string>();

  const push = (item: Omit<FocusItem, 'dot'> & { dot?: FocusUrgencyDot }) => {
    const href = item.ctaHref.trim();
    if (!href || seenHref.has(href)) return;
    seenHref.add(href);
    const dot = item.dot ?? dotFromScore(item.sortScore);
    out.push({ ...item, dot });
  };

  if (plan?.strategicRecommendation) {
    const sr = plan.strategicRecommendation;
    const cl = sr.ctaLabel?.trim();
    const ch = sr.ctaHref?.trim();
    const conf =
      typeof sr.confidence === 'number' && Number.isFinite(sr.confidence)
        ? Math.min(100, Math.max(0, Math.round(sr.confidence)))
        : null;
    const daysInterview =
      typeof sr.rationale?.daysUntilInterview === 'number' && Number.isFinite(sr.rationale.daysUntilInterview)
        ? Math.max(0, Math.round(sr.rationale.daysUntilInterview))
        : null;

    if (cl && ch && sr.headline?.trim() && sr.supporting?.trim()) {
      let sortScore = 600 + (conf ?? 50);
      if (daysInterview != null && daysInterview < 3) sortScore = 1000;
      else if (daysInterview != null && daysInterview <= 7) sortScore = 920;
      else if (conf != null && conf >= 85) sortScore = Math.max(sortScore, 880);

      const metaParts: string[] = [];
      if (conf != null) metaParts.push(`Confidence ${conf}%`);
      metaParts.push('Priority intelligence');
      push({
        id: 'focus-strategic-rec',
        source: 'strategic_recommendation',
        sortScore,
        title: sr.headline.trim(),
        subtitle: sr.supporting.trim(),
        metaLine: metaParts.join(' · '),
        ctaLabel: cl,
        ctaHref: ch,
      });
    }
  }

  if (plan?.opportunityDetection) {
    const od = plan.opportunityDetection;
    const cl = od.ctaLabel?.trim();
    const ch = od.ctaHref?.trim();
    const conf =
      typeof od.confidence === 'number' && Number.isFinite(od.confidence)
        ? Math.min(100, Math.max(0, Math.round(od.confidence)))
        : null;
    if (cl && ch && od.headline?.trim() && od.supporting?.trim()) {
      let sortScore = 620 + (conf ?? 40);
      if (od.reason === 'deadline_soon') sortScore = Math.max(sortScore, 950);
      push({
        id: 'focus-opportunity',
        source: 'opportunity_detection',
        sortScore,
        title: od.headline.trim(),
        subtitle: od.supporting.trim(),
        metaLine: [conf != null ? `Confidence ${conf}%` : null, 'Best opportunity'].filter(Boolean).join(' · '),
        ctaLabel: cl,
        ctaHref: ch,
      });
    }
  }

  if (plan?.followUpIntelligence) {
    const fu = plan.followUpIntelligence;
    const cl = fu.ctaLabel?.trim();
    const ch = fu.ctaHref?.trim();
    const conf =
      typeof fu.confidence === 'number' && Number.isFinite(fu.confidence)
        ? Math.min(100, Math.max(0, Math.round(fu.confidence)))
        : null;
    const days =
      typeof fu.daysSinceApplication === 'number' && Number.isFinite(fu.daysSinceApplication)
        ? Math.max(0, Math.round(fu.daysSinceApplication))
        : null;
    if (cl && ch && fu.headline?.trim()) {
      let sortScore = 640 + (conf ?? 35);
      if (days != null && days > 21) sortScore = Math.max(sortScore, 960);
      else if (days != null && days > 14) sortScore = Math.max(sortScore, 800);
      const title =
        days != null
          ? isFollowUpCoachingSubmitted(fu.coachingStage)
            ? `${days} days since you applied — time to follow up`
            : `${days} days in your pipeline — time to follow up`
          : fu.headline.trim();
      const subtitle =
        fu.supporting?.trim() ||
        (isFollowUpCoachingSubmitted(fu.coachingStage)
          ? 'A short, polite message could bring your application back into focus.'
          : 'A short check-in could move this forward.');
      push({
        id: 'focus-followup-intel',
        source: 'follow_up_intelligence',
        sortScore,
        title,
        subtitle,
        metaLine: [conf != null ? `Confidence ${conf}%` : null, 'Follow-up'].filter(Boolean).join(' · '),
        ctaLabel: cl,
        ctaHref: ch,
      });
    }
  }

  const items = plan?.unifiedPriorities?.items ?? [];
  let pipeline = orchestratePriorities(items)
    .filter((x) => !isPriorityInvalidByState(x))
    .filter((x) => !x.suppressedBy)
    .filter((x) => (heroClusterId ? (x.recommendationClusterId ?? '').trim() !== heroClusterId : true));

  if (pipeline.length > 12) pipeline = pipeline.slice(0, 12);

  for (const item of pipeline) {
    const href = unifiedHref(item, defaultCvProfileId);
    const title = item.title?.trim() || 'Suggested step';
    const subt =
      item.compactDisplay?.primaryLine?.trim() ||
      item.subtitle?.trim() ||
      item.reasonText?.trim() ||
      item.whyNowShort?.trim() ||
      '';
    const score =
      typeof item.priorityScore === 'number' && Number.isFinite(item.priorityScore)
        ? Math.round(item.priorityScore)
        : 50;
    const mins = minutesEstimate(item);
    const sortScore = 400 + Math.min(120, score);
    const metaParts = [`Today's plan`, mins != null ? `~${mins} min` : null].filter(Boolean);
    push({
      id: `focus-up-${unifiedPriorityDedupeKey(item)}`,
      source: 'unified_priority',
      sortScore,
      title,
      subtitle: subt || 'Move this forward while it still matters.',
      metaLine: metaParts.join(' · '),
      ctaLabel: item.compactDisplay?.actionLabel?.trim() || 'Open',
      ctaHref: href,
      dot: 'teal',
    });
  }

  if (weeklyStall?.items?.length && weeklyStall.eligible) {
    for (const row of weeklyStall.items.slice(0, 8)) {
      const href = weeklyStallItemHref(row) ?? '/dashboard/jobs';
      const title = `${row.title?.trim() || 'Role'} — ${row.company?.trim() || 'Company'}`.trim();
      push({
        id: `focus-stall-${row.id}`,
        source: 'weekly_stall',
        sortScore: 500,
        title: title || 'Pipeline follow-up',
        subtitle: 'These applications haven\'t moved in a while. One action each could change that.',
        metaLine: 'Jobs to revisit',
        ctaLabel: row.ctaHint === 'OPEN_JOB_ANALYZE' ? 'Open analysis' : 'Open in Job Hub',
        ctaHref: href,
        dot: 'amber',
      });
    }
  }

  out.sort((a, b) => b.sortScore - a.sortScore);

  return out;
}
