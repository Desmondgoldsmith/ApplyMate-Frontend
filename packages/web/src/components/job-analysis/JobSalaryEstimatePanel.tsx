'use client';

import { CircleDollarSign } from 'lucide-react';

import type { JobSalaryEstimate } from '@/lib/api';
import {
  formatSalaryRange,
  isLowConfidenceAiEstimate,
  resolveSalaryEstimateSource,
  salaryEstimateSectionTitle,
  salaryEstimateSourceLabel,
} from '@/lib/jobSalaryEstimate';
import { cn } from '@/lib/utils';

export type JobSalaryEstimatePanelProps = {
  estimate: JobSalaryEstimate;
  className?: string;
  /** Compact layout for list cards */
  variant?: 'default' | 'compact';
};

export function JobSalaryEstimatePanel({
  estimate,
  className,
  variant = 'default',
}: JobSalaryEstimatePanelProps) {
  const source = resolveSalaryEstimateSource(estimate);
  const fromPosting = source === 'job_description';
  const badge = salaryEstimateSourceLabel(estimate);
  const lowConfidence = isLowConfidenceAiEstimate(estimate);
  const disclaimer = estimate.disclaimer?.trim() ?? '';
  const note = estimate.note?.trim() ?? '';
  const market = estimate.marketLocation?.trim() ?? '';

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-1', className)}>
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            fromPosting
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
              : 'border-amber-400/40 bg-amber-500/12 text-amber-100',
          )}
        >
          {badge}
        </span>
        <p
          className={cn(
            'text-xs text-white/70',
            lowConfidence && 'text-white/45',
          )}
        >
          {formatSalaryRange(estimate)}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-[14px] border px-5 py-5 sm:px-6',
        fromPosting
          ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
          : 'border-amber-500/25 bg-amber-500/[0.06]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <CircleDollarSign
          className={cn(
            'h-5 w-5 shrink-0',
            fromPosting ? 'text-emerald-300' : 'text-amber-300',
          )}
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-[14px] font-semibold text-white">
          {salaryEstimateSectionTitle(estimate)}
        </p>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold tracking-wide',
            fromPosting
              ? 'border-emerald-400/45 bg-emerald-500/20 text-emerald-100'
              : 'border-amber-400/45 bg-amber-500/18 text-amber-50',
          )}
        >
          {badge}
        </span>
      </div>

      <p
        className={cn(
          'mt-3 text-[22px] font-bold leading-tight',
          lowConfidence ? 'text-white/55' : 'text-white',
        )}
      >
        {formatSalaryRange(estimate)}
      </p>

      {disclaimer ? (
        <p
          className={cn(
            'mt-4 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed',
            fromPosting
              ? 'border-emerald-500/25 bg-emerald-950/30 text-emerald-50/90'
              : 'border-amber-500/25 bg-amber-950/25 text-amber-50/88',
          )}
        >
          {disclaimer}
        </p>
      ) : null}

      {note ? (
        <p className="mt-3 text-[12px] leading-relaxed text-white/50">{note}</p>
      ) : null}

      {!fromPosting && market ? (
        <p className="mt-2 text-[11px] text-white/40">
          Market context: {market}
          {estimate.marketCountryCode ? ` (${estimate.marketCountryCode})` : ''}
        </p>
      ) : null}
    </div>
  );
}
