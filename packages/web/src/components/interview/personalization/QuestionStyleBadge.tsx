'use client';

import { memo } from 'react';

import { questionStyleBadgeLabel } from '@/lib/interviewPersonalization';
import type { DifficultyHint } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const QuestionStyleBadge = memo(function QuestionStyleBadge({
  hint,
  fading,
  className,
}: {
  hint: DifficultyHint | null;
  fading?: boolean;
  className?: string;
}) {
  const label = questionStyleBadgeLabel(hint);
  if (!label) return null;

  return (
    <span
      className={cn(
        'ip-question-style-badge inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]',
        fading && 'ip-question-style-fade',
        className,
      )}
      role="status"
    >
      {label}
    </span>
  );
});
