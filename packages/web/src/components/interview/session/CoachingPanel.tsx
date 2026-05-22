'use client';

import { memo, useEffect, useMemo, useState } from 'react';

import {
  canEndInterviewSession,
  normalizeQuestionText,
  resolveNextPlannedNavigation,
  resolveOptionalNextNavigation,
  resolvePrepContinueLabel,
  resolveScoredAnswerText,
  textsToExcludeFromSuggestedFollowUps,
} from '@/lib/interviewPrepNavigation';

import { LearningMomentCard } from '@/components/interview/personalization/LearningMomentCard';
import { AnswerCoachingLoadingPanel } from '@/components/interview/coaching/AnswerCoachingLoadingPanel';
import { FollowUpSuggestions } from '@/components/interview/coaching/FollowUpSuggestions';
import { NextPlannedQuestionCard } from '@/components/interview/coaching/NextPlannedQuestionCard';
import type { FollowUpCoachingItem } from '@/lib/interviewCoachingFeedback';
import { turnAnswerResponseFromPractice } from '@/lib/interviewCoachingFeedback';
import {
  coachingSnapshotFromResponse,
  readyCoachingUiState,
} from '@/lib/interviewCoachingSnapshot';
import { InterviewMicroReaction } from '@/components/interview/InterviewMicroReaction';
import { ShapedCoachingPanel } from '@/components/interview/coaching/ShapedCoachingPanel';
import { TurnCoachingSection } from '@/components/interview/coaching/TurnCoachingSection';
import type { useCoachingSettings } from '@/hooks/useCoachingSettings';
import type { useInterviewPrepFlow } from '@/hooks/useInterviewPrepFlow';
import type { useInterviewSimulationExperience } from '@/hooks/useInterviewSimulationExperience';
import {
  followUpItemsFromCoaching,
  resolveAnsweredQuestionContext,
  resolveAnsweredQuestionText,
} from '@/lib/interviewCoachingFeedback';
import type { ProcessingInsightsDisplay } from '@/lib/interviewProcessingInsights';
import type { PracticeCoachingResponse, TurnAnswerResponse } from '@/lib/interview-prep-types';
import type { ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

type PrepFlow = ReturnType<typeof useInterviewPrepFlow>;
type SimExperience = ReturnType<typeof useInterviewSimulationExperience>;
type CoachingSettingsApi = ReturnType<typeof useCoachingSettings>;

export type CoachingPanelProps = {
  visible: boolean;
  isSimSession: boolean;
  interviewSim: SimExperience;
  simReactionVisible: boolean;
  prep: PrepFlow;
  coaching: CoachingSettingsApi;
  sessionPersona: ResolvedInterviewPersona;
  lastFeedback: TurnAnswerResponse | null;
  feedbackTurnId: string;
  isProcessingAnswer: boolean;
  processingInsights: ProcessingInsightsDisplay;
  onContinue: () => void;
  onContinueFromPractice: () => void;
  onEndInterview: () => void;
  answeredSideQuestions?: string[];
  onAnswerFollowUp: (item: FollowUpCoachingItem) => void;
  practiceFeedback?: PracticeCoachingResponse | null;
  practiceQuestionText?: string;
  practiceAnswerText?: string;
  onDismissPractice?: () => void;
  onAnswerNextPlanned: () => void;
  learningMoments?: string[];
};

export const CoachingPanel = memo(function CoachingPanel({
  visible,
  isSimSession,
  interviewSim,
  simReactionVisible,
  prep,
  coaching,
  sessionPersona,
  lastFeedback,
  feedbackTurnId,
  isProcessingAnswer,
  processingInsights,
  onContinue,
  onContinueFromPractice,
  onEndInterview,
  answeredSideQuestions = [],
  onAnswerFollowUp,
  onAnswerNextPlanned,
  learningMoments = [],
  practiceFeedback = null,
  practiceQuestionText = '',
  practiceAnswerText = '',
  onDismissPractice,
}: CoachingPanelProps) {
  const { settings } = coaching;

  const isPracticeFeedback = Boolean(practiceFeedback && practiceQuestionText.trim());

  const feedbackForCoaching = useMemo(() => {
    if (isPracticeFeedback && practiceFeedback) {
      return turnAnswerResponseFromPractice(
        practiceFeedback,
        practiceQuestionText,
        practiceAnswerText,
      );
    }
    return lastFeedback;
  }, [
    isPracticeFeedback,
    lastFeedback,
    practiceAnswerText,
    practiceFeedback,
    practiceQuestionText,
  ]);

  const coachingState = useMemo(() => {
    if (isPracticeFeedback && feedbackForCoaching) {
      const snapshot = coachingSnapshotFromResponse(feedbackForCoaching);
      if (snapshot) return readyCoachingUiState(snapshot);
      return { loading: false, partial: false, data: null };
    }
    return prep.getCoachingStateForTurn(feedbackTurnId);
  }, [feedbackForCoaching, feedbackTurnId, isPracticeFeedback, prep]);

  const answeredQuestionText = useMemo(
    () => resolveAnsweredQuestionText(feedbackForCoaching),
    [feedbackForCoaching],
  );
  const interviewerContext = useMemo(
    () => resolveAnsweredQuestionContext(feedbackForCoaching),
    [feedbackForCoaching],
  );
  const userAnswerText = useMemo(
    () => resolveScoredAnswerText(feedbackForCoaching),
    [feedbackForCoaching],
  );

  const nextPlanned = useMemo(
    () => (isPracticeFeedback ? null : resolveNextPlannedNavigation(lastFeedback)),
    [isPracticeFeedback, lastFeedback],
  );

  const followUpExcludeTexts = useMemo(
    () => textsToExcludeFromSuggestedFollowUps(lastFeedback),
    [lastFeedback],
  );

  const followUps = useMemo(
    () =>
      isPracticeFeedback
        ? []
        : followUpItemsFromCoaching(lastFeedback?.suggestedFollowUps, answeredQuestionText, {
            excludeTexts: followUpExcludeTexts,
            answeredSideQuestions,
          }),
    [
      answeredQuestionText,
      answeredSideQuestions,
      followUpExcludeTexts,
      isPracticeFeedback,
      lastFeedback?.suggestedFollowUps,
    ],
  );

  const [dismissedFollowUpKeys, setDismissedFollowUpKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissedFollowUpKeys(new Set());
  }, [feedbackTurnId]);

  const visibleFollowUps = useMemo(
    () =>
      followUps.filter((item) => !dismissedFollowUpKeys.has(normalizeQuestionText(item.question))),
    [dismissedFollowUpKeys, followUps],
  );

  const dismissFollowUp = (question: string) => {
    const key = normalizeQuestionText(question);
    if (!key) return;
    setDismissedFollowUpKeys((prev) => new Set(prev).add(key));
  };

  const mainComplete = canEndInterviewSession(prep.questionProgress, lastFeedback);
  const optionalNext = useMemo(
    () => (isPracticeFeedback ? null : resolveOptionalNextNavigation(lastFeedback)),
    [isPracticeFeedback, lastFeedback],
  );
  const showMainCoaching =
    !isProcessingAnswer && Boolean(feedbackForCoaching?.coachingFeedback);

  const showFollowUps =
    settings.enabled && showMainCoaching && visibleFollowUps.length > 0;

  const continueLabel = resolvePrepContinueLabel(
    prep.questionProgress,
    prep.turnIndex,
    prep.turnQueueLength,
  );

  const showNextMain =
    showMainCoaching &&
    !mainComplete &&
    (visibleFollowUps.length === 0 || dismissedFollowUpKeys.size >= followUps.length);

  const showEndInterview = showMainCoaching && mainComplete;

  if (!visible || !settings.enabled) return null;

  if (isProcessingAnswer) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center border-t border-[var(--border-subtle)] bg-[var(--bg-surface-1)]/60 px-5 py-10">
        <AnswerCoachingLoadingPanel insights={processingInsights} className="w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-1)]/40 px-5 pb-5 pt-4">
      {isSimSession && interviewSim.active ? (
        <InterviewMicroReaction
          className="mb-3 px-0"
          lines={interviewSim.microReactions}
          reactionText={simReactionVisible ? interviewSim.reactionText : null}
        />
      ) : null}

      {showMainCoaching ? (
        <div className="space-y-4">
          <div>
            <p className="ip-coach-section-title text-[11px] font-semibold uppercase tracking-wider">
              {isPracticeFeedback ? 'Side question coaching' : 'Coaching feedback'}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {isPracticeFeedback
                ? 'Practice only — does not change your main question count.'
                : 'Scores and tips for the answer you just gave — not the next question.'}
            </p>
          </div>

          <LearningMomentCard moments={learningMoments} />

          {answeredQuestionText ? (
            <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-3">
              <div>
                <p className="ip-coach-section-title text-[10px] font-semibold uppercase tracking-wider">
                  Question answered
                </p>
                <p className="ip-coach-body-emphasis mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {answeredQuestionText}
                </p>
              </div>
              {userAnswerText ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                    Your response
                  </p>
                  <p className="ip-coach-your-response mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {userAnswerText}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <ShapedCoachingPanel
            coachingState={coachingState}
            lastFeedback={feedbackForCoaching}
            intensity={settings.intensity}
            answeredQuestionText={answeredQuestionText}
            interviewerContext={interviewerContext}
          />

          {nextPlanned?.turnId &&
          nextPlanned.questionText?.trim() &&
          normalizeQuestionText(nextPlanned.questionText) !==
            normalizeQuestionText(answeredQuestionText) ? (
            <NextPlannedQuestionCard
              className="mt-1"
              nextPlanned={nextPlanned}
              onAnswerThis={onAnswerNextPlanned}
            />
          ) : null}

          {showFollowUps ? (
            <FollowUpSuggestions
              followUps={visibleFollowUps}
              onAnswerFollowUp={(item) => {
                prep.setSelectedFollowUpQuestion(item.question);
                onAnswerFollowUp(item);
              }}
              onSkipItem={dismissFollowUp}
            />
          ) : null}

          {optionalNext?.turnId &&
          optionalNext.questionText?.trim() &&
          normalizeQuestionText(optionalNext.questionText) !==
            normalizeQuestionText(answeredQuestionText) ? (
            <NextPlannedQuestionCard
              className="mt-1"
              nextPlanned={optionalNext}
              onAnswerThis={() => {
                prep.setSelectedFollowUpQuestion(optionalNext.questionText.trim());
                onAnswerFollowUp({
                  question: optionalNext.questionText.trim(),
                  reason: 'Optional follow-up on your last answer.',
                  practiceOnly: false,
                });
              }}
            />
          ) : null}

          {showEndInterview ? (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-[var(--text-muted)]">
                All main questions are done. End the interview to get your full report, or try a
                side practice question first.
              </p>
              <button
                type="button"
                className="ip-btn-primary w-full cursor-pointer transition-transform active:scale-[0.98]"
                onClick={onEndInterview}
              >
                End interview
              </button>
            </div>
          ) : null}

          {isPracticeFeedback ? (
            <div className="space-y-2 pt-1">
              {mainComplete ? (
                <p className="text-[10px] text-[var(--text-muted)]">
                  Return to coaching to try another side question or end the interview for your
                  full report.
                </p>
              ) : null}
              <button
                type="button"
                className="ip-btn-primary w-full cursor-pointer transition-transform active:scale-[0.98]"
                onClick={onContinueFromPractice}
              >
                {mainComplete ? 'Back to coaching options' : 'Continue'}
              </button>
              {mainComplete ? (
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-1)]"
                  onClick={onEndInterview}
                >
                  End interview
                </button>
              ) : null}
            </div>
          ) : null}

          {showNextMain ? (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-[var(--text-muted)]">
                Continue moves to the next main interview question in your session.
              </p>
              <button
                type="button"
                className={cn(
                  'ip-btn-primary w-full cursor-pointer transition-transform active:scale-[0.98]',
                )}
                onClick={onContinue}
              >
                {continueLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : lastFeedback && !isPracticeFeedback ? (
        <TurnCoachingSection
          turnId={feedbackTurnId}
          coachingStatus={prep.getCoachingStatusForTurn(feedbackTurnId)}
          cachedInsight={prep.getCoachingForTurn(feedbackTurnId)}
          lastFeedback={lastFeedback}
          persona={sessionPersona}
          scores={lastFeedback.scores}
          starFeedback={lastFeedback.starFeedback ?? lastFeedback.coachInsight?.star}
          adaptiveProfile={prep.adaptiveSnapshot.profile}
          onContinue={onContinue}
          continueLabel={continueLabel}
        />
      ) : (
        <AnswerCoachingLoadingPanel insights={processingInsights} />
      )}
    </div>
  );
});
