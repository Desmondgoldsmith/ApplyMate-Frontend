'use client';

import { useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useDashboardFollowUpJobs } from '@/hooks/useDashboardFollowUpJobs';

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

  const followUpQuery = useDashboardFollowUpJobs({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
    focusFeedMaxItems: 100,
  });

  if (followUpQuery.isLoading && !followUpQuery.data) {
    return <FollowUpJobsSkeleton />;
  }

  if (followUpQuery.isError) {
    return (
      <GlowCard contentClassName="p-6">
        <p className="text-sm text-rose-200">Could not load your follow-up queue.</p>
        <Button className="mt-4" variant="ghost" onClick={() => void followUpQuery.refetch()}>
          Retry
        </Button>
      </GlowCard>
    );
  }

  return (
    <FollowUpJobsView
      jobs={followUpQuery.data?.followUpJobs ?? []}
      serverTotalCount={followUpQuery.data?.followUpJobsTotalCount ?? null}
    />
  );
}
