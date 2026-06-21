'use client';

import { queryKeys } from '@/lib/queryKeys';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';

import { DashboardMainContext } from '@/components/dashboard/DashboardMainContext';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GlowCard } from '@/components/ui/GlowCard';
import { useToast } from '@/components/ui/Toast';
import {
  CVEditProvider,
  type CvAssistantRunResult,
  DEFAULT_HEADER_PREVIEW,
  type HeaderPreviewSettings,
} from '@/components/cv/CVEditContext';
import { BuilderRichTextField } from '@/components/cv/BuilderRichTextField';
import { CategorySkillsInput } from '@/components/cv/CategorySkillsInput';
import { CvDateField } from '@/components/cv/CvDateField';
import { CvRichTextSpan } from '@/components/cv/CvRichTextSpan';
import { CVDocumentPreview } from '@/components/cv/CVDocumentPreview';
import { CvDiffMobileActionBar } from '@/components/cv/CvDiffMobileActionBar';
import { cvDiffPreviewBuilderSection } from '@/lib/cvDiffPreviewSection';
import { CvImprovementDiffTruthPanel } from '@/components/cv/CvImprovementDiffTruthPanel';
import { CvTripleShellPreviewColumn } from '@/components/cv/CvTripleShellPreviewColumn';
import {
  api,
  type CVSectionRecord,
  type CvAcceptUpdatedSection,
  type CvReorderSectionsResult,
  type CvSpellIssue,
  type CvSpellcheckBulkResult,
  type CvPerformanceMeta,
  type CvTruthfulnessMeta,
} from '@/lib/api';
import {
  applyAcceptedSectionsToBuilderData,
  countFilledSections,
  CV_TEMPLATE_IDS,
  computeCvBuilderSaveFingerprint,
  coerceStructuredTextInCvBuilderData,
  emptyCVBuilderData,
  ensureCvPreviewData,
  filterCvBuilderReferences,
  getCvBuilderSectionFieldText,
  logCvBuilderSavePerfDev,
  newLocalId,
  setCvBuilderSectionFieldText,
  transformSectionsToCVBuilderData,
  type CVBuilderAchievement,
  type CVBuilderData,
  type CVBuilderLanguage,
  type CVBuilderParsedCustomItem,
  type CvBuilderSaveStatus,
  type CvTemplateId,
  type SaveCVBuilderDataResult,
} from '@/lib/cvBuilder';
import {
  dedupePreviewSectionKeys,
  professionalSectionRank,
} from '@/lib/cvSectionProfessionalOrder';
import { filterParsedCustomSectionsForEditor, shouldRenderCustomLegacySection } from '@/lib/cvParsedCustomSectionUtils';
import { containsCvChangeMarker, richTextPlainText } from '@/lib/cvRichTextCore';
import {
  readStoredPreviewSectionOrder,
  writeStoredPreviewSectionOrder,
} from '@/lib/cvPreviewSectionOrderStorage';
import {
  cvSectionOrderSuggestQueryKey,
  writeSectionOrderBannerDismissed,
} from '@/lib/cvSectionOrderSuggest';
import { getApiErrorMessage } from '@/lib/axios';
import {
  compressImageFileToCvDataUrl,
  CV_PHOTO_TOO_LARGE_USER_MESSAGE,
  normalizeCvPhotoUrlInput,
} from '@/lib/cvPhotoCompress';
import { commitAcceptedStructuredDraft } from '@/lib/cvStructuredDraftCommit';
import { refreshCvState } from '@/lib/refreshCvState';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { normalizeText } from '@/lib/normalizeText';
import {
  resolveCvBuilderSurfaceLayout,
  type CvBuilderSurfaceContext,
} from '@/lib/cvBuilderSurface';
import { cn } from '@/lib/utils';
import { CvOverlayLayerProvider } from '@/components/cv/CvOverlayLayerContext';
import { useCVAutosave } from '@/hooks/useCVAutosave';
import { useCvUndoRedo } from '@/hooks/useCvUndoRedo';
import {
  computeCvUndoFingerprint,
  CV_UNDO_COALESCE_MS,
  flushCvInlineEdits,
} from '@/lib/cvUndoRedo';
import {
  TAILOR_CV_EDITOR_DIALOG_Z,
  TAILOR_CV_EDITOR_OVERLAY_Z,
  TAILOR_CV_PORTAL_Z,
} from '@/lib/cvOverlayLayer';
import { useAuthStore } from '@/store/useAuthStore';

/** Merge server-derived CV data into local builder state without clobbering in-progress edits. */
function mergeNewSectionsIntoData(
  prev: CVBuilderData,
  incoming: CVBuilderData,
): CVBuilderData {
  // IMPORTANT: transformed server rows may regenerate local item IDs on each refetch.
  // Appending by ID causes duplicate entries. Only hydrate from server when local section is still empty.
  let next: CVBuilderData = prev;
  let changed = false;
  const touch = (): CVBuilderData => {
    if (!changed) {
      next = { ...prev };
      changed = true;
    }
    return next;
  };
  const seedIfEmpty = <T,>(
    key: keyof CVBuilderData,
    prevArr: T[],
    incArr: T[],
  ) => {
    if (!prevArr.length && incArr.length) {
      (touch() as Record<string, unknown>)[key as string] = incArr;
    }
  };
  seedIfEmpty('languages', prev.languages, incoming.languages);
  seedIfEmpty('projects', prev.projects, incoming.projects);
  seedIfEmpty('certifications', prev.certifications, incoming.certifications);
  seedIfEmpty('achievements', prev.achievements, incoming.achievements);
  seedIfEmpty('references', prev.references, incoming.references);
  if (filterParsedCustomSectionsForEditor(incoming.parsedCustomSections).length === 0) {
    seedIfEmpty('customSections', prev.customSections, incoming.customSections);
  }
  if (!prev.experience.items.length && incoming.experience.items.length) {
    next = { ...touch(), experience: { items: incoming.experience.items } };
  }
  if (!prev.education.items.length && incoming.education.items.length) {
    next = { ...touch(), education: { items: incoming.education.items } };
  }
  if (!prev.skills.categories.length && incoming.skills.categories.length) {
    next = { ...touch(), skills: { categories: incoming.skills.categories } };
  }
  if (
    !prev.parsedCustomSections.length &&
    incoming.parsedCustomSections.length
  ) {
    next = { ...touch(), parsedCustomSections: incoming.parsedCustomSections };
  }
  return changed ? next : prev;
}

const fieldClass =
  'w-full rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#111616] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#00C9B1]/40';

const CEFR_LEVEL_OPTIONS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const TEMPLATE_LABELS: Record<CvTemplateId, string> = {
  classic: 'Classic',
  modern: 'Modern',
  creative: 'Creative',
  professional: 'Professional',
  onyx: 'Onyx',
};

const EMPTY_INCOMPLETE_SECTION_IDS = new Set<string>();

const TEMPLATE_FIELD_CONFIG = {
  showInternationalPersonalFields: [] as CvTemplateId[],
  showPhotoUpload: ['onyx'] as CvTemplateId[],
  showHobbies: [] as CvTemplateId[],
  showReferences: [
    'classic',
    'modern',
    'creative',
    'professional',
    'onyx',
  ] as CvTemplateId[],
  showCefrLanguageBreakdown: [] as CvTemplateId[],
} as const;

/** A4 preview canvas size used by CVDocumentPreview layouts (px). */
const TEMPLATE_PREVIEW_W = 794;
const TEMPLATE_PREVIEW_H = 1123;
const TEMPLATE_CARD_LABEL_H = 44;

export type CVBuilderMissingField = {
  sectionKey: string;
  sectionLabel: string;
  fieldPath: string;
  fieldLabel: string;
};

export type CVBuilderQualitySignals = {
  incompleteSectionIds: string[];
  incompleteCount: number;
  /** Friendly per-section list of fields that are currently empty (excludes hidden/deleted sections). */
  missingFields: CVBuilderMissingField[];
  /** Section key → friendly label (for showing in the right panel without re-deriving labels). */
  sectionLabels: Record<string, string>;
  spellIssuesBySection: Record<string, number>;
  spellIssueEntriesBySection: Record<string, CvSpellIssue[]>;
  spellIssuesByField: Record<string, CvSpellIssue[]>;
  /** All issues whose `type === 'spelling'`. */
  spellIssueCount: number;
  /** All issues whose `type === 'grammar'` or `type === 'style'`. */
  grammarIssueCount: number;
  isSpellChecking: boolean;
};

function spellAggregatesFromByField(byField: Record<string, CvSpellIssue[]>): {
  spellIssuesBySection: Record<string, number>;
  spellIssueEntriesBySection: Record<string, CvSpellIssue[]>;
} {
  const spellIssueEntriesBySection: Record<string, CvSpellIssue[]> = {};
  for (const [composite, list] of Object.entries(byField)) {
    const sep = composite.indexOf('::');
    if (sep === -1) continue;
    const sectionKey = composite.slice(0, sep);
    const fieldPath = composite.slice(sep + 2);
    for (const issue of list) {
      const enriched: CvSpellIssue = {
        ...issue,
        sectionId: sectionKey,
        fieldPath: issue.fieldPath ?? fieldPath,
        message: issue.message || 'Issue',
      };
      spellIssueEntriesBySection[sectionKey] = [
        ...(spellIssueEntriesBySection[sectionKey] ?? []),
        enriched,
      ];
    }
  }
  const spellIssuesBySection: Record<string, number> = {};
  for (const [sk, arr] of Object.entries(spellIssueEntriesBySection)) {
    spellIssuesBySection[sk] = arr.length;
  }
  return { spellIssuesBySection, spellIssueEntriesBySection };
}

