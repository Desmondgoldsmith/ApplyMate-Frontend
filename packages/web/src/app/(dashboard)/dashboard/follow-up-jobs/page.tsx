'use client';

import { useMemo } from 'react';

import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useTodayPlan } from '@/hooks/useTodayPlan';

import { FollowUpJobsSkeleton } from './FollowUpJobsSkeleton';
import { FollowUpJobsView } from './FollowUpJobsView';

export default function FollowUpJobsPage() {
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

  const todayPlan = useTodayPlan({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
  });

  if (todayPlan.isLoading) {
    return <FollowUpJobsSkeleton />;
  }

  return (
    <FollowUpJobsView jobs={todayPlan.data?.followUpJobs ?? []} serverTotalCount={todayPlan.data?.followUpJobsTotalCount ?? null} />
  );
}
