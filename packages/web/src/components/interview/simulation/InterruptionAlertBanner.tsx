'use client';

import { memo } from 'react';
import { Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

export const InterruptionAlertBanner = memo(function InterruptionAlertBanner({
  message,
  visible,
  className,
}: {
  message: string | null;
  visible: boolean;
  className?: string;
}) {
  if (!visible || !message?.trim()) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2',
        'animate-in fade-in slide-in-from-top-1 duration-200',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
          Follow-up question
        </p>
        <p className="text-xs leading-snug text-amber-50/95">{message}</p>
      </div>
    </div>
  );
});
