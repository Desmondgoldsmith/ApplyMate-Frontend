'use client';

import { queryKeys } from '@/lib/queryKeys';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

/** Matches backend max for GET /jobs/history (clamp in hook). */
export const JOB_HISTORY_PAGE_SIZE = 20;

export function useJobHistory(params?: {
  limit?: number;
  offset?: number;
  includeAccepted?: boolean;
}) {
  const authSessionReady = useAuthStore((s) => s.authSessionReady);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasPagination =
    params != null && (params.limit !== undefined || params.offset !== undefined);
  const includeAccepted = params?.includeAccepted === true;
  return useQuery({
    queryKey: hasPagination
      ? queryKeys.jobs.historyWithPagination(params!.limit ?? 'all', params!.offset ?? 0, includeAccepted)
      : queryKeys.jobs.history(includeAccepted),
    queryFn: () => api.jobs.getHistory(params),
    enabled: authSessionReady && Boolean(accessToken),
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

/** Paginated history for dashboards; queryKey is prefixed with `job-history` so existing invalidations apply. */
export function useJobHistoryPage(pageIndex: number, pageSize = JOB_HISTORY_PAGE_SIZE) {
  const authSessionReady = useAuthStore((s) => s.authSessionReady);
  const accessToken = useAuthStore((s) => s.accessToken);
  const limit = Math.min(Math.max(1, pageSize), 50);
  const offset = pageIndex * limit;
  return useQuery({
    queryKey: queryKeys.jobs.historyPage(limit, offset),
    queryFn: () => api.jobs.getHistoryPaginated({ limit, offset }),
    enabled: authSessionReady && Boolean(accessToken),
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}

