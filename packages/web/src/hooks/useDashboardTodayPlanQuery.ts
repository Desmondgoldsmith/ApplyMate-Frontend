'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useTodayPlan } from '@/hooks/useTodayPlan';

/** Shared today-plan query for dashboard overview and section panels (React Query dedupes). */
export function useDashboardTodayPlanQuery() {
  const searchParams = useSearchParams();
  const includeHiddenDashboardCards =
    searchParams.get('includeHiddenDashboardCards') === 'true';
  const { displayRows } = useCvProfileRowsDisplay();
  const defaultProfile = useMemo(
    () => displayRows.find((p) => p.isDefault) ?? displayRows[0] ?? null,
    [displayRows],
  );
  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  return useTodayPlan({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
    includeHiddenDashboardCards,
  });
}
