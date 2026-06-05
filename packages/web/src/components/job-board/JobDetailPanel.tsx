'use client';

import { queryKeys } from '@/lib/queryKeys';
import { Bookmark, ExternalLink, Loader2, Plug, Share2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { JobRankingInsight } from '@/components/job-board/JobRankingInsight';
import { MatchScoreGauge } from '@/components/job-board/MatchScoreGauge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useBookmarkJob } from '@/hooks/useBookmarkJob';
import { useCVProfileById } from '@/hooks/useCVProfileById';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import {
  jobBoardAiMatchDisabledReason,
  jobBoardQuotaFitBlockedReason,
  useJobBoardAiMatch,
} from '@/hooks/useJobBoardAiMatch';
import { buildJobMetadataParts, splitJobDescriptionSections } from '@/lib/jobBoardDisplay';
import { buildCvCorpusForMatch, computeCvJobMatchPreview } from '@/lib/jobBoardMatchPreview';
import { api, type CVProfile, type CVSectionRecord } from '@/lib/api';
import { cn } from '@/lib/utils';

function ExpandableBlock({
  title,
  body,
  maxChars = 560,
}: {
  title: string;
  body: string;
  maxChars?: number;
}) {
  const [open, setOpen] = useState(false);
  const long = body.length > maxChars;
  const shown = !long || open ? body : `${body.slice(0, maxChars).trimEnd()}…`;

  if (!body.trim()) return null;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">{title}</h3>
      <div className="mt-2 text-[13px] leading-[1.7] text-white/65">
        <p className="whitespace-pre-wrap">{shown}</p>
        {long && !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 text-[12px] font-semibold text-[#00C9B1] underline-offset-2 hover:underline"
          >
            Read more
          </button>
        ) : null}
      </div>
    </section>
  );
}

