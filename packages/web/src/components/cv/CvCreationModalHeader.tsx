'use client';

import { ArrowLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type CvCreationModalHeaderProps = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  onClose?: () => void;
  showClose?: boolean;
  trailing?: ReactNode;
  className?: string;
};

/** Consistent header for resume-creation modals: back left, close right. */
export function CvCreationModalHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  onClose,
  showClose = true,
  trailing,
  className,
}: CvCreationModalHeaderProps) {
  return (
    <div className={cn('shrink-0 border-b border-white/[0.06] px-1 pb-4 pt-1', className)}>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-white/50 transition hover:bg-white/[0.04] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              {backLabel}
            </button>
          ) : (
            <span className="w-16 shrink-0" aria-hidden />
          )}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#111616] text-white/60 transition hover:border-white/[0.14] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-8 shrink-0" aria-hidden />
        )}
      </div>
      {title ? (
        <h2 className="mt-3 text-lg font-bold leading-snug text-white">{title}</h2>
      ) : null}
      {subtitle ? <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{subtitle}</p> : null}
    </div>
  );
}