function CvTemplatePickerCard({
  tid,
  selected,
  data,
  onSelect,
}: {
  tid: CvTemplateId;
  selected: boolean;
  data: CVBuilderData;
  onSelect: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(0.22);

  useLayoutEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(32, r.width - 8);
      const h = Math.max(32, r.height - TEMPLATE_CARD_LABEL_H);
      const sw = w / TEMPLATE_PREVIEW_W;
      const sh = h / TEMPLATE_PREVIEW_H;
      setScale(Math.max(0.14, Math.min(Math.min(sw, sh), 0.52)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onSelect}
      className={cn(
        'relative aspect-[1/1.4] w-full overflow-hidden rounded-lg border-2 text-left transition',
        selected
          ? 'border-[#00C9B1]'
          : 'border-white/[0.08] hover:border-white/20',
      )}
    >
      <div
        className="absolute inset-x-0 overflow-hidden bg-[#080A0A]"
        style={{ top: 0, bottom: TEMPLATE_CARD_LABEL_H }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-0"
          style={{
            width: TEMPLATE_PREVIEW_W,
            height: TEMPLATE_PREVIEW_H,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          <CVDocumentPreview data={ensureCvPreviewData(data)} template={tid} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1.5">
        <p className="truncate text-[10px] font-semibold text-white">
          {TEMPLATE_LABELS[tid]}
        </p>
        {selected ? <p className="text-[9px] text-[#00C9B1]">Active</p> : null}
      </div>
    </button>
  );
}

const CV_SPLIT_STORAGE_KEY = 'applymate.cvBuilder.editorWidthPct';
/** Editor column as % of the split row; preview gets the rest. */
const CV_SPLIT_DEFAULT_PCT = 44;
const CV_SPLIT_MIN_PCT = 30;
const CV_SPLIT_MAX_PCT = 56;

function clampCvSplitPct(n: number): number {
  return Math.min(CV_SPLIT_MAX_PCT, Math.max(CV_SPLIT_MIN_PCT, n));
}

function readStoredCvSplitPct(): number {
  if (typeof window === 'undefined') return CV_SPLIT_DEFAULT_PCT;
  try {
    const raw = window.localStorage.getItem(CV_SPLIT_STORAGE_KEY);
    if (raw == null) return CV_SPLIT_DEFAULT_PCT;
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return CV_SPLIT_DEFAULT_PCT;
    return clampCvSplitPct(v);
  } catch {
    return CV_SPLIT_DEFAULT_PCT;
  }
}

function readHeaderPreviewStorage(
  profileId: string | null | undefined,
): HeaderPreviewSettings {
  if (!profileId?.trim() || typeof window === 'undefined')
    return DEFAULT_HEADER_PREVIEW;
  try {
    const raw = window.sessionStorage.getItem(
      `applymate:cv:headerPreview:${profileId.trim()}`,
    );
    if (!raw) return DEFAULT_HEADER_PREVIEW;
    const o = JSON.parse(raw) as Partial<HeaderPreviewSettings> & {
      showLink?: boolean;
      showExtraLink?: boolean;
    };
    const legacyLink = o.showLink;
    return {
      ...DEFAULT_HEADER_PREVIEW,
      ...o,
      photoStyle: o.photoStyle ?? DEFAULT_HEADER_PREVIEW.photoStyle,
      showHeadline: o.showHeadline ?? DEFAULT_HEADER_PREVIEW.showHeadline,
      showLinkedIn:
        o.showLinkedIn ?? legacyLink ?? DEFAULT_HEADER_PREVIEW.showLinkedIn,
      showGithub:
        o.showGithub ?? legacyLink ?? DEFAULT_HEADER_PREVIEW.showGithub,
      showWebsiteToggle:
        o.showWebsiteToggle ?? DEFAULT_HEADER_PREVIEW.showWebsiteToggle,
      showPortfolioToggle:
        o.showPortfolioToggle ??
        o.showExtraLink ??
        DEFAULT_HEADER_PREVIEW.showPortfolioToggle,
    };
  } catch {
    return DEFAULT_HEADER_PREVIEW;
  }
}

function writeHeaderPreviewStorage(
  profileId: string | null | undefined,
  next: HeaderPreviewSettings,
) {
  if (!profileId?.trim() || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `applymate:cv:headerPreview:${profileId.trim()}`,
      JSON.stringify(next),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Maps every section row to a single ordered id list matching `previewSectionOrder` keys.
 * Avoids the key→id loop + append tail pattern, which could mis-order rows when a key is missing
 * from the map or when multiple rows share ordering edge cases.
 */
function orderSectionRowIdsByPreviewKeys(
  allSections: CVSectionRecord[],
  previewKeys: string[],
): string[] {
  const dedupedKeys = dedupePreviewSectionKeys(previewKeys);
  const pos = new Map<string, number>();
  dedupedKeys.forEach((k, i) => {
    if (!pos.has(k)) pos.set(k, i);
  });
  const sorted = [...allSections].sort((a, b) => {
    const ka = accordionKeyFromSection(a);
    const kb = accordionKeyFromSection(b);
    const pa = ka !== null && pos.has(ka) ? pos.get(ka)! : 100_000 + a.order;
    const pb = kb !== null && pos.has(kb) ? pos.get(kb)! : 100_000 + b.order;
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });
  return sorted.map((s) => s.id);
}

/** Maps API section row → accordion / preview id (see CVDocumentPreview `sectionBox` ids). */
function accordionKeyFromSection(s: CVSectionRecord): string | null {
  const tl = s.type.toLowerCase();
  if (tl.startsWith('custom_')) return `parsed-${s.id}`;
  if (tl === 'custom') return 'custom-legacy';
  if (tl === 'links') return 'personal';
  if (
    [
      'personal',
      'summary',
      'experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'achievements',
      'languages',
      'references',
    ].includes(tl)
  ) {
    return tl;
  }
  return `parsed-${s.id}`;
}

function resolveSectionForAccordion(
  accordionId: string,
  sections: CVSectionRecord[],
): CVSectionRecord | undefined {
  if (accordionId.startsWith('parsed-')) {
    const id = accordionId.slice('parsed-'.length);
    return sections.find((x) => x.id === id);
  }
  if (accordionId === 'custom-legacy') {
    return sections.find((x) => x.type.toLowerCase() === 'custom');
  }
  if (accordionId === 'personal') {
    return (
      sections.find((x) => x.type.toLowerCase() === 'personal') ??
      sections.find((x) => x.type.toLowerCase() === 'links')
    );
  }
  return sections.find((x) => x.type === accordionId);
}

/** Maps accordion / preview key → API `targetSection` for the CV assistant (section row `type`). */
function assistantTargetSectionFromAccordionKey(
  accordionId: string | null | undefined,
  sections: CVSectionRecord[],
): string | undefined {
  if (!accordionId?.trim()) return undefined;
  const sec = resolveSectionForAccordion(accordionId, sections);
  if (sec?.type) return sec.type;
  const tl = accordionId.toLowerCase();
  if (
    [
      'summary',
      'experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'achievements',
      'languages',
      'references',
      'personal',
    ].includes(tl)
  ) {
    return tl;
  }
  return undefined;
}

function accordionKeyProfessionalRank(
  accordionKey: string,
  sections: CVSectionRecord[],
): number {
  const row = resolveSectionForAccordion(accordionKey, sections);
  if (row?.type) return professionalSectionRank(row.type);
  if (accordionKey === 'custom-legacy')
    return professionalSectionRank('custom');
  return professionalSectionRank(accordionKey);
}

function previewOrderFromSections(sections: CVSectionRecord[]): string[] {
  const ordered = [...sections].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
  const keys: string[] = [];
  for (const s of ordered) {
    const key = accordionKeyFromSection(s);
    if (!key) continue;
    if (!keys.includes(key)) keys.push(key);
  }
  // Keep core sections visible even when a refetch temporarily returns optional-only rows.
  for (const core of ['summary', 'experience', 'education', 'projects', 'skills']) {
    if (!keys.includes(core)) keys.push(core);
  }
  return dedupePreviewSectionKeys(keys);
}

/**
 * When new section rows appear, insert new keys by canonical type rank without discarding the user's
 * existing preview drag order for rows that still exist. (Avoid using raw server list index — the API
 * may assign `order` such that a new optional row sorts first.)
 */
function mergePreviewSectionOrder(
  prev: string[],
  sections: CVSectionRecord[],
): string[] {
  const server = previewOrderFromSections(sections);
  const serverSet = new Set(server);
  const prevFiltered = prev.filter((k) => serverSet.has(k));
  const prevSet = new Set(prevFiltered);
  const newKeys = server.filter((k) => !prevSet.has(k));
  const out = newKeys.length > 0 ? [...prevFiltered, ...newKeys] : [...prevFiltered];
  for (const k of server) {
    if (!out.includes(k)) out.push(k);
  }
  return dedupePreviewSectionKeys(out.length > 0 ? out : server);
}

/** Desktop CV Clinic: preview + optional insights (`cv/page.tsx`). */
export type CVBuilderTripleColumnConfig = {
  rightSlot?: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  rightPct: number;
  rightCollapsed: boolean;
  onToggleRightCollapsed: () => void;
  onRightResizePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  centerHeaderActions?: ReactNode;
};

function useDesktopLgMedia(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia('(min-width: 1024px)');
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () =>
      typeof window !== 'undefined'
        ? window.matchMedia('(min-width: 1024px)').matches
        : false,
    () => false,
  );
}

export type CVBuilderProps = {
  /**
   * Preferred entry point — same editor everywhere; adjusts layout chrome only.
   * When set, overrides `mode` / `cvMode` unless you pass those explicitly for legacy callers.
   */
  builderContext?: CvBuilderSurfaceContext;
  mode: 'onboarding' | 'dashboard';
  /** clinic = default CV Clinic; tailor = Grammarly-style job tailoring split view. */
  cvMode?: 'clinic' | 'tailor';
  initialData?: CVBuilderData;
  selectedTemplate: CvTemplateId;
  onTemplateChange?: (template: string) => void;
  onComplete?: (data: CVBuilderData) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
  /** Dashboard: current sections from API for upsert. */
  existingSections?: CVSectionRecord[];
  onDashboardSaved?: (result?: SaveCVBuilderDataResult) => void | Promise<void>;
  /** Dashboard multi-CV: scope section + profile PATCH to this profile. */
  profileId?: string | null;
  /** Dashboard: e.g. “Restore original” control beside template pills. */
  dashboardTemplateExtras?: ReactNode;
  /** Dashboard: secondary line under template row (e.g. detected layout). */
  dashboardTemplateMeta?: ReactNode;
  /** When true, show upload-specific empty-summary hint (e.g. profile from file upload). */
  uploadedCvHint?: boolean;
  /** Called when user wants to re-upload because sections are empty after parse. */
  onRequestReparse?: () => void;
  onJumpToSectionReady?: (
    fn: (sid: string, itemId?: string, opts?: { scrollForm?: boolean }) => void,
  ) => void;
  diffSection?: string | null;
  diffBefore?: unknown;
  diffAfter?: unknown;
  diffChangedFields?: Array<{
    field?: string;
    fieldPath?: string;
    fieldLabel?: string;
    before: string;
    after: string;
    type: 'added' | 'removed' | 'changed';
    sectionDiffIndex?: number;
  }> | null;
  /** Global assistant: inline diff on each changed section in the preview. */
  diffMultiSection?: boolean;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  /** While true, preview diff Accept/Reject are disabled (improvement API in flight). */
  diffActionsDisabled?: boolean;
  tripleColumn?: CVBuilderTripleColumnConfig;
  tripleColumnRightSlot?: ReactNode;
  /** Reflects debounced save indicator for dashboard toolbar (optional). */
  onSaveStatusChange?: (status: CvBuilderSaveStatus) => void;
  /** Reflects section reorder persistence state for parent actions like export. */
  onReorderPendingChange?: (pending: boolean) => void;
  onQualitySignalsChange?: (signals: CVBuilderQualitySignals) => void;
  spellCheckTrigger?: number;
  spellFixAllTrigger?: number;
  externalPatch?: Partial<CVBuilderData> | null;
  externalPatchNonce?: number;
  onDataSnapshotChange?: (data: CVBuilderData) => void;
  /** CV Clinic: preview teardrop assistant uses the same command API as the floating panel. */
  cvAssistantCommand?: (
    command: string,
    clarifications?: Array<{ question: string; answer: string }>,
    targetSection?: string,
  ) => Promise<CvAssistantRunResult>;
  cvAssistantBusy?: boolean;
  cvAssistantBusyMessage?: string | null;
  cvAssistantClarificationQuestion?: string | null;
  /**
   * First onboarding editor visit: hide preview “Incomplete” chips until the user edits
   * or 60s elapses — keeps the first impression calm while completeness still feeds insights.
   */
  deferIncompletePreviewBadges?: boolean;
  /**
   * Dashboard: increment after CV mutations that persisted on the server so local editor state
   * is replaced from {@link initialData} (avoids partial `externalPatch` merges wiping arrays).
   */
  serverHydrateNonce?: number;
  /**
   * When true for the next hydrate triggered by `serverHydrateNonce`, keep undo/redo history
   * (post-accept background confirmation, autosave echo).
   */
  serverHydratePreserveHistoryRef?: React.MutableRefObject<boolean>;
  /**
   * Tailor accept/revert: always rehydrate from server even when the editor is dirty, and clear
   * save-error banners (structured persist already updated sections on the backend).
   */
  forceServerHydrateNonce?: number;
  /**
   * After generator or structured AI accept refetched the server, parent bumps `serverHydrateNonce`
   * so the builder rehydrates from fresh `initialData`.
   */
  onAiStructuredPersisted?: () => void;
  /** Tailor split view: pulse + scroll to this section after accept. */
  tailorHighlightSectionId?: string | null;
  tailorHighlightNonce?: number;
  tailorHighlightAction?: 'accepted' | 'reverted';
  /** Clinic assistant Accept: flash + scroll to updated section (~600ms). */
  assistantAcceptHighlightSectionId?: string | null;
  assistantAcceptHighlightNonce?: number;
  /** Recruiter Scan: attention heatmap on preview sections (preview section ids). */
  recruiterScanHeatmap?: Record<string, import('@/lib/cvRecruiterScan').CvRecruiterScanReadingPathEntry> | null;
  /** LanguageTool / spellcheck locale (e.g. en, de, fr). Defaults to en. */
  spellcheckLanguage?: string;
  /** Exposes undo/redo controls for toolbar wiring. */
  onUndoRedoReady?: (controls: {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
  }) => void;
  /**
   * After undo/redo restores {@link CVBuilderData}, parent may persist + refetch derived
   * state (suggestions). Must NOT manually re-insert suggestion rows — only invalidate.
   */
  onHistoryApplied?: (restored: CVBuilderData, kind: 'undo' | 'redo') => void;
  /** When true with an active improvement diff, show factuality trust copy above the preview. */
  improvementDiffTruthPanel?: boolean;
  improvementDiffTruthfulness?: CvTruthfulnessMeta | null;
  improvementDiffPerformance?: CvPerformanceMeta | null;
  /** Pause dashboard autosave while an improvement diff overlay is open. */
  isDiffOverlayOpen?: boolean;
  /** Parent registers immediate accept patch handler (Apply-with-AI accept). */
  onImmediateSectionPatchReady?: (
    patch: (sections: CvAcceptUpdatedSection[]) => void,
  ) => void;
};

export function CVBuilder({
  builderContext,
  mode: modeProp,
  cvMode: cvModeProp,
  initialData,
  selectedTemplate,
  onTemplateChange,
  onComplete,
  onSkip,
  existingSections = [],
  onDashboardSaved,
  profileId = null,
  dashboardTemplateExtras,
  dashboardTemplateMeta,
  uploadedCvHint = false,
  onRequestReparse,
  onJumpToSectionReady,
  diffSection = null,
  diffBefore = null,
  diffAfter = null,
  diffChangedFields = null,
  diffMultiSection = false,
  onAcceptDiff,
  onRejectDiff,
  diffActionsDisabled = false,
  tripleColumn,
  tripleColumnRightSlot,
  onSaveStatusChange,
  onReorderPendingChange,
  onQualitySignalsChange,
  spellCheckTrigger = 0,
  spellFixAllTrigger = 0,
  externalPatch = null,
  externalPatchNonce = 0,
  onDataSnapshotChange,
  cvAssistantCommand,
  cvAssistantBusy,
  cvAssistantBusyMessage,
  cvAssistantClarificationQuestion,
  deferIncompletePreviewBadges: deferIncompletePreviewBadgesProp = false,
  serverHydrateNonce = 0,
  serverHydratePreserveHistoryRef,
  forceServerHydrateNonce = 0,
  improvementDiffTruthPanel = false,
  improvementDiffTruthfulness = null,
  improvementDiffPerformance = null,
  isDiffOverlayOpen = false,
  onImmediateSectionPatchReady,
  onAiStructuredPersisted,
  tailorHighlightSectionId = null,
  tailorHighlightNonce = 0,
  tailorHighlightAction = 'accepted',
  assistantAcceptHighlightSectionId = null,
  assistantAcceptHighlightNonce = 0,
  recruiterScanHeatmap = null,
  spellcheckLanguage = 'en',
  onUndoRedoReady,
  onHistoryApplied,
}: CVBuilderProps) {
  const surfaceLayout = builderContext
    ? resolveCvBuilderSurfaceLayout(builderContext)
    : null;
  const mode = modeProp ?? surfaceLayout?.mode ?? 'dashboard';
  const cvMode = cvModeProp ?? surfaceLayout?.cvMode ?? 'clinic';
  const deferIncompletePreviewBadgesResolved =
    deferIncompletePreviewBadgesProp ??
    surfaceLayout?.deferIncompletePreviewBadges ??
    false;

  const queryClient = useQueryClient();
  const toast = useToast();
  const dashboardMainRef = useContext(DashboardMainContext);
  const user = useAuthStore((s) => s.user);
  const emailDefault = user?.email ?? '';

  const [data, setData] = useState<CVBuilderData>(
    () =>
      initialData ??
      emptyCVBuilderData({ email: emailDefault, name: user?.name }),
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const seed =
      initialData ??
      emptyCVBuilderData({ email: emailDefault, name: user?.name });
    const s = new Set(['personal', 'experience', 'education', 'skills']);
    if (
      TEMPLATE_FIELD_CONFIG.showReferences.includes(selectedTemplate) &&
      seed.references.length > 0
    ) {
      s.add('references');
    }
    return s;
  });
  const [activeSection, setActiveSection] = useState<string | null>('personal');
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [langCefrOpen, setLangCefrOpen] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const dataRef = useRef(data);
  const templateRef = useRef(selectedTemplate);
  dataRef.current = data;
  templateRef.current = selectedTemplate;

  const [dataRevision, setDataRevision] = useState(0);
  const undoCoalesceOpenRef = useRef(false);
  const undoCoalesceTimerRef = useRef<number | null>(null);

  const clearUndoCoalesce = useCallback(() => {
    if (undoCoalesceTimerRef.current != null) {
      window.clearTimeout(undoCoalesceTimerRef.current);
    }
    undoCoalesceTimerRef.current = window.setTimeout(() => {
      undoCoalesceOpenRef.current = false;
      undoCoalesceTimerRef.current = null;
    }, CV_UNDO_COALESCE_MS);
  }, []);

  const undoRedo = useCvUndoRedo();
  const {
    pushBeforeChange: pushUndoSnapshot,
    pushSnapshotForced: pushUndoSnapshotForced,
    undo: undoEdit,
    redo: redoEdit,
    canUndo,
    canRedo,
    reset: resetUndoStack,
  } = undoRedo;
  const onUndoRedoReadyRef = useRef(onUndoRedoReady);
  onUndoRedoReadyRef.current = onUndoRedoReady;
  const onHistoryAppliedRef = useRef(onHistoryApplied);
  onHistoryAppliedRef.current = onHistoryApplied;
  const flushDashboardAutosaveRef = useRef<(() => Promise<void>) | null>(null);
  const [allowIncompletePreviewBadges, setAllowIncompletePreviewBadges] =
    useState(() => !deferIncompletePreviewBadgesResolved);
  useEffect(() => {
    if (!deferIncompletePreviewBadgesResolved) return undefined;
    const id = window.setTimeout(
      () => setAllowIncompletePreviewBadges(true),
      60_000,
    );
    return () => window.clearTimeout(id);
  }, [deferIncompletePreviewBadgesResolved]);

  useEffect(() => {
    if (deferIncompletePreviewBadgesResolved && dirty)
      setAllowIncompletePreviewBadges(true);
  }, [deferIncompletePreviewBadgesResolved, dirty]);
  const [saveStatus, setSaveStatus] = useState<CvBuilderSaveStatus>('idle');
  const [focusedPreviewSection, setFocusedPreviewSection] = useState<
    string | null
  >(null);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const [focusedEntrySection, setFocusedEntrySection] = useState<string | null>(
    null,
  );
  const [knownSectionTypes, setKnownSectionTypes] = useState<Set<string>>(
    () => new Set(existingSections?.map((s) => s.type) ?? []),
  );
  const [headerPreview, setHeaderPreviewState] =
    useState<HeaderPreviewSettings>(DEFAULT_HEADER_PREVIEW);
  const [aiPending, setAiPending] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    kind: string;
    id: string;
  } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editorWidthPct, setEditorWidthPct] = useState(() =>
    readStoredCvSplitPct(),
  );
  const [editorExpanded, setEditorExpanded] = useState(false);
  /** Ensures `<main>` ref is read after expand so the portaled editor mounts in the content area. */
  const [portalFlip, setPortalFlip] = useState(0);
  /** Accordion id → visible (false = hidden in preview). Omitted keys default to visible. */
  const [sectionVisibility, setSectionVisibility] = useState<
    Record<string, boolean>
  >({});
  const [previewSectionOrder, setPreviewSectionOrder] = useState<string[]>(() => {
    const server = previewOrderFromSections(existingSections);
    const stored = profileId?.trim() ? readStoredPreviewSectionOrder(profileId.trim()) : null;
    if (!stored?.length) return server;
    const serverSet = new Set(server);
    const fromStored = stored.filter((k) => serverSet.has(k));
    const merged = fromStored.length > 0 ? [...fromStored, ...server.filter((k) => !fromStored.includes(k))] : server;
    return dedupePreviewSectionKeys(merged.length > 0 ? merged : server);
  });
  const [reorderPending, setReorderPending] = useState(false);
  const [spellIssuesBySection, setSpellIssuesBySection] = useState<
    Record<string, number>
  >({});
  const [spellIssueEntriesBySection, setSpellIssueEntriesBySection] = useState<
    Record<string, CvSpellIssue[]>
  >({});
  const [spellIssuesByField, setSpellIssuesByField] = useState<
    Record<string, CvSpellIssue[]>
  >({});
  const [isSpellChecking, setIsSpellChecking] = useState(false);
  const [visibilityPendingAccordion, setVisibilityPendingAccordion] = useState<
    string | null
  >(null);
  const lastConfirmedPreviewOrderRef = useRef<string[]>(
    previewOrderFromSections(existingSections),
  );
  /** Tracks which profile `previewSectionOrder` was last aligned to (reset order on profile switch). */
  const lastPreviewOrderProfileRef = useRef<string | null>(null);
  const splitRowRef = useRef<HTMLDivElement>(null);
  const editorWidthPctRef = useRef(editorWidthPct);
  editorWidthPctRef.current = editorWidthPct;

  const desktopLg = useDesktopLgMedia();
  const isTailorView = cvMode === 'tailor';
  const showTripleShell =
    mode === 'dashboard' && tripleColumn != null && desktopLg;
  const showTripleChrome = showTripleShell;

  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  onSaveStatusChangeRef.current = onSaveStatusChange;
  useEffect(() => {
    onSaveStatusChangeRef.current?.(saveStatus);
  }, [saveStatus]);

  useEffect(() => {
    onDataSnapshotChange?.(data);
  }, [data, onDataSnapshotChange]);

  useEffect(() => {
    setHeaderPreviewState(readHeaderPreviewStorage(profileId ?? null));
    setFocusedPreviewSection(null);
    lastPreviewOrderProfileRef.current = null;
  }, [profileId]);

  const canUndoRef = useRef(canUndo);
  const canRedoRef = useRef(canRedo);
  canUndoRef.current = canUndo;
  canRedoRef.current = canRedo;

  const applyHistoryRestore = useCallback(
    (restored: CVBuilderData | null, kind: 'undo' | 'redo') => {
      if (!restored) return;
      if (undoCoalesceTimerRef.current != null) {
        window.clearTimeout(undoCoalesceTimerRef.current);
        undoCoalesceTimerRef.current = null;
      }
      undoCoalesceOpenRef.current = false;
      flushCvInlineEdits();
      dataRef.current = restored;
      setData(restored);
      setDataRevision((n) => n + 1);
      setDirty(true);
      setSaveStatus('dirty');
      void (async () => {
        await flushDashboardAutosaveRef.current?.();
        onHistoryAppliedRef.current?.(restored, kind);
      })();
    },
    [],
  );

  useEffect(() => {
    /**
     * Shared content undo/redo (CVBuilderData snapshots only).
     * Tailor sidebar "Undo accept" uses CvPatchEngine revert — a separate system; it does
     * not share this stack. Ctrl+Z here always restores editor content history.
     */
    if (mode !== 'dashboard' && mode !== 'onboarding') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusedPreviewSection(null);
        setFocusedEntryId(null);
        setFocusedEntrySection(null);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      const isUndo =
        e.key === 'z' && !e.shiftKey && canUndoRef.current;
      const isRedo =
        (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedoRef.current;
      if (!isUndo && !isRedo) return;

      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement | null;
      const isNativeInput =
        target != null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (isNativeInput && target instanceof HTMLElement) {
        target.blur();
      }
      flushCvInlineEdits();

      if (isUndo) {
        applyHistoryRestore(undoEdit(dataRef.current), 'undo');
      } else if (isRedo) {
        applyHistoryRestore(redoEdit(dataRef.current), 'redo');
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [mode, undoEdit, redoEdit, applyHistoryRestore]);

  useEffect(() => {
    setKnownSectionTypes(new Set(existingSections?.map((s) => s.type) ?? []));
  }, [profileId]);

  /** Section row id set — merge preview order only when rows are added/removed, not when `order` alone changes. */
  const cvSectionIdsSig = useMemo(
    () =>
      [...existingSections]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => s.id)
        .join('|'),
    [existingSections],
  );

  const cvSectionRowsSig = useMemo(
    () =>
      [...existingSections]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => `${s.id}:${s.order}`)
        .join('|'),
    [existingSections],
  );

  const lastPersistedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    onUndoRedoReadyRef.current?.({
      canUndo,
      canRedo,
      undo: () => {
        applyHistoryRestore(undoEdit(dataRef.current), 'undo');
      },
      redo: () => {
        applyHistoryRestore(redoEdit(dataRef.current), 'redo');
      },
    });
  }, [canUndo, canRedo, undoEdit, redoEdit, applyHistoryRestore]);

  useEffect(
    () => () => {
      if (undoCoalesceTimerRef.current != null) {
        window.clearTimeout(undoCoalesceTimerRef.current);
      }
    },
    [],
  );

  const sectionsRef = useRef(existingSections);
  sectionsRef.current = existingSections;

  const { flushDashboardAutosave } = useCVAutosave({
    mode,
    profileId,
    data,
    selectedTemplate,
    dirty,
    isDiffOverlayOpen,
    setDirty,
    setSaveStatus,
    sectionsRef,
    dataRef,
    templateRef,
    lastPersistedFingerprintRef,
    cvSectionRowsSig,
    onDashboardSaved,
    toast,
  });
  flushDashboardAutosaveRef.current = flushDashboardAutosave;

  const prevDiffOverlayOpenRef = useRef(isDiffOverlayOpen);
  useEffect(() => {
    const wasOpen = prevDiffOverlayOpenRef.current;
    prevDiffOverlayOpenRef.current = isDiffOverlayOpen;
    if (wasOpen && !isDiffOverlayOpen && dirty) {
      void flushDashboardAutosave();
    }
  }, [isDiffOverlayOpen, dirty, flushDashboardAutosave]);

  /**
   * When section row ids change for the same profile, merge server `order` into local preview drag order.
   * Profile switches reset from server (`lastPreviewOrderProfileRef` + `profileId` effect).
   */
  useEffect(() => {
    if (mode !== 'dashboard') return;
    const pidKey = profileId?.trim() ? profileId.trim() : '__no_profile__';
    if (lastPreviewOrderProfileRef.current !== pidKey) {
      lastPreviewOrderProfileRef.current = pidKey;
      const server = previewOrderFromSections(existingSections);
      const pid = profileId?.trim();
      if (server.length > 0) {
        setPreviewSectionOrder(server);
        lastConfirmedPreviewOrderRef.current = server;
        if (pid) writeStoredPreviewSectionOrder(pid, server);
      } else {
        const fromStore = pid ? readStoredPreviewSectionOrder(pid) : null;
        const next = fromStore?.length ? dedupePreviewSectionKeys(fromStore) : server;
        setPreviewSectionOrder(next);
        lastConfirmedPreviewOrderRef.current = next;
      }
      return;
    }
    setPreviewSectionOrder((prev) =>
      mergePreviewSectionOrder(prev, existingSections),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to id-set / profile changes, not every sections refetch
  }, [cvSectionIdsSig, mode, profileId]);

  /** When section row order changes on the server (e.g. after refresh), adopt it unless the user is mid-edit. */
  useEffect(() => {
    if (mode !== 'dashboard' || reorderPending || dirty) return;
    const server = previewOrderFromSections(existingSections);
    if (server.length === 0) return;
    setPreviewSectionOrder((prev) => {
      if (prev.join('|') === server.join('|')) return prev;
      lastConfirmedPreviewOrderRef.current = server;
      const pid = profileId?.trim();
      if (pid) writeStoredPreviewSectionOrder(pid, server);
      return server;
    });
  }, [cvSectionRowsSig, dirty, existingSections, mode, profileId, reorderPending]);

  useEffect(() => {
    onReorderPendingChange?.(reorderPending);
  }, [onReorderPendingChange, reorderPending]);

  useEffect(() => {
    if (reorderPending) return;
    lastConfirmedPreviewOrderRef.current = previewOrderFromSections(existingSections);
  }, [existingSections, reorderPending]);

  const setHeaderPreview = useCallback(
    (patch: Partial<HeaderPreviewSettings>) => {
      setHeaderPreviewState((prev) => {
        const next = { ...prev, ...patch };
        writeHeaderPreviewStorage(profileId ?? null, next);
        return next;
      });
    },
    [profileId],
  );

  const optionalSectionPresence = useMemo(
    () => new Set(existingSections.map((s) => s.type.toLowerCase())),
    [existingSections],
  );

  /** Tracks types that were already present on a previous render — only seed when a NEW type appears. */
  const previousOptionalPresenceRef = useRef<Set<string> | null>(null);
  /** Marks a type as already-seeded so we never re-create empty rows after the user deletes them. */
  const optionalSeedDoneRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    optionalSeedDoneRef.current = new Set();
    previousOptionalPresenceRef.current = null;
  }, [profileId]);

  useEffect(() => {
    if (mode !== 'dashboard') return;
    const previous = previousOptionalPresenceRef.current;
    /** First pass after profile load: don't seed; just remember what's already present so user-deletes stay deleted. */
    if (previous === null) {
      previousOptionalPresenceRef.current = new Set(optionalSectionPresence);
      for (const t of optionalSectionPresence)
        optionalSeedDoneRef.current.add(t);
      return;
    }
    /** Find genuinely new types (added by user via "Sections" modal, not present before). */
    const newlyAdded: string[] = [];
    for (const t of optionalSectionPresence) {
      if (!previous.has(t) && !optionalSeedDoneRef.current.has(t))
        newlyAdded.push(t);
    }
    previousOptionalPresenceRef.current = new Set(optionalSectionPresence);
    if (newlyAdded.length === 0) return;

    pushUndoSnapshot(dataRef.current, 'Section Update');
    setData((prev) => {
      let next = prev;
      let changed = false;
      const touch = (): CVBuilderData => {
        if (!changed) {
          next = { ...prev };
          changed = true;
        }
        return next;
      };
      const seedNew = (type: string, hasRows: boolean, apply: () => void) => {
        if (!newlyAdded.includes(type) || hasRows) return;
        optionalSeedDoneRef.current.add(type);
        apply();
      };

      seedNew('certifications', prev.certifications.length > 0, () => {
        const n = touch();
        n.certifications = [
          { id: newLocalId(), name: '', issuer: '', date: '', url: '' },
        ];
      });
      seedNew('projects', prev.projects.length > 0, () => {
        const n = touch();
        n.projects = [
          {
            id: newLocalId(),
            name: '',
            description: '',
            technologies: [],
            url: '',
            bullets: '',
          },
        ];
      });
      seedNew('languages', prev.languages.length > 0, () => {
        const n = touch();
        n.languages = [
          { id: newLocalId(), language: '', proficiency: '' },
        ];
      });
      seedNew('achievements', prev.achievements.length > 0, () => {
        const n = touch();
        n.achievements = [
          { id: newLocalId(), title: '', issuer: '', date: '', detail: '' },
        ];
      });
      seedNew('references', filterCvBuilderReferences(prev.references).length > 0, () => {
        const n = touch();
        n.references = [
          {
            id: newLocalId(),
            name: '',
            title: '',
            company: '',
            email: '',
            phone: '',
          },
        ];
      });

      return changed ? next : prev;
    });
  }, [mode, optionalSectionPresence, pushUndoSnapshot]);

  /** Drop importer "available upon request" placeholder rows so they never duplicate real references. */
  useEffect(() => {
    setData((prev) => {
      const cleanedRefs = filterCvBuilderReferences(prev.references);
      const cleanedParsed = filterParsedCustomSectionsForEditor(prev.parsedCustomSections);
      const refsSame =
        cleanedRefs.length === prev.references.length &&
        cleanedRefs.every((r, i) => r.id === prev.references[i]?.id);
      const parsedSame =
        cleanedParsed.length === prev.parsedCustomSections.length &&
        cleanedParsed.every((b, i) => b.sectionId === prev.parsedCustomSections[i]?.sectionId);
      if (refsSame && parsedSame) return prev;
      return {
        ...prev,
        references: cleanedRefs,
        parsedCustomSections: cleanedParsed,
      };
    });
  }, [profileId]);

  const runCvAssistantWithTarget = useCallback(
    async (
      command: string,
      clarifications?: Array<{ question: string; answer: string }>,
      explicitSectionKey?: string,
    ): Promise<CvAssistantRunResult> => {
      if (!cvAssistantCommand) return 'skipped';
      const key = explicitSectionKey ?? focusedPreviewSection ?? activeSection;
      const targetSection = assistantTargetSectionFromAccordionKey(
        key,
        sectionsRef.current,
      );
      return cvAssistantCommand(command, clarifications, targetSection);
    },
    [cvAssistantCommand, focusedPreviewSection, activeSection],
  );

  const lastBulkSpellTriggerRef = useRef(0);
  const lastSpellFixAllTriggerRef = useRef(0);
  const spellIssuesByFieldRef = useRef(spellIssuesByField);
  spellIssuesByFieldRef.current = spellIssuesByField;
  const spellIssueEntriesBySectionRef = useRef(spellIssueEntriesBySection);
  spellIssueEntriesBySectionRef.current = spellIssueEntriesBySection;
  const sectionKeyToRowId = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of existingSections) {
      const k = accordionKeyFromSection(s);
      if (k) out[k] = s.id;
    }
    return out;
  }, [existingSections]);
  const sectionRowIdToKey = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, id] of Object.entries(sectionKeyToRowId)) out[id] = k;
    return out;
  }, [sectionKeyToRowId]);

  const sectionsMergeKey = useMemo(
    () =>
      existingSections
        .map((s) => `${s.id}:${s.type}:${s.order}:${s.hidden === true ? 1 : 0}`)
        .join('|'),
    [existingSections],
  );

  const initialDataMergeRef = useRef(initialData);
  initialDataMergeRef.current = initialData;

  useEffect(() => {
    if (mode !== 'dashboard') return;
    const incoming = initialDataMergeRef.current;
    if (!incoming) return;
    setData((prev) => mergeNewSectionsIntoData(prev, incoming));
  }, [mode, sectionsMergeKey]);

  useEffect(() => {
    if (mode !== 'dashboard') return;
    if (!existingSections || existingSections.length === 0) return;
    const currentTypes = new Set(existingSections.map((s) => s.type));
    const newTypes = [...currentTypes].filter((t) => !knownSectionTypes.has(t));
    if (newTypes.length > 0) {
      setKnownSectionTypes(currentTypes);
    }

    const freshData = transformSectionsToCVBuilderData(null, existingSections, {
      email: data.personal.email,
      name: data.personal.name,
    });

    setData((prevData) => {
      const next: CVBuilderData = { ...prevData };

      if (
        currentTypes.has('certifications') &&
        prevData.certifications.length === 0
      ) {
        next.certifications =
          freshData.certifications.length > 0
            ? freshData.certifications
            : [{ id: newLocalId(), name: '', issuer: '', date: '', url: '' }];
      }
      if (currentTypes.has('languages') && prevData.languages.length === 0) {
        next.languages =
          freshData.languages.length > 0
            ? freshData.languages
            : [{ id: newLocalId(), language: '', proficiency: '' }];
      }
      if (currentTypes.has('projects') && prevData.projects.length === 0) {
        next.projects =
          freshData.projects.length > 0
            ? freshData.projects
            : [
                {
                  id: newLocalId(),
                  name: '',
                  description: '',
                  technologies: [],
                  url: '',
                  bullets: '',
                },
              ];
      }
      if (
        currentTypes.has('achievements') &&
        prevData.achievements.length === 0
      ) {
        next.achievements =
          freshData.achievements.length > 0
            ? freshData.achievements
            : [
                {
                  id: newLocalId(),
                  title: '',
                  issuer: '',
                  date: '',
                  detail: '',
                },
              ];
      }
      if (currentTypes.has('references') && prevData.references.length === 0) {
        next.references =
          freshData.references.length > 0
            ? freshData.references
            : [
                {
                  id: newLocalId(),
                  name: '',
                  title: '',
                  company: '',
                  email: '',
                  phone: '',
                },
              ];
      }

      const customSlugSections = existingSections.filter((s) =>
        s.type.startsWith('custom_'),
      );
      const prevParsedIds = new Set(prevData.parsedCustomSections.map((b) => b.sectionId));
      const newCustomRows = customSlugSections.filter((s) => !prevParsedIds.has(s.id));
      if (newCustomRows.length > 0) {
        const added = newCustomRows.map((s) => {
          const d = (s.data ?? {}) as Record<string, unknown>;
          const titleFromData =
            typeof d.title === 'string' && d.title.trim() ? d.title.trim() : '';
          const title =
            titleFromData ||
            s.type
              .replace(/^custom_?/i, '')
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase()) ||
            'Custom section';
          return {
            sectionId: s.id,
            sectionType: s.type,
            title,
            items: [{ id: newLocalId(), text: '', subItems: [] }],
          };
        });
        next.parsedCustomSections = [...prevData.parsedCustomSections, ...added];
        next.customSections = [];
      }

      return next;
    });
  }, [
    existingSections,
    mode,
    knownSectionTypes,
    data.personal.email,
    data.personal.name,
  ]);

  const sectionsVisibilityFingerprint = useMemo(
    () =>
      existingSections
        .map((s) => `${s.id}:${s.type}:${s.hidden === true ? 1 : 0}`)
        .join('|'),
    [existingSections],
  );

  useEffect(() => {
    if (mode !== 'dashboard') return;
    const list = sectionsRef.current;
    if (list.length === 0) return;
    const next: Record<string, boolean> = {};
    /**
     * Core sections (Summary, Experience, Education, Skills) are not user-deletable. They
     * are forced visible regardless of any backend `visible:false` flag on legacy rows so
     * the preview always renders them — this is what removed the buggy hide path the user
     * complained about.
     */
    for (const core of ['summary', 'experience', 'education', 'projects', 'skills']) {
      next[core] = true;
    }
    /**
     * Optional sections default to hidden when the row isn't present in the list. The
     * `includeHidden=true` list will override this with the actual `s.hidden` flag below.
     */
    for (const opt of [
      'projects',
      'certifications',
      'achievements',
      'languages',
      'references',
    ]) {
      next[opt] = false;
    }
    for (const s of list) {
      const key = accordionKeyFromSection(s);
      if (!key) continue;
      // Core sections always stay visible; ignore any stray hidden flag persisted earlier.
      if (
        key === 'summary' ||
        key === 'experience' ||
        key === 'education' ||
        key === 'skills'
      ) {
        next[key] = true;
        continue;
      }
      next[key] = s.hidden !== true;
    }
    setSectionVisibility(next);
  }, [mode, sectionsVisibilityFingerprint]);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  useLayoutEffect(() => {
    if (mode !== 'dashboard' || !editorExpanded) return;
    const id = requestAnimationFrame(() => setPortalFlip((f) => f + 1));
    return () => cancelAnimationFrame(id);
  }, [editorExpanded, mode]);

  const template = selectedTemplate;
  const showIntlFields =
    TEMPLATE_FIELD_CONFIG.showInternationalPersonalFields.includes(
      template as CvTemplateId,
    );
  const showPhotoUpload = TEMPLATE_FIELD_CONFIG.showPhotoUpload.includes(
    template as CvTemplateId,
  );
  const showHobbies = TEMPLATE_FIELD_CONFIG.showHobbies.includes(
    template as CvTemplateId,
  );
  const showReferences = TEMPLATE_FIELD_CONFIG.showReferences.includes(
    template as CvTemplateId,
  );
  const showCefr = TEMPLATE_FIELD_CONFIG.showCefrLanguageBreakdown.includes(
    template as CvTemplateId,
  );

  const prevTemplateForPhotoRef = useRef(selectedTemplate);
  useEffect(() => {
    const prev = prevTemplateForPhotoRef.current;
    prevTemplateForPhotoRef.current = selectedTemplate;
    if (prev === selectedTemplate) return;
    const leftOnyx = prev === 'onyx' && selectedTemplate !== 'onyx';
    if (!leftOnyx && selectedTemplate !== 'onyx') {
      setHeaderPreviewState((hp) =>
        hp.showPhoto ? { ...hp, showPhoto: false } : hp,
      );
    }
    if (leftOnyx || (selectedTemplate !== 'onyx' && dataRef.current.personal.photoUrl?.trim())) {
      setHeaderPreviewState((hp) => ({ ...hp, showPhoto: false }));
      pushUndoSnapshot(dataRef.current, 'Template change');
      setData((d) =>
        d.personal.photoUrl?.trim()
          ? { ...d, personal: { ...d.personal, photoUrl: '' } }
          : d,
      );
    }
  }, [selectedTemplate, pushUndoSnapshot]);

  const onSplitResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const row = splitRowRef.current;
      if (!row) return;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startPct = editorWidthPctRef.current;
      let ended = false;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const w = row.getBoundingClientRect().width;
        if (w < 64) return;
        const next = clampCvSplitPct(
          startPct + ((ev.clientX - startX) / w) * 100,
        );
        setEditorWidthPct(next);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId || ended) return;
        ended = true;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        try {
          window.localStorage.setItem(
            CV_SPLIT_STORAGE_KEY,
            String(clampCvSplitPct(editorWidthPctRef.current)),
          );
        } catch {
          /* ignore */
        }
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [],
  );

  const onSplitHandleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const d = CV_SPLIT_DEFAULT_PCT;
      setEditorWidthPct(d);
      editorWidthPctRef.current = d;
      try {
        window.localStorage.setItem(CV_SPLIT_STORAGE_KEY, String(d));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const update = useCallback(
    (patch: Partial<CVBuilderData> | ((d: CVBuilderData) => CVBuilderData)) => {
      const current = dataRef.current;
      const next =
        typeof patch === 'function'
          ? patch(current)
          : ({ ...current, ...patch } as CVBuilderData);
      if (computeCvUndoFingerprint(next) === computeCvUndoFingerprint(current)) {
        return;
      }
      if (!undoCoalesceOpenRef.current) {
        pushUndoSnapshot(current, 'Edit');
        undoCoalesceOpenRef.current = true;
      }
      clearUndoCoalesce();
      setDirty(true);
      setData(next);
    },
    [pushUndoSnapshot, clearUndoCoalesce],
  );

  const mergeDeep = useCallback((base: unknown, patch: unknown): unknown => {
    /** Partial API snapshots must not replace populated CV arrays with `[]`. */
    if (Array.isArray(base) && Array.isArray(patch)) {
      if (patch.length === 0 && base.length > 0) return base;
      return patch;
    }
    if (
      base &&
      typeof base === 'object' &&
      patch &&
      typeof patch === 'object'
    ) {
      const out: Record<string, unknown> = {
        ...(base as Record<string, unknown>),
      };
      for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
        out[k] = mergeDeep((out as Record<string, unknown>)[k], v);
      }
      return out;
    }
    return patch ?? base;
  }, []);

  const initialDataForServerHydrateRef = useRef(initialData);
  initialDataForServerHydrateRef.current = initialData;
  const lastServerHydrateNonceRef = useRef(0);
  const lastForceServerHydrateNonceRef = useRef(0);

  const applyServerHydrateFromInitialData = useCallback(
    (nonce: number, reason: 'hydrate' | 'force') => {
      const t0 = performance.now();
      const snap =
        initialDataForServerHydrateRef.current ??
        emptyCVBuilderData({ email: emailDefault, name: user?.name });
      const preserveHistory = serverHydratePreserveHistoryRef?.current === true;
      if (serverHydratePreserveHistoryRef) {
        serverHydratePreserveHistoryRef.current = false;
      }
      if (preserveHistory && dirtyRef.current) {
        logCvBuilderSavePerfDev('hydrate.skipDirty', t0, {
          nonce,
          reason,
          preserveHistory,
        });
        return;
      }
      setData(coerceStructuredTextInCvBuilderData(snap));
      setDirty(false);
      if (!preserveHistory) {
        resetUndoStack();
      }
      lastPersistedFingerprintRef.current = computeCvBuilderSaveFingerprint(
        snap,
        selectedTemplate,
        sectionsRef.current,
      );
      setSaveStatus('idle');
      logCvBuilderSavePerfDev('hydrate.apply', t0, { nonce, reason, preserveHistory });
    },
    [
      emailDefault,
      user?.name,
      selectedTemplate,
      sectionsRef,
      resetUndoStack,
      serverHydratePreserveHistoryRef,
    ],
  );

  const handleImmediateSectionPatch = useCallback(
    (sections: CvAcceptUpdatedSection[]) => {
      if (!sections.length) return;
      if (undoCoalesceTimerRef.current != null) {
        window.clearTimeout(undoCoalesceTimerRef.current);
        undoCoalesceTimerRef.current = null;
      }
      undoCoalesceOpenRef.current = false;
      const sectionLabel = sections[0]?.type ?? 'section';
      const next = applyAcceptedSectionsToBuilderData(
        dataRef.current,
        sections,
        sectionsRef.current ?? [],
      );
      pushUndoSnapshotForced(dataRef.current, `AI Accept: ${sectionLabel}`);
      dataRef.current = next;
      setData(next);
      setDataRevision((n) => n + 1);
    },
    [pushUndoSnapshotForced],
  );

  useEffect(() => {
    onImmediateSectionPatchReady?.(handleImmediateSectionPatch);
  }, [handleImmediateSectionPatch, onImmediateSectionPatchReady]);

  useEffect(() => {
    if (mode !== 'dashboard') return;
    if (
      !serverHydrateNonce ||
      serverHydrateNonce === lastServerHydrateNonceRef.current
    )
      return;
    /** Tailor: skip apply while typing; consume nonce so a later dirty=false does not clobber edits. */
    if (isTailorView && dirty) {
      lastServerHydrateNonceRef.current = serverHydrateNonce;
      return;
    }
    lastServerHydrateNonceRef.current = serverHydrateNonce;
    applyServerHydrateFromInitialData(serverHydrateNonce, 'hydrate');
  }, [
    mode,
    serverHydrateNonce,
    isTailorView,
    dirty,
    applyServerHydrateFromInitialData,
  ]);

  useEffect(() => {
    if (mode !== 'dashboard') return;
    if (
      !forceServerHydrateNonce ||
      forceServerHydrateNonce === lastForceServerHydrateNonceRef.current
    )
      return;
    lastForceServerHydrateNonceRef.current = forceServerHydrateNonce;
    lastServerHydrateNonceRef.current = serverHydrateNonce;
    applyServerHydrateFromInitialData(forceServerHydrateNonce, 'force');
  }, [mode, forceServerHydrateNonce, serverHydrateNonce, applyServerHydrateFromInitialData]);

  useEffect(() => {
    if (!externalPatch || externalPatchNonce <= 0) return;
    pushUndoSnapshot(dataRef.current, 'Assistant change');
    setDirty(true);
    setData((prev) => {
      const merged = mergeDeep(prev, externalPatch) as CVBuilderData;
      return coerceStructuredTextInCvBuilderData(merged);
    });
  }, [externalPatch, externalPatchNonce, mergeDeep, pushUndoSnapshot]);

  const rawExperienceItems = data.experience?.items;
  const experienceItems = Array.isArray(rawExperienceItems)
    ? rawExperienceItems
    : [];
  const rawEducationItems = data.education?.items;
  const educationItems = Array.isArray(rawEducationItems)
    ? rawEducationItems
    : [];
  const rawSkillCategories = data.skills?.categories;
  const skillCategories = Array.isArray(rawSkillCategories)
    ? rawSkillCategories
    : [];

  const sectionDone = useMemo(() => {
    const hasExp = experienceItems.some(
      (x) => x.title.trim() && x.company.trim(),
    );
    const hasSkills = skillCategories.some((c) =>
      (Array.isArray(c.skills) ? c.skills : []).some((s) => s.trim()),
    );
    const out: Record<string, boolean> = {
      personal: Boolean(
        data.personal.name.trim() && data.personal.email.trim(),
      ),
      experience: hasExp,
      education: educationItems.some((e) => e.school.trim() || e.degree.trim()),
      skills: hasSkills,
      summary: normalizeText(data.summary?.text as unknown).trim().length > 40,
      projects:
        !optionalSectionPresence.has('projects') ||
        data.projects.some((p) => p.name.trim()),
      achievements:
        !optionalSectionPresence.has('achievements') ||
        data.achievements.some((a) => a.title.trim() || a.issuer.trim()),
      certifications:
        !optionalSectionPresence.has('certifications') ||
        data.certifications.some(
          (c) => c.name.trim() && (c.issuer.trim() || c.date.trim()),
        ),
      languages:
        !optionalSectionPresence.has('languages') ||
        data.languages.some((l) => l.language.trim()),
      references:
        !optionalSectionPresence.has('references') ||
        !showReferences ||
        data.references.some(
          (r) =>
            r.name.trim() ||
            r.title.trim() ||
            r.company.trim() ||
            r.email.trim() ||
            r.phone.trim(),
        ),
      // Legacy placeholder row should never drive "incomplete" chips.
      'custom-legacy': true,
    };
    for (const b of data.parsedCustomSections) {
      out[`parsed-${b.sectionId}`] = b.items.some(
        (i) => i.text.trim() || i.subItems.length > 0,
      );
    }
    return out;
  }, [
    data,
    educationItems,
    experienceItems,
    optionalSectionPresence,
    showReferences,
    skillCategories,
  ]);

  /** Sections the user has explicitly deleted from the preview — they should NOT be counted as incomplete. */
  const [hiddenSectionIds, setHiddenSectionIds] = useState<Set<string>>(
    new Set(),
  );
  useEffect(() => {
    setHiddenSectionIds(new Set());
  }, [profileId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHide = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { sectionId?: string }
        | undefined;
      const id = detail?.sectionId?.trim();
      if (!id) return;
      /**
       * Core sections (Summary, Experience, Education, Skills) are not user-deletable.
       * The preview's trash button is hidden for these ids; if a stale event still arrives
       * (e.g. from a cached UI), ignore it so we don't toggle visibility unintentionally.
       */
      const lowered = id.toLowerCase();
      const isCoreId =
        lowered === 'summary' ||
        lowered === 'experience' ||
        lowered === 'education' ||
        lowered === 'skills';
      if (isCoreId) return;
      setHiddenSectionIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // Persist hide/delete across refresh/devices when section row exists.
      let rowId: string | undefined = sectionKeyToRowId[id];
      if (!rowId) {
        const hit = sectionsRef.current.find((s) => {
          const key = accordionKeyFromSection(s)?.toLowerCase();
          const type = s.type.toLowerCase();
          return (
            key === lowered || type === lowered || type === `custom_${lowered}`
          );
        });
        rowId = hit?.id;
      }
      if (rowId && profileId?.trim()) {
        const row = sectionsRef.current.find((s) => s.id === rowId);
        const t = row?.type?.toLowerCase() ?? '';
        // Defensive: if somehow a core row is matched here, do not hide it.
        if (
          t === 'summary' ||
          t === 'experience' ||
          t === 'education' ||
          t === 'skills'
        )
          return;
        void api.cv
          .removeSection(rowId, profileId)
          .then(async () => {
            const row = sectionsRef.current.find((s) => s.id === rowId);
            const d = (row?.data ?? {}) as Record<string, unknown>;
            const label =
              (typeof d.title === 'string' && d.title.trim()) ||
              row?.type
                ?.replace(/^custom_?/i, '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase()) ||
              id;
            toastRef.current?.success(`${label} removed from your resume`);
            await refreshCvState(queryClient, profileId, {
              refreshProfile: true,
              refreshSections: true,
            });
          })
          .catch((e) => {
            try {
              toastRef.current?.error(
                getApiErrorMessage(e) || 'Failed to delete section',
              );
            } catch {
              /* noop */
            }
          });
      }
    };
    const onShow = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { sectionId?: string }
        | undefined;
      const id = detail?.sectionId?.trim();
      if (!id) return;
      setHiddenSectionIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
    window.addEventListener('cv:section-hidden', onHide as EventListener);
    window.addEventListener('cv:section-shown', onShow as EventListener);
    return () => {
      window.removeEventListener('cv:section-hidden', onHide as EventListener);
      window.removeEventListener('cv:section-shown', onShow as EventListener);
    };
  }, [profileId, queryClient, sectionKeyToRowId]);

  const sectionLabelMap = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {
      personal: 'Personal',
      summary: 'Summary',
      experience: 'Work experience',
      education: 'Education',
      skills: 'Skills',
      projects: 'Projects',
      achievements: 'Achievements',
      certifications: 'Certifications',
      languages: 'Languages',
      references: 'References',
      'custom-legacy': 'Custom section',
    };
    for (const b of data.parsedCustomSections) {
      out[`parsed-${b.sectionId}`] =
        (b.title || 'Custom section').trim() || 'Custom section';
    }
    return out;
  }, [data.parsedCustomSections]);

  const missingFields = useMemo<CVBuilderMissingField[]>(() => {
    const out: CVBuilderMissingField[] = [];
    const push = (
      sectionKey: string,
      fieldPath: string,
      fieldLabel: string,
    ) => {
      if (hiddenSectionIds.has(sectionKey)) return;
      out.push({
        sectionKey,
        sectionLabel: sectionLabelMap[sectionKey] ?? sectionKey,
        fieldPath,
        fieldLabel,
      });
    };

    if (!data.personal.name.trim()) push('personal', 'name', 'Full name');
    if (!data.personal.email.trim()) push('personal', 'email', 'Email');
    if (normalizeText(data.summary?.text as unknown).trim().length <= 40)
      push('summary', 'text', 'Summary (write at least a sentence)');
    if (!experienceItems.some((x) => x.title.trim() && x.company.trim())) {
      push('experience', 'items', 'Add at least one role with title + company');
    }
    if (!educationItems.some((e) => e.school.trim() || e.degree.trim())) {
      push('education', 'items', 'Add at least one school or degree');
    }
    if (!skillCategories.some((c) => c.skills.some((s) => s.trim()))) {
      push('skills', 'categories', 'Add at least one skill');
    }
    if (
      optionalSectionPresence.has('projects') &&
      !data.projects.some((p) => p.name.trim())
    ) {
      push('projects', 'items', 'Add at least one project name');
    }
    if (
      optionalSectionPresence.has('achievements') &&
      !data.achievements.some((a) => a.title.trim() || a.issuer.trim())
    ) {
      push('achievements', 'items', 'Add at least one achievement');
    }
    if (
      optionalSectionPresence.has('certifications') &&
      !data.certifications.some(
        (c) => c.name.trim() && (c.issuer.trim() || c.date.trim()),
      )
    ) {
      push(
        'certifications',
        'items',
        'Add at least one certification with issuer or date',
      );
    }
    if (
      optionalSectionPresence.has('languages') &&
      !data.languages.some((l) => l.language.trim())
    ) {
      push('languages', 'items', 'Add at least one language');
    }
    if (
      optionalSectionPresence.has('references') &&
      showReferences &&
      !data.references.some(
        (r) =>
          r.name.trim() ||
          r.title.trim() ||
          r.company.trim() ||
          r.email.trim() ||
          r.phone.trim(),
      )
    ) {
      push('references', 'items', 'Add at least one reference contact');
    }
    return out;
  }, [
    data,
    educationItems,
    experienceItems,
    hiddenSectionIds,
    optionalSectionPresence,
    sectionLabelMap,
    showReferences,
    skillCategories,
  ]);

  const incompleteSectionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [sid, done] of Object.entries(sectionDone)) {
      if (!done && !hiddenSectionIds.has(sid)) ids.add(sid);
    }
    return ids;
  }, [hiddenSectionIds, sectionDone]);

  /** Stable keys so parent qualitySignals effect does not run on every keystroke (missingFields / Sets get new refs each render). */
  const incompleteSectionIdsKey = useMemo(
    () => [...incompleteSectionIds].sort().join(','),
    [incompleteSectionIds],
  );

  const previewIncompleteSectionIds = useMemo(() => {
    if (!deferIncompletePreviewBadgesResolved || allowIncompletePreviewBadges)
      return incompleteSectionIds;
    return EMPTY_INCOMPLETE_SECTION_IDS;
  }, [
    allowIncompletePreviewBadges,
    deferIncompletePreviewBadgesResolved,
    incompleteSectionIds,
  ]);
  const missingFieldsKey = useMemo(
    () =>
      missingFields
        .map((m) => `${m.sectionKey}:${m.fieldPath}`)
        .sort()
        .join('|'),
    [missingFields],
  );

  const onApplySpellIssue = useCallback(
    (issue: CvSpellIssue) => {
      void (async () => {
        const pid = profileId?.trim();
        if (!pid) {
          toast.error('Save your resume first.');
          return;
        }
        const sectionKey = issue.sectionId;
        const sectionUuid = sectionKeyToRowId[sectionKey];
        if (!sectionUuid) {
          toast.error('Section not ready. Try again after the profile loads.');
          return;
        }
        const fieldPath = (issue.fieldPath ?? 'text').trim() || 'text';
        const issueId = (issue.issueId ?? issue.id)?.trim();
        if (!issueId) {
          toast.error('Missing issue id. Run Check spelling again.');
          return;
        }
        const sourceTextHash = issue.sourceTextHash?.trim();
        if (!sourceTextHash) {
          toast.error('Run Check spelling again, then apply.');
          return;
        }
        const start = issue.start;
        const end = issue.end;
        if (typeof start !== 'number' || typeof end !== 'number') {
          toast.error(
            'This suggestion cannot be applied automatically. Edit the text manually.',
          );
          return;
        }
        const suggestion = (
          issue.suggestion ??
          issue.suggestions?.[0] ??
          ''
        ).trim();
        if (!suggestion) {
          toast.error('No suggestion available.');
          return;
        }

        const mergeSpellField = (mapped: CvSpellIssue[]) => {
          const key = `${sectionKey}::${fieldPath}`;
          const nextByField = {
            ...spellIssuesByFieldRef.current,
            [key]: mapped,
          };
          const agg = spellAggregatesFromByField(nextByField);
          setSpellIssuesByField(nextByField);
          setSpellIssueEntriesBySection(agg.spellIssueEntriesBySection);
          setSpellIssuesBySection(agg.spellIssuesBySection);
        };

        const runApply = (forceRefresh: boolean) =>
          api.cv.applySpellcheck(pid, {
            sectionId: sectionUuid,
            fieldPath,
            text: getCvBuilderSectionFieldText(
              dataRef.current,
              sectionKey,
              fieldPath,
            ),
            issueId,
            sourceTextHash,
            start,
            end,
            suggestion,
            forceRefresh,
          });

        try {
          pushUndoSnapshot(dataRef.current, 'Spellcheck apply');
          const result = await runApply(false);
          const appliedText = result.text;
          if (typeof appliedText === 'string') {
            setData((prev) =>
              setCvBuilderSectionFieldText(
                prev,
                sectionKey,
                fieldPath,
                appliedText,
              ),
            );
            setDirty(true);
          } else if (result.alreadyApplied !== true) {
            setData((prev) => {
              const cur = getCvBuilderSectionFieldText(
                prev,
                sectionKey,
                fieldPath,
              );
              const merged = cur.slice(0, start) + suggestion + cur.slice(end);
              return setCvBuilderSectionFieldText(
                prev,
                sectionKey,
                fieldPath,
                merged,
              );
            });
            setDirty(true);
          }
          const mapped = result.issues.map((i) => ({
            ...i,
            sectionId: sectionKey,
            fieldPath: i.fieldPath ?? fieldPath,
          }));
          mergeSpellField(mapped);
        } catch (e) {
          if (axios.isAxiosError(e) && e.response?.status === 409) {
            try {
              const refreshed = await runApply(true);
              const mapped = refreshed.issues.map((i) => ({
                ...i,
                sectionId: sectionKey,
                fieldPath: i.fieldPath ?? fieldPath,
              }));
              mergeSpellField(mapped);
              toast.info(
                'Underlines were refreshed; the text changed since the last spell check.',
              );
              return;
            } catch {
              toast.error(
                'Your edits conflict with the spell checker. Run Check spelling again.',
              );
              return;
            }
          }
          toast.error(getApiErrorMessage(e) || 'Could not apply suggestion');
        }
      })();
    },
    [profileId, pushUndoSnapshot, sectionKeyToRowId, toast],
  );

  const onDismissSpellIssue = useCallback((issue: CvSpellIssue) => {
    const issueKey = (issue.issueId ?? issue.id)?.trim();
    const sid = issue.sectionId;
    const fp = issue.fieldPath ?? 'text';
    const composite = `${sid}::${fp}`;
    const prevBy = spellIssuesByFieldRef.current;
    const rest = (prevBy[composite] ?? []).filter((x) => {
      const k = (x.issueId ?? x.id)?.trim();
      return issueKey ? k !== issueKey : x !== issue;
    });
    const nextByField = { ...prevBy, [composite]: rest };
    if (!rest.length) delete nextByField[composite];
    const agg = spellAggregatesFromByField(nextByField);
    setSpellIssuesByField(nextByField);
    setSpellIssueEntriesBySection(agg.spellIssueEntriesBySection);
    setSpellIssuesBySection(agg.spellIssuesBySection);
  }, []);

  /** Bridge right-panel button events to the local apply/dismiss handlers without lifting state. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onApply = (e: Event) => {
      const issue = (e as CustomEvent).detail?.issue as
        | CvSpellIssue
        | undefined;
      if (issue) onApplySpellIssue(issue);
    };
    const onDismiss = (e: Event) => {
      const issue = (e as CustomEvent).detail?.issue as
        | CvSpellIssue
        | undefined;
      if (issue) onDismissSpellIssue(issue);
    };
    window.addEventListener('cv:spell-issue:apply', onApply as EventListener);
    window.addEventListener(
      'cv:spell-issue:dismiss',
      onDismiss as EventListener,
    );
    return () => {
      window.removeEventListener(
        'cv:spell-issue:apply',
        onApply as EventListener,
      );
      window.removeEventListener(
        'cv:spell-issue:dismiss',
        onDismiss as EventListener,
      );
    };
  }, [onApplySpellIssue, onDismissSpellIssue]);

  const cvEditContextValue = useMemo(
    () => ({
      onUpdate: (patch: Partial<CVBuilderData>) => update(patch),
      isEditing: mode === 'dashboard',
      data,
      dataRevision,
      activeSection,
      setActiveSection,
      focusedSection: focusedPreviewSection,
      setFocusedSection: setFocusedPreviewSection,
      diffSection,
      focusedEntryId,
      setFocusedEntryId,
      focusedEntrySection,
      setFocusedEntrySection,
      headerPreview,
      setHeaderPreview,
      optionalSectionPresence,
      incompleteSectionIds: previewIncompleteSectionIds,
      spellIssuesBySection,
      spellIssueEntriesBySection,
      spellIssuesByField,
      onApplySpellIssue,
      onDismissSpellIssue,
      runCvAssistantCommand: runCvAssistantWithTarget,
      cvAssistantBusy: cvAssistantBusy ?? false,
      cvAssistantBusyMessage: cvAssistantBusyMessage?.trim() || null,
      cvAssistantClarificationQuestion:
        cvAssistantClarificationQuestion ?? null,
      recruiterScanHeatmap: recruiterScanHeatmap ?? null,
      photoUploadEnabled: showPhotoUpload,
    }),
    [
      mode,
      data,
      dataRevision,
      activeSection,
      update,
      focusedPreviewSection,
      diffSection,
      focusedEntryId,
      focusedEntrySection,
      headerPreview,
      setHeaderPreview,
      optionalSectionPresence,
      previewIncompleteSectionIds,
      spellIssuesBySection,
      spellIssueEntriesBySection,
      spellIssuesByField,
      onApplySpellIssue,
      onDismissSpellIssue,
      runCvAssistantWithTarget,
      cvAssistantBusy,
      cvAssistantBusyMessage,
      cvAssistantClarificationQuestion,
      recruiterScanHeatmap,
      showPhotoUpload,
    ],
  );

  const toggleSectionVisibility = useCallback(
    async (accordionId: string) => {
      /**
       * Core sections (Summary, Experience, Education, Skills) are not user-hideable. The
       * eye toggle is rendered as always-visible for these ids; ignore the click so we
       * never write `visible:false` on a core row.
       */
      if (
        accordionId === 'summary' ||
        accordionId === 'experience' ||
        accordionId === 'education' ||
        accordionId === 'skills'
      ) {
        return;
      }
      const prevVisible = sectionVisibility[accordionId] !== false;
      const nextVisible = !prevVisible;
      setSectionVisibility((m) => ({ ...m, [accordionId]: nextVisible }));

      if (mode !== 'dashboard' || !profileId?.trim()) return;

      const sec = resolveSectionForAccordion(accordionId, sectionsRef.current);
      if (!sec?.id?.trim()) return;

      setVisibilityPendingAccordion(accordionId);
      try {
        await api.cv.updateSection(sec.id, { visible: nextVisible }, profileId);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.cv.score(profileId),
          exact: true,
        });
        void queryClient.invalidateQueries({
          queryKey: cvSuggestionsQueryKey(profileId),
          exact: true,
        });
      } catch {
        setSectionVisibility((m) => ({ ...m, [accordionId]: prevVisible }));
        toast.error('Failed to update section visibility');
      } finally {
        setVisibilityPendingAccordion(null);
      }
    },
    [mode, profileId, queryClient, sectionVisibility, toast],
  );

  const sectionVisibilityUi = useCallback(
    (accordionId: string) => {
      const isCore =
        accordionId === 'summary' ||
        accordionId === 'experience' ||
        accordionId === 'education' ||
        accordionId === 'skills';
      const isVisible = isCore
        ? true
        : sectionVisibility[accordionId] !== false;
      return {
        sectionHiddenStyle: !isVisible,
        visibilityToggle: {
          visible: isVisible,
          busy: visibilityPendingAccordion === accordionId,
          // Core sections cannot be hidden — clicking the eye is a no-op.
          onClick: isCore
            ? (e: React.MouseEvent) => {
                e.stopPropagation();
              }
            : (e: React.MouseEvent) => {
                e.stopPropagation();
                void toggleSectionVisibility(accordionId);
              },
        },
      };
    },
    [sectionVisibility, visibilityPendingAccordion, toggleSectionVisibility],
  );

  const handlePreviewReorderSections = useCallback(
    async (nextOrder: string[]) => {
      const dedupedOrder = dedupePreviewSectionKeys(nextOrder);
      if (mode === 'dashboard') {
        pushUndoSnapshot(dataRef.current, 'Section reorder');
      }
      setPreviewSectionOrder(dedupedOrder);
      if (mode !== 'dashboard' || !profileId) return;

      let allSections = existingSections;
      try {
        /** Reorder payload must include every section id exactly once, including hidden rows. */
        const fetched = await api.cv.getSections(true, profileId);
        /** New profiles can briefly return [] while rows persist in cache — do not wipe local rows. */
        if (fetched.length > 0) {
          allSections = fetched;
        }
      } catch {
        allSections = existingSections;
      }

      if (allSections.length === 0) {
        setPreviewSectionOrder(lastConfirmedPreviewOrderRef.current);
        toast.error(
          'Your resume sections are still loading. Wait a moment, then try reordering again.',
        );
        return;
      }

      const buildOrderedIds = (rows: CVSectionRecord[]): string[] =>
        orderSectionRowIdsByPreviewKeys(rows, dedupedOrder).filter((rowId) =>
          rowId?.trim(),
        );

      let orderedIds = buildOrderedIds(allSections);
      if (orderedIds.length === 0) {
        setPreviewSectionOrder(lastConfirmedPreviewOrderRef.current);
        toast.error(
          'Some sections are missing server IDs. Refresh the page so we can load full section rows (including hidden).',
        );
        return;
      }

      // Partial lists are accepted by the server now (it keeps unlisted rows in place).
      // On a 400 (stale/unknown id after an add or remove), refetch fresh ids and retry once
      // so the user never has to manually refresh before reordering.
      const isUnknownIdError = (e: unknown): boolean =>
        (e as { response?: { status?: number } })?.response?.status === 400;

      try {
        setReorderPending(true);
        let saved: CvReorderSectionsResult;
        try {
          saved = await api.cv.reorderSections(orderedIds, profileId);
        } catch (e) {
          if (!isUnknownIdError(e)) throw e;
          const fresh = await api.cv.getSections(true, profileId);
          if (fresh.length > 0) {
            orderedIds = buildOrderedIds(fresh);
          }
          if (orderedIds.length === 0) throw e;
          saved = await api.cv.reorderSections(orderedIds, profileId);
        }
        const serverOrder = previewOrderFromSections(saved.sections);
        if (serverOrder.length > 0) {
          setPreviewSectionOrder(serverOrder);
          lastConfirmedPreviewOrderRef.current = serverOrder;
          if (profileId?.trim()) {
            writeStoredPreviewSectionOrder(profileId.trim(), serverOrder);
          }
        }
        await refreshCvState(queryClient, profileId, {
          refreshProfile: true,
          refreshSections: true,
        });
        if (saved.sections.length > 0) {
          queryClient.setQueryData(queryKeys.cv.sections(profileId), saved.sections);
        }
        writeSectionOrderBannerDismissed(profileId);
        void queryClient.invalidateQueries({
          queryKey: cvSectionOrderSuggestQueryKey(profileId),
        });
      } catch (e) {
        setPreviewSectionOrder(lastConfirmedPreviewOrderRef.current);
        toast.error(getApiErrorMessage(e));
      } finally {
        setReorderPending(false);
      }
    },
    [existingSections, mode, profileId, pushUndoSnapshot, queryClient, toast],
  );

  const toggleAccordion = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const renderTemplatePills = () =>
    CV_TEMPLATE_IDS.map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => onTemplateChange?.(t)}
        className={cn(
          'rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition',
          template === t
            ? 'bg-[#00C9B1] text-white'
            : 'border border-[rgba(0,201,177,0.3)] text-white/45 hover:border-[#00C9B1]/50',
        )}
      >
        {t}
      </button>
    ));

  const tplPills = (
    <div className="flex flex-wrap gap-2">{renderTemplatePills()}</div>
  );

  const runAiSummary = async () => {
    const title = normalizeText(data.personal.headline as unknown).trim();
    const hasExp = experienceItems.some(
      (x) => x.title.trim() && x.company.trim(),
    );
    const skillStr = skillCategories
      .flatMap((c) => c.skills)
      .filter(Boolean)
      .join(', ');
    if (!title || !hasExp || !skillStr.trim()) {
      toast.error(
        'Add your professional title, at least one job (title + company), and a few skills first — then we can generate your summary.',
      );
      return;
    }
    const expLines = experienceItems
      .filter((x) => x.title.trim() && x.company.trim())
      .slice(0, 4)
      .map((x) => {
        const span = x.current
          ? `${x.startDate}–Present`
          : `${x.startDate}–${x.endDate}`;
        return `${x.title} at ${x.company} (${span})`;
      })
      .join('; ');
    const summaryForApi = [
      `Instructions: produce a 2–3 sentence FIRST-PERSON professional summary. Sound natural and specific; no buzzword soup; do not mention AI.`,
      `Target role / title: ${title}`,
      `Skills: ${skillStr}`,
      `Experience (facts only): ${expLines}`,
      (normalizeText(data.summary?.text as unknown) ?? '').trim()
        ? `Current draft to improve:\n${normalizeText(data.summary?.text as unknown).trim()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim()
      .slice(0, 2000);
    const contextHint = title.slice(0, 100);
    setAiPending('summary');
    try {
      let next: string | undefined;
      try {
        if (summaryForApi.length < 20) {
          toast.error(
            'Add a bit more detail (summary prompt too short for AI).',
          );
          return;
        }
        next = await api.cv.improveSummary({
          summary: summaryForApi,
          context: contextHint,
        });
      } catch {
        const bullet =
          summaryForApi.length >= 10
            ? summaryForApi.slice(0, 500)
            : `${title}. ${skillStr}`.slice(0, 500);
        const variants = await api.cv.rewriteBullet({
          bullet,
          context:
            'Rewrite as a 2–3 sentence first-person CV summary from the facts above.'.slice(
              0,
              100,
            ),
        });
        next = variants[0];
      }
      if (next) {
        const text = next.slice(0, 500);
        if (profileId?.trim()) {
          try {
            await commitAcceptedStructuredDraft({
              queryClient,
              profileId: profileId.trim(),
              mutation: () =>
                api.cv.acceptGeneratorSummary(profileId.trim(), { text }),
              onRehydrated: () => onAiStructuredPersisted?.(),
            });
            toast.success('Summary saved to your resume');
          } catch (e) {
            toast.error(
              getApiErrorMessage(e) || 'Could not save summary. Try again.',
            );
          }
        } else {
          update({ summary: { text } });
          toast.success('Summary updated');
        }
      }
    } catch {
      toast.error('Generation failed — please try again');
    } finally {
      setAiPending(null);
    }
  };

  const runAiBullets = async (jobId: string, bulletText: string) => {
    const trimmed = bulletText.trim();
    if (trimmed.length < 10) {
      toast.error(
        'Write at least 10 characters in this bullet before asking AI to improve it.',
      );
      return null;
    }
    setAiPending(jobId);
    try {
      const variants = await api.cv.rewriteBullet({
        bullet: trimmed,
        context: 'CV achievement bullet',
      });
      const next = variants[0];
      if (!next?.trim()) return null;

      if (profileId?.trim()) {
        const job = experienceItems.find((x) => x.id === jobId);
        if (!job) {
          toast.error('Could not locate this role to save the bullet.');
          return null;
        }
        const itemIdx = experienceItems.findIndex((x) => x.id === jobId);
        if (itemIdx < 0) return null;
        const bulletIdx = job.bullets.length;
        const fieldPath = `experience.items.${itemIdx}.bullets.${bulletIdx}`;
        try {
          await commitAcceptedStructuredDraft({
            queryClient,
            profileId: profileId.trim(),
            mutation: () =>
              api.cv.acceptGeneratorBullet(profileId.trim(), {
                fieldPath,
                text: next.trim(),
              }),
            onRehydrated: () => onAiStructuredPersisted?.(),
          });
          toast.success('Bullet saved to your resume');
          return null;
        } catch (e) {
          toast.error(
            getApiErrorMessage(e) || 'Could not save bullet. Try again.',
          );
          return null;
        }
      }

      toast.success('Suggestion added — review and edit');
      return next;
    } catch {
      toast.error('Generation failed — please try again');
    } finally {
      setAiPending(null);
    }
    return null;
  };

  const canFinishOnboarding = data.personal.name.trim().length > 0;

  const jumpToSection = useCallback(
    (sid: string, itemId?: string, opts?: { scrollForm?: boolean }) => {
      const scrollForm = opts?.scrollForm === true;
      setExpanded((prev) => {
        const n = new Set(prev);
        n.add(sid);
        return n;
      });
      const sectionActive =
        itemId !== undefined && itemId !== '' ? `${sid}::${itemId}` : sid;
      setActiveSection(sectionActive);
      if (mode === 'dashboard') {
        if (itemId !== undefined && itemId !== '') {
          setFocusedPreviewSection(sid);
          setFocusedEntryId(itemId);
          setFocusedEntrySection(sid);
        } else {
          setFocusedPreviewSection(sid);
          setFocusedEntryId(null);
          setFocusedEntrySection(null);
        }
      }
      /** Expand accordion first; preview always scrolls. Form column scrolls only when `scrollForm` (Jump to section chips). */
      const previewElId =
        itemId !== undefined && itemId !== ''
          ? `cv-preview-${sid}-item-${itemId}`
          : `cv-preview-${sid}`;
      const scrollAttempt = (attempt: number) => {
        const previewEl = document.getElementById(previewElId);
        const narrowScroll =
          typeof window !== 'undefined' &&
          window.matchMedia('(max-width: 1023px)').matches;
        if (previewEl) {
          previewEl.scrollIntoView({
            behavior: 'smooth',
            block: narrowScroll ? 'nearest' : 'center',
            inline: 'nearest',
          });
        } else if (attempt < 8) {
          window.setTimeout(() => scrollAttempt(attempt + 1), 70);
        }
        if (scrollForm) {
          const formEl = document.getElementById(`cv-section-${sid}`);
          if (formEl)
            formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      requestAnimationFrame(() =>
        requestAnimationFrame(() => scrollAttempt(0)),
      );
    },
    [mode],
  );

  useEffect(() => {
    onJumpToSectionReady?.(jumpToSection);
  }, [onJumpToSectionReady, jumpToSection]);

  useEffect(() => {
    if (
      !isTailorView ||
      !tailorHighlightSectionId?.trim() ||
      !tailorHighlightNonce
    )
      return;
    const sid = tailorHighlightSectionId.trim();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(sid);
      if (sid.startsWith('experience')) next.add('experience');
      return next;
    });
    setMobileTab('edit');
    jumpToSection(sid, undefined, { scrollForm: true });
    const el = document.getElementById(`cv-section-${sid}`);
    if (!el) return undefined;
    const flashClass =
      tailorHighlightAction === 'reverted'
        ? 'tailor-revert-flash'
        : 'tailor-accept-flash';
    el.classList.add(flashClass);
    const t = window.setTimeout(() => el.classList.remove(flashClass), 2600);
    return () => window.clearTimeout(t);
  }, [
    isTailorView,
    tailorHighlightSectionId,
    tailorHighlightNonce,
    tailorHighlightAction,
    jumpToSection,
  ]);

  useEffect(() => {
    if (
      isTailorView ||
      !assistantAcceptHighlightSectionId?.trim() ||
      !assistantAcceptHighlightNonce
    )
      return;
    const sid = assistantAcceptHighlightSectionId.trim();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(sid);
      if (sid.startsWith('experience')) next.add('experience');
      return next;
    });
    setMobileTab('edit');
    jumpToSection(sid, undefined, { scrollForm: true });
    const el = document.getElementById(`cv-section-${sid}`);
    if (!el) return undefined;
    el.classList.add('cv-assistant-accept-flash');
    const t = window.setTimeout(
      () => el.classList.remove('cv-assistant-accept-flash'),
      650,
    );
    return () => window.clearTimeout(t);
  }, [
    isTailorView,
    assistantAcceptHighlightSectionId,
    assistantAcceptHighlightNonce,
    jumpToSection,
  ]);

  useEffect(() => {
    let spellIssueCount = 0;
    let grammarIssueCount = 0;
    for (const [sectionKey, issues] of Object.entries(
      spellIssueEntriesBySection,
    )) {
      if (hiddenSectionIds.has(sectionKey)) continue;
      for (const issue of issues) {
        if (issue.type === 'grammar' || issue.type === 'style')
          grammarIssueCount += 1;
        else spellIssueCount += 1;
      }
    }
    onQualitySignalsChange?.({
      incompleteSectionIds: [...incompleteSectionIds],
      incompleteCount: incompleteSectionIds.size,
      missingFields,
      sectionLabels: sectionLabelMap,
      spellIssuesBySection,
      spellIssueEntriesBySection,
      spellIssuesByField,
      spellIssueCount,
      grammarIssueCount,
      isSpellChecking,
    });
    // Keys gate parent updates: incompleteSectionIds / missingFields get new refs every render while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hiddenSectionIds,
    incompleteSectionIdsKey,
    isSpellChecking,
    missingFieldsKey,
    onQualitySignalsChange,
    sectionLabelMap,
    spellIssueEntriesBySection,
    spellIssuesByField,
    spellIssuesBySection,
  ]);

  /** Internal: when `silent` is true (auto-run after save), suppress success/limit toasts to avoid noise. */
  const runBulkSpellCheck = useCallback(
    async (opts?: { silent?: boolean; attempt?: number }) => {
      const silent = opts?.silent === true;
      const attempt = opts?.attempt ?? 0;
      if (!profileId?.trim()) {
        setSpellIssuesBySection({});
        setSpellIssueEntriesBySection({});
        setSpellIssuesByField({});
        return;
      }
      setIsSpellChecking(true);
      try {
        const res: CvSpellcheckBulkResult = await api.cv.checkSpellingBulk(
          profileId,
          { language: spellcheckLanguage || 'en' },
        );
        const byField: Record<string, CvSpellIssue[]> = {};
        let total = 0;
        for (const [sectionRowId, entries] of Object.entries(res.results)) {
          const sectionKey = sectionRowIdToKey[sectionRowId] ?? sectionRowId;
          for (const entry of entries) {
            const issues = entry.issues ?? [];
            if (!issues.length) continue;
            total += issues.length;
            byField[`${sectionKey}::${entry.fieldPath}`] = issues.map((i) => ({
              ...i,
              sectionId: sectionKey,
              fieldPath: i.fieldPath ?? entry.fieldPath,
            }));
          }
        }
        const agg = spellAggregatesFromByField(byField);
        setSpellIssuesBySection(agg.spellIssuesBySection);
        setSpellIssueEntriesBySection(agg.spellIssueEntriesBySection);
        setSpellIssuesByField(byField);
        if (!silent) {
          if (total === 0) toast.success('No spelling or grammar issues found');
          else
            toast.success(
              `Found ${total} potential issue${total === 1 ? '' : 's'}`,
            );
        }
      } catch (e) {
        const msg = getApiErrorMessage(e) || 'Spell check failed';
        const transientBusy =
          msg.includes('429') ||
          msg.includes('503') ||
          msg.toLowerCase().includes('temporarily') ||
          msg.toLowerCase().includes('overload') ||
          msg.toLowerCase().includes('busy');
        if (transientBusy && attempt < 2) {
          if (!silent) toast.error('Spellcheck temporarily busy, retrying…');
          window.setTimeout(
            () => {
              void runBulkSpellCheck({ silent, attempt: attempt + 1 });
            },
            1200 * (attempt + 1),
          );
          return;
        }
        if (silent) {
          /** Avoid noisy auto-run failures; user can still retry via "Check spelling". */
          if (typeof console !== 'undefined')
            console.warn('cv:spellcheck:silent-error', msg);
        } else if (msg.includes('403') || msg.includes('404')) {
          toast.error('Profile access error. Please refresh and reselect.');
        } else if (msg.includes('400')) {
          toast.error('Spellcheck request invalid. Please retry.');
        } else {
          toast.error(msg);
        }
      } finally {
        setIsSpellChecking(false);
      }
    },
    [profileId, sectionRowIdToKey, spellcheckLanguage, toast],
  );

  useEffect(() => {
    if (spellCheckTrigger <= 0) return;
    if (lastBulkSpellTriggerRef.current === spellCheckTrigger) return;
    lastBulkSpellTriggerRef.current = spellCheckTrigger;
    void runBulkSpellCheck();
  }, [runBulkSpellCheck, spellCheckTrigger]);

  useEffect(() => {
    if (spellFixAllTrigger <= 0) return;
    if (lastSpellFixAllTriggerRef.current === spellFixAllTrigger) return;
    lastSpellFixAllTriggerRef.current = spellFixAllTrigger;
    const pid = profileId?.trim();
    if (!pid) {
      toast.error('Save your resume first.');
      return;
    }
    const issuesSnapshot = Object.values(
      spellIssueEntriesBySectionRef.current,
    ).flat();
    if (!issuesSnapshot.length) return;
    const applicable = issuesSnapshot.filter(
      (i) =>
        Boolean((i.issueId ?? i.id)?.trim()) &&
        Boolean(i.sourceTextHash?.trim()) &&
        typeof i.start === 'number' &&
        typeof i.end === 'number' &&
        Boolean((i.suggestion ?? i.suggestions?.[0])?.trim()),
    );
    if (!applicable.length) {
      toast.error(
        'No applicable suggestions to fix. Run Check spelling first.',
      );
      return;
    }
    let cancelled = false;
    void (async () => {
      pushUndoSnapshot(dataRef.current, 'Spellcheck apply all');
      let working = dataRef.current;
      let byField = { ...spellIssuesByFieldRef.current };
      const seen = new Set<string>();
      const sorted = [...applicable]
        .filter((i) => {
          const id = (i.issueId ?? i.id)!.trim();
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .sort((a, b) => {
          const fa = `${a.sectionId}::${a.fieldPath ?? 'text'}`;
          const fb = `${b.sectionId}::${b.fieldPath ?? 'text'}`;
          if (fa !== fb) return fa.localeCompare(fb);
          return (b.start ?? 0) - (a.start ?? 0);
        });
      for (const issue of sorted) {
        if (cancelled) return;
        const sectionKey = issue.sectionId;
        const sectionUuid = sectionKeyToRowId[sectionKey];
        if (!sectionUuid) continue;
        const fieldPath = (issue.fieldPath ?? 'text').trim() || 'text';
        const issueId = (issue.issueId ?? issue.id)!.trim();
        const sourceTextHash = issue.sourceTextHash!.trim();
        const start = issue.start!;
        const end = issue.end!;
        const suggestion = (
          issue.suggestion ??
          issue.suggestions?.[0] ??
          ''
        ).trim();
        const key = `${sectionKey}::${fieldPath}`;
        try {
          const text = getCvBuilderSectionFieldText(
            working,
            sectionKey,
            fieldPath,
          );
          const result = await api.cv.applySpellcheck(pid, {
            sectionId: sectionUuid,
            fieldPath,
            text,
            issueId,
            sourceTextHash,
            start,
            end,
            suggestion,
            forceRefresh: false,
          });
          if (typeof result.text === 'string') {
            working = setCvBuilderSectionFieldText(
              working,
              sectionKey,
              fieldPath,
              result.text,
            );
          } else if (result.alreadyApplied !== true) {
            const merged = text.slice(0, start) + suggestion + text.slice(end);
            working = setCvBuilderSectionFieldText(
              working,
              sectionKey,
              fieldPath,
              merged,
            );
          }
          const mapped = result.issues.map((i) => ({
            ...i,
            sectionId: sectionKey,
            fieldPath: i.fieldPath ?? fieldPath,
          }));
          byField = { ...byField, [key]: mapped };
        } catch {
          /* continue with remaining issues */
        }
      }
      if (cancelled) return;
      setData(working);
      setDirty(true);
      const agg = spellAggregatesFromByField(byField);
      setSpellIssuesByField(byField);
      setSpellIssueEntriesBySection(agg.spellIssueEntriesBySection);
      setSpellIssuesBySection(agg.spellIssuesBySection);
      toast.success('Applied spelling suggestions');
    })();
    return () => {
      cancelled = true;
    };
  }, [spellFixAllTrigger, profileId, pushUndoSnapshot, sectionKeyToRowId, toast]);

  const formSectionTabs = useMemo(() => {
    const base: { id: string; label: string }[] = [
      { id: 'personal', label: 'Personal' },
      { id: 'experience', label: 'Experience' },
      { id: 'education', label: 'Education' },
      { id: 'skills', label: 'Skills' },
      { id: 'summary', label: 'Summary' },
    ];
    if (data.projects.length > 0)
      base.push({ id: 'projects', label: 'Projects' });
    base.push({ id: 'achievements', label: 'Achievements' });
    if (data.certifications.length > 0)
      base.push({ id: 'certifications', label: 'Certifications' });
    if (data.languages.length > 0)
      base.push({ id: 'languages', label: 'Languages' });
    if (showReferences) base.push({ id: 'references', label: 'References' });
    for (const b of data.parsedCustomSections) {
      const label = (b.title || 'Custom').trim().slice(0, 28) || 'Custom';
      base.push({ id: `parsed-${b.sectionId}`, label });
    }
    base.push({ id: 'custom-legacy', label: 'More sections' });
    return base;
  }, [
    data.projects.length,
    data.certifications.length,
    data.languages.length,
    data.parsedCustomSections,
    showReferences,
    template,
  ]);

  const jumpSectionScrollRef = useRef<HTMLDivElement>(null);
  const [jumpSectionScrollEdges, setJumpSectionScrollEdges] = useState({
    left: false,
    right: false,
  });

  const syncJumpSectionScrollEdges = useCallback(() => {
    const el = jumpSectionScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const eps = 4;
    setJumpSectionScrollEdges({
      left: scrollLeft > eps,
      right: maxScroll > eps && scrollLeft < maxScroll - eps,
    });
  }, []);

  useLayoutEffect(() => {
    syncJumpSectionScrollEdges();
  }, [syncJumpSectionScrollEdges, formSectionTabs]);

  useEffect(() => {
    const el = jumpSectionScrollRef.current;
    if (!el) return;
    syncJumpSectionScrollEdges();
    const ro = new ResizeObserver(() => syncJumpSectionScrollEdges());
    ro.observe(el);
    el.addEventListener('scroll', syncJumpSectionScrollEdges, {
      passive: true,
    });
    window.addEventListener('resize', syncJumpSectionScrollEdges);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', syncJumpSectionScrollEdges);
      window.removeEventListener('resize', syncJumpSectionScrollEdges);
    };
  }, [syncJumpSectionScrollEdges, formSectionTabs]);

  const scrollJumpSectionStrip = useCallback((dir: -1 | 1) => {
    const el = jumpSectionScrollRef.current;
    if (!el) return;
    const delta = Math.min(
      220,
      Math.max(140, Math.floor(el.clientWidth * 0.65)),
    );
    el.scrollBy({ left: dir * delta, behavior: 'smooth' });
  }, []);

  const jumpTabActive = useCallback(
    (sid: string) =>
      activeSection === sid ||
      (sid === 'experience' &&
        typeof activeSection === 'string' &&
        activeSection.startsWith('experience::')),
    [activeSection],
  );

  void portalFlip;
  const portalHost = dashboardMainRef?.current ?? null;
  const usePortaledExpandedEditor =
    mode === 'dashboard' && editorExpanded && portalHost !== null;

  const leftPanel = (
    <div
      className={cn(
        'flex min-h-0 flex-col bg-[#0C0F0F]',
        showTripleChrome && 'overflow-hidden',
        mode === 'dashboard'
          ? showTripleChrome
            ? 'min-h-0 flex-1'
            : usePortaledExpandedEditor
              ? 'h-full max-h-full min-h-0'
              : editorExpanded
                ? 'max-h-none lg:max-h-[min(88dvh,calc(100dvh-5rem))]'
                : 'max-lg:h-full max-lg:min-h-0 max-lg:flex-1 max-lg:max-h-none max-h-none lg:max-h-[min(92dvh,calc(100dvh-13.5rem))]'
          : 'max-h-[min(78vh,820px)] lg:max-h-[min(calc(100dvh-10rem),960px)]',
      )}
    >
      <div
        className={cn(
          'z-20 shrink-0 border-b border-white/10 bg-[#0C0F0F]/95 px-4 pb-2.5 pt-0 backdrop-blur-md sm:px-5',
          !showTripleChrome && 'sticky top-0',
        )}
      >
        {mode === 'dashboard' ? (
          <div className="mb-2 flex flex-col gap-2 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                <h2 className="shrink-0 text-base font-bold text-white sm:text-[17px]">
                  Edit your resume
                </h2>
                {saveStatus !== 'idle' ? (
                  <p className="text-[10px] text-white/40">
                    {saveStatus === 'saving' ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                      </span>
                    ) : saveStatus === 'saved' ? (
                      <span className="text-[#22C55E]">Saved</span>
                    ) : saveStatus === 'dirty' ? (
                      <span className="text-amber-400/90">Unsaved changes</span>
                    ) : saveStatus === 'error' ? (
                      <span className="text-rose-400/90">
                        Save failed — keep editing or retry
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                title={
                  editorExpanded
                    ? 'Exit expanded editor'
                    : 'Expand editor for more space'
                }
                aria-label={
                  editorExpanded
                    ? 'Exit expanded editor'
                    : 'Expand editor for more space'
                }
                className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(0,201,177,0.25)] bg-white/[0.04] text-white/70 transition hover:border-[#00C9B1]/45 hover:bg-[#00C9B1]/10 hover:text-[#00C9B1]',
                  showTripleChrome && 'hidden',
                )}
                onClick={() => setEditorExpanded((v) => !v)}
              >
                {editorExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className={cn('min-w-0', showTripleChrome && 'hidden')}>
              {dashboardTemplateExtras != null ||
              dashboardTemplateMeta != null ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderTemplatePills()}
                    {dashboardTemplateExtras}
                  </div>
                  {dashboardTemplateMeta}
                </div>
              ) : (
                tplPills
              )}
            </div>
          </div>
        ) : (
          <div className="pt-5" />
        )}

        {mode === 'onboarding' && saveStatus !== 'idle' ? (
          <p className="mb-3 px-1 text-[11px] text-white/40">
            {saveStatus === 'saving' ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            ) : saveStatus === 'saved' ? (
              <span className="text-[#22C55E]">Saved ✓</span>
            ) : saveStatus === 'dirty' ? (
              <span className="text-amber-400/90">Unsaved changes</span>
            ) : saveStatus === 'error' ? (
              <span className="text-rose-400/90">Save failed</span>
            ) : null}
          </p>
        ) : null}

        {mode === 'dashboard' && !showTripleChrome ? (
          <details className="mb-2 group rounded-lg border border-[rgba(0,201,177,0.18)] bg-[rgba(0,201,177,0.06)] px-2.5 py-1.5">
            <summary className="cursor-pointer list-none text-[11px] font-semibold text-[#00C9B1] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1">
                What to fill in first
                <ChevronDown className="h-3.5 w-3.5 shrink-0 transition group-open:rotate-180" />
              </span>
            </summary>
            <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-white/65">
              <span className="text-white">Full name</span> and{' '}
              <span className="text-white">email</span> are required. Add{' '}
              <span className="text-white">experience</span>,{' '}
              <span className="text-white">education</span>, and{' '}
              <span className="text-white">skills</span> before{' '}
              <span className="text-white">Generate summary</span> so AI has
              context.
            </p>
          </details>
        ) : mode !== 'dashboard' ? (
          <div className="mb-3 rounded-xl border border-[rgba(0,201,177,0.22)] bg-[rgba(0,201,177,0.07)] px-3 py-2.5 text-[11px] leading-relaxed text-white/70">
            <span className="font-semibold text-[#00C9B1]">
              What to fill in
            </span>
            {' — '}
            <span className="text-white">Full name</span> and{' '}
            <span className="text-white">email</span> are required to finish.
            Fill <span className="text-white">experience</span>,{' '}
            <span className="text-white">education</span>, and{' '}
            <span className="text-white">skills</span> before using{' '}
            <span className="text-white">Generate summary</span> (so AI has
            context). Use the tabs below while you scroll.
          </div>
        ) : null}

        {mode === 'dashboard' && !showTripleChrome ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Jump to section
            </span>
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                aria-label="Scroll sections left"
                disabled={!jumpSectionScrollEdges.left}
                onClick={() => scrollJumpSectionStrip(-1)}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/55 shadow-sm transition',
                  'hover:border-[rgba(0,201,177,0.35)] hover:bg-[rgba(0,201,177,0.08)] hover:text-[#00C9B1]',
                  'disabled:pointer-events-none disabled:opacity-25',
                )}
              >
                <ChevronLeft
                  className="h-4 w-4"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </button>
              <div
                ref={jumpSectionScrollRef}
                className="-mx-0.5 flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {formSectionTabs.map(({ id: sid, label }) => {
                  const done = sectionDone[sid] ?? false;
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() =>
                        jumpToSection(sid, undefined, { scrollForm: true })
                      }
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
                        jumpTabActive(sid)
                          ? 'bg-[#00C9B1]/25 text-[#00C9B1] ring-1 ring-[rgba(0,201,177,0.45)]'
                          : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80',
                      )}
                    >
                      {done ? (
                        <Check
                          className="h-3 w-3 shrink-0 text-[#22C55E]"
                          strokeWidth={3}
                        />
                      ) : null}
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                aria-label="Scroll sections right"
                disabled={!jumpSectionScrollEdges.right}
                onClick={() => scrollJumpSectionStrip(1)}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/55 shadow-sm transition',
                  'hover:border-[rgba(0,201,177,0.35)] hover:bg-[rgba(0,201,177,0.08)] hover:text-[#00C9B1]',
                  'disabled:pointer-events-none disabled:opacity-25',
                )}
              >
                <ChevronRight
                  className="h-4 w-4"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        data-lenis-prevent-wheel
        className={cn(
          'cv-builder-form-root cv-scroll-hide scroll-content-end-pad min-h-0 flex-1 overflow-y-auto overscroll-contain',
          showTripleChrome
            ? 'px-3 py-2'
            : 'overscroll-y-contain px-5 py-4 sm:px-6 sm:py-5',
          mode === 'dashboard' && 'max-lg:pb-32',
        )}
      >
        <>
          <AccordionSection
            id="personal"
            title="Personal information"
            expanded={expanded.has('personal')}
            onToggle={() => toggleAccordion('personal')}
            onFocusSection={() => jumpToSection('personal')}
            {...sectionVisibilityUi('personal')}
          >
            <div className="grid gap-3">
              <Field
                label="Full name *"
                value={data.personal.name}
                onChange={(v) =>
                  update({ personal: { ...data.personal, name: v } })
                }
                onFocus={() => jumpToSection('personal')}
              />
              <Field
                label="Professional title"
                placeholder="e.g. Senior Frontend Engineer"
                value={normalizeText(data.personal.headline as unknown)}
                onChange={(v) =>
                  update({ personal: { ...data.personal, headline: v } })
                }
                onFocus={() => jumpToSection('personal')}
              />
              <Field
                label="Email *"
                type="email"
                value={data.personal.email}
                onChange={(v) =>
                  update({ personal: { ...data.personal, email: v } })
                }
                onFocus={() => jumpToSection('personal')}
              />
              <Field
                label="Phone"
                value={data.personal.phone}
                onChange={(v) =>
                  update({ personal: { ...data.personal, phone: v } })
                }
                onFocus={() => jumpToSection('personal')}
              />
              <Field
                label="Location"
                placeholder="e.g. Accra, Ghana"
                value={data.personal.location}
                onChange={(v) =>
                  update({ personal: { ...data.personal, location: v } })
                }
                onFocus={() => jumpToSection('personal')}
              />
              <button
                type="button"
                className="text-left text-xs font-semibold text-[#00C9B1] hover:underline"
                onClick={() => setOptionalOpen((o) => !o)}
              >
                {optionalOpen ? 'Hide optional fields' : 'Optional links'}
              </button>
              {optionalOpen ? (
                <div className="grid gap-3 border-t border-white/10 pt-3">
                  <Field
                    label="Website"
                    value={data.personal.website ?? ''}
                    onChange={(v) =>
                      update({ personal: { ...data.personal, website: v } })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                  <Field
                    label="LinkedIn"
                    placeholder="https://linkedin.com/in/yourprofile"
                    value={data.personal.linkedin ?? ''}
                    onChange={(v) =>
                      update({ personal: { ...data.personal, linkedin: v } })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                  <Field
                    label="GitHub"
                    placeholder="https://github.com/yourusername"
                    value={data.personal.github ?? ''}
                    onChange={(v) =>
                      update({ personal: { ...data.personal, github: v } })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                  <Field
                    label="Portfolio / website"
                    placeholder="https://yourportfolio.com"
                    value={data.personal.portfolio ?? ''}
                    onChange={(v) =>
                      update({ personal: { ...data.personal, portfolio: v } })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                </div>
              ) : null}
              {showIntlFields ? (
                <div className="grid gap-3 border-t border-white/10 pt-3">
                  <p className="mb-2 rounded border border-[#00C9B1]/20 bg-[#00C9B1]/5 px-2 py-1 text-[10px] leading-snug text-[#00C9B1]/70">
                    These fields are used by the{' '}
                    <strong>{TEMPLATE_LABELS[template as CvTemplateId]}</strong>{' '}
                    template. Fill in what applies to your region.
                  </p>
                  <Field
                    label="Date of Birth"
                    placeholder="e.g. 14 March 1990"
                    value={data.personal.dateOfBirth ?? ''}
                    onChange={(v) =>
                      update({ personal: { ...data.personal, dateOfBirth: v } })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                  <Field
                    label="Place of Birth"
                    placeholder="e.g. Lyon, France"
                    value={data.personal.placeOfBirth ?? ''}
                    onChange={(v) =>
                      update({
                        personal: { ...data.personal, placeOfBirth: v },
                      })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                  <Field
                    label="Nationality"
                    placeholder="e.g. French"
                    value={data.personal.nationality ?? ''}
                    onChange={(v) =>
                      update({ personal: { ...data.personal, nationality: v } })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                  <div>
                    <label className="mb-1 block text-xs text-white/45">
                      Gender
                    </label>
                    <select
                      className={fieldClass}
                      value={data.personal.gender ?? ''}
                      onChange={(e) =>
                        update({
                          personal: {
                            ...data.personal,
                            gender: e.target.value,
                          },
                        })
                      }
                      onFocus={() => jumpToSection('personal')}
                    >
                      <option value="">Prefer not to say</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/45">
                      Marital Status
                    </label>
                    <select
                      className={fieldClass}
                      value={data.personal.maritalStatus ?? ''}
                      onChange={(e) =>
                        update({
                          personal: {
                            ...data.personal,
                            maritalStatus: e.target.value,
                          },
                        })
                      }
                      onFocus={() => jumpToSection('personal')}
                    >
                      <option value="">Not specified</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="In a relationship">
                        In a relationship
                      </option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                  <Field
                    label="Driving Licence"
                    placeholder="e.g. B, C, D — or 'Full UK licence'"
                    value={data.personal.drivingLicence ?? ''}
                    onChange={(v) =>
                      update({
                        personal: { ...data.personal, drivingLicence: v },
                      })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                </div>
              ) : null}
              {showPhotoUpload ? (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <label className="mb-1 block text-xs text-white/45">
                    Profile Photo
                  </label>
                  {data.personal.photoUrl ? (
                    <div className="relative h-20 w-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.personal.photoUrl}
                        alt="Profile"
                        className="h-20 w-16 rounded border-2 border-[#00C9B1]/40 object-cover object-top"
                      />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-[10px] text-white hover:bg-red-500"
                        onClick={() =>
                          update({
                            personal: { ...data.personal, photoUrl: '' },
                          })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                  <label className="flex w-fit cursor-pointer items-center gap-2">
                    <div className="rounded border border-[#00C9B1]/40 px-3 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:border-[#00C9B1] hover:bg-[#00C9B1]/5">
                      {data.personal.photoUrl ? 'Change photo' : 'Upload photo'}
                    </div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (file.size > 20 * 1024 * 1024) {
                          toast.error(CV_PHOTO_TOO_LARGE_USER_MESSAGE);
                          return;
                        }
                        void (async () => {
                          try {
                            const result =
                              await compressImageFileToCvDataUrl(file);
                            update({
                              personal: { ...data.personal, photoUrl: result },
                            });
                            setHeaderPreview({ showPhoto: true });
                          } catch (err) {
                            const msg =
                              err instanceof Error
                                ? err.message
                                : CV_PHOTO_TOO_LARGE_USER_MESSAGE;
                            toast.error(msg);
                          }
                        })();
                      }}
                    />
                  </label>
                  <p className="text-[10px] leading-snug text-white/30">
                    JPG, PNG or WEBP · Large photos are resized and compressed
                    before save · Used by the Onyx template
                  </p>
                  <details className="mt-1">
                    <summary className="cursor-pointer select-none text-xs text-white/35 hover:text-white/55">
                      Or paste an image URL instead
                    </summary>
                    <p className="mb-1 mt-2 text-[10px] text-white/30">
                      Pasting a long{' '}
                      <code className="text-white/45">data:image/…</code> string
                      is compressed automatically so save does not fail.
                    </p>
                    <input
                      type="url"
                      className={cn(fieldClass, 'mt-2')}
                      placeholder="https://example.com/photo.jpg"
                      value={
                        data.personal.photoUrl?.startsWith('data:')
                          ? ''
                          : (data.personal.photoUrl ?? '')
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        void (async () => {
                          try {
                            const next = await normalizeCvPhotoUrlInput(raw);
                            update({
                              personal: { ...data.personal, photoUrl: next },
                            });
                            if (next.trim())
                              setHeaderPreview({ showPhoto: true });
                          } catch (err) {
                            const msg =
                              err instanceof Error
                                ? err.message
                                : CV_PHOTO_TOO_LARGE_USER_MESSAGE;
                            toast.error(msg);
                          }
                        })();
                      }}
                      onFocus={() => jumpToSection('personal')}
                    />
                  </details>
                </div>
              ) : null}
              {showHobbies ? (
                <div className="grid gap-2 border-t border-white/10 pt-3">
                  <label className="mb-1 block text-xs text-white/45">
                    Hobbies &amp; Interests
                  </label>
                  <textarea
                    className={cn(fieldClass, 'min-h-[52px]')}
                    rows={2}
                    placeholder="e.g. Hiking, Photography, Open-source development"
                    value={data.personal.hobbies ?? ''}
                    onChange={(e) =>
                      update({
                        personal: { ...data.personal, hobbies: e.target.value },
                      })
                    }
                    onFocus={() => jumpToSection('personal')}
                  />
                  <p className="text-[10px] leading-snug text-white/35">
                    Used by French and German templates.
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1] hover:underline"
                onClick={() =>
                  update({
                    personal: {
                      ...data.personal,
                      extras: [
                        ...data.personal.extras,
                        { label: '', value: '' },
                      ],
                    },
                  })
                }
              >
                + Add custom field
              </button>
              {data.personal.extras.length > 0 ? (
                <p className="text-[10px] leading-snug text-white/35">
                  Use a short name for the link (left), then paste the URL or
                  text (right) — e.g. &quot;Portfolio&quot; and
                  https://yoursite.com
                </p>
              ) : null}
              {data.personal.extras.map((ex, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={fieldClass}
                    value={ex.label}
                    onChange={(e) => {
                      const next = [...data.personal.extras];
                      next[i] = { ...next[i]!, label: e.target.value };
                      update({ personal: { ...data.personal, extras: next } });
                    }}
                    placeholder="e.g. Portfolio, Twitter, Behance"
                    onFocus={() => jumpToSection('personal')}
                  />
                  <input
                    className={fieldClass}
                    value={ex.value}
                    onChange={(e) => {
                      const next = [...data.personal.extras];
                      next[i] = { ...next[i]!, value: e.target.value };
                      update({ personal: { ...data.personal, extras: next } });
                    }}
                    placeholder="URL or @handle"
                    onFocus={() => jumpToSection('personal')}
                  />
                  <button
                    type="button"
                    className="text-white/40 hover:text-white"
                    onClick={() =>
                      update({
                        personal: {
                          ...data.personal,
                          extras: data.personal.extras.filter(
                            (_, j) => j !== i,
                          ),
                        },
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            id="experience"
            title="Work experience"
            expanded={expanded.has('experience')}
            onToggle={() => toggleAccordion('experience')}
            onFocusSection={() => jumpToSection('experience')}
            {...sectionVisibilityUi('experience')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    experience: {
                      items: [
                        ...experienceItems,
                        {
                          id: newLocalId(),
                          title: '',
                          company: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          current: false,
                          bullets: [],
                        },
                      ],
                    },
                  })
                }
              >
                + Add position
              </button>
            }
          >
            <div className="space-y-3">
              {experienceItems.length === 0 && uploadedCvHint ? (
                <div className="rounded-[10px] border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.06)] p-4">
                  <p className="mb-1 text-[13px] font-semibold text-[#F59E0B]">
                    Experience not extracted from your resume
                  </p>
                  <p className="mb-2.5 text-xs leading-relaxed text-white/50">
                    Your uploaded CV may have been too long for our parser to
                    read completely. Try re-uploading your resume — we have improved
                    our extraction.
                  </p>
                  {onRequestReparse ? (
                    <button
                      type="button"
                      onClick={onRequestReparse}
                      className="rounded-full border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.12)] px-3.5 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:border-[#00C9B1]/55"
                    >
                      Re-upload CV →
                    </button>
                  ) : null}
                </div>
              ) : null}
              {experienceItems.map((job, idx) => (
                <GlowCard
                  key={job.id}
                  className="border border-white/10"
                  contentClassName="relative p-4"
                >
                  <div
                    className="absolute left-2 top-3 cursor-grab text-white/25"
                    draggable
                    onDragStart={() => setDragId(job.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!dragId || dragId === job.id) return;
                      const items = [...experienceItems];
                      const a = items.findIndex((x) => x.id === dragId);
                      const b = idx;
                      if (a < 0) return;
                      const [row] = items.splice(a, 1);
                      items.splice(b, 0, row!);
                      update({ experience: { items } });
                      setDragId(null);
                    }}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    className="absolute right-2 top-2 text-white/35 hover:text-white"
                    onClick={() => setRemoveTarget({ kind: 'exp', id: job.id })}
                  >
                    ✕
                  </button>
                  <div className="ml-6 grid gap-2">
                    <Field
                      label="Job title"
                      value={job.title}
                      onChange={(v) => {
                        const items = experienceItems.map((x) =>
                          x.id === job.id ? { ...x, title: v } : x,
                        );
                        update({ experience: { items } });
                      }}
                      onFocus={() => jumpToSection('experience', job.id)}
                    />
                    <Field
                      label="Company"
                      value={job.company}
                      onChange={(v) => {
                        const items = experienceItems.map((x) =>
                          x.id === job.id ? { ...x, company: v } : x,
                        );
                        update({ experience: { items } });
                      }}
                      onFocus={() => jumpToSection('experience', job.id)}
                    />
                    <Field
                      label="Location"
                      value={job.location}
                      onChange={(v) => {
                        const items = experienceItems.map((x) =>
                          x.id === job.id ? { ...x, location: v } : x,
                        );
                        update({ experience: { items } });
                      }}
                      onFocus={() => jumpToSection('experience', job.id)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <CvDateField
                        label="Start date"
                        value={job.startDate}
                        placeholder="e.g. 2018 or Jan 2018"
                        onChange={(v) => {
                          const items = experienceItems.map((x) =>
                            x.id === job.id ? { ...x, startDate: v } : x,
                          );
                          update({ experience: { items } });
                        }}
                        onFocus={() => jumpToSection('experience', job.id)}
                      />
                      <CvDateField
                        label="End date"
                        value={job.endDate}
                        disabled={job.current}
                        helper={
                          job.current
                            ? 'Marked as current role — no end date.'
                            : undefined
                        }
                        placeholder="e.g. 2020 or Present"
                        onChange={(v) => {
                          const items = experienceItems.map((x) =>
                            x.id === job.id ? { ...x, endDate: v } : x,
                          );
                          update({ experience: { items } });
                        }}
                        onFocus={() => jumpToSection('experience', job.id)}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-white/55">
                      <input
                        type="checkbox"
                        checked={job.current}
                        onChange={(e) => {
                          const items = experienceItems.map((x) =>
                            x.id === job.id
                              ? {
                                  ...x,
                                  current: e.target.checked,
                                  endDate: e.target.checked ? '' : x.endDate,
                                }
                              : x,
                          );
                          update({ experience: { items } });
                        }}
                        onFocus={() => jumpToSection('experience', job.id)}
                      />
                      Currently working here
                    </label>
                    <div>
                      <label className="mb-1 block text-xs text-white/45">
                        What you achieved in this role
                      </label>
                      <p className="mb-1.5 text-[10px] leading-snug text-white/35">
                        Put each achievement on its own line. You don&apos;t
                        need • or dashes — we format those on your resume.
                      </p>
                      {job.bullets.some(containsCvChangeMarker) ? (
                        <div className="space-y-2">
                          <ul className="list-disc space-y-1.5 pl-4 text-sm text-white/85 marker:text-[#00C9B1]">
                            {job.bullets
                              .filter((bullet) => richTextPlainText(bullet).length > 0)
                              .map((bullet, bulletIdx) => (
                                <li key={`${job.id}-marker-bullet-${bulletIdx}`}>
                                  <CvRichTextSpan html={bullet} />
                                </li>
                              ))}
                          </ul>
                          <p className="text-[10px] leading-relaxed text-white/40">
                            Tailor highlights are shown in the CV preview. Edit those bullets
                            there so underlines stay intact.
                          </p>
                        </div>
                      ) : (
                      <textarea
                        className={cn(fieldClass, 'min-h-[100px]')}
                        placeholder={
                          'Example:\nLed a team of 4 to launch a new checkout flow\nCut page load time by 35%'
                        }
                        value={job.bullets.join('\n')}
                        onChange={(e) => {
                          const bullets = e.target.value.split('\n');
                          const items = experienceItems.map((x) =>
                            x.id === job.id ? { ...x, bullets } : x,
                          );
                          update({ experience: { items } });
                        }}
                        onFocus={() => jumpToSection('experience', job.id)}
                      />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-1 border border-[rgba(0,201,177,0.35)] text-xs text-[#00C9B1]"
                        disabled={aiPending === job.id}
                        onClick={async () => {
                          const line =
                            job.bullets.find((b) => b.trim()) || job.title;
                          const out = await runAiBullets(job.id, line);
                          if (out && !profileId?.trim()) {
                            const items = experienceItems.map((x) =>
                              x.id === job.id
                                ? { ...x, bullets: [...x.bullets, out] }
                                : x,
                            );
                            update({ experience: { items } });
                          }
                        }}
                      >
                        {aiPending === job.id ? '...' : '✨ Improve with AI'}
                      </Button>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            id="education"
            title="Education"
            expanded={expanded.has('education')}
            onToggle={() => toggleAccordion('education')}
            onFocusSection={() => jumpToSection('education')}
            {...sectionVisibilityUi('education')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    education: {
                      items: [
                        ...educationItems,
                        {
                          id: newLocalId(),
                          degree: '',
                          field: '',
                          school: '',
                          startYear: '',
                          endYear: '',
                          grade: '',
                        },
                      ],
                    },
                  })
                }
              >
                + Add education
              </button>
            }
          >
            <div className="space-y-3">
              {educationItems.length === 0 && uploadedCvHint ? (
                <div className="rounded-[10px] border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.06)] p-4">
                  <p className="mb-1 text-[13px] font-semibold text-[#F59E0B]">
                    Education not extracted from your resume
                  </p>
                  <p className="text-xs leading-relaxed text-white/50">
                    Add your education manually, or re-upload your resume to try
                    extraction again.
                  </p>
                </div>
              ) : null}
              {educationItems.map((ed) => (
                <GlowCard
                  key={ed.id}
                  className="border border-white/10"
                  contentClassName="relative p-4"
                >
                  <button
                    type="button"
                    className="absolute right-2 top-2 text-white/35 hover:text-white"
                    onClick={() => setRemoveTarget({ kind: 'edu', id: ed.id })}
                  >
                    ✕
                  </button>
                  <div className="grid gap-2 pr-6">
                    <Field
                      label="Degree or qualification"
                      placeholder="e.g. BSc Computer Science, MBA, High School Diploma"
                      value={ed.degree}
                      onChange={(v) => {
                        const items = educationItems.map((x) =>
                          x.id === ed.id ? { ...x, degree: v } : x,
                        );
                        update({ education: { items } });
                      }}
                      onFocus={() => jumpToSection('education')}
                    />
                    <Field
                      label="Field of study"
                      value={ed.field}
                      onChange={(v) => {
                        const items = educationItems.map((x) =>
                          x.id === ed.id ? { ...x, field: v } : x,
                        );
                        update({ education: { items } });
                      }}
                      onFocus={() => jumpToSection('education')}
                    />
                    <Field
                      label="School"
                      value={ed.school}
                      onChange={(v) => {
                        const items = educationItems.map((x) =>
                          x.id === ed.id ? { ...x, school: v } : x,
                        );
                        update({ education: { items } });
                      }}
                      onFocus={() => jumpToSection('education')}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <CvDateField
                        label="Started"
                        value={ed.startYear}
                        preferYear
                        placeholder="e.g. 2016"
                        onChange={(v) => {
                          const items = educationItems.map((x) =>
                            x.id === ed.id ? { ...x, startYear: v } : x,
                          );
                          update({ education: { items } });
                        }}
                        onFocus={() => jumpToSection('education')}
                      />
                      <CvDateField
                        label="Finished (or expected)"
                        value={ed.endYear}
                        preferYear
                        placeholder="e.g. 2020"
                        onChange={(v) => {
                          const items = educationItems.map((x) =>
                            x.id === ed.id ? { ...x, endYear: v } : x,
                          );
                          update({ education: { items } });
                        }}
                        onFocus={() => jumpToSection('education')}
                      />
                    </div>
                    <Field
                      label="Grade / GPA"
                      placeholder="e.g. First Class"
                      value={ed.grade ?? ''}
                      onChange={(v) => {
                        const items = educationItems.map((x) =>
                          x.id === ed.id ? { ...x, grade: v } : x,
                        );
                        update({ education: { items } });
                      }}
                      onFocus={() => jumpToSection('education')}
                    />
                  </div>
                </GlowCard>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            id="skills"
            title="Skills"
            expanded={expanded.has('skills')}
            onToggle={() => toggleAccordion('skills')}
            onFocusSection={() => jumpToSection('skills')}
            {...sectionVisibilityUi('skills')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    skills: {
                      categories: [
                        ...skillCategories,
                        { id: newLocalId(), name: '', skills: [] },
                      ],
                    },
                  })
                }
              >
                + Add category
              </button>
            }
          >
            <div className="space-y-4">
              {skillCategories.every(
                (c) => (Array.isArray(c.skills) ? c.skills : []).length === 0,
              ) && uploadedCvHint ? (
                <div className="rounded-[10px] border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.06)] p-4">
                  <p className="mb-1 text-[13px] font-semibold text-[#F59E0B]">
                    Skills not extracted from your resume
                  </p>
                  <p className="text-xs leading-relaxed text-white/50">
                    Type skills below and press Enter to add them, or re-upload
                    your resume to try extraction again.
                  </p>
                </div>
              ) : null}
              {skillCategories.map((cat, ci) => (
                <div
                  key={cat.id}
                  className="rounded-xl border border-white/10 bg-[#111616] p-3"
                >
                  <div className="mb-2 flex gap-2">
                    <input
                      className={fieldClass}
                      value={cat.name}
                      placeholder="e.g. Programming languages, Tools, Soft skills"
                      onChange={(e) => {
                        const categories = skillCategories.map((c, i) =>
                          i === ci ? { ...c, name: e.target.value } : c,
                        );
                        update({ skills: { categories } });
                      }}
                      onFocus={() => jumpToSection('skills')}
                    />
                    <button
                      type="button"
                      className="text-white/35 hover:text-white"
                      onClick={() =>
                        update({
                          skills: {
                            categories: skillCategories.filter(
                              (_, i) => i !== ci,
                            ),
                          },
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                  <CategorySkillsInput
                    skills={Array.isArray(cat.skills) ? cat.skills : []}
                    onChange={(skills) => {
                      const categories = skillCategories.map((c, i) =>
                        i === ci ? { ...c, skills } : c,
                      );
                      update({ skills: { categories } });
                    }}
                    onFocus={() => jumpToSection('skills')}
                  />
                </div>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            id="summary"
            title="Professional summary"
            expanded={expanded.has('summary')}
            onToggle={() => toggleAccordion('summary')}
            onFocusSection={() => jumpToSection('summary')}
            {...sectionVisibilityUi('summary')}
          >
            {uploadedCvHint &&
            normalizeText(data.summary?.text as unknown).trim() === '' ? (
              <div
                className="mb-3 rounded-lg border border-amber-500/20 px-3 py-2.5"
                style={{ background: 'rgba(245,158,11,0.08)' }}
              >
                <p className="mb-1 text-xs font-medium text-[#F59E0B]">
                  Your uploaded CV had no summary
                </p>
                <p className="mb-3 text-[11px] leading-relaxed text-white/50">
                  A professional summary is recommended if you have 3+ years of
                  experience. Use the AI button to generate one, or hide this
                  section if you prefer.
                </p>
                <button
                  type="button"
                  disabled={aiPending === 'summary'}
                  onClick={() => void runAiSummary()}
                  className="rounded-full border border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.12)] px-3 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:border-[#00C9B1]/55 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiPending === 'summary' ? (
                    <>
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />{' '}
                      Generating…
                    </>
                  ) : (
                    '✨ Generate summary with AI'
                  )}
                </button>
              </div>
            ) : null}
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              Add this <span className="text-white/55">after</span> your title,
              jobs, and skills so AI can match your story. Use &quot;Generate
              with AI&quot; for a first draft, then edit in your own voice.
            </p>
            <div className="relative">
              {containsCvChangeMarker(normalizeText(data.summary?.text as unknown)) ? (
                <BuilderRichTextField
                  value={normalizeText(data.summary?.text as unknown)}
                  onChange={(text) => update({ summary: { text } })}
                  onFocus={() => jumpToSection('summary')}
                  minHeightClass="min-h-[120px]"
                  placeholder="2–3 short sentences: who you are, what you do best, and what you want next."
                />
              ) : (
              <textarea
                className={cn(fieldClass, 'min-h-[120px] resize-y')}
                placeholder="2–3 short sentences: who you are, what you do best, and what you want next."
                value={normalizeText(data.summary?.text as unknown)}
                onChange={(e) => update({ summary: { text: e.target.value } })}
                onFocus={() => jumpToSection('summary')}
                maxLength={500}
              />
              )}
              <p className="mt-1 text-right text-[11px] text-white/25">
                {normalizeText(data.summary?.text as unknown).length} / 500
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 border border-[rgba(0,201,177,0.35)] text-xs text-[#00C9B1]"
                disabled={aiPending === 'summary'}
                onClick={() => void runAiSummary()}
              >
                {aiPending === 'summary' ? (
                  <>
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />{' '}
                    Generating...
                  </>
                ) : (
                  '✨ Generate with AI'
                )}
              </Button>
            </div>
          </AccordionSection>

          <AccordionSection
            id="projects"
            title="Projects (optional)"
            expanded={expanded.has('projects')}
            onToggle={() => toggleAccordion('projects')}
            onFocusSection={() => jumpToSection('projects')}
            {...sectionVisibilityUi('projects')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    projects: [
                      ...data.projects,
                      {
                        id: newLocalId(),
                        name: '',
                        description: '',
                        technologies: [],
                        url: '',
                        bullets: '',
                      },
                    ],
                  })
                }
              >
                + Add project
              </button>
            }
          >
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              Optional — showcase products, apps, or significant work that
              doesn&apos;t fit under a single employer.
            </p>
            {data.projects.map((p) => (
              <GlowCard
                key={p.id}
                className="mb-3 border border-white/10"
                contentClassName="p-4"
              >
                <p className="mb-2 text-sm font-semibold text-white">Project</p>
                <Field
                  label="Project name"
                  placeholder="e.g. ApplyMate job tracker"
                  value={p.name}
                  onChange={(v) =>
                    update({
                      projects: data.projects.map((x) =>
                        x.id === p.id ? { ...x, name: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('projects')}
                />
                <label className="mb-1 mt-2 block text-xs text-white/45">
                  What you built
                </label>
                <p className="mb-1 text-[10px] text-white/30">
                  Describe the project in plain language — what problem it
                  solved or who uses it.
                </p>
                <BuilderRichTextField
                  placeholder="e.g. A web app that helps job seekers track applications and tailor CVs with AI hints."
                  value={p.description}
                  onChange={(description) =>
                    update({
                      projects: data.projects.map((x) =>
                        x.id === p.id ? { ...x, description } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('projects')}
                />
                <div className="mt-2">
                  <TagInput
                    label="Tech & tools used"
                    hint="Type a tool and press Enter — e.g. React, PostgreSQL, Figma"
                    skills={p.technologies}
                    onChange={(technologies) =>
                      update({
                        projects: data.projects.map((x) =>
                          x.id === p.id ? { ...x, technologies } : x,
                        ),
                      })
                    }
                    onFocus={() => jumpToSection('projects')}
                  />
                </div>
                <Field
                  label="Link (optional)"
                  placeholder="https://…"
                  value={p.url}
                  onChange={(v) => {
                    const trimmed = v.trim();
                    update({
                      projects: data.projects.map((x) => {
                        if (x.id !== p.id) return x;
                        let description = x.description ?? '';
                        if (!trimmed && description) {
                          const prevUrl = (p.url ?? '').trim();
                          if (prevUrl) {
                            const esc = prevUrl.replace(
                              /[.*+?^${}()|[\]\\]/g,
                              '\\$&',
                            );
                            description = description
                              .replace(
                                new RegExp(
                                  `<a[^>]*href=["']?${esc}["']?[^>]*>.*?<\\/a>`,
                                  'gi',
                                ),
                                '',
                              )
                              .replace(prevUrl, '')
                              .trim();
                          }
                        }
                        return { ...x, url: v, description };
                      }),
                    });
                  }}
                  onFocus={() => jumpToSection('projects')}
                />
                <label className="mb-1 mt-2 block text-xs text-white/45">
                  Highlights (optional)
                </label>
                <p className="mb-1 text-[10px] text-white/30">
                  One point per line — no bullet symbols needed.
                </p>
                <BuilderRichTextField
                  minHeightClass="min-h-[64px]"
                  placeholder="e.g. Shipped MVP in 6 weeks — one highlight per line"
                  value={p.bullets}
                  onChange={(bullets) =>
                    update({
                      projects: data.projects.map((x) =>
                        x.id === p.id ? { ...x, bullets } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('projects')}
                />
              </GlowCard>
            ))}
          </AccordionSection>

          <AccordionSection
            id="achievements"
            title="Achievements & awards (optional)"
            expanded={expanded.has('achievements')}
            onToggle={() => toggleAccordion('achievements')}
            onFocusSection={() => jumpToSection('achievements')}
            {...sectionVisibilityUi('achievements')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    achievements: [
                      ...data.achievements,
                      {
                        id: newLocalId(),
                        title: '',
                        issuer: '',
                        date: '',
                        detail: '',
                      },
                    ],
                  })
                }
              >
                + Add
              </button>
            }
          >
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              Awards, recognitions, or notable credentials (title, issuer, date,
              optional notes).
            </p>
            {data.achievements.map((a: CVBuilderAchievement) => (
              <GlowCard
                key={a.id}
                className="mb-3 last:mb-0"
                contentClassName="p-4"
              >
                <p className="mb-2 text-sm font-semibold text-white">
                  Achievement
                </p>
                <Field
                  label="Title"
                  placeholder="e.g. AWS Certified DevOps Engineer"
                  value={a.title}
                  onChange={(v) =>
                    update({
                      achievements: data.achievements.map((x) =>
                        x.id === a.id ? { ...x, title: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('achievements')}
                />
                <Field
                  label="Issuer"
                  placeholder="e.g. Amazon Web Services"
                  value={a.issuer}
                  onChange={(v) =>
                    update({
                      achievements: data.achievements.map((x) =>
                        x.id === a.id ? { ...x, issuer: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('achievements')}
                />
                <CvDateField
                  label="Date"
                  preferYear
                  placeholder="e.g. 2022"
                  value={a.date}
                  onChange={(v) =>
                    update({
                      achievements: data.achievements.map((x) =>
                        x.id === a.id ? { ...x, date: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('achievements')}
                />
                <label className="mb-1 mt-2 block text-xs text-white/45">
                  Detail / note (optional)
                </label>
                <textarea
                  className={cn(fieldClass, 'min-h-[72px]')}
                  placeholder="e.g. Validation number, context, or short description"
                  value={a.detail}
                  onChange={(e) =>
                    update({
                      achievements: data.achievements.map((x) =>
                        x.id === a.id ? { ...x, detail: e.target.value } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('achievements')}
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-white/45 hover:text-[#EF4444]"
                  onClick={() =>
                    update({
                      achievements: data.achievements.filter(
                        (x) => x.id !== a.id,
                      ),
                    })
                  }
                >
                  ✕ Remove
                </button>
              </GlowCard>
            ))}
          </AccordionSection>

          <AccordionSection
            id="certifications"
            title="Certifications (optional)"
            expanded={expanded.has('certifications')}
            onToggle={() => toggleAccordion('certifications')}
            onFocusSection={() => jumpToSection('certifications')}
            {...sectionVisibilityUi('certifications')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    certifications: [
                      ...data.certifications,
                      {
                        id: newLocalId(),
                        name: '',
                        issuer: '',
                        date: '',
                        url: '',
                      },
                    ],
                  })
                }
              >
                + Add
              </button>
            }
          >
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              Professional certificates, licences, or exam passes (name, issuer,
              date).
            </p>
            {data.certifications.map((c) => (
              <GlowCard
                key={c.id}
                className="mb-3 last:mb-0"
                contentClassName="p-4"
              >
                <p className="mb-2 text-sm font-semibold text-white">
                  Certification
                </p>
                <Field
                  label="Name"
                  value={c.name}
                  onChange={(v) =>
                    update({
                      certifications: data.certifications.map((x) =>
                        x.id === c.id ? { ...x, name: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('certifications')}
                />
                <Field
                  label="Issuing organisation"
                  value={c.issuer}
                  onChange={(v) =>
                    update({
                      certifications: data.certifications.map((x) =>
                        x.id === c.id ? { ...x, issuer: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('certifications')}
                />
                <div className="mt-2">
                  <CvDateField
                    label="Date earned"
                    preferYear
                    value={c.date}
                    onChange={(v) =>
                      update({
                        certifications: data.certifications.map((x) =>
                          x.id === c.id ? { ...x, date: v } : x,
                        ),
                      })
                    }
                    onFocus={() => jumpToSection('certifications')}
                  />
                </div>
                <Field
                  label="Credential link (optional)"
                  placeholder="https://…"
                  value={c.url}
                  onChange={(v) =>
                    update({
                      certifications: data.certifications.map((x) =>
                        x.id === c.id ? { ...x, url: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('certifications')}
                />
              </GlowCard>
            ))}
          </AccordionSection>

          <AccordionSection
            id="languages"
            title="Languages (optional)"
            expanded={expanded.has('languages')}
            onToggle={() => toggleAccordion('languages')}
            onFocusSection={() => jumpToSection('languages')}
            {...sectionVisibilityUi('languages')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    languages: [
                      ...data.languages,
                      { id: newLocalId(), language: '', proficiency: '' },
                    ],
                  })
                }
              >
                + Add
              </button>
            }
          >
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              List languages you can use professionally and your level.
            </p>
            {data.languages.map((l) => {
              const cefrExpanded = showCefr && langCefrOpen[l.id] === true;
              const setCefrField = (
                field: keyof CVBuilderLanguage,
                value: string,
              ) =>
                update((d) => ({
                  ...d,
                  languages: d.languages.map((x) =>
                    x.id === l.id
                      ? { ...x, [field]: value ? value : undefined }
                      : x,
                  ),
                }));
              return (
                <GlowCard
                  key={l.id}
                  className="mb-3 last:mb-0"
                  contentClassName="p-4"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="Language"
                      value={l.language}
                      onChange={(v) =>
                        update({
                          languages: data.languages.map((x) =>
                            x.id === l.id ? { ...x, language: v } : x,
                          ),
                        })
                      }
                      onFocus={() => jumpToSection('languages')}
                    />
                    <div>
                      <label className="mb-1 block text-xs text-white/45">
                        Proficiency
                      </label>
                      <select
                        className={fieldClass}
                        value={l.proficiency}
                        onChange={(e) =>
                          update({
                            languages: data.languages.map((x) =>
                              x.id === l.id
                                ? {
                                    ...x,
                                    proficiency: e.target
                                      .value as typeof l.proficiency,
                                  }
                                : x,
                            ),
                          })
                        }
                        onFocus={() => jumpToSection('languages')}
                      >
                        <option value="">Select level</option>
                        {(
                          [
                            'Native',
                            'Fluent',
                            'Professional',
                            'Intermediate',
                            'Basic',
                          ] as const
                        ).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {showCefr ? (
                    <div>
                      <button
                        type="button"
                        className="mt-2 text-left text-xs font-semibold text-[#00C9B1] hover:underline"
                        onClick={() =>
                          setLangCefrOpen((m) => ({
                            ...m,
                            [l.id]: !cefrExpanded,
                          }))
                        }
                      >
                        {cefrExpanded
                          ? 'Hide CEFR breakdown'
                          : '＋ Add CEFR breakdown'}
                      </button>
                      {cefrExpanded ? (
                        <div className="mt-3">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-[10px] text-white/45">
                                Listening
                              </label>
                              <select
                                className={fieldClass}
                                value={l.listening ?? ''}
                                onChange={(e) =>
                                  setCefrField('listening', e.target.value)
                                }
                                onFocus={() => jumpToSection('languages')}
                              >
                                {CEFR_LEVEL_OPTIONS.map((o) => (
                                  <option key={o || 'empty'} value={o}>
                                    {o ? o : '— Select —'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-white/45">
                                Reading
                              </label>
                              <select
                                className={fieldClass}
                                value={l.reading ?? ''}
                                onChange={(e) =>
                                  setCefrField('reading', e.target.value)
                                }
                                onFocus={() => jumpToSection('languages')}
                              >
                                {CEFR_LEVEL_OPTIONS.map((o) => (
                                  <option key={o || 'empty-r'} value={o}>
                                    {o ? o : '— Select —'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-white/45">
                                Spoken interaction
                              </label>
                              <select
                                className={fieldClass}
                                value={l.spokenInteraction ?? ''}
                                onChange={(e) =>
                                  setCefrField(
                                    'spokenInteraction',
                                    e.target.value,
                                  )
                                }
                                onFocus={() => jumpToSection('languages')}
                              >
                                {CEFR_LEVEL_OPTIONS.map((o) => (
                                  <option key={o || 'empty-si'} value={o}>
                                    {o ? o : '— Select —'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-white/45">
                                Spoken production
                              </label>
                              <select
                                className={fieldClass}
                                value={l.spokenProduction ?? ''}
                                onChange={(e) =>
                                  setCefrField(
                                    'spokenProduction',
                                    e.target.value,
                                  )
                                }
                                onFocus={() => jumpToSection('languages')}
                              >
                                {CEFR_LEVEL_OPTIONS.map((o) => (
                                  <option key={o || 'empty-sp'} value={o}>
                                    {o ? o : '— Select —'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-white/45">
                                Writing
                              </label>
                              <select
                                className={fieldClass}
                                value={l.writing ?? ''}
                                onChange={(e) =>
                                  setCefrField('writing', e.target.value)
                                }
                                onFocus={() => jumpToSection('languages')}
                              >
                                {CEFR_LEVEL_OPTIONS.map((o) => (
                                  <option key={o || 'empty-w'} value={o}>
                                    {o ? o : '— Select —'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <p className="mt-2 text-[9px] italic text-white/30">
                            A1-A2: Basic · B1-B2: Independent · C1-C2:
                            Proficient
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 text-xs text-white/45 hover:text-[#EF4444]"
                    onClick={() => {
                      setLangCefrOpen((m) => {
                        const { [l.id]: _omit, ...rest } = m;
                        return rest;
                      });
                      update({
                        languages: data.languages.filter((x) => x.id !== l.id),
                      });
                    }}
                  >
                    ✕ Remove language
                  </button>
                </GlowCard>
              );
            })}
          </AccordionSection>

          {showReferences ? (
            <AccordionSection
              id="references"
              title="References"
              expanded={expanded.has('references')}
              onToggle={() => toggleAccordion('references')}
              onFocusSection={() => jumpToSection('references')}
              {...sectionVisibilityUi('references')}
              right={
                <button
                  type="button"
                  className="text-xs font-semibold text-[#00C9B1]"
                  onClick={() =>
                    update({
                      references: [
                        ...filterCvBuilderReferences(data.references),
                        {
                          id: newLocalId(),
                          name: '',
                          title: '',
                          company: '',
                          email: '',
                          phone: '',
                        },
                      ],
                    })
                  }
                >
                  + Add reference
                </button>
              }
            >
              <p className="mb-2 text-[10px] leading-snug text-white/40">
                References appear in the Onyx template and as an optional section in other layouts.
              </p>
              {data.references.map((ref) => (
                <GlowCard
                  key={ref.id}
                  className="mb-3 last:mb-0"
                  contentClassName="p-4"
                >
                  <Field
                    label="Full Name"
                    value={ref.name}
                    onChange={(v) =>
                      update((d) => ({
                        ...d,
                        references: d.references.map((r) =>
                          r.id === ref.id ? { ...r, name: v } : r,
                        ),
                      }))
                    }
                    onFocus={() => jumpToSection('references')}
                  />
                  <Field
                    label="Job Title"
                    value={ref.title}
                    onChange={(v) =>
                      update((d) => ({
                        ...d,
                        references: d.references.map((r) =>
                          r.id === ref.id ? { ...r, title: v } : r,
                        ),
                      }))
                    }
                    onFocus={() => jumpToSection('references')}
                  />
                  <Field
                    label="Company / Organisation"
                    value={ref.company}
                    onChange={(v) =>
                      update((d) => ({
                        ...d,
                        references: d.references.map((r) =>
                          r.id === ref.id ? { ...r, company: v } : r,
                        ),
                      }))
                    }
                    onFocus={() => jumpToSection('references')}
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={ref.email}
                    onChange={(v) =>
                      update((d) => ({
                        ...d,
                        references: d.references.map((r) =>
                          r.id === ref.id ? { ...r, email: v } : r,
                        ),
                      }))
                    }
                    onFocus={() => jumpToSection('references')}
                  />
                  <Field
                    label="Phone"
                    value={ref.phone}
                    onChange={(v) =>
                      update((d) => ({
                        ...d,
                        references: d.references.map((r) =>
                          r.id === ref.id ? { ...r, phone: v } : r,
                        ),
                      }))
                    }
                    onFocus={() => jumpToSection('references')}
                  />
                  <button
                    type="button"
                    className="mt-2 text-xs text-white/45 hover:text-[#EF4444]"
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        references: d.references.filter((r) => r.id !== ref.id),
                      }))
                    }
                  >
                    ✕ Remove reference
                  </button>
                </GlowCard>
              ))}
            </AccordionSection>
          ) : null}

          {data.parsedCustomSections.map((block) => {
            const sid = `parsed-${block.sectionId}`;
            return (
              <AccordionSection
                key={block.sectionId}
                id={sid}
                title={
                  (block.title || 'Custom section').trim().slice(0, 72) ||
                  'Custom section'
                }
                expanded={expanded.has(sid)}
                onToggle={() => toggleAccordion(sid)}
                onFocusSection={() => jumpToSection(sid)}
                {...sectionVisibilityUi(sid)}
                right={
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#00C9B1]"
                    onClick={() =>
                      update({
                        parsedCustomSections: data.parsedCustomSections.map(
                          (b) =>
                            b.sectionId === block.sectionId
                              ? {
                                  ...b,
                                  items: [
                                    ...b.items,
                                    {
                                      id: newLocalId(),
                                      text: '',
                                      date: '',
                                      subItems: [],
                                    },
                                  ],
                                }
                              : b,
                        ),
                      })
                    }
                  >
                    + Add item
                  </button>
                }
              >
                <p className="mb-3 text-[11px] leading-relaxed text-white/40">
                  From your uploaded CV — edits save with your profile.
                </p>
                <Field
                  label="Section heading"
                  value={normalizeText(block.title as unknown)}
                  onChange={(v) =>
                    update({
                      parsedCustomSections: data.parsedCustomSections.map(
                        (b) =>
                          b.sectionId === block.sectionId
                            ? { ...b, title: v }
                            : b,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection(sid)}
                />
                {block.items.map((item: CVBuilderParsedCustomItem) => (
                  <GlowCard
                    key={item.id}
                    className="mb-3 last:mb-0"
                    contentClassName="p-4"
                  >
                    <Field
                      label="Text"
                      value={normalizeText(item.text as unknown)}
                      onChange={(v) =>
                        update({
                          parsedCustomSections: data.parsedCustomSections.map(
                            (b) =>
                              b.sectionId === block.sectionId
                                ? {
                                    ...b,
                                    items: b.items.map((it) =>
                                      it.id === item.id
                                        ? { ...it, text: v }
                                        : it,
                                    ),
                                  }
                                : b,
                          ),
                        })
                      }
                      onFocus={() => jumpToSection(sid)}
                    />
                    <Field
                      label="Date (optional)"
                      value={normalizeText(item.date as unknown)}
                      onChange={(v) =>
                        update({
                          parsedCustomSections: data.parsedCustomSections.map(
                            (b) =>
                              b.sectionId === block.sectionId
                                ? {
                                    ...b,
                                    items: b.items.map((it) =>
                                      it.id === item.id
                                        ? { ...it, date: v }
                                        : it,
                                    ),
                                  }
                                : b,
                          ),
                        })
                      }
                      onFocus={() => jumpToSection(sid)}
                    />
                    <label className="mb-1 mt-2 block text-xs text-white/45">
                      Sub-items (optional, one per line)
                    </label>
                    <textarea
                      className={cn(fieldClass, 'min-h-[64px]')}
                      placeholder="One bullet or line per row"
                      value={item.subItems.join('\n')}
                      onChange={(e) => {
                        const subItems = e.target.value
                          .split(/\r?\n/)
                          .map((l) => l.trim())
                          .filter(Boolean);
                        update({
                          parsedCustomSections: data.parsedCustomSections.map(
                            (b) =>
                              b.sectionId === block.sectionId
                                ? {
                                    ...b,
                                    items: b.items.map((it) =>
                                      it.id === item.id
                                        ? { ...it, subItems }
                                        : it,
                                    ),
                                  }
                                : b,
                          ),
                        });
                      }}
                      onFocus={() => jumpToSection(sid)}
                    />
                    <button
                      type="button"
                      className="mt-2 text-xs text-white/45 hover:text-[#EF4444]"
                      onClick={() =>
                        update({
                          parsedCustomSections: data.parsedCustomSections.map(
                            (b) =>
                              b.sectionId === block.sectionId
                                ? {
                                    ...b,
                                    items: b.items.filter(
                                      (it) => it.id !== item.id,
                                    ),
                                  }
                                : b,
                          ),
                        })
                      }
                    >
                      ✕ Remove item
                    </button>
                  </GlowCard>
                ))}
              </AccordionSection>
            );
          })}

          <AccordionSection
            id="custom-legacy"
            title="Additional free-form sections"
            expanded={expanded.has('custom-legacy')}
            onToggle={() => toggleAccordion('custom-legacy')}
            onFocusSection={() => jumpToSection('custom-legacy')}
            {...sectionVisibilityUi('custom-legacy')}
            right={
              <button
                type="button"
                className="text-xs font-semibold text-[#00C9B1]"
                onClick={() =>
                  update({
                    customSections: [
                      ...data.customSections,
                      { id: newLocalId(), title: '', body: '' },
                    ],
                  })
                }
              >
                + Add section
              </button>
            }
          >
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              Extra titled blocks (title + body). Use when you want a simple
              section not tied to upload parsing.
            </p>
            {data.customSections.map((c) => (
              <GlowCard
                key={c.id}
                className="mb-3 last:mb-0"
                contentClassName="p-4"
              >
                <Field
                  label="Section title"
                  value={normalizeText(c.title as unknown)}
                  onChange={(v) =>
                    update({
                      customSections: data.customSections.map((x) =>
                        x.id === c.id ? { ...x, title: v } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('custom-legacy')}
                />
                <label className="mb-1 mt-2 block text-xs text-white/45">
                  Content
                </label>
                <textarea
                  className={cn(fieldClass, 'min-h-[100px]')}
                  value={normalizeText(c.body as unknown)}
                  onChange={(e) =>
                    update({
                      customSections: data.customSections.map((x) =>
                        x.id === c.id ? { ...x, body: e.target.value } : x,
                      ),
                    })
                  }
                  onFocus={() => jumpToSection('custom-legacy')}
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-white/45 hover:text-[#EF4444]"
                  onClick={() =>
                    update({
                      customSections: data.customSections.filter(
                        (x) => x.id !== c.id,
                      ),
                    })
                  }
                >
                  ✕ Remove section
                </button>
              </GlowCard>
            ))}
          </AccordionSection>
        </>
      </div>
    </div>
  );

  const previewDoc = useMemo(
    () => (
      <CVDocumentPreview
        data={ensureCvPreviewData(data)}
        template={template}
        activeSection={activeSection}
        existingSections={existingSections}
        sectionVisibility={sectionVisibility}
        diffSection={diffSection}
        diffBefore={diffBefore}
        diffAfter={diffAfter}
        diffChangedFields={diffChangedFields}
        diffMultiSection={diffMultiSection}
        onAcceptDiff={onAcceptDiff}
        onRejectDiff={onRejectDiff}
        diffActionsDisabled={diffActionsDisabled}
        isEditing={mode === 'dashboard'}
        onUpdate={mode === 'dashboard' ? (patch) => update(patch) : undefined}
        optionalSectionPresence={
          mode === 'dashboard' ? optionalSectionPresence : undefined
        }
        sectionOrder={mode === 'dashboard' ? previewSectionOrder : undefined}
        onReorderSections={
          mode === 'dashboard' ? handlePreviewReorderSections : undefined
        }
      />
    ),
    [
      data,
      template,
      activeSection,
      existingSections,
      sectionVisibility,
      diffSection,
      diffBefore,
      diffAfter,
      diffChangedFields,
      diffMultiSection,
      onAcceptDiff,
      onRejectDiff,
      diffActionsDisabled,
      mode,
      update,
      optionalSectionPresence,
      previewSectionOrder,
      handlePreviewReorderSections,
    ],
  );

  const previewDocumentFrame = useMemo(
    () => (
      <div
        data-cv-document-root
        className={cn(
          'mx-auto w-full overflow-visible rounded-sm bg-white shadow-[0_4px_40px_rgba(0,0,0,0.4)]',
          showTripleShell ? 'max-w-full' : 'max-w-[min(100%,820px)]',
          'max-lg:max-w-none max-lg:rounded-none max-lg:shadow-[0_2px_24px_rgba(0,0,0,0.35)]',
        )}
        style={{ minHeight: '297mm' }}
        onClick={(e) => {
          if (mode !== 'dashboard') return;
          const t = e.target as HTMLElement;
          if (!t.closest('[data-entry-id]')) {
            setFocusedEntryId(null);
            setFocusedEntrySection(null);
            if (!t.closest('[data-cv-section]')) {
              setFocusedPreviewSection(null);
            }
          }
        }}
      >
        <div
          className={cn(mode === 'dashboard' ? '' : 'origin-top scale-[0.95]')}
        >
          {mode === 'dashboard' ? (
            <CVEditProvider value={cvEditContextValue}>
              {previewDoc}
            </CVEditProvider>
          ) : (
            previewDoc
          )}
        </div>
      </div>
    ),
    [showTripleShell, mode, cvEditContextValue, previewDoc],
  );

  const improvementDiffTruthBlock =
    mode === 'dashboard' && improvementDiffTruthPanel && diffSection ? (
      <CvImprovementDiffTruthPanel
        meta={improvementDiffTruthfulness ?? {}}
        performance={improvementDiffPerformance}
        className="max-lg:mx-0"
      />
    ) : null;

  const previewPanel = (
    <div
      className={cn(
        'flex min-h-0 flex-col bg-[#080A0A]',
        mode === 'dashboard'
          ? isTailorView
            ? 'h-full min-h-0 flex-1'
            : 'max-lg:h-full max-lg:min-h-0 max-lg:flex-1 max-lg:max-h-none min-h-0 lg:max-h-[min(62dvh,560px)]'
          : 'max-h-[min(78vh,820px)] lg:max-h-[min(calc(100dvh-10rem),960px)]',
      )}
    >
      {mode === 'onboarding' ? (
        <div className="sticky top-0 z-10 shrink-0 border-b border-white/10 bg-[#080A0A]/95 px-4 py-3 backdrop-blur-md lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
              Preview
            </p>
            {tplPills}
          </div>
        </div>
      ) : null}
      <div
        data-lenis-prevent-wheel
        className={cn(
          'cv-scroll-hide scroll-content-end-pad min-h-0 flex-1 overflow-x-visible overflow-y-auto overscroll-y-contain p-4 lg:p-6',
          mode === 'dashboard' && 'max-lg:px-2 max-lg:pb-32',
        )}
      >
        {improvementDiffTruthBlock}
        {previewDocumentFrame}
      </div>
    </div>
  );

  const filled = useMemo(() => countFilledSections(data), [data]);
  const editorOverlayZ = isTailorView ? TAILOR_CV_EDITOR_OVERLAY_Z : 55;
  const editorDialogZ = isTailorView ? TAILOR_CV_EDITOR_DIALOG_Z : 60;
  const confirmModalZ = isTailorView ? TAILOR_CV_PORTAL_Z : undefined;

  const builderTree = (
    <div
      className={cn(
        'flex h-full w-full min-h-0 min-w-0 max-w-full flex-col',
        mode === 'onboarding' && 'min-h-0 flex-1',
        mode === 'dashboard' &&
          showTripleShell &&
          'min-h-0 flex-1 overflow-hidden',
        mode === 'dashboard' &&
          !showTripleShell &&
          'max-lg:h-full max-lg:min-h-0 max-lg:flex-1',
      )}
    >
      {!showTripleShell ? (
        <div
          ref={splitRowRef}
          style={
            {
              ['--cv-editor-width' as string]: `${editorWidthPct}%`,
            } as CSSProperties
          }
          className={cn(
            'flex min-h-0 w-full min-w-0 max-w-full flex-col gap-4',
            'lg:flex-row lg:items-stretch lg:gap-0',
            mode === 'onboarding' && 'lg:min-h-[calc(100dvh-12rem)] lg:flex-1',
            mode === 'dashboard' &&
              'max-lg:h-full max-lg:min-h-0 max-lg:flex-1 lg:min-h-0',
          )}
        >
          <div
            className={cn(
              'flex gap-2 border-b border-white/10 pb-2',
              mode === 'dashboard' ? 'hidden' : 'lg:hidden',
            )}
          >
            <button
              type="button"
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold',
                mobileTab === 'edit'
                  ? 'bg-[#00C9B1]/15 text-[#00C9B1]'
                  : 'text-white/45',
              )}
              onClick={() => setMobileTab('edit')}
            >
              ✏ Edit
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold',
                mobileTab === 'preview'
                  ? 'bg-[#00C9B1]/15 text-[#00C9B1]'
                  : 'text-white/45',
              )}
              onClick={() => setMobileTab('preview')}
            >
              👁 Preview
            </button>
          </div>

          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-col',
              mode === 'dashboard' && 'hidden',
              mode === 'onboarding' && 'min-h-[min(70dvh,520px)] lg:min-h-0',
              mode === 'onboarding' &&
                (mobileTab === 'edit' ? 'block' : 'hidden lg:flex'),
              'w-full lg:w-[var(--cv-editor-width)] lg:min-w-[16rem] lg:max-w-[62%] lg:shrink-0 lg:grow-0',
              mode === 'dashboard' &&
                editorExpanded &&
                usePortaledExpandedEditor &&
                'hidden',
              mode === 'dashboard' &&
                editorExpanded &&
                !usePortaledExpandedEditor &&
                'lg:fixed lg:inset-x-[max(1rem,4vw)] lg:top-16 lg:z-[60] lg:mx-auto lg:ml-0 lg:w-auto lg:max-w-[min(48rem,92vw)] lg:rounded-2xl lg:border lg:border-[rgba(0,201,177,0.22)] lg:bg-[#0C0F0F] lg:shadow-[0_24px_80px_rgba(0,0,0,0.55)]',
            )}
          >
            {!(
              mode === 'dashboard' &&
              editorExpanded &&
              usePortaledExpandedEditor
            )
              ? leftPanel
              : null}
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and preview"
            aria-valuenow={Math.round(editorWidthPct)}
            aria-valuemin={CV_SPLIT_MIN_PCT}
            aria-valuemax={CV_SPLIT_MAX_PCT}
            title="Drag to resize · Double-click to reset"
            className={cn(
              'group relative z-10 hidden w-4 shrink-0 cursor-col-resize touch-none select-none flex-col items-center justify-center px-0.5 lg:flex',
              mode === 'dashboard' && 'hidden',
              mode === 'dashboard' && editorExpanded && 'lg:hidden',
            )}
            onPointerDown={onSplitResizePointerDown}
            onDoubleClick={onSplitHandleDoubleClick}
          >
            <div
              className="pointer-events-none h-full min-h-[10rem] w-px flex-1 rounded-full bg-gradient-to-b from-transparent via-white/[0.18] to-transparent transition-colors duration-150 group-hover:via-[#00C9B1]/50"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.14] ring-1 ring-white/[0.08] transition-colors hover:bg-[#00C9B1]/35"
              aria-hidden
            />
          </div>

          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col',
              mode === 'dashboard'
                ? 'max-lg:flex max-lg:h-full max-lg:min-h-0 max-lg:flex-1 lg:min-h-0'
                : '',
              mode === 'dashboard'
                ? 'flex'
                : mobileTab === 'preview'
                  ? 'block'
                  : 'hidden lg:flex',
              mode === 'dashboard' && editorExpanded && 'lg:hidden',
            )}
          >
            {previewPanel}
          </div>
        </div>
      ) : tripleColumn ? (
        <div
          ref={tripleColumn.containerRef}
          className="mt-0 flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.06] max-lg:h-full max-lg:min-h-0 max-lg:rounded-none max-lg:border-0"
        >
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-row overflow-hidden max-lg:flex-col">
            <CvTripleShellPreviewColumn
              centerHeaderActions={tripleColumn.centerHeaderActions}
              previewFrame={
                <>
                  {improvementDiffTruthBlock}
                  {previewDocumentFrame}
                </>
              }
            />
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize preview and insights columns"
              onPointerDown={
                tripleColumn.rightCollapsed
                  ? undefined
                  : tripleColumn.onRightResizePointerDown
              }
              className={cn(
                'w-1 shrink-0 cursor-col-resize bg-white/[0.04] transition-colors hover:bg-[#00C9B1]/40 max-lg:hidden',
                tripleColumn.rightCollapsed && 'pointer-events-none opacity-40',
              )}
            />
            <div
              style={{
                flex: tripleColumn.rightCollapsed
                  ? '0 0 0px'
                  : `0 0 ${tripleColumn.rightPct}%`,
              }}
              className={cn(
                'flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-l border-white/[0.07] bg-[#0C0F0F] transition-opacity duration-300 ease-out max-lg:hidden',
                !tripleColumn.rightCollapsed &&
                  'min-w-[300px] xl:min-w-[320px]',
                tripleColumn.rightCollapsed
                  ? 'border-l-0 opacity-0'
                  : 'opacity-100',
              )}
            >
              {!tripleColumn.rightCollapsed
                ? (tripleColumnRightSlot ?? tripleColumn.rightSlot ?? null)
                : null}
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'dashboard' &&
      editorExpanded &&
      usePortaledExpandedEditor &&
      portalHost
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 bg-black/65"
                style={{ zIndex: editorOverlayZ }}
                aria-label="Close expanded editor"
                onClick={() => setEditorExpanded(false)}
              />
              <div
                className="fixed left-1/2 top-1/2 flex max-h-[min(85vh,720px)] w-[min(48rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[rgba(0,201,177,0.22)] bg-[#0C0F0F] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                style={{ zIndex: editorDialogZ }}
                role="dialog"
                aria-modal="true"
                aria-label="Expanded CV editor"
              >
                {leftPanel}
              </div>
            </>,
            portalHost,
          )
        : null}

      {mode === 'dashboard' && editorExpanded && !usePortaledExpandedEditor ? (
        <button
          type="button"
          className="fixed inset-0 z-[55] hidden bg-black/65 lg:block"
          aria-label="Close expanded editor"
          onClick={() => setEditorExpanded(false)}
        />
      ) : null}

      {mode === 'onboarding' ? (
        <div className="mt-6 flex w-full flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="text-sm text-white/45 hover:text-white"
            onClick={() => void onSkip?.()}
          >
            Skip for now →
          </button>
          <Button
            disabled={!canFinishOnboarding}
            onClick={() => void onComplete?.(data)}
            className="sm:min-w-[200px]"
          >
            Finish & Continue →
          </Button>
          <p className="text-[11px] text-white/25">
            {filled} sections with content
          </p>
        </div>
      ) : null}

      <ConfirmModal
        open={removeTarget !== null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Remove entry?"
        description="This cannot be undone."
        confirmLabel="Remove"
        layerZIndex={confirmModalZ}
        onConfirm={() => {
          if (!removeTarget) return;
          if (removeTarget.kind === 'exp') {
            update({
              experience: {
                items: experienceItems.filter((x) => x.id !== removeTarget.id),
              },
            });
          }
          if (removeTarget.kind === 'edu') {
            update({
              education: {
                items: educationItems.filter((x) => x.id !== removeTarget.id),
              },
            });
          }
          setRemoveTarget(null);
        }}
      />
    </div>
  );

  const diffActionBarSectionId =
    cvDiffPreviewBuilderSection(diffSection) ||
    (diffMultiSection && diffChangedFields?.length
      ? (diffChangedFields[0]?.fieldPath ?? '').trim()
      : '');
  const diffActionBar = (
    <CvDiffMobileActionBar
      visible={Boolean(
        diffActionBarSectionId && onAcceptDiff && onRejectDiff,
      )}
      sectionId={diffActionBarSectionId || null}
      disabled={diffActionsDisabled}
      onAccept={() => onAcceptDiff?.()}
      onReject={() => onRejectDiff?.()}
    />
  );

  if (isTailorView) {
    return (
      <CvOverlayLayerProvider zIndex={TAILOR_CV_PORTAL_Z}>
        {builderTree}
        {diffActionBar}
      </CvOverlayLayerProvider>
    );
  }
  return (
    <>
      {builderTree}
      {diffActionBar}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  onFocus,
  type = 'text',
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/45">{label}</label>
      <input
        type={type}
        className={fieldClass}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
      />
    </div>
  );
}

function TagInput({
  skills,
  onChange,
  onFocus,
  label = 'Skills',
  hint = 'Type a skill, then press Enter on your keyboard (or type a comma) to add it as a tag.',
}: {
  skills: string[];
  onChange: (s: string[]) => void;
  onFocus?: () => void;
  label?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <label className="mb-1 block text-xs text-white/45">{label}</label>
      <p className="mb-1.5 text-[10px] leading-snug text-white/30">{hint}</p>
      <div className="flex flex-wrap gap-1 rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0c1010] p-2">
        {skills.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-[#00C9B1]/15 px-2 py-0.5 text-[11px] text-[#00C9B1]"
          >
            {s}
            <button
              type="button"
              className="text-white/50 hover:text-white"
              onClick={() => onChange(skills.filter((x) => x !== s))}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="min-w-[120px] flex-1 bg-transparent text-sm text-white outline-none"
          value={draft}
          onFocus={onFocus}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) {
              const parts = v.split(',');
              const completed = parts
                .slice(0, -1)
                .map((s) => s.trim())
                .filter(Boolean);
              const rest = parts[parts.length - 1] ?? '';
              if (completed.length) {
                const merged = [...skills];
                for (const skill of completed) {
                  if (!merged.includes(skill)) merged.push(skill);
                }
                onChange(merged);
              }
              setDraft(rest);
              return;
            }
            setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const t = draft.trim();
              if (t && !skills.includes(t)) onChange([...skills, t]);
              setDraft('');
            }
          }}
        />
      </div>
    </div>
  );
}

function AccordionSection({
  id,
  title,
  expanded,
  onToggle,
  onFocusSection,
  children,
  right,
  sectionHiddenStyle,
  visibilityToggle,
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onFocusSection: () => void;
  children: ReactNode;
  right?: ReactNode;
  /** When true, header title shows reduced opacity + strikethrough + Hidden badge. */
  sectionHiddenStyle?: boolean;
  visibilityToggle?: {
    visible: boolean;
    busy?: boolean;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  };
}) {
  return (
    <div id={`cv-section-${id}`} className="scroll-mt-20">
      <GlowCard className="mb-3 hover:!translate-y-0" contentClassName="p-0">
        <div className="flex w-full items-center gap-1 px-4 py-3">
          <button
            type="button"
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2 text-left transition-opacity',
              sectionHiddenStyle && 'opacity-40',
            )}
            onClick={() => {
              onToggle();
              onFocusSection();
            }}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition',
                expanded ? 'rotate-0' : '-rotate-90',
              )}
            />
            <span
              className={cn(
                'text-sm font-semibold text-white',
                sectionHiddenStyle && 'line-through decoration-white/35',
              )}
            >
              {title}
            </span>
            {sectionHiddenStyle ? (
              <span
                className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                Hidden
              </span>
            ) : null}
          </button>
          {visibilityToggle ? (
            <button
              type="button"
              title={visibilityToggle.visible ? 'Hide from CV' : 'Show in CV'}
              disabled={visibilityToggle.busy}
              onClick={visibilityToggle.onClick}
              className="shrink-0 rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: visibilityToggle.visible
                  ? 'rgba(255,255,255,0.4)'
                  : 'rgba(255,255,255,0.15)',
              }}
            >
              {visibilityToggle.busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : visibilityToggle.visible ? (
                <Eye size={14} />
              ) : (
                <EyeOff size={14} />
              )}
            </button>
          ) : null}
          {right ? (
            <div className="flex shrink-0 items-center gap-2">{right}</div>
          ) : null}
        </div>
        {expanded ? (
          <div
            className="border-t border-white/10 px-4 pb-4 pt-2"
            onFocusCapture={onFocusSection}
          >
            {children}
          </div>
        ) : null}
      </GlowCard>
    </div>
  );
}
