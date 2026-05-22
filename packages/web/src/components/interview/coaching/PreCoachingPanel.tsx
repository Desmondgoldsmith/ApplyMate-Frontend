'use client';

import { memo } from 'react';
import { Lightbulb } from 'lucide-react';

import type { CoachingLoadStatus, PreCoachingResponse } from '@/lib/interview-coaching-types';
import type { CoachingSuggestedStructure } from '@/lib/interview-coaching-types';
import { cn } from '@/lib/utils';

function structureLabel(s: CoachingSuggestedStructure): string {
  switch (s) {
    case 'STAR':
      return 'STAR (Situation → Task → Action → Result)';
    case 'CAR':
      return 'CAR (Context → Action → Result)';
    default:
      return 'Clear beginning, middle, and end';
  }
}

function PreCoachingSkeleton() {
  return (
    <div className="animate-pulse space-y-3 px-1 py-1" aria-hidden>
      <div className="h-3 w-2/3 rounded bg-[var(--bg-surface-2)]" />
      <div className="h-2.5 w-full rounded bg-[var(--bg-surface-2)]" />
      <div className="h-2.5 w-5/6 rounded bg-[var(--bg-surface-2)]" />
      <div className="h-16 w-full rounded-lg bg-[var(--bg-surface-2)]" />
    </div>
  );
}

export const PreCoachingPanel = memo(function PreCoachingPanel({
  data,
  status,
  questionContext,
  className,
}: {
  data: PreCoachingResponse | null;
  status: CoachingLoadStatus;
  questionContext?: string;
  className?: string;
}) {
  if (status === 'idle') return null;

  const showSkeleton = status === 'loading' && !data;

  return (
    <section
      className={cn(
        'mx-5 rounded-[var(--radius-md)] border border-[var(--teal-500)]/20 bg-[var(--teal-500)]/5 px-4 py-3.5',
        className,
      )}
      aria-label="Guidance before you answer"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 shrink-0 text-[var(--text-teal)]" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-teal)]">
          Before you answer
        </p>
        {data?.cacheHit ? (
          <span className="ml-auto text-[9px] text-[var(--text-muted)]">Cached</span>
        ) : null}
      </div>

      {showSkeleton ? (
        <div className="mt-3 space-y-2">
          {questionContext?.trim() ? (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Interview context
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                {questionContext.trim()}
              </p>
            </div>
          ) : null}
          <PreCoachingSkeleton />
          <p className="text-[10px] text-[var(--text-muted)]">
            Loading tailored guidance for this question…
          </p>
        </div>
      ) : data ? (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              What the interviewer wants
            </p>
            <p className="mt-1 leading-relaxed text-[var(--text-primary)]">{data.intent}</p>
            {data.interviewerExpectation.length > 0 ? (
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-[var(--text-secondary)]">
                {data.interviewerExpectation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              How to structure your answer
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {structureLabel(data.suggestedStructure)}
            </p>
            {data.sampleAnswerBlueprint.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {data.sampleAnswerBlueprint.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2 text-xs leading-snug text-[var(--text-secondary)]"
                  >
                    <span className="text-[var(--text-teal)]" aria-hidden>
                      •
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {data.keyPointsToMention.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Key points to include
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {data.keyPointsToMention.map((point) => (
                  <li
                    key={point}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.redFlagsToAvoid.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                Common mistakes
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-100/85">
                {data.redFlagsToAvoid.map((flag) => (
                  <li key={flag}>· {flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Guidance will appear as you practice — keep going.
        </p>
      ) : null}
    </section>
  );
});
