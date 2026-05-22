'use client';

import { ChevronRight, CornerDownRight } from 'lucide-react';
import Link from 'next/link';

import type { DashboardContinuationView } from '@/lib/dashboardViewModel';
import { ensureSafeDashboardHref } from '@/lib/executionRouting';
import { cn } from '@/lib/utils';

type Props = {
  continuation: DashboardContinuationView;
  onClick?: () => void;
};

function formatLastWorked(hours: number | null): string | null {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 1) return 'Last worked: just now';
  if (hours < 24) return `Last worked: ${Math.round(hours)}h ago`;
  const days = Math.max(1, Math.round(hours / 24));
  return `Last worked: ${days}d ago`;
}

export function DashboardContinuationCard({ continuation, onClick }: Props) {
  const title = continuation.title.trim();
  if (!title) return null;
  const safeHref = ensureSafeDashboardHref(continuation.href, '/dashboard/job-board').href;
  const lastWorked = formatLastWorked(continuation.interruptionAgeHours ?? null);
  const steps =
    typeof continuation.remainingSteps === 'number' && Number.isFinite(continuation.remainingSteps)
      ? Math.max(0, Math.round(continuation.remainingSteps))
      : null;
  const pct =
    typeof continuation.percentComplete === 'number' &&
    Number.isFinite(continuation.percentComplete) &&
    continuation.percentComplete > 0
      ? Math.max(0, Math.min(100, Math.round(continuation.percentComplete)))
      : null;
  const stepLabel = continuation.continuationContext?.exactStepLabel?.trim() || null;
  const stepIdx = continuation.continuationContext?.exactStepIndex ?? null;
  const total = continuation.continuationContext?.totalSteps ?? null;
  const stepProgress =
    typeof stepIdx === 'number' &&
    Number.isFinite(stepIdx) &&
    typeof total === 'number' &&
    Number.isFinite(total) &&
    total > 0
      ? `Step ${Math.min(total, Math.max(1, stepIdx + 1))} of ${total}`
      : null;
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Continue</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug text-white/92">{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-white/40">
            {lastWorked ? <span>{lastWorked}</span> : null}
            {lastWorked && steps != null ? <span className="text-white/20">·</span> : null}
            {steps != null ? (
              <span>
                {steps === 0 ? 'Nearly done' : `${steps} step${steps === 1 ? '' : 's'} remaining`}
              </span>
            ) : null}
            {(lastWorked || steps != null) && pct != null ? <span className="text-white/20">·</span> : null}
            {pct != null ? <span>{pct}% complete</span> : null}
            {(lastWorked || steps != null || pct != null) && (stepLabel || stepProgress) ? (
              <span className="text-white/20">·</span>
            ) : null}
            {stepProgress ? <span>{stepProgress}</span> : null}
          </div>
          {continuation.subtitle?.trim() ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
              <CornerDownRight className="mr-1 inline h-3.5 w-3.5 text-white/35" aria-hidden />
              {continuation.subtitle.trim()}
            </p>
          ) : null}
          {stepLabel ? (
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">
              Next: {stepLabel}
            </p>
          ) : null}
        </div>
        {continuation.showPrimaryCta && safeHref && continuation.ctaLabel?.trim() ? (
          <div className="shrink-0">
            {continuation.minutes ? (
              <p className="text-[12px] font-medium leading-relaxed text-white/35">
                Usually takes ~{continuation.minutes} min
              </p>
            ) : null}
            <Link
              href={safeHref}
              onClick={onClick}
              className={cn(
                'mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                'border-white/18 text-white/85 hover:border-[#00C9B1]/40 hover:text-[#00C9B1]',
              )}
            >
              {continuation.ctaLabel.trim()}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

