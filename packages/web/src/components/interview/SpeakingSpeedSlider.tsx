'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';

const SPEEDS = [
  { value: 0.75, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Faster' },
  { value: 1.5, label: 'Fast' },
] as const;

export const SpeakingSpeedSlider = memo(function SpeakingSpeedSlider({
  value,
  onChange,
  className,
  id = 'speaking-speed',
}: {
  value: number;
  onChange: (speed: number) => void;
  className?: string;
  id?: string;
}) {
  const clamped = Math.max(0.75, Math.min(1.5, value));

  return (
    <div className={className}>
      <div className="flex max-w-[560px] items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-[var(--text-primary)]">
          Speaking speed
        </label>
        <span className="text-[13px] font-semibold tabular-nums text-[var(--text-teal)]">
          {clamped.toFixed(2)}×
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0.75}
        max={1.5}
        step={0.05}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ip-slider mt-2.5"
        aria-valuemin={0.75}
        aria-valuemax={1.5}
        aria-valuenow={clamped}
        aria-label="Speaking speed"
      />
      <div className="mt-1.5 flex max-w-[560px] justify-between text-[11px] text-[var(--text-muted)]">
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={cn(
              'rounded px-1 py-0.5 transition hover:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--teal)]',
              Math.abs(clamped - s.value) < 0.06 && 'font-semibold text-[var(--text-teal)]',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
});
