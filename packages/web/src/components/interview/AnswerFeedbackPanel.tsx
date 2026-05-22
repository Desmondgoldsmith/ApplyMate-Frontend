'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

import { StarCoachingHint } from '@/components/interview/StarCoachingHint';
import { Button } from '@/components/ui/Button';
import { useMotionSafe } from '@/hooks/useMotionSafe';
import type { StarFeedback, TurnAnswerScores } from '@/lib/interview-prep-types';
import type { ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { personaFeedbackMessage } from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

function ScoreBar({
  value,
  label,
  meterClass,
  weak,
}: {
  value: number;
  label: string;
  meterClass: string;
  weak?: boolean;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_32px] items-center gap-2 rounded-md px-1 py-0.5',
        weak && 'bg-red-500/10 ring-1 ring-red-400/25',
      )}
    >
      <span className="text-[11px] text-white/55">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full', meterClass)} style={{ width: `${v}%` }} />
      </div>
      <span className="text-right text-[11px] font-semibold tabular-nums text-white/75">{v}</span>
    </div>
  );
}

function FeedbackBody({
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
  const lowest = [
    { key: 'clarity', value: scores.clarityScore },
    { key: 'structure', value: scores.structureScore },
    { key: 'relevance', value: scores.relevanceScore },
  ].sort((a, b) => a.value - b.value)[0];

  const personaLine = personaFeedbackMessage(persona, scores);

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
        {persona.personName} feedback
      </p>
      {personaLine ? (
        <p className="mt-2 text-sm font-medium text-white/90">{personaLine}</p>
      ) : null}
      <div className="mt-3 space-y-2">
        <ScoreBar
          value={scores.clarityScore}
          label="Clarity"
          meterClass={persona.theme.meterClass}
          weak={lowest?.key === 'clarity' && lowest.value < 60}
        />
        <ScoreBar
          value={scores.structureScore}
          label="Structure"
          meterClass={persona.theme.meterClass}
          weak={lowest?.key === 'structure' && lowest.value < 60}
        />
        <ScoreBar
          value={scores.relevanceScore}
          label="Relevance"
          meterClass={persona.theme.meterClass}
          weak={lowest?.key === 'relevance' && lowest.value < 60}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/75">
        <span className="font-semibold text-white/55">Tip</span> — {tip}
      </p>
      {persona.id === 'technical_interviewer' ? (
        <div className={cn('mt-3 space-y-2 rounded-lg border p-2.5', persona.theme.cardClass)}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Structured breakdown</p>
          <StarCoachingHint feedback={starFeedback} />
        </div>
      ) : (
        <StarCoachingHint feedback={starFeedback} className="mt-3" />
      )}
    </>
  );
}

export const AnswerFeedbackPanel = memo(function AnswerFeedbackPanel({
  persona,
  scores,
  starFeedback,
  improvementTip,
  onContinue,
  continueLabel = 'Next question',
  className,
}: {
  persona: ResolvedInterviewPersona;
  scores: TurnAnswerScores;
  starFeedback?: StarFeedback | null;
  improvementTip?: string;
  onContinue: () => void;
  continueLabel?: string;
  className?: string;
}) {
  const reduceMotion = useMotionSafe();

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

  const lowest = [
    { key: 'clarity', value: scores.clarityScore },
    { key: 'structure', value: scores.structureScore },
    { key: 'relevance', value: scores.relevanceScore },
  ].sort((a, b) => a.value - b.value)[0];

  const tip =
    improvementTip ??
    (lowest && lowest.value < 60
      ? `Try strengthening ${lowest.key} with a specific example and outcome.`
      : 'Solid answer — keep that level of detail on the next question.');

  return (
    <div
      className={cn('rounded-xl border p-4', persona.theme.cardClass, className)}
      role="region"
      aria-label="Answer feedback"
    >
      {reduceMotion ? (
        <FeedbackBody persona={persona} scores={scores} starFeedback={starFeedback} tip={tip} />
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <FeedbackBody persona={persona} scores={scores} starFeedback={starFeedback} tip={tip} />
        </motion.div>
      )}
      <Button className="mt-4 w-full" onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  );
});
