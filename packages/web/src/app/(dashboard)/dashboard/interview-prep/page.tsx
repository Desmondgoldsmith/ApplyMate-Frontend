'use client';

import { LayoutGrid, List, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { GlowCard } from '@/components/ui/GlowCard';
import { ListPageShimmer } from '@/components/ui/ListPageShimmer';
import { ListPagination } from '@/components/ui/ListPagination';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useDashboardInterviewPrep } from '@/hooks/useDashboardInterviewPrep';
import { useClientPagination } from '@/hooks/useClientPagination';
import { sanitizeDashboardDisplayText } from '@/lib/dashboardDisplayCopy';
import type { InterviewPreparationCardPayload, UpcomingInterviewItem } from '@/lib/today-plan';
import {
  isAppliedPrepUpcomingRow,
  sortUpcomingInterviewsForDashboard,
} from '@/lib/upcomingInterviews';
import { cn } from '@/lib/utils';

type ViewMode = 'board' | 'list';

type InterviewPrepRow =
  | { kind: 'upcoming'; item: UpcomingInterviewItem }
  | { kind: 'prep_card'; item: InterviewPreparationCardPayload; key: string };

function buildRows(
  upcoming: UpcomingInterviewItem[],
  cards: InterviewPreparationCardPayload[],
): InterviewPrepRow[] {
  const rows: InterviewPrepRow[] = sortUpcomingInterviewsForDashboard(upcoming).map((item) => ({
    kind: 'upcoming' as const,
    item,
  }));
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    rows.push({
      kind: 'prep_card',
      item: card,
      key: `${card.ctaHref}-${i}`,
    });
  }
  return rows;
}

function rowSearchText(row: InterviewPrepRow): string {
  if (row.kind === 'upcoming') {
    const c = row.item;
    return [c.headline, c.supporting, c.company, c.jobTitle, c.lastUpdatedLabel]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  const c = row.item;
  return [c.headline, c.supporting, c.company, c.roleTitle, c.ctaLabel].filter(Boolean).join(' ').toLowerCase();
}

export default function DashboardInterviewPrepPage() {
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

  const prepQuery = useDashboardInterviewPrep({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
    focusFeedMaxItems: 100,
  });

  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');

  const rows = useMemo(() => {
    const upcoming = prepQuery.data?.upcomingInterviews ?? [];
    const cards = prepQuery.data?.interviewPreparationCards ?? [];
    return buildRows(upcoming, cards);
  }, [prepQuery.data?.interviewPreparationCards, prepQuery.data?.upcomingInterviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => rowSearchText(row).includes(q));
  }, [rows, search]);

  const pagination = useClientPagination(filtered, 12);
  const busy = prepQuery.isLoading && !prepQuery.data;

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Interview prep</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Scheduled interviews and applied-role practice — everything from your dashboard activity feed.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, role, or headline…"
            className="w-full rounded-xl border border-white/12 bg-[#0c1010] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#00C9B1]/50 focus:outline-none"
            aria-label="Search interview prep"
          />
        </div>
        <div className="flex items-center gap-2">
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
      ) : prepQuery.isError ? (
        <GlowCard contentClassName="p-6">
          <p className="text-sm text-rose-200">Could not load interview prep list.</p>
          <Button className="mt-4" variant="ghost" onClick={() => void prepQuery.refetch()}>
            Retry
          </Button>
        </GlowCard>
      ) : pagination.total === 0 ? (
        <GlowCard contentClassName="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
          <p className="text-lg font-semibold text-white/90">Nothing to prep right now</p>
          <p className="mt-2 max-w-md text-sm text-white/45">
            When you apply or schedule interviews, prep actions appear here.
          </p>
          <Button asChild className="mt-6 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </GlowCard>
      ) : view === 'board' ? (
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {pagination.pageItems.map((row) => {
              if (row.kind === 'upcoming') {
                const card = row.item;
                const appliedPrep = isAppliedPrepUpcomingRow(card);
                return (
                  <li
                    key={card.id || card.jobAnalysisId}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CompanyLogo
                        company={(card.company ?? card.jobTitle ?? 'Company').trim() || 'Company'}
                        logoUrl={card.companyLogoUrl}
                        size="md"
                        shape="rounded"
                      />
                      <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#00C9B1]/80">
                      {appliedPrep ? 'Applied · get ready' : 'Scheduled interview'}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-white/92">
                      {sanitizeDashboardDisplayText(card.headline)}
                    </p>
                    <p className="mt-1 text-[12px] text-white/50">
                      {sanitizeDashboardDisplayText(card.supporting)}
                    </p>
                    {card.lastUpdatedLabel?.trim() ? (
                      <p className="mt-2 text-[11px] text-white/38">{card.lastUpdatedLabel}</p>
                    ) : null}
                    <Link
                      href={card.ctaHref}
                      className="mt-4 inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-3.5 py-1.5 text-[12px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                    >
                      {card.ctaLabel}
                    </Link>
                      </div>
                    </div>
                  </li>
                );
              }
              const card = row.item;
              return (
                <li key={row.key} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <CompanyLogo
                      company={(card.company ?? card.roleTitle ?? 'Company').trim() || 'Company'}
                      logoUrl={card.companyLogoUrl}
                      size="md"
                      shape="rounded"
                    />
                    <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    Interview prep
                  </p>
                  <p className="mt-1 text-[14px] font-semibold text-white/92">
                    {sanitizeDashboardDisplayText(card.headline)}
                  </p>
                  {card.supporting?.trim() ? (
                    <p className="mt-1 text-[12px] text-white/50">
                      {sanitizeDashboardDisplayText(card.supporting)}
                    </p>
                  ) : null}
                  <Link
                    href={card.ctaHref}
                    className="mt-4 inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-3.5 py-1.5 text-[12px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                  >
                    {card.ctaLabel}
                  </Link>
                    </div>
                  </div>
                </li>
              );
            })}
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
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060a0a]/80">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  <th className="px-4 py-3 pl-5">Type</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 pr-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((row) => {
                  if (row.kind === 'upcoming') {
                    const card = row.item;
                    return (
                      <tr key={card.id || card.jobAnalysisId} className="border-b border-white/[0.05]">
                        <td className="px-4 py-3 pl-5 text-[12px] text-white/55">
                          {isAppliedPrepUpcomingRow(card) ? 'Applied prep' : 'Scheduled'}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-white/70">
                          <p className="font-semibold text-white/90">{card.headline}</p>
                          <p className="mt-0.5 text-white/45">{card.supporting}</p>
                        </td>
                        <td className="px-4 py-3 pr-5 text-right">
                          <Link
                            href={card.ctaHref}
                            className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-3 py-1.5 text-[11px] font-semibold text-[#00C9B1]"
                          >
                            {card.ctaLabel}
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                  const card = row.item;
                  return (
                    <tr key={row.key} className="border-b border-white/[0.05]">
                      <td className="px-4 py-3 pl-5 text-[12px] text-white/55">Prep card</td>
                      <td className="px-4 py-3 text-[12px] text-white/70">
                        <p className="font-semibold text-white/90">{card.headline}</p>
                      </td>
                      <td className="px-4 py-3 pr-5 text-right">
                        <Link
                          href={card.ctaHref}
                          className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-3 py-1.5 text-[11px] font-semibold text-[#00C9B1]"
                        >
                          {card.ctaLabel}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
