'use client';

import { memo } from 'react';

import { EMOTION_DISPLAY } from '@/lib/interviewSimulation';
import type { SimulationPersonaUi } from '@/lib/interviewSimulationPersona';
import { personaToneLabel } from '@/lib/interviewSimulationPersona';
import type { InterviewEmotion } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const InterviewPersonaLiveIndicator = memo(function InterviewPersonaLiveIndicator({
  persona,
  emotion,
  avatarSrc,
  avatarAlt,
  className,
}: {
  persona: SimulationPersonaUi;
  emotion: InterviewEmotion;
  avatarSrc?: string;
  avatarAlt?: string;
  className?: string;
}) {
  const emotionUi = EMOTION_DISPLAY[emotion];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-md)] border border-white/8 bg-[var(--bg-surface-1)]/80 px-3 py-2',
        className,
      )}
      aria-label={`${persona.title}, ${persona.subtitle}`}
    >
      <div
        className={cn(
          'relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10',
          persona.atmosphere === 'intense' && 'ring-red-400/30',
          persona.atmosphere === 'tense' && 'ring-amber-400/25',
        )}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt={avatarAlt ?? persona.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--bg-surface-2)] text-lg">
            👤
          </div>
        )}
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-surface-1)] text-[10px] shadow"
          title={emotionUi.label}
          aria-hidden
        >
          {emotionUi.emoji}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{persona.title}</p>
        <p className="truncate text-[10px] text-[var(--text-muted)]">{persona.subtitle}</p>
        <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
          {personaToneLabel(persona.tone)}
        </p>
      </div>
    </div>
  );
});
