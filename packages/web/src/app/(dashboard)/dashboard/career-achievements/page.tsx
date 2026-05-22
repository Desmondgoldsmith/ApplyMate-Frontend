'use client';

import { BadgeCheck, LayoutGrid, List, Search, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  PlacementVerificationModal,
  type VerificationUiStatus,
} from '@/components/job-hub/PlacementVerificationModal';
import { ShareAchievementModal } from '@/components/job-hub/ShareAchievementModal';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { ListPageShimmer } from '@/components/ui/ListPageShimmer';
import { ListPagination } from '@/components/ui/ListPagination';
import { useCareerDashboard } from '@/hooks/useCareerDashboard';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useJobHistory } from '@/hooks/useJobHistory';
import type { JobHistoryItem } from '@/lib/api';
import type { CareerBadge, CareerPipelineJob } from '@/lib/career';
import { cn } from '@/lib/utils';

type ViewMode = 'board' | 'list';

type AcceptedRow = CareerPipelineJob & { jobAnalysisId?: string | null };

function mergeAcceptedJobs(careerJobs: CareerPipelineJob[], historyRows: JobHistoryItem[]): AcceptedRow[] {
  const map = new Map<string, AcceptedRow>();
  for (const row of careerJobs) {
    const id = (row.jobAnalysisId ?? row.jobId).trim();
    if (!id) continue;
    map.set(id, { ...row, jobAnalysisId: row.jobAnalysisId ?? row.jobId });
  }
  for (const h of historyRows) {
    const id = h.id.trim();
    if (!id || map.has(id)) continue;
    map.set(id, {
      jobId: id,
      jobAnalysisId: id,
      jobListingId: h.jobListingId ?? null,
      pipelineStage: 'ACCEPTED',
      company: h.company?.trim() || '—',
      title: (h.jobTitle || h.title || 'Role').trim(),
      matchScore: typeof h.matchScore === 'number' ? h.matchScore : null,
      lastEventAt: h.lastActivityAt ?? h.createdAt ?? new Date().toISOString(),
    });
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime(),
  );
}

function hrefForAcceptedJob(job: AcceptedRow): string | null {
  const ja = job.jobAnalysisId?.trim() || job.jobId?.trim();
  if (ja) return `/dashboard/jobs?jobId=${encodeURIComponent(ja)}`;
  const jl = job.jobListingId?.trim();
  if (jl) return `/dashboard/job-board?jobListingId=${encodeURIComponent(jl)}`;
  return null;
}

function formatAcceptedWhen(iso: string): { short: string; title: string } {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { short: '', title: '' };
    return {
      short: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      title: d.toISOString(),
    };
  } catch {
    return { short: '', title: '' };
  }
}

