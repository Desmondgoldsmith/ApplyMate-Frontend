'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { dashboardFocusQueryKey } from '@/lib/today-plan';

export function useDashboardFocus(params: { cvProfileId?: string | null; timezone: string }) {
  const cv = (params.cvProfileId ?? '').trim() || undefined;
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  return useQuery({
    queryKey: dashboardFocusQueryKey({ cvProfileId: cv, timezone: tz }),
    queryFn: () =>
      api.dashboard.getDashboardFocus({
        cvProfileId: cv,
        timezone: tz,
      }),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}
