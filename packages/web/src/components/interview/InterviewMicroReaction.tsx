'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';

export const InterviewMicroReaction = memo(function InterviewMicroReaction({
  lines,
  reactionText,
  className,
}: {
  lines: string[];
  reactionText?: string | null;
  className?: string;
}) {
  if (!lines.length && !reactionText?.trim()) return null;

  return (
    <div className={cn('space-y-1.5 px-5', className)} role="status" aria-live="polite">
      {reactionText?.trim() ? (
        <p className="text-xs italic leading-relaxed text-[var(--text-secondary)]">
          {reactionText.trim()}
        </p>
      ) : null}
      {lines.length ? (
        <div className="flex flex-wrap gap-1.5">
          {lines.map((line) => (
            <span
              key={line}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
            >
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
});
