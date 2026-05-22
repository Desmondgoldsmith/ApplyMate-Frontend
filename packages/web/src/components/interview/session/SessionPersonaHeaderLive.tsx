'use client';

import { memo } from 'react';

import { SessionPersonalityHeader } from '@/components/interview/personality/SessionPersonalityHeader';
import { useInterviewVoiceRecording } from '@/contexts/InterviewVoiceContext';
import type { ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import type { PrepMode } from '@/lib/interview-prep-types';

export const SessionPersonaHeaderLive = memo(function SessionPersonaHeaderLive({
  persona,
  isSpeaking,
  phase,
  prepMode,
  adaptiveOn,
}: {
  persona: ResolvedInterviewPersona;
  isSpeaking: boolean;
  phase: string;
  prepMode?: PrepMode;
  adaptiveOn: boolean;
}) {
  const { isListening } = useInterviewVoiceRecording();

  return (
    <SessionPersonalityHeader
      persona={persona}
      isSpeaking={isSpeaking}
      isListening={phase === 'answering' && isListening}
      prepMode={prepMode}
      adaptiveOn={adaptiveOn}
    />
  );
});
