'use client';

/** Hero placeholder below greeting — matches two-column hero + CTA layout. */
export function DashboardHeroSkeleton() {
  return (
    <div
      className="mb-4 max-md:mb-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10"
      aria-hidden
    >
      <div className="min-w-0 max-w-[65ch] flex-1 space-y-3">
        <div className="h-5 w-[min(100%,28rem)] animate-pulse rounded-md bg-white/[0.06]" />
        <div className="h-4 w-[min(100%,20rem)] animate-pulse rounded-md bg-white/[0.04]" />
      </div>
      <div className="flex w-full shrink-0 flex-col items-stretch gap-2.5 lg:max-w-[38%] lg:items-end lg:pt-0.5 lg:pr-2">
        <div className="h-4 w-[min(100%,16rem)] animate-pulse rounded-md bg-white/[0.04] lg:ml-auto" />
        <div className="h-11 w-full max-w-[200px] animate-pulse rounded-full bg-white/[0.05] lg:ml-auto" />
      </div>
    </div>
  );
}
