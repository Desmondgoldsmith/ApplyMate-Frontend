'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';

export const InterruptionOverlay = memo(function InterruptionOverlay({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  if (!visible || !message) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-3"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={cn(
          'max-w-md rounded-xl border border-amber-400/40 bg-amber-950/90 px-4 py-2.5 shadow-lg',
          'animate-in fade-in slide-in-from-top-2 duration-200',
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Interruption</p>
        <p className="mt-0.5 text-sm font-medium text-white">{message}</p>
      </div>
    </div>
  );
});
