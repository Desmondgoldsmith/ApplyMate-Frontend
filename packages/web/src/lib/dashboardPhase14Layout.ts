import type { DashboardLayoutConfigPayload, TodayPlanPayload } from '@/lib/today-plan';

/**
 * Normalizes backend Phase 14 card ids (camelCase, snake_case, kebab) to canonical
 * snake_case keys used for payload routing. Backend examples:
 * `bestStrategicMove` → strategicRecommendation, `consistency` → habitProgress, etc.
 */
export function normalizeDashboardCardId(raw: string): string {
  const base = raw.trim().toLowerCase().replace(/-/g, '_');
  return CARD_ID_CANONICAL_MAP[base] ?? base;
}

/** Collapsed lowercase keys only (matches camelCase after .toLowerCase()). */
const CARD_ID_CANONICAL_MAP: Record<string, string> = {
  // Priority (backend camelCase)
  beststrategicmove: 'strategic_recommendation',
  opportunitydetection: 'opportunity_detection',
  followupintelligence: 'follow_up_intelligence',

  // Secondary (backend camelCase)
  careermomentum: 'career_momentum',
  predictiveoutlook: 'predictive_outlook',
  goalalignment: 'goal_alignment',
  goalstrategiccoaching: 'goal_strategic_coaching',
  /** Product alias for habit / streaks payload */
  consistency: 'habit_progress',
  /** Backend “achievements” → today plan achievements object */
  achievements: 'today_plan_achievements',

  // Often hidden (camelCase)
  strategicweeklycoaching: 'strategic_weekly_coaching',
  strategiccoaching: 'strategic_coaching',
  adaptivecoaching: 'adaptive_coaching',
  weeklystrategicbriefing: 'weekly_briefing',
  cvclinicpromo: 'cv_clinic_promo',

  // Meta / suppression (no payload card)
  guidance: 'guidance',
  landscape: 'landscape',
};

/** Default priority slots when API omits `priorityCards` (canonical ids). */
const DEFAULT_PRIORITY = [
  'strategic_recommendation',
  'opportunity_detection',
  'follow_up_intelligence',
] as const;

/** Default secondary / collapsible when API omits lists — aligned with Phase 14 backend. */
const DEFAULT_SECONDARY = [
  'career_momentum',
  'predictive_outlook',
  'goal_alignment',
  'habit_progress',
  'today_plan_achievements',
  'goal_strategic_coaching',
  'weekly_briefing',
  'strategic_weekly_coaching',
  'strategic_coaching',
  'adaptive_coaching',
  'milestone_celebration',
  'growth_achievements',
  'growth_momentum',
] as const;

/**
 * Primary band inside “Your Progress Intelligence” — fixed narrative order before other secondary cards.
 * Goals & Strategy (`goal_strategic_coaching`) renders after this collapsible.
 */
export const PROGRESS_INTELLIGENCE_CORE_IDS = [
  'career_momentum',
  'predictive_outlook',
  'goal_alignment',
  'habit_progress',
  'today_plan_achievements',
] as const;

/** Full secondary render order: core progress cards first, then remaining cards (excluding Goals & Strategy). */
export function buildSecondaryCardsCollapsibleOrder(): string[] {
  const coreSet = new Set<string>(PROGRESS_INTELLIGENCE_CORE_IDS as unknown as string[]);
  const tail = SECONDARY_CARD_RENDER_ORDER.filter(
    (id) => id !== 'goal_strategic_coaching' && !coreSet.has(id),
  );
  return [...PROGRESS_INTELLIGENCE_CORE_IDS, ...tail];
}

/** Stable render order inside the Progress Intelligence collapsible. */
export const SECONDARY_CARD_RENDER_ORDER = [
  'career_momentum',
  'predictive_outlook',
  'goal_alignment',
  'habit_progress',
  'today_plan_achievements',
  'goal_strategic_coaching',
  'weekly_briefing',
  'strategic_weekly_coaching',
  'strategic_coaching',
  'adaptive_coaching',
  'milestone_celebration',
  'growth_momentum',
  'growth_achievements',
] as const;

export type ResolvedDashboardPhase14Layout = {
  hidden: Set<string>;
  priorityOrder: string[];
  secondaryOrder: string[];
  collapsible: Set<string>;
  mergeLandscapeIntoPipeline: boolean;
  suppressInsightGuidance: boolean;
};

function mergeStringLists(
  primary: readonly string[] | undefined,
  fallback: readonly string[],
): string[] {
  const p = primary?.length ? primary.map(normalizeDashboardCardId) : [...fallback];
  return p;
}

