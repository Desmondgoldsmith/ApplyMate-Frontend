'use client';

import { queryKeys } from '@/lib/queryKeys';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useBreadcrumbTrail } from '@/components/dashboard/BreadcrumbContext';
import { CareerPremiumBanner } from '@/components/job-hub/CareerPremiumBanner';
import { HubPipelineStrip } from '@/components/dashboard/HubPipelineStrip';
import { JobHubNextBestAction } from '@/components/job-hub/JobHubNextBestAction';
import {
  PlacementVerificationModal,
  type VerificationUiStatus,
} from '@/components/job-hub/PlacementVerificationModal';
import { ShareAchievementModal } from '@/components/job-hub/ShareAchievementModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useCareerDashboard } from '@/hooks/useCareerDashboard';
import { pickNextBestAction } from '@/lib/jobHubNextAction';
import type { CareerBadge } from '@/lib/career';
import { ListPagination } from '@/components/ui/ListPagination';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { useToast } from '@/components/ui/Toast';
import { useApplications } from '@/hooks/useApplications';
import { useIsMaxLg } from '@/hooks/useIsMaxLg';
import { useUpdateApplicationStatus } from '@/hooks/useApplicationMutations';
import { useHubBookmarks } from '@/hooks/useHubBookmarks';
import { useJobHistory } from '@/hooks/useJobHistory';
import { api, type ApplicationTrackerStatus } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { invalidateGrowthQueries } from '@/hooks/useGrowth';
import {
  invalidateNotificationList,
  scheduleUnreadNotificationCountInvalidate,
} from '@/hooks/useNotifications';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { useClientPagination } from '@/hooks/useClientPagination';
import { cn } from '@/lib/utils';

import { JobHubDetailPanel } from './JobHubDetailPanel';
import { JobHubKanban } from './JobHubKanban';
import { JobHubSidebar } from './JobHubSidebar';
import { JobHubTable } from './JobHubTable';
import {
  archivePayloadForTrackedJob,
  clearStageOverride,
  hubStageToApplicationStatus,
  hubStageToHubPipelineStage,
  loadStageOverrides,
  mergeTrackedJobs,
  saveStageOverride,
  type HubStage,
  type TrackedJob,
} from './jobHubMerge';
import { coalesceJobHubEmailTemplateQueryParam } from './jobHubEmailTemplates';
import { useHubRemindersPrefetch } from '@/hooks/useHubReminders';
import { useJobHubLegacyMigration } from '@/hooks/useJobHubLegacyMigration';
import { notifyDueHubRemindersFromCache } from '@/lib/hubReminderNotifications';
import { prefillJobAnalyzerInStorage } from '@/lib/jobHubPrefill';
import { trackFunnelEvent } from '@/lib/actionFunnel';

type HubView = 'board' | 'list';
type HubDetailTab = 'analysis' | 'description' | 'cover' | 'notes' | 'email' | 'resume';

