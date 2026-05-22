'use client';

import { memo } from 'react';

import type { CoachInsightScore } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const DIMENSIONS: Array<{ key: keyof CoachInsightScore; label: string }> = [
  { key: 'clarity', label: 'Clarity' },
  { key: 'structure', label: 'Structure' },
  { key: 'depth', label: 'Depth' },
  { key: 'relevance', label: 'Relevance' },
];

function Bar({
  label,
  value,
  weak,
  meterClass,
}: {
  label: string;
  value: number;
  weak?: boolean;
  meterClass: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_32px] items-center gap-2 rounded-md px-1 py-0.5',
        weak && 'bg-amber-500/8 ring-1 ring-amber-400/20',
      )}
    >
      <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-[width] duration-300', meterClass)} style={{ width: `${v}%` }} />
      </div>
      <span className="text-right text-[11px] font-semibold tabular-nums text-[var(--text-primary)]">{v}</span>
    </div>
  );
}

export const AnswerQualityMeter = memo(function AnswerQualityMeter({
  scores,
  meterClass = 'bg-[var(--teal)]',
  className,
}: {
  scores: CoachInsightScore;
  meterClass?: string;
  className?: string;
}) {
  const entries = DIMENSIONS.map((d) => ({ ...d, value: scores[d.key] }));
  const lowest = [...entries].sort((a, b) => a.value - b.value)[0];

  return (
    <div className={cn('space-y-2', className)} role="group" aria-label="Answer quality">
      {entries.map((d) => (
        <Bar
          key={d.key}
          label={d.label}
          value={d.value}
          meterClass={meterClass}
          weak={lowest?.key === d.key && d.value < 60}
        />
      ))}
    </div>
  );
});
