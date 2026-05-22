'use client';

import { useEffect, useState } from 'react';

import type { MilestoneCelebrationPayload } from '@/lib/today-plan';
import { formatCalendarDayKeyInTimeZone } from '@/lib/calendarDayKey';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'applymate.dash.milestone';

type Props = {
  data: MilestoneCelebrationPayload;
  timeZone: string;
};

function milestoneDedupeKey(source: string): string {
  return source
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function storageKeyForPayload(dedupeSource: string, timeZone: string): string {
  const dayKey = formatCalendarDayKeyInTimeZone(new Date(), timeZone);
  return `${STORAGE_PREFIX}:${dayKey}:${milestoneDedupeKey(dedupeSource)}`;
}

export function DashboardMilestoneCelebration({ data, timeZone }: Props) {
  const title = data.title?.trim() ?? '';
  const message = data.message?.trim() ?? '';
  const icon = data.icon?.trim() ?? '';

  const dedupeSource = title || message || icon;

  const [show] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (!dedupeSource.trim()) return false;
    try {
      return !window.localStorage.getItem(storageKeyForPayload(dedupeSource, timeZone));
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!show || !dedupeSource.trim()) return;
    try {
      window.localStorage.setItem(storageKeyForPayload(dedupeSource, timeZone), '1');
    } catch {
      // ignore
    }
  }, [show, dedupeSource, timeZone]);

  if (!title && !message && !icon) return null;
  if (!show) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border border-[#00C9B1]/30 bg-gradient-to-r from-[#00C9B1]/[0.12] via-white/[0.04] to-violet-500/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6',
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="text-2xl leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {title ? <p className="text-[15px] font-semibold leading-snug text-white/95">{title}</p> : null}
          {message ? (
            <p className={cn('text-[13px] leading-relaxed text-white/60', title ? 'mt-1' : '')}>{message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
