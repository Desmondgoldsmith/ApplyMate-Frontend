'use client';

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
      await queryClient.cancelQueries({ queryKey: ['job-history'] });
      const previous = queryClient.getQueryData<JobHistoryItem[]>(['job-history']);
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
      queryClient.setQueryData<JobHistoryItem[]>(['job-history'], (old = []) => [
        optimistic,
        ...old,
      ]);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['job-history'], context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<JobAnalysis>(['job-analysis-current'], data);
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
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      }
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['cv-profile'] });
      queryClient.invalidateQueries({ queryKey: ['cv-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['job-history'] });
      queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
      void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
      invalidateTodayPlanQueries(queryClient);
    },
  });
}

