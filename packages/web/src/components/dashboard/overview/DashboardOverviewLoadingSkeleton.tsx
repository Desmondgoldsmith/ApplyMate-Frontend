'use client';

import { Skeleton } from '@/components/ui/Skeleton';

export function DashboardOverviewLoadingSkeleton() {
  return (
    <div className="dashboard-premium mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col pb-10 max-md:pb-16 lg:min-h-0 lg:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-10 lg:flex-row lg:gap-8 lg:overflow-hidden">
        <div className="flex w-full min-w-0 flex-col pr-0 lg:mx-auto lg:max-w-[760px] lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 app-scrollbar">
          <div className="mb-6 max-md:mb-5 rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] sm:p-7">
            <div className="min-w-0 max-w-[65ch] space-y-3">
              <Skeleton height={34} width={280} borderRadius={12} />
              <Skeleton height={22} width="92%" borderRadius={12} />
              <Skeleton height={16} width="78%" borderRadius={10} />
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton height={44} width={220} borderRadius={999} />
              <Skeleton height={14} width={260} borderRadius={10} />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-[88px] min-w-[140px] shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 md:min-w-0"
                >
                  <div className="space-y-2">
                    <Skeleton height={12} width={86} borderRadius={8} />
                    <Skeleton height={22} width={70} borderRadius={10} />
                    <Skeleton height={10} width={96} borderRadius={8} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <Skeleton height={18} width={220} borderRadius={10} />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <Skeleton height={16} width="55%" borderRadius={10} />
                  <div className="mt-2">
                    <Skeleton height={12} width="80%" borderRadius={10} />
                  </div>
                  <div className="mt-4">
                    <Skeleton height={40} width={180} borderRadius={999} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col border-t border-white/[0.08] pt-8 lg:h-full lg:min-h-0 lg:w-[min(100%,340px)] lg:border-l lg:border-white/[0.06] lg:border-t-0 lg:pl-6 lg:pt-0 xl:w-[360px] xl:pl-8">
          <div className="space-y-4">
            <Skeleton height={18} width={170} borderRadius={10} />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <Skeleton height={14} width="70%" borderRadius={10} />
                <div className="mt-2">
                  <Skeleton height={12} width="90%" borderRadius={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
