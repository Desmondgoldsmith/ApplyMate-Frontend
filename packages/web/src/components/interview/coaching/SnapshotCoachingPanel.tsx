'use client';

import { memo } from 'react';

import { AnswerQualityMeter } from '@/components/interview/coaching/AnswerQualityMeter';
import { CoachingInsightSkeleton } from '@/components/interview/coaching/CoachingInsightSkeleton';
import type { TurnCoachingUiState } from '@/lib/interviewCoachingSnapshot';
import { displayImprovedAnswer } from '@/lib/interviewCoachingSnapshot';
import type { CoachInsightScore } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const PARTIAL_CHECKS = [
  'Checking structure…',
  'Evaluating clarity…',
  'Reviewing depth…',
];

export const SnapshotCoachingPanel = memo(function SnapshotCoachingPanel({
  coachingState,
  questionText,
  className,
}: {
  coachingState: TurnCoachingUiState | null;
  questionText?: string;
  className?: string;
}) {
  if (!coachingState) return null;

  const { loading, partial, data } = coachingState;

  if (loading && !data) {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
        <p className="text-xs font-medium text-[var(--text-teal)]">Analyzing your answer…</p>
        {partial ? (
          <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {PARTIAL_CHECKS.map((label) => (
                <span
                  key={label}
                  className="animate-pulse rounded-full bg-[var(--bg-surface-1)] px-2 py-1 text-[10px] text-[var(--text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 rounded bg-[var(--bg-surface-1)] animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <CoachingInsightSkeleton />
        )}
      </div>
    );
  }

  if (!data) return null;

  const scores: CoachInsightScore = {
    clarity: data.score.clarity,
    structure: data.score.structure,
    relevance: data.score.relevance,
    depth: data.score.depth,
  };

  const exampleAnswer = displayImprovedAnswer(data, questionText);

  return (
    <div className={cn('space-y-4', className)} aria-live="polite">
      {data.coachingSummary?.trim() ? (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {data.coachingSummary.trim()}
        </p>
      ) : null}

      <AnswerQualityMeter scores={scores} />

      {data.strengths.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            What worked
          </p>
          <ul className="mt-1.5 space-y-1">
            {data.strengths.map((s) => (
              <li key={s} className="text-xs text-[var(--text-secondary)]">
                · {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.weaknesses.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            To improve
          </p>
          <ul className="mt-1.5 space-y-1">
            {data.weaknesses.map((w) => (
              <li key={w} className="text-xs text-[var(--text-secondary)]">
                · {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {exampleAnswer ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Example answer (for guidance only)
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
            {exampleAnswer}
          </p>
        </div>
      ) : null}
    </div>
  );
});
