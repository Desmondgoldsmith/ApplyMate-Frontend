import type {
  DashboardMode,
  DashboardSectionKey,
  DashboardSurfaceOwnership,
  TodayPlanPayload,
  UnifiedPriorityItem,
} from '@/lib/today-plan';

type OrchestrationItem = {
  id: string;
  recommendationClusterId?: string | null;
  /** Phase 4.1 — when set, dedupe prefers this over cluster-only keys (aligns with backend single row per entity). */
  workflowEntityKey?: string | null;
  suppressedBy?: DashboardSurfaceOwnership | null;
  suppressionReason?: string | null;
  surfaceOwnership?: DashboardSurfaceOwnership | null;
  displayPriority?: number | null;
  priorityScore?: number | null;
};

type SuppressionSignals = {
  suppressedBy?: DashboardSurfaceOwnership | null;
  suppressionReason?: string | null;
};

export function isSuppressedRecommendation(item: SuppressionSignals): boolean {
  const reason = String(item.suppressionReason ?? '')
    .trim()
    .toLowerCase();
  if (item.suppressedBy) return true;
  if (!reason) return false;
  return reason.includes('duplicate') || reason.includes('superseded') || reason.includes('onboarding');
}

export function sortByDisplayPriority<T extends OrchestrationItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aOrder = typeof a.displayPriority === 'number' && Number.isFinite(a.displayPriority) ? a.displayPriority : Number.POSITIVE_INFINITY;
    const bOrder = typeof b.displayPriority === 'number' && Number.isFinite(b.displayPriority) ? b.displayPriority : Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aScore = typeof a.priorityScore === 'number' && Number.isFinite(a.priorityScore) ? a.priorityScore : 0;
    const bScore = typeof b.priorityScore === 'number' && Number.isFinite(b.priorityScore) ? b.priorityScore : 0;
    if (aScore !== bScore) return bScore - aScore;
    return a.id.localeCompare(b.id);
  });
}

export function dedupeByCluster<T extends OrchestrationItem>(items: T[]): T[] {
  const seenCluster = new Set<string>();
  const seenWorkflow = new Set<string>();
  const out: T[] = [];
  for (const item of sortByDisplayPriority(items)) {
    if (isSuppressedRecommendation(item)) continue;
    const wf = (item.workflowEntityKey ?? '').trim();
    if (wf) {
      if (seenWorkflow.has(wf)) continue;
      seenWorkflow.add(wf);
      const cluster = (item.recommendationClusterId ?? '').trim();
      if (cluster) seenCluster.add(cluster);
      out.push(item);
      continue;
    }
    const cluster = (item.recommendationClusterId ?? '').trim();
    if (cluster && seenCluster.has(cluster)) continue;
    if (cluster) seenCluster.add(cluster);
    out.push(item);
  }
  return out;
}

export function computeOwnedClusters(items: Array<{ recommendationClusterId?: string | null; surfaceOwnership?: DashboardSurfaceOwnership | null }>, owner: DashboardSurfaceOwnership): Set<string> {
  const set = new Set<string>();
  for (const item of items) {
    const cluster = (item.recommendationClusterId ?? '').trim();
    if (!cluster) continue;
    if (item.surfaceOwnership === owner) set.add(cluster);
  }
  return set;
}

/**
 * Mirrors backend `recommendedSectionsForMode` when the payload omits `recommendedSections`
 * (legacy/abnormal). Do not treat empty/missing array as “show full dashboard.”
 */
export function recommendedSectionsFallbackForMode(mode: DashboardMode | null): DashboardSectionKey[] {
  switch (mode) {
    case 'onboarding':
      return ['hero', 'today_plan', 'onboarding', 'cv', 'landscape', 'summary_metrics'];
    case 'execution_focus':
      return ['hero', 'today_plan', 'analyze', 'cv', 'landscape', 'summary_metrics'];
    case 'recovery':
      return ['hero', 'today_plan', 'revisit', 'landscape', 'summary_metrics', 'momentum'];
    case 'low_activity':
      return ['hero', 'today_plan', 'landscape', 'summary_metrics', 'momentum', 'revisit', 'analyze', 'cv'];
    case 'active_search':
      return ['hero', 'today_plan', 'analyze', 'momentum', 'revisit', 'landscape', 'summary_metrics', 'cv'];
    default:
      return ['hero', 'today_plan', 'analyze', 'momentum', 'revisit', 'landscape', 'summary_metrics', 'cv'];
  }
}

export function shouldRenderSection(
  section: DashboardSectionKey,
  plan: Pick<TodayPlanPayload, 'dashboardMode' | 'recommendedSections'> | null | undefined,
): boolean {
  const mode: DashboardMode | null = plan?.dashboardMode ?? null;
  const raw = plan?.recommendedSections ?? [];
  const effective = raw.length > 0 ? raw : recommendedSectionsFallbackForMode(mode);

  if (section === 'progress') {
    return effective.some((s) => s === 'progress' || s === 'momentum');
  }
  return effective.includes(section);
}

function hasExpLandscapeSurface(plan: TodayPlanPayload): boolean {
  const surfaces = plan.dashboardExperience?.surfaces;
  if (!surfaces?.length) return false;
  return surfaces.some(
    (s) => s.kind === 'informational' && (s as { id?: string | null }).id?.trim() === 'exp-landscape',
  );
}

function hasLandscapeSectionPayload(plan: TodayPlanPayload): boolean {
  const row = plan.sectionPayloads?.landscape;
  if (!row || typeof row !== 'object') return false;
  return Boolean(
    row.title?.trim() ||
      row.body?.trim() ||
      row.emptyStateCopy?.trim() ||
      row.sectionLabel?.trim(),
  );
}

/**
 * Landscape coaching + snapshot zone: show when recommended, or backend sent `exp-landscape`,
 * or `sectionPayloads.landscape` has displayable fields.
 */
export function shouldShowLandscapeSection(plan: TodayPlanPayload | null | undefined): boolean {
  if (!plan) return false;
  if (shouldRenderSection('landscape', plan)) return true;
  if (hasLandscapeSectionPayload(plan)) return true;
  return hasExpLandscapeSurface(plan);
}


export function isHeroDominant(plan: TodayPlanPayload | undefined): boolean {
  if (!plan?.dashboardHeader?.actionContext) return false;
  const hero = plan.dashboardHeader.actionContext;
  if (isSuppressedRecommendation(hero)) return false;
  return hero.surfaceOwnership === 'hero' || hero.recommendationClusterId !== null;
}

export function orchestratePriorities(items: UnifiedPriorityItem[]): UnifiedPriorityItem[] {
  return dedupeByCluster(items);
}
