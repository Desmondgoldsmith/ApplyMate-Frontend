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

function countReviewed(draft: CvTailorDraft | null | undefined): {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
} {
  const drafts = draft?.drafts ?? [];
  const total = drafts.length;
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  for (const d of drafts) {
    if (d.status === 'accepted') accepted += 1;
    else if (d.status === 'rejected') rejected += 1;
    else pending += 1;
  }
  return { total, accepted, rejected, pending };
}

/**
 * Realistic partial-tailor uplift: proportional to accepted sections, capped (~18pt max).
 * Prevents 65% → 95% after only two sections when the API returns an optimistic score.
 */
export function estimateTailorMatchScore(
  baseline: number,
  draft: CvTailorDraft | null | undefined,
  serverScore: number | null | undefined,
): number {
  const base = Math.round(Math.max(0, Math.min(100, baseline)));
  const { total, accepted } = countReviewed(draft);
  if (accepted <= 0) return base;

  const server =
    serverScore != null && Number.isFinite(serverScore)
      ? Math.round(Math.max(0, Math.min(100, serverScore)))
      : base;

  if (total <= 0) return Math.max(base, server);

  const completionRatio = accepted / total;
  const headroom = Math.max(0, 100 - base);
  const maxUplift = Math.min(18, Math.round(headroom * 0.4));
  const estimated = base + Math.round(maxUplift * completionRatio);

  if (accepted >= total) {
    return Math.max(estimated, server);
  }

  return Math.min(server, Math.max(estimated, base));
}

export type TailorScoreMergeResult = {
  analysis: { matchScore: number; scoreBeforeTailoring: number | null };
  lockedBaseline: number | null;
  scoreBeforeTailor: number | null;
};

/** Apply realistic partial-tailor scores onto a job analysis row (client-side until rematch returns authoritative values). */
export function mergeTailorEstimatedScores<T extends { matchScore?: number; scoreBeforeTailoring?: number | null }>(
  analysis: T,
  draft: CvTailorDraft | null | undefined,
  lockedBaseline: number | null,
): TailorScoreMergeResult & { analysis: T & { matchScore: number; scoreBeforeTailoring: number | null } } {
  const { before, after } = tailorScoreAfterReview(lockedBaseline, draft, analysis);
  const nextLocked =
    lockedBaseline != null && Number.isFinite(lockedBaseline)
      ? lockedBaseline
      : before != null && Number.isFinite(before)
        ? before
        : null;

  if (before == null || after == null) {
    const matchScore =
      analysis.matchScore != null && Number.isFinite(analysis.matchScore)
        ? Math.round(analysis.matchScore)
        : 0;
    return {
      analysis: { ...analysis, matchScore, scoreBeforeTailoring: analysis.scoreBeforeTailoring ?? null },
      lockedBaseline: nextLocked,
      scoreBeforeTailor: before,
    };
  }

  return {
    analysis: {
      ...analysis,
      matchScore: after,
      scoreBeforeTailoring: before,
    },
    lockedBaseline: nextLocked,
    scoreBeforeTailor: before,
  };
}

export function tailorScoreAfterReview(
  baseline: number | null,
  draft: CvTailorDraft | null | undefined,
  serverAnalysis: { matchScore?: number; scoreBeforeTailoring?: number | null } | null,
): { before: number | null; after: number | null; accepted: number; total: number } {
  const before = resolveTailorBaselineScore(
    baseline,
    serverAnalysis?.scoreBeforeTailoring,
    serverAnalysis?.matchScore,
  );
  const { total, accepted } = countReviewed(draft);
  if (before == null) {
    return {
      before: null,
      after: serverAnalysis?.matchScore ?? null,
      accepted,
      total,
    };
  }
  const after = estimateTailorMatchScore(before, draft, serverAnalysis?.matchScore ?? null);
  return { before, after, accepted, total };
}
