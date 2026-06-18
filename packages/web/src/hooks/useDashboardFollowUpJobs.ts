'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { dashboardFollowUpJobsQueryKey } from '@/lib/today-plan';

export function useDashboardFollowUpJobs(params: {
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
      : 100;
  return useQuery({
    queryKey: dashboardFollowUpJobsQueryKey({
      cvProfileId: cv,
      timezone: tz,
      focusFeedMaxItems: ffm,
    }),
    queryFn: () =>
      api.dashboard.getFollowUpJobs({
        cvProfileId: cv,
        timezone: tz,
        focusFeedMaxItems: ffm,
      }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
