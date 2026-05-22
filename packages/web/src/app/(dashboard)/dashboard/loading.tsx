function Block({ className }: { className: string }) {
  return <div className={`rounded-xl bg-white/[0.05] ${className}`} />;
}

/**
 * Route-level loading UI (server-rendered).
 * This prevents a "blank screen" while the dashboard client bundle hydrates.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col pb-10 max-md:pb-16 lg:min-h-0 lg:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-8 lg:overflow-hidden">
        <div className="flex w-full min-w-0 flex-col pr-0 lg:flex-1 lg:min-h-0 lg:max-w-none lg:overflow-y-auto lg:pr-2 app-scrollbar">
          <div className="mb-6 max-md:mb-5 rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] sm:p-7">
            <div className="space-y-3 animate-pulse">
              <Block className="h-9 w-[280px] max-w-[70%]" />
              <Block className="h-6 w-full max-w-[92%]" />
              <Block className="h-4 w-full max-w-[78%]" />
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-pulse">
              <div className="h-11 w-[220px] rounded-full bg-white/[0.05]" />
              <Block className="h-4 w-[260px] max-w-full" />
            </div>
          </div>

          <div className="mt-2 animate-pulse">
            <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] min-w-[140px] shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 md:min-w-0"
                >
                  <div className="space-y-2">
                    <Block className="h-3 w-[86px]" />
                    <Block className="h-6 w-[70px]" />
                    <Block className="h-2.5 w-[96px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-4 animate-pulse">
            <Block className="h-5 w-[220px] max-w-[65%]" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <Block className="h-5 w-[55%]" />
                  <div className="mt-2">
                    <Block className="h-4 w-[80%]" />
                  </div>
                  <div className="mt-4">
                    <div className="h-10 w-[180px] rounded-full bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col border-t border-white/[0.08] pt-8 lg:h-full lg:min-h-0 lg:w-[min(100%,340px)] lg:border-l lg:border-white/[0.06] lg:border-t-0 lg:pl-6 lg:pt-0 xl:w-[360px] xl:pl-8">
          <div className="space-y-4 animate-pulse">
            <Block className="h-5 w-[170px]" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <Block className="h-4 w-[70%]" />
                <div className="mt-2">
                  <Block className="h-3.5 w-[90%]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

