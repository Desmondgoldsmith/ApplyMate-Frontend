'use client';

import { Loader2 } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ProcessingLoadingShellProps = {
  title: string;
  description: string;
  /** Optional lines shown as a checklist while waiting. */
  steps?: string[];
  footer?: ReactNode;
  variant?: 'inline' | 'overlay' | 'card';
  className?: string;
};

export const ProcessingLoadingShell = memo(function ProcessingLoadingShell({
  title,
  description,
  steps,
  footer,
  variant = 'inline',
  className,
}: ProcessingLoadingShellProps) {
  const inner = (
    <div className="flex w-full max-w-md flex-col items-center text-center">
      <Loader2
        className="mb-4 h-10 w-10 shrink-0 animate-spin text-[var(--text-teal)]"
        aria-hidden
      />
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        {description}
      </p>
      {steps && steps.length > 0 ? (
        <ul className="mt-6 w-full space-y-2 text-left text-xs text-[var(--text-secondary)]">
          {steps.map((step) => (
            <li key={step} className="flex gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-teal)]" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 w-full max-w-md space-y-2">
          <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-2.5 w-full animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-6 h-20 w-full animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      )}
      {footer ? <div className="mt-6 w-full">{footer}</div> : null}
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div
        className={cn(
          'absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-[#050909]/90 px-6 py-10 text-center backdrop-blur-[3px]',
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {inner}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-8 text-center',
          className,
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col items-center px-2 py-4 text-center', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {inner}
    </div>
  );
});
