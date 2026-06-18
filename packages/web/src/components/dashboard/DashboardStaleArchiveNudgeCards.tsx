'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useToast } from '@/components/ui/Toast';
import { useApplications } from '@/hooks/useApplications';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryKeys';
import {
  readArchiveNudgeDismissals,
  selectStaleApplicationNudges,
  writeArchiveNudgeDismissal,
  type StaleApplicationNudge,
} from '@/lib/dashboardStaleApplicationNudges';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

type Props = {
  enabled: boolean;
};

function StaleArchiveNudgeCard({
  nudge,
  onArchive,
  onDismiss,
  archiving,
}: {
  nudge: StaleApplicationNudge;
  onArchive: (id: string) => void;
  onDismiss: (id: string) => void;
  archiving: boolean;
}) {
  return (
    <div
      className="mb-2 rounded-xl border border-[rgba(248,113,113,0.15)] bg-[rgba(248,113,113,0.06)] px-4 py-3.5"
      data-stale-archive-nudge={nudge.applicationId}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[#F0F4F2]">
          {nudge.jobTitle}
        </p>
        <span className="shrink-0 rounded-full border border-[rgba(248,113,113,0.20)] bg-[rgba(248,113,113,0.10)] px-2 py-0.5 text-[11px] font-medium text-[#F87171]">
          {nudge.daysSinceUpdate} days
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[rgba(240,244,242,0.50)]">{nudge.company}</p>
      <p className="mt-2 text-[12px] leading-[1.5] text-[rgba(240,244,242,0.50)]">
        No updates in {nudge.daysSinceUpdate} days. It may be worth archiving this one and
        focusing your energy on active roles.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={archiving}
          onClick={() => onArchive(nudge.applicationId)}
          className="rounded-lg border border-[rgba(248,113,113,0.20)] bg-[rgba(248,113,113,0.10)] px-3 py-1.5 text-[12px] font-medium text-[#F87171] transition-colors hover:bg-[rgba(248,113,113,0.18)] disabled:opacity-60"
        >
          Archive this job
        </button>
        <button
          type="button"
          disabled={archiving}
          onClick={() => onDismiss(nudge.applicationId)}
          className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-1.5 text-[12px] text-[rgba(240,244,242,0.40)] transition-colors hover:text-[rgba(240,244,242,0.70)] disabled:opacity-60"
        >
          Keep it active
        </button>
      </div>
    </div>
  );
}

export function DashboardStaleArchiveNudgeCards({ enabled }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const applications = useApplications();
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dismissedSnapshot] = useState(() => readArchiveNudgeDismissals());

  const nudges = useMemo(() => {
    if (!enabled) return [];
    return selectStaleApplicationNudges(applications.data, dismissedSnapshot).filter(
      (n) => !hiddenIds.has(n.applicationId),
    );
  }, [applications.data, dismissedSnapshot, enabled, hiddenIds]);

  const archiveMutation = useMutation({
    mutationFn: (applicationId: string) =>
      api.jobs.archive({ applicationId }),
    onSuccess: (_data, applicationId) => {
      setHiddenIds((prev) => new Set(prev).add(applicationId));
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.archive() });
      invalidateTodayPlanQueries(queryClient);
    },
    onError: (err, applicationId) => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
      toast.error(getApiErrorMessage(err) || 'Could not archive this job');
    },
  });

  const handleArchive = useCallback(
    (applicationId: string) => {
      setHiddenIds((prev) => new Set(prev).add(applicationId));
      archiveMutation.mutate(applicationId);
    },
    [archiveMutation],
  );

  const handleDismiss = useCallback((applicationId: string) => {
    writeArchiveNudgeDismissal(applicationId);
    setHiddenIds((prev) => new Set(prev).add(applicationId));
  }, []);

  if (!nudges.length) return null;

  return (
    <div className="mb-2">
      {nudges.map((nudge) => (
        <StaleArchiveNudgeCard
          key={nudge.applicationId}
          nudge={nudge}
          onArchive={handleArchive}
          onDismiss={handleDismiss}
          archiving={archiveMutation.isPending}
        />
      ))}
    </div>
  );
}
