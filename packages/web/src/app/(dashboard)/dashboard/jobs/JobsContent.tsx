'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Copy, FileDown, Loader2, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import { ApplicationsSavedPanel } from '@/components/dashboard/ApplicationsSavedPanel';
import { CvTailoringSidebar } from '@/components/dashboard/CvTailoringSidebar';
import { JobAnalysisCard } from '@/components/dashboard/JobAnalysisCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { useToast } from '@/components/ui/Toast';
import { useAnalyzeJob } from '@/hooks/useAnalyzeJob';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import { useCVProfile } from '@/hooks/useCVProfile';
import { useCVProfiles } from '@/hooks/useCVProfiles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGenerateContent } from '@/hooks/useGenerateContent';
import { invalidateGrowthQueries, useConsumeImmediateGrowthFeedback } from '@/hooks/useGrowth';
import {
  invalidateNotificationList,
  scheduleUnreadNotificationCountInvalidate,
} from '@/hooks/useNotifications';
import { useJobHistory } from '@/hooks/useJobHistory';
import {
  api,
  type ApplicationItem,
  type CvProfileSummary,
  type CvTailorDraft,
  type CvTailorDraftEntry,
  type JobAnalysis,
  type JobDetailForForm,
  type JobHistoryItem,
  type TailorMutationResponse,
} from '@/lib/api';
import { inferCvProfileNameFromProfile } from '@/lib/infer-cv-profile-name';
import { CV_SUGGESTIONS_QUERY_ROOT, cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import {
  canUseAiFromDailyAiUsage,
  DAILY_AI_LIMIT_REACHED_MESSAGE,
} from '@/lib/ai-daily-usage';
import { resolveCvProfileIdForSavedJob } from '@/lib/jobAnalysisCvContext';
import { consumePrefetchByContextToken, FRESH_ANALYZE_PREFILL_SESSION } from '@/lib/jobHubPrefill';
import { getApiErrorMessage } from '@/lib/axios';
import { trackFunnelEvent } from '@/lib/actionFunnel';
import { downloadCoverLetterPdf } from '@/lib/cover-letter-pdf';
import { substituteCoverLetterCandidateName } from '@/lib/cover-letter-placeholders';
import { normalizeText } from '@/lib/normalizeText';
import { getDisplayName } from '@/lib/display-name';
import { resolveAnalysisAfterTailorMutation } from '@/lib/applyTailorMutation';
import { mergeTailorEstimatedScores } from '@/lib/tailorMatchScore';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { ensureArray } from '@/lib/ensure-array';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';

const STORAGE_FORM_KEY = 'applymate:dashboard:jobs:analyze-form';
const STORAGE_ANALYSIS_KEY = 'applymate:dashboard:jobs:last-analysis';
/** Completed tailor drafts keyed by CV + job text (survives refresh; cleared when JD/CV context changes). */
const STORAGE_COMPLETED_TAILOR_KEY = 'applymate:dashboard:jobs:completed-tailor-by-fp';

function tailoringSessionFingerprint(
  cvProfileId: string,
  title: string,
  company: string,
  jobDescription: string,
): string {
  return `${cvProfileId.trim()}\u001f${title.trim()}\u001f${company.trim()}\u001f${jobDescription.trim()}`;
}

function saveCompletedTailorDraft(fp: string, draft: CvTailorDraft) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_COMPLETED_TAILOR_KEY);
    const map: Record<string, CvTailorDraft> = raw ? (JSON.parse(raw) as Record<string, CvTailorDraft>) : {};
    map[fp] = draft;
    sessionStorage.setItem(STORAGE_COMPLETED_TAILOR_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function loadCompletedTailorDraft(fp: string): CvTailorDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_COMPLETED_TAILOR_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, CvTailorDraft>;
    return map[fp] ?? null;
  } catch {
    return null;
  }
}

function removeCompletedTailorDraft(fp: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_COMPLETED_TAILOR_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, CvTailorDraft>;
    delete map[fp];
    sessionStorage.setItem(STORAGE_COMPLETED_TAILOR_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

const schema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  description: z.string().min(30, 'Please paste a fuller job description'),
});

function loadPersistedForm(): { title: string; company: string; description: string } {
  if (typeof window === 'undefined') {
    return { title: '', company: '', description: '' };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_FORM_KEY);
    if (!raw) return { title: '', company: '', description: '' };
    const p = JSON.parse(raw) as { title?: unknown; company?: unknown; description?: unknown };
    return {
      title: typeof p.title === 'string' ? p.title : '',
      company: typeof p.company === 'string' ? p.company : '',
      description: typeof p.description === 'string' ? p.description : '',
    };
  } catch {
    return { title: '', company: '', description: '' };
  }
}

function loadPersistedAnalysis(): JobAnalysis | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_ANALYSIS_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as JobAnalysis;
    if (a && typeof a === 'object' && typeof a.matchScore === 'number' && Number.isFinite(a.matchScore)) {
      return a;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistSessionSnapshot(
  nextTitle: string,
  nextCompany: string,
  nextDescription: string,
  nextAnalysis: JobAnalysis | null,
) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    STORAGE_FORM_KEY,
    JSON.stringify({ title: nextTitle, company: nextCompany, description: nextDescription }),
  );
  if (nextAnalysis) {
    sessionStorage.setItem(STORAGE_ANALYSIS_KEY, JSON.stringify(nextAnalysis));
  } else {
    sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
  }
}

