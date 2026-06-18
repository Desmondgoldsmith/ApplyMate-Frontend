'use client';

import { BookmarkMinus, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { cn } from '@/lib/utils';

import { canRemoveTrackedJobFromHub, HUB_STAGE_LABELS, HUB_STAGES, type HubStage, type TrackedJob } from './jobHubMerge';
import { JobHubBadges } from './JobHubBadges';

type Props = {
  jobs: TrackedJob[];
  selectedKey: string | null;
  onSelect: (job: TrackedJob) => void;
  /** Remove from hub (archive when applicable, or listing unbookmark). */
  onUnbookmark?: (job: TrackedJob) => void;
  /** `jobDiscovery.removeBookmark` listing id while request in flight. */
  unbookmarkPendingId?: string | null;
  /** Row key while server archive / unbookmark is in flight. */
  removingJobKey?: string | null;
  className?: string;
};

export function JobHubSidebar({
  jobs,
  selectedKey,
  onSelect,
  onUnbookmark,
  unbookmarkPendingId,
  removingJobKey = null,
  className,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [collapsedStages, setCollapsedStages] = useState<Record<HubStage, boolean>>(() =>
    Object.fromEntries(HUB_STAGES.map((s) => [s, true])) as Record<HubStage, boolean>,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [searchOpen]);

  const visibleJobs = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        HUB_STAGE_LABELS[j.stage].toLowerCase().includes(q),
    );
  }, [jobs, sidebarQuery]);

  const grouped = useMemo(() => {
    const m = new Map<HubStage, TrackedJob[]>();
    for (const s of HUB_STAGES) m.set(s, []);
    for (const j of visibleJobs) {
      const arr = m.get(j.stage) ?? [];
      arr.push(j);
      m.set(j.stage, arr);
    }
    return m;
  }, [visibleJobs]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSidebarQuery('');
  };

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden border-white/[0.06] bg-[#080b0b] lg:h-full lg:w-80 lg:shrink-0 lg:border-r',
        className,
      )}
    >
      <div className="border-b border-white/[0.06] px-2 py-2 sm:px-3 sm:py-2.5">
        {!searchOpen ? (
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Jobs
            </p>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#00C9B1]/25 text-[#00C9B1] transition-colors hover:border-[#00C9B1]/50 hover:bg-[#00C9B1]/15"
              aria-label="Search jobs in this list"
            >
              <Search className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#00C9B1]/80"
                aria-hidden
              />
              <input
                ref={searchInputRef}
                type="search"
                value={sidebarQuery}
                onChange={(e) => setSidebarQuery(e.target.value)}
                placeholder="Filter…"
                className="w-full rounded-lg border border-[#00C9B1]/35 bg-[#060a0a] py-2 pl-8 pr-2 text-sm text-white placeholder:text-white/35 focus:border-[#00C9B1] focus:outline-none focus:ring-1 focus:ring-[#00C9B1]/30"
                aria-label="Filter job list"
              />
            </div>
            <button
              type="button"
              onClick={closeSearch}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 text-white/55 transition-colors hover:border-[#00C9B1]/35 hover:bg-[#00C9B1]/12 hover:text-[#00C9B1]"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto app-scrollbar">
        {visibleJobs.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-white/40">
            {sidebarQuery.trim() ? 'No jobs match your search.' : 'No jobs in this list.'}
          </p>
        ) : (
          HUB_STAGES.map((stage) => {
            const list = grouped.get(stage) ?? [];
            if (list.length === 0) return null;
            const collapsed = collapsedStages[stage] ?? true;
            return (
              <div key={stage} className="border-b border-white/[0.04] py-2">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedStages((prev) => ({ ...prev, [stage]: !collapsed }))
                  }
                  className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left sm:px-3"
                  aria-expanded={!collapsed}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/45">
                    {HUB_STAGE_LABELS[stage]} ({list.length})
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-white/40 transition-transform',
                      collapsed ? '-rotate-90' : 'rotate-0',
                    )}
                    aria-hidden
                  />
                </button>
                {!collapsed ? (
                <div className="space-y-0.5 px-1 sm:px-1.5">
                  {list.map((job) => {
                    const sel = selectedKey === job.key;
                    const canRemove = Boolean(onUnbookmark && canRemoveTrackedJobFromHub(job));
                    const listingId = job.boardDiscoveryId?.trim() ?? '';
                    const unbookmarkBusy =
                      removingJobKey === job.key ||
                      (unbookmarkPendingId === listingId && Boolean(listingId));

                    return (
                      <div
                        key={job.key}
                        className={cn(
                          'min-w-0 rounded-xl transition-colors lg:rounded-lg',
                          sel
                            ? 'bg-[#00C9B1]/12 ring-1 ring-[#00C9B1]/35'
                            : 'hover:bg-[#00C9B1]/12',
                          'flex flex-col gap-2 p-2.5 lg:flex-row lg:items-stretch lg:gap-1 lg:p-0',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(job)}
                          className={cn(
                            'min-w-0 w-full text-left transition-colors lg:flex-1 lg:px-2 lg:py-2.5',
                            !sel && 'lg:rounded-lg',
                            sel && 'lg:rounded-l-lg lg:rounded-t-none',
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <CompanyLogo
                              company={job.company}
                              logoUrl={job.companyLogoUrl}
                              size="sm"
                              shape="rounded"
                            />
                            <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold leading-snug text-white">{job.title}</p>
                          <p className="mt-1 line-clamp-2 break-words text-xs leading-snug text-white/50">
                            {job.company}
                          </p>
                          <JobHubBadges job={job} className="mt-2" />
                            </div>
                          </div>
                        </button>
                        <div
                          className={cn(
                            'flex min-w-0 flex-row items-center justify-end gap-2 border-t border-white/[0.08] pt-2 lg:w-auto lg:max-w-[6.5rem] lg:flex-col lg:items-end lg:justify-center lg:border-t-0 lg:pt-0 lg:pr-2',
                            sel && 'lg:rounded-r-lg',
                          )}
                        >
                          {canRemove ? (
                            <button
                              type="button"
                              disabled={unbookmarkBusy}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnbookmark?.(job);
                              }}
                              className={cn(
                                'inline-flex shrink-0 items-center gap-0.5 rounded-md border border-[#00C9B1]/40 px-2 py-1 text-[10px] font-semibold text-[#00C9B1] transition-colors',
                                'hover:border-[#00C9B1] hover:bg-[#00C9B1]/20 disabled:cursor-not-allowed disabled:opacity-50',
                              )}
                              title="Remove from Job Hub (you can restore from Archived jobs)"
                            >
                              <BookmarkMinus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span>Remove</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
