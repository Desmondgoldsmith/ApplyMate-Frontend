'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

import { CoachingAdaptiveSummary } from '@/components/interview/adaptive/CoachingAdaptiveSummary';
import { CoachInsightPanel } from '@/components/interview/coaching/CoachInsightPanel';
import { CoachingInsightSkeleton } from '@/components/interview/coaching/CoachingInsightSkeleton';
import { FollowUpSuggestionBox } from '@/components/interview/coaching/FollowUpSuggestionBox';
import { SampleAnswerPreview } from '@/components/interview/coaching/SampleAnswerPreview';
import { StarCoachingHint } from '@/components/interview/StarCoachingHint';
import { Button } from '@/components/ui/Button';
import { useMotionSafe } from '@/hooks/useMotionSafe';
import { buildCoachingSignalLines } from '@/lib/interviewAdaptive';
import {
  coachInsightDimensionScores,
  resolveCoachInsightFromResponse,
} from '@/lib/interviewCoachInsight';
import type { InterviewDimensionalProfile } from '@/lib/interview-prep-types';
import type {
  CoachInsight,
  FollowUpReason,
  StarFeedback,
  TurnAnswerResponse,
  TurnAnswerScores,
  TurnCoachingStatus,
} from '@/lib/interview-prep-types';
import type { ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

export type TurnCoachingSectionProps = {
  turnId: string;
  coachingStatus: TurnCoachingStatus;
  cachedInsight: CoachInsight | null;
  lastFeedback: TurnAnswerResponse | null;
  persona: ResolvedInterviewPersona;
  scores: TurnAnswerScores;
  starFeedback?: StarFeedback | null;
  adaptiveProfile?: InterviewDimensionalProfile | null;
  onContinue: () => void;
  continueLabel?: string;
  className?: string;
};

function LegacyFeedbackBody({
  persona,
  scores,
  starFeedback,
  tip,
}: {
  persona: ResolvedInterviewPersona;
  scores: TurnAnswerScores;
  starFeedback?: StarFeedback | null;
  tip: string;
}) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
        {persona.personName} feedback
      </p>
      <p className="mt-2 text-xs leading-relaxed text-white/75">
        <span className="font-semibold text-white/55">Tip</span> — {tip}
      </p>
      <StarCoachingHint feedback={starFeedback} className="mt-3" />
    </>
  );
}

export const TurnCoachingSection = memo(function TurnCoachingSection({
  turnId,
  coachingStatus,
  cachedInsight,
  lastFeedback,
  persona,
  scores,
  starFeedback,
  adaptiveProfile = null,
  onContinue,
  continueLabel = 'Next question',
  className,
}: TurnCoachingSectionProps) {
  const reduceMotion = useMotionSafe();

  const insight = useMemo(() => {
    if (cachedInsight) return cachedInsight;
    return resolveCoachInsightFromResponse(lastFeedback);
  }, [cachedInsight, lastFeedback]);

  const dimensionScores = useMemo(
    () => coachInsightDimensionScores(insight, scores),
    [insight, scores],
  );

  const signalLines = useMemo(
    () =>
      buildCoachingSignalLines(
        dimensionScores,
        adaptiveProfile?.weakAreas,
        adaptiveProfile?.strongAreas,
      ),
    [adaptiveProfile?.strongAreas, adaptiveProfile?.weakAreas, dimensionScores],
  );

  const followUpQuestion = useMemo(() => {
    const fromInsight = insight?.followUpQuestion?.trim();
    if (fromInsight) return fromInsight;
    return lastFeedback?.followUp?.question?.trim() ?? '';
  }, [insight?.followUpQuestion, lastFeedback?.followUp?.question]);

  const followUpReason = lastFeedback?.followUp?.reason as FollowUpReason | undefined;

  const isLoading = coachingStatus === 'loading';
  const showInsight = Boolean(insight) && coachingStatus === 'ready';

  if (!persona.showMidSessionFeedback) {
    return (
      <div className={cn('rounded-xl border border-white/10 bg-[#0B1010] p-4', className)}>
        <p className="text-sm text-white/60">Answer recorded. Full feedback will appear after the session.</p>
        <Button className="mt-4 w-full" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    );
  }

  const legacyTip =
    lastFeedback?.coaching?.tip?.trim() ??
    (insight?.hint?.trim() || 'Solid answer — keep that detail on the next question.');

  const inner = (
    <div className="space-y-3">
      {isLoading ? <CoachingInsightSkeleton /> : null}

      {showInsight && insight ? (
        <>
          <CoachingAdaptiveSummary lines={signalLines} />
          <CoachInsightPanel
            insight={insight}
            scores={dimensionScores}
            meterClass={persona.theme.meterClass}
            personaName={persona.personName}
          />
          {followUpQuestion ? (
            <FollowUpSuggestionBox followUpQuestion={followUpQuestion} reason={followUpReason} />
          ) : null}
          {insight.sampleAnswer ? <SampleAnswerPreview sampleAnswer={insight.sampleAnswer} /> : null}
        </>
      ) : null}

      {!showInsight && !isLoading ? (
        <LegacyFeedbackBody
          persona={persona}
          scores={scores}
          starFeedback={starFeedback}
          tip={legacyTip}
        />
      ) : null}
    </div>
  );

  return (
    <div
      className={cn('rounded-xl border p-4', persona.theme.cardClass, className)}
      data-turn-id={turnId}
      role="region"
      aria-label="Answer coaching"
    >
      {reduceMotion ? (
        inner
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {inner}
        </motion.div>
      )}
      <Button className="mt-4 w-full" onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  );
});
