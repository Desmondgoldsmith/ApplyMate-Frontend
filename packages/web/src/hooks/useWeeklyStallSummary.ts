'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { clampWeeklyStallLimit, weeklyStallSummaryQueryKey } from '@/lib/weekly-stall-summary';

export function useWeeklyStallSummary(params?: { limit?: number }) {
  const limit = clampWeeklyStallLimit(params?.limit);
  return useQuery({
    queryKey: weeklyStallSummaryQueryKey({ limit }),
    queryFn: () => api.dashboard.getWeeklyStallSummary({ limit }),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}
