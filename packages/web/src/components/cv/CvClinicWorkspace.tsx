'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3 } from 'lucide-react';

import { AddSectionModal } from '@/components/cv/AddSectionModal';
import { AIGlobalAssistantPanel } from '@/components/cv/AIGlobalAssistantPanel';
import { CvGlobalAssistantFindingsPanel } from '@/components/cv/CvGlobalAssistantFindingsPanel';
import { RecruiterScanReportPanel } from '@/components/cv/RecruiterScanReportPanel';
import { CvGlobalAssistantReviewPanel } from '@/components/cv/CvGlobalAssistantReviewPanel';
import { CvSectionOrderProactiveBanner } from '@/components/cv/CvSectionOrderProactiveBanner';
import { CvSectionOrderSuggestModal } from '@/components/cv/CvSectionOrderSuggestModal';
import {
  CVBuilder,
  type CVBuilderQualitySignals,
  type CVBuilderTripleColumnConfig,
} from '@/components/cv/CVBuilder';
import type { CvAssistantRunResult } from '@/components/cv/CVEditContext';
import { CvClinicToolbar } from '@/components/cv/CvClinicToolbar';
import { CvClinicTripleRightPanel } from '@/components/cv/CvClinicTripleRightPanel';
import { TemplatePickerModal } from '@/components/cv/TemplatePickerModal';
import { Button } from '@/components/ui/Button';
import { MobileDockFab } from '@/components/ui/MobileDockFab';
import { useToast } from '@/components/ui/Toast';
import { useCvSectionOrderFlow } from '@/hooks/useCvSectionOrderFlow';
import { useCvSuggestionMutations } from '@/hooks/useCvSuggestionMutations';
import { useCVImprovements } from '@/hooks/useCVImprovements';
import { useCVProfileById } from '@/hooks/useCVProfileById';
import { useCVScore } from '@/hooks/useCVScore';
import { useRunCvDetailedScore } from '@/hooks/useRunCvDetailedScore';
import {
  api,
  type CVProfile,
  type CVSectionRecord,
  type CvAssistantCommandResponse,
  type CvCompletenessResult,
  type CvImprovementsPayload,
  type CvProfileSummary,
  type CvSpellIssue,
  type CvDiffPreviewOpenParams,
  type CvAssistantSectionDiff,
} from '@/lib/api';
import { formatApiErrorForToast, getApiErrorCode, getApiErrorMessage } from '@/lib/axios';
import { CvAssistantClarificationModal } from '@/components/cv/CvAssistantClarificationModal';
import {
  cvAssistantBusyMessage,
  type CvAssistantBusyStage,
} from '@/lib/cvAssistantLoadingCopy';
import {
  buildCvSectionInventory,
  filterRecruiterScanFindingsResult,
  filterUnrealisticCvSuggestions,
  logUnrealisticCvRecommendationDropDev,
} from '@/lib/cvAssistantUserFacing';
import {
  globalAssistantChangedFields,
  type CvAssistantScope,
  type CvGlobalAssistantApplyFindingsPayload,
  type CvGlobalAssistantFindingsResult,
  type CvGlobalAssistantFullCvResult,
  type CvGlobalAssistantOperationKey,
} from '@/lib/cvGlobalAssistant';
import { normalizeCvDiffPreviewParams } from '@/lib/cvAiPatchDisplay';
import {
  assistantChangedFieldLabel,
  assistantDiffDisplayStrings,
} from '@/lib/cvAssistantDiffDisplay';
import {
  buildRecruiterScanHeatmapByPreviewKey,
  recruiterScanSessionFromFindings,
  type CvRecruiterScanReadingPathEntry,
  type CvRecruiterScanSession,
} from '@/lib/cvRecruiterScan';
import { refetchCvProfileAndSectionsAfterBackgroundWork } from '@/lib/cvBackgroundSectionSync';
import { filterPendingSuggestionsForDisplay } from '@/lib/cv-improvement-merge';
import { compactDiffPreviewPerformance } from '@/lib/cvApplyPerformanceDev';
import {
  CV_ASSISTANT_DIFF_PREVIEW_KEY,
  type CvDiffPreviewMap,
  cvDiffPreviewStorageKey,
} from '@/lib/cvDiffPreviewMap';
import {
  isCvApplyImprovementTerminalNoDiff,
  toastCopyForTerminalNoDiffApply,
} from '@/lib/cvApplyImprovementQueue';
import { logCvSuggestionMutationClientPerf } from '@/lib/cvSuggestionMutationReconcile';
import {
  applySuggestionAcceptToImprovementsCache,
  applySuggestionRejectToImprovementsCache,
} from '@/lib/cvSuggestionsMutationApply';
import {
  assistantTargetSectionToEditorId,
  commitAssistantAcceptedPatch,
} from '@/lib/cvAssistantCommit';
import { commitAcceptedStructuredDraft } from '@/lib/cvStructuredDraftCommit';
import {
  CV_SUGGESTIONS_QUERY_ROOT,
  cvSuggestionsQueryKey,
} from '@/lib/cvSuggestionsQuery';
import {
  transformSectionsToCVBuilderData,
  type CVBuilderData,
  type CvBuilderSaveStatus,
  type CvTemplateId,
  type SaveCVBuilderDataResult,
  isCvTemplateId,
} from '@/lib/cvBuilder';
import {
  toolbarVisibilityForSurface,
  type CvBuilderSurfaceContext,
} from '@/lib/cvBuilderSurface';
import { truthfulnessFieldsFromResponse } from '@/lib/cvTruthfulnessUi';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const CV_CLINIC_RIGHT_PCT_KEY = 'cv_clinic_right_pct';
const CV_RIGHT_PANEL_COLLAPSED_KEY = 'applymate:cv:rightPanelCollapsed';
const ONBOARDING_CV_EDIT_HINT_KEY = 'applymate_onb_cv_edit_hint_v1';

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

