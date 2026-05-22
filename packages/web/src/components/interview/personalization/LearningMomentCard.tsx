'use client';

import { ChevronDown } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '@/lib/utils';

export const LearningMomentCard = memo(function LearningMomentCard({
  moments,
  className,
}: {
  moments: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!moments.length) return null;

  return (
    <div
      className={cn(
        'mb-3 rounded-lg border border-emerald-400/20 bg-emerald-500/8 ip-learning-moment',
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold text-emerald-100/90">What you improved</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-emerald-200/70 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <ul className="space-y-1 px-3 pb-2.5">
            {moments.map((line) => (
              <li key={line} className="text-xs leading-relaxed text-[var(--text-secondary)]">
                · {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
});
