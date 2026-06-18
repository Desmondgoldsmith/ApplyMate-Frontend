'use client';

import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

const MAX_ITEMS = 16;

export function AtsRiskPanel({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  const visible = items.filter(Boolean).slice(0, MAX_ITEMS);
  const rest = items.length - visible.length;
  if (visible.length === 0) return null;

  return (
    <section
      className={cn(
        'rounded-xl border border-amber-500/22 bg-amber-500/[0.06] px-4 py-3.5',
        className,
      )}
      aria-labelledby="ats-risk-heading"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/90"
          aria-hidden
        />
        <div className="min-w-0">
          <h4
            id="ats-risk-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-200/90"
          >
            ATS risk
          </h4>
          <p className="mt-1 text-[12px] leading-relaxed text-white/55">
            You likely have these skills, but the exact phrase is missing from your CV text.
            Add the wording below if you want to pass a literal applicant tracking scan.
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" role="list">
            {visible.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-50/95"
              >
                {item}
              </li>
            ))}
            {rest > 0 ? (
              <li className="self-center text-[10px] text-white/35">+{rest} more</li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
