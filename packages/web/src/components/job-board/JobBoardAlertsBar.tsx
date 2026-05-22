'use client';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

type AlertChip = {
  id: string;
  tone: 'teal' | 'neutral' | 'amber';
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
};

export function JobBoardAlertsBar({
  alerts,
  className,
}: {
  alerts: AlertChip[];
  className?: string;
}) {
  if (alerts.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0C0F0F]/90 px-2 py-2',
        className,
      )}
      role="region"
      aria-label="Job board notices"
    >
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            'inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug',
            alert.tone === 'teal' && 'border-[#00C9B1]/30 bg-[#00C9B1]/10 text-white/90',
            alert.tone === 'neutral' && 'border-white/12 bg-white/[0.04] text-white/85',
            alert.tone === 'amber' && 'border-amber-400/30 bg-amber-500/10 text-amber-100/95',
          )}
        >
          <span className="min-w-0">{alert.message}</span>
          {alert.action ? (
            <button
              type="button"
              onClick={alert.action.onClick}
              className="shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white/80 hover:bg-white/10"
            >
              {alert.action.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={alert.onDismiss}
            className="shrink-0 rounded p-0.5 text-white/45 hover:bg-white/10 hover:text-white/75"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
