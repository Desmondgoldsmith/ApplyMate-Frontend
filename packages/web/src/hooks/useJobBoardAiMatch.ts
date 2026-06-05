'use client';

import { queryKeys } from '@/lib/queryKeys';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { useJobAnalyzeLocationPayload } from '@/hooks/useJobAnalyzeLocationPayload';
import { api, type HubBookmarkItem, type JobAnalysis, type JobAnalysisSummary } from '@/lib/api';
import { canUseAiFromDailyAiUsage, type DailyAiUsage } from '@/lib/ai-daily-usage';
import {
  jobDescriptionsLikelySame,
  pickAnalysisIdForListing,
  resolveExistingJobAnalysisId,
} from '@/lib/jobBoardAnalysisReuse';
import { applyUrlAnalyzePayload } from '@/lib/jobApplyUrlPick';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

const DEBOUNCE_MS = 480;

export type JobBoardAiMatchResult = {
  analysis: JobAnalysis;
  /** `reused` = hydrated from GET /jobs/:id (existing row). `fresh` = new POST /jobs/analyze. */
  matchSource: 'reused' | 'fresh';
};

/** Dedupe concurrent POST /jobs/analyze for the same board job + CV (Strict Mode / fast remounts). */
const inflightAnalyzeByKey = new Map<string, Promise<JobAnalysis>>();

function runAnalyzePostOnce(cacheKey: string, fn: () => Promise<JobAnalysis>): Promise<JobAnalysis> {
  const existing = inflightAnalyzeByKey.get(cacheKey);
  if (existing) return existing;
  const p = fn().finally(() => {
    if (inflightAnalyzeByKey.get(cacheKey) === p) inflightAnalyzeByKey.delete(cacheKey);
  });
  inflightAnalyzeByKey.set(cacheKey, p);
  return p;
}

/** GET-only: listing-scoped analyses, then global analyses + bookmarks — no POST /jobs/analyze. */
async function fetchJobBoardReuseOnlyMatch(params: {
  queryClient: QueryClient;
  discoveryJobId: string;
  cvProfileId: string;
  title: string;
  company: string;
  description: string;
}): Promise<JobBoardAiMatchResult | null> {
  const { queryClient, discoveryJobId, cvProfileId, title, company, description } = params;
  const cv = cvProfileId.trim();

  let listingRows: JobAnalysisSummary[] = [];
  try {
    listingRows = await queryClient.ensureQueryData({
      queryKey: queryKeys.jobs.analysesListing(discoveryJobId),
      queryFn: () => api.jobs.listAnalyses({ jobListingId: discoveryJobId }),
    });
  } catch {
    listingRows = [];
  }

  const listingPick = pickAnalysisIdForListing(listingRows, cv);
  if (listingPick) {
    try {
      const detail = await api.jobs.getJob(listingPick);
      return { analysis: detail.analysis, matchSource: 'reused' };
    } catch {
      /* fall through */
    }
  }

  let analysesFull: JobAnalysisSummary[] = [];
  try {
    analysesFull = await queryClient.ensureQueryData({
      queryKey: queryKeys.jobs.analyses(),
      queryFn: () => api.jobs.listAnalyses(),
    });
  } catch {
    analysesFull = [];
  }

  let bookmarks: HubBookmarkItem[] = [];
  try {
    bookmarks = await queryClient.ensureQueryData({
      queryKey: queryKeys.hub.bookmarks(),
      queryFn: () => api.jobDiscovery.listBookmarks(),
    });
  } catch {
    bookmarks = [];
  }

  const existingId = resolveExistingJobAnalysisId({
    cvProfileId: cv,
    discoveryJobId,
    title,
    company,
    analyses: analysesFull,
    bookmarks,
  });

  if (existingId) {
    try {
      const detail = await api.jobs.getJob(existingId);
      if (jobDescriptionsLikelySame(detail.description ?? '', description)) {
        return { analysis: detail.analysis, matchSource: 'reused' };
      }
    } catch {
      /* no reuse */
    }
  }

  return null;
}

/**
 * After the user settles on a discovery job, reuse GET /jobs/:id when possible, else POST /jobs/analyze once.
 * Cached by `(cvProfileId, discoveryJobId)`. Debounced so skimming the list does not burn tokens.
 *
 * When daily AI quota is exceeded, still hydrates an existing saved analysis via GET-only reuse; only then
 * falls back to POST /jobs/match-score (heuristic). Never surfaces cached match-score when the user has quota.
 *
 * Board preview POST uses `persistAnalysis: false` only (heuristic response; server ignores model flags on this path).
 */
