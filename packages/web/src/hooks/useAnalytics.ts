'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export function useAnalytics() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    /** Scope per auth session to avoid stale cross-account analytics. */
    queryKey: queryKeys.analytics.root(accessToken ?? ''),
    queryFn: api.analytics.getOverview,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    enabled: Boolean(accessToken),
  });
}