export type CvClinicWorkspaceProps = {
  /** clinic = dashboard CV Clinic; onboarding = resume step; tailoring = job tailor review. */
  builderContext: CvBuilderSurfaceContext;
  profileId: string;
  sections: CVSectionRecord[];
  selectedTemplate: CvTemplateId;
  onTemplateIdChange: (t: CvTemplateId) => void;
  onDashboardSaved?: () => void;
  onSaveStatusChange?: (s: CvBuilderSaveStatus) => void;
  onDataSnapshotChange?: (d: CVBuilderData) => void;
  /** Onboarding only */
  onBack?: () => void;
  onContinue?: (data: CVBuilderData) => void;
  onSkip?: () => void;
  continueDisabled?: boolean;
  /** Clinic / tailoring — profile switcher */
  profileOptions?: CvProfileSummary[];
  onProfileChange?: (profileId: string) => void;
  onNewCv?: () => void;
  /** Clinic — export */
  onExportPdf?: () => void;
  onExportDocx?: () => void;
  isExportPending?: boolean;
  /** Clinic — template row extras under preview */
  dashboardTemplateExtras?: ReactNode;
  dashboardTemplateMeta?: ReactNode;
  uploadedCvHint?: boolean;
  onRequestReparse?: () => void;
  /** Tailoring — adds a "Tailoring changes" tab (main view) alongside Analysis/Improvements. */
  tailorRightSlot?: ReactNode;
  /** Tailoring — count badge on the "Tailoring changes" tab (pending sections). */
  tailorChangesBadgeCount?: number;
  /** Tailoring — highlight a section in the builder after accept/revert. */
  tailorHighlightSectionId?: string | null;
  tailorHighlightNonce?: number;
  tailorHighlightAction?: 'accepted' | 'reverted';
  /** External hydrate bump (e.g. after a tailor accept/revert persists). Combined with internal. */
  externalServerHydrateNonce?: number;
  /** Override stacking for builder modals (Template/Sections/Reorder/Clarify) when hosted inside a very-high-z overlay. */
  modalLayerZIndex?: number;
  /** Called after the builder persists a structured/AI change (in addition to the internal hydrate bump). */
  onStructuredPersisted?: () => void | Promise<void>;
  improvementDiffTruthPanel?: boolean;
  improvementDiffTruthfulness?: import('@/lib/api').CvTruthfulnessMeta | null;
  improvementDiffPerformance?: import('@/lib/api').CvPerformanceMeta | null;
  className?: string;
};

