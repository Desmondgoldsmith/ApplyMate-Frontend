'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { continuationTypeLabel } from '@/components/dashboard/ContinuationSection';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useTodayPlan } from '@/hooks/useTodayPlan';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { listContinuationItemsForDisplay } from '@/lib/interviewContinuation';
import { sortContinuationItemsNewestFirst } from '@/lib/today-plan';

export default function DashboardContinuationPage() {
  const { displayRows } = useCvProfileRowsDisplay();
  const defaultProfile = useMemo(
    () => displayRows.find((p) => p.isDefault) ?? displayRows[0] ?? null,
    [displayRows],
  );
  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const todayPlan = useTodayPlan({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
  });

  const rows = useMemo(() => {
    const raw = listContinuationItemsForDisplay(todayPlan.data ?? null);
    return sortContinuationItemsNewestFirst(raw);
  }, [todayPlan.data]);

  if (todayPlan.isLoading) {
    return <p className="text-[13px] text-white/45">Loading…</p>;
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-white/90">Continue where you left off</h1>
        <Link href="/dashboard" className="text-[13px] font-medium text-[#00C9B1] hover:underline">
          ← Dashboard
        </Link>
      </div>
      <p className="mb-6 text-[13px] leading-relaxed text-white/45">
        Unfinished work from your sessions — pick up where you stopped.
      </p>

      {rows.length === 0 ? (
        <p className="text-[13px] text-white/45">You&apos;re all caught up — nothing to resume right now.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((item) => {
            const last =
              item.lastActiveLabel?.trim() ||
              (item.lastActiveAt?.trim() ? formatRelativeEdited(item.lastActiveAt) : null);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 ring-1 ring-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-white/90">{item.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                      {continuationTypeLabel(item.type)}
                    </span>
                  </div>
                  {last ? <p className="mt-1 text-[12px] text-white/40">{last}</p> : null}
                </div>
                <Link
                  href={item.ctaHref}
                  className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A] sm:w-auto"
                >
                  {item.ctaLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
