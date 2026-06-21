'use client';

import { useQuery } from '@tanstack/react-query';

import { api, type CVImprovementItem, type CvImprovementsPayload } from '@/lib/api';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

/** Older cache entries may still be a bare array before refetch. */
function coerceImprovementsPayload(
  data: CvImprovementsPayload | CVImprovementItem[] | undefined,
): CvImprovementsPayload {
  if (!data) return { improvements: [], needsScoring: false };
  if (Array.isArray(data)) return { improvements: data, needsScoring: false };
  return {
    improvements: data.improvements ?? [],
    needsScoring: Boolean(data.needsScoring),
    pendingSuggestionsCount: data.pendingSuggestionsCount,
    score: data.score,
    lastScoredAt: data.lastScoredAt,
    cvRevisionId: data.cvRevisionId,
    acceptAllQuota: data.acceptAllQuota ?? null,
    lastPublishedSectionScores: data.lastPublishedSectionScores ?? null,
  };
}

export function useCVImprovements(enabled = true, cvProfileId?: string | null) {
  return useQuery({
    queryKey: cvSuggestionsQueryKey(cvProfileId),
    queryFn: () => api.cv.getSuggestions(cvProfileId ?? undefined, false),
    select: coerceImprovementsPayload,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });
}
