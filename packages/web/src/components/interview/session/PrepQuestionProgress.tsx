'use client';

import { memo } from 'react';

import { formatMainProgressLabel } from '@/lib/interviewPrepNavigation';
import type { QuestionProgress } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const PrepQuestionProgress = memo(function PrepQuestionProgress({
  progress,
  turnLabel,
  currentMainQuestionNumber,
  sidePracticeAnsweredCount,
  className,
}: {
  progress: QuestionProgress | null | undefined;
  turnLabel?: string | null;
  currentMainQuestionNumber?: number | null;
  sidePracticeAnsweredCount?: number;
  className?: string;
}) {
  const { main, optionalBadge } = formatMainProgressLabel(
    progress,
    currentMainQuestionNumber,
    sidePracticeAnsweredCount ?? 0,
  );
  if (!main && !turnLabel) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {main ? (
        <span className="text-[13px] font-medium text-[var(--text-muted)]">{main}</span>
      ) : null}
      {optionalBadge ? (
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
          {optionalBadge}
        </span>
      ) : null}
      {turnLabel ? (
        <span className="rounded-full border border-[var(--border-teal)]/30 bg-[var(--teal-10)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-teal)]">
          {turnLabel}
        </span>
      ) : null}
    </div>
  );
});
