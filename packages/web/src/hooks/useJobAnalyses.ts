'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useJobAnalyses() {
  return useQuery({
    queryKey: queryKeys.jobs.analyses(),
    queryFn: () => api.jobs.listAnalyses(),
    staleTime: 1000 * 60 * 5,
  });
}
