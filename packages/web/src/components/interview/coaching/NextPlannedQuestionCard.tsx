'use client';

import { memo } from 'react';

import type { NextQuestionPayload } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const NextPlannedQuestionCard = memo(function NextPlannedQuestionCard({
  nextPlanned,
  onAnswerThis,
  className,
}: {
  nextPlanned: NextQuestionPayload;
  onAnswerThis: () => void;
  className?: string;
}) {
  const text = nextPlanned.questionText?.trim();
  if (!text) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-teal)]/30 bg-[var(--teal-10)] px-3 py-2.5',
        className,
      )}
      role="region"
      aria-label="Next interview question"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-teal)]">
        {nextPlanned.turnKind === 'follow_up' ? 'Optional follow-up (counts)' : 'Next main question'}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
        {nextPlanned.label?.trim() ||
          (nextPlanned.turnKind === 'follow_up'
            ? 'Counts toward your session — not the same as practice side questions below.'
            : 'This is the next numbered main question when you press Continue.')}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-[var(--text-primary)]">
        {text}
      </p>
      {nextPlanned.turnId ? (
        <button
          type="button"
          className="ip-coach-follow-btn mt-2.5 rounded-full bg-[var(--teal-500)]/20 px-3 py-1 text-[11px] font-semibold text-[var(--text-teal)]"
          onClick={onAnswerThis}
        >
          Answer this question
        </button>
      ) : null}
    </div>
  );
});
