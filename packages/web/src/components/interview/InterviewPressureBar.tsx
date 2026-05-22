'use client';

import { memo } from 'react';

import type { PressureTier } from '@/lib/interview-prep-types';
import { pressureBarPercent } from '@/lib/interviewSimulation';
import { cn } from '@/lib/utils';

export const InterviewPressureBar = memo(function InterviewPressureBar({
  tier,
  className,
}: {
  tier: PressureTier;
  className?: string;
}) {
  const fill = pressureBarPercent(tier);

  return (
    <div
      className={cn('space-y-1', className)}
      role="meter"
      aria-valuenow={fill}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Interview pressure: ${tier}`}
    >
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Interview pressure
        </span>
        <span className="capitalize text-[var(--text-secondary)]">{tier}</span>
      </div>
      <div
        className={cn(
          'h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-2)]',
          tier === 'high' && 'ip-pressure-track-high',
        )}
      >
        <div
          className={cn(
            'ip-pressure-fill h-full rounded-full transition-[width] duration-500',
            tier === 'low' && 'bg-[var(--teal-500)]/70',
            tier === 'medium' && 'bg-amber-400/75 ip-pressure-pulse',
            tier === 'high' && 'bg-red-400/80 ip-pressure-pulse-fast',
          )}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
});
