'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CvTailoringSidebar } from '@/components/dashboard/CvTailoringSidebar';
import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAnalyzeJob } from '@/hooks/useAnalyzeJob';
import { useJobAnalyzeLocationPayload } from '@/hooks/useJobAnalyzeLocationPayload';
import { useJobApplyUrl } from '@/hooks/useJobApplyUrl';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { useCVProfile } from '@/hooks/useCVProfile';
import { useCVProfiles } from '@/hooks/useCVProfiles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGenerateContent } from '@/hooks/useGenerateContent';
import {
  invalidateGrowthQueries,
  useConsumeImmediateGrowthFeedback,
} from '@/hooks/useGrowth';
import {
  invalidateNotificationList,
  scheduleUnreadNotificationCountInvalidate,
} from '@/hooks/useNotifications';
import { useJobHistory } from '@/hooks/useJobHistory';
import { useHubReminders } from '@/hooks/useHubReminders';
import {
  api,
  type ApplicationItem,
  type CvProfileSummary,
  type CvTailorDraft,
  type CvTailorDraftEntry,
  type JobAnalysis,
  type JobDetailForForm,
  type JobHistoryItem,
  type JobListingDto,
  type TailorMutationResponse,
} from '@/lib/api';
import { preferApiCvProfileName } from '@/lib/cv-profile-naming';
import { inferCvProfileNameFromProfile } from '@/lib/infer-cv-profile-name';
import {
  CV_SUGGESTIONS_QUERY_ROOT,
  cvSuggestionsQueryKey,
} from '@/lib/cvSuggestionsQuery';
import {
  canUseAiFromDailyAiUsage,
  DAILY_AI_LIMIT_REACHED_MESSAGE,
} from '@/lib/ai-daily-usage';
import { resolveCvProfileIdForSavedJob } from '@/lib/jobAnalysisCvContext';
import { getTailorChecklistSkills } from '@/lib/skillCoverage';
import {
  consumePrefetchByContextToken,
  FRESH_ANALYZE_PREFILL_SESSION,
} from '@/lib/jobHubPrefill';
import { axiosClient, getApiErrorMessage } from '@/lib/axios';
import {
  readJobLoopSteps,
  writeJobLoopSteps,
  type JobLoopStepState,
} from '@/lib/jobLoopSteps';
import { trackFunnelEvent } from '@/lib/actionFunnel';
import {
  trackConversionFunnelEvent,
  trackUpgradePrompted,
} from '@/lib/analytics';
import { downloadCoverLetterPdf } from '@/lib/cover-letter-pdf';
import { substituteCoverLetterCandidateName } from '@/lib/cover-letter-placeholders';
import { normalizeText } from '@/lib/normalizeText';
import { getDisplayName } from '@/lib/display-name';
import {
  canonicalWorkflowEntityId,
  markExecutionComplete,
  recordExecutionCheckpoint,
} from '@/lib/executionMemory';
import { resolveAnalysisAfterTailorMutation } from '@/lib/applyTailorMutation';
import { mergeTailorEstimatedScores } from '@/lib/tailorMatchScore';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { ensureArray } from '@/lib/ensure-array';
import { openExternalJobApplyUrl } from '@/lib/jobApplyUrl';
import { applyUrlAnalyzePayload } from '@/lib/jobApplyUrlPick';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { AnalyzerResultsLoadingShell } from '@/components/jobs/analyze/AnalyzerResultsLoadingShell';
import { CoverLetterPanel } from '@/components/jobs/analyze/CoverLetterPanel';
import { JobHubSavePanel } from '@/components/jobs/analyze/JobHubSavePanel';
import { JobInputForm } from '@/components/jobs/analyze/JobInputForm';
import { MatchScorePanel } from '@/components/jobs/analyze/MatchScorePanel';
import { NextStepsPanel } from '@/components/jobs/analyze/NextStepsPanel';
import { SkillGapPanel } from '@/components/jobs/analyze/SkillGapPanel';
import { TailoringPanel } from '@/components/jobs/analyze/TailoringPanel';
import {
  STORAGE_ANALYSIS_KEY,
  STORAGE_COMPLETED_TAILOR_KEY,
    STORAGE_FORM_KEY,
  STORAGE_LAST_JOB_ID,
  buildAnalyzerDescriptionFromListing,
  historyRowKey,
  jobAnalyzeFormSchema,
  jobHistoryItemToDetail,
  loadCompletedTailorDraft,
  loadPersistedAnalysis,
  loadPersistedForm,
  mergeJobAnalysisForApply,
  minDescriptionCharsForAnalyze,
  persistSessionSnapshot,
  readCoverLetterFromStorage,
  removeCompletedTailorDraft,
  saveCompletedTailorDraft,
  tailoringSessionFingerprint,
  writeCoverLetterToStorage,
} from '@/components/jobs/analyze/jobsAnalyzeStorage';

