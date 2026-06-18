'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const LS_PREFIX = 'applymate:dashboard:collapsed:';

type Props = {
  /** Stable id for localStorage: `applymate:dashboard:collapsed:${storageKey}` */
  storageKey: string;
  title: string;
  /** e.g. "3 interviews" — optional count badge */
  countBadge?: string | null;
  /** Shown on the right of the header row (e.g. Show all link) */
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  'data-tour'?: string;
};

export function DashboardCollapsibleSection({
  storageKey,
  title,
  countBadge,
  headerRight,
  children,
  className,
  'data-tour': dataTour,
}: Props) {
  const lsKey = `${LS_PREFIX}${storageKey}`;
  const [expanded, setExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(lsKey)
          : null;
      if (v === '1') setExpanded(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [lsKey]);

  const toggle = useCallback(() => {
    setExpanded((e) => {
      const next = !e;
      try {
        window.localStorage.setItem(lsKey, next ? '0' : '1');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [lsKey]);

  return (
    <section
      className={cn('scroll-mt-4 min-w-0', className)}
      {...(dataTour ? { 'data-tour': dataTour } : {})}
    >
      <div className="flex flex-col items-start gap-2 pb-3 max-sm:gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <button
          type="button"
          className="flex min-w-0 cursor-pointer select-none items-center gap-2 border-0 bg-transparent p-0 text-left"
          onClick={toggle}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ease-out',
              expanded ? 'rotate-0' : 'rotate-180',
            )}
            aria-hidden
          />
          <span className="text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
            {title}
          </span>
          {countBadge ? (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none text-[var(--text-muted)]"
              style={{
                background: 'var(--bg-surface-2)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {countBadge}
            </span>
          ) : null}
        </button>
        {headerRight ? (
          <div
            className="flex shrink-0 items-center pl-0 max-sm:text-[12px] sm:pl-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {headerRight}
          </div>
        ) : null}
      </div>
      <div
        className="dashboard-collapsible-content"
        data-expanded={hydrated ? expanded : true}
        aria-hidden={!expanded}
      >
        {children}
      </div>
    </section>
  );
}
