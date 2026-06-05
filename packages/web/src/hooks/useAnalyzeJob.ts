'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, type JobAnalysis, type JobHistoryItem } from '@/lib/api';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { useConsumeImmediateGrowthFeedback } from './useGrowth';

export function useAnalyzeJob() {
  const queryClient = useQueryClient();
  const consumeFeedback = useConsumeImmediateGrowthFeedback();

  return useMutation({
    mutationFn: api.jobs.analyze,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.jobs.history() });
      const previous = queryClient.getQueryData<JobHistoryItem[]>(queryKeys.jobs.history());
      const optimistic: JobHistoryItem = {
        id: `optimistic-${Date.now()}`,
        jobTitle: input.title ?? '',
        company: input.company ?? '',
        matchScore: 0,
        recommendation: '',
        createdAt: new Date().toISOString(),
        scoreBeforeTailoring: null,
        tailoredCvProfileId: null,
        tailoredCvName: null,
        isTailored: false,
        hasCoverLetter: false,
        title: input.title,
      };
      queryClient.setQueryData<JobHistoryItem[]>(queryKeys.jobs.history(), (old = []) => [
        optimistic,
        ...old,
      ]);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.jobs.history(), context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<JobAnalysis>(queryKeys.jobs.analysisCurrent(), data);
      const jobAnalysisId = (data.id ?? '').trim() || null;
      void api.growth.trackEvent({
        eventName: 'analyze_completed',
        context: {
          jobAnalysisId,
          jobId: jobAnalysisId,
          matchScoreAfter: data.matchScore,
        },
      });
      /** Preview / heuristic-only completion — skip extra growth nudges when no AI report was produced. */
      const shallowHeuristic =
        data.scoreSource === 'heuristic' && !data.analysisV2 && !data.reusedExistingAnalysis;
      if (!shallowHeuristic) {
        void consumeFeedback();
      }
      if (data.scoreSource !== 'heuristic') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
      invalidateTodayPlanQueries(queryClient);
    },
  });
}

