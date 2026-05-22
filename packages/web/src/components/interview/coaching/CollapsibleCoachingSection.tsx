'use client';

import { memo, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export const CollapsibleCoachingSection = memo(function CollapsibleCoachingSection({
  title,
  children,
  defaultOpen = true,
  active = false,
  className,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  active?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className={cn(
        'ip-coach-section rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] transition-colors duration-300',
        active && 'ip-coach-section-active',
        className,
      )}
    >
      <button
        type="button"
        className="ip-coach-section-trigger flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cn(
            'text-[11px] font-semibold uppercase tracking-wider',
            active ? 'ip-coach-section-title' : 'text-[var(--text-muted)]',
          )}
        >
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={cn('ip-coach-section-panel grid', open ? 'ip-coach-section-panel-open' : '')}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2">{children}</div>
        </div>
      </div>
    </section>
  );
});
