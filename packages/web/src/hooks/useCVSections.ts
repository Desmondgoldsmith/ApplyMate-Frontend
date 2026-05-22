'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCVSections(includeHidden?: boolean, enabled = true) {
  return useQuery({
    queryKey: ['cv-sections', includeHidden ?? false],
    queryFn: () => api.cv.getSections(includeHidden),
    staleTime: 60_000,
    enabled,
  });
}
