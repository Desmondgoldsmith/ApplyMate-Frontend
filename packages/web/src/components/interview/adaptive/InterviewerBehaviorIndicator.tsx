'use client';

import { memo } from 'react';

import {
  interviewerBehaviorCopy,
  type InterviewerBehaviorMode,
} from '@/lib/interviewAdaptive';
import { cn } from '@/lib/utils';

const ICON: Record<InterviewerBehaviorMode, string> = {
  calm: '😐',
  coaching: '🎯',
  challenging: '🔥',
};

const STYLE: Record<InterviewerBehaviorMode, string> = {
  calm: 'border-[var(--border-subtle)] bg-[var(--bg-surface-2)]',
  coaching: 'border-emerald-400/25 bg-emerald-500/8',
  challenging: 'border-amber-400/30 bg-amber-500/8',
};

export const InterviewerBehaviorIndicator = memo(function InterviewerBehaviorIndicator({
  mode,
  className,
}: {
  mode: InterviewerBehaviorMode;
  className?: string;
}) {
  const copy = interviewerBehaviorCopy(mode);

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2',
        STYLE[mode],
        className,
      )}
      role="status"
    >
      <span className="text-base leading-none" aria-hidden>
        {ICON[mode]}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">{copy.label}</p>
        <p className="text-[10px] leading-snug text-[var(--text-muted)]">{copy.description}</p>
      </div>
    </div>
  );
});
