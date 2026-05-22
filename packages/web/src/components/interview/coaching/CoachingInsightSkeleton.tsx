'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';

export const CoachingInsightSkeleton = memo(function CoachingInsightSkeleton({
  partial,
  className,
}: {
  partial?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('ip-coach-skeleton space-y-3', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading coaching feedback"
    >
      <p className="text-xs font-medium text-[var(--text-teal)]">Analyzing your answer…</p>
      <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-white/10" />
        ))}
      </div>
      <div className="h-14 animate-pulse rounded-lg bg-[var(--teal-500)]/10" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.06]" />
      </div>
      {partial ? (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <p className="text-[10px] text-[var(--text-muted)]">Checking structure…</p>
          <div className="grid gap-2">
            <div className="h-8 animate-pulse rounded bg-white/10" />
            <div className="h-8 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            STAR breakdown
          </p>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-white/10" />
          ))}
        </div>
      )}
    </div>
  );
});
