'use client';

import { memo } from 'react';

import type { InterviewEmotion } from '@/lib/interview-prep-types';
import { EMOTION_DISPLAY } from '@/lib/interviewSimulation';
import { cn } from '@/lib/utils';

export const InterviewEmotionIndicator = memo(function InterviewEmotionIndicator({
  emotion,
  className,
  compact = false,
}: {
  emotion: InterviewEmotion;
  className?: string;
  compact?: boolean;
}) {
  const meta = EMOTION_DISPLAY[emotion] ?? EMOTION_DISPLAY.neutral;

  return (
    <span
      className={cn(
        'ip-emotion-indicator inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-2)]/90 px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] backdrop-blur-sm',
        `ip-emotion-${emotion}`,
        compact && 'px-1.5',
        className,
      )}
      role="status"
      aria-label={`Interviewer mood: ${meta.label}`}
    >
      <span className="ip-emotion-emoji text-sm leading-none" aria-hidden>
        {meta.emoji}
      </span>
      {!compact ? <span>{meta.label}</span> : null}
    </span>
  );
});
