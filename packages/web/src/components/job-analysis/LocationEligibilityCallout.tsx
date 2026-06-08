'use client';

import { MapPin } from 'lucide-react';

import type { LocationEligibility } from '@/lib/api';
import { cn } from '@/lib/utils';

export type LocationEligibilityCalloutProps = {
  eligibility: LocationEligibility;
  className?: string;
};

/** Non-blocking info when posting location may not match the user's profile region. */
export function LocationEligibilityCallout({
  eligibility,
  className,
}: LocationEligibilityCalloutProps) {
  if (!eligibility.message?.trim()) return null;

  return (
    <div
      role="note"
      className={cn(
        'flex gap-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-4 py-3.5',
        className,
      )}
    >
      <MapPin
        className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/90"
        strokeWidth={2}
        aria-hidden
      />
      <p className="text-[13px] leading-relaxed text-sky-50/90">{eligibility.message}</p>
    </div>
  );
}
