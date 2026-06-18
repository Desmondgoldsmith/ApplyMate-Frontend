'use client';

import Link from 'next/link';

import { sanitizeDashboardDisplayText } from '@/lib/dashboardDisplayCopy';
import type { NextBestActionVm } from '@/lib/dashboardNextBestAction';
import { resolveFollowUpJobsListHref } from '@/lib/followUpListRoute';
import { cn } from '@/lib/utils';

type Props = {
  action: NextBestActionVm;
  /** From `normalizedSectionTitles.recommended_move` / `your_next_best_action` when provided. */
  sectionEyebrow: string;
  /** Length of parsed `followUpJobs` on today-plan (capped snapshot). */
  followUpJobsSnapshotCount?: number;
  followUpJobsTotalCount?: number | null;
  followUpJobsViewAllHref?: string | null;
};

export function DashboardRecommendedMoveSection({
  action,
  sectionEyebrow,
  followUpJobsSnapshotCount = 0,
  followUpJobsTotalCount = null,
  followUpJobsViewAllHref = null,
}: Props) {
  const supporting = sanitizeDashboardDisplayText(action.supporting?.trim() ?? '');

  const snap = Math.max(0, Math.round(followUpJobsSnapshotCount));
  const total =
    typeof followUpJobsTotalCount === 'number' &&
    Number.isFinite(followUpJobsTotalCount)
      ? Math.max(0, Math.round(followUpJobsTotalCount))
      : null;
  const hasMultipleFollowUps = snap > 1 || (total != null && total > 1);
  const followUpListHref = hasMultipleFollowUps
    ? resolveFollowUpJobsListHref(followUpJobsViewAllHref ?? null)
    : '';
  const followUpViewAllLabel =
    total != null && total > snap
      ? `View all follow-ups (${total})`
      : total != null && total > 1
        ? `View all follow-ups (${total})`
        : snap > 1
          ? `View all follow-ups (${snap})`
          : 'View all follow-ups';

  return (
    <section
      aria-label={sectionEyebrow}
      data-tour="recommended-move"
      className="scroll-mt-4 min-w-0"
      data-recommended-move-source={action.backendSource ?? undefined}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-teal)]">
        {sectionEyebrow}
      </p>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-teal)] border-l-[3px] border-l-[var(--teal)] bg-[var(--bg-surface)] py-3.5 pl-5 pr-5 sm:py-5 sm:pl-6 sm:pr-6">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
            {sanitizeDashboardDisplayText(action.headline)}
          </p>
          {hasMultipleFollowUps && followUpListHref ? (
            <Link
              href={followUpListHref}
              className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-full border border-[#00C9B1]/50 bg-transparent px-3 py-1.5 text-center text-[12px] font-semibold leading-tight text-[#00C9B1] transition-colors hover:bg-[#00C9B1]/12 sm:max-w-[min(12rem,40%)]"
            >
              {followUpViewAllLabel}
            </Link>
          ) : null}
        </div>
        {supporting ? (
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {supporting}
          </p>
        ) : null}
        {action.relevantActivityLabel?.trim() ? (
          <p className="mt-2 text-[11px] font-medium text-[var(--text-muted)]">
            {sanitizeDashboardDisplayText(action.relevantActivityLabel)}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={action.ctaHref}
            className={cn(
              'inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center rounded-full border border-transparent bg-[var(--teal)] px-[18px] py-2 text-[13px] font-semibold text-[#080b0a] transition-[filter,transform] duration-150 hover:brightness-110 hover:[transform:scale(1.01)] active:scale-[0.99] sm:w-auto',
            )}
          >
            {action.ctaLabel}
          </Link>
          <p className="text-center text-[11px] font-medium text-[var(--text-muted)] sm:text-right">
            Based on your activity
          </p>
        </div>
      </div>
    </section>
  );
}
