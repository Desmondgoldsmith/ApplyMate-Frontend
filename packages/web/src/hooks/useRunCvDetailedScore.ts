'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { api, type CVScorePayload, type CvImprovementsPayload } from '@/lib/api';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

export type RunDetailedScoreVariables =
  | string
  | null
  | undefined
  | {
      cvProfileId?: string | null;
      jobDescription?: string;
      targetRole?: string;
      /**
       * Job-aware score is ephemeral (not persisted as canonical score).
       * Skip React Query suggestion/score cache writes so stored suggestions stay stable.
       */
      ephemeralJobPreview?: boolean;
    };

function normalizeRunDetailedVariables(v: RunDetailedScoreVariables): {
  cvProfileId?: string | null;
  jobDescription?: string;
  targetRole?: string;
  ephemeralJobPreview: boolean;
} {
  if (v !== null && typeof v === 'object') {
    return {
      cvProfileId: v.cvProfileId,
      jobDescription: v.jobDescription,
      targetRole: v.targetRole,
      ephemeralJobPreview: v.ephemeralJobPreview === true,
    };
  }
  return { cvProfileId: v ?? undefined, ephemeralJobPreview: false };
}

export function useRunCvDetailedScore() {
  const queryClient = useQueryClient();
  const scoreAbortRef = useRef<AbortController | null>(null);
  return useMutation({
    mutationKey: ['cv-detailed-score'],
    mutationFn: async (variables: RunDetailedScoreVariables): Promise<CVScorePayload> => {
      scoreAbortRef.current?.abort();
      const ac = new AbortController();
      scoreAbortRef.current = ac;
      const { cvProfileId, jobDescription, targetRole } = normalizeRunDetailedVariables(variables);
      const id = cvProfileId?.trim();
      if (id) {
        return api.cv.getProfileScoreDetailed(id, {
          signal: ac.signal,
          jobDescription,
          targetRole,
        });
      }
      return api.cv.getScoreDetailed(undefined, {
        signal: ac.signal,
        jobDescription,
        targetRole,
      });
    },
    onSuccess: (payload, variables) => {
      const { ephemeralJobPreview, cvProfileId } = normalizeRunDetailedVariables(variables);
      if (ephemeralJobPreview) return;

      const list = payload.improvements ?? [];
      const next: CvImprovementsPayload = {
        improvements: list,
        needsScoring: false,
        pendingSuggestionsCount: list.length,
      };
      queryClient.setQueryData<CvImprovementsPayload>(cvSuggestionsQueryKey(cvProfileId), next);
      const id = cvProfileId?.trim();
      queryClient.setQueryData<CVScorePayload>(queryKeys.cv.score(id ?? 'default'), payload);
      if (id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id), exact: true });
      }
    },
  });
}
