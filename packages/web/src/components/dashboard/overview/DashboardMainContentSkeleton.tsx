'use client';

/** Section placeholders below greeting + hero + stats while today-plan loads. */
export function DashboardMainContentSkeleton() {
  return (
    <div
      className="flex min-w-0 flex-col gap-4 max-md:gap-4 md:gap-6"
      aria-hidden
    >
      <div>
        <div className="mb-3 h-5 w-52 max-w-[70%] animate-pulse rounded-md bg-white/[0.05]" />
        <div className="h-[88px] w-full animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
      </div>

      <div>
        <div className="mb-3 h-4 w-36 animate-pulse rounded-md bg-white/[0.05]" />
        <div className="h-[100px] w-full animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
      </div>

      <div>
        <div className="mb-3 h-5 w-40 animate-pulse rounded-md bg-white/[0.05]" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[72px] w-full animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
