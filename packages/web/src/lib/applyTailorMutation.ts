import type { JobAnalysis, TailorMutationResponse } from '@/lib/api';
import { mergeTailorEstimatedScores } from '@/lib/tailorMatchScore';

export type ApplyTailorMutationRefs = {
  tailorBaselineScoreRef: { current: number | null };
  setScoreBeforeTailor: (score: number | null) => void;
  mergeJobAnalysisForApply: (prev: JobAnalysis | null, incoming: JobAnalysis) => JobAnalysis;
};

/** Prefer server `jobAnalysis` from tailor mutations; fall back to client score estimate. */
export function resolveAnalysisAfterTailorMutation(
  prev: JobAnalysis | null,
  result: TailorMutationResponse,
  refs: ApplyTailorMutationRefs,
): JobAnalysis | null {
  if (!prev) return prev;

  if (result.jobAnalysis) {
    const next = refs.mergeJobAnalysisForApply(prev, result.jobAnalysis);
    const sbt = next.scoreBeforeTailoring;
    if (sbt != null && Number.isFinite(sbt)) {
      if (refs.tailorBaselineScoreRef.current == null) {
        refs.tailorBaselineScoreRef.current = Math.round(sbt);
      }
      refs.setScoreBeforeTailor(Math.round(sbt));
    }
    return next;
  }

  const scored = mergeTailorEstimatedScores(prev, result.draft, refs.tailorBaselineScoreRef.current);
  if (scored.lockedBaseline != null) refs.tailorBaselineScoreRef.current = scored.lockedBaseline;
  if (scored.scoreBeforeTailor != null) refs.setScoreBeforeTailor(scored.scoreBeforeTailor);
  return scored.analysis;
}
