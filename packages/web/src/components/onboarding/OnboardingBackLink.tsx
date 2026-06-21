'use client';

import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

type OnboardingBackLinkProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

/** Left-aligned ← Back row; titles below stay centered in the step column. */
export function OnboardingBackLink({
  onClick,
  disabled = false,
  label = 'Back',
  className,
}: OnboardingBackLinkProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group mb-8 flex min-h-[44px] cursor-pointer items-center gap-1.5 self-start text-[13px] text-[rgba(255,255,255,0.45)] transition-colors duration-200 hover:text-[rgba(255,255,255,0.8)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
      {label}
    </button>
  );
}
