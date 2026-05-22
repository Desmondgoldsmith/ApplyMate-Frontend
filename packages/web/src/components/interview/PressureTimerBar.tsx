'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';

export const PressureTimerBar = memo(function PressureTimerBar({
  remainingSec,
  limitSec,
  ratio,
  isLow,
  pressureLabel,
}: {
  remainingSec: number;
  limitSec: number;
  ratio: number;
  isLow: boolean;
  pressureLabel?: string;
}) {
  if (limitSec <= 0) return null;

  return (
    <div className="space-y-1.5" role="timer" aria-live="polite">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-white/70">Time remaining</span>
        <span className={cn('tabular-nums font-semibold', isLow ? 'text-red-400' : 'text-white/80')}>
          {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full transition-[width,background-color] duration-300', isLow ? 'bg-red-500' : 'bg-[#00C9B1]')}
          style={{ width: `${Math.max(0, 100 - ratio * 100)}%` }}
        />
      </div>
      {pressureLabel ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">{pressureLabel}</p>
      ) : null}
    </div>
  );
});
