'use client';

import { queryKeys } from '@/lib/queryKeys';
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FileText,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CvAssistantRunResult } from '@/components/cv/CVEditContext';
import { AddSectionModal } from '@/components/cv/AddSectionModal';
import { CvSectionOrderProactiveBanner } from '@/components/cv/CvSectionOrderProactiveBanner';
import { CvSectionOrderSuggestModal } from '@/components/cv/CvSectionOrderSuggestModal';
import { AIChatDrawer } from '@/components/cv/AIChatDrawer';
import { AIGlobalAssistantPanel } from '@/components/cv/AIGlobalAssistantPanel';
import { CvGlobalAssistantFindingsPanel } from '@/components/cv/CvGlobalAssistantFindingsPanel';
import { CvAssistantClarificationModal } from '@/components/cv/CvAssistantClarificationModal';
import { RecruiterScanReportPanel } from '@/components/cv/RecruiterScanReportPanel';
import { CvGlobalAssistantReviewPanel } from '@/components/cv/CvGlobalAssistantReviewPanel';
import { CvDiffActionsBusyContext } from '@/components/cv/cvDiffImprovementActions';
import {
  CVBuilder,
  type CVBuilderQualitySignals,
  type CVBuilderTripleColumnConfig,
} from '@/components/cv/CVBuilder';
import { TailorChangePanel } from '@/components/cv/TailorChangePanel';
import { CvClinicToolbar } from '@/components/cv/CvClinicToolbar';
import { CvClinicTripleRightPanel } from '@/components/cv/CvClinicTripleRightPanel';
import { CvTopChromeMoreMenu } from '@/components/cv/CvTopChromeMoreMenu';
import { TemplatePickerModal } from '@/components/cv/TemplatePickerModal';
import { CVScoreCard } from '@/components/cv/CVScoreCard';
import { ImprovementsPanel } from '@/components/cv/ImprovementsPanel';
import { CvParseImportSummaryModal } from '@/components/cv/CvParseImportSummaryModal';
import {
  CVUploadZone,
  type CvParseSuccessPayload,
} from '@/components/dashboard/CVUploadZone';
import { CreateCVProfileModal } from '@/components/dashboard/CreateCVProfileModal';
import { CvClinicHub } from '@/components/dashboard/CvClinicHub';
import { MobileExperienceBanner } from '@/components/dashboard/MobileExperienceBanner';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { MobileDockFab } from '@/components/ui/MobileDockFab';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useCvSectionOrderFlow } from '@/hooks/useCvSectionOrderFlow';
import { useCVProfile } from '@/hooks/useCVProfile';
import { useCVProfileById } from '@/hooks/useCVProfileById';
import { useCVProfiles } from '@/hooks/useCVProfiles';
import { useCVScore } from '@/hooks/useCVScore';
import { useExportCV } from '@/hooks/useExportCV';
import { useRunCvDetailedScore } from '@/hooks/useRunCvDetailedScore';
import { useCVImprovements } from '@/hooks/useCVImprovements';
import { useRenameCVProfile } from '@/hooks/useRenameCVProfile';
import { useRestoreOriginalTemplate } from '@/hooks/useRestoreOriginalTemplate';
import {
  api,
  isPartialCvExtractionFromStructured,
  pickCvSectionRowsForEditor,
  type CvAssistantCommandResponse,
  type CvAssistantSectionDiff,
  type CvCompletenessResult,
  type CvImprovementsPayload,
  type CvDiffPreviewOpenParams,
  type CvMutationCommitMeta,
  type CvPerformanceMeta,
  type CvParseImportSummary,
  type CvProfileSummary,
  type CvSpellIssue,
  type CvTailorDraft,
} from '@/lib/api';
import { parseCvMode } from '@/lib/cv-mode.types';
import { inferCvProfileNameFromProfile } from '@/lib/infer-cv-profile-name';
import { buildCvNamingForExport } from '@/lib/cv-profile-naming';
import { normalizeCvDiffPreviewParams } from '@/lib/cvAiPatchDisplay';
import {
  assistantChangedFieldLabel,
  assistantDiffDisplayStrings,
} from '@/lib/cvAssistantDiffDisplay';
import {
  isCvTemplateId,
  transformSectionsToCVBuilderData,
  type CVBuilderData,
  type CvBuilderSaveStatus,
  type CvTemplateId,
  type SaveCVBuilderDataResult,
} from '@/lib/cvBuilder';
import { filterPendingSuggestionsForDisplay } from '@/lib/cv-improvement-merge';
import {
  buildCvSectionInventory,
  filterRecruiterScanFindingsResult,
  filterUnrealisticCvSuggestions,
  logUnrealisticCvRecommendationDropDev,
} from '@/lib/cvAssistantUserFacing';
import {
  applySuggestionAcceptToImprovementsCache,
  applySuggestionRejectToImprovementsCache,
} from '@/lib/cvSuggestionsMutationApply';
import { logCvSuggestionMutationClientPerf } from '@/lib/cvSuggestionMutationReconcile';
import {
  compactDiffPreviewPerformance,
  logCvMaterializePerformanceDev,
} from '@/lib/cvApplyPerformanceDev';
import { refetchCvProfileAndSectionsAfterBackgroundWork } from '@/lib/cvBackgroundSectionSync';
import { logCvMutationCommitDev } from '@/lib/cvMutationCommitDev';
import {
  shouldShowTruthfulnessAdjustNotice,
  truthfulnessFieldsFromResponse,
} from '@/lib/cvTruthfulnessUi';
import {
  CV_ASSISTANT_DIFF_PREVIEW_KEY,
  type CvDiffPreviewMap,
  cvDiffPreviewStorageKey,
} from '@/lib/cvDiffPreviewMap';
import {
  isCvApplyImprovementTerminalNoDiff,
  toastCopyForTerminalNoDiffApply,
} from '@/lib/cvApplyImprovementQueue';
import {
  assistantTargetSectionToEditorId,
  commitAssistantAcceptedPatch,
} from '@/lib/cvAssistantCommit';
import {
  cvAssistantBusyMessage,
  type CvAssistantBusyStage,
} from '@/lib/cvAssistantLoadingCopy';
import {
  globalAssistantChangedFields,
  mergeGlobalAssistantPatches,
  type CvAssistantScope,
  type CvGlobalAssistantApplyFindingsPayload,
  type CvGlobalAssistantFindingsResult,
  type CvGlobalAssistantFullCvResult,
  type CvGlobalAssistantOperationKey,
} from '@/lib/cvGlobalAssistant';
import { commitAcceptedStructuredDraft } from '@/lib/cvStructuredDraftCommit';
import {
  CV_READY_TOAST,
  cvEditorPath,
  prefetchCvProfileForEditor,
} from '@/lib/cvProfileNavigation';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { coreCvContentPresentInSections } from '@/lib/cv-sections-content';
import {
  formatApiErrorForToast,
  getApiErrorCode,
  getApiErrorMessage,
} from '@/lib/axios';
import { logCvMutationErrorDev } from '@/lib/cvMutationDevLog';
import {
  canonicalWorkflowEntityId,
  recordExecutionCheckpoint,
} from '@/lib/executionMemory';
import {
  buildRecruiterScanHeatmapByPreviewKey,
  recruiterScanSessionFromFindings,
  type CvRecruiterScanReadingPathEntry,
  type CvRecruiterScanSession,
} from '@/lib/cvRecruiterScan';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useCvBuilderHydration } from '@/hooks/useCvBuilderHydration';
import { useCvSuggestionMutations } from '@/hooks/useCvSuggestionMutations';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

const CV_CLINIC_RIGHT_PCT_KEY = 'cv_clinic_right_pct';
const CV_RIGHT_PANEL_COLLAPSED_KEY = 'applymate:cv:rightPanelCollapsed';

/** Dark native select — teal focus/accent matches brand (avoids default browser blue). */
const cvProfileSelectClassName = cn(
  'rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm',
  'bg-[#0C0F0F] text-white/80',
  'accent-[#00C9B1]',
  'focus:outline-none focus:border-[#00C9B1] focus:ring-2 focus:ring-[#00C9B1]/25',
  '[&>option]:bg-[#0C0F0F] [&>option]:text-white',
);

const cvDashboardTemplateStorageKey = (profileId: string) =>
  `applymate:cvDashboardTemplate:${profileId}`;

function readCvDashboardTemplate(profileId: string): CvTemplateId | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.sessionStorage.getItem(
      cvDashboardTemplateStorageKey(profileId),
    );
    return isCvTemplateId(v) ? v : null;
  } catch {
    return null;
  }
}

function writeCvDashboardTemplate(profileId: string, t: CvTemplateId): void {
  if (typeof window === 'undefined' || !profileId.trim()) return;
  try {
    window.sessionStorage.setItem(cvDashboardTemplateStorageKey(profileId), t);
  } catch {
    /* quota / private mode */
  }
}

function getFormatRecommendation(expCount: number): {
  label: string;
  recommended: CvTemplateId;
  reason: string;
} {
  if (expCount === 0) {
    return {
      label: 'Student / No Experience',
      recommended: 'modern',
      reason:
        'The Modern template leads with skills and education, ideal when experience is limited',
    };
  }
  if (expCount <= 2) {
    return {
      label: 'Early Career (0-3 years)',
      recommended: 'modern',
      reason:
        'Hybrid format recommended: showcase skills prominently alongside your experience',
    };
  }
  if (expCount <= 5) {
    return {
      label: 'Mid Career (3-8 years)',
      recommended: 'classic',
      reason:
        'Chronological format: your experience depth is your strongest asset',
    };
  }
  return {
    label: 'Senior (8+ years)',
    recommended: 'professional',
    reason:
      'Professional format: structured layout that showcases seniority and specialisation',
  };
}

function formatLayoutLabel(detectedLayout: string): string {
  const labels: Record<string, string> = {
    'single-column': 'single column',
    'two-column-sidebar': 'two column with sidebar',
    'two-column-equal': 'two column',
    unknown: 'unknown',
  };
  return labels[detectedLayout] ?? detectedLayout;
}

