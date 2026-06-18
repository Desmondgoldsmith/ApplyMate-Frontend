'use client';

import { LayoutGrid, List, Search } from 'lucide-react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { GlowCard } from '@/components/ui/GlowCard';
import { ListPageShimmer } from '@/components/ui/ListPageShimmer';
import { ListPagination } from '@/components/ui/ListPagination';
import { useToast } from '@/components/ui/Toast';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useDashboardQuietApplications } from '@/hooks/useDashboardQuietApplications';
import { useClientPagination } from '@/hooks/useClientPagination';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { sanitizeDashboardDisplayText } from '@/lib/dashboardDisplayCopy';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateTodayPlanQueries, type DashboardStaleApplicationItemPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type ViewMode = 'board' | 'list';

function QuietTable({
  items,
  onArchive,
  archiving,
}: {
  items: DashboardStaleApplicationItemPayload[];
  onArchive: (id: string) => void;
  archiving: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060a0a]/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-wide text-white/40">
            <th className="px-4 py-3 pl-5">Role</th>
            <th className="px-4 py-3">Guidance</th>
            <th className="px-4 py-3">Last activity</th>
            <th className="px-4 py-3 pr-5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]"
            >
              <td className="max-w-[220px] px-4 py-3.5 pl-5 align-middle">
                <div className="flex items-start gap-2.5">
                  <CompanyLogo company={item.company} logoUrl={item.companyLogoUrl} size="sm" shape="rounded" />
                  <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white/90">
                  {sanitizeDashboardDisplayText(item.jobTitle)}
                </p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  {sanitizeDashboardDisplayText(item.company)}
                </p>
                  </div>
                </div>
              </td>
              <td className="max-w-md px-4 py-3.5 align-middle text-[12px] leading-relaxed text-white/50">
                {sanitizeDashboardDisplayText(item.headline)}
                <span className="mt-1 block text-white/38">
                  {sanitizeDashboardDisplayText(item.supporting)}
                </span>
              </td>
              <td className="px-4 py-3.5 align-middle text-[12px] text-[#FCD34D]">
                {item.lastActivityLabel}
              </td>
              <td className="px-4 py-3.5 pr-5 text-right align-middle">
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={item.ctaHref}
                    className="inline-flex min-h-[36px] min-w-[108px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-3 py-1.5 text-[11px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                  >
                    {item.ctaLabel}
                  </Link>
                  {item.secondaryCtaLabel?.trim() ? (
                    <button
                      type="button"
                      disabled={archiving}
                      onClick={() => onArchive(item.applicationId)}
                      className="text-[11px] font-medium text-white/45 transition-colors hover:text-white/70 disabled:opacity-60"
                    >
                      {item.secondaryCtaLabel}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardQuietApplicationsPage() {
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

  const quietQuery = useDashboardQuietApplications({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
    focusFeedMaxItems: 100,
  });

  const toast = useToast();
  const queryClient = useQueryClient();
  const archiveMutation = useMutation({
    mutationFn: (applicationId: string) => api.jobs.archive({ applicationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.archive() });
      invalidateTodayPlanQueries(queryClient);
      void quietQuery.refetch();
      toast.success('Job archived');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) || 'Could not archive this job');
    },
  });

  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');

  const items = useMemo(
    () => quietQuery.data?.staleApplicationItems ?? [],
    [quietQuery.data?.staleApplicationItems],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.jobTitle.toLowerCase().includes(q) ||
        it.company.toLowerCase().includes(q) ||
        it.headline.toLowerCase().includes(q) ||
        it.supporting.toLowerCase().includes(q),
    );
  }, [items, search]);

  const pagination = useClientPagination(filtered, 12);
  const busy = quietQuery.isLoading && !quietQuery.data;

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Applications going quiet
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Roles with no updates in three weeks or more — follow up or archive to keep your search
          focused.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company or role…"
            className="w-full rounded-xl border border-white/12 bg-[#0c1010] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#00C9B1]/50 focus:outline-none"
            aria-label="Search quiet applications"
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
      ) : quietQuery.isError ? (
        <GlowCard contentClassName="p-6">
          <p className="text-sm text-rose-200">Could not load quiet applications.</p>
          <Button className="mt-4" variant="ghost" onClick={() => void quietQuery.refetch()}>
            Retry
          </Button>
        </GlowCard>
      ) : pagination.total === 0 ? (
        <GlowCard contentClassName="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
          <p className="text-lg font-semibold text-white/90">No quiet applications</p>
          <p className="mt-2 max-w-md text-sm text-white/45">
            When applications go three weeks without a reply, they appear here with follow-up or
            archive options.
          </p>
          <Button asChild className="mt-6 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </GlowCard>
      ) : view === 'board' ? (
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {pagination.pageItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[rgba(251,191,36,0.15)] bg-[rgba(251,191,36,0.04)] p-4"
              >
                <div className="flex items-start gap-3">
                  <CompanyLogo company={item.company} logoUrl={item.companyLogoUrl} size="md" shape="rounded" />
                  <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-white/92">
                    {sanitizeDashboardDisplayText(item.headline)}
                  </p>
                  <span className="shrink-0 text-[11px] font-medium text-[#FCD34D]">
                    {item.lastActivityLabel}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-white/50">
                  {sanitizeDashboardDisplayText(item.jobTitle)} ·{' '}
                  {sanitizeDashboardDisplayText(item.company)}
                </p>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-white/45">
                  {sanitizeDashboardDisplayText(item.supporting)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={item.ctaHref}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-3.5 py-1.5 text-[12px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                  >
                    {item.ctaLabel}
                  </Link>
                  {item.secondaryCtaLabel?.trim() ? (
                    <button
                      type="button"
                      disabled={archiveMutation.isPending}
                      onClick={() => archiveMutation.mutate(item.applicationId)}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[12px] font-medium text-white/65 transition-colors hover:text-white/85 disabled:opacity-60"
                    >
                      {item.secondaryCtaLabel}
                    </button>
                  ) : null}
                </div>
                  </div>
                </div>
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
          <QuietTable
            items={pagination.pageItems}
            onArchive={(id) => archiveMutation.mutate(id)}
            archiving={archiveMutation.isPending}
          />
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
