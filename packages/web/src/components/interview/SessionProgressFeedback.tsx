'use client';

import { memo, useMemo } from 'react';

import type { InterviewPersonaMemory } from '@/hooks/useInterviewPersonaMemory';
import { WEAKNESS_TAG_LABELS } from '@/lib/interview-prep-types';
import type { InterviewResult, InterviewSession } from '@/lib/api';
import { scoreFromInterviewResult, scoreFromInterviewSession } from '@/lib/interviewDisplayScore';
import { cn } from '@/lib/utils';

function weaknessLabel(tag: string): string {
  return WEAKNESS_TAG_LABELS[tag] ?? tag.replace(/_/g, ' ');
}

export const SessionProgressFeedback = memo(function SessionProgressFeedback({
  result,
  session,
  memory,
  className,
}: {
  result: InterviewResult;
  session: InterviewSession;
  memory: InterviewPersonaMemory;
  className?: string;
}) {
  const comparison = memory.previousComparison;
  const readiness =
    scoreFromInterviewResult(result) ??
    scoreFromInterviewSession(session) ??
    result.overallScore;

  const newWeakness = useMemo(() => {
    const fromSession = session.weaknessSnapshot?.weaknesses?.[0]?.tag;
    if (fromSession) return weaknessLabel(fromSession);
    const fresh = memory.weaknessTags.find((w) => w.count <= 1 && w.severity !== 'low');
    return fresh ? weaknessLabel(fresh.tag) : null;
  }, [memory.weaknessTags, session.weaknessSnapshot?.weaknesses]);

  const compositeDelta = comparison?.compositeDelta;
  const readinessDelta = comparison?.readinessDelta;
  const hasDelta = compositeDelta != null || readinessDelta != null;
  const improved = comparison?.improvedSinceLastSession ?? (readinessDelta != null && readinessDelta > 0);

  if (!hasDelta && !newWeakness && readiness === null) return null;

  return (
    <section
      className={cn(
        'rounded-2xl border border-white/10 bg-gradient-to-br from-[#0C0F0F] to-[#0a1414] p-4',
        className,
      )}
      aria-labelledby="session-progress-feedback-heading"
    >
      <h3 id="session-progress-feedback-heading" className="text-sm font-semibold text-white">
        Session progress
      </h3>
      <ul className="mt-3 space-y-2 text-sm text-white/80">
        {compositeDelta != null ? (
          <li>
            <span className="text-white/50">Score vs last time: </span>
            <span className={compositeDelta >= 0 ? 'font-medium text-emerald-300' : 'font-medium text-amber-200'}>
              {compositeDelta >= 0 ? '+' : ''}
              {Math.round(compositeDelta)} pts
            </span>
          </li>
        ) : null}
        {readinessDelta != null ? (
          <li>
            <span className="text-white/50">Readiness: </span>
            <span className={readinessDelta >= 0 ? 'font-medium text-emerald-300' : 'font-medium text-amber-200'}>
              {readinessDelta >= 0 ? '+' : ''}
              {Math.round(readinessDelta)} pts
            </span>
            {readiness != null ? (
              <span className="text-white/45"> (now {Math.round(readiness)})</span>
            ) : null}
          </li>
        ) : readiness != null ? (
          <li>
            <span className="text-white/50">Interview readiness: </span>
            <span className="font-medium text-[#00C9B1]">{Math.round(readiness)}</span>
          </li>
        ) : null}
        {newWeakness ? (
          <li>
            <span className="text-white/50">New focus detected: </span>
            <span className="font-medium text-amber-200/95">{newWeakness}</span>
          </li>
        ) : null}
        {improved && comparison?.improvementInsight ? (
          <li className="text-xs leading-relaxed text-white/60">{comparison.improvementInsight}</li>
        ) : null}
      </ul>
    </section>
  );
});
