'use client';

import { queryKeys } from '@/lib/queryKeys';
import { Archive, LayoutGrid, List, Loader2, RotateCcw, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ListPageShimmer } from '@/components/ui/ListPageShimmer';
import { ListPagination } from '@/components/ui/ListPagination';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GlowCard } from '@/components/ui/GlowCard';
import { useToast } from '@/components/ui/Toast';
import {
  api,
  type ArchivedApplicationCard,
  type ArchivedBookmarkCard,
  type ArchivedJobAnalysisCard,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { useClientPagination } from '@/hooks/useClientPagination';
import { cn } from '@/lib/utils';

type ArchiveRow =
  | ArchivedBookmarkCard
  | ArchivedJobAnalysisCard
  | ArchivedApplicationCard;

function kindLabel(kind: ArchiveRow['kind']): string {
  switch (kind) {
    case 'bookmark':
      return 'Bookmark';
    case 'job_analysis':
      return 'Analysis';
    case 'application':
      return 'Application';
    default:
      return 'Item';
  }
}

function archivePayloadForRow(row: ArchiveRow): {
  bookmarkId?: string;
  jobAnalysisId?: string;
  applicationId?: string;
} {
  if (row.kind === 'bookmark') {
    return { bookmarkId: row.id };
  }
  if (row.kind === 'job_analysis') {
    return { jobAnalysisId: row.id };
  }
  return { applicationId: row.id };
}

function deleteArchiveFn(row: ArchiveRow) {
  if (row.kind === 'bookmark') return api.jobs.deleteArchivedBookmark(row.id);
  if (row.kind === 'job_analysis') return api.jobs.deleteArchivedAnalysis(row.id);
  return api.jobs.deleteArchivedApplication(row.id);
}

export function JobsArchiveContent() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [purgeRow, setPurgeRow] = useState<ArchiveRow | null>(null);

  const listQ = useQuery({
    queryKey: queryKeys.jobs.archive(),
    queryFn: () => api.jobs.listArchive(),
    staleTime: 30_000,
  });

  const rows: ArchiveRow[] = useMemo(() => {
    const d = listQ.data;
    if (!d) return [];
    return [...d.bookmarks, ...d.orphanJobAnalyses, ...d.applications];
  }, [listQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        kindLabel(r.kind).toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pagination = useClientPagination(filtered, 12);

  const restore = useMutation({
    mutationFn: (row: ArchiveRow) => api.jobs.restoreArchive(archivePayloadForRow(row)),
    onSuccess: (data) => {
      toast.success(data.message || 'Restored to your workspace.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.archive() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.career.dashboard() });
      invalidateTodayPlanQueries(queryClient);
    },
    onError: (e) => toast.error(getApiErrorMessage(e) || 'Could not restore'),
  });

  const purge = useMutation({
    mutationFn: (row: ArchiveRow) => deleteArchiveFn(row),
    onSuccess: () => {
      toast.success('Permanently deleted.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.archive() });
      setPurgeRow(null);
    },
    onError: (e) => toast.error(getApiErrorMessage(e) || 'Could not delete'),
  });

  const busy = listQ.isLoading || listQ.isFetching;

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Archived jobs</h1>
        <p className="mt-1 text-sm text-white/45">
          Restore a role to Job Hub or permanently delete it here. Active pipeline jobs stay on Job Hub — only
          archived items appear below.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, company, or type…"
            className="w-full rounded-xl border border-white/12 bg-[#0c1010] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#00C9B1]/50 focus:outline-none"
            aria-label="Search archived jobs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="sr-only">View mode</span>
          <div className="flex rounded-xl border border-white/12 p-0.5">
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
        <ListPageShimmer cardCount={5} tableRows={6} />) : listQ.isError ? (
        <GlowCard contentClassName="p-6">
          <p className="text-sm text-rose-200">{getApiErrorMessage(listQ.error)}</p>
          <Button className="mt-4" variant="ghost" onClick={() => void listQ.refetch()}>
            Retry
          </Button>
        </GlowCard>
      ) : pagination.total === 0 ? (
        <GlowCard contentClassName="flex min-h-[240px] flex-col items-center justify-center p-8 text-center">
          <Archive className="mb-3 h-12 w-12 text-[#00C9B1]/50" aria-hidden />
          <p className="text-lg font-semibold text-white">
            {rows.length === 0 ? 'No archived jobs' : 'No matches'}
          </p>
          <p className="mt-2 max-w-md text-sm text-white/45">
            {rows.length === 0
              ? 'When you remove a role from Job Hub, it will appear here so you can restore or delete it.'
              : 'Try a different search.'}
          </p>
          {rows.length === 0 ? (
            <Button asChild className="mt-6 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]">
              <Link href="/dashboard/jobs">Open Job Hub</Link>
            </Button>
          ) : null}
        </GlowCard>
      ) : view === 'board' ? (
        <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pagination.pageItems.map((row) => (
            <GlowCard
              key={`${row.kind}-${row.id}`}
              contentClassName="flex flex-col gap-3 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                  {kindLabel(row.kind)}
                </span>
                <span className="text-[10px] text-white/35">
                  {new Date(row.archivedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white line-clamp-2">{row.title}</p>
                <p className="mt-1 text-sm text-white/50 line-clamp-1">{row.company}</p>
              </div>
              {'matchScore' in row && row.matchScore != null && Number.isFinite(row.matchScore) ? (
                <p className="text-xs font-medium text-[#00C9B1]">{Math.round(row.matchScore)}% match</p>
              ) : null}
              <p className="text-[11px] text-white/35">
                Restore to: <span className="text-white/50">{row.restorePlacementHint}</span>
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 flex-1 gap-1 border border-[#00C9B1]/40 text-[13px] text-[#00C9B1]"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(row)}
                >
                  {restore.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Restore
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 gap-1 border border-rose-500/35 text-[13px] text-rose-200/90"
                  onClick={() => setPurgeRow(row)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </GlowCard>
          ))}
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
      ) : (
        <GlowCard contentClassName="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] font-semibold uppercase tracking-wide text-white/40">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Archived</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-white/[0.05] text-white/80">
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/60">
                      {kindLabel(row.kind)}
                    </span>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 font-medium text-white">
                    <span className="line-clamp-2">{row.title}</span>
                  </td>
                  <td className="max-w-[160px] px-4 py-3 text-white/55">
                    <span className="line-clamp-1">{row.company}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-white/45">
                    {new Date(row.archivedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 gap-1 border border-[#00C9B1]/40 px-3 text-[12px] text-[#00C9B1]"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(row)}
                      >
                        Restore
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 border border-rose-500/35 px-3 text-[12px] text-rose-200/90"
                        onClick={() => setPurgeRow(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.showPager ? (
            <div className="border-t border-white/[0.08] px-4 py-3">
              <ListPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                rangeStart={pagination.rangeStart}
                rangeEnd={pagination.rangeEnd}
                total={pagination.total}
                onPageChange={pagination.setPage}
              />
            </div>
          ) : null}
        </GlowCard>
      )}

      <ConfirmModal
        open={purgeRow != null}
        onOpenChange={(o) => !o && setPurgeRow(null)}
        title="Delete permanently?"
        description="This cannot be undone. The archived copy will be removed from ApplyMate."
        confirmLabel="Delete forever"
        cancelLabel="Cancel"
        isPending={purge.isPending}
        variant="danger"
        onConfirm={async () => {
          if (purgeRow) await purge.mutateAsync(purgeRow);
        }}
      />
    </div>
  );
}
