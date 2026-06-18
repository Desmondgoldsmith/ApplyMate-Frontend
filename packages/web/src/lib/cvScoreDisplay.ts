import type { CVScorePayload } from '@/lib/api';

/** Numeric headline score from GET /cv/score — never wait on a follow-up fetch. */
export function resolveCvDisplayScore(payload: CVScorePayload | null | undefined): number | null {
  if (!payload) return null;
  const direct = payload.score;
  if (direct != null && Number.isFinite(direct)) return Math.round(direct);

  const breakdown = payload.breakdown as Record<string, unknown> | undefined;
  const fromBreakdown = breakdown?.overall ?? breakdown?.overallScore ?? breakdown?.score;
  if (typeof fromBreakdown === 'number' && Number.isFinite(fromBreakdown)) {
    return Math.round(fromBreakdown);
  }
  if (typeof fromBreakdown === 'string' && fromBreakdown.trim()) {
    const parsed = parseFloat(fromBreakdown);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }

  return null;
}

/** True only for the initial load before any score payload exists. */
export function isCvScoreInitialLoading(
  isPending: boolean,
  payload: CVScorePayload | null | undefined,
): boolean {
  if (!isPending) return false;
  return resolveCvDisplayScore(payload) == null;
}
