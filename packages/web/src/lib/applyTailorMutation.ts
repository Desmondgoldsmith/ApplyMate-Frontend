import type { QueryClient } from '@tanstack/react-query';

import type { JobAnalysis, TailorMutationResponse } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
export type ApplyTailorMutationRefs = {
  tailorBaselineScoreRef: { current: number | null };
  setScoreBeforeTailor: (score: number | null) => void;
  mergeJobAnalysisForApply: (prev: JobAnalysis | null, incoming: JobAnalysis) => JobAnalysis;
};

/** Sync job analysis caches after tailor accept so Hub/analyzer do not show stale factors. */
export function commitTailorJobAnalysis(
  next: JobAnalysis,
  queryClient: QueryClient,
): void {
  const jobId = (next.id ?? '').trim();
  queryClient.setQueryData(queryKeys.jobs.analysisCurrent(), next);
  if (jobId) {
    queryClient.setQueryData(queryKeys.jobs.analysis(jobId), next);
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
  if (jobId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analysis(jobId) });
  }
}

/** Prefer server `jobAnalysis` from tailor mutations; fall back to client score estimate. */
export function resolveAnalysisAfterTailorMutation(
  prev: JobAnalysis | null,
  result: TailorMutationResponse,
  refs: ApplyTailorMutationRefs,
): JobAnalysis | null {
  if (!prev) return prev;

  if (result.jobAnalysis) {
    const next = result.jobAnalysis;
    const sbt = next.scoreBeforeTailoring;
    if (sbt != null && Number.isFinite(sbt)) {
      if (refs.tailorBaselineScoreRef.current == null) {
        refs.tailorBaselineScoreRef.current = Math.round(sbt);
      }
      refs.setScoreBeforeTailor(Math.round(sbt));
    } else if (!next.isTailored) {
      refs.setScoreBeforeTailor(null);
    }
    return next;
  }

  return prev;
}
