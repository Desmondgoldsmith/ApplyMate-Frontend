'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const LS_KEY = 'applymate:dashboard:collapsed:your_progress_intelligence';

type Props = {
  children: ReactNode;
  title?: string;
};

export function DashboardProgressIntelligenceCollapsible({
  children,
  title = 'Your Progress Intelligence',
}: Props) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
      if (v === '1') setOpen(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      try {
        window.localStorage.setItem(LS_KEY, next ? '0' : '1');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const effectiveOpen = hydrated ? open : false;

  return (
    <section
      className={cn(
        'mb-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-none ring-0',
        hydrated && !effectiveOpen && 'progress-intelligence-pulse',
      )}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-left sm:px-5 sm:py-4"
        onClick={toggle}
        aria-expanded={effectiveOpen}
      >
        <span className="text-[14px] font-semibold leading-snug text-[var(--text-primary)]">{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ease-out',
            effectiveOpen ? 'rotate-0' : 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {effectiveOpen ? (
          <motion.div
            key="progress-inner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.21, 0.47, 0.32, 0.98] as const }}
            className="overflow-hidden border-t border-[var(--border-subtle)]"
          >
            <div className="grid grid-cols-1 items-start gap-6 p-4 pt-5 sm:p-5 sm:pt-6 md:gap-8">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
