'use client';

import { memo } from 'react';

import type { FollowUpCoachingItem } from '@/lib/interviewCoachingFeedback';
import { cn } from '@/lib/utils';

export const FollowUpSuggestions = memo(function FollowUpSuggestions({
  followUps,
  onAnswerFollowUp,
  onSkipItem,
  className,
}: {
  followUps: FollowUpCoachingItem[];
  onAnswerFollowUp: (item: FollowUpCoachingItem) => void;
  /** Dismiss only this sample question — does not advance the interview. */
  onSkipItem: (question: string) => void;
  className?: string;
}) {
  const items = followUps.filter((f) => f.question.trim());
  if (items.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)} role="region" aria-label="Follow-up questions">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Side questions (practice)
      </p>
      <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
        These do not count toward your main question total. Answer for extra practice, or skip and
        use Continue for the next main question.
      </p>
      {items.map((item, idx) => (
        <div
          key={`${item.question}-${idx}`}
          className="rounded-2xl rounded-bl-md border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2.5 transition-shadow duration-200 hover:shadow-md"
        >
          <p className="text-sm leading-snug text-[var(--text-primary)]">{item.question}</p>
          <p className="mt-1 text-[10px] font-medium text-[var(--text-teal)]">
            Does not count · practice only
          </p>
          {item.contextLabel ? (
            <p className="mt-0.5 text-[10px] italic text-[var(--text-muted)]">{item.contextLabel}</p>
          ) : item.reason ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">{item.reason}</p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              className="ip-coach-follow-btn rounded-full bg-[var(--teal-500)]/15 px-3 py-1 text-[11px] font-semibold text-[var(--text-teal)]"
              onClick={() => onAnswerFollowUp(item)}
            >
              Answer this
            </button>
            <button
              type="button"
              className="ip-coach-follow-btn rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              onClick={() => onSkipItem(item.question)}
            >
              Skip
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});
