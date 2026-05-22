'use client';

import { memo, useMemo } from 'react';

import { buildEvolutionFromHistory, type SkillEvolutionPoint } from '@/lib/interviewAdaptive';
import { cn } from '@/lib/utils';

function Sparkline({
  values,
  colorClass,
  label,
}: {
  values: number[];
  colorClass: string;
  label: string;
}) {
  if (values.length < 2) {
    return (
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>{label}</span>
        <span>—</span>
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const latest = values[values.length - 1] ?? 0;
  const w = 72;
  const h = 22;
  const step = w / Math.max(1, values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] text-[var(--text-muted)]">{label}</span>
      <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={colorClass}
          points={points}
        />
      </svg>
      <span className="w-6 shrink-0 text-right text-[10px] font-semibold tabular-nums text-[var(--text-primary)]">
        {latest}
      </span>
      {latest > min + 3 ? (
        <span className="text-[9px] text-emerald-400/80">↑</span>
      ) : latest < min - 3 ? (
        <span className="text-[9px] text-amber-300/80">↓</span>
      ) : null}
    </div>
  );
}

export const InterviewProgressEvolutionGraph = memo(function InterviewProgressEvolutionGraph({
  history,
  className,
  compact,
}: {
  history: SkillEvolutionPoint[];
  className?: string;
  compact?: boolean;
}) {
  const series = useMemo(() => buildEvolutionFromHistory(history), [history]);

  if (history.length < 2) {
    return (
      <p className={cn('text-[10px] text-[var(--text-muted)]', className)}>
        Answer a few more questions to see your session trend.
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5', className)} role="img" aria-label="Skill trend this session">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        This session
      </p>
      <Sparkline values={series.clarity} colorClass="text-sky-400" label="Clarity" />
      <Sparkline values={series.structure} colorClass="text-[var(--teal)]" label="Structure" />
      <Sparkline values={series.confidence} colorClass="text-violet-300" label="Confidence" />
    </div>
  );
});
