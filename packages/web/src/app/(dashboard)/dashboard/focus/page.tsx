'use client';

import { LayoutGrid, List, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DashboardFocusRow } from '@/components/dashboard/DashboardFocusSection';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { ListPageShimmer } from '@/components/ui/ListPageShimmer';
import { ListPagination } from '@/components/ui/ListPagination';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useDashboardFocus } from '@/hooks/useDashboardFocus';
import { useClientPagination } from '@/hooks/useClientPagination';
import type { FocusItem } from '@/lib/dashboardFocusMerge';
import { mapPhase15FocusItems } from '@/lib/dashboardFocusMerge';
import { cn } from '@/lib/utils';

type ViewMode = 'board' | 'list';

function FocusTable({ items }: { items: FocusItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060a0a]/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-wide text-white/40">
            <th className="px-4 py-3 pl-5">Action</th>
            <th className="px-4 py-3">Why it matters</th>
            <th className="px-4 py-3 pr-5 text-right">Next step</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]">
              <td className="max-w-[220px] px-4 py-3.5 pl-5 align-middle">
                <p className="text-[13px] font-semibold text-white/90">{it.title}</p>
                {it.metaLine?.trim() ? (
                  <p className="mt-0.5 text-[11px] text-white/40">{it.metaLine}</p>
                ) : null}
              </td>
              <td className="max-w-md px-4 py-3.5 align-middle text-[12px] leading-relaxed text-white/50">
                {it.subtitle}
              </td>
              <td className="px-4 py-3.5 pr-5 text-right align-middle">
                <Link
                  href={it.ctaHref}
                  className="inline-flex min-h-[36px] min-w-[88px] cursor-pointer items-center justify-center rounded-full border border-[#00C9B1]/45 px-3 py-1.5 text-[11px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                >
                  {it.ctaLabel}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardFocusPage() {
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

  const focusQuery = useDashboardFocus({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
  });

  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');

  const items = useMemo(() => {
    const raw = focusQuery.data?.focusItems;
    if (!raw?.length) return [];
    return mapPhase15FocusItems(raw);
  }, [focusQuery.data?.focusItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.subtitle.toLowerCase().includes(q) ||
        it.ctaLabel.toLowerCase().includes(q),
    );
  }, [items, search]);

  const pagination = useClientPagination(filtered, 12);
  const busy = focusQuery.isLoading && !focusQuery.data;

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Your Focus</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Ranked actions from your focus feed — same rules as the dashboard snapshot, with search and pagination.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search focus actions…"
            className="w-full rounded-xl border border-white/12 bg-[#0c1010] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#00C9B1]/50 focus:outline-none"
            aria-label="Search focus actions"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="sr-only">View mode</span>
          <div className="flex rounded-xl border border-white/12 p-0.5" role="group" aria-label="View mode">
            <button
              type="button"
              title="Table"
              onClick={() => setView('list')}
              className={cn(
                'rounded-lg p-2 transition-colors',
                view === 'list' ? 'bg-[#00C9B1]/20 text-[#00C9B1]' : 'text-white/45 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]',
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Cards"
              onClick={() => setView('board')}
              className={cn(
                'rounded-lg p-2 transition-colors',
                view === 'board' ? 'bg-[#00C9B1]/20 text-[#00C9B1]' : 'text-white/45 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {busy ? (
        <ListPageShimmer cardCount={6} tableRows={8} />
      ) : focusQuery.isError ? (
        <GlowCard contentClassName="p-6">
          <p className="text-sm text-rose-200">Could not load your focus list.</p>
          <Button className="mt-4" variant="ghost" onClick={() => void focusQuery.refetch()}>
            Retry
          </Button>
        </GlowCard>
      ) : pagination.total === 0 ? (
        <GlowCard contentClassName="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
          <p className="text-lg font-semibold text-white/90">No focus actions right now</p>
          <p className="mt-2 max-w-md text-sm text-white/45">
            When the service has ranked steps for you, they appear here. Check your dashboard for the latest snapshot.
          </p>
          <Button asChild className="mt-6 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </GlowCard>
      ) : view === 'board' ? (
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {pagination.pageItems.map((it) => (
              <li key={it.id}>
                <DashboardFocusRow it={it} as="div" />
              </li>
            ))}
          </ul>
          {pagination.showPager ? (
            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              total={pagination.total}
              onPageChange={pagination.setPage}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <FocusTable items={pagination.pageItems} />
          {pagination.showPager ? (
            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              total={pagination.total}
              onPageChange={pagination.setPage}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