export default function CareerAchievementsPage() {
  const careerQ = useCareerDashboard(true);
  const historyQ = useJobHistory({ includeAccepted: true });
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');
  const [verifyJob, setVerifyJob] = useState<AcceptedRow | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationUiStatus>('none');
  const [shareModal, setShareModal] = useState<{
    badge: CareerBadge | null;
    title: string;
    company: string;
  } | null>(null);

  const defaultBadge = careerQ.data?.badges?.[0] ?? null;

  const acceptedJobs = useMemo(() => {
    const fromHistory =
      historyQ.data?.filter((h) => (h.pipelineStatus ?? '').toLowerCase() === 'accepted') ?? [];
    return mergeAcceptedJobs(careerQ.data?.acceptedJobs ?? [], fromHistory);
  }, [careerQ.data?.acceptedJobs, historyQ.data]);

  const openShareForJob = (job: AcceptedRow) => {
    setShareModal({
      badge: defaultBadge,
      title: job.title?.trim() || 'Role',
      company: job.company?.trim() || 'Company',
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return acceptedJobs;
    return acceptedJobs.filter((j) => {
      const title = (j.title ?? '').toLowerCase();
      const company = (j.company ?? '').toLowerCase();
      return title.includes(q) || company.includes(q);
    });
  }, [acceptedJobs, search]);

  const pagination = useClientPagination(filtered, 12);

  const busy = (careerQ.isLoading && !careerQ.data) || (historyQ.isLoading && !historyQ.data);

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Career Achievements</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Accepted offers and wins live here. Verify each placement, share your win, or jump back to the role.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or company…"
            className="w-full rounded-xl border border-white/12 bg-[#0c1010] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#00C9B1]/50 focus:outline-none"
            aria-label="Search accepted jobs"
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
        <ListPageShimmer cardCount={4} tableRows={6} />
      ) : careerQ.isError ? (
        <GlowCard contentClassName="p-6">
          <p className="text-sm text-rose-200">{careerQ.error?.message ?? 'Could not load career data.'}</p>
          <Button className="mt-4" variant="ghost" onClick={() => void careerQ.refetch()}>
            Retry
          </Button>
        </GlowCard>
      ) : pagination.total === 0 ? (
        <GlowCard contentClassName="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
          <p className="text-lg font-semibold text-white/90">No accepted roles yet</p>
          <p className="mt-2 max-w-md text-sm text-white/45">
            When you mark a job as <span className="text-[#00C9B1]">Accepted</span> in Job Hub, it appears here with links
            back to your analysis.
          </p>
          <Button asChild className="mt-6 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]">
            <Link href="/dashboard/jobs">Open Job Hub</Link>
          </Button>
        </GlowCard>
      ) : view === 'board' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pagination.pageItems.map((job, i) => {
              const title = job.title?.trim() || 'Role';
              const company = job.company?.trim() || 'Company';
              const href = hrefForAcceptedJob(job);
              const { short: whenShort, title: whenTitle } = formatAcceptedWhen(job.lastEventAt);
              const key = `${job.jobId}-${i}`;
              return (
                <GlowCard
                  key={key}
                  contentClassName="flex h-full flex-col p-4"
                  className="border-emerald-500/20 shadow-[0_0_24px_-16px_rgba(16,185,129,0.35)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-snug text-white">{title}</p>
                      <p className="mt-1 text-[13px] text-white/55">{company}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90"
                      title="Accepted offer"
                    >
                      Won
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/45">
                    {job.matchScore != null ? (
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 tabular-nums">
                        Match {job.matchScore}%
                      </span>
                    ) : null}
                    {whenShort ? (
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5" title={whenTitle}>
                        Updated {whenShort}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1.5 border border-[#00C9B1]/35 text-[13px] text-[#00C9B1]"
                      onClick={() => setVerifyJob(job)}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                      Verify placement
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-1.5 border border-emerald-400/35 bg-emerald-500/10 text-[13px] text-emerald-200"
                      onClick={() => openShareForJob(job)}
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden />
                      Share your win
                    </Button>
                    {href ? (
                      <Button asChild variant="ghost" className="border border-white/12 text-[13px] text-white/70">
                        <Link href={href}>Open role</Link>
                      </Button>
                    ) : null}
                  </div>
                </GlowCard>
              );
            })}
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
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((job, i) => {
                const title = job.title?.trim() || 'Role';
                const company = job.company?.trim() || 'Company';
                const href = hrefForAcceptedJob(job);
                const { short: whenShort } = formatAcceptedWhen(job.lastEventAt);
                const key = `${job.jobId}-t-${i}`;
                return (
                  <tr key={key} className="border-b border-white/[0.05] text-white/85">
                    <td className="px-4 py-3 font-medium text-white">{title}</td>
                    <td className="px-4 py-3 text-white/60">{company}</td>
                    <td className="px-4 py-3 tabular-nums text-white/70">
                      {job.matchScore != null ? `${job.matchScore}%` : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-white/45">{whenShort || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="gap-1 border border-[#00C9B1]/35 text-[12px] text-[#00C9B1]"
                          onClick={() => setVerifyJob(job)}
                        >
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                          Verify
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="gap-1 border border-emerald-400/35 text-[12px] text-emerald-200"
                          onClick={() => openShareForJob(job)}
                        >
                          <Share2 className="h-3.5 w-3.5" aria-hidden />
                          Share
                        </Button>
                        {href ? (
                          <Button asChild variant="ghost" className="border border-white/12 text-[12px] text-white/70">
                            <Link href={href}>Open</Link>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      <ShareAchievementModal
        open={shareModal != null}
        onOpenChange={(open) => {
          if (!open) setShareModal(null);
        }}
        badge={shareModal?.badge}
        jobTitle={shareModal?.title}
        company={shareModal?.company}
      />

      <PlacementVerificationModal
        open={verifyJob != null}
        onOpenChange={(open) => {
          if (!open) setVerifyJob(null);
        }}
        jobId={verifyJob?.jobAnalysisId?.trim() || verifyJob?.jobId?.trim() || null}
        onSubmitted={({ pending, premiumActiveUntil }) => {
          if (premiumActiveUntil) setVerificationStatus('verified');
          else if (pending) setVerificationStatus('pending');
          setVerifyJob(null);
        }}
      />
      {verificationStatus === 'verified' ? (
        <p className="text-center text-[12px] text-emerald-300/80">Placement verified — premium benefits active.</p>
      ) : verificationStatus === 'pending' ? (
        <p className="text-center text-[12px] text-amber-200/80">Verification submitted — we will review shortly.</p>
      ) : (
        <p className="text-center text-[12px] text-white/35">
          Unlocked badges and XP milestones live on{' '}
          <Link href="/dashboard/achievements" className="text-[#00C9B1] hover:underline">
            Achievements
          </Link>
          .
        </p>
      )}
    </div>
  );
}
