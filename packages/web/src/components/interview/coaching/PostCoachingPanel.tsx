'use client';

import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { AnswerQualityMeter } from '@/components/interview/coaching/AnswerQualityMeter';
import { CoachingInsightSkeleton } from '@/components/interview/coaching/CoachingInsightSkeleton';
import type { CoachingLoadStatus, PostCoachingResponse } from '@/lib/interview-coaching-types';
import type { CoachInsightScore } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const PostCoachingPanel = memo(function PostCoachingPanel({
  data,
  status,
  className,
}: {
  data: PostCoachingResponse | null;
  status: CoachingLoadStatus;
  className?: string;
}) {
  const [improvedOpen, setImprovedOpen] = useState(false);

  if (status === 'loading' && !data) {
    return (
      <div className={cn('rounded-xl border border-[var(--border-subtle)] p-4', className)}>
        <CoachingInsightSkeleton />
      </div>
    );
  }

  if (!data) {
    if (status === 'error') {
      return (
        <p className={cn('text-xs text-[var(--text-muted)]', className)}>
          Detailed feedback is still loading — your answer was recorded.
        </p>
      );
    }
    return null;
  }

  const scores: CoachInsightScore = {
    clarity: data.score.clarity,
    structure: data.score.structure,
    relevance: data.score.relevance,
    depth: data.score.depth,
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          How you did
        </p>
        <AnswerQualityMeter scores={scores} className="mt-2" />
      </div>

      {data.feedback.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Feedback
          </p>
          <ul className="mt-2 space-y-1.5">
            {data.feedback.map((line) => (
              <li
                key={line}
                className="flex gap-2 text-sm leading-relaxed text-[var(--text-secondary)]"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--teal-500)]" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.coachingInsight?.trim() ? (
        <p className="text-sm italic leading-relaxed text-[var(--text-secondary)]">
          {data.coachingInsight.trim()}
        </p>
      ) : null}

      {data.improvedAnswer?.trim() ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)]">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            onClick={() => setImprovedOpen((v) => !v)}
            aria-expanded={improvedOpen}
          >
            <span className="text-[11px] font-semibold text-[var(--text-primary)]">
              Stronger way to say it
            </span>
            <ChevronDown
              className={cn('h-4 w-4 text-[var(--text-muted)] transition', improvedOpen && 'rotate-180')}
            />
          </button>
          {improvedOpen ? (
            <p className="border-t border-[var(--border-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {data.improvedAnswer.trim()}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.source !== 'gemini' && process.env.NODE_ENV !== 'production' ? (
        <p className="text-[9px] text-[var(--text-muted)]">Source: {data.source}</p>
      ) : null}
    </div>
  );
});
