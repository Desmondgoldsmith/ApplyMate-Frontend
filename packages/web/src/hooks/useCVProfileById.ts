'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCVProfileById(id: string | null) {
  return useQuery({
    queryKey: queryKeys.cv.profile(id ?? ''),
    queryFn: () => api.cv.getProfileById(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}
