'use client';

import type { VoiceHealth } from '@/lib/interviewSpeech';
import { cn } from '@/lib/utils';

const HEALTH_CONFIG: Record<
  VoiceHealth,
  { label: string; dotClass: string; textClass: string }
> = {
  good: {
    label: 'Voice ready',
    dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]',
    textClass: 'text-emerald-200/90',
  },
  unstable: {
    label: 'Voice unstable',
    dotClass: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]',
    textClass: 'text-amber-200/90',
  },
  fallback: {
    label: 'Typing mode',
    dotClass: 'bg-red-400/90 shadow-[0_0_8px_rgba(248,113,113,0.4)]',
    textClass: 'text-red-200/90',
  },
};

export function VoiceHealthIndicator({
  health,
  className,
}: {
  health: VoiceHealth;
  className?: string;
}) {
  const cfg = HEALTH_CONFIG[health];
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-[11px] font-medium', cfg.textClass, className)}
      title={cfg.label}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', cfg.dotClass)} aria-hidden />
      <span>{cfg.label}</span>
    </span>
  );
}
