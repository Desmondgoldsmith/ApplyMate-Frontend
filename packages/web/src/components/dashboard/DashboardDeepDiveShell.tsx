'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  summary: string;
  anchorId: string;
  children: ReactNode;
};

/** Collapses full cards on small screens only; desktop always shows detail. */
export function DashboardDeepDiveShell({ summary, anchorId, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div id={anchorId} className="scroll-mt-4">
      <button
        type="button"
        className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[13px] font-medium text-white/85">{summary}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-white/45 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <div className={cn(!open && 'hidden', 'md:block')}>{children}</div>
    </div>
  );
}
