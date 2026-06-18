import type { CvTailorDraft } from '@/lib/api';

/** Lock baseline at tailor start; never treat post-tailor server score as the "before" value. */
export function resolveTailorBaselineScore(
  lockedBaseline: number | null,
  analysisScoreBeforeTailoring: number | null | undefined,
  currentMatchScore: number | null | undefined,
): number | null {
  if (lockedBaseline != null && Number.isFinite(lockedBaseline)) return lockedBaseline;
  if (analysisScoreBeforeTailoring != null && Number.isFinite(analysisScoreBeforeTailoring)) {
    return analysisScoreBeforeTailoring;
  }
  if (currentMatchScore != null && Number.isFinite(currentMatchScore)) return currentMatchScore;
  return null;
}

export type TailorScoreMergeResult = {
  analysis: { matchScore: number; scoreBeforeTailoring: number | null };
  lockedBaseline: number | null;
  scoreBeforeTailor: number | null;
};

/**
 * Trust stored `matchScore` from the API — no client-side preview or partial-tailor estimation.
 * Score delta copy uses `scoreBeforeTailoring` only when `isTailored === true`.
 */
export function mergeTailorEstimatedScores<T extends {
  matchScore?: number;
  scoreBeforeTailoring?: number | null;
  isTailored?: boolean;
}>(
  analysis: T,
  _draft: CvTailorDraft | null | undefined,
  lockedBaseline: number | null,
): TailorScoreMergeResult & { analysis: T & { matchScore: number; scoreBeforeTailoring: number | null } } {
  const matchScore =
    analysis.matchScore != null && Number.isFinite(analysis.matchScore)
      ? Math.round(analysis.matchScore)
      : 0;

  const scoreBeforeTailoring =
    analysis.isTailored === true
      ? resolveTailorBaselineScore(lockedBaseline, analysis.scoreBeforeTailoring, undefined)
      : analysis.scoreBeforeTailoring ?? null;

  const nextLocked =
    lockedBaseline ??
    (analysis.scoreBeforeTailoring != null && Number.isFinite(analysis.scoreBeforeTailoring)
      ? Math.round(analysis.scoreBeforeTailoring)
      : null);

  return {
    analysis: {
      ...analysis,
      matchScore,
      scoreBeforeTailoring:
        analysis.isTailored === true
          ? scoreBeforeTailoring ?? null
          : analysis.scoreBeforeTailoring ?? null,
    },
    lockedBaseline: nextLocked,
    scoreBeforeTailor: analysis.isTailored === true ? scoreBeforeTailoring : null,
  };
}
