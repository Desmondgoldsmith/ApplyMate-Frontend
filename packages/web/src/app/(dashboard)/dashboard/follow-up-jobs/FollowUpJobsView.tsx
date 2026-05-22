'use client';

import { LayoutGrid, List, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import type { FollowUpJobRowPayload } from '@/lib/today-plan';
import { FOLLOW_UP_PAGE } from '@/lib/followUpJobsPageCopy';
import {
  followUpJobCardVariant,
  followUpJobSourceDisplayLabel,
  type FollowUpCardVariant,
} from '@/lib/followUpJobCardVariant';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 5;
const VIEW_STORAGE_KEY = 'applymate-follow-up-jobs-view';
const MAX_PAGE_BUTTONS = 7;

function visiblePageNumbers(current: number, totalPages: number): number[] {
  if (totalPages <= MAX_PAGE_BUTTONS) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(MAX_PAGE_BUTTONS / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(totalPages, start + MAX_PAGE_BUTTONS - 1);
  start = Math.max(1, end - MAX_PAGE_BUTTONS + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

type ViewMode = 'cards' | 'table';

function rowMatchesQuery(row: FollowUpJobRowPayload, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.companyName,
    row.jobTitle,
    row.headline,
    row.supporting,
    row.reason,
    row.source,
    row.coachingStage,
  ]
    .map((s) => (s ?? '').toLowerCase())
    .join(' ');
  return hay.includes(q);
}

function FollowUpJobCard({
  row,
  variant,
}: {
  row: FollowUpJobRowPayload;
  variant: FollowUpCardVariant;
}) {
  const title =
    [row.jobTitle?.trim(), row.companyName?.trim()].filter(Boolean).join(' · ') || 'Role';
  const href = row.ctaHref?.trim();
  const label = row.ctaLabel?.trim() || FOLLOW_UP_PAGE.openAction;
  const days =
    typeof row.daysSinceApplication === 'number' && Number.isFinite(row.daysSinceApplication)
      ? Math.max(0, Math.round(row.daysSinceApplication))
      : null;
  const Icon = variant.Icon;

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border p-3.5 pl-4 transition-colors duration-200',
        variant.card,
      )}
    >
      <div
        className={cn('pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full', variant.accentBar)}
        aria-hidden
      />
      <div className="flex flex-col gap-2.5 pl-1">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
              variant.iconWrap,
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                  variant.pill,
                )}
              >
                {variant.shortLabel}
              </span>
              {days != null ? (
                <span className="text-[10px] tabular-nums text-white/35">{days}d</span>
              ) : null}
            </div>
            <h2 className="mt-1.5 text-[13px] font-semibold leading-snug text-white/95">{title}</h2>
            {row.headline?.trim() ? (
              <p className="mt-0.5 text-[11px] font-medium leading-snug text-white/65">{row.headline.trim()}</p>
            ) : null}
            {row.supporting?.trim() ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/48 line-clamp-3">{row.supporting.trim()}</p>
            ) : null}
          </div>
        </div>
        {href ? (
          <Link
            href={href}
            className={cn(
              'inline-flex min-h-[38px] w-full cursor-pointer items-center justify-center rounded-full border border-[#00C9B1]/45 px-3 py-2 text-[12px] font-semibold text-[#00C9B1] transition-colors duration-200 hover:bg-[#00C9B1] hover:text-[#080A0A]',
            )}
          >
            {label}
          </Link>
        ) : (
          <span className="text-center text-[12px] text-white/35">{FOLLOW_UP_PAGE.noLink}</span>
        )}
      </div>
    </article>
  );
}

