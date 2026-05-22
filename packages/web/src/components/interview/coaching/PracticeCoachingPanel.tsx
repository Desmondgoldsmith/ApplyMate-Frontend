'use client';

import { memo, useMemo } from 'react';

import { ShapedCoachingPanel } from '@/components/interview/coaching/ShapedCoachingPanel';
import {
  coachingSnapshotFromResponse,
  readyCoachingUiState,
  type TurnCoachingUiState,
} from '@/lib/interviewCoachingSnapshot';
import { turnAnswerResponseFromPractice } from '@/lib/interviewCoachingFeedback';
import type { CoachingIntensity, PracticeCoachingResponse } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const PracticeCoachingPanel = memo(function PracticeCoachingPanel({
  practice,
  intensity,
  questionText,
  answerText,
  onDismiss,
  className,
}: {
  practice: PracticeCoachingResponse;
  intensity: CoachingIntensity;
  questionText: string;
  answerText?: string;
  onDismiss: () => void;
  className?: string;
}) {
  const lastFeedback = useMemo(
    () => turnAnswerResponseFromPractice(practice, questionText, answerText),
    [answerText, practice, questionText],
  );

  const coachingState: TurnCoachingUiState = useMemo(() => {
    const snapshot = coachingSnapshotFromResponse(lastFeedback);
    if (snapshot) return readyCoachingUiState(snapshot);
    return { loading: false, partial: false, data: null };
  }, [lastFeedback]);

  return (
    <div
      className={cn(
        'mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Practice coaching
        </p>
        <button
          type="button"
          className="text-[10px] font-medium text-[var(--text-teal)] hover:underline"
          onClick={onDismiss}
        >
          Back
        </button>
      </div>
      <ShapedCoachingPanel
        coachingState={coachingState}
        lastFeedback={lastFeedback}
        intensity={intensity}
        answeredQuestionText={questionText}
      />
    </div>
  );
});
