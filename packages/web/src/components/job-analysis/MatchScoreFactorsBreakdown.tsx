'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import type { JobMatchFactor, JobMatchFactorsBreakdown } from '@/lib/jobMatchFactorsBreakdown';
import { factorBarColor, factorTextColor } from '@/lib/jobMatchFactorsBreakdown';
import { cn } from '@/lib/utils';

const MAX_CHIPS = 24;

function FactorChips({
  variant,
  items,
}: {
  variant: 'found' | 'missing';
  items: string[];
}) {
  if (items.length === 0) return null;
  const visible = items.slice(0, MAX_CHIPS);
  const rest = items.length - visible.length;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {visible.map((item) => (
        <span
          key={`${variant}-${item}`}
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
            variant === 'found'
              ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90'
              : 'border border-rose-500/25 bg-rose-500/10 text-rose-200/90',
          )}
        >
          {item}
        </span>
      ))}
      {rest > 0 ? (
        <span className="self-center text-[10px] text-white/35">+{rest} more</span>
      ) : null}
    </div>
  );
}

function FactorRow({ factor }: { factor: JobMatchFactor }) {
  const barClass = factorBarColor(factor.score);
  return (
    <li className="space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[12px] font-semibold text-white/85">{factor.label}</span>
        <span
          className={cn(
            'shrink-0 text-[12px] font-bold tabular-nums',
            factorTextColor(factor.score),
          )}
        >
          {factor.score}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', barClass)}
          style={{ width: `${factor.score}%` }}
          role="progressbar"
          aria-valuenow={factor.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${factor.label} ${factor.score}%`}
        />
      </div>
      {factor.explanation ? (
        <p className="text-[11px] leading-snug text-white/50">{factor.explanation}</p>
      ) : null}
      <FactorChips variant="found" items={factor.found ?? []} />
      <FactorChips variant="missing" items={factor.missing ?? []} />
    </li>
  );
}

export type MatchScoreFactorsBreakdownProps = {
  breakdown: JobMatchFactorsBreakdown;
  className?: string;
  /** Start expanded (e.g. on the Job Analyzer results panel). */
  defaultOpen?: boolean;
};

/** Expandable factor rows under the headline job match score (3.3). */
export function MatchScoreFactorsBreakdown({
  breakdown,
  className,
  defaultOpen = false,
}: MatchScoreFactorsBreakdownProps) {
  const [open, setOpen] = useState(defaultOpen);
  const factors = breakdown.factors;
  if (factors.length === 0) return null;

  return (
    <div className={cn('min-w-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-lg py-1 text-left text-[12px] font-medium text-white/50 transition hover:text-[#00C9B1]"
      >
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
        Why this score?
      </button>
      {open ? (
        <ul className="mt-2 space-y-2" aria-label="Match score breakdown">
          {factors.map((factor) => (
            <FactorRow key={factor.key} factor={factor} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
