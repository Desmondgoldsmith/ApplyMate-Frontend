'use client';

import { memo, useEffect, useMemo, type MutableRefObject } from 'react';

import { LiveCoachingOverlay } from '@/components/interview/coaching/LiveCoachingOverlay';
import { PreCoachingPanel } from '@/components/interview/coaching/PreCoachingPanel';
import { useInterviewVoiceTranscript } from '@/contexts/InterviewVoiceContext';
import { useInterviewCoaching } from '@/hooks/useInterviewCoaching';
import { useThrottledValue } from '@/hooks/useThrottledValue';
import type { InterviewPhase } from '@/components/interview/session/sessionTypes';

export type InterviewCoachingApi = ReturnType<typeof useInterviewCoaching>;

export type InterviewCoachingLayerProps = {
  sessionId: string;
  turnId: string | null;
  /** Turn or job context shown while pre-coaching loads. */
  questionContext?: string;
  phase: InterviewPhase;
  typedAnswer: string;
  elapsedSeconds: number;
  enabled: boolean;
  coachingRef?: MutableRefObject<InterviewCoachingApi | null>;
  onCoachingStateChange?: (api: InterviewCoachingApi) => void;
};

export const InterviewCoachingLayer = memo(function InterviewCoachingLayer({
  sessionId,
  turnId,
  questionContext,
  phase,
  typedAnswer,
  elapsedSeconds,
  enabled,
  coachingRef,
  onCoachingStateChange,
}: InterviewCoachingLayerProps) {
  const voice = useInterviewVoiceTranscript();

  const rawBuffer = voice.inputMode === 'voice' ? voice.transcript : typedAnswer;
  const answerBuffer = useThrottledValue(rawBuffer, 120);

  const prepActive =
    enabled &&
    Boolean(turnId) &&
    (phase === 'answering' || phase === 'questioning');

  const coaching = useInterviewCoaching({
    sessionId,
    turnId,
    enabled,
    prepActive,
    answerBuffer,
    elapsedSeconds,
  });

  if (coachingRef) {
    coachingRef.current = coaching;
  }

  useEffect(() => {
    onCoachingStateChange?.(coaching);
  }, [
    coaching,
    onCoachingStateChange,
  ]);

  const showPre =
    prepActive && (phase === 'answering' || phase === 'questioning');
  const showLive = phase === 'answering' && answerBuffer.trim().length >= 12;

  const bufferLength = useMemo(() => answerBuffer.trim().length, [answerBuffer]);

  if (!enabled) return null;

  return (
    <>
      {showPre ? (
        <PreCoachingPanel
          data={coaching.pre}
          status={coaching.preStatus}
          questionContext={questionContext}
          className="mb-2"
        />
      ) : null}
      {showLive ? (
        <LiveCoachingOverlay
          live={coaching.live}
          bufferLength={bufferLength}
          className="mb-2"
        />
      ) : null}
    </>
  );
});
