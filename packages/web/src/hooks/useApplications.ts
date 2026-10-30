'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { refetchOnMountUnlessJustFailed } from '@/lib/queryRefetch';

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.applications.root(),
    queryFn: () => api.applications.getAll(),
    staleTime: 60_000,
    refetchOnMount: refetchOnMountUnlessJustFailed,
  });
}
