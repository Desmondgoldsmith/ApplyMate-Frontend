'use client';

import type React from 'react';
import { cn } from '@/lib/utils';

type Props = {
  eyebrow?: string | null;
  title: string | null;
  body?: string | null;
  icon?: React.ReactNode;
  tone?: 'quiet' | 'normal';
};

export function DashboardInsightCard({ eyebrow, title, body, icon, tone = 'normal' }: Props) {
  if (!title && !body) return null;
  return (
    <div
      className={cn(
        'rounded-xl border p-4 sm:p-5',
        tone === 'quiet' ? 'border-white/[0.06] bg-white/[0.02]' : 'border-white/[0.08] bg-white/[0.04]',
      )}
    >
      {eyebrow || icon ? (
        <div className="flex items-center justify-between gap-3">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{eyebrow}</p>
          ) : (
            <span />
          )}
          {icon ? <span className="text-white/40">{icon}</span> : null}
        </div>
      ) : null}
      {title ? <p className={cn('text-[14px] font-semibold leading-snug', eyebrow ? 'mt-1.5' : '', 'text-white/88')}>{title}</p> : null}
      {body ? (
        <p className={cn('text-[13px] leading-relaxed text-white/58', title ? 'mt-1.5' : eyebrow ? 'mt-1.5' : '')}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

