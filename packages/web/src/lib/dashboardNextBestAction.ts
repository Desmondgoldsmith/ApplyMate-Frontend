import type { TodayPlanPayload } from '@/lib/today-plan';

/** VM for the Recommended Move strip — only populated from `todayPlan.recommendedMove` (server-side selection + dedupe). */
export type NextBestActionVm = {
  headline: string;
  supporting: string | null;
  confidence: number | null;
  priority: number | null;
  category: string | null;
  /** Wire `recommendedMove.source` (analytics / debug only). */
  backendSource: string | null;
  ctaLabel: string;
  ctaHref: string;
  dedupeHref: string;
};

function clampPct(n: unknown): number | null {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  return null;
}

function fromRecommendedMovePayload(plan: TodayPlanPayload | null | undefined): NextBestActionVm | null {
  const rm = plan?.recommendedMove;
  if (!rm) return null;
  const headline = rm.headline?.trim() ?? '';
  const label = rm.ctaLabel?.trim() ?? '';
  const href = rm.ctaHref?.trim() ?? '';
  if (!headline || !label || !href) return null;
  return {
    headline,
    supporting: rm.supporting?.trim() || null,
    confidence: clampPct(rm.confidence),
    priority: clampPct(rm.priority),
    category: rm.category?.trim() || null,
    backendSource: rm.source?.trim() || null,
    ctaLabel: label,
    ctaHref: href,
    dedupeHref: href,
  };
}

/** Recommended Move: use backend `recommendedMove` only (no client-side candidate selection or suppression). */
export function resolveRecommendedMove(plan: TodayPlanPayload | null | undefined): NextBestActionVm | null {
  return fromRecommendedMovePayload(plan);
}
