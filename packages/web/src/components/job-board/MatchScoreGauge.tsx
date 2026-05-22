'use client';

import { useId, useMemo } from 'react';

import { cn } from '@/lib/utils';

type MatchScoreGaugeProps = {
  score: number;
  /** e.g. “Match preview” when score is client-estimated */
  caption?: string;
  className?: string;
};

function scoreTier(score: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 70) {
    return {
      label: 'Strong match',
      labelClass: 'text-[#00C9B1]',
      grad: ['#00C9B1', '#10B981', '#34d399'] as const,
    };
  }
  if (clamped >= 40) {
    return {
      label: 'Partial match',
      labelClass: 'text-[#F59E0B]',
      grad: ['#00C9B1', '#F59E0B', '#fbbf24'] as const,
    };
  }
  return {
    label: 'Low match',
    labelClass: 'text-[#EF4444]/90',
    grad: ['#00C9B1', '#EF4444', '#f87171'] as const,
  };
}

/** Semi-circular gauge (0–100) with score-tier coloring. */
export function MatchScoreGauge({ score, caption = 'Match score', className }: MatchScoreGaugeProps) {
  const baseId = useId().replace(/:/g, '');
  const gradId = `${baseId}-arc`;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const r = 52;
  const cx = 58;
  const cy = 56;
  const arcLen = Math.PI * r;
  const dash = (clamped / 100) * arcLen;
  const tier = useMemo(() => scoreTier(clamped), [clamped]);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/** Fixed width matches SVG viewBox so labels stay centered under the arc (avoid column `items-end` shifting text). */}
      <div className="flex w-[116px] flex-col items-center">
      <svg width="116" height="72" viewBox="0 0 116 72" className="mx-auto shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={tier.grad[0]} />
            <stop offset="55%" stopColor={tier.grad[1]} />
            <stop offset="100%" stopColor={tier.grad[2]} />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`}
          pathLength={arcLen}
          className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out"
        />
      </svg>
      <div className="-mt-7 w-full text-center">
        <p className="text-[28px] font-bold tabular-nums leading-none tracking-tight sm:text-[30px]">
          <span className={tier.labelClass}>{clamped}%</span>
        </p>
        <p className={cn('mt-1.5 text-[11px] font-semibold leading-snug', tier.labelClass)}>{tier.label}</p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
          {caption?.trim() ? caption.trim() : 'Match score'}
        </p>
      </div>
      </div>
    </div>
  );
}