function jobHistoryItemToDetail(item: JobHistoryItem): JobDetailForForm {
  const desc = item.description ?? item.jobDescription ?? '';
  const jt = item.jobTitle || item.title || '';
  const srcCv = item.cvProfileId?.trim();
  const jl = item.jobListingId?.trim();
  const jh = item.jobListingSourceHash?.trim();
  return {
    title: jt,
    company: item.company ?? '',
    description: desc,
    analysis: {
      id: item.id,
      title: jt,
      company: item.company,
      matchScore: item.matchScore ?? 0,
      scoreBeforeTailoring: item.scoreBeforeTailoring,
      isTailored: item.isTailored,
      tailoredCvProfileId: item.tailoredCvProfileId,
      tailoredCvName: item.tailoredCvName,
      ...(srcCv ? { cvProfileId: srcCv, sourceCvProfileId: srcCv } : {}),
      ...(jl ? { jobListingId: jl } : {}),
      ...(jh ? { jobListingSourceHash: jh } : {}),
      strengths: [],
      missingSkills: [],
      ...(item.salaryEstimate != null ? { salaryEstimate: item.salaryEstimate } : {}),
    },
  };
}

/** Match saved analysis rows to history list items (session restore often omits job id). */
function historyRowKey(jobTitle: string, company: string): string {
  return `${jobTitle.trim().toLowerCase()}\u001f${company.trim().toLowerCase()}`;
}

/**
 * When GET /jobs/:id returns a narrower analysis, do not drop tailor flags from prior state for the same job.
 * If both IDs are set and differ, do not merge (different jobs).
 */
function mergeJobAnalysisForApply(prev: JobAnalysis | null, incoming: JobAnalysis): JobAnalysis {
  const prevId = (prev?.id ?? '').trim();
  const incomingId = (incoming.id ?? '').trim();
  const bothIds = Boolean(prevId && incomingId);
  const sameJob = bothIds ? prevId === incomingId : true;

  if (!sameJob || !prev) {
    return { ...incoming };
  }

  const base: JobAnalysis = { ...incoming };

  if (incoming.isTailored === undefined && prev.isTailored === true) {
    base.isTailored = true;
  }

  const incName = incoming.tailoredCvName;
  if ((incName === undefined || incName === null || String(incName).trim() === '') && prev.tailoredCvName) {
    base.tailoredCvName = prev.tailoredCvName;
  }

  if (
    (incoming.scoreBeforeTailoring === undefined || incoming.scoreBeforeTailoring === null) &&
    prev.scoreBeforeTailoring != null &&
    Number.isFinite(prev.scoreBeforeTailoring)
  ) {
    base.scoreBeforeTailoring = prev.scoreBeforeTailoring;
  }

  if (
    (incoming.tailoredCvProfileId === undefined || incoming.tailoredCvProfileId === null) &&
    prev.tailoredCvProfileId
  ) {
    base.tailoredCvProfileId = prev.tailoredCvProfileId;
  }

  if (
    (incoming.sourceCvProfileId === undefined || incoming.sourceCvProfileId === null) &&
    prev.sourceCvProfileId
  ) {
    base.sourceCvProfileId = prev.sourceCvProfileId;
  }

  if ((incoming.cvProfileId === undefined || incoming.cvProfileId === null) && prev.cvProfileId) {
    base.cvProfileId = prev.cvProfileId;
  }

  if ((incoming.jobListingId === undefined || incoming.jobListingId === null) && prev.jobListingId) {
    base.jobListingId = prev.jobListingId;
  }

  if (
    (incoming.jobListingSourceHash === undefined || incoming.jobListingSourceHash === null) &&
    prev.jobListingSourceHash
  ) {
    base.jobListingSourceHash = prev.jobListingSourceHash;
  }

  if (incoming.salaryEstimate === undefined && prev.salaryEstimate !== undefined) {
    base.salaryEstimate = prev.salaryEstimate;
  }

  if (incoming.analysisV2 === undefined && prev.analysisV2) {
    base.analysisV2 = prev.analysisV2;
  }

  return base;
}

