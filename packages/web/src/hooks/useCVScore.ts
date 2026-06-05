'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCVScore(enabled = true, cvProfileId?: string | null) {
  return useQuery({
    queryKey: queryKeys.cv.score(cvProfileId ?? 'default'),
    queryFn: () => api.cv.getScore(cvProfileId ?? undefined),
    staleTime: 60_000,
    retry: 1,
    enabled,
  });
}