export function CvClinicWorkspace({
  builderContext,
  profileId,
  sections,
  selectedTemplate,
  onTemplateIdChange,
  onBack,
  onDashboardSaved,
  onSaveStatusChange,
  onDataSnapshotChange,
  onContinue,
  onSkip,
  continueDisabled,
  profileOptions = [],
  onProfileChange,
  onNewCv,
  onExportPdf,
  onExportDocx,
  isExportPending = false,
  dashboardTemplateExtras,
  dashboardTemplateMeta,
  uploadedCvHint = false,
  onRequestReparse,
  tailorRightSlot,
  tailorChangesBadgeCount = 0,
  tailorHighlightSectionId = null,
  tailorHighlightNonce = 0,
  tailorHighlightAction = 'accepted',
  externalServerHydrateNonce = 0,
  onStructuredPersisted,
  modalLayerZIndex,
  improvementDiffTruthPanel = false,
  improvementDiffTruthfulness = null,
  improvementDiffPerformance = null,
  className,
}: CvClinicWorkspaceProps) {
  const isOnboarding = builderContext === 'onboarding';
  const isTailoring = builderContext === 'tailoring';
  // The global (entire-CV) AI assistant ships in every workspace surface that
  // isn't the standalone clinic page (which renders its own copy). Both the
  // tailoring and onboarding builders should match the clinic feature set.
  const showGlobalAssistant = isTailoring || isOnboarding;
  const toast = useToast();
  const queryClient = useQueryClient();
  const { reconcileAfterMutation } = useCvSuggestionMutations();
  const user = useAuthStore((s) => s.user);
  const runScan = useRunCvDetailedScore();
  const scoreAfterAutosaveTimerRef = useRef<number | null>(null);

  const detailQuery = useCVProfileById(profileId);
  const profile: CVProfile | null = detailQuery.data?.profile ?? null;

  const sectionOrderFlow = useCvSectionOrderFlow(profileId, sections);

  const score = useCVScore(true, profileId);
  const improvements = useCVImprovements(true, profileId);

  const [tripleRightTab, setTripleRightTab] = useState<
    'analysis' | 'improvements' | 'changes'
  >(builderContext === 'tailoring' ? 'changes' : 'analysis');
  const triplePanelContainerRef = useRef<HTMLDivElement>(null);
  // Tailoring shows rich before/after change cards, so it gets a wider panel
  // (and its own persisted width) than the clinic's analysis/improvements list.
  const rightPctStorageKey = isTailoring
    ? 'cv_tailor_right_pct'
    : CV_CLINIC_RIGHT_PCT_KEY;
  const rightPctMin = isTailoring ? 28 : 20;
  const rightPctMax = isTailoring ? 44 : 34;
  const [tripleRightPct, setTripleRightPct] = useState(isTailoring ? 34 : 24);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [builderSaveStatus, setBuilderSaveStatus] =
    useState<CvBuilderSaveStatus>('idle');
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
  const [cvDataSnapshot, setCvDataSnapshot] = useState<CVBuilderData | null>(
    null,
  );

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

  const mergeDiffPreviewOpen = useCallback(
    (params: CvDiffPreviewOpenParams | null) => {
      setAssistantPreviewMode(false);
      setAssistantPendingPatch(null);
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
  const [cvServerHydrateNonce, setCvServerHydrateNonce] = useState(0);
  const [cvImprovementDiffActionsPending, setCvImprovementDiffActionsPending] =
    useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantBusyStage, setAssistantBusyStage] =
    useState<CvAssistantBusyStage>(null);
  const [clarificationModalOpen, setClarificationModalOpen] = useState(false);
  const [assistantPreviewMode, setAssistantPreviewMode] = useState(false);
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
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [showOnboardingEditHint, setShowOnboardingEditHint] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return sessionStorage.getItem(ONBOARDING_CV_EDIT_HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const [assistantClarification, setAssistantClarification] = useState<{
    command: string;
    question: string;
    clarifications: Array<{ question: string; answer: string }>;
    targetSection: string;
  } | null>(null);

  // --- Global (entire-CV) assistant — tailoring surface only ---
  const [globalAssistantOpen, setGlobalAssistantOpen] = useState(false);
  const [assistantSeedCommand, setAssistantSeedCommand] = useState<
    string | null
  >(null);
  const [, setAssistantScope] = useState<CvAssistantScope | null>(null);
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
    enabled: showGlobalAssistant && Boolean(profileId.trim()),
    staleTime: 5 * 60_000,
  });

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

  const handleAtsKeywordAssist = useCallback(
    (prompt: string) => {
      if (showGlobalAssistant) {
        setAssistantSeedCommand(prompt);
        setGlobalAssistantOpen(true);
        return;
      }
      toast.info(
        'Global assistant is in Resume Clinic. Use the section assistant on each block here.',
      );
    },
    [showGlobalAssistant, toast],
  );

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
      if (!profileId.trim()) return;
      setAssistantBusy(true);
      setAssistantBusyStage('generating');
      try {
        const res = await api.cv.recruiterScan(profileId, opts);
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
    [openRecruiterScanSession, profileId, toast],
  );

  const activeClarification = globalAssistantClarification ?? assistantClarification;
  const clarificationQuestion =
    recruiterScanClarification?.question ?? activeClarification?.question ?? null;

  const jumpToSectionRef = useRef<
    | ((sid: string, itemId?: string, opts?: { scrollForm?: boolean }) => void)
    | null
  >(null);

  useEffect(() => {
    if (diffPreview?.section && jumpToSectionRef.current) {
      const t = window.setTimeout(() => {
        jumpToSectionRef.current?.(diffPreview.section);
      }, 350);
      return () => window.clearTimeout(t);
    }
  }, [diffPreview]);

  useEffect(() => {
    if (diffPreview !== null) {
      setMobileInsightsOpen(false);
    }
  }, [diffPreview]);

  const resolveImprovementPointerByField = useCallback(
    async (fieldPath: string): Promise<string | null> => {
      if (!profileId.trim() || !fieldPath.trim()) return null;
      try {
        const payload = await api.cv.getSuggestions(profileId, false);
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
    [profileId],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const r = parseFloat(
        localStorage.getItem(rightPctStorageKey) ??
          String(isTailoring ? 34 : 24),
      );
      if (Number.isFinite(r))
        setTripleRightPct(Math.min(rightPctMax, Math.max(rightPctMin, r)));
      setRightPanelCollapsed(
        localStorage.getItem(CV_RIGHT_PANEL_COLLAPSED_KEY) === '1',
      );
    } catch {
      /* ignore */
    }
  }, [isTailoring, rightPctStorageKey, rightPctMin, rightPctMax]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(rightPctStorageKey, String(tripleRightPct));
    } catch {
      /* ignore */
    }
  }, [tripleRightPct, rightPctStorageKey]);

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

  useEffect(() => {
    if (!showOnboardingEditHint) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      const root = document.querySelector('[data-cv-document-root]');
      if (root?.contains(t)) {
        try {
          sessionStorage.setItem(ONBOARDING_CV_EDIT_HINT_KEY, '1');
        } catch {
          /* ignore */
        }
        setShowOnboardingEditHint(false);
      }
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [showOnboardingEditHint]);

  useEffect(() => {
    if (!profileId.trim()) {
      setCompleteness(null);
      return;
    }
    void (async () => {
      try {
        const next = await api.cv.getCompleteness(profileId);
        setCompleteness(next);
      } catch {
        /* non-blocking */
      }
    })();
  }, [profileId, sections.length, builderSaveStatus]);

  const initialData = useMemo(
    () =>
      transformSectionsToCVBuilderData(profile, sections, {
        email: user?.email,
        name: user?.name,
      }),
    [profile, sections, user?.email, user?.name],
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

  const improvementList = useMemo(() => {
    const pending = filterPendingSuggestionsForDisplay(
      improvements.data?.improvements,
    );
    const inventory = buildCvSectionInventory(
      cvDataSnapshot ?? initialData,
      sections,
    );
    const { items, dropped } = filterUnrealisticCvSuggestions(pending, inventory);
    logUnrealisticCvRecommendationDropDev('suggestions_panel', profileId, dropped);
    return items;
  }, [
    improvements.data?.improvements,
    cvDataSnapshot,
    initialData,
    sections,
    profileId,
  ]);

  const pendingSuggestionsCountResolved = useMemo(() => {
    const n = improvements.data?.pendingSuggestionsCount;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
    return improvementList.length;
  }, [improvements.data?.pendingSuggestionsCount, improvementList.length]);

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

  const applySpell = useCallback((issue: CvSpellIssue) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('cv:spell-issue:apply', { detail: { issue } }),
    );
  }, []);
  const dismissSpell = useCallback((issue: CvSpellIssue) => {
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

  const formatRecommendation = useMemo(
    () => getFormatRecommendation(experienceItemCount),
    [experienceItemCount],
  );
  const isOnRecommendedTemplate =
    selectedTemplate === formatRecommendation.recommended;

  const onTemplateChangeApi = useCallback(
    async (t: string) => {
      const next = t as CvTemplateId;
      if (!isCvTemplateId(next)) return;
      onTemplateIdChange(next);
      try {
        await api.cv.updateTemplate(next, profileId);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.cv.profile(profileId),
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.scoreRoot() });
        void queryClient.invalidateQueries({
          queryKey: CV_SUGGESTIONS_QUERY_ROOT,
        });
        void queryClient.refetchQueries({
          queryKey: queryKeys.cv.profile(profileId),
        });
        toast.success('Template updated');
        window.setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.cv.scoreRoot() });
          void queryClient.invalidateQueries({
            queryKey: CV_SUGGESTIONS_QUERY_ROOT,
          });
        }, 2500);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    },
    [onTemplateIdChange, profileId, queryClient, toast],
  );

  const handleDashboardSaved = useCallback(
    async (result?: SaveCVBuilderDataResult) => {
      if (result?.sections && result.sections.length > 0) {
        queryClient.setQueryData(queryKeys.cv.sections(profileId), result.sections);
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv.profile(profileId),
        refetchType: 'none',
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      onDashboardSaved?.();

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
      scoreAfterAutosaveTimerRef.current = window.setTimeout(() => {
        scoreAfterAutosaveTimerRef.current = null;
        void (async () => {
          try {
            await runScan.mutateAsync(profileId);
          } catch {
            /* optional */
          }
        })();
      }, 2500);
    },
    [onDashboardSaved, profileId, queryClient, runScan],
  );

  useEffect(() => {
    return () => {
      if (scoreAfterAutosaveTimerRef.current) {
        window.clearTimeout(scoreAfterAutosaveTimerRef.current);
        scoreAfterAutosaveTimerRef.current = null;
      }
    };
  }, []);

  const commitAcceptDiff = useCallback(
    async (changeIndex?: number) => {
      const opKey = activeDiffPreviewKey;
      const diffPreview = opKey ? (diffPreviews[opKey] ?? null) : null;
      if (!diffPreview) return;
      if (assistantPreviewMode && diffPreview.pointer === '__assistant__') {
        const id = profileId.trim();
        if (!id) return;
        const patch = assistantPendingPatch;
        if (cvImprovementDiffInFlightRef.current) return;
        cvImprovementDiffInFlightRef.current = true;
        setCvImprovementDiffActionsPending(true);
        try {
          const commitResult = await commitAssistantAcceptedPatch({
            queryClient,
            profileId: id,
            patch: (patch && typeof patch === 'object'
              ? patch
              : {}) as Record<string, unknown>,
            commandId: assistantCommandIdRef.current.trim() || undefined,
            onRehydrated: () => {
              setCvServerHydrateNonce((n) => n + 1);
              setAssistantPatchNonce((n) => n + 1);
            },
          });
          setInstantPreviewPatch(null);
          closeDiffPreviewForKey(CV_ASSISTANT_DIFF_PREVIEW_KEY);
          setAssistantPreviewMode(false);
          setAssistantPendingPatch(null);
          assistantCommandIdRef.current = '';
          setAssistantAcceptHighlight({
            sectionId: assistantTargetSectionToEditorId(
              commitResult.targetSection,
              commitResult.sections,
            ),
            nonce: Date.now(),
          });
          toast.success(
            commitResult.message || 'Changes saved to your CV.',
          );
        } catch (e) {
          toast.error(
            getApiErrorMessage(e) ||
              'Could not save assistant changes. Try again.',
          );
        } finally {
          cvImprovementDiffInFlightRef.current = false;
          setCvImprovementDiffActionsPending(false);
        }
        return;
      }
      if (cvImprovementDiffInFlightRef.current) return;
      cvImprovementDiffInFlightRef.current = true;
      setCvImprovementDiffActionsPending(true);
      const wasAcceptAll = changeIndex == null;
      const improvementsKey = cvSuggestionsQueryKey(profileId);
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
        if (selectedField.length === 0) {
          const t0 = Date.now();
          let cacheWrites = 0;
          const product = await api.cv.acceptSuggestion(
            String(requestPointer),
            profileId,
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
          if (
            diffPreview.after &&
            typeof diffPreview.after === 'object' &&
            !Array.isArray(diffPreview.after)
          ) {
            setInstantPreviewPatch(diffPreview.after as Partial<CVBuilderData>);
            setInstantPreviewPatchNonce((n) => n + 1);
          }
          closeDiffPreviewForKey(opKey);
          toast.success('Suggestion applied successfully.');
          await Promise.all([
            queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId) }),
            queryClient.refetchQueries({
              queryKey: queryKeys.cv.sections(profileId),
              exact: true,
            }),
          ]);
          const inv = reconcileAfterMutation(profileId, 'structuralAccept');
          logCvSuggestionMutationClientPerf(
            'onboarding.commitAcceptDiff.acceptSuggestion',
            t0,
            {
              invalidations: inv,
              cacheWrites,
            },
          );
          return;
        }

        const result = await api.cv.acceptImprovement(
          requestPointer,
          profileId,
          {
            acceptedFields: [selectedField],
            ...(diffPreview.draftHash
              ? { draftHash: diffPreview.draftHash }
              : {}),
          },
        );
        if (result.partial) {
          const nextPointer = result.improvementId ?? diffPreview.pointer;
          const freshNext = await api.cv.applyImprovement(
            nextPointer,
            profileId,
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
            queryKey: cvSuggestionsQueryKey(profileId),
          });
          toast.success('Change accepted.');
          return;
        }
        queryClient.setQueryData<CvImprovementsPayload>(
          cvSuggestionsQueryKey(profileId),
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
        if (
          diffPreview.after &&
          typeof diffPreview.after === 'object' &&
          !Array.isArray(diffPreview.after)
        ) {
          setInstantPreviewPatch(diffPreview.after as Partial<CVBuilderData>);
          setInstantPreviewPatchNonce((n) => n + 1);
        }
        closeDiffPreviewForKey(opKey);
        toast.success('Suggestion applied successfully.');
        const t0Field = Date.now();
        await Promise.all([
          queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(profileId) }),
          queryClient.refetchQueries({
            queryKey: queryKeys.cv.sections(profileId),
            exact: true,
          }),
        ]);
        const inv = reconcileAfterMutation(profileId, 'structuralAccept');
        logCvSuggestionMutationClientPerf(
          'onboarding.commitAcceptDiff.acceptImprovement',
          t0Field,
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
              profileId,
            );
            const freshPreview = {
              ...diffPreview,
              pointer: pointerForRefresh,
              draftHash: fresh.draftHash,
              changedFields: fresh.changedFields,
            };
            const selectedStillExists =
              selectedField.length > 0 &&
              freshPreview.changedFields.some(
                (cf) => (cf.fieldPath ?? '').trim() === selectedField,
              );
            if (selectedField && selectedStillExists) {
              const retry = await api.cv.acceptImprovement(
                pointerForRefresh,
                profileId,
                {
                  acceptedFields: [selectedField],
                  ...(fresh.draftHash ? { draftHash: fresh.draftHash } : {}),
                },
              );
              if (retry.partial) {
                const nextPointer = retry.improvementId ?? pointerForRefresh;
                const freshNext = await api.cv.applyImprovement(
                  nextPointer,
                  profileId,
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
                      performance: compactDiffPreviewPerformance(freshNext),
                    },
                  };
                });
                toast.success('Change accepted.');
                return;
              }
              if (
                fresh.after &&
                typeof fresh.after === 'object' &&
                !Array.isArray(fresh.after)
              ) {
                setInstantPreviewPatch(fresh.after as Partial<CVBuilderData>);
                setInstantPreviewPatchNonce((n) => n + 1);
              }
              closeDiffPreviewForKey(opKey);
              toast.success('Suggestion applied successfully.');
              return;
            }
            if (selectedField.length === 0) {
              const t0Stale = Date.now();
              const product = await api.cv.acceptSuggestion(
                String(pointerForRefresh),
                profileId,
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
              if (
                fresh.after &&
                typeof fresh.after === 'object' &&
                !Array.isArray(fresh.after)
              ) {
                setInstantPreviewPatch(fresh.after as Partial<CVBuilderData>);
                setInstantPreviewPatchNonce((n) => n + 1);
              }
              closeDiffPreviewForKey(opKey);
              toast.success('Suggestion applied successfully.');
              await Promise.all([
                queryClient.refetchQueries({
                  queryKey: queryKeys.cv.profile(profileId),
                }),
                queryClient.refetchQueries({
                  queryKey: queryKeys.cv.sections(profileId),
                  exact: true,
                }),
              ]);
              const inv = reconcileAfterMutation(profileId, 'structuralAccept');
              logCvSuggestionMutationClientPerf(
                'onboarding.commitAcceptDiff.staleAcceptSuggestion',
                t0Stale,
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
              profileId,
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
              await Promise.all([
                queryClient.refetchQueries({
                  queryKey: queryKeys.cv.profile(profileId),
                }),
                queryClient.refetchQueries({
                  queryKey: queryKeys.cv.sections(profileId),
                  exact: true,
                }),
              ]);
              const inv = reconcileAfterMutation(profileId, 'queueOnly');
              logCvSuggestionMutationClientPerf(
                'onboarding.commitAcceptDiff.missingDraft.terminalNoDiff',
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
            const t0Md = Date.now();
            if (sf) {
              await api.cv.acceptImprovement(diffPreview.pointer, profileId, {
                acceptedFields: [sf],
                ...(prep.draftHash ? { draftHash: prep.draftHash } : {}),
              });
            } else {
              const prodMissing = await api.cv.acceptSuggestion(
                String(diffPreview.pointer),
                profileId,
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
            }
            if (
              prep.after &&
              typeof prep.after === 'object' &&
              !Array.isArray(prep.after)
            ) {
              setInstantPreviewPatch(prep.after as Partial<CVBuilderData>);
              setInstantPreviewPatchNonce((n) => n + 1);
            }
            closeDiffPreviewForKey(opKey);
            toast.success('Suggestion applied successfully.');
            await Promise.all([
              queryClient.refetchQueries({
                queryKey: queryKeys.cv.profile(profileId),
              }),
              queryClient.refetchQueries({
                queryKey: queryKeys.cv.sections(profileId),
                exact: true,
              }),
            ]);
            const inv = reconcileAfterMutation(profileId, 'structuralAccept');
            logCvSuggestionMutationClientPerf(
              'onboarding.commitAcceptDiff.missingDraft',
              t0Md,
              {
                invalidations: inv,
                cacheWrites: sf ? 1 : 2,
              },
            );
            return;
          } catch (retryErr) {
            toast.error(
              getApiErrorMessage(retryErr) ||
                'Could not apply this improvement. Please try again.',
            );
          }
        } else {
          toast.error(
            getApiErrorMessage(e) ||
              'Could not apply this improvement. Please try again.',
          );
        }
      } finally {
        cvImprovementDiffInFlightRef.current = false;
        setCvImprovementDiffActionsPending(false);
      }
    },
    [
      assistantPendingPatch,
      assistantPreviewMode,
      activeDiffPreviewKey,
      diffPreviews,
      profileId,
      queryClient,
      toast,
      resolveImprovementPointerByField,
      closeDiffPreviewForKey,
      reconcileAfterMutation,
    ],
  );

  const commitRejectDiff = useCallback(
    async (changeIndex?: number) => {
      const opKey = activeDiffPreviewKey;
      const diffPreview = opKey ? (diffPreviews[opKey] ?? null) : null;
      if (!diffPreview) return;
      if (assistantPreviewMode && diffPreview.pointer === '__assistant__') {
        closeDiffPreviewForKey(CV_ASSISTANT_DIFF_PREVIEW_KEY);
        setAssistantPreviewMode(false);
        setAssistantPendingPatch(null);
        void queryClient.refetchQueries({
          queryKey: queryKeys.cv.profile(profileId),
        });
        return;
      }
      if (cvImprovementDiffInFlightRef.current) return;
      cvImprovementDiffInFlightRef.current = true;
      setCvImprovementDiffActionsPending(true);
      const wasRejectAll = changeIndex == null;
      const improvementsKey = cvSuggestionsQueryKey(profileId);
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
          const t0Rj = Date.now();
          const product = await api.cv.rejectSuggestion(
            String(requestPointer),
            profileId,
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
          toast.success('Suggestion dismissed.');
          const inv = reconcileAfterMutation(profileId, 'queueOnly');
          logCvSuggestionMutationClientPerf(
            'onboarding.commitRejectDiff.rejectSuggestion',
            t0Rj,
            {
              invalidations: inv,
              cacheWrites: 1,
            },
          );
          return;
        }
        const result = await api.cv.rejectImprovement(
          requestPointer,
          profileId,
          {
            rejectedFields: [selectedField],
            ...(diffPreview.draftHash
              ? { draftHash: diffPreview.draftHash }
              : {}),
          },
        );
        if (result.partial) {
          const nextPointer = result.improvementId ?? diffPreview.pointer;
          const freshNext = await api.cv.applyImprovement(
            nextPointer,
            profileId,
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
            queryKey: cvSuggestionsQueryKey(profileId),
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
              profileId,
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
          } catch {
            /* swallow */
            return;
          }
        }
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
      activeDiffPreviewKey,
      diffPreviews,
      profileId,
      queryClient,
      toast,
      resolveImprovementPointerByField,
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
      if (!profileId.trim()) return 'skipped';
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
        const ts = targetSection?.trim();
        if (!ts) {
          toast.error(
            'Open the assistant on a section, or pick a section in the editor first.',
          );
          return 'skipped';
        }
        const res: CvAssistantCommandResponse = await api.cv.assistantCommand(
          profileId,
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
        setAssistantBusyStage('validating');
        setAssistantPreviewMode(true);
        setAssistantPendingPatch(res.patch);
        assistantCommandIdRef.current = res.commandId?.trim() ?? '';
        const target = (res.targetSection ?? 'summary').trim() || 'summary';
        const { before: beforeDisplay, after: afterDisplay } =
          assistantDiffDisplayStrings(target, res.diff.before, res.diff.after);
        setDiffPreviews((prev) => ({
          ...prev,
          [CV_ASSISTANT_DIFF_PREVIEW_KEY]: normalizeCvDiffPreviewParams({
            previewMapKey: CV_ASSISTANT_DIFF_PREVIEW_KEY,
            section: res.targetSection ?? target,
            before: res.diff.before,
            after: res.diff.after,
            pointer: '__assistant__',
            changedFields: [
              {
                fieldPath: target,
                field: assistantChangedFieldLabel(target),
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
    [assistantClarification?.clarifications, profileId, toast],
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
      if (!profileId.trim()) return 'skipped';
      setAssistantBusy(true);
      setAssistantBusyStage(
        options?.operation === 'apply_recruiter_findings'
          ? 'applying'
          : 'generating',
      );
      try {
        const mergedClarifications =
          options?.clarifications && options.clarifications.length > 0
            ? [
                ...(globalAssistantClarification?.clarifications ?? []),
                ...options.clarifications,
              ]
            : globalAssistantClarification?.clarifications;
        const res = await api.cv.assistantGlobalCommand(profileId, {
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
            operation: options?.operation ?? globalAssistantClarification?.operation,
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
            profileId,
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
          toast.success(res.diff.summary || `${res.affectedScopeLabel} ready`);
          return 'ok';
        }

        setAssistantScope('full_cv');
        setGlobalAssistantFindings(null);
        setGlobalAssistantFullResult(res);
        setGlobalAssistantReviewOpen(true);
        setAssistantPreviewMode(true);
        setAssistantPendingPatch(res.patch);
        setAssistantSectionDiffs(res.sectionDiffs);
        const globalChangedFields = globalAssistantChangedFields(
          res.sectionDiffs,
        );
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
        toast.error(formatApiErrorForToast(e, 'Global assistant command failed'));
        return 'error';
      } finally {
        setAssistantBusy(false);
        setAssistantBusyStage(null);
      }
    },
    [
      closeDiffPreviewForKey,
      cvDataSnapshot,
      globalAssistantClarification?.clarifications,
      globalAssistantClarification?.operation,
      initialData,
      openRecruiterScanSession,
      profileId,
      sections,
      toast,
    ],
  );

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
      if (!assistantClarification) return;
      const { command, question, targetSection } = assistantClarification;
      await runAssistantCommand(
        command,
        [{ question, answer }],
        targetSection,
      );
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

  const runToolbarAtsCheck = useCallback(async () => {
    try {
      await runScan.mutateAsync(profileId);
      const impr = await queryClient.fetchQuery({
        queryKey: cvSuggestionsQueryKey(profileId),
        queryFn: () => api.cv.getSuggestions(profileId, false),
      });
      const n = impr.pendingSuggestionsCount ?? impr.improvements.length;
      toast.success(`Resume scan complete: ${n} suggestions found`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }, [profileId, runScan, queryClient, toast]);

  const runRightPanelAnalyzeScan = useCallback(async () => {
    try {
      await runScan.mutateAsync(profileId);
      const impr = await queryClient.fetchQuery({
        queryKey: cvSuggestionsQueryKey(profileId),
        queryFn: () => api.cv.getSuggestions(profileId, false),
      });
      const n = impr.pendingSuggestionsCount ?? impr.improvements.length;
      toast.success(`Scan complete: ${n} suggestions found`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }, [profileId, runScan, queryClient, toast]);

  const onToggleRightInsightsCollapsed = useCallback(() => {
    setRightPanelCollapsed((c) => !c);
    setMobileInsightsOpen((v) => !v);
  }, []);

  const onTripleRightResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startPct = tripleRightPct;
      const totalW =
        triplePanelContainerRef.current?.offsetWidth ?? window.innerWidth;

      const onMove = (ev: PointerEvent) => {
        const delta = ((startX - ev.clientX) / totalW) * 100;
        setTripleRightPct(
          Math.min(rightPctMax, Math.max(rightPctMin, startPct + delta)),
        );
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [tripleRightPct, rightPctMin, rightPctMax],
  );

  const tripleColumn: CVBuilderTripleColumnConfig = useMemo(
    () => ({
      containerRef: triplePanelContainerRef,
      rightPct: tripleRightPct,
      rightCollapsed: rightPanelCollapsed,
      onToggleRightCollapsed: onToggleRightInsightsCollapsed,
      onRightResizePointerDown: onTripleRightResizePointerDown,
      centerHeaderActions: null,
    }),
    [
      rightPanelCollapsed,
      onToggleRightInsightsCollapsed,
      onTripleRightResizePointerDown,
      tripleRightPct,
    ],
  );

  const scoreCardMode = tripleRightPct < 23 ? 'compact' : 'full';

  const toolbarVisibility = toolbarVisibilityForSurface(builderContext);

  const existingSectionTypes = useMemo(
    () => new Set(sections.map((s) => s.type)),
    [sections],
  );

  const toolbarLeftSlot = isOnboarding && onBack ? (
    <button
      type="button"
      className="group flex shrink-0 cursor-pointer items-center gap-1.5 text-left text-[13px] text-[rgba(255,255,255,0.45)] transition-colors duration-200 hover:text-[rgba(255,255,255,0.8)]"
      onClick={onBack}
    >
      <ArrowLeft
        className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
        strokeWidth={2}
      />
      Back
    </button>
  ) : null;

  const toolbarRightAddon = isOnboarding && onContinue && onSkip ? (
    <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
      <Button
        type="button"
        className="h-8 shrink-0 px-3 text-[11px]"
        disabled={continueDisabled}
        onClick={() => onContinue(cvDataSnapshot ?? initialData)}
      >
        Continue →
      </Button>
      <button
        type="button"
        className="h-8 shrink-0 px-2 text-[11px] text-white/45 transition hover:text-white/80"
        onClick={onSkip}
      >
        Skip
      </button>
    </div>
  ) : null;

  const renderInsightsPanel = () => (
    <CvClinicTripleRightPanel
      profileId={profileId}
      tripleRightTab={tripleRightTab}
      onTripleRightTabChange={setTripleRightTab}
      scoreCardMode={scoreCardMode}
      scoreLoading={score.isLoading}
      scoreValue={score.data?.score}
      scoreBreakdown={score.data?.breakdown}
      improvementList={improvementList}
      improvementsBadgeCount={improvementsBadgeCount}
      formatRecommendation={formatRecommendation}
      isOnRecommendedTemplate={isOnRecommendedTemplate}
      onTemplateChange={onTemplateChangeApi}
      completenessGroups={completenessGroups}
      completenessScore={completeness?.score}
      qualitySignals={qualitySignals}
      bumpSpellCheck={() => setSpellCheckTrigger((n) => n + 1)}
      bumpSpellFixAll={() => setSpellFixAllTrigger((n) => n + 1)}
      jumpToSectionRef={jumpToSectionRef}
      resolveJumpSectionKey={resolveJumpSectionKey}
      onApplySpellIssue={applySpell}
      onDismissSpellIssue={dismissSpell}
      analyzeScanPending={runScan.isPending}
      onAnalyzeScan={runRightPanelAnalyzeScan}
      onRecruiterScan={() => void runRecruiterScan()}
      recruiterScanPending={assistantBusy && assistantBusyStage === 'generating'}
      onDiffPreview={mergeDiffPreviewOpen}
      onAtsKeywordAssist={handleAtsKeywordAssist}
      changesSlot={isTailoring ? tailorRightSlot : undefined}
      changesBadgeCount={isTailoring ? tailorChangesBadgeCount : 0}
    />
  );

  const tripleColumnRightSlot = renderInsightsPanel();

  return (
    <div className={cn('flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden', className)}>
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
        layerZIndex={modalLayerZIndex}
      />
      <TemplatePickerModal
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        data={cvDataSnapshot ?? initialData}
        selected={selectedTemplate}
        onSelect={(t) => void onTemplateChangeApi(t)}
        layerZIndex={modalLayerZIndex}
      />
      <AddSectionModal
        open={sectionModalOpen}
        onOpenChange={setSectionModalOpen}
        profileId={profileId}
        existingTypes={existingSectionTypes}
        existingSections={sections}
        layerZIndex={modalLayerZIndex}
      />
      <CvSectionOrderSuggestModal
        open={sectionOrderFlow.modalOpen}
        onOpenChange={sectionOrderFlow.setModalOpen}
        profileId={profileId}
        existingSections={sections}
        initialSuggest={sectionOrderFlow.suggestData}
        onApplied={() => {
          sectionOrderFlow.invalidateSuggest();
          setCvServerHydrateNonce((n) => n + 1);
        }}
        layerZIndex={modalLayerZIndex}
      />

      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden">
        <div className="hidden shrink-0 overflow-x-auto border-b border-white/[0.06] bg-[#0C0F0F] lg:block">
          <CvClinicToolbar
            visibility={toolbarVisibility}
            leftSlot={toolbarLeftSlot}
            rightAddon={toolbarRightAddon}
            allowWrap
            showInsightsToggle
            targetId={profileId}
            profileOptions={profileOptions}
            onProfileChange={onProfileChange ?? (() => {})}
            onNewCv={onNewCv ?? (() => {})}
            onOpenTemplatePicker={() => setTemplatePickerOpen(true)}
            onOpenSectionModal={() => setSectionModalOpen(true)}
            onOpenSectionOrder={() =>
              sectionOrderFlow.openSuggestModal(sectionOrderFlow.suggestData)
            }
            isSectionOrderPending={sectionOrderFlow.suggestQuery.isFetching}
            isSpellChecking={qualitySignals.isSpellChecking}
            onSpellCheck={() => setSpellCheckTrigger((n) => n + 1)}
            isAtsScanPending={runScan.isPending}
            onAtsCheck={runToolbarAtsCheck}
            isExportPending={isExportPending}
            onExportPdf={onExportPdf ?? (() => {})}
            onExportDocx={onExportDocx ?? (() => {})}
            rightPanelCollapsed={rightPanelCollapsed}
            onToggleInsights={onToggleRightInsightsCollapsed}
            builderSaveStatus={builderSaveStatus}
          />
        </div>
        {isOnboarding && onBack ? (
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0C0F0F] px-3 py-2 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="group flex h-8 shrink-0 cursor-pointer items-center gap-1 px-1 text-[11px] text-white/45 transition hover:text-white/80"
              onClick={onBack}
              aria-label="Back to previous step"
            >
              <ArrowLeft
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
                strokeWidth={2}
              />
              Back
            </button>
            {onContinue && onSkip ? (
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <Button
                type="button"
                className="h-8 shrink-0 px-3 text-[11px]"
                disabled={continueDisabled}
                onClick={() => onContinue(cvDataSnapshot ?? initialData)}
              >
                Continue →
              </Button>
              <button
                type="button"
                className="h-8 shrink-0 px-2 text-[11px] text-white/45 transition hover:text-white/80"
                onClick={onSkip}
              >
                Skip
              </button>
            </div>
            ) : null}
          </div>
        </div>
        ) : null}

        {!isTailoring ? (
        <MobileDockFab
          open={mobileInsightsOpen}
          onOpenChange={setMobileInsightsOpen}
          icon={BarChart3}
          label="Score and tips"
          fabId="onboarding-cv-insights"
          stackIndex={0}
        >
          <div className="space-y-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Score breakdown & tips
            </p>
            {renderInsightsPanel()}
          </div>
        </MobileDockFab>
        ) : null}

        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {isOnboarding && showOnboardingEditHint ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-[min(calc(100%-32px),320px)] -translate-x-1/2 rounded-xl border border-[rgba(0,201,177,0.35)] bg-[#0C1010]/95 px-4 py-3 text-center shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md"
              role="status"
            >
              <p className="text-[13px] font-medium leading-snug text-white">
                Click anywhere on the CV to start editing
              </p>
              <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.45)]">
                We&apos;ll highlight incomplete sections after you begin.
              </p>
            </motion.div>
          ) : null}
          {sectionOrderFlow.showProactiveBanner ? (
            <div className="absolute left-3 right-3 top-3 z-20 lg:left-4 lg:right-auto lg:max-w-md">
              <CvSectionOrderProactiveBanner
                onSuggest={() =>
                  sectionOrderFlow.openSuggestModal(sectionOrderFlow.suggestData)
                }
                onDismiss={sectionOrderFlow.dismissBanner}
              />
            </div>
          ) : null}
          {showGlobalAssistant ? (
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
          ) : null}
          <CVBuilder
            key={profileId}
            builderContext={builderContext}
            mode="dashboard"
            profileId={profileId}
            initialData={initialData}
            selectedTemplate={selectedTemplate}
            onTemplateChange={(t) => {
              if (isCvTemplateId(t)) onTemplateIdChange(t);
            }}
            existingSections={sections}
            dashboardTemplateExtras={dashboardTemplateExtras}
            dashboardTemplateMeta={dashboardTemplateMeta}
            uploadedCvHint={uploadedCvHint}
            onRequestReparse={onRequestReparse}
            onDashboardSaved={handleDashboardSaved}
            onJumpToSectionReady={(fn) => {
              jumpToSectionRef.current = fn;
            }}
            diffSection={diffPreview?.section ?? null}
            diffBefore={diffPreview?.before ?? null}
            diffAfter={diffPreview?.after ?? null}
            diffChangedFields={diffPreview?.changedFields ?? null}
            onAcceptDiff={(i) => void handleAcceptDiff(i)}
            onRejectDiff={(i) => void handleRejectDiff(i)}
            diffActionsDisabled={cvImprovementDiffActionsPending}
            improvementDiffTruthPanel={improvementDiffTruthPanel}
            improvementDiffTruthfulness={improvementDiffTruthfulness}
            improvementDiffPerformance={improvementDiffPerformance}
            tripleColumn={tripleColumn}
            tripleColumnRightSlot={tripleColumnRightSlot}
            onSaveStatusChange={(s) => {
              setBuilderSaveStatus(s);
              onSaveStatusChange?.(s);
            }}
            spellCheckTrigger={spellCheckTrigger}
            spellFixAllTrigger={spellFixAllTrigger}
            onQualitySignalsChange={setQualitySignals}
            onDataSnapshotChange={(d) => {
              setCvDataSnapshot(d);
              onDataSnapshotChange?.(d);
            }}
            cvAssistantCommand={runAssistantCommand}
            cvAssistantBusy={assistantBusy}
            cvAssistantBusyMessage={assistantBusyMessage}
            cvAssistantClarificationQuestion={null}
            externalPatch={effectiveExternalPatch}
            externalPatchNonce={effectiveExternalPatchNonce}
            serverHydrateNonce={cvServerHydrateNonce + externalServerHydrateNonce}
            onAiStructuredPersisted={() => {
              setCvServerHydrateNonce((n) => n + 1);
              void onStructuredPersisted?.();
            }}
            assistantAcceptHighlightSectionId={
              assistantAcceptHighlight?.sectionId ?? null
            }
            assistantAcceptHighlightNonce={
              assistantAcceptHighlight?.nonce ?? 0
            }
            tailorHighlightSectionId={tailorHighlightSectionId}
            tailorHighlightNonce={tailorHighlightNonce}
            tailorHighlightAction={tailorHighlightAction}
            recruiterScanHeatmap={recruiterScanPanelOpen ? recruiterScanHeatmap : null}
          />
        </div>
      </div>
      {showGlobalAssistant ? (
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
            showFab={!globalAssistantOpen}
            seedCommand={assistantSeedCommand}
            onSeedCommandConsumed={() => setAssistantSeedCommand(null)}
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
    </div>
  );
}
