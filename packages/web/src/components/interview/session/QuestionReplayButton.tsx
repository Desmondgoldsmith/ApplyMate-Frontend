'use client';

import { memo } from 'react';
import { RotateCcw } from 'lucide-react';

import { useInterviewVoiceRecording } from '@/contexts/InterviewVoiceContext';

export const QuestionReplayButton = memo(function QuestionReplayButton({
  visible,
  onReplay,
  interviewerSpeaking,
}: {
  visible: boolean;
  onReplay: () => void;
  interviewerSpeaking: boolean;
}) {
  const { isRecording } = useInterviewVoiceRecording();
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onReplay}
      disabled={interviewerSpeaking || isRecording}
      className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      title="Hear the question again"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      Replay question
    </button>
  );
});
