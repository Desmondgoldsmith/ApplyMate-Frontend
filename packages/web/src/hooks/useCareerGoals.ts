'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type CareerGoalsWorkspace } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

export const careerGoalsQueryKey = queryKeys.career.goals();

export function useCareerGoals() {
  return useQuery({
    queryKey: careerGoalsQueryKey,
    queryFn: () => api.careerGoals.get(),
  });
}

export function useSaveCareerGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CareerGoalsWorkspace) => api.careerGoals.put(body),
    onSuccess: (data) => {
      queryClient.setQueryData(careerGoalsQueryKey, data);
      invalidateTodayPlanQueries(queryClient);
    },
  });
}
