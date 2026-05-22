'use client';

import { memo } from 'react';

import type { FollowUpReason } from '@/lib/interview-prep-types';
import { FOLLOW_UP_REASON_COPY } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const FollowUpSuggestionBox = memo(function FollowUpSuggestionBox({
  followUpQuestion,
  reason,
  className,
}: {
  followUpQuestion: string;
  reason?: FollowUpReason;
  className?: string;
}) {
  const q = followUpQuestion.trim();
  if (!q) return null;

  const reasonCopy = reason ? FOLLOW_UP_REASON_COPY[reason] : null;

  return (
    <div
      className={cn(
        'rounded-lg border border-sky-400/25 bg-sky-500/8 px-3 py-2.5',
        className,
      )}
      role="note"
    >
      <p className="text-[11px] font-semibold text-sky-200/95">
        <span aria-hidden>💡 </span>
        Try answering this next
      </p>
      <p className="mt-1.5 text-sm leading-snug text-[var(--text-primary)]">{q}</p>
      {reasonCopy ? (
        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{reasonCopy}</p>
      ) : null}
      <p className="mt-2 text-[10px] text-[var(--text-muted)]">
        Optional — tap Next question when you are ready to continue.
      </p>
    </div>
  );
});
