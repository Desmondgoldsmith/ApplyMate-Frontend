'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.jobs.generate,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      const jid = variables.jobAnalysisId?.trim();
      if (jid) {
        void queryClient.invalidateQueries({ queryKey: ['job-generated', jid] });
        void queryClient.invalidateQueries({ queryKey: ['job', jid] });
        void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
      }
      invalidateTodayPlanQueries(queryClient);
    },
  });
}

