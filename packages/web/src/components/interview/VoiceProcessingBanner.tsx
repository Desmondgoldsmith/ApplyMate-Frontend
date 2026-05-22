'use client';

import type { VoiceProcessingStatus } from '@/lib/interviewSpeech';
import { cn } from '@/lib/utils';

const LABELS: Partial<Record<VoiceProcessingStatus, string>> = {
  recording: 'Preparing microphone…',
  whisper: 'Transcribing your answer…',
  enhancing: 'Enhancing audio…',
  generating_voice: 'Generating interviewer voice…',
};

export function VoiceProcessingBanner({
  status,
  className,
}: {
  status: VoiceProcessingStatus;
  className?: string;
}) {
  const label = LABELS[status];
  if (!label || status === 'idle') return null;

  return (
    <p
      className={cn(
        'px-5 text-xs font-medium text-[var(--text-teal)] animate-pulse',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {label}
    </p>
  );
}
