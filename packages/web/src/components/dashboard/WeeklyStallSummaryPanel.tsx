'use client';

import { CheckCircle2, Compass, Loader2, RotateCw } from 'lucide-react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { WeeklyStallSummaryPayload } from '@/lib/weekly-stall-summary';
import { weeklyStallItemHref } from '@/lib/weekly-stall-summary';

function companyInitial(company: string): string {
  const t = company.trim();
  if (!t) return '?';
  return t.charAt(0).toUpperCase();
}

type PanelProps = {
  data: WeeklyStallSummaryPayload | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRefresh: () => void;
  /** Phase 5: render section shell even when data is missing/empty. */
  forceRender?: boolean;
  emptyStateCopy?: string | null;
  /** Backend-normalized section heading (defaults to “Jobs to Revisit”). */
  sectionTitle?: string | null;
};

export function WeeklyStallSummaryPanel({
  data,
  isLoading,
  isFetching,
  error,
  onRefresh,
  forceRender,
  emptyStateCopy,
  sectionTitle,
}: PanelProps) {
  const heading =
    sectionTitle?.trim() || 'Jobs to Revisit';
  if (isLoading) {
    return (
      <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Skeleton height={20} width={180} borderRadius={6} />
        </div>
        <Skeleton height={56} borderRadius={12} className="mb-2" />
        <Skeleton height={56} borderRadius={12} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[14px] border border-rose-500/25 bg-rose-500/[0.06] p-5 sm:p-6">
        <p className="text-[13px] font-medium text-rose-100/90">
          Could not load your pipeline summary. Other dashboard content is unchanged.
        </p>
        <button
          type="button"
          onClick={() => onRefresh()}
          className="mt-4 text-[13px] font-medium text-[#00C9B1] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    if (forceRender !== true) return null;
    return (
      <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Compass className="h-5 w-5 shrink-0 text-[#00C9B1]" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold text-white">{heading}</h2>
              <p className="mt-1 text-[11px] font-medium text-white/35">Updating your follow-ups.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRefresh()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 text-[13px] font-medium text-[#00C9B1] transition-opacity hover:underline sm:min-h-0"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
        </div>
        <p className="text-[13px] font-medium text-white/45">
          {emptyStateCopy?.trim() ||
            'Roles you save or analyze will appear here when they are ready for a follow-up.'}
        </p>
      </div>
    );
  }

  const refreshed =
    data.generatedAt && !Number.isNaN(Date.parse(data.generatedAt))
      ? new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : null;

  const shellHeader = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Compass className="h-5 w-5 shrink-0 text-[#00C9B1]" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-white">{heading}</h2>
          {data.eligible ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-white/35">
              {refreshed ? <span>Updated {refreshed}</span> : null}
              {isFetching ? (
                <span className="inline-flex items-center gap-1 text-[#00C9B1]/80">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Updating
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-white/35">
              {refreshed ? <span>Updated {refreshed}</span> : null}
              {isFetching ? (
                <span className="inline-flex items-center gap-1 text-[#00C9B1]/80">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Updating
                </span>
              ) : null}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRefresh()}
        disabled={isFetching}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 text-[13px] font-medium text-[#00C9B1] transition-opacity hover:underline disabled:opacity-60 sm:min-h-0"
      >
        <RotateCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden />
        Refresh
      </button>
    </div>
  );

  if (!data.eligible) {
    const copy =
      data.reasonIfEmpty === 'opt_out'
        ? {
            title: 'Weekly summary is off',
            body: 'You opted out of the weekly email. You can turn it back on under Settings → Notifications.',
          }
        : data.reasonIfEmpty === 'paused'
          ? {
              title: 'Nudges are paused',
              body: 'Marketing reminders are paused. Resume anytime under Settings → Notifications.',
            }
          : {
              title: 'Summary unavailable',
              body: 'Adjust notification preferences under Settings if you want this summary.',
            };

    return (
      <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        {shellHeader}
        <p className="text-[14px] font-semibold text-white">{copy.title}</p>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-white/45">{copy.body}</p>
        <Link
          href="/dashboard/settings?tab=notifications"
          className="mt-4 inline-flex min-h-[44px] items-center text-[13px] font-medium text-[#00C9B1] hover:underline sm:min-h-0"
        >
          Open notification settings →
        </Link>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        {shellHeader}
        <p className="text-[13px] font-medium leading-relaxed text-white/45">
          {emptyStateCopy?.trim() ||
            'Roles you save or analyze will appear here when they are ready for a follow-up.'}
        </p>
      </div>
    );
  }

  const moreCount = Math.max(0, data.totalCount - data.items.length);
  const showMoreTarget = data.showMoreHref?.startsWith('/') ? data.showMoreHref : '/dashboard/next-moves';
  const revisitCtaLabel = (stage: string | null | undefined, ctaHint: WeeklyStallSummaryPayload['items'][number]['ctaHint']) => {
    const s = (stage ?? '').trim().toLowerCase();
    if (s.includes('interview')) return 'Prep interview';
    if (s.includes('offer') || s.includes('negotiat')) return 'Review recruiter activity';
    if (s.includes('applied') || s.includes('application')) return 'Follow up';
    if (s.includes('tailor')) return 'Tailor CV';
    if (s.includes('screen') || s.includes('assessment')) return 'Continue applying';
    return ctaHint === 'OPEN_JOB_ANALYZE' ? 'Continue applying' : 'Follow up';
  };

  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      {shellHeader}
      <p className="mb-4 text-[13px] font-medium text-white/45">
        These applications haven&apos;t moved in a while. One action each could change that.
      </p>
      <ul className="space-y-2">
        {data.items.map((it) => {
          const href = weeklyStallItemHref(it) ?? '/dashboard/jobs';
          const company = it.company.trim() || 'Company';
          const stageSuffix =
            it.kind === 'bookmark' && it.stage?.trim() ? ` · ${it.stage.trim()}` : '';
          const shellClass = cn(
            'flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-[border-color,background-color] duration-150 hover:border-white/[0.12] hover:bg-white/[0.05]',
          );
          const inner = (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.15)] text-[13px] font-semibold text-[#00C9B1]">
                {companyInitial(company)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{it.title}</p>
                <p className="truncate text-[11px] font-medium text-white/40">
                  {company}
                  {stageSuffix}
                </p>
              </div>
              <span className="shrink-0 text-[12px] font-medium text-[#00C9B1]">
                {revisitCtaLabel(it.stage, it.ctaHint)} →
              </span>
            </>
          );
          return (
            <li key={it.id}>
              <Link href={href} className={shellClass}>
                {inner}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
        {moreCount > 0 ? (
          <p className="text-[12px] font-medium text-white/35">
            {moreCount} more {moreCount === 1 ? 'role' : 'roles'} in Job Hub
          </p>
        ) : (
          <span className="text-[12px] font-medium text-white/35">
            {data.totalCount} {data.totalCount === 1 ? 'role' : 'roles'} listed
          </span>
        )}
        <Link
          href={showMoreTarget}
          className="text-[13px] font-medium text-[#00C9B1] hover:underline"
        >
          View all →
        </Link>
      </div>
    </div>
  );
}
