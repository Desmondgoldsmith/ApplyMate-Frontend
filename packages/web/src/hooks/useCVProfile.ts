'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCVProfile() {
  return useQuery({
    queryKey: queryKeys.cv.profileDefault(),
    queryFn: api.cv.getProfile,
    staleTime: 60_000,
  });
}

