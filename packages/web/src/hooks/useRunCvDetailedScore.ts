'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { api, type CVScorePayload } from '@/lib/api';
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
    mutationFn: async (
      variables: RunDetailedScoreVariables,
    ): Promise<CVScorePayload> => {
      scoreAbortRef.current?.abort();
      const ac = new AbortController();
      scoreAbortRef.current = ac;
      const { cvProfileId, jobDescription, targetRole } =
        normalizeRunDetailedVariables(variables);
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
    onSuccess: (_payload, variables) => {
      const { ephemeralJobPreview, cvProfileId } =
        normalizeRunDetailedVariables(variables);
      if (ephemeralJobPreview) return;

      // Reload both from the server rather than writing this response into them: the scan's
      // tip list is not the user's queue (earlier tips, previews, dismissals) and its score has
      // a different shape, which made tips vanish and section scores drop after every edit.
      const id = cvProfileId?.trim();
      void queryClient.invalidateQueries({
        queryKey: cvSuggestionsQueryKey(cvProfileId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv.score(id ?? 'default'),
        exact: true,
      });
      if (id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.cv.profile(id),
          exact: true,
        });
      }
    },
  });
}
