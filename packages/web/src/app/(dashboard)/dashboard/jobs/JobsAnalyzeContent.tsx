'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Copy, FileDown, Loader2, Mic, Pencil, RotateCcw, Search, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import { CvTailoringSidebar } from '@/components/dashboard/CvTailoringSidebar';
import { JobAnalysisCard } from '@/components/dashboard/JobAnalysisCard';
import { ScoreImprovementGuideCard } from '@/components/job-analysis/ScoreImprovementGuideCard';
import { AiRecruiterReportSection } from '@/components/job-analysis/AiRecruiterReportSection';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { useToast } from '@/components/ui/Toast';
import { useAnalyzeJob } from '@/hooks/useAnalyzeJob';
import { useJobApplyUrl } from '@/hooks/useJobApplyUrl';
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
  type JobListingDto,
  type TailorMutationResponse,
} from '@/lib/api';
import { preferApiCvProfileName } from '@/lib/cv-profile-naming';
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
import { canonicalWorkflowEntityId, markExecutionComplete, recordExecutionCheckpoint } from '@/lib/executionMemory';
import { resolveAnalysisAfterTailorMutation } from '@/lib/applyTailorMutation';
import { mergeTailorEstimatedScores } from '@/lib/tailorMatchScore';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { ensureArray } from '@/lib/ensure-array';
import { openExternalJobApplyUrl } from '@/lib/jobApplyUrl';
import { applyUrlAnalyzePayload } from '@/lib/jobApplyUrlPick';
import { shouldShowScoreImprovementGuide } from '@/lib/scoreImprovement';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';

const STORAGE_FORM_KEY = 'applymate:dashboard:jobs:analyze-form';
const STORAGE_ANALYSIS_KEY = 'applymate:dashboard:jobs:last-analysis';
/** Completed tailor drafts keyed by CV + job text (survives refresh; cleared when JD/CV context changes). */
const STORAGE_COMPLETED_TAILOR_KEY = 'applymate:dashboard:jobs:completed-tailor-by-fp';
const STORAGE_LAST_JOB_ID = 'applymate:dashboard:jobs:last-job-id';

function coverLetterStorageKey(jobId: string) {
  return `applymate:cover-letter:${jobId}`;
}

function readCoverLetterFromStorage(jobId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(coverLetterStorageKey(jobId));
    return raw?.trim() ? raw : null;
  } catch {
    return null;
  }
}

function writeCoverLetterToStorage(jobId: string, text: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(coverLetterStorageKey(jobId), text);
  } catch {
    /* ignore */
  }
}

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

/** Discovery listings often omit full HTML description; merge fields so analyze + auto-run can proceed. */
function buildAnalyzerDescriptionFromListing(d: JobListingDto): string {
  const chunks = [d.description, d.snippet, d.whyThisJobShort]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  let text = chunks.join('\n\n').trim();
  if (text.length < 30) {
    const meta = [
      d.title?.trim() ? `Job title: ${d.title.trim()}` : '',
      d.company?.trim() ? `Company: ${d.company.trim()}` : '',
      d.location?.trim() ? `Location: ${d.location.trim()}` : '',
      d.url?.trim() ? `Listing URL: ${d.url.trim()}` : '',
    ].filter(Boolean);
    if (meta.length) {
      text = [text, meta.join('\n')].filter(Boolean).join('\n\n');
    }
  }
  return text;
}

const MIN_DESC_MANUAL_ANALYZE = 30;
const MIN_DESC_LISTING_ANALYZE = 10;

function minDescriptionCharsForAnalyze(jobListingId: string | undefined | null): number {
  return (jobListingId ?? '').trim() ? MIN_DESC_LISTING_ANALYZE : MIN_DESC_MANUAL_ANALYZE;
}

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
      ...(item.analysisV2 ? { analysisV2: item.analysisV2 } : {}),
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