export function JobsContent() {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  /** Loaded job / restored session with an existing analysis — block re-running Analyze until Clear form. */
  const [viewingSavedAnalysis, setViewingSavedAnalysis] = useState(false);
  const [tailorDraft, setTailorDraft] = useState<CvTailorDraft | null>(null);
  const [tailorSidebarOpen, setTailorSidebarOpen] = useState(false);
  const [tailorSubmitting, setTailorSubmitting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [selectedSkillNames, setSelectedSkillNames] = useState<string[]>([]);
  const [scoreBeforeTailor, setScoreBeforeTailor] = useState<number | null>(null);
  /** After rematch or when loading a tailored job — show job-fit before/after even if scores are flat or down. */
  const [tailoringCompleted, setTailoringCompleted] = useState(false);

  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');
  const contextTokenFromUrl = searchParams.get('contextToken');
  const jobsTab = searchParams.get('tab') === 'saved' ? 'saved' : 'analyze';

  const analyze = useAnalyzeJob();
  const generate = useGenerateContent();
  const consumeGrowthFeedback = useConsumeImmediateGrowthFeedback();
  const aiUsage = useDailyAiUsage();
  const history = useJobHistory();
  const { data: me } = useCurrentUser();
  const { data: cv, isPending: cvProfilePending } = useCVProfile();
  const { data: cvProfilesData, isPending: cvProfilesPending } = useCVProfiles();
  const cvProfiles = cvProfilesData?.rows ?? [];
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const storeUser = useAuthStore((s) => s.user);
  const activeJobId = useUIStore((s) => s.activeJobId);
  const setActiveJobId = useUIStore((s) => s.setActiveJobId);

  const candidateDisplayName = getDisplayName(me ?? storeUser);

  /** Synchronous snapshot for mergeJobAnalysisForApply (setState updaters are not reliable for reading merged output). */
  const analysisMergeRef = useRef<JobAnalysis | null>(null);
  const tailorBaselineScoreRef = useRef<number | null>(null);
  /** From Job Hub “Analyze” prefill — PATCH bookmark after first successful analyze (same as JobsAnalyzeContent). */
  const pendingHubBookmarkIdRef = useRef<string | null>(null);

  const skillsInitKey = useMemo(
    () =>
      `${analysis?.id ?? 'no-id'}|${(analysis?.missingSkills ?? [])
        .map((s) => `${s.name}:${s.importance}`)
        .join(';')}`,
    [analysis],
  );

  useEffect(() => {
    const skills = analysis?.missingSkills ?? [];
    if (skills.length === 0) {
      setSelectedSkillNames([]);
      return;
    }
    const criticalHigh = skills
      .filter((s) => s.importance === 'CRITICAL' || s.importance === 'HIGH')
      .map((s) => s.name);
    /** If the API only returns MEDIUM/LOW gaps, nothing was auto-selected — select all gaps so Tailor stays usable. */
    setSelectedSkillNames(criticalHigh.length > 0 ? criticalHigh : skills.map((s) => s.name));
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
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
      const pick = scoreMatch ?? sorted[0]!;
      return { ...prev, id: pick.id };
    });
  }, [hydrated, title, company, history.data]);

  useEffect(() => {
    analysisMergeRef.current = analysis;
  }, [analysis]);

  const cvBootstrapPending = cvProfilePending || cvProfilesPending;

  const cvProfileIdForTailor = (selectedProfileId ?? cv?.id ?? '').trim();
  const jobAnalysisIdForTailor = (analysis?.id ?? '').trim();
  const tailoringFp = useMemo(
    () => tailoringSessionFingerprint(cvProfileIdForTailor, title, company, description),
    [cvProfileIdForTailor, title, company, description],
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
          (result.draft.jobAnalysisId ?? '').trim() || (analysis?.id ?? '').trim() || result.draft.jobAnalysisId,
        cvProfileId: (result.draft.cvProfileId ?? '').trim() || cvProfileIdForTailor || result.draft.cvProfileId,
      };
      setTailorDraft(mergedDraft);
      setAnalysis((prev) => {
        const next = resolveAnalysisAfterTailorMutation(prev, { ...result, draft: mergedDraft }, tailorMutationRefs);
        if (!next) return prev;
        analysisMergeRef.current = next;
        persistSessionSnapshot(title, company, description, next);
        queryClient.setQueryData(['job-analysis-current'], next);
        void queryClient.invalidateQueries({ queryKey: ['job-history'] });
        void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
        return next;
      });
    },
    [analysis?.id, company, cvProfileIdForTailor, description, queryClient, tailorMutationRefs, title],
  );

  const handleCreateTailorDraft = useCallback(async () => {
    if (tailorAiBlocked || !canUseAiFromDailyAiUsage(aiUsage)) {
      toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
      return;
    }
    if (!cvProfileIdForTailor || !jobAnalysisIdForTailor) {
      toast.error('Run a full job analysis first so we can tailor your CV to this role.');
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
          jobAnalysisId: (result.draft.jobAnalysisId ?? '').trim() || jobAnalysisIdForTailor,
          cvProfileId: (result.draft.cvProfileId ?? '').trim() || cvProfileIdForTailor,
        },
      });
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
      toast.error('Analyze this job first so we can load the saved match score.');
      return;
    }
    setRematching(true);
    try {
      /** GET rematch only — do not POST /jobs/analyze here (would re-run AI and can change scores). */
      const detail = await api.jobs.getJob(jobId);
      const merged = mergeJobAnalysisForApply(analysisMergeRef.current, detail.analysis);
      const analysisIdRematch = (merged.id ?? '').trim();

      let nextDraft: CvTailorDraft | null = null;
      if (detail.tailorDraft && detail.tailorDraft.id.trim()) {
        nextDraft = {
          ...detail.tailorDraft,
          jobAnalysisId: analysisIdRematch || detail.tailorDraft.jobAnalysisId,
        };
        setTailorDraft(nextDraft);
        setTailoringCompleted(
          Boolean(detail.tailorDraft?.status === 'completed' || merged.isTailored === true),
        );
      } else {
        setTailorDraft((prevDraft) => {
          if (
            prevDraft &&
            (!analysisIdRematch || prevDraft.jobAnalysisId === analysisIdRematch) &&
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
          merged.scoreBeforeTailoring != null && Number.isFinite(merged.scoreBeforeTailoring)
            ? merged.scoreBeforeTailoring
            : nextDraft
              ? merged.matchScore
              : null;
        if (lockFrom != null && Number.isFinite(lockFrom)) {
          tailorBaselineScoreRef.current = Math.round(lockFrom);
        }
      }

      const scored = mergeTailorEstimatedScores(merged, nextDraft, tailorBaselineScoreRef.current);
      if (scored.lockedBaseline != null) tailorBaselineScoreRef.current = scored.lockedBaseline;
      setScoreBeforeTailor(scored.scoreBeforeTailor);
      analysisMergeRef.current = scored.analysis;
      setAnalysis(scored.analysis);
      setViewingSavedAnalysis(false);
      persistSessionSnapshot(title, company, description, scored.analysis);
      queryClient.setQueryData(['job-analysis-current'], scored.analysis);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profile', cvId] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['cv', 'score', cvId] });
      void queryClient.invalidateQueries({ queryKey: ['cv', 'score'] });
      void queryClient.invalidateQueries({ queryKey: cvSuggestionsQueryKey(cvId) });
      void queryClient.invalidateQueries({ queryKey: CV_SUGGESTIONS_QUERY_ROOT });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['cv', 'score', cvId] });
        void queryClient.invalidateQueries({ queryKey: ['cv', 'score'] });
      }, 2500);
      void queryClient.invalidateQueries({ queryKey: ['job-history'] });
      void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      invalidateTodayPlanQueries(queryClient);
      toast.success('Job match updated from your saved analysis');
    } catch (e) {
      const msg = getApiErrorMessage(e) || 'Could not refresh job match';
      toast.error(msg);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    } finally {
      setRematching(false);
    }
  }, [analysis?.id, cvProfileIdForTailor, description, queryClient, title, company, toast]);

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
  }, [cvProfiles, selectedProfileId, cv?.id]);

  const selectedProfile = useMemo((): CvProfileSummary | null => {
    const hit = cvProfiles.find((p) => p.id === selectedProfileId);
    if (hit) return hit;
    if (cv?.id && selectedProfileId === cv.id) {
      return {
        id: cv.id,
        name: inferCvProfileNameFromProfile(cv),
        score: null,
        isDefault: true,
        template: cv.template,
        updatedAt: cv.updatedAt,
      };
    }
    return null;
  }, [cvProfiles, selectedProfileId, cv]);
  const coverLetterDisplay = useMemo(
    () => {
      const plain = generated != null ? normalizeText(generated as unknown) : '';
      return plain.trim() ? substituteCoverLetterCandidateName(plain, candidateDisplayName) : null;
    },
    [generated, candidateDisplayName],
  );

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
      persistSessionSnapshot(detail.title, detail.company, detail.description, null);
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
        Boolean(detail.tailorDraft?.status === 'completed' || merged.isTailored === true),
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
        Boolean(merged.isTailored === true || detail.analysis.isTailored === true),
      );
    }
    setTailorSidebarOpen(false);
    persistSessionSnapshot(detail.title, detail.company, detail.description, merged);
  }, []);

  const loadJobById = useCallback(
    async (jobId: string, opts?: { clearUrl?: boolean }) => {
      let detail: JobDetailForForm | null = null;
      let usedHistoryFallback = false;

      try {
        detail = await api.jobs.getJob(jobId);
      } catch {
        await queryClient.ensureQueryData({
          queryKey: ['job-history'],
          queryFn: () => api.jobs.getHistory(),
        });
        const items = ensureArray<JobHistoryItem>(
          queryClient.getQueryData<JobHistoryItem[]>(['job-history']) ?? history.data,
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

      const cvForThisAnalysis = resolveCvProfileIdForSavedJob(detail);
      if (cvForThisAnalysis) {
        setSelectedProfileId(cvForThisAnalysis);
      }

      if (detail.analysis.hasCoverLetter) {
        try {
          const gen = await api.jobs.getGenerated(jobId);
          const letter = normalizeText(gen.coverLetter as unknown);
          setGenerated(letter.trim() ? letter : null);
        } catch {
          setGenerated(null);
        }
      } else {
        setGenerated(null);
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
      return true;
    },
    [applyDetail, history.data, queryClient, router, setActiveJobId, setSelectedProfileId, toast],
  );

  const sessionBootstrapped = useRef(false);
  const lastInitJobId = useRef<string | null>(null);
  const loadJobByIdRef = useRef(loadJobById);
  loadJobByIdRef.current = loadJobById;

  /** Deep-link ?jobId=, zustand activeJobId, or one-time sessionStorage when no job id. */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const jobId = jobIdFromUrl ?? activeJobId ?? null;

      if (!jobId) {
        lastInitJobId.current = null;
      }

      if (jobId) {
        pendingHubBookmarkIdRef.current = null;
        if (lastInitJobId.current === jobId) return;
        lastInitJobId.current = jobId;
        await loadJobByIdRef.current(jobId, { clearUrl: Boolean(jobIdFromUrl) });
        sessionBootstrapped.current = true;
        if (!cancelled) setHydrated(true);
        return;
      }

      if (sessionBootstrapped.current) return;
      sessionBootstrapped.current = true;

      const form = loadPersistedForm();
      const persistedAnalysis = loadPersistedAnalysis();
      let prefillJobDescription = '';
      let prefillTitle = '';
      let prefillCompany = '';
      let openTailorFromResume = false;
      if (typeof window !== 'undefined') {
        try {
          const sessionRaw = window.sessionStorage.getItem(FRESH_ANALYZE_PREFILL_SESSION);
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
            const prefetch = consumePrefetchByContextToken(contextTokenFromUrl);
            const selectedCvIdFromPrefetch = prefetch?.selectedCvId ?? '';
            const resumeWorkingStepFromPrefetch = prefetch?.resumeWorkingStep ?? '';
            pendingHubBookmarkIdRef.current =
              typeof p.hubBookmarkId === 'string' && p.hubBookmarkId.trim() ? p.hubBookmarkId.trim() : null;
            const selectedCvId =
              selectedCvIdFromPrefetch || (typeof p.selectedCvId === 'string' ? p.selectedCvId.trim() : '');
            if (selectedCvId) setSelectedProfileId(selectedCvId);
            const resumeWorkingStep =
              (
                resumeWorkingStepFromPrefetch ||
                (typeof p.resumeWorkingStep === 'string' ? p.resumeWorkingStep.trim() : '')
              ).toLowerCase();
            openTailorFromResume =
              resumeWorkingStep.includes('tailor') || resumeWorkingStep.includes('resume');
            if (typeof p.title === 'string' && p.title.trim()) prefillTitle = p.title;
            if (typeof p.company === 'string' && p.company.trim()) prefillCompany = p.company;
            if (typeof p.description === 'string' && p.description.trim()) prefillJobDescription = p.description;
            window.setTimeout(() => {
              try {
                window.sessionStorage.removeItem(FRESH_ANALYZE_PREFILL_SESSION);
              } catch {
                /* ignore */
              }
            }, 600);
          } else {
            pendingHubBookmarkIdRef.current = null;
          }
          if (!prefillJobDescription.trim()) {
            prefillJobDescription = window.localStorage.getItem('applymate_prefill_jd') ?? '';
            if (prefillJobDescription.trim()) window.localStorage.removeItem('applymate_prefill_jd');
          }
          if (!prefillTitle.trim()) {
            prefillTitle = window.localStorage.getItem('applymate_prefill_title') ?? '';
            if (prefillTitle.trim()) window.localStorage.removeItem('applymate_prefill_title');
          }
          if (!prefillCompany.trim()) {
            prefillCompany = window.localStorage.getItem('applymate_prefill_company') ?? '';
            if (prefillCompany.trim()) window.localStorage.removeItem('applymate_prefill_company');
          }
        } catch {
          /* ignore */
        }
      }
      setTitle(prefillTitle.trim() ? prefillTitle : form.title);
      setCompany(prefillCompany.trim() ? prefillCompany : form.company);
      const hasPrefillDescription = prefillJobDescription.trim().length > 0;
      setDescription(hasPrefillDescription ? prefillJobDescription : form.description);
      setAnalysis(hasPrefillDescription ? null : persistedAnalysis);
      if (!hasPrefillDescription && persistedAnalysis) {
        setViewingSavedAnalysis(true);
      } else if (hasPrefillDescription) {
        setViewingSavedAnalysis(false);
      }
      if (openTailorFromResume) setTailorSidebarOpen(true);
      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [jobIdFromUrl, activeJobId, contextTokenFromUrl]);

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
      /** See JobsAnalyzeContent — avoid clearing pre-tailor score when fingerprint shifts after loading a saved analysis. */
      setTailoringCompleted(false);
    }
  }, [hydrated, tailoringFp]);

  /** Restore completed tailoring for this job + CV after refresh or returning to the tab. */
  useEffect(() => {
    if (!hydrated || !analysis?.id || tailorDraft) return;
    const stored = loadCompletedTailorDraft(tailoringFp);
    if (stored?.status === 'completed' && stored.cvProfileId === cvProfileIdForTailor) {
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
      tailoringSessionFingerprint((selectedProfileId ?? cv?.id ?? '').trim(), title, company, description),
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
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_FORM_KEY);
      sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
    }
  };

  const recordApplication = useMutation({
    mutationFn: api.applications.create,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      const previous = queryClient.getQueryData<ApplicationItem[]>(['applications']);
      const optimistic: ApplicationItem = {
        id: `optimistic-${Date.now()}`,
        title: payload.title,
        company: payload.company,
        url: payload.url,
        matchScore: payload.matchScore,
        status: 'applied',
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ApplicationItem[]>(['applications'], (old = []) => [
        optimistic,
        ...old,
      ]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(['applications'], ctx?.previous ?? []);
    },
    onSuccess: () => {
      invalidateNotificationList(queryClient);
      scheduleUnreadNotificationCountInvalidate(queryClient);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
      invalidateGrowthQueries(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
  });

  const hasCoverLetter = Boolean(generated?.trim());

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

  const submit = () => {
    const parsed = schema.safeParse({ title, company, description });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    if (!canUseAiFromDailyAiUsage(aiUsage)) {
      toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
      return;
    }
    setError(null);
    analyze.mutate(
      {
        title,
        company,
        description,
        applicationQuestions: [],
        ...(selectedProfileId ? { cvProfileId: selectedProfileId } : {}),
      },
      {
        onSuccess: (res) => {
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
          setViewingSavedAnalysis(false);
          void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
          const analysisId = (res.id ?? '').trim();
          const hb = pendingHubBookmarkIdRef.current;
          if (hb && analysisId) {
            pendingHubBookmarkIdRef.current = null;
            void (async () => {
              try {
                await api.jobDiscovery.patchBookmark(hb, { jobAnalysisId: analysisId });
              } catch {
                try {
                  await api.users.patchHubBookmark(hb, { jobAnalysisId: analysisId });
                } catch {
                  /* ignore */
                }
              }
              void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
              invalidateTodayPlanQueries(queryClient);
            })();
          } else {
            pendingHubBookmarkIdRef.current = null;
          }
          toast.success('Job analyzed');
          trackFunnelEvent('analyze_completed', {
            jobAnalysisId: res.id ?? null,
            selectedCvId: selectedProfileId ?? null,
          });
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
          queryClient.invalidateQueries({ queryKey: ['me'] });
        },
      },
    );
  };

  const tailorDraftForCurrentJob =
    tailorDraft && analysis?.id && tailorDraft.jobAnalysisId === analysis.id ? tailorDraft : null;

  const tailorSectionComplete = useMemo(
    () =>
      Boolean(
        tailoringCompleted ||
          analysis?.isTailored ||
          tailorDraftForCurrentJob?.status === 'completed',
      ),
    [tailoringCompleted, analysis?.isTailored, tailorDraftForCurrentJob?.status],
  );

  const displayScoreBeforeTailor = useMemo(() => {
    if (scoreBeforeTailor != null && Number.isFinite(scoreBeforeTailor)) return scoreBeforeTailor;
    const a = analysis?.scoreBeforeTailoring;
    if (a != null && Number.isFinite(a)) return a;
    return null;
  }, [scoreBeforeTailor, analysis?.scoreBeforeTailoring]);

  const acceptedSkillNames = useMemo(() => {
    if (!tailorDraftForCurrentJob) return [];
    const drafts = tailorDraftForCurrentJob.drafts;
    const skillsDraft = drafts.find(
      (d: CvTailorDraftEntry) => d.sectionType === 'skills' && d.status === 'accepted',
    );
    if (skillsDraft) {
      return tailorDraftForCurrentJob.selectedSkills;
    }
    return [];
  }, [tailorDraftForCurrentJob]);

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

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden"
    >
      <div className="flex gap-6 overflow-x-auto border-b border-[#00C9B1]/10 sm:gap-8">
        <button
          type="button"
          onClick={() => router.replace('/dashboard/jobs')}
          className={cn(
            '-mb-px pb-3 text-sm font-semibold transition-colors duration-200 ease-out',
            jobsTab === 'analyze' ? 'border-b-2 border-[#00C9B1] text-white' : 'text-white/45',
          )}
        >
          Analyze
        </button>
        <button
          type="button"
          onClick={() => router.replace('/dashboard/jobs?tab=saved')}
          className={cn(
            '-mb-px pb-3 text-sm font-semibold transition-colors duration-200 ease-out',
            jobsTab === 'saved' ? 'border-b-2 border-[#00C9B1] text-white' : 'text-white/45',
          )}
        >
          Applications
        </button>
      </div>

      {jobsTab === 'saved' ? (
        <ApplicationsSavedPanel />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid w-full min-w-0 gap-4 lg:grid-cols-[40%_1fr]"
        >
      <GlowCard contentClassName="p-4 sm:p-5">
        {cvProfiles.length > 1 ? (
          <div className="mb-4 rounded-xl border border-[rgba(0,201,177,0.15)] bg-[#111616] px-4 py-3">
            <p className="text-xs font-semibold text-white/55">Which CV are we matching against?</p>
            <p className="mt-1 text-[11px] leading-snug text-white/40">
              Job fit below uses your structured CV. The rubric number is CV quality only — not the same as match % for
              this role.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <select
                className="min-w-[12rem] flex-1 rounded-lg border border-[rgba(0,201,177,0.2)] bg-[#0C0F0F] px-3 py-2 text-sm text-white outline-none focus:border-[#00C9B1]"
                value={selectedProfileId ?? ''}
                onChange={(e) => setSelectedProfileId(e.target.value || null)}
              >
                {cvProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectedProfile ? (
                <p className="text-xs text-white/45">
                  {selectedProfile.score !== null ? (
                    <span>
                      CV quality:{' '}
                      <span className="font-semibold text-white">{selectedProfile.score}</span>/100
                    </span>
                  ) : (
                    <span>Not scored yet</span>
                  )}
                  {selectedProfile.isDefault ? (
                    <span className="ml-2 text-[#00C9B1]">· ★ Default</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-lg font-extrabold text-white sm:text-xl">Analyze a Job</h2>
          <button
            type="button"
            onClick={clearForm}
            className="text-xs font-medium text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Clear form
          </button>
        </div>
        <div className="space-y-3">
          <Input value={title} onChange={setTitle} placeholder="Job Title (optional)" />
          <Input value={company} onChange={setCompany} placeholder="Company (optional)" />
          <textarea
            className="h-36 w-full min-w-0 rounded-xl border border-[#00C9B1]/20 bg-[#111616] px-3 py-3 text-sm text-white outline-none transition focus:border-[#00C9B1] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)] sm:h-44 sm:px-4"
            placeholder="Paste the full job description here..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          <Button
            fullWidth
            onClick={submit}
            title={
              viewingSavedAnalysis
                ? 'This job is already analyzed. Clear the form to run analysis on another posting.'
                : undefined
            }
            disabled={
              analyze.isPending ||
              viewingSavedAnalysis ||
              (cvProfiles.length > 1 && !selectedProfileId) ||
              (!aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0)
            }
          >
            {analyze.isPending
              ? 'Analyzing...'
              : viewingSavedAnalysis
                ? 'Already analyzed'
                : !aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0
                  ? 'Daily AI limit reached'
                  : 'Analyze Job'}
          </Button>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-white">Recent analyses</p>
          <div className="space-y-2">
            {ensureArray<JobHistoryItem>(history.data).slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={historyLoadingId === item.id}
                onClick={async () => {
                  setHistoryLoadingId(item.id);
                  try {
                    await loadJobById(item.id);
                  } finally {
                    setHistoryLoadingId(null);
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-white/75 hover:bg-white/[0.05] disabled:opacity-50"
              >
                <p className="font-medium">{item.company ?? 'Unknown company'}</p>
                <p className="text-xs text-white/45">
                  {historyLoadingId === item.id ? 'Loading…' : item.jobTitle || item.title || 'Untitled role'}
                </p>
              </button>
            ))}
          </div>
        </div>
      </GlowCard>

      <GlowCard contentClassName="min-w-0 p-4 sm:p-6">
        {!analysis ? (
          <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
            <Search className="mb-3 h-16 w-16 text-[#00C9B1]" />
            <p className="text-lg font-semibold text-white">Paste a job description to see your match score</p>
          </div>
        ) : (
          <div className="space-y-4">
            <JobAnalysisCard
              key={analysis.id}
              analysis={analysis}
              rematchInProgress={rematching}
              scoreBeforeTailor={displayScoreBeforeTailor}
              isTailored={tailorSectionComplete}
              acceptedSkillNames={acceptedSkillNames}
              showTailorAction={true}
            />
            <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-[#00C9B1]/15 bg-[#0C0F0F] p-4 sm:p-6">
              {(analysis.missingSkills ?? []).length === 0 ? (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-white">Tailor your CV to this job</h3>
                  <p className="text-xs text-white/45">No skill gaps were returned for this job.</p>
                </>
              ) : tailorSectionComplete ? (
                <>
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                    <span className="mt-0.5 text-emerald-400" aria-hidden>
                      ✓
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">CV tailored for this role</p>
                      <p className="mt-1 text-xs text-white/50">
                        Changes are saved on your CV.
                        {tailorDraftForCurrentJob
                          ? ' Open the panel to review before/after sections and export.'
                          : ' If section details don’t load, use Refresh match score — your tailored CV is still on file.'}
                      </p>
                      {displayScoreBeforeTailor != null && Number.isFinite(displayScoreBeforeTailor) ? (
                        <p
                          className={cn(
                            'mt-2 text-xs',
                            analysis.matchScore > displayScoreBeforeTailor
                              ? 'text-emerald-200/90'
                              : analysis.matchScore === displayScoreBeforeTailor
                                ? 'text-white/45'
                                : 'text-amber-200/85',
                          )}
                        >
                          Job fit: {Math.round(displayScoreBeforeTailor)}% → {Math.round(analysis.matchScore)}
                          {analysis.matchScore === displayScoreBeforeTailor ? ' (no change)' : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {tailorDraftForCurrentJob ? (
                    <Button type="button" fullWidth className="gap-2" onClick={() => setTailorSidebarOpen(true)}>
                      <span className="text-base leading-none" aria-hidden>
                        ✦
                      </span>
                      View tailored CV & changes
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    className={cn('gap-2', tailorDraftForCurrentJob && 'mt-2')}
                    disabled={rematching || analyze.isPending}
                    onClick={() => void rematchJobToUpdatedCv()}
                  >
                    {rematching ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        Refreshing match…
                      </>
                    ) : (
                      'Refresh match score'
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="mb-3 text-sm font-semibold text-white">Tailor your CV to this job</h3>
                  <p className="mb-3 text-xs text-white/50">
                    Select which gaps to address. Critical and high-importance skills are pre-selected.
                  </p>
                  <div className="flex flex-col gap-2">
                    {(analysis.missingSkills ?? []).map((skill) => {
                      const checked = selectedSkillNames.includes(skill.name);
                      const badgeVariant =
                        skill.importance === 'CRITICAL' || skill.importance === 'HIGH'
                          ? 'red'
                          : skill.importance === 'MEDIUM'
                            ? 'amber'
                            : 'muted';
                      return (
                        <label
                          key={skill.name}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                            checked
                              ? 'border-[#00C9B1]/35 bg-[rgba(0,201,177,0.07)]'
                              : 'border-white/10 bg-white/[0.02] hover:border-white/15',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 rounded border-white/20 bg-[#111616] text-[#00C9B1] focus:ring-[#00C9B1]/40"
                            checked={checked}
                            onChange={() => toggleSkillSelected(skill.name)}
                          />
                          <span className="min-w-0 flex-1 text-sm text-white/90">{skill.name}</span>
                          <Badge variant={badgeVariant}>{skill.importance}</Badge>
                        </label>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    fullWidth
                    className="mt-4 gap-2"
                    disabled={
                      tailorSubmitting ||
                      selectedSkillNames.length === 0 ||
                      !jobAnalysisIdForTailor ||
                      (!cvProfileIdForTailor && !cvBootstrapPending) ||
                      (cvProfiles.length > 1 && !selectedProfileId) ||
                      tailorAiBlocked
                    }
                    title={
                      !jobAnalysisIdForTailor
                        ? 'This analysis is not linked to a saved job record yet — open this job from Recent analyses, or Clear form and run Analyze again.'
                        : tailorAiBlocked
                          ? DAILY_AI_LIMIT_REACHED_MESSAGE
                          : cvProfiles.length > 1 && !selectedProfileId
                            ? 'Choose which CV to tailor in the dropdown above.'
                            : !cvProfileIdForTailor && !cvBootstrapPending
                              ? 'Upload or select a CV profile first.'
                              : selectedSkillNames.length === 0
                                ? 'Select at least one skill gap to tailor toward.'
                                : undefined
                    }
                    onClick={() => void handleCreateTailorDraft()}
                  >
                    {tailorSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-base leading-none" aria-hidden>
                        ✦
                      </span>
                    )}
                    {tailorSubmitting
                      ? 'Tailoring…'
                      : tailorDraftForCurrentJob
                        ? 'Re-tailor CV'
                        : 'Tailor to Job'}
                  </Button>
                  {analysis && !jobAnalysisIdForTailor ? (
                    <p className="mt-2 text-xs text-amber-200/85">
                      Tailoring needs a saved job id. We try to attach it from Recent analyses automatically — if this
                      stays disabled, click this job in the list on the left, or use{' '}
                      <span className="font-semibold text-white/90">Clear form</span> and run{' '}
                      <span className="font-semibold text-white/90">Analyze Job</span> once more.
                    </p>
                  ) : null}
                  {tailorDraftForCurrentJob ? (
                    <button
                      type="button"
                      onClick={() => setTailorSidebarOpen(true)}
                      className="mt-3 w-full rounded-xl border border-white/15 bg-transparent py-2 text-center text-xs font-semibold text-[#00C9B1] transition hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/5"
                    >
                      Resume tailoring →
                    </button>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                title={
                  hasCoverLetter
                    ? 'You already have a cover letter for this job. Clear the form to generate another.'
                    : undefined
                }
                disabled={
                  hasCoverLetter ||
                  generate.isPending ||
                  recordApplication.isPending ||
                  (!aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0)
                }
                onClick={() => {
                  if (!canUseAiFromDailyAiUsage(aiUsage)) {
                    toast.error(DAILY_AI_LIMIT_REACHED_MESSAGE);
                    return;
                  }
                  generate.mutate(
                    {
                      title,
                      company,
                      description,
                      questions: [],
                      ...(analysis?.id?.trim() ? { jobAnalysisId: analysis.id.trim() } : {}),
                    },
                    {
                      onSuccess: async (res) => {
                        const raw = normalizeText(res.coverLetter as unknown).trim();
                        const letter = raw !== '' ? raw : 'Generated content received.';
                        setGenerated(letter);
                        try {
                          await recordApplication.mutateAsync({
                            title: title || 'Untitled role',
                            company: company || 'Unknown company',
                            url: '',
                            matchScore: analysis.matchScore,
                          });
                          toast.success('Job saved to your list');
                          trackFunnelEvent('apply_completed', {
                            jobAnalysisId: analysis.id ?? null,
                            title,
                            company,
                          });
                          void api.growth.trackEvent({
                            eventName: 'apply_completed',
                            context: { jobAnalysisId: analysis.id ?? null, title, company },
                          });
                          void consumeGrowthFeedback();
                        } catch {
                          toast.error(
                            'Cover letter is ready, but it could not be saved to your tracker. You can still copy or download it below.',
                          );
                        } finally {
                          void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
                          invalidateTodayPlanQueries(queryClient);
                        }
                      },
                      onError: (err) => {
                        toast.error(getApiErrorMessage(err));
                        queryClient.invalidateQueries({ queryKey: ['me'] });
                      },
                    },
                  );
                }}
              >
                {recordApplication.isPending
                  ? 'Saving...'
                  : generate.isPending
                  ? 'Generating...'
                  : hasCoverLetter
                    ? 'Cover letter ready'
                    : !aiUsage.isPaidTier && !aiUsage.isLoading && (aiUsage.remaining ?? 0) === 0
                      ? 'Daily AI limit reached'
                      : 'Generate cover letter'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
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
                  const analyzedCv = (analysis?.sourceCvProfileId ?? analysis?.cvProfileId ?? '').trim();
                  const baseCv = (analysis?.cvProfileId ?? selectedProfileId ?? cv?.id ?? '').trim();
                  if (analysisId) qp.set('jobAnalysisId', analysisId);
                  if (title.trim()) qp.set('jobTitle', title.trim());
                  if (company.trim()) qp.set('company', company.trim());
                  if (preferredCv) {
                    qp.set('preferredCvProfileId', preferredCv);
                    qp.set('tailoringCvProfileId', preferredCv);
                  }
                  if (analyzedCv) qp.set('analyzedCvProfileId', analyzedCv);
                  if (baseCv) qp.set('cvProfileId', baseCv);
                  router.push(`/dashboard/interview${qp.toString() ? `?${qp.toString()}` : ''}`);
                }}
              >
                Start Mock Interview
              </Button>
            </div>
            {hasCoverLetter ? (
              <div className="overflow-hidden rounded-xl border border-[#00C9B1]/20 bg-gradient-to-b from-[#121a1a]/95 to-[#0c1212] shadow-[inset_0_1px_0_rgba(0,201,177,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#00C9B1]/12 bg-[rgba(0,201,177,0.06)] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Cover letter</p>
                    <p className="text-xs text-white/40">Copy, download as PDF, or edit before you apply</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyCoverLetter()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#111616]/80 px-3 py-2 text-xs font-semibold text-white/85 transition hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/10 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5 text-[#00C9B1]" strokeWidth={2} />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={saveCoverLetterPdf}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#111616]/80 px-3 py-2 text-xs font-semibold text-white/85 transition hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/10 hover:text-white"
                    >
                      <FileDown className="h-3.5 w-3.5 text-[#00C9B1]" strokeWidth={2} />
                      PDF
                    </button>
                  </div>
                </div>
                <div className="max-h-[min(52vh,520px)] overflow-y-auto px-4 py-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{coverLetterDisplay}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </GlowCard>
        </motion.div>
      )}
    </motion.div>
    <CvTailoringSidebar
      open={tailorSidebarOpen}
      onClose={() => setTailorSidebarOpen(false)}
      draft={tailorDraft}
      onTailorMutation={applyTailorMutation}
      jobTitle={analysis?.title ?? title}
      jobCompany={analysis?.company ?? company}
      exportTemplate={selectedProfile?.template ?? cv?.template ?? null}
      onTailoringCvPersisted={() => {
        scheduleRematchAfterTailoring();
        void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
        invalidateTodayPlanQueries(queryClient);
      }}
      scoreBeforeTailor={displayScoreBeforeTailor}
      currentScore={analysis?.matchScore ?? null}
      tailoredCvName={analysis?.tailoredCvName ?? tailorDraft?.tailoredCvName ?? null}
      jobAnalysisId={jobAnalysisIdForTailor || null}
    />
    </>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-[#00C9B1]/20 bg-[#111616] px-4 py-3 text-sm text-white outline-none transition focus:border-[#00C9B1] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)]"
    />
  );
}