export function CvClinicPageContent() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileIdParam = searchParams.get('profileId');
  const focusParam = (searchParams.get('focus') ?? '').trim().toLowerCase();
  const cvMode = parseCvMode(searchParams.get('cvMode'));
  const tailorDraftIdParam = searchParams.get('tailorDraftId')?.trim() ?? '';
  const jobAnalysisIdParam = searchParams.get('jobAnalysisId')?.trim() ?? '';
  const isTailorMode = cvMode === 'tailor';

  const linkedJobQ = useQuery({
    queryKey: queryKeys.jobs.analysis(jobAnalysisIdParam),
    queryFn: () => api.jobs.getJob(jobAnalysisIdParam),
    enabled: Boolean(jobAnalysisIdParam),
    staleTime: 60_000,
  });

  const user = useAuthStore((s) => s.user);

  const profilesQuery = useCVProfiles();
  const profiles = profilesQuery.data?.rows ?? [];
  const legacyCv = useCVProfile();
  const profileOptions = useMemo((): CvProfileSummary[] => {
    if (profiles.length > 0) return profiles;
    const p = legacyCv.data;
    if (!p?.id?.trim()) return [];
    return [
      {
        id: p.id,
        name: inferCvProfileNameFromProfile(p),
        score: null,
        isDefault: true,
        template: p.template,
        updatedAt: p.updatedAt,
        originalTemplate: p.originalTemplate,
      },
    ];
  }, [profiles, legacyCv.data]);

  const initializing =
    profilesQuery.isPending ||
    (profilesQuery.isSuccess && profiles.length === 0 && legacyCv.isPending);

  /** Only open the builder when `?profileId=` is set — otherwise show the resume library hub. */
  const targetId = useMemo(() => profileIdParam?.trim() || null, [profileIdParam]);

  const {
    data: detail,
    isLoading: detailLoading,
    isFetching: detailFetching,
  } = useCVProfileById(targetId);
  const profile = detail?.profile ?? null;
  const sectionsQuery = useQuery({
    queryKey: queryKeys.cv.sections(targetId ?? ''),
    queryFn: () => api.cv.getSections(true, targetId ?? undefined),
    enabled: Boolean(targetId),
    staleTime: 30_000,
  });
  /** `[]` from GET /sections is truthy for `??` — fall back to profile detail when rows lack `id`. */
  const sections = useMemo(
    () => pickCvSectionRowsForEditor(sectionsQuery.data, detail?.sections),
    [sectionsQuery.data, detail?.sections],
  );

  const sectionOrderFlow = useCvSectionOrderFlow(targetId, sections);

  const hasCv = profiles.length > 0 || Boolean(legacyCv.data?.id);
  const score = useCVScore(hasCv && Boolean(targetId), targetId);
  const improvements = useCVImprovements(hasCv && Boolean(targetId), targetId);
  const runScan = useRunCvDetailedScore();
  const exportCv = useExportCV();
  const renameProfile = useRenameCVProfile();
  const restoreMutation = useRestoreOriginalTemplate(targetId);

  const [template, setTemplate] = useState<CvTemplateId>(() => {
    if (typeof window === 'undefined') return 'modern';
    if (profileIdParam?.trim())
      return readCvDashboardTemplate(profileIdParam) ?? 'modern';
    return 'modern';
  });
  const [templateReady, setTemplateReady] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [pickTemplate, setPickTemplate] = useState(false);
  const [createCvOpen, setCreateCvOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [parseImportSummaryModal, setParseImportSummaryModal] = useState<{
    open: boolean;
    summary: CvParseImportSummary | null;
    profileId: string | null;
    navigateOnClose: boolean;
  }>({ open: false, summary: null, profileId: null, navigateOnClose: false });
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [mobileCvToolsOpen, setMobileCvToolsOpen] = useState(false);
  const [mobileCvInsightsOpen, setMobileCvInsightsOpen] = useState(false);
  const triplePanelContainerRef = useRef<HTMLDivElement>(null);
  const [tripleRightPct, setTripleRightPct] = useState(28);
  const [tripleRightTab, setTripleRightTab] = useState<
    'analysis' | 'improvements' | 'changes'
  >('analysis');
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [improvementsAttentionPulse, setImprovementsAttentionPulse] =
    useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [builderSaveStatus, setBuilderSaveStatus] =
    useState<CvBuilderSaveStatus>('idle');
  const [reorderPending, setReorderPending] = useState(false);
  const [spellCheckTrigger, setSpellCheckTrigger] = useState(0);
  const [spellFixAllTrigger, setSpellFixAllTrigger] = useState(0);
  const [qualitySignals, setQualitySignals] = useState<CVBuilderQualitySignals>(
    {
      incompleteSectionIds: [],
      incompleteCount: 0,
      missingFields: [],
      sectionLabels: {},
      spellIssuesBySection: {},
      spellIssueEntriesBySection: {},
      spellIssuesByField: {},
      spellIssueCount: 0,
      grammarIssueCount: 0,
      isSpellChecking: false,
    },
  );
  const [completeness, setCompleteness] = useState<CvCompletenessResult | null>(
    null,
  );
  const reorderPendingRef = useRef(false);
  reorderPendingRef.current = reorderPending;

  const [diffPreviews, setDiffPreviews] = useState<CvDiffPreviewMap>({});
  const [activeDiffPreviewKey, setActiveDiffPreviewKey] = useState<
    string | null
  >(null);
  const diffPreview = useMemo(() => {
    if (!activeDiffPreviewKey) return null;
    return diffPreviews[activeDiffPreviewKey] ?? null;
  }, [activeDiffPreviewKey, diffPreviews]);

  const closeDiffPreviewForKey = useCallback(
    (key: string | null | undefined) => {
      if (!key) return;
      setDiffPreviews((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setActiveDiffPreviewKey((cur) => (cur === key ? null : cur));
    },
    [],
  );

  const clearAssistantPreview = useCallback(() => {
    closeDiffPreviewForKey(CV_ASSISTANT_DIFF_PREVIEW_KEY);
    setAssistantPreviewMode(false);
    setAssistantScope(null);
    setAssistantPendingPatch(null);
    setAssistantSectionDiffs([]);
    setGlobalAssistantFindings(null);
    setGlobalAssistantFullResult(null);
    setGlobalAssistantReviewOpen(false);
    assistantCommandIdRef.current = '';
  }, [closeDiffPreviewForKey]);

  const mergeDiffPreviewOpen = useCallback(
    (params: CvDiffPreviewOpenParams | null) => {
      setAssistantPreviewMode(false);
      setAssistantScope(null);
      setAssistantPendingPatch(null);
      setAssistantSectionDiffs([]);
      setGlobalAssistantFindings(null);
      setGlobalAssistantFullResult(null);
      setGlobalAssistantReviewOpen(false);
      if (!params) {
        setActiveDiffPreviewKey(null);
        return;
      }
      const key = cvDiffPreviewStorageKey(params);
      const normalized = normalizeCvDiffPreviewParams(params);
      setDiffPreviews((prev) => ({ ...prev, [key]: normalized }));
      setActiveDiffPreviewKey(key);
    },
    [],
  );
  const cvImprovementDiffInFlightRef = useRef(false);
  const [cvImprovementDiffActionsPending, setCvImprovementDiffActionsPending] =
    useState(false);
  const [globalAssistantOpen, setGlobalAssistantOpen] = useState(false);
  const [assistantSeedCommand, setAssistantSeedCommand] = useState<
    string | null
  >(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantBusyStage, setAssistantBusyStage] =
    useState<CvAssistantBusyStage>(null);
  const [clarificationModalOpen, setClarificationModalOpen] = useState(false);
  const [assistantPreviewMode, setAssistantPreviewMode] = useState(false);
  const [assistantScope, setAssistantScope] = useState<CvAssistantScope | null>(
    null,
  );
  const [assistantSectionDiffs, setAssistantSectionDiffs] = useState<
    CvAssistantSectionDiff[]
  >([]);
  const [globalAssistantFindings, setGlobalAssistantFindings] =
    useState<CvGlobalAssistantFindingsResult | null>(null);
  const [recruiterScanSession, setRecruiterScanSession] =
    useState<CvRecruiterScanSession | null>(null);
  const [recruiterScanPanelOpen, setRecruiterScanPanelOpen] = useState(false);
  const [recruiterScanHeatmap, setRecruiterScanHeatmap] = useState<Record<
    string,
    CvRecruiterScanReadingPathEntry
  > | null>(null);
  const [recruiterScanClarification, setRecruiterScanClarification] = useState<{
    question: string;
    commandId: string;
    scanId?: string;
    targetRole?: string;
  } | null>(null);
  const [globalAssistantFullResult, setGlobalAssistantFullResult] =
    useState<CvGlobalAssistantFullCvResult | null>(null);
  const [globalAssistantReviewOpen, setGlobalAssistantReviewOpen] =
    useState(false);
  const [assistantPendingPatch, setAssistantPendingPatch] = useState<Record<
    string,
    unknown
  > | null>(null);
  const assistantCommandIdRef = useRef('');
  const [assistantPatchNonce, setAssistantPatchNonce] = useState(0);
  const [assistantAcceptHighlight, setAssistantAcceptHighlight] = useState<{
    sectionId: string;
    nonce: number;
  } | null>(null);
  const [instantPreviewPatch, setInstantPreviewPatch] =
    useState<Partial<CVBuilderData> | null>(null);
  const [instantPreviewPatchNonce, setInstantPreviewPatchNonce] = useState(0);
  /** Incremented after server mutations so CVBuilder replaces local state from refetched `initialData`. */
  const [cvServerHydrateNonce, setCvServerHydrateNonce] = useState(0);
  const bumpCvServerHydrateNonce = useCallback(() => {
    setCvServerHydrateNonce((n) => n + 1);
  }, []);
  const clearInstantPreviewBeforeHydrate = useCallback(() => {
    setInstantPreviewPatch(null);
  }, []);
  const clearAssistantSeedCommand = useCallback(() => {
    setAssistantSeedCommand(null);
  }, []);
  const handleAtsKeywordAssist = useCallback((prompt: string) => {
    setAssistantSeedCommand(prompt);
    setGlobalAssistantOpen(true);
  }, []);

  const closeRecruiterScan = useCallback(() => {
    setRecruiterScanPanelOpen(false);
    setRecruiterScanSession(null);
    setRecruiterScanHeatmap(null);
  }, []);

  const openRecruiterScanSession = useCallback(
    (session: CvRecruiterScanSession) => {
      setRecruiterScanSession(session);
      setRecruiterScanHeatmap(
        buildRecruiterScanHeatmapByPreviewKey(session.report, sections),
      );
      setRecruiterScanPanelOpen(true);
      setGlobalAssistantFindings(null);
      setGlobalAssistantOpen(false);
    },
    [sections],
  );

  const runRecruiterScan = useCallback(
    async (opts?: {
      targetRole?: string;
      clarifications?: Array<{ question: string; answer: string }>;
    }) => {
      if (!targetId?.trim()) return;
      setAssistantBusy(true);
      setAssistantBusyStage('generating');
      try {
        const res = await api.cv.recruiterScan(targetId, opts);
        if (res.type === 'clarify') {
          setRecruiterScanClarification({
            question: res.question,
            commandId: res.commandId,
            scanId: res.scanId,
            targetRole: opts?.targetRole,
          });
          setClarificationModalOpen(true);
          return;
        }
        setRecruiterScanClarification(null);
        openRecruiterScanSession({
          commandId: res.commandId,
          scanId: res.scanId,
          report: res.report,
          positiveFindings: res.positiveFindings,
          improvementFindings: res.improvementFindings,
          actionableFindings: res.actionableFindings,
          findings: res.findings,
          diffSummary: res.diffSummary,
        });
        toast.success(res.diffSummary || 'Recruiter scan complete');
      } catch (e) {
        toast.error(formatApiErrorForToast(e, 'Recruiter scan failed'));
      } finally {
        setAssistantBusy(false);
        setAssistantBusyStage(null);
      }
    },
    [openRecruiterScanSession, targetId, toast],
  );
  const { rehydrateFromServer: syncCvBuilderFromServer, refreshCvState } =
    useCvBuilderHydration({
      profileId: targetId,
      bumpHydrateNonce: bumpCvServerHydrateNonce,
      clearInstantPreview: clearInstantPreviewBeforeHydrate,
    });
  const { reconcileAfterMutation } = useCvSuggestionMutations();
  const [cvDataSnapshot, setCvDataSnapshot] = useState<CVBuilderData | null>(
    null,
  );
  const [tailorDraft, setTailorDraft] = useState<CvTailorDraft | null>(null);
  const [globalAssistantClarification, setGlobalAssistantClarification] =
    useState<{
      command: string;
      question: string;
      clarifications: Array<{ question: string; answer: string }>;
      operation?: CvGlobalAssistantOperationKey;
    } | null>(null);
  const globalAssistantOpsQuery = useQuery({
    queryKey: ['cv', 'assistant', 'global-operations'],
    queryFn: () => api.cv.assistantGlobalOperations(),
    enabled: Boolean(targetId?.trim()),
    staleTime: 5 * 60_000,
  });
  const [assistantClarification, setAssistantClarification] = useState<{
    command: string;
    question: string;
    clarifications: Array<{ question: string; answer: string }>;
    targetSection: string;
  } | null>(null);

  const activeClarification = globalAssistantClarification ?? assistantClarification;
  const clarificationQuestion =
    recruiterScanClarification?.question ?? activeClarification?.question ?? null;
  const assistantBusyMessage = useMemo(
    () =>
      assistantBusy
        ? cvAssistantBusyMessage(assistantBusyStage) ??
          cvAssistantBusyMessage('generating')
        : cvImprovementDiffActionsPending
          ? cvAssistantBusyMessage('validating')
          : null,
    [assistantBusy, assistantBusyStage, cvImprovementDiffActionsPending],
  );
  const jumpToSectionRef = useRef<
    | ((sid: string, itemId?: string, opts?: { scrollForm?: boolean }) => void)
    | null
  >(null);

  const resolveImprovementPointerByField = useCallback(
    async (fieldPath: string): Promise<string | null> => {
      if (!targetId?.trim() || !fieldPath.trim()) return null;
      try {
        const payload = await api.cv.getSuggestions(targetId, false);
        const match = (payload.improvements ?? []).find(
          (item) =>
            typeof item.id === 'string' &&
            item.id.trim().length > 0 &&
            Array.isArray(item.pendingFieldPaths) &&
            item.pendingFieldPaths.some((p) => p.trim() === fieldPath.trim()),
        );
        return match?.id?.trim() || null;
      } catch {
        return null;
      }
    },
    [targetId],
  );
  /** Avoid duplicate auto POST `/cv/profiles/:id/score/detailed` when GET improvements returns needsScoring. */
  const autoRescoreMarkerRef = useRef<string | null>(null);
  /** Debounced detailed score after CV builder autosave (Phase 4). */
  const scoreAfterAutosaveTimerRef = useRef<number | null>(null);
  /**
   * Syncing `profile.template` on every refetch overwrites the template the user just picked
   * (race with PATCH / stale GET) — uploads often snap back to `classic`. Only hydrate from the
   * server when the loaded row identity changes (`targetId` / `profile.id`), not when `template`
   * alone changes on the same CV.
   */
  const templateHydratedForTargetRef = useRef<string | null>(null);

  useEffect(() => {
    autoRescoreMarkerRef.current = null;
  }, [targetId]);

  useEffect(() => {
    return () => {
      if (scoreAfterAutosaveTimerRef.current) {
        window.clearTimeout(scoreAfterAutosaveTimerRef.current);
        scoreAfterAutosaveTimerRef.current = null;
      }
    };
  }, []);

  // Execution memory instrumentation: CV editing entry + meaningful save.
  const lastCvCheckpointRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetId?.trim()) return;
    const entityId = canonicalWorkflowEntityId('cv', targetId);
    const key = `${entityId}|enter`;
    if (lastCvCheckpointRef.current === key) return;
    lastCvCheckpointRef.current = key;
    void recordExecutionCheckpoint({
      workflowEntityId: entityId,
      workflowEntityType: 'cv',
      executionType: 'cv_edit',
      component: 'CVPage',
      stepKey: 'enter',
      percentComplete: 0,
      hydrationConsistencyKey: `cv:cv:${targetId}:v1`,
      snapshot: { cvProfileId: targetId },
    }).catch(() => {
      /* non-blocking */
    });
  }, [targetId]);

  useEffect(() => {
    if (!targetId?.trim()) return;
    if (builderSaveStatus !== 'saved') return;
    const entityId = canonicalWorkflowEntityId('cv', targetId);
    const pct =
      typeof completeness?.score === 'number' &&
      Number.isFinite(completeness.score)
        ? completeness.score
        : 50;
    const key = `${entityId}|saved|${pct}`;
    if (lastCvCheckpointRef.current === key) return;
    lastCvCheckpointRef.current = key;
    void recordExecutionCheckpoint({
      workflowEntityId: entityId,
      workflowEntityType: 'cv',
      executionType: 'cv_edit',
      component: 'CVBuilder',
      stepKey: 'saved',
      percentComplete: pct,
      hydrationConsistencyKey: `cv:cv:${targetId}:v1`,
      snapshot: { cvProfileId: targetId },
    }).catch(() => {
      /* non-blocking */
    });
  }, [builderSaveStatus, completeness?.score, targetId]);

  useEffect(() => {
    setTemplateReady(false);
    if (!targetId?.trim()) {
      setTemplateReady(true);
      return;
    }
    templateHydratedForTargetRef.current = null;
  }, [targetId]);

  useEffect(() => {
    if (!improvements.data?.needsScoring) autoRescoreMarkerRef.current = null;
  }, [improvements.data?.needsScoring]);

  useEffect(() => {
    if (!targetId?.trim()) {
      setCompleteness(null);
      return;
    }
    void (async () => {
      try {
        const next = await api.cv.getCompleteness(targetId);
        setCompleteness(next);
      } catch {
        /* non-blocking */
      }
    })();
  }, [targetId, sections.length, builderSaveStatus]);

  useEffect(() => {
    if (!hasCv || !targetId?.trim() || !improvements.data?.needsScoring) return;
    if (runScan.isPending || improvements.isFetching) return;
    const marker = `${targetId}:${improvements.dataUpdatedAt}`;
    if (autoRescoreMarkerRef.current === marker) return;
    autoRescoreMarkerRef.current = marker;
    void (async () => {
      try {
        await runScan.mutateAsync(targetId);
        await queryClient.invalidateQueries({
          queryKey: cvSuggestionsQueryKey(targetId),
        });
      } catch {
        /* Keep autoRescoreMarkerRef set for this marker so a failing detailed score does not loop POSTs while needsScoring stays true. User can run Scan from the toolbar to retry. */
      }
    })();
  }, [
    hasCv,
    targetId,
    improvements.data?.needsScoring,
    improvements.dataUpdatedAt,
    improvements.isFetching,
    runScan,
    queryClient,
  ]);

  useEffect(() => {
    if (!targetId?.trim() || !profile?.id || profile.id !== targetId) return;
    if (detailLoading) return;
    if (templateHydratedForTargetRef.current === targetId) return;
    templateHydratedForTargetRef.current = targetId;

    const stored = readCvDashboardTemplate(targetId);
    if (stored) {
      setTemplate(stored);
      setTemplateReady(true);
      return;
    }

    const t = profile.template;
    if (isCvTemplateId(t)) {
      setTemplate(t);
      writeCvDashboardTemplate(targetId, t);
    }
    setTemplateReady(true);
  }, [targetId, profile?.id, detailLoading]);

  useEffect(() => {
    if (!renameOpen || !targetId) return;
    const n = profileOptions.find((p) => p.id === targetId)?.name ?? '';
    setRenameValue(n);
  }, [renameOpen, targetId, profileOptions]);

  useEffect(() => {
    if (diffPreview?.section && jumpToSectionRef.current) {
      setTimeout(() => {
        jumpToSectionRef.current?.(diffPreview.section);
      }, 350);
    }
  }, [diffPreview]);

  useEffect(() => {
    if (diffPreview !== null) {
      setInsightsOpen(false);
    }
  }, [diffPreview]);

  useEffect(() => {
    if (focusParam !== 'improvements') return;
    setTripleRightTab('improvements');
    setRightPanelCollapsed(false);
    setInsightsOpen(true);
    setImprovementsAttentionPulse(true);
    const t = window.setTimeout(
      () => setImprovementsAttentionPulse(false),
      2800,
    );
    return () => window.clearTimeout(t);
  }, [focusParam, targetId]);

  const initialData = useMemo(
    () =>
      transformSectionsToCVBuilderData(profile, sections, {
        email: user?.email,
        name: user?.name,
      }),
    [profile, sections, user?.email, user?.name],
  );

  const existingSectionTypes = useMemo(
    () => new Set(sections.map((s) => s.type)),
    [sections],
  );
  const visibleSectionTypes = useMemo(
    () =>
      new Set(
        sections
          .filter((s) => s.hidden !== true)
          .map((s) => s.type.toLowerCase()),
      ),
    [sections],
  );

  const displayScoreValue = useMemo(
    () => score.data?.score,
    [score.data?.score],
  );

  const displayScoreBreakdown = useMemo(
    () => score.data?.breakdown,
    [score.data?.breakdown],
  );

  const displayScorePayload = useMemo(() => score.data, [score.data]);

  const refreshScoreAfterSuggestion = useCallback(() => {
    if (!targetId) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.score(targetId), exact: true });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.cv.suggestions(targetId),
      exact: true,
    });
  }, [queryClient, targetId]);

  const improvementList = useMemo(() => {
    const pending = filterPendingSuggestionsForDisplay(
      improvements.data?.improvements,
    );
    const inventory = buildCvSectionInventory(
      cvDataSnapshot ?? initialData,
      sections,
    );
    const { items, dropped } = filterUnrealisticCvSuggestions(pending, inventory);
    logUnrealisticCvRecommendationDropDev('suggestions_panel', targetId, dropped);
    return items;
  }, [
    improvements.data?.improvements,
    cvDataSnapshot,
    initialData,
    sections,
    targetId,
  ]);
  const acceptAllQuota = improvements.data?.acceptAllQuota ?? null;

  /** Server-authoritative pending count (GET /cv/suggestions); fallback only if omitted. */
  const pendingSuggestionsCountResolved = useMemo(() => {
    const n = improvements.data?.pendingSuggestionsCount;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
    return improvementList.length;
  }, [improvements.data?.pendingSuggestionsCount, improvementList.length]);

  /**
   * Friendly per-section grouping of "needs more details". Prefers the local heuristic
   * (`qualitySignals.missingFields`) for instant updates as the user types and only
   * augments with backend `completeness` rows for sections we can't infer locally
   * (e.g. server-only required fields). Hidden / deleted sections are excluded.
   */
  const completenessGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        sectionKey: string;
        sectionLabel: string;
        fields: Array<{ fieldPath: string; fieldLabel: string }>;
      }
    >();
    const norm = (v: string) => v.trim().toLowerCase();
    const skipPlaceholder = (label: string, fieldPath: string) => {
      const l = norm(label);
      const p = norm(fieldPath);
      return (
        l === 'sectionitem' ||
        l === 'add section' ||
        l === 'click to add section' ||
        p === 'sectionitem'
      );
    };
    const localMissingBySection = new Map<string, Set<string>>();
    for (const f of qualitySignals.missingFields) {
      if (skipPlaceholder(f.fieldLabel, f.fieldPath)) continue;
      const key = norm(f.sectionLabel || f.sectionKey);
      const entry = map.get(key) ?? {
        sectionKey: f.sectionKey.toLowerCase(),
        sectionLabel: f.sectionLabel,
        fields: [],
      };
      if (!entry.fields.some((x) => x.fieldPath === f.fieldPath)) {
        entry.fields.push({ fieldPath: f.fieldPath, fieldLabel: f.fieldLabel });
      }
      map.set(key, entry);
      const set =
        localMissingBySection.get(entry.sectionKey) ?? new Set<string>();
      set.add(norm(f.fieldPath));
      localMissingBySection.set(entry.sectionKey, set);
    }
    if (completeness?.sections) {
      for (const sec of completeness.sections) {
        if ((sec.missingFields?.length ?? 0) === 0) continue;
        const sectionKey = (
          sec.sectionType?.trim().toLowerCase() ||
          sec.sectionId ||
          ''
        ).toLowerCase();
        if (!sectionKey) continue;
        if (
          sectionKey !== 'personal' &&
          sectionKey !== 'summary' &&
          !visibleSectionTypes.has(sectionKey) &&
          !sectionKey.startsWith('custom_')
        ) {
          continue;
        }
        const key = norm(sec.label || sectionKey);
        const entry = map.get(key) ?? {
          sectionKey,
          sectionLabel:
            qualitySignals.sectionLabels[sectionKey] ?? sec.label ?? sectionKey,
          fields: [],
        };
        const localSet =
          localMissingBySection.get(sectionKey) ?? new Set<string>();
        for (const f of sec.missingFields) {
          if (skipPlaceholder(String(f.label ?? ''), String(f.fieldPath ?? '')))
            continue;
          const fp = norm(String(f.fieldPath ?? ''));
          const fl = norm(String(f.label ?? ''));
          // Avoid stale backend false-positives for personal fields that are already present locally.
          if (sectionKey === 'personal') {
            const snap = cvDataSnapshot ?? initialData;
            const hasName = Boolean(snap?.personal?.name?.trim());
            const hasEmail = Boolean(snap?.personal?.email?.trim());
            const hasLoc = Boolean(snap?.personal?.location?.trim());
            const showEmail = snap ? snap.personal != null : true;
            if ((fp.includes('name') || fl.includes('name')) && hasName)
              continue;
            if ((fp.includes('email') || fl.includes('email')) && hasEmail)
              continue;
            if ((fp.includes('location') || fl.includes('location')) && hasLoc)
              continue;
            if ((fp.includes('email') || fl.includes('email')) && !showEmail)
              continue;
          }
          // If local heuristic already says this field is complete, don't duplicate stale server rows.
          if (localSet.size > 0 && !localSet.has(fp)) continue;
          if (entry.fields.some((x) => x.fieldPath === f.fieldPath)) continue;
          entry.fields.push({
            fieldPath: f.fieldPath,
            fieldLabel: f.label || f.fieldPath,
          });
        }
        if (entry.fields.length > 0) map.set(key, entry);
      }
    }
    return [...map.values()];
  }, [
    qualitySignals.missingFields,
    qualitySignals.sectionLabels,
    completeness?.sections,
    visibleSectionTypes,
    cvDataSnapshot,
    initialData,
  ]);

  const resolveJumpSectionKey = useCallback(
    (rawKey: string): string => {
      const key = rawKey.trim().toLowerCase();
      if (!key) return rawKey;
      if (
        key === 'personal' ||
        key === 'summary' ||
        key === 'experience' ||
        key === 'education' ||
        key === 'skills'
      )
        return key;
      if (
        key === 'projects' ||
        key === 'certifications' ||
        key === 'languages' ||
        key === 'achievements' ||
        key === 'references'
      )
        return key;
      const row = sections.find(
        (s) =>
          s.type.toLowerCase() === key ||
          s.type.toLowerCase() === `custom_${key}`,
      );
      if (!row) return key;
      const t = row.type.toLowerCase();
      if (t.startsWith('custom_')) return `parsed-${row.id}`;
      return key;
    },
    [sections],
  );

  const onApplySpellIssue = useCallback((issue: CvSpellIssue) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('cv:spell-issue:apply', { detail: { issue } }),
    );
  }, []);
  const onDismissSpellIssue = useCallback((issue: CvSpellIssue) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('cv:spell-issue:dismiss', { detail: { issue } }),
    );
  }, []);

  const improvementsBadgeCount = useMemo(() => {
    return (
      pendingSuggestionsCountResolved +
      completenessGroups.reduce((acc, sec) => acc + sec.fields.length, 0) +
      qualitySignals.spellIssueCount +
      qualitySignals.grammarIssueCount
    );
  }, [
    pendingSuggestionsCountResolved,
    completenessGroups,
    qualitySignals.spellIssueCount,
    qualitySignals.grammarIssueCount,
  ]);

  const experienceItemCount = useMemo(() => {
    const exp = sections.find((s) => s.type === 'experience');
    const items = exp?.data?.items;
    return Array.isArray(items) ? items.length : 0;
  }, [sections]);

  const isPartialExtractionBanner = useMemo(() => {
    if (!profile?.originalTemplate) return false;
    /** Preview uses section rows; `structured` may lag empty while `sections` were rebuilt from upload. */
    if (coreCvContentPresentInSections(sections)) return false;
    return isPartialCvExtractionFromStructured(profile?.structured);
  }, [profile?.originalTemplate, profile?.structured, sections]);

  const formatRecommendation = useMemo(
    () => getFormatRecommendation(experienceItemCount),
    [experienceItemCount],
  );
  const isOnRecommendedTemplate = template === formatRecommendation.recommended;

  const onTemplateChange = useCallback(
    async (t: string) => {
      const next = t as typeof template;
      setTemplate(next);
      if (targetId?.trim()) writeCvDashboardTemplate(targetId, next);
      try {
        await api.cv.updateTemplate(next, targetId ?? undefined);
        await refreshCvState(targetId, {
          refreshProfile: true,
          refreshSections: false,
          refreshSuggestions: true,
          invalidateScore: true,
          invalidateCvProfilesList: true,
        });
        toast.success('Template updated.');
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    },
    [targetId, toast, refreshCvState],
  );

  const handleCvParseUploadSuccess = useCallback(
    async (
      payload: CvParseSuccessPayload,
      opts?: { closeUploadModal?: boolean; navigateToProfile?: boolean },
    ) => {
      const { profile, importSummary } = payload;
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
      await queryClient.refetchQueries({ queryKey: queryKeys.cv.profiles() });
      const id = profile.id?.trim();
      if (id) {
        await queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(id) });
        await refreshCvState(id, {
          refreshProfile: true,
          refreshSections: true,
          refreshSuggestions: true,
          invalidateScore: true,
        });
      }
      if (opts?.closeUploadModal) setShowUpload(false);
      if (importSummary && id) {
        setShowReuploadModal(false);
        setParseImportSummaryModal({
          open: true,
          summary: importSummary,
          profileId: id,
          navigateOnClose: Boolean(opts?.navigateToProfile),
        });
        return;
      }
      if (opts?.navigateToProfile && id) {
        router.replace(`/dashboard/cv?profileId=${encodeURIComponent(id)}`);
        return;
      }
      if (id && targetId === id) {
        setCvServerHydrateNonce((n) => n + 1);
      }
    },
    [queryClient, refreshCvState, router, targetId],
  );

  const onDashboardSaved = useCallback(
    async (result?: SaveCVBuilderDataResult) => {
      if (!targetId?.trim()) return;
      if (result?.sections && result.sections.length > 0) {
        queryClient.setQueryData(queryKeys.cv.sections(targetId), result.sections);
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv.profile(targetId),
        refetchType: 'none',
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });

      const likelyContentChanged =
        result == null ||
        result.profilePatched === true ||
        result.usedBatch === false ||
        (result.batch != null && result.batch.updated > 0);

      if (!likelyContentChanged) {
        return;
      }

      if (scoreAfterAutosaveTimerRef.current) {
        window.clearTimeout(scoreAfterAutosaveTimerRef.current);
        scoreAfterAutosaveTimerRef.current = null;
      }
      const tScore = performance.now();
      scoreAfterAutosaveTimerRef.current = window.setTimeout(() => {
        scoreAfterAutosaveTimerRef.current = null;
        void (async () => {
          if (runScan.isPending) {
            if (process.env.NODE_ENV === 'development') {
              console.info('[cv:builder-save]', {
                label: 'score.detailed.afterAutosave.skippedInFlight',
              });
            }
            return;
          }
          try {
            await runScan.mutateAsync(targetId);
            if (process.env.NODE_ENV === 'development') {
              console.info('[cv:builder-save]', {
                label: 'score.detailed.afterAutosave',
                ms: Math.round(performance.now() - tScore),
              });
            }
          } catch {
            /* detailed score optional; list still stale-marked */
          }
        })();
      }, 2800);
    },
    [queryClient, targetId, runScan],
  );

  const waitForReorderToSettle = useCallback(async () => {
    if (!reorderPendingRef.current) return;
    await new Promise<void>((resolve) => {
      const started = Date.now();
      const tick = window.setInterval(() => {
        if (!reorderPendingRef.current || Date.now() - started > 8000) {
          window.clearInterval(tick);
          resolve();
        }
      }, 120);
    });
  }, []);

  const handleExport = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (isPartialExtractionBanner) {
        const ok = window.confirm(
          'Your CV appears to be missing experience and skills data. ' +
            'The exported file may be incomplete.\n\n' +
            'Download anyway?',
        );
        if (!ok) return;
      }
      try {
        await waitForReorderToSettle();
        if (targetId?.trim()) {
          await queryClient.refetchQueries({
            queryKey: queryKeys.cv.sections(targetId),
            exact: true,
          });
        }
        await api.cv.updateTemplate(template, targetId ?? undefined);
        await exportCv.mutateAsync({
          format,
          template,
          cvProfileId: targetId ?? undefined,
          jobAnalysisId: isTailorMode
            ? jobAnalysisIdParam || undefined
            : undefined,
          profileForNaming: profile,
          profileDisplayName:
            profileOptions.find((p) => p.id === targetId)?.name ??
            (profile ? inferCvProfileNameFromProfile(profile) : null),
          namingFallback: profile
            ? buildCvNamingForExport(
                profile,
                profileOptions.find((p) => p.id === targetId)?.name ??
                  inferCvProfileNameFromProfile(profile),
                {
                  tailored: isTailorMode && Boolean(jobAnalysisIdParam),
                  company:
                    (
                      linkedJobQ.data as
                        | { company?: string; job?: { company?: string } }
                        | undefined
                    )?.company ??
                    (
                      linkedJobQ.data as
                        | { job?: { company?: string } }
                        | undefined
                    )?.job?.company,
                  role:
                    (
                      linkedJobQ.data as
                        | { jobTitle?: string; job?: { title?: string } }
                        | undefined
                    )?.jobTitle ??
                    (
                      linkedJobQ.data as
                        | { job?: { title?: string } }
                        | undefined
                    )?.job?.title,
                },
              )
            : undefined,
        });
        toast.success(`CV downloaded as ${format.toUpperCase()}`);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    },
    [
      isPartialExtractionBanner,
      template,
      targetId,
      exportCv,
      toast,
      waitForReorderToSettle,
      queryClient,
      profile,
      profileOptions,
      isTailorMode,
      jobAnalysisIdParam,
      linkedJobQ.data,
    ],
  );

  const handleRestoreOriginal = useCallback(async () => {
    try {
      const result = await restoreMutation.mutateAsync();
      if (!result.alreadyOnOriginal) {
        const t = result.template;
        if (isCvTemplateId(t)) {
          setTemplate(t);
          if (targetId?.trim()) writeCvDashboardTemplate(targetId, t);
        }
        toast.success('Restored to your original CV format');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Failed to restore original format');
    }
  }, [restoreMutation, toast]);

  const suggestionsQueryKey = cvSuggestionsQueryKey(targetId);

  const scheduleSectionResyncIfBackgroundTasks = useCallback(
    (meta: CvMutationCommitMeta & CvPerformanceMeta) => {
      if (meta.backgroundTasksScheduled !== true) return;
      toast.info(
        'Your changes are saved. Core sections may refresh in a moment while we finish syncing in the background.',
      );
      void (async () => {
        await refetchCvProfileAndSectionsAfterBackgroundWork(
          queryClient,
          targetId,
        );
        setCvServerHydrateNonce((n) => n + 1);
      })();
    },
    [queryClient, targetId, toast],
  );

  const commitAcceptDiff = useCallback(
    async (changeIndex?: number) => {
      const opKey = activeDiffPreviewKey;
      const diffPreview = opKey ? (diffPreviews[opKey] ?? null) : null;
      if (!diffPreview) return;
      if (assistantPreviewMode && diffPreview.pointer === '__assistant__') {
        const id = targetId?.trim();
        if (!id) return;
        if (cvImprovementDiffInFlightRef.current) return;
        cvImprovementDiffInFlightRef.current = true;
        setCvImprovementDiffActionsPending(true);
        setAssistantBusyStage('validating');
        try {
          let patchToCommit: Record<string, unknown>;
          let highlightSection = globalAssistantFullResult?.sectionDiffs[0]
            ?.targetSection;

          if (assistantScope === 'full_cv' && assistantSectionDiffs.length > 0) {
            if (changeIndex != null && changeIndex >= 0) {
              const sd = assistantSectionDiffs[changeIndex];
              if (!sd) {
                cvImprovementDiffInFlightRef.current = false;
                setCvImprovementDiffActionsPending(false);
                return;
              }
              patchToCommit = sd.patch;
              highlightSection = sd.targetSection;
            } else {
              patchToCommit =
                assistantPendingPatch && typeof assistantPendingPatch === 'object'
                  ? assistantPendingPatch
                  : {};
            }
          } else {
            patchToCommit =
              assistantPendingPatch && typeof assistantPendingPatch === 'object'
                ? assistantPendingPatch
                : {};
            highlightSection =
              diffPreview.section?.trim() ||
              String(diffPreview.changedFields[0]?.fieldPath ?? 'summary');
          }

          const commitResult = await commitAssistantAcceptedPatch({
            queryClient,
            profileId: id,
            patch: patchToCommit,
            commandId: assistantCommandIdRef.current.trim() || undefined,
            onRehydrated: () => {
              setCvServerHydrateNonce((n) => n + 1);
              setAssistantPatchNonce((n) => n + 1);
            },
          });

          if (
            assistantScope === 'full_cv' &&
            changeIndex != null &&
            changeIndex >= 0
          ) {
            const nextDiffs = assistantSectionDiffs.filter(
              (_, i) => i !== changeIndex,
            );
            setAssistantSectionDiffs(nextDiffs);
            if (nextDiffs.length === 0) {
              setInstantPreviewPatch(null);
              clearAssistantPreview();
              toast.success(
                commitResult.message || 'Changes saved to your CV.',
              );
            } else {
              const remainingPatch = mergeGlobalAssistantPatches(
                nextDiffs,
                nextDiffs.map((d) => d.targetSection),
              );
              setAssistantPendingPatch(remainingPatch);
              setDiffPreviews((prev) => ({
                ...prev,
                [CV_ASSISTANT_DIFF_PREVIEW_KEY]: normalizeCvDiffPreviewParams({
                  previewMapKey: CV_ASSISTANT_DIFF_PREVIEW_KEY,
                  section: nextDiffs[0]?.targetSection ?? 'summary',
                  before: null,
                  after: null,
                  pointer: '__assistant__',
                  changedFields: globalAssistantChangedFields(nextDiffs),
                }),
              }));
              toast.success(
                `${assistantChangedFieldLabel(highlightSection ?? '')} updated.`,
              );
            }
          } else {
            setInstantPreviewPatch(null);
            clearAssistantPreview();
            toast.success(
              commitResult.message || 'Changes saved to your CV.',
            );
          }

          const highlightId = assistantTargetSectionToEditorId(
            commitResult.targetSection ||
              highlightSection ||
              diffPreview.section ||
              'summary',
            commitResult.sections,
          );
          setAssistantAcceptHighlight({
            sectionId: highlightId,
            nonce: Date.now(),
          });
        } catch (e) {
          toast.error(
            formatApiErrorForToast(
              e,
              'Could not save assistant changes. Try again.',
            ),
          );
        } finally {
          cvImprovementDiffInFlightRef.current = false;
          setCvImprovementDiffActionsPending(false);
          setAssistantBusyStage(null);
        }
        return;
      }
      if (cvImprovementDiffInFlightRef.current) return;
      cvImprovementDiffInFlightRef.current = true;
      setCvImprovementDiffActionsPending(true);
      const wasAcceptAll = changeIndex == null;
      const improvementsKey = cvSuggestionsQueryKey(targetId);
      const prevImprovementsPayload = wasAcceptAll
        ? queryClient.getQueryData(improvementsKey)
        : undefined;
      const selectedField =
        changeIndex != null && changeIndex >= 0
          ? (diffPreview.changedFields[changeIndex]?.fieldPath ?? '').trim()
          : '';
      try {
        const requestPointer =
          selectedField.length > 0
            ? ((await resolveImprovementPointerByField(selectedField)) ??
              diffPreview.pointer)
            : diffPreview.pointer;
        if (wasAcceptAll) {
          queryClient.setQueryData<CvImprovementsPayload>(
            improvementsKey,
            (prev) => {
              if (!prev || !Array.isArray(prev.improvements)) return prev;
              return {
                ...prev,
                improvements: prev.improvements.filter(
                  (it) =>
                    (it?.id ?? '').trim() !== String(requestPointer).trim(),
                ),
              };
            },
          );
        }
        /** Full suggestion accept/reject — product route (no per-field body). */
        if (selectedField.length === 0) {
          const t0 = Date.now();
          let cacheWrites = 0;
          const product = await api.cv.acceptSuggestion(
            String(requestPointer),
            targetId ?? undefined,
          );
          logCvMutationCommitDev(
            'cvPage.commitAcceptDiff.acceptSuggestion',
            product,
          );
          cacheWrites += 1;
          queryClient.setQueryData<CvImprovementsPayload>(
            improvementsKey,
            (prev) =>
              applySuggestionAcceptToImprovementsCache(
                prev,
                String(requestPointer).trim(),
                product,
              ) ?? prev,
          );
          cacheWrites += 1;
          closeDiffPreviewForKey(opKey);
          if (product.alreadyApplied) {
            toast.success('This suggestion was already applied.');
          } else if (product.idempotent) {
            toast.success('Already up to date.');
          } else {
            toast.success('Suggestion applied successfully.');
          }
          if (shouldShowTruthfulnessAdjustNotice(product)) {
            toast.info(
              product.truthfulnessWarnings?.find((w) => w.trim())?.trim() ??
                'Some edits were checked against your CV and adjusted before applying.',
            );
          }
          await syncCvBuilderFromServer();
          scheduleSectionResyncIfBackgroundTasks(product);
          const inv = reconcileAfterMutation(targetId, 'structuralAccept');
          logCvSuggestionMutationClientPerf(
            'commitAcceptDiff.acceptSuggestion',
            t0,
            {
              invalidations: inv,
              cacheWrites,
            },
          );
          return;
        }

        /** Field-level accept after Apply-with-AI preview — POST /cv/improvements/:id/accept + draftHash (backend partial queue). */
        const result = await api.cv.acceptImprovement(
          requestPointer,
          targetId ?? undefined,
          {
            ...(selectedField ? { acceptedFields: [selectedField] } : {}),
            ...(diffPreview.draftHash
              ? { draftHash: diffPreview.draftHash }
              : {}),
          },
        );
        if (result.partial) {
          const nextPointer = result.improvementId ?? diffPreview.pointer;
          const freshNext = await api.cv.applyImprovement(
            nextPointer,
            targetId ?? undefined,
          );
          logCvMaterializePerformanceDev(
            'cvPage.commitAcceptDiff.partialContinue',
            freshNext,
          );
          const nextHash = result.draftHash ?? freshNext.draftHash;
          setDiffPreviews((prev) => {
            if (!opKey) return prev;
            const cur = prev[opKey];
            if (!cur) return prev;
            return {
              ...prev,
              [opKey]: {
                ...cur,
                pointer: nextPointer,
                draftHash: nextHash,
                before: freshNext.before ?? cur.before,
                after: freshNext.after ?? cur.after,
                changedFields: freshNext.changedFields ?? cur.changedFields,
                ...truthfulnessFieldsFromResponse(freshNext),
                performance: compactDiffPreviewPerformance(freshNext),
              },
            };
          });
          void queryClient.invalidateQueries({
            queryKey: cvSuggestionsQueryKey(targetId),
          });
          toast.success('Change accepted.');
          return;
        }
        queryClient.setQueryData<CvImprovementsPayload>(
          cvSuggestionsQueryKey(targetId),
          (prev) => {
            if (!prev || !Array.isArray(prev.improvements)) return prev;
            const acceptedKey = selectedField.trim();
            const nextImprovements = prev.improvements.filter((item) => {
              if (result.improvementId && item?.id === result.improvementId)
                return false;
              if (
                acceptedKey.length > 0 &&
                Array.isArray(item?.pendingFieldPaths) &&
                item.pendingFieldPaths.some((p) => p.trim() === acceptedKey)
              ) {
                return false;
              }
              return true;
            });
            return {
              ...prev,
              improvements: nextImprovements,
              pendingSuggestionsCount:
                result.pendingSuggestionsCount ??
                Math.max(0, nextImprovements.length),
              cvRevisionId:
                result.cvRevisionId !== undefined
                  ? result.cvRevisionId
                  : (prev.cvRevisionId ?? null),
              structuredRevisionHash:
                result.structuredRevisionHash !== undefined
                  ? result.structuredRevisionHash
                  : prev.structuredRevisionHash,
            };
          },
        );
        closeDiffPreviewForKey(opKey);
        toast.success('Suggestion applied successfully.');
        if (shouldShowTruthfulnessAdjustNotice(result)) {
          toast.info(
            result.truthfulnessWarnings?.find((w) => w.trim())?.trim() ??
              'Some edits were checked against your CV and adjusted before applying.',
          );
        }
        logCvMutationCommitDev(
          'cvPage.commitAcceptDiff.acceptImprovement',
          result,
        );
        const t0 = Date.now();
        await syncCvBuilderFromServer();
        scheduleSectionResyncIfBackgroundTasks(result);
        const inv = reconcileAfterMutation(targetId, 'structuralAccept');
        logCvSuggestionMutationClientPerf(
          'commitAcceptDiff.acceptImprovement',
          t0,
          {
            invalidations: inv,
            cacheWrites: 1,
          },
        );
      } catch (e) {
        if (wasAcceptAll && prevImprovementsPayload !== undefined) {
          queryClient.setQueryData(improvementsKey, prevImprovementsPayload);
        }
        const code = getApiErrorCode(e);
        if (
          code === 'IMPROVEMENT_INVALID_FIELD_SELECTION' ||
          code === 'IMPROVEMENT_STALE_INDEX'
        ) {
          try {
            let pointerForRefresh = diffPreview.pointer;
            if (code === 'IMPROVEMENT_STALE_INDEX' && selectedField) {
              const resolvedId =
                await resolveImprovementPointerByField(selectedField);
              if (resolvedId) pointerForRefresh = resolvedId;
            }
            const fresh = await api.cv.applyImprovement(
              pointerForRefresh,
              targetId ?? undefined,
            );
            logCvMaterializePerformanceDev(
              'cvPage.commitAcceptDiff.staleRefresh',
              fresh,
            );
            const freshPreview = {
              ...diffPreview,
              pointer: pointerForRefresh,
              draftHash: fresh.draftHash,
              changedFields: fresh.changedFields,
              ...truthfulnessFieldsFromResponse(fresh),
              performance: compactDiffPreviewPerformance(fresh),
            };
            const selectedStillExists =
              selectedField.length > 0 &&
              freshPreview.changedFields.some(
                (cf) => (cf.fieldPath ?? '').trim() === selectedField,
              );
            if (selectedField && selectedStillExists) {
              const retry = await api.cv.acceptImprovement(
                pointerForRefresh,
                targetId ?? undefined,
                {
                  acceptedFields: [selectedField],
                  ...(fresh.draftHash ? { draftHash: fresh.draftHash } : {}),
                },
              );
              if (retry.partial) {
                const nextPointer = retry.improvementId ?? pointerForRefresh;
                const freshNext = await api.cv.applyImprovement(
                  nextPointer,
                  targetId ?? undefined,
                );
                logCvMaterializePerformanceDev(
                  'cvPage.commitAcceptDiff.staleRetryPartial',
                  freshNext,
                );
                setDiffPreviews((prev) => {
                  if (!opKey) return prev;
                  const cur = prev[opKey];
                  if (!cur) return prev;
                  return {
                    ...prev,
                    [opKey]: {
                      ...freshPreview,
                      pointer: nextPointer,
                      draftHash: retry.draftHash ?? freshNext.draftHash,
                      before: freshNext.before ?? freshPreview.before,
                      after: freshNext.after ?? freshPreview.after,
                      changedFields:
                        freshNext.changedFields ?? freshPreview.changedFields,
                      ...truthfulnessFieldsFromResponse(freshNext),
                      ...truthfulnessFieldsFromResponse(retry),
                      performance: compactDiffPreviewPerformance(freshNext),
                    },
                  };
                });
                toast.success('Change accepted.');
                return;
              }
              closeDiffPreviewForKey(opKey);
              if (retry.alreadyApplied) {
                toast.success('This suggestion was already applied.');
              } else if (retry.idempotent) {
                toast.success('Already up to date.');
              } else {
                toast.success('Suggestion applied successfully.');
              }
              if (shouldShowTruthfulnessAdjustNotice(retry)) {
                toast.info(
                  retry.truthfulnessWarnings?.find((w) => w.trim())?.trim() ??
                    'Some edits were checked against your CV and adjusted before applying.',
                );
              }
              logCvMutationCommitDev(
                'cvPage.commitAcceptDiff.staleRetryAcceptImprovement',
                retry,
              );
              const t0Retry = Date.now();
              await syncCvBuilderFromServer();
              scheduleSectionResyncIfBackgroundTasks(retry);
              const inv = reconcileAfterMutation(targetId, 'structuralAccept');
              logCvSuggestionMutationClientPerf(
                'commitAcceptDiff.staleRetryAcceptImprovement',
                t0Retry,
                {
                  invalidations: inv,
                  cacheWrites: 1,
                },
              );
              return;
            }
            if (selectedField.length === 0) {
              const t0 = Date.now();
              const product = await api.cv.acceptSuggestion(
                String(pointerForRefresh),
                targetId ?? undefined,
              );
              logCvMutationCommitDev(
                'cvPage.commitAcceptDiff.staleRefreshAcceptSuggestion',
                product,
              );
              queryClient.setQueryData<CvImprovementsPayload>(
                improvementsKey,
                (prev) =>
                  applySuggestionAcceptToImprovementsCache(
                    prev,
                    String(pointerForRefresh).trim(),
                    product,
                  ) ?? prev,
              );
              closeDiffPreviewForKey(opKey);
              if (product.alreadyApplied) {
                toast.success('This suggestion was already applied.');
              } else if (product.idempotent) {
                toast.success('Already up to date.');
              } else {
                toast.success('Suggestion applied successfully.');
              }
              if (shouldShowTruthfulnessAdjustNotice(product)) {
                toast.info(
                  product.truthfulnessWarnings?.find((w) => w.trim())?.trim() ??
                    'Some edits were checked against your CV and adjusted before applying.',
                );
              }
              await syncCvBuilderFromServer();
              scheduleSectionResyncIfBackgroundTasks(product);
              const inv = reconcileAfterMutation(targetId, 'structuralAccept');
              logCvSuggestionMutationClientPerf(
                'commitAcceptDiff.staleRefreshAcceptSuggestion',
                t0,
                {
                  invalidations: inv,
                  cacheWrites: 2,
                },
              );
              return;
            }
            setDiffPreviews((prev) => {
              if (!opKey) return prev;
              return { ...prev, [opKey]: freshPreview };
            });
            toast.info(
              'Suggestion changed. Review updated fields and try again.',
            );
            return;
          } catch (refreshErr) {
            logCvMutationErrorDev('commitAcceptDiff.refresh', refreshErr);
            toast.error(
              getApiErrorMessage(refreshErr) ||
                'Could not refresh this suggestion. Please try again.',
            );
            return;
          }
        }
        const msg = (getApiErrorMessage(e) || '').toLowerCase();
        const missingDraft =
          msg.includes('no draft found') || msg.includes('run apply first');
        if (missingDraft) {
          try {
            const prep = await api.cv.applyImprovement(
              diffPreview.pointer,
              targetId ?? undefined,
            );
            logCvMaterializePerformanceDev(
              'cvPage.commitAcceptDiff.missingDraftPrep',
              prep,
            );
            if (isCvApplyImprovementTerminalNoDiff(prep)) {
              const rid = String(
                prep.suggestionId ||
                  prep.improvementId ||
                  prep.pointer ||
                  diffPreview.pointer,
              ).trim();
              queryClient.setQueryData<CvImprovementsPayload>(
                improvementsKey,
                (prev) =>
                  applySuggestionAcceptToImprovementsCache(prev, rid, {
                    pendingSuggestionsCount:
                      prep.pendingSuggestionsCount ??
                      Math.max(
                        0,
                        (prev?.improvements ?? []).filter(
                          (it) => (it?.id ?? '').trim() !== rid,
                        ).length,
                      ),
                    cvRevisionId: prep.cvRevisionId ?? null,
                    alreadyApplied: true,
                    acceptedSuggestionIds: [rid],
                  }) ?? prev,
              );
              closeDiffPreviewForKey(opKey);
              toast.success(toastCopyForTerminalNoDiffApply(prep));
              const t0Term = Date.now();
              await syncCvBuilderFromServer();
              const inv = reconcileAfterMutation(targetId, 'queueOnly');
              logCvSuggestionMutationClientPerf(
                'cvPage.commitAcceptDiff.missingDraft.terminalNoDiff',
                t0Term,
                {
                  invalidations: inv,
                  cacheWrites: 1,
                },
              );
              return;
            }
            const sf =
              changeIndex != null && changeIndex >= 0
                ? (
                    diffPreview.changedFields[changeIndex]?.fieldPath ?? ''
                  ).trim()
                : '';
            if (sf) {
              const acceptRes = await api.cv.acceptImprovement(
                diffPreview.pointer,
                targetId ?? undefined,
                {
                  acceptedFields: [sf],
                  ...(prep.draftHash ? { draftHash: prep.draftHash } : {}),
                },
              );
              logCvMutationCommitDev(
                'cvPage.commitAcceptDiff.missingDraftAcceptImprovement',
                acceptRes,
              );
              closeDiffPreviewForKey(opKey);
              toast.success('Suggestion applied successfully.');
              const t0Md = Date.now();
              await syncCvBuilderFromServer();
              scheduleSectionResyncIfBackgroundTasks(acceptRes);
              const inv = reconcileAfterMutation(targetId, 'structuralAccept');
              logCvSuggestionMutationClientPerf(
                'commitAcceptDiff.missingDraftAcceptImprovement',
                t0Md,
                {
                  invalidations: inv,
                  cacheWrites: 1,
                },
              );
            } else {
              const t0Md = Date.now();
              const prodMissing = await api.cv.acceptSuggestion(
                String(diffPreview.pointer),
                targetId ?? undefined,
              );
              logCvMutationCommitDev(
                'cvPage.commitAcceptDiff.missingDraftAcceptSuggestion',
                prodMissing,
              );
              queryClient.setQueryData<CvImprovementsPayload>(
                improvementsKey,
                (prev) =>
                  applySuggestionAcceptToImprovementsCache(
                    prev,
                    String(diffPreview.pointer).trim(),
                    prodMissing,
                  ) ?? prev,
              );
              closeDiffPreviewForKey(opKey);
              toast.success('Suggestion applied successfully.');
              await syncCvBuilderFromServer();
              scheduleSectionResyncIfBackgroundTasks(prodMissing);
              const inv = reconcileAfterMutation(targetId, 'structuralAccept');
              logCvSuggestionMutationClientPerf(
                'commitAcceptDiff.missingDraftAcceptSuggestion',
                t0Md,
                {
                  invalidations: inv,
                  cacheWrites: 2,
                },
              );
            }
            return;
          } catch (retryErr) {
            logCvMutationErrorDev(
              'commitAcceptDiff.missingDraftRetry',
              retryErr,
            );
            toast.error(
              getApiErrorMessage(retryErr) ||
                'Could not apply this improvement. Please try again.',
            );
          }
        } else {
          logCvMutationErrorDev('commitAcceptDiff', e);
          toast.error(
            getApiErrorMessage(e) ||
              'Could not apply this improvement. Please try again.',
          );
        }
        /* keep diffPreview so user can retry */
      } finally {
        cvImprovementDiffInFlightRef.current = false;
        setCvImprovementDiffActionsPending(false);
      }
    },
    [
      assistantPendingPatch,
      assistantPreviewMode,
      assistantScope,
      assistantSectionDiffs,
      globalAssistantFullResult?.sectionDiffs,
      activeDiffPreviewKey,
      diffPreviews,
      targetId,
      queryClient,
      toast,
      resolveImprovementPointerByField,
      syncCvBuilderFromServer,
      scheduleSectionResyncIfBackgroundTasks,
      clearAssistantPreview,
      reconcileAfterMutation,
    ],
  );

  const commitRejectDiff = useCallback(
    async (changeIndex?: number) => {
      const opKey = activeDiffPreviewKey;
      const diffPreview = opKey ? (diffPreviews[opKey] ?? null) : null;
      if (!diffPreview) return;
      if (assistantPreviewMode && diffPreview.pointer === '__assistant__') {
        if (
          assistantScope === 'full_cv' &&
          changeIndex != null &&
          changeIndex >= 0 &&
          assistantSectionDiffs.length > 0
        ) {
          const nextDiffs = assistantSectionDiffs.filter(
            (_, i) => i !== changeIndex,
          );
          if (nextDiffs.length === 0) {
            clearAssistantPreview();
            void queryClient.refetchQueries({
              queryKey: queryKeys.cv.profile(targetId ?? ''),
            });
            return;
          }
          setAssistantSectionDiffs(nextDiffs);
          setAssistantPendingPatch(
            mergeGlobalAssistantPatches(
              nextDiffs,
              nextDiffs.map((d) => d.targetSection),
            ),
          );
          setDiffPreviews((prev) => ({
            ...prev,
            [CV_ASSISTANT_DIFF_PREVIEW_KEY]: normalizeCvDiffPreviewParams({
              previewMapKey: CV_ASSISTANT_DIFF_PREVIEW_KEY,
              section: nextDiffs[0]?.targetSection ?? 'summary',
              before: null,
              after: null,
              pointer: '__assistant__',
              changedFields: globalAssistantChangedFields(nextDiffs),
            }),
          }));
          return;
        }
        clearAssistantPreview();
        void queryClient.refetchQueries({
          queryKey: queryKeys.cv.profile(targetId ?? ''),
        });
        return;
      }
      if (cvImprovementDiffInFlightRef.current) return;
      cvImprovementDiffInFlightRef.current = true;
      setCvImprovementDiffActionsPending(true);
      const wasRejectAll = changeIndex == null;
      const improvementsKey = cvSuggestionsQueryKey(targetId ?? '');
      const prevImprovementsPayload = wasRejectAll
        ? queryClient.getQueryData(improvementsKey)
        : undefined;
      let shouldClosePreview = true;
      const selectedField =
        changeIndex != null && changeIndex >= 0
          ? (diffPreview.changedFields[changeIndex]?.fieldPath ?? '').trim()
          : '';
      try {
        const requestPointer =
          selectedField.length > 0
            ? ((await resolveImprovementPointerByField(selectedField)) ??
              diffPreview.pointer)
            : diffPreview.pointer;
        if (wasRejectAll) {
          queryClient.setQueryData<CvImprovementsPayload>(
            improvementsKey,
            (prev) => {
              if (!prev || !Array.isArray(prev.improvements)) return prev;
              return {
                ...prev,
                improvements: prev.improvements.filter(
                  (it) =>
                    (it?.id ?? '').trim() !== String(requestPointer).trim(),
                ),
              };
            },
          );
        }
        if (selectedField.length === 0) {
          const product = await api.cv.rejectSuggestion(
            String(requestPointer),
            targetId ?? undefined,
          );
          logCvMutationCommitDev(
            'cvPage.commitRejectDiff.rejectSuggestion',
            product,
          );
          queryClient.setQueryData<CvImprovementsPayload>(
            improvementsKey,
            (prev) =>
              applySuggestionRejectToImprovementsCache(
                prev,
                String(requestPointer).trim(),
                product,
              ) ?? prev,
          );
          if (product.idempotent) {
            toast.success('Already dismissed.');
          } else if (product.alreadyApplied) {
            toast.success('This suggestion was already applied.');
          } else {
            toast.success('Suggestion dismissed.');
          }
          const t0Rj = Date.now();
          const inv = reconcileAfterMutation(targetId, 'queueOnly');
          logCvSuggestionMutationClientPerf(
            'commitRejectDiff.rejectSuggestion',
            t0Rj,
            {
              invalidations: inv,
              cacheWrites: 1,
            },
          );
          return;
        }

        /** Field-level reject on preview — POST /cv/improvements/:id/reject + draftHash. */
        const result = await api.cv.rejectImprovement(
          requestPointer,
          targetId ?? undefined,
          {
            ...(selectedField ? { rejectedFields: [selectedField] } : {}),
            ...(diffPreview.draftHash
              ? { draftHash: diffPreview.draftHash }
              : {}),
          },
        );
        if (result.partial) {
          const nextPointer = result.improvementId ?? diffPreview.pointer;
          const freshNext = await api.cv.applyImprovement(
            nextPointer,
            targetId ?? undefined,
          );
          logCvMaterializePerformanceDev(
            'cvPage.commitRejectDiff.partialContinue',
            freshNext,
          );
          setDiffPreviews((prev) => {
            if (!opKey) return prev;
            const cur = prev[opKey];
            if (!cur) return prev;
            return {
              ...prev,
              [opKey]: {
                ...cur,
                pointer: nextPointer,
                draftHash: result.draftHash ?? freshNext.draftHash,
                before: freshNext.before ?? cur.before,
                after: freshNext.after ?? cur.after,
                changedFields: freshNext.changedFields ?? cur.changedFields,
                ...truthfulnessFieldsFromResponse(freshNext),
                performance: compactDiffPreviewPerformance(freshNext),
              },
            };
          });
          void queryClient.invalidateQueries({
            queryKey: cvSuggestionsQueryKey(targetId),
          });
          toast.info('Change rejected.');
          shouldClosePreview = false;
          return;
        }
        toast.success('Suggestion dismissed.');
      } catch (e) {
        if (wasRejectAll && prevImprovementsPayload !== undefined) {
          queryClient.setQueryData(improvementsKey, prevImprovementsPayload);
        }
        const code = getApiErrorCode(e);
        if (
          code === 'IMPROVEMENT_INVALID_FIELD_SELECTION' ||
          code === 'IMPROVEMENT_STALE_INDEX'
        ) {
          try {
            let pointerForRefresh = diffPreview.pointer;
            if (code === 'IMPROVEMENT_STALE_INDEX' && selectedField) {
              const resolvedId =
                await resolveImprovementPointerByField(selectedField);
              if (resolvedId) pointerForRefresh = resolvedId;
            }
            const fresh = await api.cv.applyImprovement(
              pointerForRefresh,
              targetId ?? undefined,
            );
            logCvMaterializePerformanceDev(
              'cvPage.commitRejectDiff.staleRefresh',
              fresh,
            );
            setDiffPreviews((prev) => {
              if (!opKey) return prev;
              return {
                ...prev,
                [opKey]: {
                  ...diffPreview,
                  pointer: pointerForRefresh,
                  draftHash: fresh.draftHash,
                  changedFields: fresh.changedFields,
                  ...truthfulnessFieldsFromResponse(fresh),
                  performance: compactDiffPreviewPerformance(fresh),
                },
              };
            });
            toast.info(
              'Suggestion changed. Review updated fields and try again.',
            );
            shouldClosePreview = false;
            return;
          } catch (refreshErr) {
            logCvMutationErrorDev('commitRejectDiff.refresh', refreshErr);
            toast.error(
              getApiErrorMessage(refreshErr) ||
                'Could not refresh this suggestion. Please try again.',
            );
            return;
          }
        }
        logCvMutationErrorDev('commitRejectDiff', e);
        toast.error(
          getApiErrorMessage(e) ||
            'Could not reject this improvement. Please try again.',
        );
      } finally {
        cvImprovementDiffInFlightRef.current = false;
        setCvImprovementDiffActionsPending(false);
        if (shouldClosePreview) closeDiffPreviewForKey(opKey);
      }
    },
    [
      assistantPreviewMode,
      assistantScope,
      assistantSectionDiffs,
      activeDiffPreviewKey,
      diffPreviews,
      targetId,
      queryClient,
      toast,
      resolveImprovementPointerByField,
      clearAssistantPreview,
      closeDiffPreviewForKey,
      reconcileAfterMutation,
    ],
  );

  const runAssistantCommand = useCallback(
    async (
      command: string,
      clarifications?: Array<{ question: string; answer: string }>,
      targetSection?: string,
    ): Promise<CvAssistantRunResult> => {
      if (!targetId?.trim()) return 'skipped';
      const ts = targetSection?.trim();
      if (!ts) {
        toast.error(
          'Open the assistant on a section, or pick a section in the editor first.',
        );
        return 'skipped';
      }
      setAssistantBusy(true);
      setAssistantBusyStage('generating');
      try {
        const mergedClarifications =
          clarifications && clarifications.length > 0
            ? [
                ...(assistantClarification?.clarifications ?? []),
                ...clarifications,
              ]
            : assistantClarification?.clarifications;
        const res: CvAssistantCommandResponse = await api.cv.assistantCommand(
          targetId,
          {
            command,
            targetSection: ts,
            clarifications: mergedClarifications,
          },
        );
        if (res.type === 'clarify') {
          assistantCommandIdRef.current = res.commandId?.trim() ?? '';
          setAssistantClarification({
            command,
            question: res.question,
            clarifications: mergedClarifications ?? [],
            targetSection: ts,
          });
          setClarificationModalOpen(true);
          return 'clarify';
        }
        setAssistantClarification(null);
        setClarificationModalOpen(false);
        setGlobalAssistantFindings(null);
        setGlobalAssistantFullResult(null);
        setGlobalAssistantReviewOpen(false);
        setAssistantScope('section');
        setAssistantSectionDiffs([]);
        setAssistantBusyStage('validating');
        setAssistantPreviewMode(true);
        setAssistantPendingPatch(res.patch);
        assistantCommandIdRef.current = res.commandId?.trim() ?? '';
        const target = (res.targetSection ?? ts).trim() || 'summary';
        const { before: beforeDisplay, after: afterDisplay } =
          assistantDiffDisplayStrings(target, res.diff.before, res.diff.after);
        setDiffPreviews((prev) => ({
          ...prev,
          [CV_ASSISTANT_DIFF_PREVIEW_KEY]: normalizeCvDiffPreviewParams({
            previewMapKey: CV_ASSISTANT_DIFF_PREVIEW_KEY,
            section: target,
            before: res.diff.before,
            after: res.diff.after,
            pointer: '__assistant__',
            changedFields: [
              {
                fieldPath: target,
                field: assistantChangedFieldLabel(target),
                fieldLabel: res.affectedScopeLabel,
                before: beforeDisplay,
                after: afterDisplay,
                type: 'changed',
              },
            ],
          }),
        }));
        setActiveDiffPreviewKey(CV_ASSISTANT_DIFF_PREVIEW_KEY);
        toast.success(
          res.diff.summary ||
            `${res.affectedScopeLabel}: ready for review — accept or reject when done`,
        );
        return 'ok';
      } catch (e) {
        toast.error(
          formatApiErrorForToast(e, 'Assistant command failed'),
        );
        return 'error';
      } finally {
        setAssistantBusy(false);
        setAssistantBusyStage(null);
      }
    },
    [
      assistantClarification?.clarifications,
      targetId,
      toast,
    ],
  );

  const runGlobalAssistantCommand = useCallback(
    async (
      command: string,
      options?: {
        operation?: CvGlobalAssistantOperationKey;
        clarifications?: Array<{ question: string; answer: string }>;
        findings?: string[];
        scanCommandId?: string;
      },
    ): Promise<CvAssistantRunResult> => {
      if (!targetId?.trim()) return 'skipped';
      setAssistantBusy(true);
      setAssistantBusyStage(
        options?.operation === 'apply_recruiter_findings' ? 'applying' : 'generating',
      );
      try {
        const mergedClarifications =
          options?.clarifications && options.clarifications.length > 0
            ? [
                ...(globalAssistantClarification?.clarifications ?? []),
                ...options.clarifications,
              ]
            : globalAssistantClarification?.clarifications;
        const res = await api.cv.assistantGlobalCommand(targetId, {
          command,
          operation: options?.operation ?? globalAssistantClarification?.operation,
          clarifications: mergedClarifications,
          ...(options?.findings?.length ? { findings: options.findings } : {}),
          ...(options?.scanCommandId?.trim()
            ? { scanCommandId: options.scanCommandId.trim() }
            : {}),
        });
        if (res.type === 'clarify') {
          assistantCommandIdRef.current = res.commandId?.trim() ?? '';
          setGlobalAssistantClarification({
            command,
            question: res.question,
            clarifications: mergedClarifications ?? [],
            operation:
              options?.operation ?? globalAssistantClarification?.operation,
          });
          setClarificationModalOpen(true);
          return 'clarify';
        }
        setGlobalAssistantClarification(null);
        setAssistantClarification(null);
        setClarificationModalOpen(false);
        assistantCommandIdRef.current = res.commandId?.trim() ?? '';
        setAssistantBusyStage('validating');

        if (res.scope === 'findings') {
          setAssistantScope('findings');
          const inventory = buildCvSectionInventory(
            cvDataSnapshot ?? initialData,
            sections,
          );
          const { result: filteredFindings, dropped } =
            filterRecruiterScanFindingsResult(res, inventory);
          logUnrealisticCvRecommendationDropDev(
            'recruiter_scan',
            targetId,
            dropped,
          );
          const comprehensiveSession = recruiterScanSessionFromFindings(filteredFindings);
          if (comprehensiveSession && res.operation === 'recruiter_scan') {
            openRecruiterScanSession(comprehensiveSession);
            setGlobalAssistantFullResult(null);
            setGlobalAssistantReviewOpen(false);
            setAssistantPreviewMode(false);
            setAssistantPendingPatch(null);
            setAssistantSectionDiffs([]);
            closeDiffPreviewForKey(CV_ASSISTANT_DIFF_PREVIEW_KEY);
            setGlobalAssistantOpen(false);
            toast.success(
              filteredFindings.diff.summary || 'Recruiter scan complete',
            );
            return 'ok';
          }
          setGlobalAssistantFindings(filteredFindings);
          setGlobalAssistantFullResult(null);
          setGlobalAssistantReviewOpen(false);
          setAssistantPreviewMode(false);
          setAssistantPendingPatch(null);
          setAssistantSectionDiffs([]);
          closeDiffPreviewForKey(CV_ASSISTANT_DIFF_PREVIEW_KEY);
          setGlobalAssistantOpen(false);
          toast.success(
            res.diff.summary || `${res.affectedScopeLabel} ready`,
          );
          return 'ok';
        }

        setAssistantScope('full_cv');
        setGlobalAssistantFindings(null);
        setGlobalAssistantFullResult(res);
        setGlobalAssistantReviewOpen(true);
        setAssistantPreviewMode(true);
        setAssistantPendingPatch(res.patch);
        setAssistantSectionDiffs(res.sectionDiffs);
        const globalChangedFields = globalAssistantChangedFields(res.sectionDiffs);
        setDiffPreviews((prev) => ({
          ...prev,
          [CV_ASSISTANT_DIFF_PREVIEW_KEY]: normalizeCvDiffPreviewParams({
            previewMapKey: CV_ASSISTANT_DIFF_PREVIEW_KEY,
            section: res.sectionDiffs[0]?.targetSection ?? 'summary',
            before: null,
            after: null,
            pointer: '__assistant__',
            changedFields: globalChangedFields,
          }),
        }));
        setActiveDiffPreviewKey(CV_ASSISTANT_DIFF_PREVIEW_KEY);
        setGlobalAssistantOpen(false);
        const firstSection = res.sectionDiffs[0]?.targetSection?.trim();
        if (firstSection) {
          const jumpId = assistantTargetSectionToEditorId(
            firstSection,
            sections,
          );
          queueMicrotask(() => jumpToSectionRef.current?.(jumpId));
        }
        toast.success(
          res.diff.summary ||
            `${res.affectedScopeLabel}: ready for review — accept or reject when done`,
        );
        return 'ok';
      } catch (e) {
        toast.error(
          formatApiErrorForToast(e, 'Global assistant command failed'),
        );
        return 'error';
      } finally {
        setAssistantBusy(false);
        setAssistantBusyStage(null);
      }
    },
    [
      closeDiffPreviewForKey,
      cvDataSnapshot,
      initialData,
      sections,
      globalAssistantClarification?.clarifications,
      globalAssistantClarification?.operation,
      initialData,
      openRecruiterScanSession,
      targetId,
      toast,
    ],
  );

  const handleClarificationModalSubmit = useCallback(
    async (answer: string) => {
      if (recruiterScanClarification) {
        const { question, targetRole } = recruiterScanClarification;
        setClarificationModalOpen(false);
        await runRecruiterScan({
          targetRole,
          clarifications: [{ question, answer }],
        });
        return;
      }
      if (globalAssistantClarification) {
        const { command, question, operation } = globalAssistantClarification;
        await runGlobalAssistantCommand(command, {
          operation,
          clarifications: [{ question, answer }],
        });
        return;
      }
      if (assistantClarification) {
        const { command, question, targetSection } = assistantClarification;
        await runAssistantCommand(
          command,
          [{ question, answer }],
          targetSection,
        );
      }
    },
    [
      assistantClarification,
      globalAssistantClarification,
      recruiterScanClarification,
      runAssistantCommand,
      runGlobalAssistantCommand,
      runRecruiterScan,
    ],
  );

  const handleClarificationModalCancel = useCallback(() => {
    setClarificationModalOpen(false);
    setGlobalAssistantClarification(null);
    setAssistantClarification(null);
    setRecruiterScanClarification(null);
  }, []);

  const globalAssistantChangedFieldsMemo = useMemo(
    () => globalAssistantChangedFields(assistantSectionDiffs),
    [assistantSectionDiffs],
  );

  const handleApplyRecruiterFindings = useCallback(
    async (payload: CvGlobalAssistantApplyFindingsPayload) => {
      const result = await runGlobalAssistantCommand(payload.command, {
        operation: payload.operation,
        findings: payload.findings,
        scanCommandId: payload.scanCommandId,
      });
      if (result === 'error') {
        setGlobalAssistantOpen(true);
        setAssistantSeedCommand(payload.command);
      } else if (result === 'ok') {
        closeRecruiterScan();
      }
    },
    [closeRecruiterScan, runGlobalAssistantCommand],
  );

  const handleAcceptDiff = useCallback(
    async (changeIndex?: number) => {
      await commitAcceptDiff(changeIndex);
    },
    [commitAcceptDiff],
  );

  const handleRejectDiff = useCallback(
    async (changeIndex?: number) => {
      await commitRejectDiff(changeIndex);
    },
    [commitRejectDiff],
  );

  const effectiveExternalPatch = useMemo<Partial<CVBuilderData> | null>(
    () =>
      instantPreviewPatch ??
      (assistantPendingPatch as Partial<CVBuilderData> | null),
    [instantPreviewPatch, assistantPendingPatch],
  );
  const effectiveExternalPatchNonce = instantPreviewPatch
    ? instantPreviewPatchNonce
    : assistantPatchNonce;

  const improvementDiffTruthPanel = Boolean(
    diffPreview &&
    diffPreview.pointer !== '__assistant__' &&
    Boolean(diffPreview.section?.trim()),
  );
  const improvementDiffTruthfulness = useMemo(() => {
    if (!diffPreview || diffPreview.pointer === '__assistant__') return null;
    return truthfulnessFieldsFromResponse(diffPreview);
  }, [diffPreview]);

  const improvementDiffPerformance = useMemo(() => {
    if (!diffPreview || diffPreview.pointer === '__assistant__') return null;
    return diffPreview.performance ?? null;
  }, [diffPreview]);

  const dashboardTemplateExtras = useMemo(() => {
    const orig = profile?.originalTemplate?.trim();
    if (!orig || orig === template) return null;
    return (
      <button
        type="button"
        title={`Restore to ${orig} (your uploaded format)`}
        disabled={restoreMutation.isPending}
        onClick={() => void handleRestoreOriginal()}
        className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,201,177,0.3)] px-3 py-1.5 text-xs font-semibold text-white/55 transition hover:border-[#00C9B1]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {restoreMutation.isPending ? (
          <>
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#00C9B1]" />
            Restoring…
          </>
        ) : (
          <>
            <RotateCcw className="h-3 w-3 shrink-0 text-[#00C9B1]" />
            Restore original
          </>
        )}
      </button>
    );
  }, [
    profile?.originalTemplate,
    template,
    restoreMutation.isPending,
    handleRestoreOriginal,
  ]);

  const dashboardTemplateMeta = useMemo(() => {
    const d = profile?.detectedLayout?.trim();
    if (!d || d === 'unknown') return null;
    return (
      <p className="text-[11px] text-white/25">
        Original format detected: {formatLayoutLabel(d)}
      </p>
    );
  }, [profile?.detectedLayout]);

  const createBlank = async (tpl: CvTemplateId) => {
    try {
      const profile = await api.cv.createOrSyncTemplate({ template: tpl });
      setPickTemplate(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
      await queryClient.refetchQueries({ queryKey: queryKeys.cv.profiles() });
      const id = profile.id?.trim();
      if (id && id !== 'cv-profile') {
        toast.success('Resume created. Opening editor…');
        router.push(`/dashboard/cv?profileId=${encodeURIComponent(id)}`);
      } else {
        toast.success('Resume created. Choose it below to open the editor.');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const switchProfile = (id: string) => {
    router.push(`/dashboard/cv?profileId=${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const r = parseFloat(
        localStorage.getItem(CV_CLINIC_RIGHT_PCT_KEY) ?? '28',
      );
      if (Number.isFinite(r)) setTripleRightPct(Math.min(38, Math.max(22, r)));
      setRightPanelCollapsed(
        localStorage.getItem(CV_RIGHT_PANEL_COLLAPSED_KEY) === '1',
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CV_CLINIC_RIGHT_PCT_KEY, String(tripleRightPct));
    } catch {
      /* ignore */
    }
  }, [tripleRightPct]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        CV_RIGHT_PANEL_COLLAPSED_KEY,
        rightPanelCollapsed ? '1' : '0',
      );
    } catch {
      /* ignore */
    }
  }, [rightPanelCollapsed]);

  const onToggleRightInsightsCollapsed = useCallback(() => {
    setRightPanelCollapsed((c) => !c);
  }, []);

  const onTripleRightResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startPct = tripleRightPct;
      const totalW =
        triplePanelContainerRef.current?.offsetWidth ?? window.innerWidth;

      const onMove = (ev: PointerEvent) => {
        const delta = ((startX - ev.clientX) / totalW) * 100;
        setTripleRightPct(Math.min(38, Math.max(22, startPct + delta)));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [tripleRightPct],
  );

  const cvTopChrome = useMemo(
    () => (
      <GlowCard
        className={cn(
          'cv-mobile-top-chrome',
          profileOptions.length === 1 && profiles.length === 0
            ? 'border border-amber-500/25 bg-amber-500/[0.04]'
            : 'border border-[rgba(0,201,177,0.12)]',
        )}
        contentClassName="p-2 sm:p-2.5"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Link
              href="/dashboard/cv"
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 text-[11px] font-medium text-white/70 transition hover:border-[#00C9B1]/40 hover:text-white"
              title="CV library"
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-[#00C9B1]" />
              <span className="hidden sm:inline">Library</span>
            </Link>
            {profileOptions.length === 1 && profiles.length === 0 ? (
              <p className="min-w-0 flex-1 text-[10px] leading-snug text-amber-100/90">
                Profile list empty but this resume loaded. Check API URL if you
                expect multiple profiles.
              </p>
            ) : profileOptions.length >= 1 ? (
              <>
                <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 sm:inline">
                  CV
                </span>
                <select
                  className={cn(
                    'h-8 min-w-0 flex-1 basis-[8rem] text-xs font-medium outline-none sm:max-w-[14rem] md:max-w-[18rem] lg:max-w-[min(44vw,22rem)]',
                    cvProfileSelectClassName,
                  )}
                  style={{ colorScheme: 'dark' }}
                  value={targetId ?? ''}
                  onChange={(e) => switchProfile(e.target.value)}
                >
                  {profileOptions.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      style={{ background: '#0C0F0F', color: '#fff' }}
                    >
                      {p.name}
                      {p.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                {targetId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 shrink-0 border border-white/10 px-2 text-[11px]"
                    onClick={() => setRenameOpen(true)}
                  >
                    Rename
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-8 shrink-0 border border-[rgba(0,201,177,0.25)] px-2.5 text-xs"
              onClick={() => setCreateCvOpen(true)}
            >
              + New resume
            </Button>
            <Link
              href="/dashboard/cv-profiles"
              className="ml-auto hidden shrink-0 text-[11px] font-medium text-[#00C9B1] hover:underline sm:inline"
            >
              Manage profiles
            </Link>
          </div>

          <div className="h-px w-full bg-white/[0.08]" />

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                Score
              </span>
              {score.isLoading ? (
                <Skeleton height={22} width={44} borderRadius={6} />
              ) : displayScoreValue === null ||
                displayScoreValue === undefined ? (
                <span className="animate-pulse text-sm font-semibold text-white/45 sm:text-base">
                  Calculating…
                </span>
              ) : (
                <span className="text-sm font-extrabold tabular-nums text-[#00C9B1] sm:text-base">
                  {displayScoreValue}
                  <span className="text-xs font-medium text-white/45">
                    /100
                  </span>
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-8 shrink-0 border border-[rgba(0,201,177,0.35)] px-2.5 text-xs"
              disabled={runScan.isPending}
              onClick={async () => {
                try {
                  await runScan.mutateAsync(targetId);
                  const impr = await queryClient.fetchQuery({
                    queryKey: cvSuggestionsQueryKey(targetId),
                    queryFn: () =>
                      api.cv.getSuggestions(targetId ?? undefined, false),
                  });
                  const n =
                    impr.pendingSuggestionsCount ?? impr.improvements.length;
                  toast.success(`Scan complete: ${n} suggestions found`);
                } catch (e) {
                  toast.error(getApiErrorMessage(e));
                }
              }}
            >
              {runScan.isPending ? (
                <>
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Scan…
                </>
              ) : (
                <>
                  <FileSearch className="mr-1 inline h-3 w-3" /> Scan
                </>
              )}
            </Button>
            {improvements.data?.needsScoring ? (
              <span className="text-[10px] text-amber-200/80">
                Updating tips…
              </span>
            ) : pendingSuggestionsCountResolved > 0 ? (
              <span className="text-[10px] text-white/40">
                {pendingSuggestionsCountResolved} tips
              </span>
            ) : null}
            <span
              className="hidden h-5 w-px shrink-0 bg-white/10 sm:block"
              aria-hidden
            />
            <span className="hidden text-[10px] text-white/35 sm:inline">
              Export{' '}
              <span className="capitalize text-white/50">({template})</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              <Button
                type="button"
                className="h-8 px-2.5 text-xs sm:px-3"
                disabled={exportCv.isPending}
                onClick={() => void handleExport('pdf')}
              >
                {exportCv.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'PDF'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 border border-white/10 px-2.5 text-xs sm:px-3"
                disabled={exportCv.isPending}
                onClick={() => void handleExport('docx')}
              >
                DOCX
              </Button>
            </div>
            {targetId ? (
              <CvTopChromeMoreMenu
                targetId={targetId}
                spellChecking={qualitySignals.isSpellChecking}
                onOpenTemplatePicker={() => setTemplatePickerOpen(true)}
                onOpenSectionModal={() => setSectionModalOpen(true)}
                onOpenSectionOrder={() =>
                  sectionOrderFlow.openSuggestModal(sectionOrderFlow.suggestData)
                }
                onOpenAiChat={() => setAiChatOpen(true)}
                onTriggerSpellCheck={() => setSpellCheckTrigger((n) => n + 1)}
                inlineMenu
              />
            ) : null}
          </div>
        </div>
      </GlowCard>
    ),
    [
      profileOptions,
      profiles.length,
      targetId,
      score.isLoading,
      score.data,
      displayScoreValue,
      template,
      runScan.isPending,
      runScan.mutateAsync,
      improvements.data?.needsScoring,
      improvementList.length,
      exportCv.isPending,
      handleExport,
      queryClient,
      toast,
      qualitySignals.isSpellChecking,
    ],
  );

  const scoreCardMode = tripleRightPct < 24 ? 'compact' : 'full';

  const runToolbarAtsCheck = useCallback(async () => {
    if (!targetId) return;
    try {
      await runScan.mutateAsync(targetId);
      const impr = await queryClient.fetchQuery({
        queryKey: cvSuggestionsQueryKey(targetId),
        queryFn: () => api.cv.getSuggestions(targetId ?? undefined, false),
      });
      const n = impr.pendingSuggestionsCount ?? impr.improvements.length;
      toast.success(`Resume scan complete: ${n} suggestions found`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }, [targetId, runScan, queryClient, toast]);

  const runRightPanelAnalyzeScan = useCallback(async () => {
    if (!targetId) return;
    try {
      await runScan.mutateAsync(targetId);
      const impr = await queryClient.fetchQuery({
        queryKey: cvSuggestionsQueryKey(targetId),
        queryFn: () => api.cv.getSuggestions(targetId ?? undefined, false),
      });
      const n = impr.pendingSuggestionsCount ?? impr.improvements.length;
      toast.success(`Scan complete: ${n} formatting suggestions found`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }, [targetId, runScan, queryClient, toast]);

  const cvClinicToolbar = useMemo(
    () => (
      <CvClinicToolbar
        libraryHref="/dashboard/cv"
        targetId={targetId}
        profileOptions={profileOptions}
        onProfileChange={(id) =>
          router.push(`/dashboard/cv?profileId=${encodeURIComponent(id)}`)
        }
        onNewCv={() => setCreateCvOpen(true)}
        onOpenTemplatePicker={() => setTemplatePickerOpen(true)}
        onOpenSectionModal={() => setSectionModalOpen(true)}
        onOpenSectionOrder={() => sectionOrderFlow.openSuggestModal(sectionOrderFlow.suggestData)}
        isSectionOrderPending={sectionOrderFlow.suggestQuery.isFetching}
        isSpellChecking={qualitySignals.isSpellChecking}
        onSpellCheck={() => setSpellCheckTrigger((n) => n + 1)}
        isAtsScanPending={runScan.isPending}
        onAtsCheck={runToolbarAtsCheck}
        isExportPending={exportCv.isPending}
        onExportPdf={() => void handleExport('pdf')}
        onExportDocx={() => void handleExport('docx')}
        rightPanelCollapsed={rightPanelCollapsed}
        onToggleInsights={() => setRightPanelCollapsed((c) => !c)}
        builderSaveStatus={builderSaveStatus}
      />
    ),
    [
      targetId,
      profileOptions,
      router,
      setCreateCvOpen,
      setTemplatePickerOpen,
      setSectionModalOpen,
      runScan.isPending,
      runToolbarAtsCheck,
      queryClient,
      toast,
      exportCv.isPending,
      handleExport,
      rightPanelCollapsed,
      builderSaveStatus,
      qualitySignals.isSpellChecking,
      sectionOrderFlow.openSuggestModal,
      sectionOrderFlow.suggestData,
      sectionOrderFlow.suggestQuery.isFetching,
    ],
  );

  const cvClinicTripleLayout = useMemo(():
    | CVBuilderTripleColumnConfig
    | undefined => {
    if (!targetId) return undefined;
    return {
      containerRef: triplePanelContainerRef,
      rightPct: tripleRightPct,
      rightCollapsed: rightPanelCollapsed,
      onToggleRightCollapsed: onToggleRightInsightsCollapsed,
      onRightResizePointerDown: onTripleRightResizePointerDown,
      centerHeaderActions: null,
    };
  }, [
    targetId,
    tripleRightPct,
    rightPanelCollapsed,
    onToggleRightInsightsCollapsed,
    onTripleRightResizePointerDown,
  ]);

  useEffect(() => {
    if (!isTailorMode) {
      setTailorDraft(null);
      return;
    }
    setRightPanelCollapsed(false);
    if (!jobAnalysisIdParam) return;
    let cancelled = false;
    void api.jobs
      .getJob(jobAnalysisIdParam)
      .then((detail) => {
        if (cancelled) return;
        const td = detail.tailorDraft ?? detail.analysis?.tailorDraft ?? null;
        if (!td?.id?.trim()) return;
        if (tailorDraftIdParam && td.id !== tailorDraftIdParam) return;
        setTailorDraft(td);
      })
      .catch(() => {
        /* draft may load from sidebar session only */
      });
    return () => {
      cancelled = true;
    };
  }, [isTailorMode, jobAnalysisIdParam, tailorDraftIdParam]);

  const cvClinicTripleInsightsSlot = useMemo((): ReactNode => {
    if (!targetId) return null;
    if (isTailorMode) {
      return (
        <TailorChangePanel
          draft={tailorDraft}
          onDraftUpdate={setTailorDraft}
          onCvRehydrated={() => setCvServerHydrateNonce((n) => n + 1)}
          className="h-full min-h-0"
        />
      );
    }
    return (
      <CvClinicTripleRightPanel
        profileId={targetId}
        tripleRightTab={tripleRightTab}
        onTripleRightTabChange={setTripleRightTab}
        scoreCardMode={scoreCardMode}
        scoreLoading={score.isLoading}
        scoreValue={displayScoreValue}
        scoreBreakdown={displayScoreBreakdown}
        scorePayload={displayScorePayload}
        improvementList={improvementList}
        acceptAllQuota={acceptAllQuota}
        improvementsBadgeCount={improvementsBadgeCount}
        formatRecommendation={formatRecommendation}
        isOnRecommendedTemplate={isOnRecommendedTemplate}
        onTemplateChange={onTemplateChange}
        completenessGroups={completenessGroups}
        completenessScore={completeness?.score}
        qualitySignals={qualitySignals}
        bumpSpellCheck={() => setSpellCheckTrigger((n) => n + 1)}
        bumpSpellFixAll={() => setSpellFixAllTrigger((n) => n + 1)}
        jumpToSectionRef={jumpToSectionRef}
        resolveJumpSectionKey={resolveJumpSectionKey}
        onApplySpellIssue={onApplySpellIssue}
        onDismissSpellIssue={onDismissSpellIssue}
        analyzeScanPending={runScan.isPending}
        onAnalyzeScan={runRightPanelAnalyzeScan}
        onDiffPreview={mergeDiffPreviewOpen}
        highlightImprovementsAttention={improvementsAttentionPulse}
        onAtsKeywordAssist={handleAtsKeywordAssist}
        onRecruiterScan={() => void runRecruiterScan()}
        recruiterScanPending={assistantBusy && assistantBusyStage === 'generating'}
        onScoreRefresh={refreshScoreAfterSuggestion}
      />
    );
  }, [
    targetId,
    isTailorMode,
    tailorDraft,
    tripleRightTab,
    scoreCardMode,
    score.isLoading,
    displayScoreValue,
    displayScoreBreakdown,
    displayScorePayload,
    refreshScoreAfterSuggestion,
    improvementList,
    acceptAllQuota,
    runScan.isPending,
    runRightPanelAnalyzeScan,
    formatRecommendation,
    isOnRecommendedTemplate,
    onTemplateChange,
    qualitySignals,
    completeness?.score,
    completenessGroups,
    improvementsBadgeCount,
    resolveJumpSectionKey,
    onApplySpellIssue,
    onDismissSpellIssue,
    improvementsAttentionPulse,
    mergeDiffPreviewOpen,
    handleAtsKeywordAssist,
    runRecruiterScan,
    assistantBusy,
    assistantBusyStage,
  ]);

  if (initializing) {
    return (
      <div className="space-y-2.5">
        <Skeleton height={22} width={140} borderRadius={6} />
        <Skeleton height={88} borderRadius={12} />
        <Skeleton height={420} borderRadius={16} />
      </div>
    );
  }

  if (!hasCv) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center"
      >
        <FileText className="h-12 w-12 text-[#00C9B1]" />
        <h2 className="mt-4 text-2xl font-extrabold text-white">
          You don&apos;t have a CV yet
        </h2>
        <p className="mt-2 max-w-md text-sm text-white/50">
          Upload an existing CV or build one from scratch.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => setShowUpload(true)}>Upload my CV</Button>
          <Button
            variant="ghost"
            className="border border-[rgba(0,201,177,0.35)]"
            onClick={() => setPickTemplate(true)}
          >
            Build from scratch
          </Button>
        </div>

        {showUpload ? (
          <div className="mt-10 w-full max-w-lg">
            <GlowCard contentClassName="p-5">
              <CVUploadZone
                cvProfileId={targetId}
                onSuccess={(data) =>
                  void handleCvParseUploadSuccess(data, {
                    closeUploadModal: true,
                    navigateToProfile: true,
                  })
                }
              />
            </GlowCard>
          </div>
        ) : null}

        {pickTemplate ? (
          <div className="mt-10 w-full max-w-3xl space-y-4">
            <p className="text-sm font-semibold text-white">Pick a template</p>
            <div className="flex flex-wrap justify-center gap-2">
              {(['classic', 'modern', 'creative', 'professional'] as const).map(
                (t) => (
                  <Button
                    key={t}
                    variant="ghost"
                    className="capitalize"
                    onClick={() => void createBlank(t)}
                  >
                    {t}
                  </Button>
                ),
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    );
  }

  if (hasCv && !targetId && profileIdParam?.trim()) {
    return (
      <div className="-mx-4 space-y-3 px-4 sm:-mx-5 sm:px-5">
        <div className="hidden">{cvTopChrome}</div>
        <Skeleton height={420} borderRadius={16} />
      </div>
    );
  }

  if (hasCv && !targetId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="-mx-4 px-4 pb-8 pt-1 sm:-mx-5 sm:px-5"
      >
        <CreateCVProfileModal
          open={createCvOpen}
          onOpenChange={setCreateCvOpen}
        />
        <Modal
          open={showUpload}
          onOpenChange={setShowUpload}
          title="Upload your resume"
          className="max-w-lg"
        >
          <CVUploadZone
            cvProfileId={null}
            ensureNewProfileBeforeParse
            onSuccess={(data) =>
              void handleCvParseUploadSuccess(data, {
                closeUploadModal: true,
                navigateToProfile: true,
              })
            }
          />
        </Modal>
        <CvClinicHub
          profiles={profileOptions}
          loading={profilesQuery.isFetching && profileOptions.length === 0}
          onNewCv={() => setCreateCvOpen(true)}
          onOpenCv={(id) =>
            router.push(`/dashboard/cv?profileId=${encodeURIComponent(id)}`)
          }
        />
      </motion.div>
    );
  }

  if (detailLoading && !detail) {
    return (
      <div className="-mx-4 space-y-3 px-4 sm:-mx-5 sm:px-5">
        <div className="hidden">{cvTopChrome}</div>
        <Skeleton height={420} borderRadius={16} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-0 w-full min-w-0 max-w-full flex-col gap-1.5 pb-0 pt-0 max-lg:h-full max-lg:min-h-0 max-lg:flex-1 max-lg:gap-0 max-lg:overflow-hidden max-lg:px-0 md:-mt-2 lg:-mx-0 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:pt-0"
    >
      <CreateCVProfileModal
        open={createCvOpen}
        onOpenChange={setCreateCvOpen}
      />
      {targetId ? (
        <MobileExperienceBanner
          surface="cv-clinic"
          className="mx-3 mb-2 max-lg:mx-4 lg:hidden"
        />
      ) : null}
      {targetId ? (
        <>
          <AIGlobalAssistantPanel
            open={globalAssistantOpen}
            onOpenChange={setGlobalAssistantOpen}
            busy={assistantBusy}
            busyLabel={assistantBusyMessage}
            operations={globalAssistantOpsQuery.data ?? []}
            operationsLoading={globalAssistantOpsQuery.isLoading}
            onSubmit={async (command, options) => {
              await runGlobalAssistantCommand(command, options);
            }}
            showFab={!aiChatOpen && !globalAssistantOpen}
            seedCommand={assistantSeedCommand}
            onSeedCommandConsumed={clearAssistantSeedCommand}
          />
          <CvAssistantClarificationModal
            open={clarificationModalOpen && Boolean(clarificationQuestion)}
            busy={assistantBusy}
            busyLabel={assistantBusyMessage}
            currentQuestion={clarificationQuestion}
            history={activeClarification?.clarifications ?? []}
            scopeHint={
              recruiterScanClarification
                ? 'Recruiter Scan · role context'
                : globalAssistantClarification
                  ? 'Global assistant · entire CV or findings flow'
                  : assistantClarification
                    ? `Section assistant · ${assistantChangedFieldLabel(assistantClarification.targetSection)}`
                    : null
            }
            onSubmit={handleClarificationModalSubmit}
            onCancel={handleClarificationModalCancel}
          />
          <RecruiterScanReportPanel
            open={recruiterScanPanelOpen}
            busy={assistantBusy && assistantBusyStage === 'applying'}
            session={recruiterScanSession}
            sections={sections}
            onClose={closeRecruiterScan}
            onScanAgain={() => void runRecruiterScan()}
            onApplyFindings={handleApplyRecruiterFindings}
            onJumpToSection={(sid) =>
              jumpToSectionRef.current?.(sid, undefined, { scrollForm: false })
            }
          />
          <CvGlobalAssistantFindingsPanel
            open={globalAssistantFindings != null && !recruiterScanPanelOpen}
            busy={assistantBusy}
            result={globalAssistantFindings}
            onClose={() => setGlobalAssistantFindings(null)}
            onApplyFindings={handleApplyRecruiterFindings}
          />
        </>
      ) : null}

      {targetId ? (
        <>
          <AIChatDrawer
            open={aiChatOpen}
            onOpenChange={setAiChatOpen}
            selectedTemplate={template}
            onCreated={(id) => {
              void (async () => {
                await prefetchCvProfileForEditor(queryClient, id);
                toast.success(CV_READY_TOAST);
                router.push(cvEditorPath(id));
              })();
            }}
          />
          <TemplatePickerModal
            open={templatePickerOpen}
            onOpenChange={setTemplatePickerOpen}
            data={initialData}
            selected={template}
            onSelect={(t) => void onTemplateChange(t)}
          />
          <AddSectionModal
            open={sectionModalOpen}
            onOpenChange={setSectionModalOpen}
            profileId={targetId}
            existingTypes={existingSectionTypes}
            existingSections={sections}
          />
          <CvSectionOrderSuggestModal
            open={sectionOrderFlow.modalOpen}
            onOpenChange={sectionOrderFlow.setModalOpen}
            profileId={targetId}
            existingSections={sections}
            initialSuggest={sectionOrderFlow.suggestData}
            onApplied={() => {
              sectionOrderFlow.invalidateSuggest();
              setCvServerHydrateNonce((n) => n + 1);
            }}
          />
        </>
      ) : null}

      <Modal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename this CV"
        description="Shown in your CV list and in the selector above (1–100 characters)."
        className="max-w-md"
      >
        <div className="space-y-3">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-white/10 bg-[#111616] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00C9B1]"
            placeholder="e.g. Frontend engineer CV"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !targetId || !renameValue.trim() || renameProfile.isPending
              }
              onClick={() => {
                if (!targetId) return;
                const name = renameValue.trim().slice(0, 100);
                if (!name) return;
                renameProfile.mutate(
                  { id: targetId, name },
                  {
                    onSuccess: () => {
                      toast.success('CV renamed');
                      setRenameOpen(false);
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.cv.profiles(),
                      });
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.cv.profile(targetId),
                      });
                    },
                    onError: (e) => toast.error(getApiErrorMessage(e)),
                  },
                );
              }}
            >
              {renameProfile.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <CvParseImportSummaryModal
        open={parseImportSummaryModal.open}
        onOpenChange={(open) => {
          if (!open) {
            const { profileId, navigateOnClose } = parseImportSummaryModal;
            setParseImportSummaryModal({
              open: false,
              summary: null,
              profileId: null,
              navigateOnClose: false,
            });
            if (navigateOnClose && profileId?.trim()) {
              router.replace(
                `/dashboard/cv?profileId=${encodeURIComponent(profileId.trim())}`,
              );
            } else if (profileId?.trim() && targetId === profileId.trim()) {
              setCvServerHydrateNonce((n) => n + 1);
            }
          }
        }}
        importSummary={parseImportSummaryModal.summary}
        profileId={parseImportSummaryModal.profileId}
        onReviewInBuilder={() => {
          const id = parseImportSummaryModal.profileId?.trim();
          setParseImportSummaryModal({
            open: false,
            summary: null,
            profileId: null,
            navigateOnClose: false,
          });
          if (id) {
            router.replace(`/dashboard/cv?profileId=${encodeURIComponent(id)}`);
          }
        }}
        onContinue={() => {
          const { profileId, navigateOnClose } = parseImportSummaryModal;
          setParseImportSummaryModal({
            open: false,
            summary: null,
            profileId: null,
            navigateOnClose: false,
          });
          if (navigateOnClose && profileId?.trim()) {
            router.replace(
              `/dashboard/cv?profileId=${encodeURIComponent(profileId.trim())}`,
            );
          } else if (profileId?.trim() && targetId === profileId.trim()) {
            setCvServerHydrateNonce((n) => n + 1);
          }
        }}
        continueLabel={
          parseImportSummaryModal.navigateOnClose ? 'Open CV editor' : 'Done'
        }
      />

      <Modal
        open={showReuploadModal}
        onOpenChange={setShowReuploadModal}
        title="Re-upload your CV"
        description="Upload your resume again to re-extract experience, education, and skills."
        className="max-w-lg"
      >
        <CVUploadZone
          cvProfileId={targetId}
          onSuccess={(data) => void handleCvParseUploadSuccess(data)}
        />
      </Modal>

      <div className="hidden">{cvTopChrome}</div>

      {targetId ? (
        <>
          <MobileDockFab
            open={mobileCvToolsOpen}
            onOpenChange={setMobileCvToolsOpen}
            icon={SlidersHorizontal}
            label="CV tools"
            fabId="cv-tools"
            stackIndex={0}
          >
            {cvTopChrome}
          </MobileDockFab>
          <MobileDockFab
            open={mobileCvInsightsOpen}
            onOpenChange={setMobileCvInsightsOpen}
            icon={BarChart3}
            label="Score and tips"
            badge={
              displayScoreValue ??
              (pendingSuggestionsCountResolved > 0
                ? pendingSuggestionsCountResolved
                : undefined)
            }
            fabId="cv-insights"
            stackIndex={1}
          >
            <div className="space-y-3 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Score breakdown & tips
              </p>
              <div className="flex border-b border-white/[0.06]">
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => setTripleRightTab('analysis'))
                  }
                  className={cn(
                    'flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition',
                    tripleRightTab === 'analysis'
                      ? 'border-b-2 border-[#00C9B1] text-[#00C9B1]'
                      : 'text-white/40',
                  )}
                >
                  Analysis
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => setTripleRightTab('improvements'))
                  }
                  className={cn(
                    'relative flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition',
                    tripleRightTab === 'improvements'
                      ? 'border-b-2 border-[#00C9B1] text-[#00C9B1]'
                      : 'text-white/40',
                  )}
                >
                  Tips
                  {improvementsBadgeCount > 0 ? (
                    <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">
                      {improvementsBadgeCount}
                    </span>
                  ) : null}
                </button>
              </div>
              {tripleRightTab === 'analysis' ? (
                !score.isLoading && displayScoreValue != null ? (
                  <CVScoreCard
                    mode="compact"
                    score={displayScoreValue}
                    breakdown={displayScoreBreakdown}
                    scorePayload={displayScorePayload}
                    cvProfileId={targetId}
                    pendingImprovements={improvementList}
                    onDiffPreview={mergeDiffPreviewOpen}
                    onScoreRefresh={refreshScoreAfterSuggestion}
                    hideJobMatch
                  />
                ) : (
                  <p className="text-sm text-white/45">Calculating score…</p>
                )
              ) : (
                <ImprovementsPanel
                  improvements={improvementList}
                  profileId={targetId}
                  acceptAllQuota={acceptAllQuota}
                  onDiffPreview={mergeDiffPreviewOpen}
                />
              )}
            </div>
          </MobileDockFab>
        </>
      ) : null}

      {isPartialExtractionBanner ? (
        <GlowCard
          className="border border-[rgba(245,158,11,0.2)]"
          contentClassName="px-5 py-3.5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F59E0B]">
                Your CV was not fully extracted
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">
                Experience, education, and other sections may be missing.
                Re-upload your CV to extract all content correctly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReuploadModal(true)}
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#00C9B1] px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-[#00C4C5]"
            >
              Re-upload CV
            </button>
          </div>
        </GlowCard>
      ) : null}

      {targetId ? (
        <GlowCard
          className="hidden border border-[rgba(0,201,177,0.12)] lg:hidden"
          contentClassName="p-0"
        >
          <button
            type="button"
            onClick={() => setInsightsOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-white/[0.02]"
          >
            <span className="text-xs font-semibold text-white/70">
              Score breakdown & tips
            </span>
            {!score.isLoading &&
            score.data &&
            score.data.score !== null &&
            score.data.score !== undefined ? (
              <span className="rounded-full bg-[rgba(0,201,177,0.12)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#00C9B1]">
                {score.data.score}/100
              </span>
            ) : !score.isLoading ? (
              <span className="animate-pulse rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/45">
                Calculating…
              </span>
            ) : null}
            {pendingSuggestionsCountResolved > 0 ? (
              <span className="text-[10px] text-white/35">
                · {pendingSuggestionsCountResolved} tip
                {pendingSuggestionsCountResolved === 1 ? '' : 's'}
              </span>
            ) : null}
            {!isOnRecommendedTemplate ? (
              <span className="text-[10px] text-[#00C9B1]/60">
                · format suggestion
              </span>
            ) : null}
            <ChevronDown
              className={`ml-auto h-4 w-4 shrink-0 text-white/30 transition-transform duration-200 ${insightsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {insightsOpen ? (
              <motion.div
                key="insights"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="flex min-h-0 flex-col border-t border-white/[0.06]">
                  <div className="flex shrink-0 border-b border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(() => setTripleRightTab('analysis'))
                      }
                      className={cn(
                        'flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition',
                        tripleRightTab === 'analysis'
                          ? 'border-b-2 border-[#00C9B1] text-[#00C9B1]'
                          : 'text-white/40 hover:text-white/70',
                      )}
                    >
                      Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(() => setTripleRightTab('improvements'))
                      }
                      className={cn(
                        'relative flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition',
                        tripleRightTab === 'improvements'
                          ? 'border-b-2 border-[#00C9B1] text-[#00C9B1]'
                          : 'text-white/40 hover:text-white/70',
                      )}
                    >
                      Improvements
                      {improvementsBadgeCount > 0 ? (
                        <span
                          className={cn(
                            'pointer-events-none absolute right-1 top-0.5 z-10 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow',
                            tripleRightTab !== 'improvements' &&
                              improvementsAttentionPulse &&
                              'animate-pulse',
                          )}
                          aria-label={`${improvementsBadgeCount} pending fixes`}
                        >
                          {improvementsBadgeCount > 99
                            ? '99+'
                            : improvementsBadgeCount}
                        </span>
                      ) : null}
                    </button>
                  </div>
                  <div className="app-scrollbar max-h-[min(65dvh,600px)] min-h-0 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 pb-24 sm:px-5 lg:pb-6">
                    {tripleRightTab === 'analysis' ? (
                      <>
                        {!score.isLoading ? (
                          displayScoreValue !== null &&
                          displayScoreValue !== undefined ? (
                            <CVScoreCard
                              mode="compact"
                              score={displayScoreValue}
                              breakdown={displayScoreBreakdown}
                              scorePayload={displayScorePayload}
                              cvProfileId={targetId}
                              pendingImprovements={improvementList}
                              onDiffPreview={mergeDiffPreviewOpen}
                              onScoreRefresh={refreshScoreAfterSuggestion}
                              hideJobMatch
                            />
                          ) : (
                            <Button
                              type="button"
                              className="w-full gap-2"
                              disabled={runScan.isPending}
                              onClick={async () => {
                                try {
                                  await runScan.mutateAsync(targetId);
                                  const impr = await queryClient.fetchQuery({
                                    queryKey: cvSuggestionsQueryKey(targetId),
                                    queryFn: () =>
                                      api.cv.getSuggestions(
                                        targetId ?? undefined,
                                        false,
                                      ),
                                  });
                                  const n =
                                    impr.pendingSuggestionsCount ??
                                    impr.improvements.length;
                                  toast.success(
                                    `Scan complete: ${n} suggestions found`,
                                  );
                                } catch (e) {
                                  toast.error(getApiErrorMessage(e));
                                }
                              }}
                            >
                              {runScan.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />{' '}
                                  Scan…
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" /> Analyze this
                                  CV
                                </>
                              )}
                            </Button>
                          )
                        ) : (
                          <Skeleton height={120} borderRadius={12} />
                        )}
                        {!isOnRecommendedTemplate ? (
                          <div className="flex flex-col gap-3 rounded-xl border border-[rgba(0,201,177,0.15)] bg-white/[0.02] p-4">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#00C9B1]">
                                Format suggestion for{' '}
                                {formatRecommendation.label}
                              </p>
                              <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                                {formatRecommendation.reason}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                void onTemplateChange(
                                  formatRecommendation.recommended,
                                )
                              }
                              className="inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.12)] px-4 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:border-[#00C9B1]/50"
                            >
                              Try {formatRecommendation.recommended}
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {completenessGroups.length > 0 ? (
                          <div className="rounded-xl border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.06)] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-amber-300">
                                  Sections to complete
                                </p>
                                <p className="mt-1 text-[11px] text-white/55">
                                  {completeness?.score != null
                                    ? `Completeness ${completeness.score}% · ${completenessGroups.length} section${
                                        completenessGroups.length === 1
                                          ? ''
                                          : 's'
                                      } need details`
                                    : `${completenessGroups.length} section${completenessGroups.length === 1 ? '' : 's'} need details`}
                                </p>
                              </div>
                            </div>
                            <ul className="mt-2 space-y-2 text-[11px] text-white/75">
                              {completenessGroups.map((sec) => (
                                <li key={sec.sectionKey}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-white/85">
                                      {sec.sectionLabel}
                                    </span>
                                    <button
                                      type="button"
                                      className="shrink-0 rounded-md border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 transition hover:border-amber-200/55"
                                      onClick={() =>
                                        jumpToSectionRef.current?.(
                                          resolveJumpSectionKey(sec.sectionKey),
                                          undefined,
                                          {
                                            scrollForm: false,
                                          },
                                        )
                                      }
                                    >
                                      Open
                                    </button>
                                  </div>
                                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[10px] text-white/60">
                                    {sec.fields.map((f) => (
                                      <li
                                        key={`${sec.sectionKey}-${f.fieldPath}`}
                                      >
                                        {f.fieldLabel}
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {qualitySignals.spellIssueCount > 0 ||
                        qualitySignals.grammarIssueCount > 0 ||
                        qualitySignals.isSpellChecking ? (
                          <div className="rounded-xl border border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.05)] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-rose-200">
                                  Spelling & grammar
                                </p>
                                <p className="mt-1 text-[11px] text-white/55">
                                  {qualitySignals.isSpellChecking
                                    ? 'Checking…'
                                    : `${qualitySignals.spellIssueCount} spelling · ${qualitySignals.grammarIssueCount} grammar`}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  title="Apply every spelling suggestion"
                                  className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={
                                    qualitySignals.spellIssueCount <= 0 ||
                                    qualitySignals.isSpellChecking
                                  }
                                  onClick={() =>
                                    setSpellFixAllTrigger((n) => n + 1)
                                  }
                                >
                                  Fix all
                                </button>
                                <button
                                  type="button"
                                  title="Re-run spell + grammar check"
                                  className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                                  disabled={qualitySignals.isSpellChecking}
                                  onClick={() =>
                                    setSpellCheckTrigger((n) => n + 1)
                                  }
                                >
                                  Re-check
                                </button>
                              </div>
                            </div>
                            {qualitySignals.isSpellChecking ? (
                              <p className="mt-2 text-[10px] text-white/40">
                                Looking through your CV…
                              </p>
                            ) : (
                              <div className="mt-2 space-y-3">
                                {Object.entries(
                                  qualitySignals.spellIssueEntriesBySection,
                                ).map(([sectionKey, issues]) => {
                                  if (!issues.length) return null;
                                  const sectionLabel =
                                    qualitySignals.sectionLabels[sectionKey] ??
                                    sectionKey;
                                  return (
                                    <div key={sectionKey}>
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-semibold text-white/85">
                                          {sectionLabel}
                                        </p>
                                        <button
                                          type="button"
                                          className="rounded-md border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-white/60 transition hover:border-white/[0.2]"
                                          onClick={() =>
                                            jumpToSectionRef.current?.(
                                              resolveJumpSectionKey(sectionKey),
                                              undefined,
                                              {
                                                scrollForm: false,
                                              },
                                            )
                                          }
                                        >
                                          Open
                                        </button>
                                      </div>
                                      <ul className="mt-1 space-y-1.5">
                                        {issues.map((issue, idx) => {
                                          const kind =
                                            issue.type === 'grammar' ||
                                            issue.type === 'style'
                                              ? 'grammar'
                                              : 'spelling';
                                          const original = (
                                            issue.original ?? ''
                                          ).trim();
                                          const suggestion = (
                                            issue.suggestion ?? ''
                                          ).trim();
                                          return (
                                            <li
                                              key={
                                                issue.issueId
                                                  ? `${sectionKey}-${issue.issueId}`
                                                  : `${sectionKey}-${idx}-${original}`
                                              }
                                              className="rounded-lg border border-white/[0.08] bg-[#111616] p-2"
                                            >
                                              <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                                                    {kind}
                                                  </p>
                                                  <p className="mt-0.5 break-words text-[11px] text-white/85">
                                                    <span className="rounded bg-rose-500/15 px-1 text-rose-200 line-through decoration-rose-400/70">
                                                      {original}
                                                    </span>
                                                    {suggestion ? (
                                                      <>
                                                        <span className="mx-1 text-white/40">
                                                          →
                                                        </span>
                                                        <span className="rounded bg-emerald-500/15 px-1 text-emerald-200">
                                                          {suggestion}
                                                        </span>
                                                      </>
                                                    ) : null}
                                                  </p>
                                                  {issue.message ? (
                                                    <p className="mt-1 text-[10px] text-white/50">
                                                      {issue.message}
                                                    </p>
                                                  ) : null}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1.5">
                                                  {suggestion ? (
                                                    <button
                                                      type="button"
                                                      className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                                                      onClick={() =>
                                                        onApplySpellIssue(issue)
                                                      }
                                                    >
                                                      Apply
                                                    </button>
                                                  ) : null}
                                                  <button
                                                    type="button"
                                                    className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/60"
                                                    onClick={() =>
                                                      onDismissSpellIssue(issue)
                                                    }
                                                  >
                                                    Dismiss
                                                  </button>
                                                </div>
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white/80">
                                  Spelling & grammar
                                </p>
                                <p className="mt-1 text-[11px] text-white/45">
                                  Run Re-check to scan this CV for spelling and
                                  grammar. No issues right now.
                                </p>
                              </div>
                              <button
                                type="button"
                                className="shrink-0 rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/70"
                                onClick={() =>
                                  setSpellCheckTrigger((n) => n + 1)
                                }
                                disabled={qualitySignals.isSpellChecking}
                              >
                                Re-check
                              </button>
                            </div>
                          </div>
                        )}
                        <ImprovementsPanel
                          improvements={improvementList}
                          profileId={targetId}
                          acceptAllQuota={acceptAllQuota}
                          onDiffPreview={mergeDiffPreviewOpen}
                        />
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </GlowCard>
      ) : null}

      <motion.div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col max-lg:h-full max-lg:min-h-0 max-lg:overflow-hidden lg:max-h-[calc(100vh-52px)] lg:min-h-0 lg:overflow-hidden">
        {targetId ? (
          <div className="hidden shrink-0 lg:block">{cvClinicToolbar}</div>
        ) : null}
        <motion.div className="relative z-0 min-h-0 w-full min-w-0 flex-1 max-lg:flex max-lg:h-full max-lg:min-h-0 max-lg:flex-col max-lg:overflow-hidden lg:flex lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:flex-col">
          {targetId && sectionOrderFlow.showProactiveBanner ? (
            <div className="mb-2 hidden shrink-0 px-1 lg:block">
              <CvSectionOrderProactiveBanner
                onSuggest={() =>
                  sectionOrderFlow.openSuggestModal(sectionOrderFlow.suggestData)
                }
                onDismiss={sectionOrderFlow.dismissBanner}
              />
            </div>
          ) : null}
          {targetId ? (
            <CvDiffActionsBusyContext.Provider
              value={cvImprovementDiffActionsPending}
            >
              <CvGlobalAssistantReviewPanel
                open={globalAssistantReviewOpen}
                busy={cvImprovementDiffActionsPending}
                busyLabel={assistantBusyMessage}
                result={globalAssistantFullResult}
                changedFields={globalAssistantChangedFieldsMemo}
                onAcceptAll={() => void handleAcceptDiff()}
                onRejectAll={() => void handleRejectDiff()}
                onAcceptSection={(i) => void handleAcceptDiff(i)}
                onRejectSection={(i) => void handleRejectDiff(i)}
                onClose={() => {
                  if (cvImprovementDiffActionsPending) return;
                  clearAssistantPreview();
                }}
              />
            </CvDiffActionsBusyContext.Provider>
          ) : null}
          {templateReady ? (
            <CVBuilder
              key={`${targetId ?? 'cv'}-${cvMode}`}
              builderContext={isTailorMode ? 'tailoring' : 'clinic'}
              mode="dashboard"
              profileId={targetId}
              initialData={initialData}
              selectedTemplate={template}
              onTemplateChange={onTemplateChange}
              existingSections={sections}
              onDashboardSaved={onDashboardSaved}
              dashboardTemplateExtras={dashboardTemplateExtras}
              dashboardTemplateMeta={dashboardTemplateMeta}
              uploadedCvHint={Boolean(profile?.originalTemplate)}
              onRequestReparse={() => setShowReuploadModal(true)}
              onJumpToSectionReady={(fn) => {
                jumpToSectionRef.current = fn;
              }}
              diffSection={
                assistantScope === 'full_cv'
                  ? null
                  : (diffPreview?.section ?? null)
              }
              diffMultiSection={
                assistantScope === 'full_cv' &&
                assistantPreviewMode &&
                diffPreview?.pointer === '__assistant__'
              }
              diffBefore={diffPreview?.before ?? null}
              diffAfter={diffPreview?.after ?? null}
              diffChangedFields={diffPreview?.changedFields ?? null}
              improvementDiffTruthPanel={improvementDiffTruthPanel}
              improvementDiffTruthfulness={improvementDiffTruthfulness}
              improvementDiffPerformance={improvementDiffPerformance}
              onAcceptDiff={(changeIndex) => void handleAcceptDiff(changeIndex)}
              onRejectDiff={(changeIndex) => void handleRejectDiff(changeIndex)}
              diffActionsDisabled={cvImprovementDiffActionsPending}
              tripleColumn={cvClinicTripleLayout}
              tripleColumnRightSlot={cvClinicTripleInsightsSlot}
              onSaveStatusChange={setBuilderSaveStatus}
              onReorderPendingChange={setReorderPending}
              spellCheckTrigger={spellCheckTrigger}
              onQualitySignalsChange={setQualitySignals}
              spellFixAllTrigger={spellFixAllTrigger}
              externalPatch={effectiveExternalPatch}
              externalPatchNonce={effectiveExternalPatchNonce}
              serverHydrateNonce={cvServerHydrateNonce}
              onAiStructuredPersisted={() =>
                setCvServerHydrateNonce((n) => n + 1)
              }
              onDataSnapshotChange={setCvDataSnapshot}
              cvAssistantCommand={runAssistantCommand}
              cvAssistantBusy={assistantBusy}
              cvAssistantBusyMessage={assistantBusyMessage}
              cvAssistantClarificationQuestion={null}
              assistantAcceptHighlightSectionId={
                assistantAcceptHighlight?.sectionId ?? null
              }
              assistantAcceptHighlightNonce={
                assistantAcceptHighlight?.nonce ?? 0
              }
              recruiterScanHeatmap={recruiterScanPanelOpen ? recruiterScanHeatmap : null}
            />
          ) : (
            <div className="flex h-full min-h-0 items-center justify-center text-sm text-white/45">
              Loading template…
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

