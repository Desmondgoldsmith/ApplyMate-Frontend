'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCareerDashboard(enabled = true) {
  return useQuery({
    queryKey: ['career', 'dashboard'],
    queryFn: () => api.career.getDashboard(),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