export function JobHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTrailSuffix } = useBreadcrumbTrail();
  const queryClient = useQueryClient();
  const toast = useToast();
  const apps = useApplications();
  const history = useJobHistory({ includeAccepted: true });
  const hubBookmarks = useHubBookmarks();
  const updateStatus = useUpdateApplicationStatus();
  const patchBookmarkPipeline = useMutation({
    mutationFn: (args: { bookmarkId: string; hubPipelineStage: ReturnType<typeof hubStageToHubPipelineStage> }) =>
      api.jobDiscovery.patchBookmark(args.bookmarkId, { hubPipelineStage: args.hubPipelineStage }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.remindersRoot() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.career.dashboard() });
      invalidateGrowthQueries(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const patchJobPipeline = useMutation({
    mutationFn: (args: {
      jobAnalysisId: string;
      stage: ReturnType<typeof hubStageToHubPipelineStage>;
      overrideKey: string;
    }) => api.jobs.patchPipeline(args.jobAnalysisId, { stage: args.stage }),
    onSuccess: (_data, args) => {
      clearStageOverride(args.overrideKey);
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[args.overrideKey];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analysis(args.jobAnalysisId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.remindersRoot() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.career.dashboard() });
      invalidateGrowthQueries(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
  const isMaxLg = useIsMaxLg();

  const [overrides, setOverrides] = useState<Record<string, HubStage>>({});
  const [dueUiTick, setDueUiTick] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HubStage | 'all'>('all');
  const [shareModal, setShareModal] = useState<{
    badge: CareerBadge | null;
    title: string;
    company: string;
  } | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationUiStatus>('none');
  const careerQ = useCareerDashboard(true);
  const [view, setView] = useState<HubView>('board');
  const [mobileDetailCollapsed, setMobileDetailCollapsed] = useState(false);
  const [careerRailOpen, setCareerRailOpen] = useState(false);

  useEffect(() => {
    setOverrides(loadStageOverrides());
  }, []);

  useEffect(() => {
    const tick = () => {
      notifyDueHubRemindersFromCache(queryClient);
      setDueUiTick((x) => x + 1);
    };
    tick();
    const id = window.setInterval(tick, 8_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [queryClient]);

  const merged = useMemo(
    () => mergeTrackedJobs(apps.data ?? [], history.data ?? [], overrides, hubBookmarks.data ?? []),
    [apps.data, history.data, overrides, hubBookmarks.data],
  );

  const hubDataReady =
    apps.isSuccess && history.isSuccess && hubBookmarks.isSuccess;
  const { needsSync, migrationFailed, retryMigration, retrying } =
    useJobHubLegacyMigration(merged, hubDataReady);
  useHubRemindersPrefetch();

  const [detailJobPin, setDetailJobPin] = useState<TrackedJob | null>(null);

  const selectedJob = useMemo(() => {
    const jid = searchParams.get('jobId')?.trim() || searchParams.get('jobAnalysisId')?.trim();
    const aid = searchParams.get('applicationId')?.trim();
    const bid = searchParams.get('bookmarkId')?.trim();
    const jlid = searchParams.get('jobListingId')?.trim();
    const rawKey = searchParams.get('jobKey')?.trim();
    if (jid) return merged.find((j) => j.jobAnalysisId === jid) ?? null;
    if (aid) return merged.find((j) => j.applicationId === aid) ?? null;
    if (bid) return merged.find((j) => (j.hubBookmarkId ?? '').trim() === bid) ?? null;
    if (jlid) return merged.find((j) => (j.boardDiscoveryId ?? '').trim() === jlid) ?? null;
    if (rawKey) return merged.find((j) => j.key === rawKey) ?? null;
    return null;
  }, [merged, searchParams]);

  const detailJob = useMemo(() => {
    const jid = searchParams.get('jobId')?.trim() || searchParams.get('jobAnalysisId')?.trim();
    const rawKey = searchParams.get('jobKey')?.trim();
    const bid = searchParams.get('bookmarkId')?.trim();
    const aid = searchParams.get('applicationId')?.trim();
    const jlid = searchParams.get('jobListingId')?.trim();

    const pinMatches =
      detailJobPin != null &&
      ((jid && detailJobPin.jobAnalysisId === jid) ||
        (rawKey && detailJobPin.key === rawKey) ||
        (bid && (detailJobPin.hubBookmarkId ?? '').trim() === bid) ||
        (aid && detailJobPin.applicationId === aid) ||
        (jlid && (detailJobPin.boardDiscoveryId ?? '').trim() === jlid));

    if (pinMatches) return detailJobPin;
    if (selectedJob) return selectedJob;
    return null;
  }, [selectedJob, detailJobPin, searchParams]);

  useEffect(() => {
    if (selectedJob) setDetailJobPin(selectedJob);
  }, [selectedJob]);
  const legacyFollowUpFocus = useMemo(() => {
    const f = (searchParams.get('focus') ?? '').trim().toLowerCase();
    return f === 'followup' || f === 'follow_up' || f === 'follow-up';
  }, [searchParams]);

  const requestedEmailTemplate = useMemo(() => {
    const fromQuery = coalesceJobHubEmailTemplateQueryParam(searchParams.get('template'));
    if (fromQuery) return fromQuery;
    if (legacyFollowUpFocus) return coalesceJobHubEmailTemplateQueryParam('follow-up-no-response');
    return undefined;
  }, [searchParams, legacyFollowUpFocus]);

  const requestedTab = useMemo<HubDetailTab | undefined>(() => {
    const t = (searchParams.get('tab') ?? '').trim().toLowerCase();
    if (t === 'email-templates') return 'email';
    if (t === 'analysis' || t === 'description' || t === 'cover' || t === 'notes' || t === 'email' || t === 'resume') {
      return t;
    }
    if (legacyFollowUpFocus) return 'email';
    if (requestedEmailTemplate) return 'email';
    return undefined;
  }, [searchParams, legacyFollowUpFocus, requestedEmailTemplate]);

  useEffect(() => {
    setMobileDetailCollapsed(false);
  }, [detailJob?.key]);

  useEffect(() => {
    if (!detailJob) {
      setTrailSuffix(null);
      return;
    }
    const title = detailJob.title?.trim() || 'Job details';
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get('jobKey')?.trim()) params.set('jobKey', detailJob.key);
    setTrailSuffix([{ label: title, href: `/dashboard/jobs?${params.toString()}` }]);
    return () => setTrailSuffix(null);
  }, [detailJob, searchParams, setTrailSuffix]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (mq.matches) setMobileDetailCollapsed(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const afterSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        (j.jobAnalysisId?.toLowerCase().includes(q) ?? false),
    );
  }, [merged, search]);

  const visibleForBoard = useMemo(() => {
    if (filter === 'all') return afterSearch;
    return afterSearch.filter((j) => j.stage === filter);
  }, [afterSearch, filter]);

  const visibleForTable = visibleForBoard;
  const listPagination = useClientPagination(view === 'list' ? visibleForTable : [], 15);

  const stageCounts = useMemo(() => {
    const c: Partial<Record<HubStage, number>> = {};
    for (const j of afterSearch) {
      c[j.stage] = (c[j.stage] ?? 0) + 1;
    }
    return c;
  }, [afterSearch]);

  const nextAction = useMemo(
    () => pickNextBestAction(careerQ.data, merged),
    [careerQ.data, merged],
  );

  const openShareAchievement = useCallback(
    (badge: CareerBadge | null, title?: string, company?: string) => {
      setShareModal({
        badge,
        title: title?.trim() || 'Your new role',
        company: company?.trim() || '—',
      });
    },
    [],
  );

  const detailCareerProps = useCallback(
    (job: TrackedJob) =>
      job.stage === 'accepted'
        ? {
            onShareWin: () => openShareAchievement(null, job.title, job.company),
            onVerifyPlacement: () => setVerifyOpen(true),
            verificationStatus,
          }
        : {},
    [openShareAchievement, verificationStatus],
  );

  const markAcceptedMutation = useMutation({
    mutationFn: (args: { jobAnalysisId: string; title: string; company: string }) =>
      api.jobs.markAccepted(args.jobAnalysisId),
    onSuccess: (data, vars) => {
      setOverrides((prev) => ({ ...prev, [vars.jobAnalysisId]: 'accepted' }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.career.dashboard() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analysis(vars.jobAnalysisId) });
      openShareAchievement(data.badge, vars.title, vars.company);
    },
    onError: (e) => toast.error(getApiErrorMessage(e) || 'Could not mark as accepted'),
  });

  const handleAcceptedStage = useCallback(
    (job: TrackedJob) => {
      const acceptedJob: TrackedJob = { ...job, stage: 'accepted' };
      setDetailJobPin(acceptedJob);
      setOverrides((prev) => ({ ...prev, [job.key]: 'accepted' }));
      const params = new URLSearchParams(searchParams.toString());
      if (acceptedJob.jobAnalysisId) params.set('jobId', acceptedJob.jobAnalysisId);
      else if (acceptedJob.applicationId) params.set('applicationId', acceptedJob.applicationId);
      else if (acceptedJob.hubBookmarkId) params.set('bookmarkId', acceptedJob.hubBookmarkId);
      else if (acceptedJob.boardDiscoveryId) params.set('jobListingId', acceptedJob.boardDiscoveryId);
      params.set('jobKey', acceptedJob.key);
      router.replace(`/dashboard/jobs?${params.toString()}`, { scroll: false });
      const jobAnalysisId = job.jobAnalysisId?.trim();
      if (jobAnalysisId) {
        markAcceptedMutation.mutate({ jobAnalysisId, title: job.title, company: job.company });
      } else if (job.hubBookmarkId) {
        patchBookmarkPipeline.mutate({
          bookmarkId: job.hubBookmarkId,
          hubPipelineStage: 'accepted',
        });
        setShareModal({ badge: null, title: job.title, company: job.company });
      } else {
        window.setTimeout(() => {
          openShareAchievement(null, job.title, job.company);
        }, 900);
      }
    },
    [markAcceptedMutation, openShareAchievement, patchBookmarkPipeline, router, searchParams],
  );

  const applyStageChange = useCallback(
    (job: TrackedJob, stage: HubStage) => {
      if (stage === job.stage) return;

      if (stage === 'accepted') {
        handleAcceptedStage(job);
        return;
      }

      saveStageOverride(job.key, stage);
      setOverrides((prev) => ({ ...prev, [job.key]: stage }));

      const pipeline = hubStageToHubPipelineStage(stage);

      if (job.applicationId) {
        const apiStatus = hubStageToApplicationStatus(stage);
        if (apiStatus) {
          updateStatus.mutate({
            id: job.applicationId,
            status: apiStatus as ApplicationTrackerStatus,
          });
        }
        if (job.jobAnalysisId) {
          patchJobPipeline.mutate({
            jobAnalysisId: job.jobAnalysisId,
            stage: pipeline,
            overrideKey: job.key,
          });
        }
        return;
      }

      /** Proactive dashboard prep needs Application.status=applied + jobAnalysisId, not pipeline alone. */
      if (stage === 'applied' && job.jobAnalysisId) {
        void api.applications
          .create({
            title: job.title,
            company: job.company,
            status: 'applied',
            matchScore: job.matchScore ?? undefined,
            jobAnalysisId: job.jobAnalysisId,
          })
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
            invalidateTodayPlanQueries(queryClient);
          })
          .catch((err) => {
            toast.error(
              getApiErrorMessage(err) ||
                'Could not save application status — interview prep may not appear on your dashboard yet.',
            );
          });
      }

      if (job.hubBookmarkId) {
        patchBookmarkPipeline.mutate(
          { bookmarkId: job.hubBookmarkId, hubPipelineStage: pipeline },
          {
            onSuccess: () => {
              clearStageOverride(job.key);
              setOverrides((prev) => {
                const next = { ...prev };
                delete next[job.key];
                return next;
              });
            },
          },
        );
        return;
      }

      if (job.jobAnalysisId) {
        patchJobPipeline.mutate({
          jobAnalysisId: job.jobAnalysisId,
          stage: pipeline,
          overrideKey: job.key,
        });
      }
    },
    [handleAcceptedStage, patchBookmarkPipeline, patchJobPipeline, queryClient, toast, updateStatus],
  );

  const openJob = useCallback(
    (j: TrackedJob) => {
      setMobileDetailCollapsed(false);
      const p = new URLSearchParams();
      if (j.jobAnalysisId) p.set('jobId', j.jobAnalysisId);
      else if (j.applicationId) p.set('applicationId', j.applicationId);
      else p.set('jobKey', j.key);
      router.push(`/dashboard/jobs?${p.toString()}`);
    },
    [router],
  );

  const prefetchJob = useCallback(
    (j: TrackedJob) => {
      if (j.jobAnalysisId) {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.jobs.analysis(j.jobAnalysisId),
          queryFn: () => api.jobs.getJob(j.jobAnalysisId!),
        });
      }
      if (j.boardDiscoveryId) {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.jobs.discoveryDetail(j.boardDiscoveryId),
          queryFn: () => api.jobDiscovery.getDetail(j.boardDiscoveryId!),
        });
      }
      trackFunnelEvent('jobhub_row_prefetched', {
        jobKey: j.key,
        jobAnalysisId: j.jobAnalysisId ?? null,
        jobListingId: j.boardDiscoveryId ?? null,
      });
      void api.dashboard.prefetchNextActions({
        ...(j.jobAnalysisId ? { jobAnalysisIds: [j.jobAnalysisId] } : {}),
        ...(j.boardDiscoveryId ? { jobListingIds: [j.boardDiscoveryId] } : {}),
      });
    },
    [queryClient],
  );

  const closeJob = useCallback(() => {
    setMobileDetailCollapsed(false);
    router.push('/dashboard/jobs');
  }, [router]);

  const closeDetailPanel = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setMobileDetailCollapsed(true);
      return;
    }
    closeJob();
  }, [closeJob]);

  const hubUnbookmark = useMutation({
    mutationFn: async (listingId: string) => {
      await api.jobDiscovery.removeBookmark(listingId);
    },
    onSuccess: () => {
      toast.success('Removed from your list.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.discovery({}) });
      invalidateTodayPlanQueries(queryClient);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const archiveFromHub = useMutation({
    mutationFn: (vars: {
      payload: { bookmarkId?: string; jobAnalysisId?: string; applicationId?: string };
      jobKey: string;
    }) => api.jobs.archive(vars.payload),
    onSuccess: () => {
      toast.success('Archived. Restore anytime under Jobs workspace → Archived jobs.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.discovery({}) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.career.dashboard() });
      invalidateNotificationList(queryClient);
      scheduleUnreadNotificationCountInvalidate(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.hub.remindersRoot() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.archive() });
      invalidateGrowthQueries(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not archive'),
  });

  const archivingJobKey = archiveFromHub.isPending ? archiveFromHub.variables?.jobKey ?? null : null;

  const [hubConfirm, setHubConfirm] = useState<null | { mode: 'archive' | 'pipeline' | 'unbookmark'; job: TrackedJob }>(
    null,
  );

  const handleRemoveFromHub = useCallback(
    (job: TrackedJob, opts?: { onSuccess?: () => void }) => {
      const after = opts?.onSuccess;
      const payload = archivePayloadForTrackedJob(job);
      if (payload) {
        archiveFromHub.mutate(
          { payload, jobKey: job.key },
          {
            onSuccess: () => {
              if (selectedJob?.key === job.key) closeJob();
              after?.();
            },
          },
        );
        return;
      }
      const lid = job.boardDiscoveryId?.trim();
      if (!lid) {
        toast.error('This row cannot be removed yet.');
        return;
      }
      hubUnbookmark.mutate(lid, {
        onSuccess: () => {
          if (selectedJob?.key === job.key) closeJob();
          after?.();
        },
      });
    },
    [archiveFromHub, closeJob, hubUnbookmark, selectedJob?.key, toast],
  );

  const hubConfirmPending = Boolean(
    hubConfirm &&
      (archivingJobKey === hubConfirm.job.key ||
        (hubUnbookmark.isPending &&
          hubUnbookmark.variables === hubConfirm.job.boardDiscoveryId?.trim())),
  );

  const loading = apps.isLoading || history.isLoading || hubBookmarks.isLoading;
  const err = apps.error ?? history.error ?? hubBookmarks.error;

  if (loading) {
    return (
      <div className="w-full space-y-4 overflow-x-hidden py-1" aria-busy="true" aria-label="Loading jobs">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-white/[0.06] sm:w-56" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-white/[0.04]" />
        <div className="h-11 w-full max-w-md animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <GlowCard contentClassName="p-6">
        <p className="text-sm text-rose-200">{getApiErrorMessage(err)}</p>
        <Button className="mt-4" variant="ghost" onClick={() => router.refresh()}>
          Retry
        </Button>
      </GlowCard>
    );
  }

  const detailRequested =
    Boolean(searchParams.get('jobId')?.trim()) ||
    Boolean(searchParams.get('jobAnalysisId')?.trim()) ||
    Boolean(searchParams.get('applicationId')?.trim()) ||
    Boolean(searchParams.get('bookmarkId')?.trim()) ||
    Boolean(searchParams.get('jobListingId')?.trim()) ||
    Boolean(searchParams.get('jobKey')?.trim());

  if (detailRequested && !detailJob) {
    const fallbackHref = '/dashboard/jobs?view=active&recovered=1';
    return (
      <GlowCard contentClassName="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
        <p className="text-sm text-white/70">
          We could not reopen this exact role, but here are your recent active applications.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="ghost" className="border border-[#00C9B1]/30 text-[#00C9B1]">
            <Link href={fallbackHref}>Open active applications</Link>
          </Button>
          <Button variant="ghost" className="border border-white/12" onClick={closeJob}>
            Back to jobs
          </Button>
        </div>
      </GlowCard>
    );
  }

  if (detailJob) {
    return (
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden overflow-x-hidden rounded-2xl border border-white/[0.06] bg-[#060a0a] max-lg:max-h-[calc(100dvh-4.75rem)] lg:h-[calc(100dvh-6rem)] lg:max-h-[calc(100dvh-6rem)] lg:flex-row">
        <JobHubSidebar
          jobs={merged}
          selectedKey={detailJob.key}
          onSelect={openJob}
          onUnbookmark={handleRemoveFromHub}
          unbookmarkPendingId={hubUnbookmark.isPending ? hubUnbookmark.variables : null}
          removingJobKey={archivingJobKey}
          className={cn(
            'max-lg:shrink-0 lg:max-h-none',
            mobileDetailCollapsed
              ? 'max-lg:max-h-none max-lg:min-h-0 max-lg:flex-1'
              : 'max-lg:max-h-[min(40vh,320px)]',
          )}
        />
        {isMaxLg ? (
          <AnimatePresence initial={false}>
            {!mobileDetailCollapsed ? (
              <>
                <motion.div
                  key="job-hub-detail-backdrop"
                  role="presentation"
                  aria-hidden
                  className="fixed inset-0 z-[45] bg-black/50 lg:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  onClick={closeDetailPanel}
                />
                <motion.div
                  key={detailJob.key}
                  role="dialog"
                  aria-modal
                  aria-label="Job details"
                  className="fixed inset-x-0 bottom-0 z-[50] flex h-[min(92dvh,780px)] max-h-[min(92dvh,780px)] min-h-0 flex-col overflow-hidden rounded-t-[1.25rem] border border-[#00C9B1]/50 bg-[#060a0a] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_28px_-12px_rgba(0,201,177,0.45)] lg:hidden"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
                >
                  <JobHubDetailPanel
                    job={detailJob}
                    layoutVariant="sheet"
                    initialTab={requestedTab}
                    initialEmailTemplate={requestedEmailTemplate ?? undefined}
                    onClose={closeDetailPanel}
                    onStageChange={applyStageChange}
                    dueUiTick={dueUiTick}
                    onRequestHubArchive={(j) => setHubConfirm({ mode: 'archive', job: j })}
                    onRequestHubPipelineRemove={(j) => setHubConfirm({ mode: 'pipeline', job: j })}
                    onRequestHubUnbookmark={(j) => setHubConfirm({ mode: 'unbookmark', job: j })}
                    hubManagePending={
                      Boolean(archivingJobKey === detailJob.key) ||
                      (Boolean(detailJob.boardDiscoveryId?.trim()) &&
                        hubUnbookmark.isPending &&
                        hubUnbookmark.variables === detailJob.boardDiscoveryId?.trim())
                    }
                    {...detailCareerProps(detailJob)}
                  />
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        ) : (
          <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex">
            <JobHubDetailPanel
              job={detailJob}
              layoutVariant="stacked"
              initialTab={requestedTab}
              initialEmailTemplate={requestedEmailTemplate ?? undefined}
              className="lg:w-full"
              onClose={closeDetailPanel}
              onStageChange={applyStageChange}
              dueUiTick={dueUiTick}
              onRequestHubArchive={(j) => setHubConfirm({ mode: 'archive', job: j })}
              onRequestHubPipelineRemove={(j) => setHubConfirm({ mode: 'pipeline', job: j })}
              onRequestHubUnbookmark={(j) => setHubConfirm({ mode: 'unbookmark', job: j })}
              hubManagePending={
                Boolean(archivingJobKey === detailJob.key) ||
                (Boolean(detailJob.boardDiscoveryId?.trim()) &&
                  hubUnbookmark.isPending &&
                  hubUnbookmark.variables === detailJob.boardDiscoveryId?.trim())
              }
              {...detailCareerProps(detailJob)}
            />
          </div>
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
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          jobId={detailJob.jobAnalysisId}
          onSubmitted={({ pending, premiumActiveUntil }) => {
            if (premiumActiveUntil) setVerificationStatus('verified');
            else if (pending) setVerificationStatus('pending');
          }}
        />
        <ConfirmModal
          open={hubConfirm != null}
          onOpenChange={(open) => {
            if (!open && !hubConfirmPending) setHubConfirm(null);
          }}
          title={hubConfirm?.mode === 'unbookmark' ? 'Remove bookmark?' : hubConfirm?.mode === 'pipeline' ? 'Remove from pipeline?' : 'Archive job?'}
          description={
            hubConfirm?.mode === 'unbookmark'
              ? 'This saved listing will be removed from your hub. You can save the job again later from the job board if you change your mind.'
              : hubConfirm?.mode === 'pipeline'
                ? 'This job will leave your active Job Hub and move to Archived jobs. Related reminders and hub notifications are cleared. You can restore it from Jobs workspace → Archived jobs.'
                : 'Archive this job to your library. It leaves the active hub and appears under Archived jobs, where you can restore or permanently delete it later.'
          }
          confirmLabel={hubConfirm?.mode === 'unbookmark' ? 'Remove' : hubConfirm?.mode === 'pipeline' ? 'Remove from pipeline' : 'Archive'}
          variant={hubConfirm?.mode === 'unbookmark' ? 'danger' : 'default'}
          isPending={hubConfirmPending}
          onConfirm={() => {
            if (!hubConfirm) return;
            handleRemoveFromHub(hubConfirm.job, { onSuccess: () => setHubConfirm(null) });
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      <div className="min-w-0" data-tour="job-hub-header">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Job Hub</h1>
        <p className="mt-1 text-sm text-white/45">
          One place for saved roles, stages, notes, and emails. Use the board or list, then open a job.
          <span className="ml-1 inline-flex align-middle">
            <InfoHint text="Stages track where each role is in your pipeline. Origin and state badges show where a role came from and its current status." />
          </span>
        </p>
      </div>

      {needsSync ? (
        <GlowCard className="border-amber-400/25 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-100/95">
            {migrationFailed
              ? `Some notes or reminders on this device could not be synced: ${migrationFailed}`
              : 'Syncing notes and reminders from this device to your account…'}
          </p>
          {migrationFailed ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 border border-amber-400/30 text-xs text-amber-100"
              disabled={retrying}
              onClick={() => void retryMigration()}
            >
              {retrying ? 'Syncing…' : 'Sync notes'}
            </Button>
          ) : null}
        </GlowCard>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:min-h-[min(72vh,720px)]">
        <div className="min-h-0 min-w-0 flex-1 space-y-4 xl:overflow-y-auto xl:pr-1 app-scrollbar">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="job-hub-search">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or company…"
            className="w-full rounded-xl border border-white/12 bg-[#0c1010] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#00C9B1]/50 focus:outline-none"
            aria-label="Search jobs"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            className="h-10 shrink-0 bg-[#00C9B1] px-4 text-[#080A0A] hover:bg-[#00C9B1]"
            data-tour="job-hub-analyze-cta"
            onClick={() => {
              prefillJobAnalyzerInStorage('', '', '');
              router.push('/dashboard/jobs/analyze?clean=1');
            }}
          >
            Analyze Job
          </Button>
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
              title="Board"
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

      <HubPipelineStrip counts={stageCounts} filter={filter} onFilterChange={setFilter} />

      <div data-tour="job-hub-board">
      {merged.length === 0 ? (
        <GlowCard contentClassName="flex min-h-[240px] flex-col items-center justify-center p-6 text-center sm:min-h-[280px] sm:p-8">
          <p className="text-lg font-semibold text-white">No jobs yet</p>
          <p className="mt-2 max-w-md text-sm text-white/45">
            Bookmark a role from the job board or run an analysis — it will show up here.
          </p>
          <Button
            className="mt-6 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
            onClick={() => {
              prefillJobAnalyzerInStorage('', '', '');
              router.push('/dashboard/jobs/analyze?clean=1');
            }}
          >
            Analyze a job →
          </Button>
        </GlowCard>
      ) : view === 'board' ? (
        <JobHubKanban
          jobs={visibleForBoard}
          onStageChange={applyStageChange}
          onOpenJob={openJob}
          onPrefetchJob={prefetchJob}
          archivingJobKey={archivingJobKey}
          onRequestArchiveJob={(j) => setHubConfirm({ mode: 'archive', job: j })}
          onRequestPipelineRemoveJob={(j) => setHubConfirm({ mode: 'pipeline', job: j })}
          onRequestUnbookmarkJob={(j) => setHubConfirm({ mode: 'unbookmark', job: j })}
        />
      ) : (
        <div className="space-y-4">
          <JobHubTable
            jobs={listPagination.pageItems}
            selectedKey={selectedJob?.key ?? null}
            onOpenJob={openJob}
            onStageChange={applyStageChange}
            onPrefetchJob={prefetchJob}
            archivingJobKey={archivingJobKey}
            onRequestArchiveJob={(j) => setHubConfirm({ mode: 'archive', job: j })}
            onRequestPipelineRemoveJob={(j) => setHubConfirm({ mode: 'pipeline', job: j })}
            onRequestUnbookmarkJob={(j) => setHubConfirm({ mode: 'unbookmark', job: j })}
          />
          {listPagination.showPager ? (
            <ListPagination
              page={listPagination.page}
              totalPages={listPagination.totalPages}
              rangeStart={listPagination.rangeStart}
              rangeEnd={listPagination.rangeEnd}
              total={listPagination.total}
              onPageChange={listPagination.setPage}
            />
          ) : null}
        </div>
      )}
      </div>
        </div>

        <aside
          className={cn(
            'flex w-full shrink-0 flex-col border-white/[0.06] xl:max-h-[min(72vh,720px)] xl:border-l xl:pl-3',
            careerRailOpen ? 'xl:w-[min(100%,300px)]' : 'xl:w-11',
          )}
        >
          <button
            type="button"
            onClick={() => setCareerRailOpen((o) => !o)}
            className={cn(
              'mb-2 hidden h-9 w-9 shrink-0 items-center justify-center self-end rounded-lg border text-white/55 transition xl:flex',
              careerRailOpen
                ? 'border-white/12 hover:border-[#00C9B1]/40 hover:text-[#00C9B1]'
                : 'animate-career-rail-pulse border-[#00C9B1]/45 text-[#00C9B1] shadow-[0_0_18px_rgba(0,201,177,0.35)] hover:border-[#00C9B1] hover:text-[#00E5CC]',
            )}
            aria-expanded={careerRailOpen}
            aria-label={careerRailOpen ? 'Collapse career rail' : 'Expand career rail'}
          >
            {careerRailOpen ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden />
            )}
          </button>
          {careerRailOpen ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto app-scrollbar xl:max-h-[calc(min(72vh,720px)-2.5rem)]">
              <JobHubNextBestAction action={nextAction} />
              <CareerPremiumBanner />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCareerRailOpen(true)}
              className="hidden animate-career-rail-pulse text-[10px] font-semibold uppercase tracking-[0.12em] text-[#00C9B1]/85 [writing-mode:vertical-rl] transition hover:text-[#00E5CC] xl:block"
            >
              Career
            </button>
          )}
        </aside>
      </div>

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
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        jobId={null}
        onSubmitted={({ pending, premiumActiveUntil }) => {
          if (premiumActiveUntil) setVerificationStatus('verified');
          else if (pending) setVerificationStatus('pending');
        }}
      />
      <ConfirmModal
        open={hubConfirm != null}
        onOpenChange={(open) => {
          if (!open && !hubConfirmPending) setHubConfirm(null);
        }}
        title={hubConfirm?.mode === 'unbookmark' ? 'Remove bookmark?' : hubConfirm?.mode === 'pipeline' ? 'Remove from pipeline?' : 'Archive job?'}
        description={
          hubConfirm?.mode === 'unbookmark'
            ? 'This saved listing will be removed from your hub. You can save the job again later from the job board if you change your mind.'
            : hubConfirm?.mode === 'pipeline'
              ? 'This job will leave your active Job Hub and move to Archived jobs. Related reminders and hub notifications are cleared. You can restore it from Jobs workspace → Archived jobs.'
              : 'Archive this job to your library. It leaves the active hub and appears under Archived jobs, where you can restore or permanently delete it later.'
        }
        confirmLabel={hubConfirm?.mode === 'unbookmark' ? 'Remove' : hubConfirm?.mode === 'pipeline' ? 'Remove from pipeline' : 'Archive'}
        variant={hubConfirm?.mode === 'unbookmark' ? 'danger' : 'default'}
        isPending={hubConfirmPending}
        onConfirm={() => {
          if (!hubConfirm) return;
          handleRemoveFromHub(hubConfirm.job, { onSuccess: () => setHubConfirm(null) });
        }}
      />
    </div>
  );
}
