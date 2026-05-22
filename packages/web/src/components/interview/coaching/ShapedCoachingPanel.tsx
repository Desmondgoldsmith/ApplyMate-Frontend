'use client';

import { memo } from 'react';

import { CollapsibleCoachingSection } from '@/components/interview/coaching/CollapsibleCoachingSection';
import { CoachingInsightSkeleton } from '@/components/interview/coaching/CoachingInsightSkeleton';
import type { TurnCoachingUiState } from '@/lib/interviewCoachingSnapshot';
import { StarBreakdownSection } from '@/components/interview/coaching/StarBreakdownSection';
import {
  buildCoachingPanelView,
  coachingFeedbackFromResponse,
  isWeakScore,
  resolveExampleAnswer,
} from '@/lib/interviewCoachingFeedback';
import type { CoachingIntensity, TurnAnswerResponse } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

function ScorePill({ label, value }: { label: string; value: number }) {
  const weak = isWeakScore(value);
  return (
    <div
      className={cn(
        'rounded-md border px-2 py-1 text-center transition-shadow duration-300',
        weak
          ? 'border-amber-400/35 bg-amber-500/10 ip-coach-score-weak'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-1)]',
      )}
    >
      <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', weak ? 'text-amber-100' : 'text-[var(--text-primary)]')}>
        {Math.round(value)}
      </p>
    </div>
  );
}

export const ShapedCoachingPanel = memo(function ShapedCoachingPanel({
  coachingState,
  lastFeedback,
  intensity,
  answeredQuestionText,
  interviewerContext,
  className,
}: {
  coachingState: TurnCoachingUiState | null;
  lastFeedback: TurnAnswerResponse | null;
  intensity: CoachingIntensity;
  /** Question that was scored — not the next question on screen. */
  answeredQuestionText?: string;
  interviewerContext?: string;
  className?: string;
}) {
  if (!coachingState) return <CoachingInsightSkeleton className={className} />;

  const { loading, partial, data: snapshot } = coachingState;

  if (loading && !lastFeedback?.coachingFeedback && !snapshot) {
    return <CoachingInsightSkeleton partial={partial} className={className} />;
  }

  const feedback = coachingFeedbackFromResponse(lastFeedback);
  const view = buildCoachingPanelView(
    feedback,
    snapshot,
    intensity,
    interviewerContext,
    answeredQuestionText,
  );

  if (!view) {
    return <CoachingInsightSkeleton className={className} />;
  }

  const exampleAnswer =
    view.exampleAnswer ||
    resolveExampleAnswer(feedback, snapshot, answeredQuestionText);

  return (
    <div
      className={cn('ip-coach-panel-enter space-y-3', className)}
      aria-live="polite"
    >
      {view.summary ? (
        <p className="text-sm font-medium leading-snug text-[var(--text-primary)]">{view.summary}</p>
      ) : null}

      {view.showScores ? (
        <div className="grid grid-cols-4 gap-1.5">
          <ScorePill label="Clarity" value={view.scores.clarity} />
          <ScorePill label="Structure" value={view.scores.structure} />
          <ScorePill label="Depth" value={view.scores.depth} />
          <ScorePill label="Relevance" value={view.scores.relevance} />
        </div>
      ) : null}

      <div className="ip-coach-focus-pulse rounded-lg border border-[var(--teal-500)]/30 bg-[var(--teal-500)]/8 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-teal)]">
          Focus area
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{view.focusLabel}</p>
      </div>

      {view.improvements.length > 0 ? (
        <div>
          <p className="ip-coach-section-title text-[10px] font-semibold uppercase tracking-wider">
            Key feedback
          </p>
          <ul className="mt-1.5 space-y-1">
            {view.improvements.map((item) => (
              <li key={item} className="ip-coach-body-primary text-xs leading-relaxed">
                · {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view.showInterviewerInsight && view.interviewerInsight ? (
        <CollapsibleCoachingSection title="What the interviewer wants" defaultOpen active>
          <p className="ip-coach-interviewer-wants text-xs leading-relaxed">
            {view.interviewerInsight}
          </p>
        </CollapsibleCoachingSection>
      ) : null}

      {view.showStar ? (
        <StarBreakdownSection
          parts={view.starParts}
          hintOnly={view.starShowHintOnly}
        />
      ) : null}

      {view.keyIssues.length > 0 && intensity !== 'light' ? (
        <CollapsibleCoachingSection title="Key improvements">
          <ul className="space-y-1">
            {view.keyIssues.map((issue) => (
              <li key={issue} className="text-xs text-[var(--text-secondary)]">
                · {issue}
              </li>
            ))}
          </ul>
        </CollapsibleCoachingSection>
      ) : null}

      {view.showExample && exampleAnswer ? (
        <CollapsibleCoachingSection title="Example solution (model answer)" defaultOpen active>
          <p className="ip-coach-example-highlight whitespace-pre-wrap text-sm leading-relaxed">
            {exampleAnswer}
          </p>
        </CollapsibleCoachingSection>
      ) : null}
    </div>
  );
});
