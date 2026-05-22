'use client';

import { memo } from 'react';
import { Check } from 'lucide-react';

import { InterviewAvatar } from '@/components/interview/InterviewAvatar';
import {
  INTERVIEW_PERSONAS,
  personaAvatarKey,
  type InterviewPersonaId,
  type ResolvedInterviewPersona,
} from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

const MOOD_BADGE: Record<InterviewPersonaId, string> = {
  friendly_coach: 'border-[var(--border-teal)] bg-[var(--teal-10)] text-[var(--text-teal)]',
  strict_interviewer: 'border border-red-400/25 bg-red-500/10 text-[var(--text-red)]',
  hr_interviewer: 'border border-blue-400/25 bg-blue-500/10 text-blue-300',
  technical_interviewer: 'border border-violet-400/25 bg-violet-500/10 text-violet-300',
  silent_observer: 'border-[var(--border-default)] bg-white/[0.06] text-[var(--text-secondary)]',
};

export const PersonaSelectorCard = memo(function PersonaSelectorCard({
  personaId,
  selected,
  onSelect,
}: {
  personaId: InterviewPersonaId;
  selected: boolean;
  onSelect: () => void;
}) {
  const cfg: ResolvedInterviewPersona = INTERVIEW_PERSONAS[personaId];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('ip-persona-card w-full active:scale-[0.98]', selected && 'ip-persona-card-active')}
    >
      {selected ? (
        <span className="ip-option-check" aria-hidden>
          <Check className="h-3 w-3 text-[var(--bg-base)]" strokeWidth={3} />
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'shrink-0 rounded-full',
            selected && 'shadow-[0_0_0_2px_var(--bg-surface-2),0_0_0_4px_var(--teal)]',
          )}
        >
          <InterviewAvatar
            personality={personaAvatarKey(cfg)}
            isSpeaking={false}
            isListening={false}
            size="sm"
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          {cfg.recommended ? (
            <span className="rounded-[var(--radius-pill)] border border-[var(--border-teal)] bg-[var(--teal-10)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-teal)]">
              Recommended
            </span>
          ) : null}
          <span
            className={cn(
              'inline-flex rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
              MOOD_BADGE[personaId],
            )}
          >
            {cfg.moodLabel}
          </span>
        </div>
      </div>

      <p className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">{cfg.personName}</p>
      <p className="mt-0.5 text-xs font-medium text-[var(--text-teal)]">{cfg.roleLabel}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{cfg.tagline}</p>
    </button>
  );
});
