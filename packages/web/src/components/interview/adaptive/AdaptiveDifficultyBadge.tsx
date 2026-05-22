'use client';

import { memo } from 'react';

import { difficultyDisplayLabel } from '@/lib/interviewAdaptive';
import type { DifficultyLevel } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const TONE: Record<string, string> = {
  easy: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200',
  medium: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
  hard: 'border-amber-400/35 bg-amber-500/12 text-amber-100',
  adaptive: 'border-[var(--border-teal)]/35 bg-[var(--teal-10)] text-[var(--text-teal)]',
};

export const AdaptiveDifficultyBadge = memo(function AdaptiveDifficultyBadge({
  level,
  className,
  showPulse,
}: {
  level: DifficultyLevel | 'easy' | 'medium' | 'hard';
  className?: string;
  /** Brief highlight when difficulty just changed. */
  showPulse?: boolean;
}) {
  const key =
    level === 'easy' || level === 'medium' || level === 'hard' ? level : 'adaptive';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors duration-500',
        TONE[key] ?? TONE.adaptive,
        showPulse && 'ring-2 ring-[var(--teal)]/25',
        className,
      )}
      role="status"
    >
      <span className="text-[9px] font-medium uppercase tracking-wider opacity-80">Level</span>
      {difficultyDisplayLabel(level)}
    </span>
  );
});
