'use client';

import { memo } from 'react';

import { ImprovementPlanCard } from '@/components/interview/results/ImprovementPlanCard';
import { ProgressTimeline } from '@/components/interview/results/ProgressTimeline';
import { ReadinessScoreV2 } from '@/components/interview/results/ReadinessScoreV2';
import { WeaknessDashboard } from '@/components/interview/results/WeaknessDashboard';
import { useInterviewImprovementPlan, useInterviewPrepProgress } from '@/hooks/useInterviewPrep';
import { useInterviewSessions } from '@/hooks/useInterviews';
import { scoreFromInterviewResult } from '@/lib/interviewDisplayScore';
import type { InterviewResult, InterviewSession } from '@/lib/api';

export const InterviewResultPrepSections = memo(function InterviewResultPrepSections({
  session,
  result,
}: {
  session: InterviewSession;
  result: InterviewResult;
}) {
  const planQ = useInterviewImprovementPlan(session.id, session.status === 'completed');
  const progressQ = useInterviewPrepProgress(session.status === 'completed');
  const sessionsQ = useInterviewSessions();

  const displayReadiness =
    scoreFromInterviewResult(result) ?? result.readinessScore ?? session.readinessScore;

  return (
    <>
      <ReadinessScoreV2
        readinessScore={displayReadiness ?? undefined}
        breakdown={result.readinessBreakdown ?? session.readinessBreakdown}
      />
      <WeaknessDashboard snapshot={session.weaknessSnapshot} />
      <ImprovementPlanCard plan={planQ.data} sessionId={session.id} />
      {progressQ.data ? (
        <ProgressTimeline
          progress={progressQ.data}
          sessions={sessionsQ.data ?? []}
          currentSessionId={session.id}
        />
      ) : null}
    </>
  );
});