function FollowUpJobsTable({ rows }: { rows: FollowUpJobRowPayload[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060a0a]/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-wide text-white/40">
            <th className="px-3 py-2.5 pl-4">{FOLLOW_UP_PAGE.typeColumn}</th>
            <th className="px-3 py-2.5">{FOLLOW_UP_PAGE.roleColumn}</th>
            <th className="px-3 py-2.5">{FOLLOW_UP_PAGE.sourceColumn}</th>
            <th className="px-3 py-2.5 pr-4 text-right">{FOLLOW_UP_PAGE.actionColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const variant = followUpJobCardVariant(row.source);
            const title =
              [row.jobTitle?.trim(), row.companyName?.trim()].filter(Boolean).join(' · ') || '—';
            const href = row.ctaHref?.trim();
            const label = row.ctaLabel?.trim() || FOLLOW_UP_PAGE.openAction;
            const sourceLabel = followUpJobSourceDisplayLabel(row.source);
            const Icon = variant.Icon;
            return (
              <tr key={row.id} className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]">
                <td className="px-3 py-3 pl-4 align-middle">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      variant.pill,
                    )}
                  >
                    <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                    {variant.shortLabel}
                  </span>
                </td>
                <td className="max-w-[260px] px-3 py-3 align-middle lg:max-w-md">
                  <p className="text-[12px] font-semibold text-white/90">{title}</p>
                  {row.headline?.trim() ? (
                    <p className="mt-0.5 text-[11px] text-white/45 line-clamp-2">{row.headline.trim()}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-middle text-[11px] text-white/55">
                  {sourceLabel}
                </td>
                <td className="px-3 py-3 pr-4 text-right align-middle">
                  {href ? (
                    <Link
                      href={href}
                      className="inline-flex min-h-[36px] min-w-[88px] cursor-pointer items-center justify-center rounded-full border border-[#00C9B1]/45 px-3 py-1.5 text-[11px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="text-[12px] text-white/35">{FOLLOW_UP_PAGE.noLink}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  jobs: FollowUpJobRowPayload[];
  /** Total from API before cap; optional cap messaging */
  serverTotalCount: number | null;
};

export function FollowUpJobsView({ jobs, serverTotalCount }: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'cards' || stored === 'table') setViewMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const filtered = useMemo(() => jobs.filter((row) => rowMatchesQuery(row, query)), [jobs, query]);

  useEffect(() => {
    setPage(1);
  }, [query, jobs.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageOffset = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageOffset, pageOffset + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : pageOffset + 1;
  const to = pageOffset + pageRows.length;

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-8">
      {/* Hero */}
      <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-8 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0 flex-1 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{FOLLOW_UP_PAGE.title}</h1>
          <p className="max-w-2xl text-[14px] leading-relaxed text-white/50 md:text-[15px]">{FOLLOW_UP_PAGE.subtitle}</p>
          {serverTotalCount != null && jobs.length < serverTotalCount ? (
            <p className="text-[12px] leading-relaxed text-amber-200/70">{FOLLOW_UP_PAGE.capNote(jobs.length, serverTotalCount)}</p>
          ) : null}
        </div>
      </header>

      {jobs.length === 0 ? (
        <GlowCard contentClassName="p-8 text-center md:p-10">
          <p className="text-[17px] font-semibold text-white/90">{FOLLOW_UP_PAGE.emptyTitle}</p>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/45">{FOLLOW_UP_PAGE.emptyBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="primary" className="cursor-pointer" asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <Button variant="ghost" className="cursor-pointer" asChild>
              <Link href="/dashboard/jobs">Job Hub</Link>
            </Button>
          </div>
        </GlowCard>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-xl">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={FOLLOW_UP_PAGE.searchPlaceholder}
                className="w-full rounded-xl border border-white/12 bg-[#0c1010] py-3 pl-11 pr-4 text-[14px] text-white placeholder:text-white/35 focus:border-[#00C9B1]/45 focus:outline-none"
                aria-label={FOLLOW_UP_PAGE.searchPlaceholder}
              />
            </div>
            <div className="flex rounded-xl border border-white/12 p-0.5" role="group" aria-label="Layout">
              <button
                type="button"
                title={FOLLOW_UP_PAGE.cardsLabel}
                onClick={() => setView('cards')}
                className={cn(
                  'rounded-lg p-2 transition-colors duration-200',
                  viewMode === 'cards'
                    ? 'bg-[#00C9B1]/20 text-[#00C9B1]'
                    : 'text-white/45 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]',
                )}
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                title={FOLLOW_UP_PAGE.tableLabel}
                onClick={() => setView('table')}
                className={cn(
                  'rounded-lg p-2 transition-colors duration-200',
                  viewMode === 'table'
                    ? 'bg-[#00C9B1]/20 text-[#00C9B1]'
                    : 'text-white/45 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]',
                )}
              >
                <List className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <p className="text-[12px] text-white/40">
            {query.trim()
              ? FOLLOW_UP_PAGE.showingFiltered(filtered.length, jobs.length)
              : FOLLOW_UP_PAGE.showingRange(from, to, filtered.length)}
          </p>

          {filtered.length === 0 ? (
            <GlowCard contentClassName="p-6">
              <p className="text-[14px] text-white/65">No roles match your search. Try another keyword or clear the filter.</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-4 cursor-pointer text-[13px] font-semibold text-[#00C9B1] hover:underline"
              >
                Clear search
              </button>
            </GlowCard>
          ) : viewMode === 'cards' ? (
            <ul className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {pageRows.map((row) => (
                <li key={row.id}>
                  <FollowUpJobCard row={row} variant={followUpJobCardVariant(row.source)} />
                </li>
              ))}
            </ul>
          ) : (
            <FollowUpJobsTable rows={pageRows} />
          )}

          {/* Pagination */}
          {filtered.length > PAGE_SIZE ? (
            <nav
              className="flex flex-col items-stretch justify-between gap-4 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center"
              aria-label="Pagination"
            >
              <p className="text-[13px] tabular-nums text-white/45">{FOLLOW_UP_PAGE.pageStatus(safePage, totalPages)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={cn(
                    'cursor-pointer rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
                    safePage <= 1
                      ? 'border-white/10 text-white/35'
                      : 'border-[#00C9B1]/35 text-[#00C9B1] hover:bg-[#00C9B1]/12',
                  )}
                >
                  {FOLLOW_UP_PAGE.prev}
                </button>
                <div className="flex flex-wrap gap-1">
                  {visiblePageNumbers(safePage, totalPages).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        'min-h-[40px] min-w-[40px] cursor-pointer rounded-lg text-[13px] font-semibold transition-colors duration-200',
                        n === safePage
                          ? 'bg-[#00C9B1]/25 text-[#00C9B1]'
                          : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
                      )}
                      aria-current={n === safePage ? 'page' : undefined}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={cn(
                    'cursor-pointer rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
                    safePage >= totalPages
                      ? 'border-white/10 text-white/35'
                      : 'border-[#00C9B1]/35 text-[#00C9B1] hover:bg-[#00C9B1]/12',
                  )}
                >
                  {FOLLOW_UP_PAGE.next}
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
