'use client';

import type { RecruiterVerdict } from '@/lib/api';
import { cn } from '@/lib/utils';

const VERDICT_STYLE: Record<
  RecruiterVerdict,
  { label: string; className: string }
> = {
  STRONG: {
    label: 'Strong candidate',
    className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  },
  COMPETITIVE: {
    label: 'Competitive',
    className: 'border-amber-400/35 bg-amber-500/10 text-amber-100',
  },
  WEAK: {
    label: 'Weak fit',
    className: 'border-rose-400/35 bg-rose-500/12 text-rose-200',
  },
};

export function RecruiterVerdictBadge({ verdict }: { verdict: RecruiterVerdict }) {
  const meta = VERDICT_STYLE[verdict];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold tracking-tight',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}
