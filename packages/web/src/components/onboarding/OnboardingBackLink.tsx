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
        'group mb-6 flex min-h-[44px] cursor-pointer items-center gap-1.5 self-start rounded-lg px-1 text-[14px] font-medium text-text-secondary transition-colors duration-200 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
      {label}
    </button>
  );
}
