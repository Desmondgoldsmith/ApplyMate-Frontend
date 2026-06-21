import type { CVScorePayload } from '@/lib/api';

/** Numeric headline score from GET /cv/score — never wait on a follow-up fetch. */
export function resolveCvDisplayScore(
  payload: CVScorePayload | null | undefined,
  fallbackScore?: number | null,
): number | null {
  if (!payload) {
    if (fallbackScore != null && Number.isFinite(fallbackScore)) {
      return Math.round(fallbackScore);
    }
    return null;
  }
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

  if (fallbackScore != null && Number.isFinite(fallbackScore)) {
    return Math.round(fallbackScore);
  }

  return null;
}

/** Preserve last published section scores while rescoring (`needsScoring`). */
export function mergeBreakdownWithPublishedSections(
  breakdown: Record<string, unknown> | undefined,
  lastPublished: Record<string, number> | null | undefined,
): Record<string, unknown> | undefined {
  if (!breakdown || !lastPublished || Object.keys(lastPublished).length === 0) {
    return breakdown;
  }
  const sections = breakdown.sections;
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) {
    return breakdown;
  }
  const mergedSections: Record<string, unknown> = {
    ...(sections as Record<string, unknown>),
  };
  for (const [key, publishedScore] of Object.entries(lastPublished)) {
    if (typeof publishedScore !== 'number' || !Number.isFinite(publishedScore)) continue;
    const score = Math.round(Math.max(0, Math.min(100, publishedScore)));
    const existing = mergedSections[key];
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      mergedSections[key] = { ...(existing as Record<string, unknown>), score };
    } else {
      mergedSections[key] = { score, weight: 0, feedback: '', flags: [] };
    }
  }
  return { ...breakdown, sections: mergedSections };
}

/** True only for the initial load before any score payload exists. */
export function isCvScoreInitialLoading(
  isPending: boolean,
  payload: CVScorePayload | null | undefined,
): boolean {
  if (!isPending) return false;
  return resolveCvDisplayScore(payload) == null;
}
