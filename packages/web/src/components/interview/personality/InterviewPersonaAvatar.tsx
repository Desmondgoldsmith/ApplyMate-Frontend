'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

import { InterviewAvatar } from '@/components/interview/InterviewAvatar';
import { useMotionSafe } from '@/hooks/useMotionSafe';
import { personaAvatarKey, type ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE: Record<AvatarSize, string> = {
  sm: 'h-14 w-14',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
};

const SIZE_COMPACT: Partial<Record<AvatarSize, string>> = {
  sm: 'h-10 w-10',
};

export const InterviewPersonaAvatar = memo(function InterviewPersonaAvatar({
  persona,
  isSpeaking,
  isListening,
  size = 'md',
  showLabel = true,
  showMoodBadge = true,
  compact = false,
  className,
}: {
  persona: ResolvedInterviewPersona;
  isSpeaking: boolean;
  isListening: boolean;
  size?: AvatarSize;
  showLabel?: boolean;
  showMoodBadge?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const reduceMotion = useMotionSafe();

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'relative shrink-0',
          compact && SIZE_COMPACT[size] ? SIZE_COMPACT[size] : SIZE[size],
        )}
      >
        {!reduceMotion ? (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 1px ${persona.accentColor}40` }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        ) : null}
        <div
          className={cn('relative h-full w-full overflow-hidden rounded-full ring-2', persona.theme.glowClass)}
          style={{ boxShadow: `0 0 0 2px ${persona.accentColor}66` }}
        >
          <InterviewAvatar
            personality={personaAvatarKey(persona)}
            isSpeaking={isSpeaking}
            isListening={isListening}
            size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
          />
        </div>
      </div>
      {showLabel ? (
        <div className="min-w-0">
          <p
            className={cn(
              'font-semibold text-[var(--text-primary)]',
              compact ? 'text-[13px]' : 'text-sm',
            )}
          >
            {persona.personName}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {persona.roleLabel} · {persona.tagline}
          </p>
          {showMoodBadge ? (
            <span
              className={cn(
                'mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                persona.theme.badgeClass,
              )}
            >
              {persona.moodLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
