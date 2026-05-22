'use client';

import { memo, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type AtmosphereLevel = 'calm' | 'neutral' | 'tense' | 'intense';

export const InterviewRoomAtmosphereLayer = memo(function InterviewRoomAtmosphereLayer({
  atmosphere,
  pressureTier,
  active,
  children,
  className,
}: {
  atmosphere: AtmosphereLevel;
  pressureTier: 'low' | 'medium' | 'high';
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'ip-room-atmosphere relative flex min-h-0 flex-1 flex-col transition-[box-shadow,background] duration-700',
        active && `ip-atmosphere-${atmosphere}`,
        active && pressureTier === 'high' && 'ip-atmosphere-pressure-high',
        active && pressureTier === 'medium' && 'ip-atmosphere-pressure-medium',
        className,
      )}
      data-atmosphere={active ? atmosphere : 'off'}
      data-pressure={active ? pressureTier : 'off'}
    >
      {active ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 ip-atmosphere-vignette"
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
});
