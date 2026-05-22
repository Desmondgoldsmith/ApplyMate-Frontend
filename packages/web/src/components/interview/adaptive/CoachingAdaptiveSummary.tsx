'use client';

import { memo } from 'react';

import type { CoachingSignalLine } from '@/lib/interviewAdaptive';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<CoachingSignalLine['tone'], string> = {
  good: 'text-emerald-300/95',
  warn: 'text-amber-200/95',
  focus: 'text-[var(--text-teal)]',
};

const TONE_ICON: Record<CoachingSignalLine['tone'], string> = {
  good: '✔',
  warn: '⚠',
  focus: '🎯',
};

export const CoachingAdaptiveSummary = memo(function CoachingAdaptiveSummary({
  lines,
  className,
}: {
  lines: CoachingSignalLine[];
  className?: string;
}) {
  if (!lines.length) return null;

  return (
    <ul className={cn('space-y-1.5', className)} aria-label="Answer summary">
      {lines.map((line) => (
        <li
          key={line.text}
          className={cn('flex items-start gap-2 text-xs leading-snug', TONE_CLASS[line.tone])}
        >
          <span className="shrink-0 text-[11px]" aria-hidden>
            {TONE_ICON[line.tone]}
          </span>
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
});
