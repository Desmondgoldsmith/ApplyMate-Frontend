'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { InfoHint } from '@/components/ui/InfoHint';
import { TOOLTIP_RECOMMENDED_MOVE_SIGNAL, TOOLTIP_STRATEGIC_MOVE_PRIORITY } from '@/lib/dashboardIntelligenceTooltips';
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

function pctBar(value: number | null): ReactNode {
  const v = typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
      <div
        className="h-full rounded-full bg-[var(--teal)]/85 transition-[width] duration-300 ease-out"
        style={{ width: `${v != null ? v : 0}%` }}
      />
    </div>
  );
}

function SignalRow({
  label,
  value,
  tooltip,
  tooltipAria,
}: {
  label: string;
  value: number | null;
  tooltip: string;
  tooltipAria: string;
}) {
  const display = typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—';
  return (
    <div className="mt-2.5 first:mt-0">
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-0.5">
          <span>{label}</span>
          <InfoHint text={tooltip} buttonAriaLabel={tooltipAria} />
        </span>
        <span className="tabular-nums">{display}</span>
      </div>
      {pctBar(value)}
    </div>
  );
}

export function DashboardRecommendedMoveSection({
  action,
  sectionEyebrow,
  followUpJobsSnapshotCount = 0,
  followUpJobsTotalCount = null,
  followUpJobsViewAllHref = null,
}: Props) {
  const supporting = action.supporting?.trim() ?? '';
  const showPriority = action.priority != null;

  const snap = Math.max(0, Math.round(followUpJobsSnapshotCount));
  const total =
    typeof followUpJobsTotalCount === 'number' && Number.isFinite(followUpJobsTotalCount)
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
      className="scroll-mt-4 min-w-0"
      data-recommended-move-source={action.backendSource ?? undefined}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-teal)]">
        {sectionEyebrow}
      </p>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-teal)] border-l-[3px] border-l-[var(--teal)] bg-[var(--bg-surface)] pl-5 pr-5 py-5 sm:pl-6 sm:pr-6 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--text-primary)]">{action.headline}</p>
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
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)] line-clamp-3">{supporting}</p>
        ) : null}

        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-3.5">
          <SignalRow
            label="Action signal"
            value={action.confidence}
            tooltip={TOOLTIP_RECOMMENDED_MOVE_SIGNAL}
            tooltipAria="What is Action signal?"
          />
          {showPriority ? (
            <SignalRow
              label="Priority"
              value={action.priority}
              tooltip={TOOLTIP_STRATEGIC_MOVE_PRIORITY}
              tooltipAria="What is Priority?"
            />
          ) : null}
        </div>

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
