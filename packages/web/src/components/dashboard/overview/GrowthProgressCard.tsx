'use client';

import { TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

import { InfoHint } from '@/components/ui/InfoHint';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGrowthProgress } from '@/hooks/useGrowth';
import { cn } from '@/lib/utils';
import {
  MOVEMENT_SECTION_HINT,
  MOVEMENT_FIT_TREND_HINT,
  MOVEMENT_FOLLOWUPS_HINT,
  MOVEMENT_ROLES_FORWARD_HINT,
  MOVEMENT_TYPICAL_FIT_HINT,
} from '@/lib/dashboardDashboardHints';

export function GrowthProgressCard({
  window,
  onWindowChange,
  emptyStateCopy,
  sectionTitle,
}: {
  window: 'daily' | 'weekly' | 'monthly';
  onWindowChange: (next: 'daily' | 'weekly' | 'monthly') => void;
  emptyStateCopy?: string | null;
  /** Backend-authored section heading (falls back to legacy label when omitted). */
  sectionTitle?: string | null;
}) {
  const progress = useGrowthProgress(window);
  const metrics = progress.data?.metrics;
  const loading = progress.isLoading;
  const movementHeading = sectionTitle?.trim() || 'Your Movement Over Time';

  if (loading) {
    return (
      <section className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <Skeleton height={22} width={200} borderRadius={6} className="mb-4" />
        <Skeleton height={88} width="100%" borderRadius={12} />
      </section>
    );
  }

  const jp = metrics?.jobsProgressed ?? 0;
  const fu = metrics?.followUpsCompleted ?? 0;
  const mq = Math.round(metrics?.matchQualityAvg ?? 0);
  const md = metrics?.matchQualityDelta ?? 0;
  const noMovementYet =
    !loading && jp === 0 && fu === 0 && mq === 0 && md === 0;

  if (noMovementYet) {
    return (
      <section className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[15px] font-semibold text-white/90">
                {movementHeading}
              </p>
              <InfoHint
                text={MOVEMENT_SECTION_HINT}
                buttonClassName="translate-y-px"
              />
            </div>
            <p className="mt-1 text-[12px] text-white/45">
              {emptyStateCopy?.trim() ||
                'Your progress will appear here as you analyze roles and complete applications.'}
            </p>
          </div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((key) => (
              <button
                key={key}
                type="button"
                title={
                  key === 'daily'
                    ? 'Last 24 hours'
                    : key === 'weekly'
                      ? 'Last 7 days'
                      : 'Last 30 days'
                }
                onClick={() => onWindowChange(key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
                  key === window
                    ? 'bg-[#00C9B1] text-[#080A0A]'
                    : 'text-white/50 hover:text-white/80',
                )}
              >
                {key.slice(0, 1)}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[15px] font-semibold text-white/90">
              {movementHeading}
            </p>
            <InfoHint
              text={MOVEMENT_SECTION_HINT}
              buttonClassName="translate-y-px"
            />
          </div>
          <p className="mt-1 text-[12px] text-white/45">
            Steady progress beats chasing perfection.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(['daily', 'weekly', 'monthly'] as const).map((key) => (
            <button
              key={key}
              type="button"
              title={
                key === 'daily'
                  ? 'Last 24 hours'
                  : key === 'weekly'
                    ? 'Last 7 days'
                    : 'Last 30 days'
              }
              onClick={() => onWindowChange(key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
                key === window
                  ? 'bg-[#00C9B1] text-[#080A0A]'
                  : 'text-white/50 hover:text-white/80',
              )}
            >
              {key.slice(0, 1)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Roles you moved forward
            </p>
            <InfoHint text={MOVEMENT_ROLES_FORWARD_HINT} className="shrink-0" />
          </div>
          <p className="mt-1 text-[20px] font-semibold text-white">
            {metrics?.jobsProgressed ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Follow-ups you closed
            </p>
            <InfoHint text={MOVEMENT_FOLLOWUPS_HINT} className="shrink-0" />
          </div>
          <p className="mt-1 text-[20px] font-semibold text-white">
            {metrics?.followUpsCompleted ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Typical fit on analyzed roles
            </p>
            <InfoHint text={MOVEMENT_TYPICAL_FIT_HINT} className="shrink-0" />
          </div>
          <p className="mt-1 text-[20px] font-semibold text-white">
            {Math.round(metrics?.matchQualityAvg ?? 0)}%
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-1.5">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-white/45">
              Fit trend vs last window
            </p>
            <InfoHint text={MOVEMENT_FIT_TREND_HINT} className="shrink-0" />
          </div>
          <p
            className={cn(
              'mt-1 text-[20px] font-semibold',
              (metrics?.matchQualityDelta ?? 0) >= 0
                ? 'text-[#00C9B1]'
                : 'text-amber-300',
            )}
          >
            {(metrics?.matchQualityDelta ?? 0) >= 0 ? '+' : ''}
            {(metrics?.matchQualityDelta ?? 0).toFixed(1)}
          </p>
        </div>
      </div>
    </section>
  );
}
