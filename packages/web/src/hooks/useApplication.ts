'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useApplication(applicationId: string | null | undefined) {
  const id = (applicationId ?? '').trim();
  return useQuery({
    queryKey: queryKeys.applications.detail(id || 'none'),
    queryFn: () => api.applications.getById(id),
    enabled: Boolean(id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
