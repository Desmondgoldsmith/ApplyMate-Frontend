'use client';

import { memo } from 'react';

import type { PressureTier } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const InterviewPressureMeter = memo(function InterviewPressureMeter({
  intensity,
  tier,
  visible,
  className,
}: {
  /** 0–100 gradual fill */
  intensity: number;
  tier: PressureTier;
  visible: boolean;
  className?: string;
}) {
  const fill = Math.max(0, Math.min(100, Math.round(intensity)));

  if (!visible) return null;

  return (
    <div
      className={cn(
        'space-y-1 transition-opacity duration-500',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
      role="meter"
      aria-valuenow={fill}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Interview pressure: ${tier}`}
    >
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Room pressure
        </span>
        <span className="capitalize text-[var(--text-secondary)]">{tier}</span>
      </div>
      <div
        className={cn(
          'h-1 overflow-hidden rounded-full bg-[var(--bg-surface-2)]',
          tier === 'high' && 'ip-pressure-track-high',
        )}
      >
        <div
          className={cn(
            'ip-pressure-fill h-full rounded-full transition-[width] duration-700 ease-out',
            tier === 'low' && 'bg-[var(--teal-500)]/60',
            tier === 'medium' && 'bg-amber-400/70 ip-pressure-pulse',
            tier === 'high' && 'bg-red-400/75 ip-pressure-pulse-fast',
          )}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
});