export function resolveDashboardPhase14Layout(
  config: DashboardLayoutConfigPayload | null | undefined,
  options?: { heroSuppressesInsights?: boolean },
): ResolvedDashboardPhase14Layout {
  const hidden = new Set<string>();
  for (const h of config?.hiddenCards ?? []) {
    hidden.add(normalizeDashboardCardId(h));
  }

  const priorityOrder = mergeStringLists(config?.priorityCards, DEFAULT_PRIORITY);
  const secondaryOrder = mergeStringLists(config?.secondaryCards, DEFAULT_SECONDARY);

  const collapsible = new Set<string>();
  const collapsibleSource =
    config?.collapsibleCards != null && config.collapsibleCards.length > 0
      ? config.collapsibleCards
      : secondaryOrder;
  for (const c of collapsibleSource) {
    collapsible.add(normalizeDashboardCardId(c));
  }

  const mergeLandscapeIntoPipeline =
    config?.mergeLandscapeIntoPipeline !== null && config?.mergeLandscapeIntoPipeline !== undefined
      ? config.mergeLandscapeIntoPipeline
      : true;

  let suppressInsightGuidance = Boolean(options?.heroSuppressesInsights);
  if (config?.suppressInsightGuidance === true) suppressInsightGuidance = true;
  else if (config?.suppressInsightGuidance === false) suppressInsightGuidance = false;
  else if (hidden.has('guidance')) suppressInsightGuidance = true;

  return {
    hidden,
    priorityOrder,
    secondaryOrder,
    collapsible,
    mergeLandscapeIntoPipeline,
    suppressInsightGuidance,
  };
}

export function dashboardCardHasData(plan: TodayPlanPayload | null | undefined, id: string): boolean {
  const card = normalizeDashboardCardId(id);
  if (!plan) return false;
  switch (card) {
    case 'strategic_recommendation':
      return Boolean(plan.strategicRecommendation);
    case 'opportunity_detection':
      return Boolean(plan.opportunityDetection);
    case 'follow_up_intelligence':
      return Boolean(plan.followUpIntelligence);
    case 'adaptive_coaching':
      return Boolean(plan.adaptiveCoaching);
    case 'goal_alignment':
      return Boolean(plan.goalAlignment);
    case 'goal_strategic_coaching':
      return Boolean(plan.goalStrategicCoaching);
    case 'strategic_coaching':
      return Boolean(plan.strategicCoaching);
    case 'career_momentum':
      return Boolean(plan.careerMomentum);
    case 'predictive_outlook':
      return Boolean(plan.predictiveOutlook);
    case 'weekly_briefing':
      return Boolean(plan.weeklyBriefing);
    case 'strategic_weekly_coaching':
      return Boolean(plan.strategicWeeklyCoaching);
    case 'habit_progress':
      return Boolean(plan.habitProgress);
    case 'today_plan_achievements':
      return Boolean(plan.careerAchievements) || plan.achievements != null;
    case 'milestone_celebration':
      return Boolean(plan.milestoneCelebration);
    case 'growth_achievements':
    case 'growth_momentum':
    case 'guidance':
    case 'landscape':
    case 'cv_clinic_promo':
      return false;
    default:
      return false;
  }
}

export function selectPriorityCardIds(
  plan: TodayPlanPayload | null | undefined,
  layout: ResolvedDashboardPhase14Layout,
  max = 3,
): string[] {
  const out: string[] = [];
  for (const rawId of layout.priorityOrder) {
    const id = normalizeDashboardCardId(rawId);
    if (layout.hidden.has(id)) continue;
    if (!dashboardCardHasData(plan, id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function shouldShowSecondaryCard(
  id: string,
  plan: TodayPlanPayload | null | undefined,
  layout: ResolvedDashboardPhase14Layout,
  priorityIds: readonly string[],
  flags?: {
    /** `shouldRenderSection('momentum', plan)` from page. */
    allowGrowthMomentum?: boolean;
    /** Growth achievements list has items. */
    allowGrowthAchievements?: boolean;
  },
): boolean {
  const cid = normalizeDashboardCardId(id);
  if (layout.hidden.has(cid)) return false;
  if (priorityIds.includes(cid)) return false;
  if (!layout.collapsible.has(cid) && !layout.secondaryOrder.includes(cid)) {
    return false;
  }
  if (cid === 'growth_momentum') return Boolean(flags?.allowGrowthMomentum);
  if (cid === 'growth_achievements') return Boolean(flags?.allowGrowthAchievements);
  return dashboardCardHasData(plan, cid);
}

export function shouldShowInLandscapeStack(
  id: string,
  layout: ResolvedDashboardPhase14Layout,
  priorityIds: readonly string[],
): boolean {
  const cid = normalizeDashboardCardId(id);
  if (layout.hidden.has(cid)) return false;
  if (priorityIds.includes(cid)) return false;
  return true;
}
