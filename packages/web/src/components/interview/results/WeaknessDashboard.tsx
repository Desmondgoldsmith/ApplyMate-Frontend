'use client';

import { memo } from 'react';

import type { WeaknessSnapshot } from '@/lib/interview-prep-types';
import { WEAKNESS_TAG_LABELS } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

function severityClass(severity: string): string {
  if (severity === 'high') return 'border-rose-400/35 bg-rose-500/10 text-rose-200';
  if (severity === 'medium') return 'border-amber-400/35 bg-amber-500/10 text-amber-100';
  return 'border-white/15 bg-white/[0.04] text-white/65';
}

export const WeaknessDashboard = memo(function WeaknessDashboard({
  snapshot,
  className,
}: {
  snapshot: WeaknessSnapshot | null | undefined;
  className?: string;
}) {
  const items = snapshot?.weaknesses ?? [];
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
  });

  return (
    <section className={cn('rounded-2xl border border-white/10 bg-[#0C0F0F] p-4 sm:p-5', className)} aria-labelledby="weakness-heading">
      <h3 id="weakness-heading" className="text-sm font-semibold text-white">
        Top areas to improve
      </h3>
      <p className="mt-1 text-xs text-white/50">Patterns from this session — practice these next.</p>
      <ul className="mt-4 space-y-2">
        {sorted.slice(0, 5).map((w) => (
          <li
            key={w.tag}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/90">
                {WEAKNESS_TAG_LABELS[w.tag] ?? w.tag.replace(/_/g, ' ')}
              </p>
              <p className="mt-0.5 text-xs text-white/55">{w.explanation}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {w.count > 1 ? (
                <span className="text-[11px] tabular-nums text-white/40">×{w.count}</span>
              ) : null}
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                  severityClass(w.severity),
                )}
              >
                {w.severity}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
});
