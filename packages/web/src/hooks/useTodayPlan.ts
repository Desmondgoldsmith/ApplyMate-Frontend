'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { todayPlanQueryKey } from '@/lib/today-plan';

export function useTodayPlan(params: {
  cvProfileId?: string | null;
  timezone: string;
  includeHiddenDashboardCards?: boolean;
  /** Optional focus feed cap (1–100) on GET /dashboard/today-plan. */
  focusFeedMaxItems?: number;
}) {
  const cv = (params.cvProfileId ?? '').trim() || undefined;
  const tz = (params.timezone ?? 'UTC').trim() || 'UTC';
  const includeHidden = params.includeHiddenDashboardCards === true;
  const ffm =
    typeof params.focusFeedMaxItems === 'number' &&
    Number.isFinite(params.focusFeedMaxItems) &&
    params.focusFeedMaxItems >= 1 &&
    params.focusFeedMaxItems <= 100
      ? Math.round(params.focusFeedMaxItems)
      : undefined;
  return useQuery({
    queryKey: todayPlanQueryKey({
      cvProfileId: cv,
      timezone: tz,
      includeHiddenDashboardCards: includeHidden,
      ...(ffm != null ? { focusFeedMaxItems: ffm } : {}),
    }),
    queryFn: () =>
      api.dashboard.getTodayPlan({
        cvProfileId: cv,
        timezone: tz,
        includeHiddenDashboardCards: includeHidden,
        ...(ffm != null ? { focusFeedMaxItems: ffm } : {}),
      }),
    /** Fresh counts (pipeline snapshot, digest) when returning from Job Hub / interviews — client navigation does not refocus the window. */
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}
