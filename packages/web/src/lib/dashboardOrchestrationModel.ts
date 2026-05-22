import type {
  CanonicalRecommendation,
  OrchestratedRecommendation,
  TodayPlanPayload,
  UnifiedPriorityItem,
} from '@/lib/today-plan';

/** Backend orchestration v1 is active when version ≥ 1 and rows exist. */
export function isOrchestrationV1(plan: TodayPlanPayload | null | undefined): boolean {
  return Boolean(plan && plan.orchestrationVersion >= 1 && plan.orchestratedRecommendations.length > 0);
}

export function orchestratedRowByRecommendationId(
  plan: TodayPlanPayload,
): Map<string, OrchestratedRecommendation> {
  const m = new Map<string, OrchestratedRecommendation>();
  for (const r of plan.orchestratedRecommendations) {
    const id = (r.recommendationId ?? '').trim();
    if (id) m.set(id, r);
  }
  return m;
}

export function canonicalRowByRecommendationId(plan: TodayPlanPayload): Map<string, CanonicalRecommendation> {
  const m = new Map<string, CanonicalRecommendation>();
  for (const r of plan.recommendationGraph) {
    const id = (r.recommendationId ?? '').trim();
    if (id) m.set(id, r);
  }
  return m;
}

export function getOrchestratedRowForItem(
  plan: TodayPlanPayload,
  item: UnifiedPriorityItem,
): OrchestratedRecommendation | null {
  return orchestratedRowByRecommendationId(plan).get(item.id) ?? null;
}

const PRIORITY_SURFACES = new Set(['top_priority', 'secondary_priority']);

/**
 * Surfaces that render as primary actionable cards (backend-assigned).
 * Excludes hero, continuation, nudges, revisit, hidden.
 */
export function isPrimaryPrioritySurface(surface: string | null | undefined): boolean {
  const s = String(surface ?? '')
    .trim()
    .toLowerCase();
  return PRIORITY_SURFACES.has(s);
}

export function effectiveContinuationRecommendationId(plan: TodayPlanPayload): string | null {
  const hint = plan.continuationHint?.recommendationId?.trim();
  if (hint) return hint;
  const nar = plan.dashboardNarrative?.continuationRecommendationId?.trim();
  if (nar) return nar;
  return plan.continuationState.suggestedPriorityId?.trim() ?? null;
}

export function effectiveHeroRecommendationId(plan: TodayPlanPayload): string | null {
  return plan.dashboardNarrative?.heroRecommendationId?.trim() ?? null;
}
