'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { DashboardCollapsibleSection } from '@/components/dashboard/DashboardCollapsibleSection';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { sanitizeDashboardDisplayText } from '@/lib/dashboardDisplayCopy';
import { queryKeys } from '@/lib/queryKeys';
import {
  invalidateTodayPlanQueries,
  normalizedSectionTitle,
  type DashboardStaleApplicationItemPayload,
  type TodayPlanPayload,
} from '@/lib/today-plan';
import { cn } from '@/lib/utils';

const DASHBOARD_QUIET_HOME_CAP = 2;

type Props = {
  items: DashboardStaleApplicationItemPayload[];
  totalCount?: number | null;
  viewAllHref?: string | null;
  plan?: TodayPlanPayload | null;
};

function QuietApplicationRow({
  item,
  onArchive,
  archiving,
}: {
  item: DashboardStaleApplicationItemPayload;
  onArchive: (applicationId: string) => void;
  archiving: boolean;
}) {
  return (
    <li
      className={cn(
        'rounded-xl border border-[rgba(251,191,36,0.15)] bg-[rgba(251,191,36,0.04)] px-4 py-3.5',
        'transition-[border-color,background-color] duration-150 hover:border-[rgba(251,191,36,0.28)]',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <CompanyLogo company={item.company} logoUrl={item.companyLogoUrl} size="md" />
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
              {sanitizeDashboardDisplayText(item.headline)}
            </p>
            <span className="shrink-0 rounded-full border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.10)] px-2 py-0.5 text-[11px] font-medium text-[#FCD34D]">
              {item.lastActivityLabel}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium text-[var(--text-secondary)]">
            {sanitizeDashboardDisplayText(item.jobTitle)} · {sanitizeDashboardDisplayText(item.company)}
          </p>
          <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {sanitizeDashboardDisplayText(item.supporting)}
          </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[148px]">
          <Link
            href={item.ctaHref}
            className="inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-[#00C9B1]/45 px-3.5 py-1.5 text-center text-[12px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
          >
            {item.ctaLabel}
          </Link>
          {item.secondaryCtaLabel?.trim() ? (
            <button
              type="button"
              disabled={archiving}
              onClick={() => onArchive(item.applicationId)}
              className="inline-flex min-h-[36px] w-full items-center justify-center rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-medium text-white/65 transition-colors hover:border-white/[0.22] hover:text-white/85 disabled:opacity-60"
            >
              {item.secondaryCtaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function QuietApplicationsSection({ items, totalCount, viewAllHref, plan }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const archiveMutation = useMutation({
    mutationFn: (applicationId: string) => api.jobs.archive({ applicationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.archive() });
      invalidateTodayPlanQueries(queryClient);
      toast.success('Job archived');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) || 'Could not archive this job');
    },
  });

  const handleArchive = useCallback(
    (applicationId: string) => {
      archiveMutation.mutate(applicationId);
    },
    [archiveMutation],
  );

  if (!items.length) return null;

  const total =
    typeof totalCount === 'number' && Number.isFinite(totalCount)
      ? Math.max(0, Math.round(totalCount))
      : items.length;
  const visible = items.slice(0, DASHBOARD_QUIET_HOME_CAP);
  const showViewAll = total > DASHBOARD_QUIET_HOME_CAP;
  const moreCount = Math.max(0, total - visible.length);
  const heading = normalizedSectionTitle(plan, 'quiet_applications', 'Applications going quiet');
  const viewAll = (viewAllHref?.trim() || '/dashboard/quiet-applications').trim();

  const headerRight = showViewAll ? (
    <Link
      href={viewAll}
      className="inline-flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium leading-snug text-[var(--text-teal)] transition-opacity hover:opacity-80 hover:underline"
    >
      <span>View all →</span>
      {moreCount > 0 ? (
        <span className="font-normal text-[var(--text-muted)]">(+{moreCount} more)</span>
      ) : null}
    </Link>
  ) : null;

  return (
    <DashboardCollapsibleSection
      storageKey="quiet-applications"
      title={heading}
      countBadge={`${total} item${total === 1 ? '' : 's'}`}
      headerRight={headerRight}
      className="min-w-0"
      data-tour="dashboard-quiet-applications"
    >
      <ul
        id="dashboard-quiet-applications"
        className="mt-0 flex list-none flex-col gap-2 p-0"
        aria-label={heading}
      >
        {visible.map((item) => (
          <QuietApplicationRow
            key={item.id}
            item={item}
            onArchive={handleArchive}
            archiving={archiveMutation.isPending}
          />
        ))}
      </ul>
    </DashboardCollapsibleSection>
  );
}
