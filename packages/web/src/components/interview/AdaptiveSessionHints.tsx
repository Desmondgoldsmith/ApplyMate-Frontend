'use client';

import { memo } from 'react';

import type { InterviewPersonaMemory } from '@/hooks/useInterviewPersonaMemory';
import { formatFocusAreaLabel } from '@/lib/interviewPersonaTone';
import { cn } from '@/lib/utils';

export const AdaptiveSessionHints = memo(function AdaptiveSessionHints({
  memory,
  showAdaptiveNote = true,
  className,
}: {
  memory: Pick<
    InterviewPersonaMemory,
    'primaryFocusArea' | 'difficultyLevel' | 'sessionAdaptation' | 'preferredDifficulty'
  >;
  showAdaptiveNote?: boolean;
  className?: string;
}) {
  const focus = memory.primaryFocusArea;
  const difficulty =
    memory.sessionAdaptation?.difficultyLevel ?? memory.difficultyLevel ?? memory.preferredDifficulty;

  if (!showAdaptiveNote && !focus) return null;

  return (
    <div className={cn('mx-5 flex flex-wrap gap-2', className)}>
      {showAdaptiveNote ? (
        <span className="rounded-full border border-[var(--border-teal)]/35 bg-[var(--teal-10)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-teal)]">
          Adapted to your progress
        </span>
      ) : null}
      {focus ? (
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 py-0.5 text-[10px] text-[var(--text-muted)]">
          Focus: {formatFocusAreaLabel(focus)}
        </span>
      ) : null}
      {difficulty && difficulty !== 'adaptive' ? (
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2.5 py-0.5 text-[10px] text-[var(--text-muted)]">
          Difficulty: {formatFocusAreaLabel(String(difficulty))}
        </span>
      ) : null}
    </div>
  );
});