export function JobsAnalyzeContent() {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [coverLetterAiBaseline, setCoverLetterAiBaseline] = useState<string | null>(null);
  const [coverLetterEditing, setCoverLetterEditing] = useState(false);
  const [coverLetterDraft, setCoverLetterDraft] = useState('');
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
  const jobListingIdFromUrl = searchParams.get('jobListingId')?.trim() ?? '';
  const openTailorFromUrl = searchParams.get('openTailor') === '1';
  const tailorSectionFromUrl = searchParams.get('tailorSection')?.trim().toLowerCase() ?? '';
  const freshAnalyzerParam = searchParams.get('new');
  const cleanAnalyzerParam = searchParams.get('clean');
  const fromBoardFromUrl = searchParams.get('fromBoard') === '1';
  const cvProfileIdFromUrl = searchParams.get('cvProfileId')?.trim() ?? '';

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
  /** Locked at tailor start — never replaced by optimistic server rematch scores. */
  const tailorBaselineScoreRef = useRef<number | null>(null);
  /** From Job Hub “Analyze” prefill — PATCH bookmark after first successful analyze. */
  const pendingHubBookmarkIdRef = useRef<string | null>(null);
  const listingAutoAnalyzeRef = useRef(false);
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
  const jobListingIdForTailor = (analysis?.jobListingId ?? jobListingIdFromUrl ?? '').trim();
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
    () => tailoringSessionFingerprint(tailoringFormProfileId, title, company, description),
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
    if (cvProfileIdFromUrl && cvProfiles.some((p) => p.id === cvProfileIdFromUrl)) {
      setSelectedProfileId(cvProfileIdFromUrl);
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
  }, [cvProfileIdFromUrl, cvProfiles, selectedProfileId, cv?.id]);

  const selectedProfile = useMemo((): CvProfileSummary | null => {
    const hit = cvProfiles.find((p) => p.id === selectedProfileId);
    if (hit) {
      return {
        ...hit,
        name: preferApiCvProfileName(hit.name, inferCvProfileNameFromProfile(cv)),
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

    const embeddedLetter = detail.generatedContent?.coverLetter?.trim();
    if (embeddedLetter) {
      setGenerated(embeddedLetter);
      setCoverLetterAiBaseline(embeddedLetter);
    }
  }, []);

  const loadJobById = useCallback(
    async (jobId: string, opts?: { clearUrl?: boolean; openTailor?: boolean }) => {
      let detail: JobDetailForForm | null = null;
      let usedHistoryFallback = false;

      try {
        detail = await api.jobs.getJob(jobId);
      } catch {
        const historyKey = ['job-history', true] as const;
        await queryClient.ensureQueryData({
          queryKey: historyKey,
          queryFn: () => api.jobs.getHistory({ includeAccepted: true }),
        });
        const items = ensureArray<JobHistoryItem>(
          queryClient.getQueryData<JobHistoryItem[]>(historyKey) ?? history.data,
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
      try {
        sessionStorage.setItem(STORAGE_LAST_JOB_ID, jobId);
      } catch {
        /* ignore */
      }

      const boardCv =
        fromBoardFromUrl && cvProfileIdFromUrl && cvProfiles.some((p) => p.id === cvProfileIdFromUrl)
          ? cvProfileIdFromUrl
          : null;
      const cvForThisAnalysis = boardCv ?? resolveCvProfileIdForSavedJob(detail);
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
      const wantsFreshAnalyzer = freshAnalyzerParam === '1' || cleanAnalyzerParam === '1';

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
              // Do not remove session here: React Strict Mode remounts before URL replace, and a
              // second mount must read the same payload. Clear with localStorage keys after delay.
              prefillTitle = typeof p.title === 'string' ? p.title : '';
              prefillCompany = typeof p.company === 'string' ? p.company : '';
              prefillJobDescription = typeof p.description === 'string' ? p.description : '';
              const hb = typeof p.hubBookmarkId === 'string' ? p.hubBookmarkId.trim() : '';
              pendingHubBookmarkIdRef.current = hb || null;
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
            }
            if (!prefillTitle.trim() && !prefillCompany.trim() && !prefillJobDescription.trim()) {
              prefillJobDescription = window.localStorage.getItem('applymate_prefill_jd') ?? '';
              prefillTitle = window.localStorage.getItem('applymate_prefill_title') ?? '';
              prefillCompany = window.localStorage.getItem('applymate_prefill_company') ?? '';
            }
            window.setTimeout(() => {
              try {
                window.sessionStorage.removeItem(FRESH_ANALYZE_PREFILL_SESSION);
                if (prefillJobDescription.trim()) window.localStorage.removeItem('applymate_prefill_jd');
                if (prefillTitle.trim()) window.localStorage.removeItem('applymate_prefill_title');
                if (prefillCompany.trim()) window.localStorage.removeItem('applymate_prefill_company');
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
        setDescription(prefillJobDescription.trim() ? prefillJobDescription : '');
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
          router.replace(`/dashboard/jobs/analyze?${q.toString()}`, { scroll: false });
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
          prefillJobDescription = window.localStorage.getItem('applymate_prefill_jd') ?? '';
          if (prefillJobDescription.trim()) {
            window.localStorage.removeItem('applymate_prefill_jd');
          }
          prefillTitle = window.localStorage.getItem('applymate_prefill_title') ?? '';
          if (prefillTitle.trim()) {
            window.localStorage.removeItem('applymate_prefill_title');
          }
          prefillCompany = window.localStorage.getItem('applymate_prefill_company') ?? '';
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
      setDescription(hasPrefillDescription ? prefillJobDescription : form.description);
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
    activeJobId,
    freshAnalyzerParam,
    cleanAnalyzerParam,
    fromBoardFromUrl,
    router,
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
    setAwaitingListingAnalysis(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_FORM_KEY);
      sessionStorage.removeItem(STORAGE_ANALYSIS_KEY);
      sessionStorage.removeItem(STORAGE_LAST_JOB_ID);
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
      void queryClient.invalidateQueries({ queryKey: ['job-analyses'] });
      const analysisId = (res.id ?? '').trim();
      const jlCapture = (jobListingIdFromUrl || analyzeJobListingIdRef.current || '').trim();
      if (analysisId && jlCapture) {
        listingPipelineAutoDoneRef.current = jlCapture;
      }
      if (analysisId) analyzeJobListingIdRef.current = null;
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
              /* bookmark may already be linked or route missing */
            }
          }
          await queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
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
    [company, cv?.id, cvProfiles, description, jobListingIdFromUrl, queryClient, selectedProfileId, title, toast],
  );

  const runAnalyze = useCallback(
    (opts?: { useAi?: boolean; forceRefresh?: boolean }) => {
      const jl = (jobListingIdFromUrl || analyzeJobListingIdRef.current || '').trim();
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
        const parsed = schema.safeParse({ title, company, description });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Invalid input');
          return;
        }
      }

      const explicitHeuristicPersist = opts?.useAi === false;
      const forceRefresh = opts?.forceRefresh === true;

      /** Default persisted path: omit useAi → server uses Gemini when allowed. */
      if (!explicitHeuristicPersist && !canUseAiFromDailyAiUsage(aiUsage)) {
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
          void queryClient.invalidateQueries({ queryKey: ['me'] });
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
    ],
  );

  const submit = () => runAnalyze(viewingSavedAnalysis ? { forceRefresh: true } : {});

  useEffect(() => {
    if (!hydrated || jobIdFromUrl?.trim()) return;
    if (!jobListingIdFromUrl || analysis || viewingSavedAnalysis) return;
    if (listingPipelineAutoDoneRef.current === jobListingIdFromUrl) return;
    if (analyze.isPending || aiReportPending) return;
    if (listingAutoAnalyzeRef.current) return;
    if (description.trim().length < minDescriptionCharsForAnalyze(jobListingIdFromUrl)) return;
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
      router.replace(`/dashboard/jobs/analyze?jobId=${encodeURIComponent(jid)}`, { scroll: false });
      return;
    }

    if (viewingSavedAnalysis) return;
    if (analyze.isPending || aiReportPending) return;
    if (jobIdFromBoardAutoRanRef.current === jid) return;
    if (description.trim().length < minDescriptionCharsForAnalyze(jobListingIdFromUrl)) return;
    if (cvProfiles.length > 1 && !selectedProfileId) return;

    jobIdFromBoardAutoRanRef.current = jid;
    runAnalyze({});
    router.replace(`/dashboard/jobs/analyze?jobId=${encodeURIComponent(jid)}`, { scroll: false });
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
    tailorDraft && analysis?.id && tailorDraft.jobAnalysisId === analysis.id ? tailorDraft : null;

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
    [tailoringCompleted, analysis?.isTailored, tailorDraftForCurrentJob?.status],
  );

  const lastCheckpointKeyRef = useRef<string | null>(null);
  const computeTailorPct = useCallback((d: CvTailorDraft | null): number | null => {
    if (!d || !Array.isArray(d.drafts) || d.drafts.length === 0) return null;
    const reviewed = d.drafts.filter((x) => x.status === 'accepted' || x.status === 'rejected').length;
    return Math.round((reviewed / d.drafts.length) * 100);
  }, []);

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
      hydrationConsistencyKey: jobListingIdForTailor ? `tailor:job:${jobListingIdForTailor}:v1` : `tailor:job:${jobAnalysisIdForTailor}:v1`,
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
    void markExecutionComplete({ workflowEntityId: entityId, executionType: 'tailor' }).catch(() => {
      /* non-blocking */
    });
  }, [tailorSectionComplete, jobAnalysisIdForTailor, jobListingIdForTailor]);

  /** Prefer local state (live tailor flow); fall back to API so Score Change survives fingerprint/profile churn. */
  const displayScoreBeforeTailor = useMemo(() => {
    if (scoreBeforeTailor != null && Number.isFinite(scoreBeforeTailor)) return scoreBeforeTailor;
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
      (d: CvTailorDraftEntry) => d.sectionType === 'skills' && d.status === 'accepted',
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

  const analysisMutationBusy = analyze.isPending || aiReportPending;
  const listingAutoBlockedByCv =
    Boolean(jobListingIdFromUrl) && cvProfiles.length > 1 && !selectedProfileId;
  const showEmptyStateLoader =
    hydrated &&
    !analysis &&
    !listingAutoBlockedByCv &&
    (analysisMutationBusy || awaitingListingAnalysis);
  const showResultsRefreshing = hydrated && Boolean(analysis) && analysisMutationBusy;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="flex w-full min-w-0 max-w-full min-h-[calc(100dvh-7.5rem)] flex-col space-y-4 overflow-x-hidden"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid w-full min-w-0 flex-1 min-h-0 gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,1fr)] lg:items-stretch"
      >
        <div className="flex min-h-0 flex-col lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:pr-1 app-scrollbar">
          <div data-tour="analyzer-form" className="min-h-0 shrink-0">
          <GlowCard className="min-h-0 shrink-0" contentClassName="flex flex-col p-4 sm:p-5">
            {cvProfiles.length > 1 ? (
              <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 sm:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">Matching against</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    className="h-11 min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-[#141f21] px-3.5 text-sm text-white outline-none transition [color-scheme:dark] focus:border-[rgba(0,201,177,0.4)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)] sm:min-w-[12rem]"
                    value={selectedProfileId ?? ''}
                    onChange={(e) => setSelectedProfileId(e.target.value || null)}
                  >
                    {cvProfiles.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#141f21] text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {selectedProfile ? (
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[13px] font-semibold tabular-nums',
                        selectedProfile.score == null
                          ? 'border-white/12 text-white/45'
                          : selectedProfile.score >= 70
                            ? 'border-[#00C9B1]/35 bg-[rgba(0,201,177,0.1)] text-[#00C9B1]'
                            : selectedProfile.score >= 40
                              ? 'border-amber-500/35 bg-[rgba(245,158,11,0.12)] text-[#F59E0B]'
                              : 'border-rose-500/35 bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
                      )}
                    >
                      {selectedProfile.score !== null ? `${selectedProfile.score}/100` : '—'}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-[12px] text-white/35">
                  Job fit uses your structured CV. CV quality is separate from role match %.
                  {selectedProfile?.isDefault ? (
                    <span className="ml-1 font-medium text-[#00C9B1]">Default CV</span>
                  ) : null}
                </p>
              </div>
            ) : null}
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-white sm:text-[16px]">Analyze a Job</h2>
              <button
                type="button"
                onClick={clearForm}
                className="min-h-[44px] self-start text-left text-[12px] font-medium text-white/35 underline-offset-2 hover:text-white/55 hover:underline sm:self-center"
              >
                Clear form
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <Input label="Job title" value={title} onChange={setTitle} placeholder="e.g. Senior Frontend Engineer" />
              <Input label="Company" value={company} onChange={setCompany} placeholder="e.g. Acme Inc." />
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-white/50" htmlFor="analyze-jd">
                  Job description
                </label>
                <div className="relative">
                  <textarea
                    id="analyze-jd"
                    className="min-h-[180px] w-full min-w-0 resize-y rounded-[10px] border border-white/[0.1] bg-white/[0.04] px-4 py-3 pb-8 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)]"
                    placeholder="Paste the full job description here..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-white/30">
                    {descriptionWordCount} words
                  </span>
                </div>
              </div>
              {error ? <p className="text-xs text-red-300">{error}</p> : null}
              <Button
                fullWidth
                variant="primary"
                onClick={submit}
                disabled={
                  analyze.isPending || (cvProfiles.length > 1 && !selectedProfileId)
                }
                className="min-h-[52px] rounded-[10px] bg-gradient-to-br from-[#00C9B1] to-[#00A896] text-[15px] font-semibold text-[#080A0A] shadow-[0_6px_24px_rgba(0,201,177,0.35)] transition hover:brightness-105 active:scale-[0.99]"
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
              <p className="text-center text-[11px] leading-relaxed text-white/40">
                Runs match scoring and your AI recruiter report (when quota allows). The report opens
                collapsed below with a glowing header.
              </p>
            </div>
            <div className="mt-8 border-t border-white/[0.06] pt-6" data-tour="analyzer-history">
              <p className="mb-3 text-[14px] font-semibold text-white/70">Recent analyses</p>
              <div className="flex flex-col gap-1.5">
                {ensureArray<JobHistoryItem>(history.data).slice(0, 3).map((item) => {
                  const active = analysis?.id === item.id;
                  const sc = item.matchScore;
                  return (
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
                      className={cn(
                        'flex min-h-[48px] w-full items-center gap-3 rounded-[10px] border border-l-2 px-3 py-2.5 text-left transition sm:px-4',
                        active
                          ? 'border-[rgba(0,201,177,0.2)] border-l-[#00C9B1] bg-[rgba(0,201,177,0.06)]'
                          : 'border-white/[0.06] border-l-transparent bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.06]',
                      )}
                    >
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-[12px] font-semibold text-white/60">
                        {(item.company ?? '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">
                          {item.company ?? 'Unknown company'}
                        </p>
                        <p className="truncate text-[12px] text-white/45">
                          {historyLoadingId === item.id ? 'Loading…' : item.jobTitle || item.title || 'Untitled role'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums',
                          sc == null || !Number.isFinite(sc)
                            ? 'border-white/10 text-white/25'
                            : sc >= 70
                              ? 'border-[#00C9B1]/35 bg-[rgba(0,201,177,0.12)] text-[#00C9B1]'
                              : sc >= 40
                                ? 'border-amber-500/35 bg-[rgba(245,158,11,0.12)] text-[#F59E0B]'
                                : 'border-rose-500/35 bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
                        )}
                      >
                        {sc != null && Number.isFinite(sc) ? `${Math.round(sc)}%` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </GlowCard>
          </div>
        </div>

        <div
          data-tour="analyzer-results"
          className="flex min-h-0 min-w-0 flex-col border-t border-white/[0.06] pt-6 lg:min-h-full lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          <div className="min-h-0 flex-1 overflow-y-auto lg:pr-1 app-scrollbar">
            <GlowCard className="min-h-[min(100%,32rem)]" contentClassName="min-w-0 p-4 sm:p-6">
        {listingAutoBlockedByCv ? (
          <div className="flex min-h-[480px] flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-lg font-semibold text-white">Choose a CV first</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/45">
              Select which resume to match against this job using the dropdown on the left. We will run the AI
              analysis against that profile.
            </p>
          </div>
        ) : showEmptyStateLoader ? (
          <AnalyzerResultsLoadingShell variant="empty" />
        ) : !analysis ? (
          <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
            <Search className="mb-3 h-16 w-16 text-[#00C9B1]" />
            <p className="text-lg font-semibold text-white">Paste a job description to see your match score</p>
          </div>
        ) : (
          <div className="relative min-h-[200px]">
            {showResultsRefreshing ? <AnalyzerResultsLoadingShell variant="overlay" /> : null}
            <div
              className={cn(
                'space-y-4',
                showResultsRefreshing && 'pointer-events-none select-none opacity-[0.38]',
              )}
            >
            <JobAnalysisCard
              key={analysis.id}
              analysis={analysis}
              hideAiReport
              rematchInProgress={rematching}
              scoreBeforeTailor={displayScoreBeforeTailor}
              isTailored={tailorSectionComplete}
              acceptedSkillNames={acceptedSkillNames}
              applyUrl={resolvedApplyUrl}
              onTailorFirst={() => {
                if (tailorSectionComplete || tailorDraftForCurrentJob) {
                  void openTailorPanel();
                  return;
                }
                void handleCreateTailorDraft();
              }}
              onApplyNow={handleApplyOnCompanySite}
            />
            {shouldShowScoreImprovementGuide(analysis.scoreImprovement) ? (
              <ScoreImprovementGuideCard guide={analysis.scoreImprovement!} />
            ) : null}
            <AiRecruiterReportSection
              analysis={analysis}
              loading={analyze.isPending || aiReportPending}
              applyUrl={resolvedApplyUrl}
              isTailored={tailorSectionComplete}
              onTailorFirst={() => {
                if (tailorSectionComplete || tailorDraftForCurrentJob) {
                  void openTailorPanel();
                  return;
                }
                void handleCreateTailorDraft();
              }}
              onApplyNow={handleApplyOnCompanySite}
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
                  <Button
                    type="button"
                    fullWidth
                    className="gap-2"
                    onClick={() => void openTailorPanel()}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      ✦
                    </span>
                    View tailored CV & changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    className="mt-2 gap-2"
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
                  <h3 className="mb-3 text-sm font-semibold text-white">
                    {tailorSectionComplete ? 'Gaps addressed' : 'Tailor your CV to this job'}
                  </h3>
                  {!tailorSectionComplete ? (
                  <p className="mb-3 text-xs text-white/50">
                    Select which gaps to address. Critical and high-importance skills are pre-selected.
                  </p>
                  ) : null}
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
            <div className="flex flex-wrap items-stretch gap-3">
              <Button
                variant="ghost"
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
                className="min-h-[44px] gap-2 rounded-full border border-[#00C9B1]/40 bg-transparent px-5 text-[13px] font-medium text-[#00C9B1] hover:bg-[#00C9B1]/10"
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
                        setCoverLetterAiBaseline(letter);
                        setCoverLetterEditing(false);
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
                className="min-h-[44px] gap-2 rounded-full border border-white/15 bg-transparent px-5 text-[13px] font-medium text-white/70 hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
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
                <Mic className="h-4 w-4 shrink-0 text-white/55" strokeWidth={2} aria-hidden />
                Start Mock Interview
              </Button>
            </div>
            {hasCoverLetter ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
                  <div>
                    <p className="text-[14px] font-semibold text-white">Cover letter</p>
                    <p className="mt-0.5 text-[12px] text-white/40">Copy, download, or edit before applying</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!coverLetterEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCoverLetterDraft(coverLetterDisplay ?? '');
                          setCoverLetterEditing(true);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60 transition hover:bg-white/[0.12] hover:text-white"
                        aria-label="Edit cover letter"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void copyCoverLetter()}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60 transition hover:bg-white/[0.12] hover:text-white"
                      aria-label="Copy cover letter"
                    >
                      <Copy className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={saveCoverLetterPdf}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60 transition hover:bg-white/[0.12] hover:text-white"
                      aria-label="Download PDF"
                    >
                      <FileDown className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="max-h-[360px] overflow-y-auto px-5 py-5 app-scrollbar">
                  {coverLetterEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={coverLetterDraft}
                        onChange={(e) => setCoverLetterDraft(e.target.value)}
                        className="min-h-[220px] w-full resize-y rounded-xl border border-[#00C9B1]/30 bg-[#0a0e0e] px-4 py-3 text-[13px] leading-[1.75] text-white/85 outline-none focus:border-[#00C9B1]/55 focus:ring-2 focus:ring-[#00C9B1]/15"
                        aria-label="Edit cover letter"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="h-9 px-4 text-[12px]"
                          onClick={() => {
                            const next = coverLetterDraft.trim() || null;
                            setGenerated(next);
                            setCoverLetterEditing(false);
                            const jobId = analysis?.id?.trim();
                            if (jobId && next) {
                              writeCoverLetterToStorage(jobId, next);
                              void api.jobs.saveGeneratedCoverLetter(jobId, next);
                            }
                            toast.success('Cover letter updated');
                          }}
                        >
                          Save edits
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 gap-1.5 border border-white/12 px-3 text-[12px] text-white/70"
                          onClick={() => {
                            const baseline = coverLetterAiBaseline ?? coverLetterDisplay ?? '';
                            setCoverLetterDraft(baseline);
                            setGenerated(baseline.trim() || null);
                            toast.success('Reverted to AI version');
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Revert to AI
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 px-3 text-[12px] text-white/50"
                          onClick={() => setCoverLetterEditing(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.8] text-white/75">{coverLetterDisplay}</p>
                  )}
                </div>
              </motion.div>
            ) : null}
            </div>
          </div>
        )}
      </GlowCard>
          </div>
        </div>
      </motion.div>
    </motion.div>
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

function AnalyzerResultsLoadingShell({ variant }: { variant: 'empty' | 'overlay' }) {
  const inner = (
    <>
      <Loader2 className="mb-4 h-12 w-12 shrink-0 animate-spin text-[#00C9B1]" aria-hidden />
      <p className="text-lg font-semibold text-white">Running AI analysis…</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
        We&apos;re scoring your fit, surfacing skill gaps, and drafting recruiter context. This usually takes a few
        seconds.
      </p>
      <div className="mt-10 w-full max-w-md space-y-3">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-8 h-28 w-full animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
    </>
  );

  if (variant === 'overlay') {
    return (
      <div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-[#0a0d0e]/93 px-6 py-10 text-center backdrop-blur-[4px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {inner}
        <p className="mt-8 max-w-xs text-[11px] leading-relaxed text-white/35">
          Updated scores and gaps will replace this screen automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[480px] flex-col items-center justify-center px-4 py-12 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {inner}
    </div>
  );
}

function Input({
  label,
  id,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const inputId = id ?? `analyze-field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-white/50" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full min-w-0 rounded-[10px] border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)]"
      />
    </div>
  );
}
