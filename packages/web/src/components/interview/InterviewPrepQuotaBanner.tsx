'use client';

import Link from 'next/link';
import { Crown, Mic, Type } from 'lucide-react';

import type { InterviewPrepQuota } from '@/lib/interviewPrepQuota';
import {
  formatInterviewPrepQuotaReset,
  isInterviewPrepPaidTier,
  isInterviewPrepWeeklyLimitReached,
} from '@/lib/interviewPrepQuota';
import { cn } from '@/lib/utils';

type InterviewPrepQuotaBannerProps = {
  quota: InterviewPrepQuota | undefined;
  isLoading?: boolean;
  className?: string;
};

export function InterviewPrepQuotaBanner({
  quota,
  isLoading,
  className,
}: InterviewPrepQuotaBannerProps) {
  if (isLoading && !quota) {
    return (
      <div
        className={cn(
          'h-14 animate-pulse rounded-[var(--radius-md)] bg-white/[0.04]',
          className,
        )}
        aria-hidden
      />
    );
  }

  if (!quota) return null;

  const paid = isInterviewPrepPaidTier(quota);
  const atLimit = isInterviewPrepWeeklyLimitReached(quota);
  const resetLabel = quota.quotaResetsAt
    ? formatInterviewPrepQuotaReset(quota.quotaResetsAt, quota.quotaTimezone)
    : '';

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border px-4 py-3',
        atLimit
          ? 'border-amber-400/35 bg-amber-500/10'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-2)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {paid ? (
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Pro — unlimited practice sessions
            </p>
          ) : (
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {atLimit ? (
                <>Weekly practice limit reached</>
              ) : (
                <>
                  <span className="text-[var(--text-teal)]">
                    {quota.sessionsRemaining ?? 0}
                  </span>
                  {' of '}
                  {quota.weeklyLimit ?? 3} practice sessions left this week
                </>
              )}
            </p>
          )}
          {!paid && resetLabel ? (
            <p className="text-xs text-[var(--text-muted)]">
              {atLimit ? 'Resets ' : 'Quota resets '}
              {resetLabel}
            </p>
          ) : null}
          {atLimit ? (
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {quota.upgradeMessage}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
              quota.voiceEnabled
                ? 'border-[var(--border-teal)] bg-[var(--teal-10)] text-[var(--text-teal)]'
                : 'border-[var(--border-subtle)] bg-white/[0.04] text-[var(--text-muted)]',
            )}
          >
            {quota.voiceEnabled ? (
              <>
                <Mic className="h-3 w-3" aria-hidden />
                AI voice (Pro)
              </>
            ) : (
              <>
                <Type className="h-3 w-3" aria-hidden />
                Text practice
              </>
            )}
          </span>
          {!paid ? (
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border-teal)] bg-[var(--teal-10)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-teal)] transition hover:bg-[var(--teal-20)]"
            >
              <Crown className="h-3 w-3" aria-hidden />
              Upgrade
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
