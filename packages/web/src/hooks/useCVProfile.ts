'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCVProfile() {
  return useQuery({
    queryKey: ['cv-profile'],
    queryFn: api.cv.getProfile,
    staleTime: 60_000,
  });
}

