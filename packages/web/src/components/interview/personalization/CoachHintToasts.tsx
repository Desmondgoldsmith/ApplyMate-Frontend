'use client';

import { memo, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const AUTO_HIDE_MS = 6500;

export const CoachHintToasts = memo(function CoachHintToasts({
  hints,
  urgency = 'low',
  className,
}: {
  hints: string[];
  urgency?: 'low' | 'medium' | 'high';
  className?: string;
}) {
  const [visible, setVisible] = useState<string[]>([]);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const next = hints.filter((h) => h?.trim()).slice(0, 2);
    if (!next.length) {
      setVisible([]);
      setFading(false);
      return;
    }
    setFading(false);
    setVisible(next);
    const fadeTimer = window.setTimeout(() => setFading(true), AUTO_HIDE_MS - 400);
    const hideTimer = window.setTimeout(() => {
      setVisible([]);
      setFading(false);
    }, AUTO_HIDE_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [hints]);

  if (!visible.length) return null;

  return (
    <div
      className={cn('pointer-events-none space-y-1.5 px-5 py-2', className)}
      aria-live="polite"
      aria-label="Coach hints"
    >
      {visible.map((hint) => (
        <div
          key={hint}
          className={cn(
            'ip-coach-hint-enter rounded-lg border px-3 py-2 text-xs leading-snug transition-opacity duration-400',
            urgency === 'medium' || urgency === 'high'
              ? 'border-[var(--teal)]/35 bg-[var(--teal-15)] text-[var(--text-primary)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]',
            fading && 'opacity-0',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-teal)]">
            Coach hint
          </span>
          <p className="mt-0.5">{hint}</p>
        </div>
      ))}
    </div>
  );
});