export function useJobBoardAiMatch(opts: {
  discoveryJobId: string;
  cvProfileId?: string | null;
  title: string;
  company: string;
  description: string;
  /** Validated employer posting URL from listing detail (POST /jobs/analyze applyUrl). */
  listingApplyUrl?: string | null;
  /** False while job detail payload is still loading */
  jobDetailReady: boolean;
}) {
  const queryClient = useQueryClient();
  const aiUsage = useDailyAiUsage();
  const analyzeLocationPayload = useJobAnalyzeLocationPayload();

  /** Job id after debounce — only equals `discoveryJobId` once the user has paused on that job. */
  const [debouncedJobId, setDebouncedJobId] = useState('');

  useEffect(() => {
    const id = opts.discoveryJobId;
    const t = window.setTimeout(() => setDebouncedJobId(id), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [opts.discoveryJobId]);

  const cv = opts.cvProfileId?.trim() ?? '';
  const desc = opts.description.trim();
  const descOk = desc.length >= 30;
  const usageOk = !aiUsage.isLoading && canUseAiFromDailyAiUsage(aiUsage);
  const settledOnJob = debouncedJobId === opts.discoveryJobId && opts.discoveryJobId.length > 0;

  const quotaHit = !aiUsage.isLoading && !canUseAiFromDailyAiUsage(aiUsage);

  const enabled = Boolean(
    opts.jobDetailReady && settledOnJob && cv && descOk && usageOk,
  );

  const queryKey = useMemo(
    () => queryKeys.jobs.boardAiMatch(cv, opts.discoveryJobId),
    [cv, opts.discoveryJobId],
  );

  const inflightKey = `${cv}\u001f${opts.discoveryJobId}`;

  const overQuotaReuseEnabled = Boolean(
    quotaHit && opts.jobDetailReady && settledOnJob && cv,
  );

  const overQuotaReuseQuery = useQuery({
    queryKey: queryKeys.jobs.boardOverQuotaReuse(cv, opts.discoveryJobId),
    queryFn: () =>
      fetchJobBoardReuseOnlyMatch({
        queryClient,
        discoveryJobId: opts.discoveryJobId,
        cvProfileId: cv,
        title: opts.title,
        company: opts.company,
        description: opts.description,
      }),
    enabled: overQuotaReuseEnabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const savedAnalysisOverQuota = overQuotaReuseQuery.data;
  const hasSavedAnalysisOverQuota = Boolean(
    savedAnalysisOverQuota &&
      typeof savedAnalysisOverQuota.analysis?.matchScore === 'number' &&
      Number.isFinite(savedAnalysisOverQuota.analysis.matchScore),
  );

  const overQuotaReuseSettled =
    !overQuotaReuseEnabled ||
    overQuotaReuseQuery.isSuccess ||
    overQuotaReuseQuery.isError;

  const quotaFitEnabled = Boolean(
    quotaHit &&
      opts.jobDetailReady &&
      settledOnJob &&
      cv &&
      desc.length >= 20 &&
      overQuotaReuseSettled &&
      !hasSavedAnalysisOverQuota,
  );

  const quotaFitQuery = useQuery({
    queryKey: queryKeys.jobs.boardQuotaFit(cv, opts.discoveryJobId, desc.slice(0, 2400)),
    queryFn: () =>
      api.jobs.matchScore({
        description: opts.description,
        title: opts.title,
        company: opts.company,
        cvProfileId: cv,
      }),
    enabled: quotaFitEnabled,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 6,
    retry: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<JobBoardAiMatchResult> => {
      const reused = await fetchJobBoardReuseOnlyMatch({
        queryClient,
        discoveryJobId: opts.discoveryJobId,
        cvProfileId: cv,
        title: opts.title,
        company: opts.company,
        description: opts.description,
      });
      if (reused) return reused;

      const analysis = await runAnalyzePostOnce(inflightKey, () =>
        api.jobs.analyze({
          title: opts.title,
          company: opts.company,
          description: opts.description,
          applicationQuestions: [],
          cvProfileId: cv,
          jobListingId: opts.discoveryJobId.trim(),
          ...applyUrlAnalyzePayload(opts.listingApplyUrl),
          persistAnalysis: false,
          ...analyzeLocationPayload,
        }),
      );

      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });

      if (!analysis.reusedExistingAnalysis && analysis.scoreSource !== 'heuristic') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
        invalidateTodayPlanQueries(queryClient);
      }

      return {
        analysis,
        matchSource: analysis.reusedExistingAnalysis === true ? 'reused' : 'fresh',
      };
    },
    enabled,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const isDebouncing = Boolean(opts.discoveryJobId && !settledOnJob);

  const savedAnalysisOverQuotaMasked = quotaHit ? savedAnalysisOverQuota : undefined;
  const overQuotaReuseFetching = Boolean(quotaHit && overQuotaReuseQuery.isFetching);

  return {
    ...query,
    isDebouncing,
    /** Saved AI analysis hydrated while over daily quota (GET-only). Undefined when not in quota. */
    savedAnalysisOverQuota: savedAnalysisOverQuotaMasked,
    overQuotaReuseFetching,
    quotaFitScore: quotaFitEnabled ? quotaFitQuery.data : undefined,
    quotaFitFetching: quotaFitEnabled ? quotaFitQuery.isFetching : false,
    quotaFitError: quotaFitEnabled ? quotaFitQuery.isError : false,
  };
}

export function jobBoardAiMatchDisabledReason(
  aiUsage: DailyAiUsage,
  cvProfileId: string | null | undefined,
  description: string,
): 'no_cv' | 'short_jd' | 'quota' | null {
  if (!cvProfileId?.trim()) return 'no_cv';
  if (!aiUsage.isLoading && !canUseAiFromDailyAiUsage(aiUsage)) return 'quota';
  if (description.trim().length < 30) return 'short_jd';
  return null;
}

/** POST /jobs/match-score needs at least 20 characters of job description. */
export function jobBoardQuotaFitBlockedReason(description: string): 'short_jd' | null {
  return description.trim().length < 20 ? 'short_jd' : null;
}
