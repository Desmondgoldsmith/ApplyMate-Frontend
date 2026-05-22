'use client';

export function FollowUpJobsSkeleton() {
  return (
    <div
      className="mx-auto min-w-0 max-w-5xl space-y-6"
      aria-busy="true"
      aria-label="Loading follow-up queue"
    >
      {/* Mobile header */}
      <div className="space-y-3 md:hidden">
        <div className="h-7 w-52 motion-reduce:animate-none animate-pulse rounded-lg bg-white/[0.07]" />
        <div className="h-3.5 w-full motion-reduce:animate-none animate-pulse rounded-md bg-white/[0.05]" />
      </div>

      {/* Desktop header row */}
      <div className="hidden gap-6 md:flex md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-8 w-72 max-w-full motion-reduce:animate-none animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="max-w-2xl space-y-2">
            <div className="h-3.5 w-full motion-reduce:animate-none animate-pulse rounded-md bg-white/[0.05]" />
            <div className="h-3.5 w-[92%] motion-reduce:animate-none animate-pulse rounded-md bg-white/[0.05]" />
          </div>
        </div>
        <div className="h-11 w-40 shrink-0 motion-reduce:animate-none animate-pulse rounded-xl bg-white/[0.06]" />
      </div>

      {/* Toolbar: search + toggles — wide on desktop */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-11 w-full motion-reduce:animate-none animate-pulse rounded-xl bg-white/[0.06] sm:max-w-xl md:flex-1 md:max-w-none lg:max-w-xl" />
        <div className="flex gap-2">
          <div className="h-10 w-[calc(50%-4px)] motion-reduce:animate-none animate-pulse rounded-xl bg-white/[0.06] sm:h-11 sm:w-28" />
          <div className="h-10 w-[calc(50%-4px)] motion-reduce:animate-none animate-pulse rounded-xl bg-white/[0.06] sm:h-11 sm:w-28" />
        </div>
      </div>

      {/* Mobile: vertical card strips */}
      <ul className="space-y-2.5 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 pl-4"
          >
            <div className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-white/[0.12]" />
            <div className="flex gap-2.5 pl-1">
              <div className="h-9 w-9 shrink-0 motion-reduce:animate-none animate-pulse rounded-lg bg-white/[0.07]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-2 w-20 motion-reduce:animate-none animate-pulse rounded bg-white/[0.08]" />
                <div className="h-3 w-[88%] motion-reduce:animate-none animate-pulse rounded-md bg-white/[0.06]" />
                <div className="h-2.5 w-full motion-reduce:animate-none animate-pulse rounded bg-white/[0.05]" />
                <div className="h-8 w-full motion-reduce:animate-none animate-pulse rounded-full bg-white/[0.06]" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: multi-column grid + accent rail (matches card view layout) */}
      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 pl-4"
          >
            <div className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-white/[0.1]" />
            <div className="flex flex-col gap-2.5 pl-1">
              <div className="flex items-start gap-2.5">
                <div className="h-9 w-9 shrink-0 motion-reduce:animate-none animate-pulse rounded-lg bg-white/[0.07]" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-2 w-24 motion-reduce:animate-none animate-pulse rounded bg-white/[0.08]" />
                  <div className="h-3 w-[92%] motion-reduce:animate-none animate-pulse rounded-md bg-white/[0.06]" />
                </div>
              </div>
              <div className="h-2.5 w-full motion-reduce:animate-none animate-pulse rounded bg-white/[0.05]" />
              <div className="h-2.5 w-[75%] motion-reduce:animate-none animate-pulse rounded bg-white/[0.05]" />
              <div className="h-8 w-full motion-reduce:animate-none animate-pulse rounded-full bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
