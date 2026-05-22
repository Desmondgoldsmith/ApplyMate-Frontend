'use client';

import { cn } from '@/lib/utils';

type ListPageShimmerProps = {
  cardCount?: number;
  tableRows?: number;
  className?: string;
};

/** Loading placeholder — stacked cards on mobile, table rows on desktop. */
export function ListPageShimmer({ cardCount = 4, tableRows = 5, className }: ListPageShimmerProps) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
      <ul className="space-y-2.5 md:hidden">
        {Array.from({ length: cardCount }).map((_, i) => (
          <li
            key={`m-${i}`}
            className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5"
          >
            <div className="h-2.5 w-16 motion-reduce:animate-none animate-pulse rounded bg-white/[0.08]" />
            <div className="mt-2 h-4 w-[85%] motion-reduce:animate-none animate-pulse rounded-md bg-white/[0.06]" />
            <div className="mt-1.5 h-3 w-full motion-reduce:animate-none animate-pulse rounded bg-white/[0.05]" />
            <div className="mt-3 h-8 w-24 motion-reduce:animate-none animate-pulse rounded-lg bg-white/[0.06]" />
          </li>
        ))}
      </ul>
      <div className="hidden space-y-2 md:block">
        <div className="h-10 w-full motion-reduce:animate-none animate-pulse rounded-xl bg-white/[0.06]" />
        {Array.from({ length: tableRows }).map((_, i) => (
          <div
            key={`d-${i}`}
            className="h-12 w-full motion-reduce:animate-none animate-pulse rounded-lg bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}
