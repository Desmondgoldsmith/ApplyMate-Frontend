'use client';

import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export const RealInterviewModeIndicator = memo(function RealInterviewModeIndicator({
  className,
  emotionActive = true,
  adaptiveActive = true,
  pressureActive = true,
}: {
  className?: string;
  emotionActive?: boolean;
  adaptiveActive?: boolean;
  pressureActive?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        'mx-5 rounded-[var(--radius-md)] border border-amber-400/25 bg-amber-500/5',
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold text-amber-100/95">
          🧠 Real Interview Mode Active
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-amber-200/70 transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="space-y-1 border-t border-amber-400/15 px-3 py-2 text-[10px] text-amber-100/75">
          <li>{emotionActive ? '✓' : '○'} Emotion system active</li>
          <li>{adaptiveActive ? '✓' : '○'} Adaptive difficulty active</li>
          <li>{pressureActive ? '✓' : '○'} Pressure system active</li>
        </ul>
      ) : null}
    </div>
  );
});