export function JobsAnalyzeContent() {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [coverLetterAiBaseline, setCoverLetterAiBaseline] = useState<
    string | null
  >(null);
  const [coverLetterEditing, setCoverLetterEditing] = useState(false);
  const [coverLetterDraft, setCoverLetterDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  /** Loaded job / restored session with an existing analysis — block re-running Analyze until Clear form. */
  const [viewingSavedAnalysis, setViewingSavedAnalysis] = useState(false);
  const [tailorDraft, setTailorDraft] = useState<CvTailorDraft | null>(null);
  const [tailorSidebarOpen, setTailorSidebarOpen] = useState(false);
  const [tailorSubmitting, setTailorSubmitting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [selectedSkillNames, setSelectedSkillNames] = useState<string[]>([]);
  const [scoreBeforeTailor, setScoreBeforeTailor] = useState<number | null>(
    null,
  );
  /** After rematch or when loading a tailored job — show job-fit before/after even if scores are flat or down. */
  const [tailoringCompleted, setTailoringCompleted] = useState(false);
  /** Mobile-only single-column tab switch (Analyze / Results / History). Ignored on desktop two-column layout. */
  const [mobileTab, setMobileTab] = useState<'analyze' | 'results' | 'history'>(
    'analyze',
  );
  const [isExtensionSession, setIsExtensionSession] = useState(false);
  const [returnToUrl, setReturnToUrl] = useState<string | null>(null);
  const [extensionSessionId, setExtensionSessionId] = useState<string | null>(
    null,
  );
  const [extensionTailoringComplete, setExtensionTailoringComplete] =
    useState(false);
  const [extensionTailoredCvId, setExtensionTailoredCvId] = useState<
    string | null
  >(null);

  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { navVisible, navBottomOffset } = useMobileShell();
  const mobileScrollClearance = `calc(${navBottomOffset} + 6rem)`;
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');
  const contextTokenFromUrl = searchParams.get('contextToken');
  const jobListingIdFromUrl = searchParams.get('jobListingId')?.trim() ?? '';
  const openTailorFromUrl = searchParams.get('openTailor') === '1';
  const tailorSectionFromUrl =
    searchParams.get('tailorSection')?.trim().toLowerCase() ?? '';
  const freshAnalyzerParam = searchParams.get('new');
  const cleanAnalyzerParam = searchParams.get('clean');
  const fromBoardFromUrl = searchParams.get('fromBoard') === '1';
  const cvProfileIdFromUrl = searchParams.get('cvProfileId')?.trim() ?? '';
  const sourceFromUrl = searchParams.get('source');
  const sessionIdFromUrl = searchParams.get('sessionId')?.trim() ?? '';
  const returnToFromUrl = searchParams.get('returnTo');
  const cvIdFromExtensionUrl = searchParams.get('cvId')?.trim() ?? '';

  const analyze = useAnalyzeJob();
  const generate = useGenerateContent();
  const consumeGrowthFeedback = useConsumeImmediateGrowthFeedback();
  const aiUsage = useDailyAiUsage();
  const history = useJobHistory();
  const { data: me } = useCurrentUser();
  const { data: cv, isPending: cvProfilePending } = useCVProfile();
  const { data: cvProfilesData, isPending: cvProfilesPending } =
    useCVProfiles();
  const cvProfiles = cvProfilesData?.rows ?? [];
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const analyzeLocationPayload = useJobAnalyzeLocationPayload(
    selectedProfileId && cv?.id === selectedProfileId ? cv.location : null,
  );
  const storeUser = useAuthStore((s) => s.user);
  const activeJobId = useUIStore((s) => s.activeJobId);
  const setActiveJobId = useUIStore((s) => s.setActiveJobId);

  const candidateDisplayName = getDisplayName(me ?? storeUser);

  /** Synchronous snapshot for mergeJobAnalysisForApply (setState updaters are not reliable for reading merged output). */
  const analysisMergeRef = useRef<JobAnalysis | null>(null);
  /** Locked at tailor start — never replaced by optimistic server rematch scores. */
  const tailorBaselineScoreRef = useRef<number | null>(null);
  /** From Job Hub “Analyze” prefill — PATCH bookmark after first successful analyze. */
  const pendingHubBookmarkIdRef = useRef<string | null>(null);
  const listingAutoAnalyzeRef = useRef(false);
  const extensionBootstrapRef = useRef(false);
  const extensionAutoTailorPendingRef = useRef(false);
  const extensionCompleteCalledRef = useRef(false);
  /** When init loads job-board listing into the form, URL may still hold jobListingId; also used if URL is stripped early. */
  const analyzeJobListingIdRef = useRef<string | null>(null);
  /** Employer posting URL from GET /job-discovery/:id — sent on POST /jobs/analyze when known. */
  const analyzeListingApplyUrlRef = useRef<string | null>(null);
  /** Prevents listing auto-analyze effects from re-firing after a successful run (stops request + growth toast loops). */
  const listingPipelineAutoDoneRef = useRef<string | null>(null);
  /** Prevents repeated GET /job-discovery/:id when bootstrap effect re-runs (e.g. dependency churn). */
  const jobListingBootstrapDoneRef = useRef<string | null>(null);
  /** Auto full analysis once when opening analyzer from job board with ?jobId& */
  const jobIdFromBoardAutoRanRef = useRef<string | null>(null);
  const [aiReportPending, setAiReportPending] = useState(false);
  /** After listing hydrate from Job Board: show results-panel skeleton until AI analyze finishes. */
  const [awaitingListingAnalysis, setAwaitingListingAnalysis] = useState(false);

  const skillsInitKey = useMemo(() => {
    if (!analysis) return 'no-analysis';
    return `${analysis.id ?? 'no-id'}|${getTailorChecklistSkills(analysis)
      .map((s) => `${s.name}:${s.importance}`)
      .join(';')}`;
  }, [analysis]);

  useEffect(() => {
    const skills = analysis ? getTailorChecklistSkills(analysis) : [];
    if (skills.length === 0) {
      setSelectedSkillNames([]);
      return;
    }
    const criticalHigh = skills
      .filter((s) => s.importance === 'CRITICAL' || s.importance === 'HIGH')
      .map((s) => s.name);
    /** If the API only returns MEDIUM/LOW gaps, nothing was auto-selected — select all gaps so Tailor stays usable. */
    setSelectedSkillNames(
      criticalHigh.length > 0 ? criticalHigh : skills.map((s) => s.name),
    );
  }, [skillsInitKey, analysis]);

  const toggleSkillSelected = useCallback((name: string) => {
    setSelectedSkillNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }, []);

  /** Session-restored analyses often lack `id`; resolve it from Recent analyses once the list loads. */
  useEffect(() => {
    if (!hydrated) return;
    setAnalysis((prev) => {
      if (!prev || (prev.id ?? '').trim()) return prev;
      const t = title.trim();
      const c = company.trim();
      if (!t && !c) return prev;

      const items = ensureArray<JobHistoryItem>(history.data ?? []);
      const key = historyRowKey(t, c);
      const candidates = items.filter((item) => {
        const id = (item.id ?? '').trim();
        if (!id) return false;
        const jt = (item.jobTitle || item.title || '').trim();
        const jc = (item.company ?? '').trim();
        return historyRowKey(jt, jc) === key;
      });
      if (candidates.length === 0) return prev;

      const scoreMatch = candidates.find(
        (x) => Math.round(x.matchScore) === Math.round(prev.matchScore ?? NaN),
      );
      const sorted = [...candidates].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
      const pick = scoreMatch ?? sorted[0]!;
      return { ...prev, id: pick.id };
    });
  }, [hydrated, title, company, history.data]);

  useEffect(() => {
    analysisMergeRef.current = analysis;
  }, [analysis]);

  /** When results arrive (fresh analyze or loading a saved job), surface them on mobile. */
  const mobileResultsAutoShownRef = useRef<string | null>(null);
  useEffect(() => {
    const id = analysis?.id?.trim() || null;
    if (id && mobileResultsAutoShownRef.current !== id) {
      mobileResultsAutoShownRef.current = id;
      setMobileTab('results');
    }
    if (!id) mobileResultsAutoShownRef.current = null;
  }, [analysis?.id]);

  const cvBootstrapPending = cvProfilePending || cvProfilesPending;

  const cvProfileIdForTailor = useMemo(() => {
    const tailored = analysis?.tailoredCvProfileId?.trim();
    if (analysis?.isTailored && tailored) return tailored;
    const draftCv =
      tailorDraft?.jobAnalysisId === (analysis?.id ?? '').trim()
        ? tailorDraft.cvProfileId?.trim()
        : '';
    if (draftCv) return draftCv;
    return (selectedProfileId ?? cv?.id ?? '').trim();
  }, [
    analysis?.id,
    analysis?.isTailored,
    analysis?.tailoredCvProfileId,
    cv?.id,
    selectedProfileId,
    tailorDraft?.cvProfileId,
    tailorDraft?.jobAnalysisId,
  ]);
  const jobAnalysisIdForTailor = (analysis?.id ?? '').trim();
  const jobListingIdForTailor = (
    analysis?.jobListingId ??
    jobListingIdFromUrl ??
    ''
  ).trim();
  /**
   * Fingerprint for "reset tailor when JD / selected CV changes" only.
   * Must NOT incorporate `tailorDraft` or draft-derived cv ids — otherwise creating a draft updates
   * `cvProfileIdForTailor`, changes the fingerprint, and the effect below clears the draft and closes the sidebar.
   */
  const tailoringFormProfileId = useMemo(
    () => (selectedProfileId ?? cv?.id ?? '').trim(),
    [selectedProfileId, cv?.id],
  );
  const tailoringFp = useMemo(
    () =>
      tailoringSessionFingerprint(
        tailoringFormProfileId,
        title,
        company,
        description,
      ),
    [tailoringFormProfileId, title, company, description],
  );
  const tailoringFpRef = useRef<string | null>(null);
  const tailorAiBlocked =
    !aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0;

  const tailorMutationRefs = useMemo(
    () => ({
      tailorBaselineScoreRef,
      setScoreBeforeTailor,
      mergeJobAnalysisForApply,
    }),
    [],
  );

  const applyTailorMutation = useCallback(
    (result: TailorMutationResponse) => {
      const mergedDraft: CvTailorDraft = {
        ...result.draft,
        jobAnalysisId:
          (result.draft.jobAnalysisId ?? '').trim() ||
          (analysis?.id ?? '').trim() ||
          result.draft.jobAnalysisId,
        cvProfileId:
          (result.draft.cvProfileId ?? '').trim() ||
          cvProfileIdForTailor ||
          result.draft.cvProfileId,
      };
      setTailorDraft(mergedDraft);
      setAnalysis((prev) => {
        const next = resolveAnalysisAfterTailorMutation(
          prev,
          { ...result, draft: mergedDraft },
          tailorMutationRefs,
        );
        if (!next) return prev;
        analysisMergeRef.current = next;
        persistSessionSnapshot(title, company, description, next);
        queryClient.setQueryData(queryKeys.jobs.analysisCurrent(), next);
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
        return next;
      });
    },
    [
      analysis?.id,
      company,
      cvProfileIdForTailor,
      description,
      queryClient,
      tailorMutationRefs,
      title,
    ],
  );

  const handleCreateTailorDraft = useCallback(async () => {
    if (tailorAiBlocked || !canUseAiFromDailyAiUsage(aiUsage)) {
      trackUpgradePrompted('job_analyzer_tailor');
      toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
      return;
    }
    if (!cvProfileIdForTailor || !jobAnalysisIdForTailor) {
      toast.error(
        'Run a full job analysis first so we can tailor your CV to this role.',
      );
      return;
    }
    if (selectedSkillNames.length === 0) {
      toast.error('Select at least one skill gap to tailor toward.');
      return;
    }
    setTailorSubmitting(true);
    try {
      const result = await api.cv.createTailorDraft({
        cvProfileId: cvProfileIdForTailor,
        jobAnalysisId: jobAnalysisIdForTailor,
        selectedSkills: selectedSkillNames,
      });
      const baseline =
        analysis?.matchScore != null && Number.isFinite(analysis.matchScore)
          ? Math.round(analysis.matchScore)
          : null;
      if (baseline != null) {
        tailorBaselineScoreRef.current = baseline;
        setScoreBeforeTailor(baseline);
      } else {
        tailorBaselineScoreRef.current = null;
        setScoreBeforeTailor(null);
      }
      setTailoringCompleted(false);
      applyTailorMutation({
        ...result,
        draft: {
          ...result.draft,
          jobAnalysisId:
            (result.draft.jobAnalysisId ?? '').trim() || jobAnalysisIdForTailor,
          cvProfileId:
            (result.draft.cvProfileId ?? '').trim() || cvProfileIdForTailor,
        },
      });
      trackConversionFunnelEvent('cv_tailored', {
        jobAnalysisId: jobAnalysisIdForTailor,
        cvProfileId: cvProfileIdForTailor,
        skillCount: selectedSkillNames.length,
      });
      /** Open after draft state is committed so fingerprint / effects do not clear the session in the same tick. */
      queueMicrotask(() => setTailorSidebarOpen(true));
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not create tailoring draft');
    } finally {
      setTailorSubmitting(false);
    }
  }, [
    tailorAiBlocked,
    aiUsage,
    analysis?.matchScore,
    cvProfileIdForTailor,
    jobAnalysisIdForTailor,
    applyTailorMutation,
    selectedSkillNames,
    toast,
  ]);

  const rematchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rematchJobToUpdatedCv = useCallback(async () => {
    const cvId = cvProfileIdForTailor;
    if (!cvId) return;
    const jobId = (analysis?.id ?? '').trim();
    if (!jobId) {
      toast.error(
        'Analyze this job first so we can load the saved match score.',
      );
      return;
    }
    setRematching(true);
    try {
      /** GET rematch only — do not POST /jobs/analyze here (would re-run AI and can change scores). */
      const detail = await api.jobs.getJob(jobId);
      const merged = mergeJobAnalysisForApply(
        analysisMergeRef.current,
        detail.analysis,
      );
      const analysisIdRematch = (merged.id ?? '').trim();

      let nextDraft: CvTailorDraft | null = null;
      if (detail.tailorDraft && detail.tailorDraft.id.trim()) {
        nextDraft = {
          ...detail.tailorDraft,
          jobAnalysisId: analysisIdRematch || detail.tailorDraft.jobAnalysisId,
        };
        setTailorDraft(nextDraft);
        setTailoringCompleted(
          Boolean(
            detail.tailorDraft?.status === 'completed' ||
            merged.isTailored === true,
          ),
        );
      } else {
        setTailorDraft((prevDraft) => {
          if (
            prevDraft &&
            (!analysisIdRematch ||
              prevDraft.jobAnalysisId === analysisIdRematch) &&
            (merged.isTailored === true ||
              prevDraft.status === 'completed' ||
              detail.analysis.isTailored === true)
          ) {
            nextDraft = prevDraft;
            return prevDraft;
          }
          nextDraft = null;
          return null;
        });
        setTailoringCompleted(Boolean(merged.isTailored === true));
      }

      if (tailorBaselineScoreRef.current == null) {
        const lockFrom =
          merged.scoreBeforeTailoring != null &&
          Number.isFinite(merged.scoreBeforeTailoring)
            ? merged.scoreBeforeTailoring
            : nextDraft
              ? merged.matchScore
              : null;
        if (lockFrom != null && Number.isFinite(lockFrom)) {
          tailorBaselineScoreRef.current = Math.round(lockFrom);
        }
      }

      const scored = mergeTailorEstimatedScores(
        merged,
        nextDraft,
        tailorBaselineScoreRef.current,
      );
      if (scored.lockedBaseline != null)
        tailorBaselineScoreRef.current = scored.lockedBaseline;
      setScoreBeforeTailor(scored.scoreBeforeTailor);
      analysisMergeRef.current = scored.analysis;
      setAnalysis(scored.analysis);
      setViewingSavedAnalysis(false);
      persistSessionSnapshot(title, company, description, scored.analysis);
      queryClient.setQueryData(queryKeys.jobs.analysisCurrent(), scored.analysis);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(cvId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.score(cvId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.scoreRoot() });
      void queryClient.invalidateQueries({
        queryKey: cvSuggestionsQueryKey(cvId),
      });
      void queryClient.invalidateQueries({
        queryKey: CV_SUGGESTIONS_QUERY_ROOT,
      });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.score(cvId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.scoreRoot() });
      }, 2500);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analysis(jobId) });
      invalidateTodayPlanQueries(queryClient);
      toast.success('Job match updated from your saved analysis');
    } catch (e) {
      const msg = getApiErrorMessage(e) || 'Could not refresh job match';
      toast.error(msg);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    } finally {
      setRematching(false);
    }
  }, [
    analysis?.id,
    cvProfileIdForTailor,
    description,
    queryClient,
    title,
    company,
    toast,
  ]);

  const scheduleRematchAfterTailoring = useCallback(() => {
    if (rematchDebounceRef.current) {
      clearTimeout(rematchDebounceRef.current);
    }
    rematchDebounceRef.current = setTimeout(() => {
      rematchDebounceRef.current = null;
      void rematchJobToUpdatedCv();
    }, 450);
  }, [rematchJobToUpdatedCv]);

  useEffect(() => {
    return () => {
      if (rematchDebounceRef.current) {
        clearTimeout(rematchDebounceRef.current);
        rematchDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      cvProfileIdFromUrl &&
      cvProfiles.some((p) => p.id === cvProfileIdFromUrl)
    ) {
      setSelectedProfileId(cvProfileIdFromUrl);
      return;
    }
    if (
      cvIdFromExtensionUrl &&
      cvProfiles.some((p) => p.id === cvIdFromExtensionUrl)
    ) {
      setSelectedProfileId(cvIdFromExtensionUrl);
      return;
    }
    if (selectedProfileId !== null) return;
    const defaultProfile = cvProfiles.find((p) => p.isDefault);
    if (defaultProfile) {
      setSelectedProfileId(defaultProfile.id);
      return;
    }
    if (cvProfiles.length >= 1) {
      setSelectedProfileId(cvProfiles[0]!.id);
      return;
    }
    if (cv?.id) {
      setSelectedProfileId(cv.id);
    }
  }, [cvProfileIdFromUrl, cvIdFromExtensionUrl, cvProfiles, selectedProfileId, cv?.id]);

  const selectedProfile = useMemo((): CvProfileSummary | null => {
    const hit = cvProfiles.find((p) => p.id === selectedProfileId);
    if (hit) {
      return {
        ...hit,
        name: preferApiCvProfileName(
          hit.name,
          inferCvProfileNameFromProfile(cv),
        ),
      };
    }
    if (cv?.id && selectedProfileId === cv.id) {
      return {
        id: cv.id,
        name: preferApiCvProfileName(null, inferCvProfileNameFromProfile(cv)),
        score: null,
        isDefault: true,
        template: cv.template,
        updatedAt: cv.updatedAt,
      };
    }
    return null;
  }, [cvProfiles, selectedProfileId, cv]);
  const coverLetterDisplay = useMemo(() => {
    const plain = generated != null ? normalizeText(generated as unknown) : '';
    return plain.trim()
      ? substituteCoverLetterCandidateName(plain, candidateDisplayName)
      : null;
  }, [generated, candidateDisplayName]);

  const applyDetail = useCallback((detail: JobDetailForForm) => {
    setTitle(detail.title);
    setCompany(detail.company);
    setDescription(detail.description);

    const incoming = detail.analysis;
    if (!incoming || typeof incoming !== 'object') {
      analysisMergeRef.current = null;
      setAnalysis(null);
      setTailorDraft(null);
      setScoreBeforeTailor(null);
      setTailoringCompleted(false);
      setTailorSidebarOpen(false);
      persistSessionSnapshot(
        detail.title,
        detail.company,
        detail.description,
        null,
      );
      return;
    }

    const merged = mergeJobAnalysisForApply(analysisMergeRef.current, incoming);
    analysisMergeRef.current = merged;
    setAnalysis(merged);

    const analysisId = (merged.id ?? '').trim();

    if (detail.tailorDraft && detail.tailorDraft.id.trim()) {
      setTailorDraft({
        ...detail.tailorDraft,
        jobAnalysisId: analysisId || detail.tailorDraft.jobAnalysisId,
      });
      const sbt = merged.scoreBeforeTailoring;
      setScoreBeforeTailor(sbt != null && Number.isFinite(sbt) ? sbt : null);
      setTailoringCompleted(
        Boolean(
          detail.tailorDraft?.status === 'completed' ||
          merged.isTailored === true,
        ),
      );
    } else {
      setTailorDraft((prevDraft) => {
        if (
          prevDraft &&
          (!analysisId || prevDraft.jobAnalysisId === analysisId) &&
          (merged.isTailored === true ||
            prevDraft.status === 'completed' ||
            detail.analysis.isTailored === true)
        ) {
          return prevDraft;
        }
        return null;
      });
      {
        const sbt = merged.scoreBeforeTailoring;
        setScoreBeforeTailor(sbt != null && Number.isFinite(sbt) ? sbt : null);
      }
      setTailoringCompleted(
        Boolean(
          merged.isTailored === true || detail.analysis.isTailored === true,
        ),
      );
    }
    setTailorSidebarOpen(false);
    persistSessionSnapshot(
      detail.title,
      detail.company,
      detail.description,
      merged,
    );

    const embeddedLetter = detail.generatedContent?.coverLetter?.trim();
    if (embeddedLetter) {
      setGenerated(embeddedLetter);
      setCoverLetterAiBaseline(embeddedLetter);
    }
  }, []);

  const loadJobById = useCallback(
    async (
      jobId: string,
      opts?: { clearUrl?: boolean; openTailor?: boolean },
    ) => {
      let detail: JobDetailForForm | null = null;
      let usedHistoryFallback = false;

      try {
        detail = await api.jobs.getJob(jobId);
      } catch {
        const historyKey = queryKeys.jobs.history(true);
        await queryClient.ensureQueryData({
          queryKey: historyKey,
          queryFn: () => api.jobs.getHistory({ includeAccepted: true }),
        });
        const items = ensureArray<JobHistoryItem>(
          queryClient.getQueryData<JobHistoryItem[]>(historyKey) ??
            history.data,
        );
        const item = items.find((i) => i.id === jobId);
        if (!item) {
          toast.error('Could not load this job. Try again from the list.');
          return false;
        }
        detail = jobHistoryItemToDetail(item);
        usedHistoryFallback = true;
      }

      applyDetail(detail);
      setViewingSavedAnalysis(true);
      setMobileTab('results');
      try {
        sessionStorage.setItem(STORAGE_LAST_JOB_ID, jobId);
      } catch {
        /* ignore */
      }

      const boardCv =
        fromBoardFromUrl &&
        cvProfileIdFromUrl &&
        cvProfiles.some((p) => p.id === cvProfileIdFromUrl)
          ? cvProfileIdFromUrl
          : null;
      const cvForThisAnalysis =
        boardCv ?? resolveCvProfileIdForSavedJob(detail);
      if (cvForThisAnalysis) {
        setSelectedProfileId(cvForThisAnalysis);
      }

      const embedded = detail.generatedContent?.coverLetter?.trim();
      const cachedLetter = embedded ? null : readCoverLetterFromStorage(jobId);
      if (embedded) {
        setGenerated(embedded);
        setCoverLetterAiBaseline(embedded);
      } else if (cachedLetter) {
        setGenerated(cachedLetter);
        setCoverLetterAiBaseline((prev) => prev ?? cachedLetter);
      }
      try {
        const gen = await api.jobs.getGenerated(jobId);
        const letter = normalizeText(gen.coverLetter as unknown);
        const text = letter.trim() ? letter : cachedLetter;
        setGenerated(text);
        if (letter.trim()) setCoverLetterAiBaseline(letter.trim());
        else if (!cachedLetter && !embedded) setCoverLetterAiBaseline(null);
      } catch {
        if (!cachedLetter && !embedded) {
          setGenerated(null);
          setCoverLetterAiBaseline(null);
        }
      }

      /** Stay on the analyzer route; only strip `?jobId=` so we do not bounce users to Job Hub. */
      if (opts?.clearUrl) {
        router.replace('/dashboard/jobs/analyze', { scroll: false });
      }
      setActiveJobId(null);

      if (usedHistoryFallback && !detail.description) {
        toast.error(
          'Loaded title and company. The full job description is not available from history—paste it again to generate a cover letter.',
        );
      }
      if (opts?.openTailor && detail.tailorDraft?.id?.trim()) {
        setTailorSidebarOpen(true);
      }
      return true;
    },
    [
      applyDetail,
      cvProfileIdFromUrl,
      cvProfiles,
      fromBoardFromUrl,
      history.data,
      queryClient,
      router,
      setActiveJobId,
      setSelectedProfileId,
      toast,
    ],
  );

  const sessionBootstrapped = useRef(false);
  const lastInitJobId = useRef<string | null>(null);
  const loadJobByIdRef = useRef(loadJobById);
  loadJobByIdRef.current = loadJobById;

  /** Deep-link ?jobId=, zustand activeJobId, ?new=1 for a clean analyzer session, or sessionStorage restore. */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const wantsFreshAnalyzer =
        freshAnalyzerParam === '1' || cleanAnalyzerParam === '1';

      if (wantsFreshAnalyzer) {
        lastInitJobId.current = null;
        analyzeJobListingIdRef.current = null;
        listingPipelineAutoDoneRef.current = null;
        jobListingBootstrapDoneRef.current = null;
        listingAutoAnalyzeRef.current = false;
        jobIdFromBoardAutoRanRef.current = null;
        pendingHubBookmarkIdRef.current = null;
        try {
          sessionStorage.removeItem(STORAGE_FORM_KEY);
          sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
          sessionStorage.removeItem(STORAGE_COMPLETED_TAILOR_KEY);
        } catch {
          /* ignore */
        }

        let prefillJobDescription = '';
        let prefillTitle = '';
        let prefillCompany = '';
        let openTailorFromResume = false;
        if (typeof window !== 'undefined') {
          try {
            const sessionRaw = window.sessionStorage.getItem(
              FRESH_ANALYZE_PREFILL_SESSION,
            );
            if (sessionRaw) {
              const p = JSON.parse(sessionRaw) as {
                title?: unknown;
                company?: unknown;
                description?: unknown;
                hubBookmarkId?: unknown;
                selectedCvId?: unknown;
                resumeWorkingStep?: unknown;
                sourceContext?: unknown;
              };
              const prefetch =
                consumePrefetchByContextToken(contextTokenFromUrl);
              const selectedCvIdFromPrefetch = prefetch?.selectedCvId ?? '';
              const resumeWorkingStepFromPrefetch =
                prefetch?.resumeWorkingStep ?? '';
              // Do not remove session here: React Strict Mode remounts before URL replace, and a
              // second mount must read the same payload. Clear with localStorage keys after delay.
              prefillTitle = typeof p.title === 'string' ? p.title : '';
              prefillCompany = typeof p.company === 'string' ? p.company : '';
              prefillJobDescription =
                typeof p.description === 'string' ? p.description : '';
              const hb =
                typeof p.hubBookmarkId === 'string'
                  ? p.hubBookmarkId.trim()
                  : '';
              pendingHubBookmarkIdRef.current = hb || null;
              const selectedCvId =
                selectedCvIdFromPrefetch ||
                (typeof p.selectedCvId === 'string'
                  ? p.selectedCvId.trim()
                  : '');
              if (selectedCvId) setSelectedProfileId(selectedCvId);
              const resumeWorkingStep = (
                resumeWorkingStepFromPrefetch ||
                (typeof p.resumeWorkingStep === 'string'
                  ? p.resumeWorkingStep.trim()
                  : '')
              ).toLowerCase();
              openTailorFromResume =
                resumeWorkingStep.includes('tailor') ||
                resumeWorkingStep.includes('resume');
            }
            if (
              !prefillTitle.trim() &&
              !prefillCompany.trim() &&
              !prefillJobDescription.trim()
            ) {
              prefillJobDescription =
                window.localStorage.getItem('applymate_prefill_jd') ?? '';
              prefillTitle =
                window.localStorage.getItem('applymate_prefill_title') ?? '';
              prefillCompany =
                window.localStorage.getItem('applymate_prefill_company') ?? '';
            }
            window.setTimeout(() => {
              try {
                window.sessionStorage.removeItem(FRESH_ANALYZE_PREFILL_SESSION);
                if (prefillJobDescription.trim())
                  window.localStorage.removeItem('applymate_prefill_jd');
                if (prefillTitle.trim())
                  window.localStorage.removeItem('applymate_prefill_title');
                if (prefillCompany.trim())
                  window.localStorage.removeItem('applymate_prefill_company');
              } catch {
                /* ignore */
              }
            }, 600);
          } catch {
            /* ignore */
          }
        }

        setActiveJobId(null);
        setTitle(prefillTitle.trim() ? prefillTitle : '');
        setCompany(prefillCompany.trim() ? prefillCompany : '');
        setDescription(
          prefillJobDescription.trim() ? prefillJobDescription : '',
        );
        setAnalysis(null);
        setGenerated(null);
        setViewingSavedAnalysis(false);
        setTailorDraft(null);
        setTailorSidebarOpen(openTailorFromResume);
        setError(null);
        setRematching(false);
        setScoreBeforeTailor(null);
        setTailoringCompleted(false);

        sessionBootstrapped.current = true;
        router.replace('/dashboard/jobs/analyze');
        if (!cancelled) setHydrated(true);
        return;
      }

      /** Extension "Open full analyzer" — prefill title, company, and description from query params. */
      if (sourceFromUrl === 'extension' && !sessionIdFromUrl) {
        const jobTitle = searchParams.get('jobTitle')?.trim() ?? '';
        const companyParam = searchParams.get('company')?.trim() ?? '';
        const descriptionParam = searchParams.get('description')?.trim() ?? '';
        if (jobTitle || companyParam || descriptionParam) {
          try {
            sessionStorage.removeItem(STORAGE_FORM_KEY);
            sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
            sessionStorage.removeItem(STORAGE_COMPLETED_TAILOR_KEY);
            sessionStorage.removeItem(STORAGE_LAST_JOB_ID);
          } catch {
            /* ignore */
          }
          setActiveJobId(null);
          setTitle(jobTitle);
          setCompany(companyParam);
          setDescription(descriptionParam);
          setAnalysis(null);
          setGenerated(null);
          setViewingSavedAnalysis(false);
          setTailorDraft(null);
          setTailorSidebarOpen(false);
          setError(null);
          setRematching(false);
          setScoreBeforeTailor(null);
          setTailoringCompleted(false);
          sessionBootstrapped.current = true;
          router.replace('/dashboard/jobs/analyze');
          if (!cancelled) setHydrated(true);
          return;
        }
      }

      if (sourceFromUrl === 'extension' && sessionIdFromUrl) {
        const jobTitle = searchParams.get('jobTitle')?.trim() ?? '';
        const companyParam = searchParams.get('company')?.trim() ?? '';
        const descriptionParam = searchParams.get('description')?.trim() ?? '';
        if (jobTitle) setTitle(jobTitle);
        if (companyParam) setCompany(companyParam);
        if (descriptionParam) setDescription(descriptionParam);
        if (cvIdFromExtensionUrl) setSelectedProfileId(cvIdFromExtensionUrl);
        sessionBootstrapped.current = true;
        if (!cancelled) setHydrated(true);
        return;
      }

      if (jobListingIdFromUrl && !jobIdFromUrl) {
        if (jobListingBootstrapDoneRef.current === jobListingIdFromUrl) {
          sessionBootstrapped.current = true;
          if (!cancelled) setHydrated(true);
          return;
        }
        listingAutoAnalyzeRef.current = false;
        try {
          const d = await api.jobDiscovery.getDetail(jobListingIdFromUrl);
          if (cancelled) return;
          jobListingBootstrapDoneRef.current = jobListingIdFromUrl;
          analyzeJobListingIdRef.current = jobListingIdFromUrl;
          analyzeListingApplyUrlRef.current = (d.url ?? '').trim() || null;
          setActiveJobId(null);
          setTitle((d.title ?? '').trim());
          setCompany((d.company ?? '').trim());
          setDescription(buildAnalyzerDescriptionFromListing(d));
          setAnalysis(null);
          setGenerated(null);
          setViewingSavedAnalysis(false);
          setTailorDraft(null);
          setTailorSidebarOpen(false);
          setError(null);
          setRematching(false);
          setScoreBeforeTailor(null);
          setTailoringCompleted(false);
          pendingHubBookmarkIdRef.current = null;
          sessionBootstrapped.current = true;
          setAwaitingListingAnalysis(true);
          const q = new URLSearchParams();
          q.set('jobListingId', jobListingIdFromUrl);
          if (fromBoardFromUrl) q.set('fromBoard', '1');
          if (cvProfileIdFromUrl) q.set('cvProfileId', cvProfileIdFromUrl);
          router.replace(`/dashboard/jobs/analyze?${q.toString()}`, {
            scroll: false,
          });
          if (!cancelled) setHydrated(true);
        } catch {
          analyzeJobListingIdRef.current = null;
          analyzeListingApplyUrlRef.current = null;
          jobListingBootstrapDoneRef.current = null;
          toast.error('Could not load this job listing.');
          sessionBootstrapped.current = true;
          router.replace('/dashboard/jobs/analyze', { scroll: false });
          if (!cancelled) setHydrated(true);
        }
        return;
      }

      let jobId = jobIdFromUrl ?? activeJobId ?? null;
      if (!jobId) {
        try {
          const last = sessionStorage.getItem(STORAGE_LAST_JOB_ID)?.trim();
          if (last) jobId = last;
        } catch {
          /* ignore */
        }
      }

      if (!jobId) {
        lastInitJobId.current = null;
      }

      if (jobId) {
        if (sourceFromUrl === 'extension') {
          const jobTitle = searchParams.get('jobTitle')?.trim() ?? '';
          const companyParam = searchParams.get('company')?.trim() ?? '';
          const descriptionParam = searchParams.get('description')?.trim() ?? '';
          if (jobTitle) setTitle(jobTitle);
          if (companyParam) setCompany(companyParam);
          if (descriptionParam) setDescription(descriptionParam);
        }
        if (lastInitJobId.current === jobId && sessionBootstrapped.current) {
          if (!cancelled) setHydrated(true);
          return;
        }
        const loaded = await loadJobByIdRef.current(jobId, {
          clearUrl: Boolean(jobIdFromUrl),
          openTailor: Boolean(jobIdFromUrl && openTailorFromUrl),
        });
        if (cancelled) return;
        if (loaded) lastInitJobId.current = jobId;
        sessionBootstrapped.current = true;
        if (!cancelled) setHydrated(true);
        return;
      }

      const form = loadPersistedForm();
      const persistedAnalysis = loadPersistedAnalysis();
      const hasSessionWork =
        Boolean(persistedAnalysis?.id) ||
        form.description.trim().length > 0 ||
        form.title.trim().length > 0 ||
        form.company.trim().length > 0;

      const bareAnalyzer =
        !(jobIdFromUrl ?? '').trim() &&
        !jobListingIdFromUrl &&
        freshAnalyzerParam !== '1' &&
        cleanAnalyzerParam !== '1' &&
        !(contextTokenFromUrl ?? '').trim() &&
        !(activeJobId ?? '').trim();

      if (sessionBootstrapped.current) return;
      sessionBootstrapped.current = true;

      if (bareAnalyzer && !hasSessionWork) {
        try {
          sessionStorage.removeItem(STORAGE_FORM_KEY);
          sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
          sessionStorage.removeItem(STORAGE_COMPLETED_TAILOR_KEY);
          sessionStorage.removeItem(STORAGE_LAST_JOB_ID);
        } catch {
          /* ignore */
        }
        setActiveJobId(null);
        analyzeJobListingIdRef.current = null;
        listingAutoAnalyzeRef.current = false;
        jobIdFromBoardAutoRanRef.current = null;
        setTitle('');
        setCompany('');
        setDescription('');
        setAnalysis(null);
        setGenerated(null);
        setViewingSavedAnalysis(false);
        setTailorDraft(null);
        setTailorSidebarOpen(false);
        setError(null);
        setRematching(false);
        setScoreBeforeTailor(null);
        setTailoringCompleted(false);
        if (!cancelled) setHydrated(true);
        return;
      }
      let prefillJobDescription = '';
      let prefillTitle = '';
      let prefillCompany = '';
      if (typeof window !== 'undefined') {
        try {
          prefillJobDescription =
            window.localStorage.getItem('applymate_prefill_jd') ?? '';
          if (prefillJobDescription.trim()) {
            window.localStorage.removeItem('applymate_prefill_jd');
          }
          prefillTitle =
            window.localStorage.getItem('applymate_prefill_title') ?? '';
          if (prefillTitle.trim()) {
            window.localStorage.removeItem('applymate_prefill_title');
          }
          prefillCompany =
            window.localStorage.getItem('applymate_prefill_company') ?? '';
          if (prefillCompany.trim()) {
            window.localStorage.removeItem('applymate_prefill_company');
          }
        } catch {
          /* ignore */
        }
      }
      setTitle(prefillTitle.trim() ? prefillTitle : form.title);
      setCompany(prefillCompany.trim() ? prefillCompany : form.company);
      const hasPrefillDescription = prefillJobDescription.trim().length > 0;
      setDescription(
        hasPrefillDescription ? prefillJobDescription : form.description,
      );
      setAnalysis(hasPrefillDescription ? null : persistedAnalysis);
      if (!hasPrefillDescription && persistedAnalysis) {
        setViewingSavedAnalysis(true);
      } else if (hasPrefillDescription) {
        setViewingSavedAnalysis(false);
      }
      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    jobIdFromUrl,
    jobListingIdFromUrl,
    contextTokenFromUrl,
    openTailorFromUrl,
    sourceFromUrl,
    sessionIdFromUrl,
    activeJobId,
    freshAnalyzerParam,
    cleanAnalyzerParam,
    fromBoardFromUrl,
    router,
    searchParams,
    setActiveJobId,
    toast,
  ]);

  useEffect(() => {
    listingAutoAnalyzeRef.current = false;
    listingPipelineAutoDoneRef.current = null;
    jobListingBootstrapDoneRef.current = null;
    setAwaitingListingAnalysis(false);
  }, [jobListingIdFromUrl]);

  useEffect(() => {
    if (analysis) setAwaitingListingAnalysis(false);
  }, [analysis]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    sessionStorage.setItem(
      STORAGE_FORM_KEY,
      JSON.stringify({ title, company, description }),
    );
  }, [hydrated, title, company, description]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    if (analysis) {
      sessionStorage.setItem(STORAGE_ANALYSIS_KEY, JSON.stringify(analysis));
    } else {
      sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
    }
  }, [hydrated, analysis]);

  /** Drop tailor UI when JD or CV selection changes (skip until first hydrate to avoid wiping session restore). */
  useEffect(() => {
    if (!hydrated) return;
    if (tailoringFpRef.current === null) {
      tailoringFpRef.current = tailoringFp;
      return;
    }
    if (tailoringFpRef.current !== tailoringFp) {
      tailoringFpRef.current = tailoringFp;
      setTailorDraft(null);
      setTailorSidebarOpen(false);
      /** Do not clear `scoreBeforeTailor` here — changing CV profile after `loadJobById` updates the fingerprint and would wipe pre-tailor scores that still live on `analysis.scoreBeforeTailoring`. */
      setTailoringCompleted(false);
    }
  }, [hydrated, tailoringFp]);

  /** Restore completed tailoring for this job + CV after refresh or returning to the tab. */
  useEffect(() => {
    if (!hydrated || !analysis?.id || tailorDraft) return;
    const stored = loadCompletedTailorDraft(tailoringFp);
    if (
      stored?.status === 'completed' &&
      stored.cvProfileId === cvProfileIdForTailor
    ) {
      setTailorDraft({ ...stored, jobAnalysisId: analysis.id });
    }
  }, [hydrated, analysis?.id, tailoringFp, tailorDraft, cvProfileIdForTailor]);

  /** Persist completed draft against this job fingerprint (processed job context). */
  useEffect(() => {
    if (!hydrated || !tailorDraft || tailorDraft.status !== 'completed') return;
    saveCompletedTailorDraft(tailoringFp, tailorDraft);
  }, [hydrated, tailorDraft, tailoringFp]);

  const clearForm = () => {
    removeCompletedTailorDraft(
      tailoringSessionFingerprint(
        (selectedProfileId ?? cv?.id ?? '').trim(),
        title,
        company,
        description,
      ),
    );
    setTitle('');
    setCompany('');
    setDescription('');
    analysisMergeRef.current = null;
    setAnalysis(null);
    setGenerated(null);
    setError(null);
    setViewingSavedAnalysis(false);
    setTailorDraft(null);
    setTailorSidebarOpen(false);
    setScoreBeforeTailor(null);
    tailorBaselineScoreRef.current = null;
    setTailoringCompleted(false);
    setSelectedSkillNames([]);
    tailoringFpRef.current = null;
    setAwaitingListingAnalysis(false);
    setMobileTab('analyze');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_FORM_KEY);
      sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
      sessionStorage.removeItem(STORAGE_LAST_JOB_ID);
    }
  };

  const recordApplication = useMutation({
    mutationFn: api.applications.create,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applications.root() });
      const previous = queryClient.getQueryData<ApplicationItem[]>([
        'applications',
      ]);
      const optimistic: ApplicationItem = {
        id: `optimistic-${Date.now()}`,
        title: payload.title,
        company: payload.company,
        url: payload.url,
        matchScore: payload.matchScore,
        status: 'applied',
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ApplicationItem[]>(
        queryKeys.applications.root(),
        (old = []) => [optimistic, ...old],
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(queryKeys.applications.root(), ctx?.previous ?? []);
    },
    onSuccess: () => {
      invalidateNotificationList(queryClient);
      scheduleUnreadNotificationCountInvalidate(queryClient);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
      invalidateGrowthQueries(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
  });

  const hasCoverLetter = Boolean(generated?.trim());

  const descriptionWordCount = useMemo(() => {
    const t = description.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [description]);

  const copyCoverLetter = useCallback(async () => {
    if (!coverLetterDisplay?.trim()) return;
    try {
      await navigator.clipboard.writeText(coverLetterDisplay);
      toast.success('Cover letter copied');
    } catch {
      toast.error('Could not copy — try selecting the text manually');
    }
  }, [coverLetterDisplay, toast]);

  const saveCoverLetterPdf = useCallback(() => {
    if (!coverLetterDisplay?.trim()) return;
    try {
      downloadCoverLetterPdf({
        body: coverLetterDisplay,
        title: title || undefined,
        company: company || undefined,
      });
      toast.success('PDF downloaded');
    } catch {
      toast.error('Could not create PDF — try again');
    }
  }, [company, coverLetterDisplay, title, toast]);

  const applyAnalyzeSuccess = useCallback(
    (res: JobAnalysis) => {
      removeCompletedTailorDraft(
        tailoringSessionFingerprint(
          (selectedProfileId ?? cv?.id ?? '').trim(),
          title,
          company,
          description,
        ),
      );
      setTailorDraft(null);
      setTailorSidebarOpen(false);
      setScoreBeforeTailor(null);
      setTailoringCompleted(false);
      analysisMergeRef.current = res;
      setAnalysis(res);
      const matchedCv = (res.sourceCvProfileId ?? res.cvProfileId ?? '').trim();
      if (matchedCv && cvProfiles.some((p) => p.id === matchedCv)) {
        setSelectedProfileId(matchedCv);
      }
      setViewingSavedAnalysis(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
      const analysisId = (res.id ?? '').trim();
      const jlCapture = (
        jobListingIdFromUrl ||
        analyzeJobListingIdRef.current ||
        ''
      ).trim();
      if (analysisId && jlCapture) {
        listingPipelineAutoDoneRef.current = jlCapture;
      }
      if (analysisId) analyzeJobListingIdRef.current = null;
      const hb = pendingHubBookmarkIdRef.current;
      if (hb && analysisId) {
        pendingHubBookmarkIdRef.current = null;
        void (async () => {
          try {
            await api.jobDiscovery.patchBookmark(hb, {
              jobAnalysisId: analysisId,
            });
          } catch {
            try {
              await api.users.patchHubBookmark(hb, {
                jobAnalysisId: analysisId,
              });
            } catch {
              /* bookmark may already be linked or route missing */
            }
          }
          await queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
          invalidateTodayPlanQueries(queryClient);
        })();
      } else {
        pendingHubBookmarkIdRef.current = null;
      }
      if (res.reusedExistingAnalysis) {
        toast.success('Loaded your saved analysis');
      } else if (res.scoreSource === 'heuristic') {
        toast.success('Match estimate saved');
      } else {
        toast.success('AI analysis complete');
      }
      trackFunnelEvent('analyze_completed', {
        jobAnalysisId: res.id ?? null,
        selectedCvId: selectedProfileId ?? null,
      });
    },
    [
      company,
      cv?.id,
      cvProfiles,
      description,
      jobListingIdFromUrl,
      queryClient,
      selectedProfileId,
      title,
      toast,
    ],
  );

  const runAnalyze = useCallback(
    (opts?: { useAi?: boolean; forceRefresh?: boolean }) => {
      const jl = (
        jobListingIdFromUrl ||
        analyzeJobListingIdRef.current ||
        ''
      ).trim();
      const minDesc = minDescriptionCharsForAnalyze(jl);
      const descTrim = description.trim();
      if (descTrim.length < minDesc) {
        setError(
          jl
            ? 'This listing does not include enough job text to analyze yet. Open the original posting and paste the full description, or try again in a moment.'
            : 'Please paste a fuller job description',
        );
        return;
      }
      if (!jl) {
        const parsed = jobAnalyzeFormSchema.safeParse({
          title,
          company,
          description,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Invalid input');
          return;
        }
      }

      const explicitHeuristicPersist = opts?.useAi === false;
      const forceRefresh = opts?.forceRefresh === true;

      /** Default persisted path: omit useAi → server uses Gemini when allowed. */
      if (!explicitHeuristicPersist && !canUseAiFromDailyAiUsage(aiUsage)) {
        trackUpgradePrompted('job_analyzer_analyze');
        toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
        return;
      }

      setError(null);
      const expectsFullModel = !explicitHeuristicPersist;
      if (expectsFullModel) setAiReportPending(true);

      const listingApplyUrl = analyzeListingApplyUrlRef.current;
      const basePayload = {
        title,
        company,
        description,
        applicationQuestions: [] as string[],
        ...(selectedProfileId ? { cvProfileId: selectedProfileId } : {}),
        ...(jl ? { jobListingId: jl } : {}),
        ...applyUrlAnalyzePayload(listingApplyUrl),
        ...(explicitHeuristicPersist ? { useAi: false as const } : {}),
        ...(forceRefresh ? { forceRefreshAnalyzeWithAi: true as const } : {}),
        ...analyzeLocationPayload,
      };

      analyze.mutate(basePayload, {
        onSuccess: (res) => {
          applyAnalyzeSuccess(res);
          setAiReportPending(false);
        },
        onError: (err) => {
          setAiReportPending(false);
          setAwaitingListingAnalysis(false);
          toast.error(getApiErrorMessage(err));
          void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
        },
      });
    },
    [
      aiUsage,
      applyAnalyzeSuccess,
      company,
      description,
      jobListingIdFromUrl,
      queryClient,
      selectedProfileId,
      title,
      toast,
      analyze,
      analyzeLocationPayload,
    ],
  );

  const submit = () =>
    runAnalyze(viewingSavedAnalysis ? { forceRefresh: true } : {});

  useEffect(() => {
    if (!hydrated || jobIdFromUrl?.trim()) return;
    if (!jobListingIdFromUrl || analysis || viewingSavedAnalysis) return;
    if (listingPipelineAutoDoneRef.current === jobListingIdFromUrl) return;
    if (analyze.isPending || aiReportPending) return;
    if (listingAutoAnalyzeRef.current) return;
    if (
      description.trim().length <
      minDescriptionCharsForAnalyze(jobListingIdFromUrl)
    )
      return;
    if (cvProfiles.length > 1 && !selectedProfileId) return;
    listingAutoAnalyzeRef.current = true;
    runAnalyze({});
  }, [
    aiReportPending,
    analysis,
    analyze.isPending,
    company,
    cvProfiles.length,
    description,
    hydrated,
    jobIdFromUrl,
    jobListingIdFromUrl,
    runAnalyze,
    selectedProfileId,
    title,
    viewingSavedAnalysis,
  ]);

  /** From job board with analysis id: strip marker from URL once V2 exists, or run full analysis if still heuristic-only. */
  useEffect(() => {
    if (!hydrated || !fromBoardFromUrl) return;
    const jid = jobIdFromUrl?.trim();
    if (!jid || !analysis?.id || analysis.id !== jid) return;

    if (analysis.analysisV2) {
      router.replace(
        `/dashboard/jobs/analyze?jobId=${encodeURIComponent(jid)}`,
        { scroll: false },
      );
      return;
    }

    if (viewingSavedAnalysis) return;
    if (analyze.isPending || aiReportPending) return;
    if (jobIdFromBoardAutoRanRef.current === jid) return;
    if (
      description.trim().length <
      minDescriptionCharsForAnalyze(jobListingIdFromUrl)
    )
      return;
    if (cvProfiles.length > 1 && !selectedProfileId) return;

    jobIdFromBoardAutoRanRef.current = jid;
    runAnalyze({});
    router.replace(`/dashboard/jobs/analyze?jobId=${encodeURIComponent(jid)}`, {
      scroll: false,
    });
  }, [
    aiReportPending,
    analysis,
    analyze.isPending,
    company,
    cvProfiles.length,
    description,
    fromBoardFromUrl,
    hydrated,
    jobIdFromUrl,
    router,
    runAnalyze,
    selectedProfileId,
    title,
    viewingSavedAnalysis,
  ]);

  const tailorDraftForCurrentJob =
    tailorDraft && analysis?.id && tailorDraft.jobAnalysisId === analysis.id
      ? tailorDraft
      : null;

  useEffect(() => {
    const jobId = analysis?.id?.trim();
    if (!jobId || !analysis?.isTailored) return;
    if (tailorDraftForCurrentJob) return;
    let cancelled = false;
    void api.jobs.getJob(jobId).then((detail) => {
      if (cancelled || !detail.tailorDraft?.id?.trim()) return;
      setTailorDraft({
        ...detail.tailorDraft,
        jobAnalysisId: jobId,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [analysis?.id, analysis?.isTailored, tailorDraftForCurrentJob]);

  const openTailorPanel = useCallback(async () => {
    if (tailorDraftForCurrentJob) {
      setTailorSidebarOpen(true);
      return;
    }
    const jobId = (analysis?.id ?? jobAnalysisIdForTailor).trim();
    if (!jobId) {
      setTailorSidebarOpen(true);
      return;
    }
    try {
      const detail = await api.jobs.getJob(jobId);
      if (detail.tailorDraft?.id?.trim()) {
        setTailorDraft({
          ...detail.tailorDraft,
          jobAnalysisId: jobId,
        });
      }
    } catch {
      /* sidebar can still show export-only state */
    }
    setTailorSidebarOpen(true);
  }, [analysis?.id, jobAnalysisIdForTailor, tailorDraftForCurrentJob]);

  const tailorSectionComplete = useMemo(
    () =>
      Boolean(
        tailoringCompleted ||
        analysis?.isTailored ||
        tailorDraftForCurrentJob?.status === 'completed',
      ),
    [
      tailoringCompleted,
      analysis?.isTailored,
      tailorDraftForCurrentJob?.status,
    ],
  );

  const lastCheckpointKeyRef = useRef<string | null>(null);
  const computeTailorPct = useCallback(
    (d: CvTailorDraft | null): number | null => {
      if (!d || !Array.isArray(d.drafts) || d.drafts.length === 0) return null;
      const reviewed = d.drafts.filter(
        (x) => x.status === 'accepted' || x.status === 'rejected',
      ).length;
      return Math.round((reviewed / d.drafts.length) * 100);
    },
    [],
  );

  // Execution memory instrumentation: Tailor flow entry + meaningful progress.
  useEffect(() => {
    if (!tailorSidebarOpen) return;
    if (!cvProfileIdForTailor || !jobAnalysisIdForTailor) return;
    const entityId = jobListingIdForTailor
      ? canonicalWorkflowEntityId('job', jobListingIdForTailor)
      : canonicalWorkflowEntityId('job', jobAnalysisIdForTailor);
    const pct = computeTailorPct(tailorDraftForCurrentJob ?? tailorDraft);
    const key = `${entityId}|tailor|${tailorDraft?.id ?? ''}|${pct ?? 'x'}|${tailorDraft?.status ?? ''}`;
    if (lastCheckpointKeyRef.current === key) return;
    lastCheckpointKeyRef.current = key;
    void recordExecutionCheckpoint({
      workflowEntityId: entityId,
      workflowEntityType: 'job',
      executionType: 'tailor',
      component: 'CvTailoringSidebar',
      stepKey: tailorDraft?.status === 'completed' ? 'completed' : 'review',
      percentComplete: pct ?? 0,
      estimatedRemainingMinutes: null,
      resumeConfidence: null,
      hydrationConsistencyKey: jobListingIdForTailor
        ? `tailor:job:${jobListingIdForTailor}:v1`
        : `tailor:job:${jobAnalysisIdForTailor}:v1`,
      snapshot: {
        jobListingId: jobListingIdForTailor || undefined,
        jobAnalysisId: jobAnalysisIdForTailor || undefined,
        cvProfileId: cvProfileIdForTailor || undefined,
      },
    }).catch(() => {
      /* non-blocking */
    });
  }, [
    tailorSidebarOpen,
    cvProfileIdForTailor,
    jobAnalysisIdForTailor,
    jobListingIdForTailor,
    tailorDraftForCurrentJob,
    tailorDraft,
    computeTailorPct,
  ]);

  // Mark completion so continuation disappears once the workflow is done.
  useEffect(() => {
    if (!tailorSectionComplete) return;
    if (!jobAnalysisIdForTailor) return;
    const entityId = jobListingIdForTailor
      ? canonicalWorkflowEntityId('job', jobListingIdForTailor)
      : canonicalWorkflowEntityId('job', jobAnalysisIdForTailor);
    void markExecutionComplete({
      workflowEntityId: entityId,
      executionType: 'tailor',
    }).catch(() => {
      /* non-blocking */
    });
  }, [tailorSectionComplete, jobAnalysisIdForTailor, jobListingIdForTailor]);

  /** Prefer local state (live tailor flow); fall back to API so Score Change survives fingerprint/profile churn. */
  const displayScoreBeforeTailor = useMemo(() => {
    if (scoreBeforeTailor != null && Number.isFinite(scoreBeforeTailor))
      return scoreBeforeTailor;
    const a = analysis?.scoreBeforeTailoring;
    if (a != null && Number.isFinite(a)) return a;
    return null;
  }, [scoreBeforeTailor, analysis?.scoreBeforeTailoring]);

  useEffect(() => {
    const id = analysis?.id?.trim();
    if (!id) return;
    let cancelled = false;
    const cached = readCoverLetterFromStorage(id);
    if (cached && !cancelled) {
      setGenerated(cached);
      setCoverLetterAiBaseline((prev) => prev ?? cached);
    }
    void (async () => {
      try {
        const gen = await api.jobs.getGenerated(id);
        if (cancelled) return;
        const letter = normalizeText(gen.coverLetter as unknown).trim();
        if (letter) {
          setGenerated(letter);
          setCoverLetterAiBaseline(letter);
        } else if (!cached) {
          setGenerated(null);
        }
      } catch {
        if (!cached && !cancelled) setGenerated(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysis?.id]);

  const { applyUrl: resolvedApplyUrl } = useJobApplyUrl({
    applyUrl: analysis?.applyUrl,
    jobListingId: analysis?.jobListingId ?? jobListingIdFromUrl,
    enabled: Boolean(analysis),
  });

  const handleApplyOnCompanySite = useCallback(() => {
    if (resolvedApplyUrl) openExternalJobApplyUrl(resolvedApplyUrl);
  }, [resolvedApplyUrl]);

  const acceptedSkillNames = useMemo(() => {
    if (!tailorDraftForCurrentJob) return [];
    if (tailorSectionComplete) {
      return tailorDraftForCurrentJob.selectedSkills ?? [];
    }
    const drafts = tailorDraftForCurrentJob.drafts;
    const skillsDraft = drafts.find(
      (d: CvTailorDraftEntry) =>
        d.sectionType === 'skills' && d.status === 'accepted',
    );
    if (skillsDraft) {
      return tailorDraftForCurrentJob.selectedSkills ?? [];
    }
    return [];
  }, [tailorDraftForCurrentJob, tailorSectionComplete]);

  const fullyCompleteRef = useRef(false);
  fullyCompleteRef.current = !!(
    analysis &&
    (Boolean(generated?.trim()) || Boolean(analysis.hasCoverLetter)) &&
    tailorSectionComplete
  );

  useEffect(() => {
    return () => {
      if (!fullyCompleteRef.current || typeof window === 'undefined') return;
      try {
        sessionStorage.removeItem(STORAGE_FORM_KEY);
        sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // --- CV-to-Job loop: Next Steps state (3.7) ---
  const [loopSteps, setLoopSteps] = useState<JobLoopStepState>({});
  useEffect(() => {
    setLoopSteps(readJobLoopSteps(analysis?.id));
  }, [analysis?.id]);
  const updateLoopSteps = useCallback(
    (patch: Partial<JobLoopStepState>) => {
      setLoopSteps(writeJobLoopSteps(analysis?.id, patch));
    },
    [analysis?.id],
  );

  const loopReminders = useHubReminders({
    jobAnalysisId: analysis?.id?.trim() || null,
  });
  const loopReminderRows = loopReminders.query.data ?? [];
  const reminderDone = loopReminderRows.length > 0;
  const reminderSummary = useMemo(() => {
    const next = [...loopReminderRows]
      .filter((r) => r.remindAt)
      .sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt))[0];
    if (!next) return null;
    const when = new Date(next.remindAt);
    if (Number.isNaN(when.getTime())) return null;
    return `Follow up on ${when.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`;
  }, [loopReminderRows]);

  const coverLetterDone = hasCoverLetter || Boolean(analysis?.hasCoverLetter);
  const savedDone =
    Boolean(loopSteps.savedToHub) || viewingSavedAnalysis || coverLetterDone;

  const handleSkipCoverLetter = useCallback(() => {
    updateLoopSteps({ coverLetterSkipped: true });
  }, [updateLoopSteps]);

  const appliedDone = Boolean(loopSteps.appliedToJob);
  const interviewPrepDone = Boolean(loopSteps.interviewPrepStarted);

  const handleApplyToJobStep = useCallback(() => {
    if (!resolvedApplyUrl) {
      toast.error('No posting link found for this job. Apply from the source listing.');
      return;
    }
    openExternalJobApplyUrl(resolvedApplyUrl);
    updateLoopSteps({ appliedToJob: true });
  }, [resolvedApplyUrl, toast, updateLoopSteps]);

  const handlePrepInterviewStep = useCallback(() => {
    const qp = new URLSearchParams();
    const analysisId = (analysis?.id ?? '').trim();
    const preferredCv = (
      analysis?.tailoredCvProfileId ??
      analysis?.sourceCvProfileId ??
      analysis?.cvProfileId ??
      selectedProfileId ??
      cv?.id ??
      ''
    ).trim();
    const analyzedCv = (
      analysis?.sourceCvProfileId ??
      analysis?.cvProfileId ??
      ''
    ).trim();
    const baseCv = (
      analysis?.cvProfileId ??
      selectedProfileId ??
      cv?.id ??
      ''
    ).trim();
    if (analysisId) qp.set('jobAnalysisId', analysisId);
    if (title.trim()) qp.set('jobTitle', title.trim());
    if (company.trim()) qp.set('company', company.trim());
    if (preferredCv) {
      qp.set('preferredCvProfileId', preferredCv);
      qp.set('tailoringCvProfileId', preferredCv);
    }
    if (analyzedCv) qp.set('analyzedCvProfileId', analyzedCv);
    if (baseCv) qp.set('cvProfileId', baseCv);
    updateLoopSteps({ interviewPrepStarted: true });
    router.push(
      `/dashboard/interview${qp.toString() ? `?${qp.toString()}` : ''}`,
    );
  }, [analysis, company, cv?.id, router, selectedProfileId, title, updateLoopSteps]);

  const handleSaveJobToHub = useCallback(async () => {
    if (!analysis) return;
    try {
      await recordApplication.mutateAsync({
        title: title || 'Untitled role',
        company: company || 'Unknown company',
        url: resolvedApplyUrl || '',
        matchScore: analysis.matchScore,
        ...(analysis.id?.trim() ? { jobAnalysisId: analysis.id.trim() } : {}),
      });
      updateLoopSteps({ savedToHub: true });
      trackConversionFunnelEvent('job_saved_to_hub', {
        jobAnalysisId: analysis.id?.trim() ?? undefined,
        title: title || undefined,
        company: company || undefined,
      });
      toast.success('Saved to your Job Hub');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }, [
    analysis,
    company,
    recordApplication,
    resolvedApplyUrl,
    title,
    toast,
    updateLoopSteps,
  ]);

  const handleSetFollowUpReminder = useCallback(
    (remindAtIso: string) => {
      if (!analysis?.id?.trim()) {
        toast.error('Save the job first so we can attach the reminder.');
        return;
      }
      loopReminders.createReminder.mutate(
        {
          remindAt: remindAtIso,
          title: `Follow up: ${title || 'application'}${
            company ? ` · ${company}` : ''
          }`,
        },
        {
          onSuccess: () => toast.success('Follow-up reminder set'),
          onError: (err) => toast.error(getApiErrorMessage(err)),
        },
      );
    },
    [analysis?.id, company, loopReminders.createReminder, title, toast],
  );

  const analysisMutationBusy = analyze.isPending || aiReportPending;
  const listingAutoBlockedByCv =
    Boolean(jobListingIdFromUrl) && cvProfiles.length > 1 && !selectedProfileId;
  const showEmptyStateLoader =
    hydrated &&
    !analysis &&
    !listingAutoBlockedByCv &&
    (analysisMutationBusy || awaitingListingAnalysis);
  const showResultsRefreshing =
    hydrated && Boolean(analysis) && analysisMutationBusy;

  const handleTailorFirst = useCallback(() => {
    if (tailorSectionComplete || tailorDraftForCurrentJob) {
                            void openTailorPanel();
                            return;
                          }
                          void handleCreateTailorDraft();
  }, [
    tailorSectionComplete,
    tailorDraftForCurrentJob,
    openTailorPanel,
    handleCreateTailorDraft,
  ]);

  /** Extension sidebar: hydrate job + CV from tailor session, then auto-analyze + tailor. */
  useEffect(() => {
    if (!hydrated) return;
    if (sourceFromUrl !== 'extension' || !sessionIdFromUrl) return;
    if (extensionBootstrapRef.current) return;
    extensionBootstrapRef.current = true;

    setIsExtensionSession(true);
    setExtensionSessionId(sessionIdFromUrl);
    setReturnToUrl(returnToFromUrl);

    const jobTitleParam = searchParams.get('jobTitle')?.trim() ?? '';
    const companyParam = searchParams.get('company')?.trim() ?? '';
    const descriptionParam = searchParams.get('description')?.trim() ?? '';
    if (jobTitleParam) setTitle(jobTitleParam);
    if (companyParam) setCompany(companyParam);
    if (descriptionParam) setDescription(descriptionParam);
    if (cvIdFromExtensionUrl) setSelectedProfileId(cvIdFromExtensionUrl);

    void (async () => {
      try {
        const res = await axiosClient.get<{
          success: boolean;
          data: {
            cvId?: string;
            jobTitle?: string;
            company?: string;
            jobDescription?: string;
            returnToUrl?: string;
          };
        }>(`extension/tailor/session/${sessionIdFromUrl}`);
        const session = res.data?.data;
        if (session?.jobTitle) setTitle(session.jobTitle);
        if (session?.company) setCompany(session.company);
        if (session?.jobDescription) setDescription(session.jobDescription);
        if (session?.returnToUrl) setReturnToUrl(session.returnToUrl);
        if (session?.cvId?.trim()) setSelectedProfileId(session.cvId.trim());
      } catch {
        const jobTitle = searchParams.get('jobTitle');
        const companyParam = searchParams.get('company');
        const descriptionParam = searchParams.get('description');
        if (jobTitle) setTitle(jobTitle);
        if (companyParam) setCompany(companyParam);
        if (descriptionParam) setDescription(descriptionParam);
        if (cvIdFromExtensionUrl) setSelectedProfileId(cvIdFromExtensionUrl);
      }

      window.setTimeout(() => {
        extensionAutoTailorPendingRef.current = true;
        runAnalyze({});
      }, 500);
    })();
  }, [
    hydrated,
    sourceFromUrl,
    sessionIdFromUrl,
    returnToFromUrl,
    cvIdFromExtensionUrl,
    searchParams,
    runAnalyze,
  ]);

  useEffect(() => {
    if (!isExtensionSession || !extensionAutoTailorPendingRef.current) return;
    if (!analysis?.id?.trim()) return;
    extensionAutoTailorPendingRef.current = false;
    const timer = window.setTimeout(() => {
      void handleTailorFirst();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [isExtensionSession, analysis?.id, handleTailorFirst]);

  useEffect(() => {
    if (!isExtensionSession || !extensionSessionId) return;
    if (!tailorSectionComplete) return;
    const tailoredCvId = analysis?.tailoredCvProfileId?.trim();
    if (!tailoredCvId) return;
    if (extensionCompleteCalledRef.current) return;
    extensionCompleteCalledRef.current = true;

    void (async () => {
      try {
        const res = await axiosClient.post<{
          success: boolean;
          data: {
            returnToUrl?: string;
            tailoredCvId?: string;
          };
        }>('extension/tailor/complete', {
          sessionId: extensionSessionId,
          tailoredCvId,
        });
        if (res.data?.success && res.data.data) {
          setExtensionTailoringComplete(true);
          setExtensionTailoredCvId(
            res.data.data.tailoredCvId?.trim() || tailoredCvId,
          );
          if (res.data.data.returnToUrl?.trim()) {
            setReturnToUrl(res.data.data.returnToUrl.trim());
          }
        }
      } catch {
        /* fail silently — return button still works via stored returnToUrl */
      }
    })();
  }, [
    isExtensionSession,
    extensionSessionId,
    tailorSectionComplete,
    analysis?.tailoredCvProfileId,
  ]);

  const handleReturnToJobListing = useCallback(() => {
    const tailoredId =
      extensionTailoredCvId ?? analysis?.tailoredCvProfileId?.trim() ?? '';
    if (returnToUrl) {
      try {
        const url = new URL(returnToUrl);
        url.searchParams.set('tailorComplete', 'true');
        if (tailoredId) url.searchParams.set('tailoredCvId', tailoredId);
        window.location.href = url.toString();
        return;
      } catch {
        /* fall through */
      }
    }
    window.history.back();
  }, [analysis?.tailoredCvProfileId, extensionTailoredCvId, returnToUrl]);

  const handleGenerateCoverLetter = useCallback(() => {
    if (!analysis) return;
                            if (!canUseAiFromDailyAiUsage(aiUsage)) {
      trackUpgradePrompted('job_analyzer_cover_letter');
                              toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
                              return;
                            }
                            generate.mutate(
                              {
                                title,
                                company,
                                description,
                                questions: [],
        ...(analysis.id?.trim() ? { jobAnalysisId: analysis.id.trim() } : {}),
                              },
                              {
                                onSuccess: async (res) => {
          const raw = normalizeText(res.coverLetter as unknown).trim();
                                  const letter =
            raw !== '' ? raw : 'Generated content received.';
                                  setGenerated(letter);
                                  setCoverLetterAiBaseline(letter);
                                  setCoverLetterEditing(false);
          trackConversionFunnelEvent('cover_letter_generated', {
            jobAnalysisId: analysis.id?.trim() ?? undefined,
            title: title || undefined,
            company: company || undefined,
          });
                                  try {
                                    await recordApplication.mutateAsync({
                                      title: title || 'Untitled role',
                                      company: company || 'Unknown company',
                                      url: '',
                                      matchScore: analysis.matchScore,
              ...(analysis.id?.trim()
                ? { jobAnalysisId: analysis.id.trim() }
                : {}),
            });
            updateLoopSteps({ savedToHub: true });
            trackConversionFunnelEvent('job_saved_to_hub', {
              jobAnalysisId: analysis.id?.trim() ?? undefined,
              title: title || undefined,
              company: company || undefined,
              via: 'cover_letter_generate',
                                    });
                                    toast.success('Job saved to your list');
                                    trackFunnelEvent('apply_completed', {
                                      jobAnalysisId: analysis.id ?? null,
                                      title,
                                      company,
                                    });
                                    void api.growth.trackEvent({
                                      eventName: 'apply_completed',
                                      context: {
                                        jobAnalysisId: analysis.id ?? null,
                                        title,
                                        company,
                                      },
                                    });
                                    void consumeGrowthFeedback();
                                  } catch {
                                    toast.error(
                                      'Cover letter is ready, but it could not be saved to your tracker. You can still copy or download it below.',
                                    );
                                  } finally {
            void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
                                    invalidateTodayPlanQueries(queryClient);
                                  }
                                },
                                onError: (err) => {
                                  toast.error(getApiErrorMessage(err));
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
                                },
                              },
                            );
  }, [
    aiUsage,
    analysis,
    company,
    consumeGrowthFeedback,
    description,
    generate,
    queryClient,
    recordApplication,
    title,
    toast,
    updateLoopSteps,
  ]);

  const mobileTabs = [
    { id: 'analyze' as const, label: 'Analyze' },
    { id: 'results' as const, label: 'Results' },
    { id: 'history' as const, label: 'History' },
  ];

  return (
    <>
      {isExtensionSession && extensionTailoringComplete ? (
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-[rgba(0,201,177,0.20)] bg-[#0F1512] px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(52,211,153,0.30)] bg-[rgba(52,211,153,0.15)] text-[13px] text-[#34D399]"
              aria-hidden
            >
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F0F4F2]">
                CV tailored successfully
              </p>
              <p className="mt-0.5 text-xs text-white/50">
                Your tailored CV has been saved.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={handleReturnToJobListing}
              className="rounded-lg bg-[#00C9B1] px-4 py-2 text-sm font-semibold text-[#080B0A] transition-colors duration-150 hover:bg-[#00b5a0]"
            >
              Return to job listing →
            </button>
            <button
              type="button"
              onClick={() => setIsExtensionSession(false)}
              className="ml-3 cursor-pointer border-none bg-transparent text-xs text-white/40 no-underline hover:text-white/70"
            >
              Stay on dashboard
            </button>
          </div>
        </div>
      ) : null}
                        <motion.div
        initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex w-full min-w-0 max-w-full flex-col overflow-x-hidden lg:h-[calc(100dvh-7.5rem)] lg:min-h-0 lg:overflow-hidden"
      >
        {/* Mobile tab bar (single-column layout) */}
        <div className="sticky top-0 z-20 -mx-4 mb-4 flex border-b border-white/[0.06] bg-[#080B0A]/95 px-4 backdrop-blur-md sm:-mx-5 sm:px-5 lg:hidden">
          {mobileTabs.map((tab) => {
            const active = mobileTab === tab.id;
            return (
                                <button
                key={tab.id}
                                  type="button"
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  'flex h-11 flex-1 items-center justify-center border-b-2 text-[13px] transition-colors duration-150',
                  active
                    ? 'border-[#00C9B1] font-semibold text-[#00C9B1]'
                    : 'border-transparent font-medium text-white/35 hover:text-white/60',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
                                </button>
            );
          })}
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col min-h-0 lg:flex-row">
          <motion.div
            key={`left-${mobileTab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            data-tour="analyzer-form"
            className={cn(
              'app-scrollbar flex min-w-0 flex-col gap-5 lg:h-full lg:w-[clamp(20rem,35%,27.5rem)] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-white/[0.06] lg:px-5 lg:py-6',
              mobileTab === 'results' && 'max-lg:hidden',
            )}
          >
            <JobInputForm
              title={title}
              company={company}
              description={description}
              descriptionWordCount={descriptionWordCount}
              error={error}
              cvProfiles={cvProfiles}
              selectedProfileId={selectedProfileId}
              selectedProfile={selectedProfile}
              onTitleChange={setTitle}
              onCompanyChange={setCompany}
              onDescriptionChange={setDescription}
              onSelectedProfileChange={setSelectedProfileId}
              onClearForm={clearForm}
              onSubmit={submit}
              analyzePending={analyze.isPending}
              aiReportPending={aiReportPending}
              viewingSavedAnalysis={viewingSavedAnalysis}
              activeAnalysisId={analysis?.id}
              onSelectHistoryJob={loadJobById}
              analyzeClassName={cn(mobileTab !== 'analyze' && 'max-lg:hidden')}
              historyClassName={cn(mobileTab !== 'history' && 'max-lg:hidden')}
            />
          </motion.div>

          <motion.div
            key={`right-${mobileTab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            data-tour="analyzer-results"
            className={cn(
              'app-scrollbar flex min-w-0 flex-1 flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-7 lg:py-6',
              mobileTab !== 'results' && 'max-lg:hidden',
            )}
          >
            {listingAutoBlockedByCv ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center lg:py-12">
                <p className="text-lg font-semibold text-white">
                  Choose a CV first
                </p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/45">
                  Select which resume to match against this job using the
                  dropdown on the left. We will run the AI analysis against
                  that profile.
                </p>
                            </div>
            ) : showEmptyStateLoader ? (
              <AnalyzerResultsLoadingShell variant="empty" />
            ) : !analysis ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <Search className="h-12 w-12 text-white/25" aria-hidden />
                <p className="text-[18px] font-semibold text-[#F0F4F2]">
                  Analyze a job to see your results here
                </p>
                <p className="max-w-[300px] text-[13px] leading-relaxed text-white/60">
                  Paste a job description on the left and click Analyze to see
                  your match score, skill gaps, salary estimate, and cover
                  letter.
                </p>
                          </div>
            ) : (
              <div className="relative min-h-[200px]">
                {showResultsRefreshing ? (
                  <AnalyzerResultsLoadingShell variant="overlay" />
                ) : null}
                <div
                  className={cn(
                    'space-y-4',
                    showResultsRefreshing &&
                      'pointer-events-none select-none opacity-[0.38]',
                  )}
                >
                  <MatchScorePanel
                        analysis={analysis}
                        rematching={rematching}
                        displayScoreBeforeTailor={displayScoreBeforeTailor}
                        tailorSectionComplete={tailorSectionComplete}
                        acceptedSkillNames={acceptedSkillNames}
                        resolvedApplyUrl={resolvedApplyUrl}
                        analyzePending={analyze.isPending}
                        aiReportPending={aiReportPending}
                        onTailorFirst={handleTailorFirst}
                        onApplyNow={handleApplyOnCompanySite}
                      />
                      <NextStepsPanel
                        tailorDone={tailorSectionComplete}
                        coverLetterDone={coverLetterDone}
                        coverLetterSkipped={Boolean(
                          loopSteps.coverLetterSkipped,
                        )}
                        savedDone={savedDone}
                        appliedDone={appliedDone}
                        interviewPrepDone={interviewPrepDone}
                        applyAvailable={Boolean(resolvedApplyUrl)}
                        reminderDone={reminderDone}
                        reminderSummary={reminderSummary}
                        busy={{
                          tailor: tailorSubmitting,
                          coverLetter: generate.isPending,
                          save: recordApplication.isPending,
                          reminder: loopReminders.createReminder.isPending,
                        }}
                        onTailor={handleTailorFirst}
                        onGenerateCoverLetter={handleGenerateCoverLetter}
                        onSkipCoverLetter={handleSkipCoverLetter}
                        onSaveJob={() => void handleSaveJobToHub()}
                        onApplyToJob={handleApplyToJobStep}
                        onPrepInterview={handlePrepInterviewStep}
                        onSetReminder={handleSetFollowUpReminder}
                      />
                      <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-[#00C9B1]/15 bg-[#0C0F0F] p-4 sm:p-6">
                        <SkillGapPanel
                          analysis={analysis}
                          tailorSectionComplete={tailorSectionComplete}
                          selectedSkillNames={selectedSkillNames}
                          onToggleSkill={toggleSkillSelected}
                          tailorSubmitting={tailorSubmitting}
                          jobAnalysisIdForTailor={jobAnalysisIdForTailor}
                          cvProfileIdForTailor={cvProfileIdForTailor}
                          cvBootstrapPending={cvBootstrapPending}
                          cvProfileCount={cvProfiles.length}
                          selectedProfileId={selectedProfileId}
                          tailorAiBlocked={tailorAiBlocked}
                          hasTailorDraftForJob={Boolean(tailorDraftForCurrentJob)}
                          onCreateTailorDraft={() =>
                            void handleCreateTailorDraft()
                          }
                          onResumeTailoring={() => setTailorSidebarOpen(true)}
                        />
                        <TailoringPanel
                          analysis={analysis}
                          tailorSectionComplete={tailorSectionComplete}
                          displayScoreBeforeTailor={displayScoreBeforeTailor}
                          hasTailorDraftForJob={Boolean(tailorDraftForCurrentJob)}
                          rematching={rematching}
                          analyzePending={analyze.isPending}
                          onOpenTailorPanel={() => void openTailorPanel()}
                          onRematch={() => void rematchJobToUpdatedCv()}
                        />
                      </div>
                      <JobHubSavePanel
                        analysis={analysis}
                        title={title}
                        company={company}
                        description={description}
                        hasCoverLetter={hasCoverLetter}
                        generatePending={generate.isPending}
                        savePending={recordApplication.isPending}
                        aiUsage={{
                          isPaidTier: aiUsage.isPaidTier,
                          isLoading: aiUsage.isLoading,
                          remaining: aiUsage.remaining,
                        }}
                        selectedProfileId={selectedProfileId}
                        cvProfileId={cv?.id}
                        tailoredCvProfileId={analysis.tailoredCvProfileId}
                        sourceCvProfileId={analysis.sourceCvProfileId}
                        exportTemplate={selectedProfile?.template ?? cv?.template ?? null}
                        onGenerateCoverLetter={handleGenerateCoverLetter}
                      />
                      <CoverLetterPanel
                        visible={hasCoverLetter}
                        coverLetterDisplay={coverLetterDisplay}
                        coverLetterEditing={coverLetterEditing}
                        coverLetterDraft={coverLetterDraft}
                        coverLetterAiBaseline={coverLetterAiBaseline}
                        onStartEdit={() => {
                          setCoverLetterDraft(coverLetterDisplay ?? '');
                          setCoverLetterEditing(true);
                        }}
                        onDraftChange={setCoverLetterDraft}
                        onCancelEdit={() => setCoverLetterEditing(false)}
                        onSaveEdits={async (text) => {
                          const next = text.trim() || null;
                                      setGenerated(next);
                                      setCoverLetterEditing(false);
                          const jobId = analysis.id?.trim();
                                      if (jobId && next) {
                                        writeCoverLetterToStorage(jobId, next);
                            await api.jobs.saveGeneratedCoverLetter(jobId, next);
                                      }
                                      toast.success('Cover letter updated');
                                    }}
                        onRevertToAi={() => {
                                      const baseline =
                            coverLetterAiBaseline ?? coverLetterDisplay ?? '';
                                      setCoverLetterDraft(baseline);
                                      setGenerated(baseline.trim() || null);
                                      toast.success('Reverted to AI version');
                                    }}
                        onCopy={() => void copyCoverLetter()}
                        onDownloadPdf={saveCoverLetterPdf}
                      />
                      <div
                        aria-hidden
                        className="hidden max-lg:block shrink-0"
                        style={{ minHeight: mobileScrollClearance }}
                      />
                    </div>
                  </div>
                )}
          </motion.div>
        </div>
        <div
          aria-hidden
          className="hidden max-lg:block shrink-0"
          style={{ height: mobileScrollClearance }}
        />
      </motion.div>
      <div
        className={cn(
          'fixed inset-x-0 z-[70] border-t border-white/[0.08] bg-[#080b0a]/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md lg:hidden',
          mobileTab === 'history' && 'hidden',
        )}
        style={{ bottom: navBottomOffset }}
      >
        <Button
          fullWidth
          variant="primary"
          onClick={submit}
          disabled={
            analyze.isPending || (cvProfiles.length > 1 && !selectedProfileId)
          }
          className="min-h-[48px] rounded-[10px] bg-gradient-to-br from-[#00C9B1] to-[#00A896] text-[15px] font-semibold text-[#080A0A] shadow-[0_6px_24px_rgba(0,201,177,0.35)]"
        >
          {analyze.isPending || aiReportPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
              {aiReportPending ? 'Running AI report…' : 'Analyzing…'}
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              {viewingSavedAnalysis ? 'Refresh analysis' : 'Analyze job'}
            </>
          )}
        </Button>
      </div>
      <CvTailoringSidebar
        layout="split"
        open={tailorSidebarOpen}
        onClose={() => setTailorSidebarOpen(false)}
        draft={tailorDraftForCurrentJob ?? tailorDraft}
        onTailorMutation={applyTailorMutation}
        jobTitle={analysis?.title ?? title}
        jobCompany={analysis?.company ?? company}
        exportTemplate={selectedProfile?.template ?? cv?.template ?? null}
        onTailoringCvPersisted={() => {
          scheduleRematchAfterTailoring();
          void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analyses() });
          invalidateTodayPlanQueries(queryClient);
        }}
        scoreBeforeTailor={displayScoreBeforeTailor}
        currentScore={analysis?.matchScore ?? null}
        tailoredCvName={
          analysis?.tailoredCvName ?? tailorDraft?.tailoredCvName ?? null
        }
        jobAnalysisId={jobAnalysisIdForTailor || null}
      />
    </>
  );
}
