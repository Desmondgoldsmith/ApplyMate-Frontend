'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCVSections(includeHidden?: boolean, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cv.sectionsActive(includeHidden ?? false),
    queryFn: () => api.cv.getSections(includeHidden),
    staleTime: 60_000,
    enabled,
  });
}
