'use client';

import { memo, useMemo } from 'react';

import type { LiveCoachingResponse } from '@/lib/interview-coaching-types';
import { liveCoachingChips } from '@/lib/interviewCoachingLive';
import { cn } from '@/lib/utils';

export const LiveCoachingOverlay = memo(function LiveCoachingOverlay({
  live,
  bufferLength,
  className,
}: {
  live: LiveCoachingResponse | null;
  bufferLength: number;
  className?: string;
}) {
  const chips = useMemo(() => liveCoachingChips(live, bufferLength), [bufferLength, live]);

  const hint = live?.hint?.trim();
  if (!hint && chips.length === 0) return null;

  return (
    <div
      className={cn(
        'pointer-events-none mx-5 flex flex-col gap-1.5',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="Live answer hints"
    >
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                chip.tone === 'positive' &&
                  'border border-[var(--teal-500)]/30 bg-[var(--teal-500)]/10 text-[var(--text-teal)]',
                chip.tone === 'caution' &&
                  'border border-amber-400/25 bg-amber-500/8 text-amber-100/90',
                chip.tone === 'neutral' &&
                  'border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-muted)]',
              )}
            >
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
      {hint ? (
        <p className="text-[11px] italic leading-snug text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
});
