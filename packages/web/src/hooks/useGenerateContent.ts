'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.jobs.generate,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      const jid = variables.jobAnalysisId?.trim();
      if (jid) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.generated(jid) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analysis(jid) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
      }
      invalidateTodayPlanQueries(queryClient);
    },
  });
}