function RequirementsBlock({ text }: { text: string }) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">Requirements</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-white/65">
        {lines.map((line, i) => (
          <li key={`${i}-${line.slice(0, 80)}`} className="marker:text-[#00C9B1]/80">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

function computeHeuristicPreview(
  job: { title?: string; description?: string },
  cvProfileId: string | null | undefined,
  profile: CVProfile | undefined,
  sections: CVSectionRecord[],
  profileReady: boolean,
): { value: number; caption: 'Match preview' } {
  const jobBlob = `${job.title ?? ''}\n${job.description ?? ''}`;
  if (!cvProfileId?.trim()) {
    const preview = computeCvJobMatchPreview('', job.title ?? '', job.description ?? '');
    return { value: preview, caption: 'Match preview' };
  }
  if (!profileReady || !profile) {
    const preview = computeCvJobMatchPreview('', job.title ?? '', job.description ?? '');
    return { value: preview, caption: 'Match preview' };
  }
  const corpus = buildCvCorpusForMatch(profile, Array.isArray(sections) ? sections : []);
  const preview = computeCvJobMatchPreview(corpus || ' ', job.title ?? '', jobBlob);
  return { value: preview, caption: 'Match preview' };
}

export function JobDetailPanel({ jobId, cvProfileId }: { jobId: string; cvProfileId?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const bookmark = useBookmarkJob();
  const aiUsage = useDailyAiUsage();
  const detail = useQuery({
    queryKey: queryKeys.jobs.discoveryDetail(jobId),
    queryFn: () => api.jobDiscovery.getDetail(jobId),
    enabled: Boolean(jobId),
    staleTime: 1000 * 30,
  });

  const profileQ = useCVProfileById(cvProfileId?.trim() ? cvProfileId : null);

  const jd = detail.data?.description ?? '';
  const aiMatch = useJobBoardAiMatch({
    discoveryJobId: jobId,
    cvProfileId,
    title: detail.data?.title ?? '',
    company: detail.data?.company ?? '',
    description: jd,
    listingApplyUrl: detail.data?.url ?? null,
    jobDetailReady: Boolean(detail.data),
  });

  const scoreDisplay = useMemo(() => {
    const job = detail.data;
    if (!job) {
      return {
        value: 0,
        caption: 'Match score' as const,
        isPreview: false,
        footnote: null as string | null,
        gaugeLoading: false,
        analysisId: null as string | null,
        isTailoredSaved: false,
      };
    }

    const aiPack = aiMatch.data ?? aiMatch.savedAnalysisOverQuota;
    const ai = aiPack?.analysis;
    const matchSource = aiPack?.matchSource;
    const hydratedOnlyBecauseOverQuota = Boolean(!aiMatch.data && aiMatch.savedAnalysisOverQuota);
    if (ai && Number.isFinite(ai.matchScore)) {
      const tailored = Boolean(ai.isTailored);
      const baseTailored =
        'This score reflects how well your CV matches this job’s description—the skills, experience, and context the employer asks for—including updates after you tailored your CV for this role.';
      const basePlain =
        'This score reflects how well your CV matches this job’s description: your skills and experience against what the employer is asking for (same AI review as Analyze job).';
      let footnote = tailored ? baseTailored : basePlain;
      if (matchSource === 'reused') {
        footnote += hydratedOnlyBecauseOverQuota
          ? ' Loaded your saved analysis (daily AI limit reached; no new AI run).'
          : ' Loaded your saved analysis (no duplicate AI run).';
      } else if (matchSource === 'fresh') {
        footnote +=
          ai.scoreSource === 'heuristic'
            ? ' Quick listing preview (not saved to your pipeline) — match is an estimate only.'
            : ' Listing preview (not saved to your pipeline).';
      }
      return {
        value: ai.matchScore,
        caption:
          ai.scoreSource === 'heuristic'
            ? ('Estimated match' as const)
            : ai.scoreSource === 'ai'
              ? ('AI match' as const)
              : ('Match score' as const),
        isPreview: false,
        footnote,
        gaugeLoading: false,
        analysisId: (ai.id ?? '').trim() || null,
        isTailoredSaved: tailored,
      };
    }

    const disabledReason = jobBoardAiMatchDisabledReason(aiUsage, cvProfileId, jd);
    const willRunAi = !disabledReason;
    const heuristic = computeHeuristicPreview(
      job,
      cvProfileId,
      profileQ.data?.profile,
      profileQ.data?.sections ?? [],
      profileQ.isSuccess,
    );

    if (willRunAi && aiMatch.isDebouncing) {
      return {
        ...heuristic,
        isPreview: true,
        footnote: 'Pausing briefly so skimming the list does not use extra AI runs…',
        gaugeLoading: false,
        analysisId: null,
        isTailoredSaved: false,
      };
    }

    if (willRunAi && aiMatch.isFetching) {
      return {
        value: heuristic.value,
        caption: heuristic.caption,
        isPreview: true,
        footnote: null,
        gaugeLoading: true,
        analysisId: null,
        isTailoredSaved: false,
      };
    }

    if (willRunAi && aiMatch.isError) {
      return {
        ...heuristic,
        isPreview: true,
        footnote: 'Could not load AI match score. You can still open Tailor — Analyze job will run there.',
        gaugeLoading: false,
        analysisId: null,
        isTailoredSaved: false,
      };
    }

    if (disabledReason === 'quota') {
      if (aiMatch.overQuotaReuseFetching) {
        return {
          value: heuristic.value,
          caption: 'Match score' as const,
          isPreview: true,
          footnote: 'Checking for a saved job-fit analysis…',
          gaugeLoading: true,
          analysisId: null,
          isTailoredSaved: false,
        };
      }
      const quotaBlocked = jobBoardQuotaFitBlockedReason(jd);
      if (quotaBlocked === 'short_jd') {
        return {
          ...heuristic,
          caption: 'Fit estimate' as const,
          isPreview: true,
          footnote:
            'Daily AI limit reached. This listing needs more job text (20+ characters) before we can show a non-AI fit score.',
          gaugeLoading: false,
          analysisId: null,
          isTailoredSaved: false,
        };
      }
      if (aiMatch.quotaFitFetching) {
        return {
          value: heuristic.value,
          caption: 'Fit estimate' as const,
          isPreview: true,
          footnote: null,
          gaugeLoading: true,
          analysisId: null,
          isTailoredSaved: false,
        };
      }
      if (typeof aiMatch.quotaFitScore === 'number' && Number.isFinite(aiMatch.quotaFitScore)) {
        return {
          value: Math.max(0, Math.min(100, Math.round(aiMatch.quotaFitScore))),
          caption: 'Fit estimate' as const,
          isPreview: true,
          footnote:
            'Daily AI limit reached. This score uses a fixed formula on the job text (no AI quota). Treat it as a rough fit hint, not a full analysis.',
          gaugeLoading: false,
          analysisId: null,
          isTailoredSaved: false,
        };
      }
      if (aiMatch.quotaFitError) {
        return {
          ...heuristic,
          caption: 'Fit estimate' as const,
          isPreview: true,
          footnote: 'Could not load the non-AI fit estimate. The keyword preview above is unofficial.',
          gaugeLoading: false,
          analysisId: null,
          isTailoredSaved: false,
        };
      }
      return {
        ...heuristic,
        caption: 'Fit estimate' as const,
        isPreview: true,
        footnote:
          "Today's free AI uses are used up. Keyword preview only — upgrade or try tomorrow for the full AI match here.",
        gaugeLoading: false,
        analysisId: null,
        isTailoredSaved: false,
      };
    }

    if (disabledReason === 'short_jd') {
      return {
        ...heuristic,
        isPreview: true,
        footnote: 'Job text is short — add more description in the listing source for a reliable AI score.',
        gaugeLoading: false,
        analysisId: null,
        isTailoredSaved: false,
      };
    }

    if (disabledReason === 'no_cv') {
      return {
        ...heuristic,
        isPreview: true,
        footnote: 'Choose a CV profile in the job board filters to run the AI match score.',
        gaugeLoading: false,
        analysisId: null,
        isTailoredSaved: false,
      };
    }

    return {
      ...heuristic,
      isPreview: true,
      footnote:
        'Rough keyword overlap only (not the AI rubric). Select a CV profile with enough text for a closer preview.',
      gaugeLoading: false,
      analysisId: null,
      isTailoredSaved: false,
    };
  }, [
    detail.data,
    aiMatch.data,
    aiMatch.savedAnalysisOverQuota,
    aiMatch.overQuotaReuseFetching,
    aiMatch.isDebouncing,
    aiMatch.isFetching,
    aiMatch.isError,
    aiMatch.quotaFitScore,
    aiMatch.quotaFitFetching,
    aiMatch.quotaFitError,
    aiUsage,
    cvProfileId,
    jd,
    profileQ.data?.profile,
    profileQ.data?.sections,
    profileQ.isSuccess,
  ]);

  const hasSavedJobAnalysis = Boolean((scoreDisplay.analysisId ?? '').trim());

  const tailorBlockedByQuota = useMemo(() => {
    if (hasSavedJobAnalysis) return false;
    return jobBoardAiMatchDisabledReason(aiUsage, cvProfileId, jd) === 'quota';
  }, [hasSavedJobAnalysis, aiUsage, cvProfileId, jd]);

  const tailorAwaitingAi = useMemo(() => {
    if (hasSavedJobAnalysis) return false;
    if (tailorBlockedByQuota) return false;
    if (jobBoardAiMatchDisabledReason(aiUsage, cvProfileId, jd) !== null) return false;
    return (aiMatch.isDebouncing || aiMatch.isFetching) && !(scoreDisplay.analysisId ?? '').trim();
  }, [
    hasSavedJobAnalysis,
    aiUsage,
    cvProfileId,
    jd,
    aiMatch.isDebouncing,
    aiMatch.isFetching,
    scoreDisplay.analysisId,
    tailorBlockedByQuota,
  ]);

  const primaryFitCta = useMemo(() => {
    const id = (scoreDisplay.analysisId ?? '').trim();
    if (!id) {
      return {
        label: 'Tailor my CV to this job',
        detail:
          'Run a full job-fit review: your CV compared to this job’s description, then adjust your CV in the analyzer.',
      };
    }
    if (scoreDisplay.isTailoredSaved) {
      return {
        label: 'View tailored job fit',
        detail:
          'Opens your saved score, skill gaps, and tailored CV for this role. You are not starting a new tailoring run.',
      };
    }
    return {
      label: 'View job fit & CV tools',
      detail: 'Opens your saved analysis: match score, gaps, and options to continue tailoring if you want.',
    };
  }, [scoreDisplay.analysisId, scoreDisplay.isTailoredSaved]);

  const sectionsParsed = useMemo(() => splitJobDescriptionSections(detail.data?.description ?? ''), [detail.data?.description]);

  const metadataLine = useMemo(() => {
    if (!detail.data) return '';
    return buildJobMetadataParts(detail.data).join(' · ');
  }, [detail.data]);

  const shareJob = () => {
    const job = detail.data;
    if (!job?.url && !job?.title) return;
    const text = `${job.title} — ${job.company}`;
    if (navigator.share && job.url) {
      void navigator.share({ title: job.title, text, url: job.url }).catch(() => undefined);
      return;
    }
    if (job.url) {
      void navigator.clipboard.writeText(job.url).then(
        () => toast.success('Link copied'),
        () => toast.error('Could not copy link'),
      );
    }
  };

  if (detail.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading job">
        <div className="grid gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 [grid-template-areas:'head'_'act'_'score'] sm:p-6 lg:[grid-template-areas:'head_score'_'act_act'] lg:grid-cols-[minmax(0,1fr)_140px] lg:items-start lg:gap-x-8">
          <div className="min-w-0 space-y-3 [grid-area:head]">
            <div className="h-8 w-full max-w-lg animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-4 w-48 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/[0.04]" />
          </div>
          <div className="mx-auto flex h-[120px] w-[116px] shrink-0 items-start justify-center [grid-area:score] lg:mx-0 lg:justify-end">
            <div className="h-[100px] w-[116px] animate-pulse rounded-full bg-white/[0.04]" />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-5 [grid-area:act]">
            <div className="h-10 w-28 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-10 w-44 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-10 w-36 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-12 w-full max-w-md animate-pulse rounded-[10px] bg-white/[0.05]" />
          </div>
        </div>
        <div className="space-y-2 rounded-2xl border border-white/5 bg-[#0A0D0D] p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
        </div>
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] p-4 text-sm text-rose-200">
        Could not load this job detail.
      </div>
    );
  }

  const job = detail.data;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-6">
        <div
          className={cn(
            'grid gap-5 [grid-template-areas:"head"_"act"_"score"]',
            'lg:[grid-template-areas:"head_score"_"act_act"] lg:grid-cols-[minmax(0,1fr)_minmax(116px,148px)] lg:items-start lg:gap-x-6 xl:gap-x-8',
          )}
        >
          <div className="min-w-0 [grid-area:head]">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.08]">
                {job.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={job.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[15px] font-semibold text-white/70">
                    {job.company?.trim()?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 pr-0 lg:pr-2">
                <h2 className="line-clamp-2 text-[18px] font-bold leading-snug tracking-tight text-white sm:text-[20px] lg:line-clamp-none lg:break-words">
                  {job.title}
                </h2>
                <p className="mt-1 text-[15px] font-medium text-white/60">{job.company}</p>
                {metadataLine ? (
                  <p className="mt-2 text-[13px] font-medium text-white/40">{metadataLine}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-center [grid-area:score] border-t border-white/[0.06] pt-5 lg:border-0 lg:pt-0">
            {scoreDisplay.gaugeLoading ? (
              <div className="flex w-[116px] flex-col items-center py-2" aria-busy="true" aria-label="Loading AI match score">
                <Loader2 className="h-10 w-10 animate-spin text-[#00C9B1]" />
                <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">AI match score</p>
              </div>
            ) : (
              <MatchScoreGauge score={scoreDisplay.value} caption={scoreDisplay.caption} />
            )}
          </div>

          <div className="min-w-0 [grid-area:act] flex flex-col gap-3 border-t border-white/[0.06] pt-5">
            <div className="flex min-h-[44px] flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={bookmark.isPending}
                onClick={() => bookmark.mutate({ id: job.id, bookmarked: job.isBookmarked ?? false })}
                className={cn(
                  'h-11 min-h-[44px] min-w-0 gap-2 rounded-lg border px-4 text-[13px] font-semibold sm:shrink-0',
                  job.isBookmarked
                    ? 'border-[#00C9B1]/45 bg-transparent text-[#00C9B1] hover:bg-[#00C9B1]/10'
                    : 'border-white/20 bg-transparent text-white hover:border-white/30 hover:bg-white/[0.04]',
                )}
              >
                <Bookmark
                  className={cn('h-4 w-4 shrink-0', job.isBookmarked ? 'fill-current' : '')}
                  strokeWidth={2}
                  aria-hidden
                />
                {job.isBookmarked ? 'Saved' : 'Save job'}
              </Button>
              {job.url ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 min-h-[44px] gap-2 border-0 bg-transparent px-3 text-[13px] font-medium text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                  onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  View original
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="h-11 min-h-[44px] gap-2 border-0 bg-transparent px-3 text-[13px] font-medium text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                onClick={shareJob}
                title="Share or copy link"
              >
                <Share2 className="h-4 w-4 shrink-0" />
                Share
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 min-h-[44px] min-w-0 gap-2 border-0 bg-transparent px-3 text-[13px] font-medium text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                onClick={() =>
                  toast.success('Browser extension coming soon — it will auto-fill and submit this application for you.')
                }
              >
                <Plug className="h-4 w-4 shrink-0" aria-hidden />
                <span className="max-w-[10rem] truncate sm:max-w-none">Apply with extension</span>
              </Button>
            </div>
            {scoreDisplay.footnote ? (
              <p className="text-[11px] leading-relaxed text-white/45 lg:max-w-none">{scoreDisplay.footnote}</p>
            ) : null}
            <Button
              type="button"
              className="h-12 min-h-[48px] w-full gap-2 rounded-[10px] bg-[#00C9B1] text-[14px] font-semibold text-[#080A0A] shadow-[0_4px_20px_rgba(0,201,177,0.3)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
              disabled={tailorAwaitingAi || tailorBlockedByQuota}
              title={
                tailorBlockedByQuota
                  ? 'Daily AI limit reached. Upgrade or try again tomorrow to tailor your CV for this job.'
                  : tailorAwaitingAi
                    ? 'Wait for the AI match score to finish. You will open the analyzer on this job without running Analyze twice.'
                    : primaryFitCta.detail
              }
              onClick={() => {
                const id = (scoreDisplay.analysisId ?? '').trim();
                const cvQ = cvProfileId?.trim()
                  ? `&cvProfileId=${encodeURIComponent(cvProfileId.trim())}`
                  : '';
                if (id) {
                  router.push(
                    `/dashboard/jobs/analyze?jobId=${encodeURIComponent(id)}&fromBoard=1${cvQ}`,
                  );
                  return;
                }
                /** No saved row yet — open by listing id so the analyzer runs a full persisted analyze automatically. */
                router.push(
                  `/dashboard/jobs/analyze?jobListingId=${encodeURIComponent(job.id)}&fromBoard=1${cvQ}`,
                );
              }}
            >
              {aiMatch.isFetching && !(scoreDisplay.analysisId ?? '').trim() ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{primaryFitCta.label}</span>
            </Button>
          </div>
        </div>
      </div>

      <JobRankingInsight job={job} />

      <div className="h-px w-full bg-white/[0.06]" aria-hidden />

      <div className="space-y-4">
        {sectionsParsed.requirements ? (
          <>
            <ExpandableBlock title="About the position" body={sectionsParsed.about} />
            <RequirementsBlock text={sectionsParsed.requirements} />
          </>
        ) : (
          <ExpandableBlock title="Job description" body={job.description || 'No description available.'} maxChars={560} />
        )}
      </div>
    </div>
  );
}
