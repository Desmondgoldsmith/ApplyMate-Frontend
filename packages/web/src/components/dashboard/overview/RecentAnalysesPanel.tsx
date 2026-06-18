'use client';

import { BarChart2 } from 'lucide-react';
import Link from 'next/link';

import { MatchScoreRing } from '@/components/dashboard/MatchScoreRing';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { InfoHint } from '@/components/ui/InfoHint';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useJobHistory } from '@/hooks/useJobHistory';
import type { JobHistoryItem } from '@/lib/api';
import { ensureArray } from '@/lib/ensure-array';
import { historyItemHasCompletedAnalysis } from '@/lib/jobAnalysisComplete';
import { prefillJobAnalyzerInStorage } from '@/lib/jobHubPrefill';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { isAppliedOrLaterState } from '@/lib/today-plan';
import { scanLabelForJobHistoryRow } from '@/lib/todayPlanLabels';
import { TOOLTIP_RECENT_ANALYSES } from '@/lib/dashboardIntelligenceTooltips';
import { cn } from '@/lib/utils';

export function RecentAnalysesPanel({
  history,
  onRefreshPriorities,
}: {
  history: ReturnType<typeof useJobHistory>;
  onRefreshPriorities: () => void;
}) {
  const toast = useToast();
  const items = ensureArray<JobHistoryItem>(history.data).slice(0, 4);
  const isInterviewStage = (item: JobHistoryItem): boolean => {
    const state = String(item.state ?? '')
      .trim()
      .toLowerCase();
    const pipeline = String(item.pipelineStatus ?? '')
      .trim()
      .toLowerCase();
    return (
      pipeline === 'interviewing' ||
      state === 'interviewing' ||
      state === 'interview_scheduled' ||
      state === 'interviewed'
    );
  };
  const isAppliedOrLater = (item: JobHistoryItem): boolean => {
    return (
      isAppliedOrLaterState(item.state, item.isApplied) ||
      isAppliedOrLaterState(item.pipelineStatus, item.isApplied)
    );
  };

  const nextStepForAnalysis = (
    item: JobHistoryItem,
  ): { label: string; href: string; prefill?: boolean } => {
    if (!historyItemHasCompletedAnalysis(item)) {
      return {
        label: 'Analyze this job',
        href: '/dashboard/jobs/analyze?clean=1',
        prefill: true,
      };
    }
    if (isInterviewStage(item)) {
      const qp = new URLSearchParams();
      qp.set('jobAnalysisId', item.id);
      const jt = (item.jobTitle || item.title || '').trim();
      const company = (item.company ?? '').trim();
      const cvProfileId = (item.cvProfileId ?? '').trim();
      const tailoringCvProfileId = (item.tailoredCvProfileId ?? '').trim();
      if (jt) qp.set('jobTitle', jt);
      if (company) qp.set('company', company);
      if (cvProfileId) qp.set('cvProfileId', cvProfileId);
      if (tailoringCvProfileId)
        qp.set('preferredCvProfileId', tailoringCvProfileId);
      if (tailoringCvProfileId)
        qp.set('tailoringCvProfileId', tailoringCvProfileId);
      return {
        label: 'Prep for interview',
        href: `/dashboard/interview?${qp.toString()}`,
      };
    }
    if (isAppliedOrLater(item)) {
      return {
        label: 'Continue in Job Hub',
        href: `/dashboard/jobs?jobId=${encodeURIComponent(item.id)}`,
      };
    }
    if (!item.hasCoverLetter) {
      return {
        label: 'Generate cover letter',
        href: `/dashboard/jobs?jobId=${encodeURIComponent(item.id)}&tab=cover`,
      };
    }
    if (!item.isTailored) {
      return {
        label: 'Tailor CV',
        href: `/dashboard/jobs/analyze?jobId=${encodeURIComponent(item.id)}&openTailor=1`,
      };
    }
    return {
      label: 'Open in Job Hub',
      href: `/dashboard/jobs?jobId=${encodeURIComponent(item.id)}`,
    };
  };

  return (
    <section
      id="dashboard-deep-recent-analyses"
      className="scroll-mt-4 rounded-3xl border border-white/[0.06] bg-white/[0.015] p-4 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.04] sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-white/90">
            Recent analyses
          </h2>
          <InfoHint
            text={TOOLTIP_RECENT_ANALYSES}
            buttonAriaLabel="About recent analyses"
          />
        </div>
        <Link
          href="/dashboard/jobs"
          className="text-[13px] font-medium text-[#00C9B1] hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-3">
        {history.isLoading && !history.data ? (
          <>
            <Skeleton height={64} borderRadius={12} />
            <Skeleton height={64} borderRadius={12} />
            <Skeleton height={64} borderRadius={12} />
          </>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center">
            <BarChart2
              className="mx-auto h-6 w-6 text-[#00C9B1]"
              strokeWidth={1.5}
            />
            <p className="mt-2 text-[13px] font-semibold text-white">
              No analyses yet
            </p>
            <p className="mt-1 text-[12px] font-medium text-white/40">
              Paste a job to see your match score
            </p>
            <Link
              href="/dashboard/jobs/analyze"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#00C9B1] px-4 py-2 text-[13px] font-semibold text-[#080A0A]"
            >
              Analyze a job →
            </Link>
          </div>
        ) : (
          items.map((item) => {
            const company = item.company ?? 'Unknown';
            const title = item.jobTitle || item.title || 'Untitled role';
            const analyzed = historyItemHasCompletedAnalysis(item);
            const score = analyzed
              ? typeof item.matchScore === 'number' && Number.isFinite(item.matchScore)
                ? item.matchScore
                : null
              : null;
            const next = nextStepForAnalysis(item);
            const scan = analyzed
              ? scanLabelForJobHistoryRow(item)
              : { label: 'Not analyzed', tone: 'passive' as const };
            const scanTone =
              scan.tone === 'warn'
                ? 'border-amber-400/35 bg-amber-500/12 text-amber-100'
                : scan.tone === 'passive'
                  ? 'border-white/12 bg-white/[0.06] text-white/48'
                  : 'border-[#00C9B1]/30 bg-[#00C9B1]/11 text-[#9CF5EA]';
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none hover:border-white/[0.11] hover:bg-white/[0.045] hover:shadow-[0_12px_36px_-24px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-center gap-3">
                  <CompanyLogo company={company} logoUrl={item.companyLogoUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-[13px] font-medium text-white">
                        {title}
                      </p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
                          scanTone,
                        )}
                      >
                        {scan.label}
                      </span>
                    </div>
                    <p className="truncate text-[11px] font-medium text-white/40">
                      {company} · {formatRelativeEdited(item.createdAt)}
                    </p>
                  </div>
                  <MatchScoreRing score={score} size={36} stroke={2} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-white/45">Next step</p>
                  <Link
                    href={next.href}
                    className="text-[12px] font-medium text-[#00C9B1] hover:underline"
                    onClick={(e) => {
                      if (next.prefill) {
                        const jt = (item.jobTitle || item.title || '').trim();
                        const co = (item.company ?? '').trim();
                        const description = (
                          item.description ??
                          item.jobDescription ??
                          ''
                        ).trim();
                        prefillJobAnalyzerInStorage(jt, co, description);
                      }
                      const allowedPostApplyLabels = new Set([
                        'Continue in Job Hub',
                        'Prep for interview',
                      ]);
                      if (
                        isAppliedOrLater(item) &&
                        !allowedPostApplyLabels.has(next.label)
                      ) {
                        e.preventDefault();
                        toast.info(
                          'This task was already resolved. Refreshing your current priorities.',
                        );
                        onRefreshPriorities();
                      }
                    }}
                  >
                    {next.label} →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
