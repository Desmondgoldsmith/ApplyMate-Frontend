'use client';

import { memo } from 'react';

import { InterviewPersonaAvatar } from '@/components/interview/personality/InterviewPersonaAvatar';
import type { ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { PREP_MODE_LABELS, type PrepMode } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const SessionPersonalityHeader = memo(function SessionPersonalityHeader({
  persona,
  isSpeaking,
  isListening,
  prepMode,
  adaptiveOn,
  sessionModeLabel,
  className,
}: {
  persona: ResolvedInterviewPersona;
  isSpeaking: boolean;
  isListening: boolean;
  prepMode?: PrepMode;
  adaptiveOn?: boolean;
  sessionModeLabel?: string;
  className?: string;
}) {
  const modeLabel =
    sessionModeLabel ??
    (prepMode && prepMode !== 'standard' ? PREP_MODE_LABELS[prepMode] : 'Mock interview');
  const showMockPill = prepMode && prepMode !== 'standard';

  return (
    <header
      className={cn(
        'mx-5 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-3',
        className,
      )}
    >
      <InterviewPersonaAvatar
        persona={persona}
        isSpeaking={isSpeaking}
        isListening={isListening}
        size="sm"
        showLabel
        showMoodBadge={false}
        compact
      />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <span className="ip-status-pill ip-status-pill-teal">{persona.roleLabel} active</span>
        {adaptiveOn ? (
          <span className="ip-status-pill ip-status-pill-teal">Adaptive mode on</span>
        ) : null}
        {showMockPill ? (
          <span className="ip-status-pill ip-status-pill-muted">{modeLabel}</span>
        ) : null}
      </div>
    </header>
  );
});
