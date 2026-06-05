'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { ApplicationsTrackerTab } from '@/components/dashboard/ApplicationsTrackerTab';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { useJobAnalyses } from '@/hooks/useJobAnalyses';
import type { JobAnalysisSummary, JobSalaryEstimate } from '@/lib/api';
import { formatSalaryRangeCompact } from '@/lib/jobSalaryEstimate';
import { cn } from '@/lib/utils';

type SavedPanelView = 'applications' | 'analyzed';

function formatRelativeAnalyzed(iso: string): string {
  if (!iso?.trim()) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMs = Date.now() - t;
  const day = 86_400_000;
  if (diffMs < day && diffMs >= 0) {
    const h = Math.floor(diffMs / 3_600_000);
    if (h < 1) return 'Just now';
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(diffMs / day);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${Math.max(1, months)} month${months === 1 ? '' : 's'} ago`;
}

function matchBadgeClass(score: number): string {
  if (score >= 70) return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  if (score >= 50) return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
  return 'border-rose-400/35 bg-rose-500/12 text-rose-100';
}

function AnalyzedJobsList() {
  const router = useRouter();
  const q = useJobAnalyses();

  if (q.isLoading) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <GlowCard contentClassName="p-6 text-center">
        <p className="text-sm text-rose-200">Could not load analyzed jobs. Try again in a moment.</p>
        <Button type="button" className="mt-4" onClick={() => void q.refetch()}>
          Retry
        </Button>
      </GlowCard>
    );
  }

  const rows = q.data ?? [];

  if (rows.length === 0) {
    return (
      <GlowCard contentClassName="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-semibold text-white">No analyzed jobs yet</p>
        <p className="mt-2 max-w-md text-sm text-white/45">
          Paste a job description in the Job Analyzer to get started.
        </p>
        <Button className="mt-6" onClick={() => router.replace('/dashboard/jobs')}>
          Go to analyzer →
        </Button>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((item) => (
        <AnalyzedJobCard key={item.id} item={item} onOpen={() => router.push(`/dashboard/jobs?jobId=${encodeURIComponent(item.id)}`)} />
      ))}
    </div>
  );
}

function AnalyzedJobCard({ item, onOpen }: { item: JobAnalysisSummary; onOpen: () => void }) {
  const score = Math.round(item.matchScore);
  const rel = formatRelativeAnalyzed(item.updatedAt || item.createdAt);
  const salaryLine =
    item.salaryEstimate && typeof item.salaryEstimate === 'object'
      ? formatSalaryRangeCompact(item.salaryEstimate)
      : null;

  return (
    <GlowCard contentClassName="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{item.title || 'Untitled role'}</p>
          <p className="text-[13px] text-white/45">{item.company || '—'}</p>
          {rel ? <p className="mt-1 text-xs text-white/35">{rel}</p> : null}
          {salaryLine ? <p className="mt-1 text-xs text-white/55">{salaryLine}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              'inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums',
              matchBadgeClass(score),
            )}
          >
            {score}%
          </span>
          {item.isTailored ? (
            <span className="inline-flex items-center rounded-lg border border-[#00C9B1]/35 bg-[#00C9B1]/12 px-2 py-1 text-[11px] font-semibold text-[#00C9B1]">
              Tailored ✓
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="text-xs font-medium text-[#00C9B1] underline-offset-2 hover:underline"
        >
          Open in analyzer →
        </button>
      </div>
    </GlowCard>
  );
}

export function ApplicationsSavedPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const savedView = useMemo((): SavedPanelView => {
    const v = (searchParams.get('savedView') ?? '').toLowerCase();
    return v === 'analyzed' ? 'analyzed' : 'applications';
  }, [searchParams]);

  const setSavedView = useCallback(
    (next: SavedPanelView) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'saved');
      if (next === 'analyzed') {
        params.set('savedView', 'analyzed');
      } else {
        params.delete('savedView');
      }
      router.replace(`/dashboard/jobs?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-1">
        <button
          type="button"
          onClick={() => setSavedView('applications')}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition sm:flex-none sm:px-4',
            savedView === 'applications'
              ? 'bg-[#00C9B1]/15 text-white ring-1 ring-[#00C9B1]/30'
              : 'text-white/50 hover:text-white/80',
          )}
        >
          Applications
        </button>
        <button
          type="button"
          onClick={() => setSavedView('analyzed')}
          className={cn(
            'flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition sm:flex-none sm:px-4',
            savedView === 'analyzed'
              ? 'bg-[#00C9B1]/15 text-white ring-1 ring-[#00C9B1]/30'
              : 'text-white/50 hover:text-white/80',
          )}
        >
          Analyzed Jobs
        </button>
      </div>

      {savedView === 'applications' ? <ApplicationsTrackerTab /> : <AnalyzedJobsList />}
    </div>
  );
}
