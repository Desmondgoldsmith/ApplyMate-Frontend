'use client';

import { memo } from 'react';

import { pickImprovingArea, pickPrimaryWeakArea, weakAreaLabel } from '@/lib/interviewAdaptive';
import type { InterviewDimensionalProfile } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const WeakAreaIndicatorPanel = memo(function WeakAreaIndicatorPanel({
  profile,
  className,
}: {
  profile: InterviewDimensionalProfile | null;
  className?: string;
}) {
  if (!profile) return null;

  const focus = pickPrimaryWeakArea(profile.weakAreas);
  const improving = pickImprovingArea(profile.strongAreas, profile);
  const chips = (profile.weakAreas ?? []).slice(0, 2).map(weakAreaLabel);

  if (!focus && !improving && chips.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-3 py-2.5',
        className,
      )}
      role="region"
      aria-label="Adaptive focus areas"
    >
      {improving ? (
        <p className="text-xs text-[var(--text-secondary)]">
          <span className="font-semibold text-emerald-300/90">You&apos;re improving in: </span>
          {improving}
        </p>
      ) : null}
      {focus ? (
        <p className={cn('text-xs text-[var(--text-secondary)]', improving && 'mt-1.5')}>
          <span className="font-semibold text-[var(--text-teal)]">Focus area: </span>
          {focus}
        </p>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-[var(--border-default)] bg-black/20 px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
});
