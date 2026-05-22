'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useJobAnalyses() {
  return useQuery({
    queryKey: ['job-analyses'],
    queryFn: () => api.jobs.listAnalyses(),
    staleTime: 1000 * 60 * 5,
  });
}
