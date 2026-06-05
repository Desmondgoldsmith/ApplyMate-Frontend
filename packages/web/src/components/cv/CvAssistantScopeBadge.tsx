'use client';

import { cn } from '@/lib/utils';

export type CvAssistantScopeBadgeProps = {
  label: string;
  variant?: 'section' | 'global' | 'findings';
  className?: string;
};

/** Shows affected scope before the user runs or commits an assistant command. */
export function CvAssistantScopeBadge({
  label,
  variant = 'section',
  className,
}: CvAssistantScopeBadgeProps) {
  const styles =
    variant === 'findings'
      ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
      : variant === 'global'
        ? 'border-violet-400/40 bg-violet-500/10 text-violet-200'
        : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles,
        className,
      )}
    >
      {label}
    </span>
  );
}
