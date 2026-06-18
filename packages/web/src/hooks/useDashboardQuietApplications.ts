'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { dashboardQuietApplicationsQueryKey } from '@/lib/today-plan';

export function useDashboardQuietApplications(params: {
  cvProfileId?: string | null;
  timezone: string;
  focusFeedMaxItems?: number;
}) {
  const cv = (params.cvProfileId ?? '').trim() || undefined;
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  const ffm =
    typeof params.focusFeedMaxItems === 'number' &&
    Number.isFinite(params.focusFeedMaxItems) &&
    params.focusFeedMaxItems >= 1 &&
    params.focusFeedMaxItems <= 100
      ? Math.round(params.focusFeedMaxItems)
      : undefined;
  return useQuery({
    queryKey: dashboardQuietApplicationsQueryKey({
      cvProfileId: cv,
      timezone: tz,
      focusFeedMaxItems: ffm,
    }),
    queryFn: () =>
      api.dashboard.getQuietApplications({
        cvProfileId: cv,
        timezone: tz,
        ...(ffm != null ? { focusFeedMaxItems: ffm } : {}),
      }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}
