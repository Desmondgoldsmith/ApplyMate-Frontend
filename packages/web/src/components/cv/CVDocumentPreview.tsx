'use client';

import { EB_Garamond, DM_Sans, Inter } from 'next/font/google';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  GripVertical,
  Upload,
  X as XIcon,
  Phone as PhoneIcon,
  Mail as MailIcon,
  MapPin as MapPinIcon,
} from 'lucide-react';

import {
  filterCvBuilderReferences,
  normalizeBullets,
  newLocalId,
  ensureCvPreviewData,
  type CVBuilderData,
  type CVBuilderLanguage,
  type CvTemplateId,
} from '@/lib/cvBuilder';
import { CvEditableReferencesList } from '@/components/cv/CvEditableReferencesList';
import {
  filterParsedCustomSectionsForEditor,
  shouldRenderCustomLegacySection,
  orderedParsedPreviewKeys,
  parsedCustomMainPlaceholder,
} from '@/lib/cvParsedCustomSectionUtils';
import type { CVSectionRecord } from '@/lib/api';
import {
  dedupePreviewSectionKeys,
  DEFAULT_PREVIEW_DRAG_SECTION_ORDER,
} from '@/lib/cvSectionProfessionalOrder';

import { DEFAULT_HEADER_PREVIEW, useCVEdit } from '@/components/cv/CVEditContext';
import { CVSectionWrapper } from '@/components/cv/CVSectionWrapper';
import {
  dispatchSectionDragEnd,
  getActiveDraggingSectionId,
  SECTION_REORDER_DROP_EVENT_NAME,
  setActiveDraggingSectionId,
  type SectionReorderDropDetail,
} from '@/components/cv/cvSectionDrag';
import { HeaderFloatingControls } from '@/components/cv/HeaderFloatingControls';
import { OnyxCvDocument } from '@/components/cv/templates/OnyxCvDocument';
import { InlineField } from '@/components/cv/InlineField';
import { InlineSkillsCommaField } from '@/components/cv/InlineSkillsCommaField';
import { SkillsRichComma } from '@/components/cv/SkillsRichComma';
import { persistSectionTitleChange, resolveSectionDisplayTitle } from '@/lib/cvSectionTitlePersist';
import { EntryToolbar } from '@/components/cv/EntryToolbar';
import { useToast } from '@/components/ui/Toast';
import { CvAiPatchDiffView } from '@/components/cv/CvAiPatchDiffView';
import { CvDiffActionsBusyContext, CvDiffActionPair } from '@/components/cv/cvDiffImprovementActions';
import { cvDiffFieldDisplayText } from '@/lib/cvAiPatchDisplay';
import { CV_DIFF_EMPTY_PREVIEW_MESSAGE, CV_DIFF_STRUCTURAL_SECTION_MESSAGE } from '@/lib/cvDiffCopy';
import {
  gCvDocPreviewDiffMultiSection,
  gCvDocPreviewStructuralAfter,
  gCvDocPreviewStructuralBefore,
  resolveCvPreviewSectionDiff,
  setCvDocumentPreviewDiffContext,
  type CvPreviewChangedField,
} from '@/lib/cvDocumentPreviewDiffContext';
import { cvStructuralDiffPayloadPresent } from '@/lib/cvDiffPreviewMap';
import { compressImageFileToCvDataUrl, CV_PHOTO_TOO_LARGE_USER_MESSAGE } from '@/lib/cvPhotoCompress';
import {
  formatCvDateLabel,
  formatCvPeriod,
  formatCvPeriodEnDash,
  formatEduRange,
  formatEduRangeStacked,
  splitCvStoredRange,
} from '@/lib/cvDate';
import { normalizeEditableHtml, richTextPlainText } from '@/lib/cvRichTextCore';
import { toPreviewRichTextHtml } from '@/lib/cvRichTextPreview';
import { cn } from '@/lib/utils';

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

/** Matches PDF/HTML export footer watermark (`html.builder` parity). */
function CvPreviewWatermarkFooter() {
  return (
    <div
      className="mt-8 border-t border-solid border-[#f0f0f0] pt-2 text-center text-[8px] leading-normal text-[#cccccc]"
      style={{ fontFamily: 'Arial, sans-serif' }}
      aria-hidden
    >
      ApplyMate
    </div>
  );
}

/** Accordion / preview section keys — aligns with CVBuilder `activeSection` ids. */
export type CVSectionVisibilityMap = Record<string, boolean>;

export function isCvSectionVisible(sectionKey: string, map?: CVSectionVisibilityMap | null): boolean {
  if (!map) return true;
  return map[sectionKey] !== false;
}

/**
 * Core sections (Summary, Experience, Education, Skills) cannot be deleted from the preview —
 * the previous backend hide path proved unreliable, so the trash button is suppressed for these
 * ids. Optional sections (projects, certifications, languages, references, custom_*) keep
 * their existing add/delete behavior.
 */
const CORE_SECTION_IDS = new Set(['summary', 'experience', 'education', 'projects', 'skills']);
function isCoreSectionId(sectionId: string): boolean {
  return CORE_SECTION_IDS.has(sectionId);
}


/** Reorders a full preview section-key list (includes custom-legacy and parsed-* ids). */
export function reorderSectionKeys(sourceOrder: string[], dragId: string, targetId: string): string[] | null {
  if (!dragId || dragId === targetId) return null;
  const base = dedupePreviewSectionKeys([...sourceOrder]);
  if (!base.includes(dragId)) base.push(dragId);
  if (!base.includes(targetId)) base.push(targetId);
  const from = base.indexOf(dragId);
  const to = base.indexOf(targetId);
  if (from < 0 || to < 0) return null;
  const next = [...base];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

type ChangedField = CvPreviewChangedField;

export { CV_DIFF_EMPTY_PREVIEW_MESSAGE } from '@/lib/cvDiffCopy';

type CVDocumentPreviewProps = {
  data: CVBuilderData;
  template: CvTemplateId;
  existingSections?: CVSectionRecord[];
  activeSection?: string | null;
  /** When set, sections with value `false` are omitted from the preview. */
  sectionVisibility?: CVSectionVisibilityMap | null;
  diffSection?: string | null;
  diffBefore?: unknown;
  diffAfter?: unknown;
  diffChangedFields?: ChangedField[] | null;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  /** When set with {@link CVEditProvider}, preview fields become inline-editable. */
  onUpdate?: (patch: Partial<CVBuilderData>) => void;
  isEditing?: boolean;
  /** When set (dashboard), optional sections are shown if present on the profile even when empty. */
  optionalSectionPresence?: Set<string>;
  /** Optional ordered preview section ids for draggable arrangement. */
  sectionOrder?: string[];
  /** Called when section order is changed by drag-drop. */
  onReorderSections?: (nextOrder: string[]) => void;
  /** Disables improvement diff Accept/Reject while the parent handles accept/reject API calls. */
  diffActionsDisabled?: boolean;
  /** When true, show inline diff on every section listed in `diffChangedFields` (global assistant). */
  diffMultiSection?: boolean;
};

export function CVDocumentPreview({
  data,
  template,
  existingSections,
  activeSection,
  sectionVisibility,
  diffSection,
  diffBefore,
  diffAfter,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
  onUpdate: _onUpdate,
  isEditing: _isEditing,
  optionalSectionPresence,
  sectionOrder,
  onReorderSections,
  diffActionsDisabled = false,
  diffMultiSection = false,
}: CVDocumentPreviewProps) {
  setCvDocumentPreviewDiffContext({
    structuralBefore: diffBefore,
    structuralAfter: diffAfter,
    multiSection: diffMultiSection,
  });
  const previewData = ensureCvPreviewData(data);
  const existingSectionPresence = new Set((existingSections ?? []).map((s) => s.type.toLowerCase()));
  const mergedOptionalPresence = new Set([...(optionalSectionPresence ?? new Set<string>()), ...existingSectionPresence]);
  const vis = sectionVisibility ?? undefined;
  const wrapBusy = (node: React.ReactNode) => (
    <CvDiffActionsBusyContext.Provider value={diffActionsDisabled}>{node}</CvDiffActionsBusyContext.Provider>
  );
  if (template === 'onyx') {
    return wrapBusy(
      <OnyxCvDocument
        data={previewData}
        activeSection={activeSection}
        sectionVisibility={vis}
        diffSection={diffSection}
        diffChangedFields={diffChangedFields}
        onAcceptDiff={onAcceptDiff}
        onRejectDiff={onRejectDiff}
        optionalSectionPresence={mergedOptionalPresence}
        sectionOrder={sectionOrder}
        onReorderSections={onReorderSections}
      />,
    );
  }
  if (template === 'modern') {
    return wrapBusy(
      <ModernDoc
        data={previewData}
        activeSection={activeSection}
        sectionVisibility={vis}
        diffSection={diffSection}
        diffChangedFields={diffChangedFields}
        onAcceptDiff={onAcceptDiff}
        onRejectDiff={onRejectDiff}
        optionalSectionPresence={mergedOptionalPresence}
        sectionOrder={sectionOrder}
        onReorderSections={onReorderSections}
      />,
    );
  }
  if (template === 'creative') {
    return wrapBusy(
      <CreativeDoc
        data={previewData}
        activeSection={activeSection}
        sectionVisibility={vis}
        diffSection={diffSection}
        diffChangedFields={diffChangedFields}
        onAcceptDiff={onAcceptDiff}
        onRejectDiff={onRejectDiff}
        optionalSectionPresence={mergedOptionalPresence}
        sectionOrder={sectionOrder}
        onReorderSections={onReorderSections}
      />,
    );
  }
  if (template === 'professional') {
    return wrapBusy(
      <ProfessionalDoc
        data={previewData}
        activeSection={activeSection}
        sectionVisibility={vis}
        diffSection={diffSection}
        diffChangedFields={diffChangedFields}
        onAcceptDiff={onAcceptDiff}
        onRejectDiff={onRejectDiff}
        optionalSectionPresence={mergedOptionalPresence}
        sectionOrder={sectionOrder}
        onReorderSections={onReorderSections}
      />,
    );
  }
  return wrapBusy(
    <ClassicDoc
      data={previewData}
      activeSection={activeSection}
      sectionVisibility={vis}
      diffSection={diffSection}
      diffChangedFields={diffChangedFields}
      onAcceptDiff={onAcceptDiff}
      onRejectDiff={onRejectDiff}
      optionalSectionPresence={mergedOptionalPresence}
      sectionOrder={sectionOrder}
      onReorderSections={onReorderSections}
    />,
  );
}

function optionalSectionShown(presence: Set<string> | undefined, type: string, hasRows: boolean): boolean {
  if (!presence) return hasRows;
  return presence.has(type) || hasRows;
}

function EditableHeaderPhoto({
  photoUrl,
  imgClassName,
  align = 'center',
}: {
  photoUrl: string;
  imgClassName: string;
  align?: 'center' | 'end';
}) {
  const ctx = useCVEdit();
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(ctx?.isEditing);
  const toast = useToast();

  const replace = () => fileRef.current?.click();
  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !ctx?.onUpdate) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error(CV_PHOTO_TOO_LARGE_USER_MESSAGE);
      return;
    }
    void (async () => {
      try {
        const url = await compressImageFileToCvDataUrl(file);
        ctx.onUpdate({ personal: { ...ctx.data.personal, photoUrl: url } });
        ctx.setHeaderPreview?.({ showPhoto: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : CV_PHOTO_TOO_LARGE_USER_MESSAGE;
        toast.error(msg);
      }
    })();
  };

  const remove = () => {
    if (!ctx?.onUpdate) return;
    ctx.onUpdate({ personal: { ...ctx.data.personal, photoUrl: '' } });
    ctx.setHeaderPreview?.({ showPhoto: false });
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files)} />
      <div className={cn('mb-2 flex', align === 'end' ? 'justify-end' : 'justify-center')}>
        <div className="group relative inline-block">
          <img src={photoUrl.trim()} alt="" className={imgClassName} />
          {editing ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-[inherit] bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <button
                type="button"
                className="rounded-lg bg-[#00C9B1] p-2 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  replace();
                }}
                aria-label="Replace photo"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-500 p-2 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  remove();
                }}
                aria-label="Remove photo"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** Matches CVBuilder `jumpToSection(sid, itemId)` → `activeSection` value `experience::<jobId>`. */
const CV_PREVIEW_ITEM_SEP = '::';

function experienceOuterSectionActive(activeSection: string | null | undefined): boolean {
  return activeSection === 'experience';
}

function experienceItemWrapClass(activeSection: string | null | undefined, jobId: string) {
  const itemKey = `experience${CV_PREVIEW_ITEM_SEP}${jobId}`;
  const itemActive = activeSection === itemKey;
  return cn(
    'relative rounded-[4px] transition-[box-shadow] duration-200',
    itemActive ? 'ring-1 ring-inset ring-[rgba(0,201,177,0.35)]' : '',
  );
}

function addButtonVisibilityClass(activeSection: string | null | undefined, sectionId: string): string {
  const itemPrefix = `${sectionId}${CV_PREVIEW_ITEM_SEP}`;
  const active = activeSection === sectionId || Boolean(activeSection?.startsWith(itemPrefix));
  return cn('opacity-0 transition-opacity duration-200 group-hover:opacity-100', active && 'opacity-100');
}

function sectionBox(
  id: string,
  activeSection: string | null | undefined,
  className: string,
  children: ReactNode,
  diffSection?: string | null,
  changedFields?: ChangedField[] | null,
  onAccept?: (changeIndex?: number) => void,
  onReject?: (changeIndex?: number) => void,
  isOuterSectionActive?: (active: string | null | undefined) => boolean,
) {
  const isActive = isOuterSectionActive ? isOuterSectionActive(activeSection) : activeSection === id;
  const { isDiff, fields: sectionChangedFields, sectionDiffIndex } =
    resolveCvPreviewSectionDiff(id, diffSection, changedFields);
  const hasChanges = isDiff && sectionChangedFields && sectionChangedFields.length > 0;
  const sectionDiffCallbackIndex =
    sectionDiffIndex != null && sectionDiffIndex >= 0
      ? sectionDiffIndex
      : undefined;
  const structuralPresent = cvStructuralDiffPayloadPresent(
    gCvDocPreviewStructuralBefore,
    gCvDocPreviewStructuralAfter,
  );
  const showEmptyDiffFallback =
    isDiff && (!changedFields || changedFields.length === 0) && !structuralPresent;
  const showStructuralSectionFallback =
    isDiff && (!changedFields || changedFields.length === 0) && structuralPresent;
  const formatDiffTitle = (field: string) => {
    const base = field.trim().replace(/\s*[-/]\s*/g, ' · ');
    const bulletMatch = base.match(/(.*?)(?:\s*[·|]\s*)?bullet\s*(\d+)/i);
    if (bulletMatch) {
      const left = bulletMatch[1]?.trim() || 'Experience';
      const idx = bulletMatch[2];
      return `${left} · Bullet ${idx}`;
    }
    return base || 'AI suggested update';
  };

  return (
    <div
      id={`cv-preview-${id}`}
      style={{ breakInside: 'avoid-page', pageBreakInside: 'avoid' }}
      className={cn(
        'relative transition-[box-shadow] duration-200',
        isActive && !isDiff ? 'rounded-[4px] ring-1 ring-inset ring-[rgba(0,201,177,0.35)]' : '',
        isDiff ? 'rounded-[4px] pb-1' : '',
        className,
      )}
    >
      {isDiff && (
        <div className="absolute -top-5 right-0 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          AI suggested change
        </div>
      )}
      {children}
      {showStructuralSectionFallback && (
        <div className="mx-1 mt-2 rounded-xl border border-[#10B981]/35 bg-white p-3 text-[10px] leading-relaxed text-[#065F46] shadow-[0_1px_0_rgba(16,185,129,0.08)]">
          <p className="mb-3 text-[11px] leading-snug">{CV_DIFF_STRUCTURAL_SECTION_MESSAGE}</p>
          <CvDiffActionPair
            className="flex items-center justify-end gap-1.5"
            rejectLabel="✕ Reject all"
            acceptLabel="✓ Accept all"
            onReject={() => onReject?.(sectionDiffCallbackIndex)}
            onAccept={() => onAccept?.(sectionDiffCallbackIndex)}
          />
        </div>
      )}
      {showEmptyDiffFallback && (
        <div className="mx-1 mt-2 rounded-xl border border-[#10B981]/35 bg-white p-3 text-[10px] leading-relaxed text-[#065F46] shadow-[0_1px_0_rgba(16,185,129,0.08)]">
          <p className="mb-3 text-[11px] leading-snug">{CV_DIFF_EMPTY_PREVIEW_MESSAGE}</p>
          <CvDiffActionPair
            className="flex items-center justify-end gap-1.5"
            rejectLabel="✕ Reject all"
            acceptLabel="✓ Accept all"
            onReject={() => onReject?.(sectionDiffCallbackIndex)}
            onAccept={() => onAccept?.(sectionDiffCallbackIndex)}
          />
        </div>
      )}
      {hasChanges && (
        <div className="mx-1 mt-2 rounded-xl border border-[#10B981]/35 bg-white p-3 text-[10px] leading-relaxed shadow-[0_1px_0_rgba(16,185,129,0.08)]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#047857]">
            AI Suggested Changes
          </p>
          {sectionChangedFields!.map((cf, i) => {
            const sectionHint = id;
            const beforeDisplay = cvDiffFieldDisplayText(
              cf.before,
              sectionHint,
              cf.fieldPath ?? cf.field ?? '',
            );
            const afterDisplay = cvDiffFieldDisplayText(
              cf.after,
              sectionHint,
              cf.fieldPath ?? cf.field ?? '',
            );
            const fieldCallbackIndex =
              sectionDiffCallbackIndex ??
              cf.sectionDiffIndex ??
              (sectionChangedFields!.length === 1 ? undefined : i);
            return (
            <div key={i} className="mb-2.5 rounded-lg border border-[#22C55E]/35 bg-[#ECFDF5] p-2.5 last:mb-0">
              <CvAiPatchDiffView
                title={formatDiffTitle((cf.fieldLabel ?? cf.fieldPath ?? cf.field ?? '').trim())}
                before={beforeDisplay}
                after={afterDisplay}
                compact
              />
              <CvDiffActionPair
                className="mt-2 flex items-center justify-end gap-1.5"
                rejectLabel="✕ Reject"
                acceptLabel="✓ Accept"
                onReject={() => onReject?.(fieldCallbackIndex)}
                onAccept={() => onAccept?.(fieldCallbackIndex)}
              />
            </div>
            );
          })}
          {sectionChangedFields!.length > 1 ? (
          <CvDiffActionPair
            className="mt-3 flex items-center justify-end gap-1.5"
            rejectLabel={
              gCvDocPreviewDiffMultiSection ? '✕ Reject section' : '✕ Reject all'
            }
            acceptLabel={
              gCvDocPreviewDiffMultiSection ? '✓ Accept section' : '✓ Accept all'
            }
            onReject={() => onReject?.(sectionDiffCallbackIndex)}
            onAccept={() => onAccept?.(sectionDiffCallbackIndex)}
          />
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatSidebarDateStack(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  // Treat as a range only when a separator has spaces around it.
  // This avoids splitting single-date formats like YYYY-MM.
  const m = t.match(/^(.*?)\s+[—–-]\s+(.*?)$/);
  if (!m || !m[1]?.trim() || !m[2]?.trim()) return t;
  return `${m[1].trim()}\n-\n${m[2].trim()}`;
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function skillsCommaList(skills: string[]): string {
  return skills.map((s) => stripHtmlTags(s)).filter(Boolean).join(', ');
}

function expertiseLine(data: CVBuilderData): string {
  const all = data.skills.categories.flatMap((c) =>
    c.skills.map((s) => stripHtmlTags(s)).filter(Boolean),
  );
  const top = all.slice(0, 8);
  if (top.length) return top.join('  |  ');
  return 'Frontend Engineering  |  Product Development  |  Performance Optimization';
}

/** Line-split project bullets (newline string or array from API). */
function projectBulletLines(bullets: string | undefined): string[] {
  return normalizeBullets(bullets);
}

function toLinesFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : String(v ?? '')))
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^[-•]\s*/, ''));
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^[-•]\s*/, ''));
  }
  return [];
}

function projectPayloadBullets(project: unknown): string[] {
  const p = (project ?? {}) as Record<string, unknown>;
  const candidates = [
    ...toLinesFromUnknown(p.bullets),
    ...toLinesFromUnknown(p.highlights),
    ...toLinesFromUnknown(p.points),
    ...toLinesFromUnknown(p.responsibilities),
    ...toLinesFromUnknown(p.achievements),
  ];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of candidates) {
    const clean = line.trim();
    const plain = stripHtmlTags(clean);
    if (!plain) continue;
    const key = plain.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(clean);
  }
  return deduped;
}

function normalizeBulletInput(value: string): string {
  return normalizeEditableHtml(value);
}

/** True when the contenteditable has no visible text at keydown time (React value can still lag until blur). */
function cvBulletFieldDomIsEmpty(e: { currentTarget: HTMLElement }): boolean {
  const t = (e.currentTarget.innerText || '').replace(/\u200b/g, '').replace(/\u00a0/g, ' ').trim();
  return t.length === 0;
}

function RichText({ text }: { text: string }) {
  return <span className="[&_a]:text-[#1D4ED8] [&_a]:underline" dangerouslySetInnerHTML={{ __html: toPreviewRichTextHtml(text) }} />;
}

function projectPayloadTech(project: unknown): string[] {
  const p = (project ?? {}) as Record<string, unknown>;
  const candidates = [p.technologies, p.tech, p.stack];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      const list = c
        .map((v) => (typeof v === 'string' ? v : String(v ?? '')))
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length > 0) return list;
    }
    if (typeof c === 'string') {
      const list = c
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length > 0) return list;
    }
  }
  return [];
}

/** Dedupe contact URLs for keys and header lines (website vs portfolio often duplicate). */
function normalizePersonalUrlKey(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  try {
    const href = t.startsWith('http') ? t : `https://${t}`;
    const u = new URL(href);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.host}${path}`.toLowerCase();
  } catch {
    return t.toLowerCase();
  }
}

function websitePortfolioRowVisibility(p: CVBuilderData['personal']): { showWebsite: boolean; showPortfolio: boolean } {
  const w = p.website?.trim() ?? '';
  const po = p.portfolio?.trim() ?? '';
  if (!po) return { showWebsite: Boolean(w), showPortfolio: false };
  if (!w) return { showWebsite: false, showPortfolio: true };
  return {
    showWebsite: true,
    showPortfolio: normalizePersonalUrlKey(w) !== normalizePersonalUrlKey(po),
  };
}

function ClassicSectionBand({ title }: { title: string }) {
  return (
    <div className="border-t border-b border-black py-1">
      <h2 className="text-center text-[9pt] font-bold uppercase tracking-[0.06em] text-black">{title}</h2>
    </div>
  );
}

/** Classic — editorial serif, double-ruled section bands (ATS-friendly) */
function ClassicDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
  optionalSectionPresence,
  sectionOrder,
  onReorderSections,
}: {
  data: CVBuilderData;
  activeSection?: string | null;
  sectionVisibility?: CVSectionVisibilityMap | null;
  diffSection?: string | null;
  diffChangedFields?: ChangedField[] | null;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  optionalSectionPresence?: Set<string>;
  sectionOrder?: string[];
  onReorderSections?: (nextOrder: string[]) => void;
}) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing);
  const hp = ctx?.headerPreview ?? DEFAULT_HEADER_PREVIEW;
  const [sectionTitleOverrides, setSectionTitleOverrides] = useState<Record<string, string>>({});
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  /**
   * Reconcile local hides with backend visibility — when a section becomes visible again
   * (e.g. user re-added/restored it via the Sections modal), clear it from the local hidden
   * set so the preview renders the section instantly without a manual refresh.
   */
  useEffect(() => {
    if (!sectionVisibility) return;
    setHiddenSections((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const key of prev) {
        if (sectionVisibility[key] === true) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sectionVisibility]);
  const draggingSectionIdRef = useRef<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [entryFieldVisibility, setEntryFieldVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const entryFieldOn = (entryKey: string, field: string) => entryFieldVisibility[entryKey]?.[field] ?? true;
  const setEntryFieldOn = (entryKey: string, field: string, enabled: boolean) => {
    setEntryFieldVisibility((prev) => ({
      ...prev,
      [entryKey]: {
        ...(prev[entryKey] ?? {}),
        [field]: enabled,
      },
    }));
  };

  const v = sectionVisibility;
  const vis = (key: string) => isCvSectionVisible(key, v) && !hiddenSections.has(key);
  const p = data.personal;
  const displayName = (p.name || '').trim() || 'Your Name';
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);

  const meaningfulExpCount = data.experience.items.filter((x) => x.title.trim() || x.company.trim()).length;
  const isRecentGrad = meaningfulExpCount <= 1;
  const sectionTitle = (sectionId: string, fallback: string) =>
    resolveSectionDisplayTitle(sectionId, fallback, data, sectionTitleOverrides);
  const sectionIsActive = (sectionId: string) =>
    ctx?.focusedSection === sectionId || ctx?.focusedEntrySection === sectionId;
  const reorderPreviewSections = (targetSectionId: string) => {
    /**
     * Local ref handles drops on the title bar; module-level fallback handles drops on the
     * section body (forwarded from `CVSectionWrapper` via `cv:section-reorder-drop`).
     */
    const draggingSectionId = draggingSectionIdRef.current ?? getActiveDraggingSectionId();
    if (!draggingSectionId || draggingSectionId === targetSectionId) return;
    const sourceOrder =
      sectionOrder && sectionOrder.length > 0 ? sectionOrder : [...DEFAULT_PREVIEW_DRAG_SECTION_ORDER];
    const next = reorderSectionKeys(sourceOrder, draggingSectionId, targetSectionId);
    if (!next) return;
    onReorderSections?.(next);
    draggingSectionIdRef.current = null;
  };
  useEffect(() => {
    if (!inline) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SectionReorderDropDetail>).detail;
      if (!detail?.targetSectionId) return;
      reorderPreviewSections(detail.targetSectionId);
    };
    window.addEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closure captures latest sectionOrder/onReorderSections via re-registration on those deps
  }, [inline, sectionOrder, onReorderSections]);
  const renderSectionTitle = (sectionId: string, fallback: string, onDeleteSection?: () => void) => {
    const titleEntryId = `__section-title__:${sectionId}`;
    const focused = ctx?.focusedEntryId === titleEntryId;
    return (
      <div
        className="mb-2.5"
        data-entry-id={titleEntryId}
        onDragOver={(e) => {
          if (!inline || !draggingSectionIdRef.current) return;
          e.preventDefault();
          setDragOverSectionId(sectionId);
        }}
        onDragLeave={() => {
          if (dragOverSectionId === sectionId) setDragOverSectionId(null);
        }}
        onDrop={(e) => {
          if (!inline) return;
          e.preventDefault();
          /** stopPropagation prevents CVSectionWrapper's drop listener from firing a second reorder. */
          e.stopPropagation();
          reorderPreviewSections(sectionId);
          setDragOverSectionId(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          ctx?.setFocusedSection(sectionId);
          ctx?.setFocusedEntryId(titleEntryId);
          ctx?.setFocusedEntrySection(sectionId);
        }}
      >
        {inline && dragOverSectionId === sectionId && draggingSectionIdRef.current !== sectionId ? (
          <div className="mb-1 rounded-md border-2 border-dashed border-[#00C9B1]/70 bg-[#00C9B1]/8 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#007A7A]">
            Drop section here
          </div>
        ) : null}
        {inline && focused ? (
          <EntryToolbar
            sectionType={sectionId}
            onAddEntry={() => {}}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            onDelete={() => {
              if (!onDeleteSection || isCoreSectionId(sectionId)) return;
              onDeleteSection();
              setHiddenSections((prev) => new Set(prev).add(sectionId));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cv:section-hidden', { detail: { sectionId } }));
              }
              ctx?.setFocusedEntryId(null);
              ctx?.setFocusedEntrySection(null);
            }}
            showMoveUp={false}
            showMoveDown={false}
            hideAddButton
            hideDelete={isCoreSectionId(sectionId)}
          />
        ) : null}
        <div className="border-b border-t border-black py-[5px]">
          <h2 className="relative flex items-center justify-center gap-1 text-center text-[10pt] font-bold uppercase leading-[1.1] tracking-[0.08em] text-black">
            {inline ? (
              <span
                role="button"
                tabIndex={0}
                title="Drag section to reorder"
                aria-label={`Drag ${fallback} section to reorder`}
                draggable
                className="absolute left-0 cursor-grab rounded-sm border border-[#00C9B1]/45 bg-white/95 p-0.5 text-[#00C9B1] shadow-sm shadow-[#00C9B1]/15 transition hover:border-[#00C9B1]/70 hover:bg-[#00C9B1]/10 hover:text-[#007A7A] active:cursor-grabbing"
                onMouseDown={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  draggingSectionIdRef.current = sectionId;
                  setActiveDraggingSectionId(sectionId);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', sectionId);
                }}
                onDragEnd={() => {
                  draggingSectionIdRef.current = null;
                  setActiveDraggingSectionId(null);
                  setDragOverSectionId(null);
                  dispatchSectionDragEnd();
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                }}
              >
                <GripVertical className="h-3.5 w-3.5" aria-hidden />
              </span>
            ) : null}
            {inline ? (
              <InlineField
                value={sectionTitle(sectionId, fallback)}
                placeholder={fallback}
                sectionId={sectionId}
                entryId={titleEntryId}
                onChange={(v) => {
                  const title = persistSectionTitleChange(sectionId, v, fallback, data, ctx?.onUpdate);
                  setSectionTitleOverrides((prev) => ({ ...prev, [sectionId]: title }));
                }}
                className="font-bold uppercase text-black"
              />
            ) : (
              sectionTitle(sectionId, fallback)
            )}
          </h2>
        </div>
      </div>
    );
  };

  /** Readonly classic header: primary line = phone | email | location (10pt); links row = social (11px, #0066cc links). */
  const classicPrimaryReadonly: ReactNode[] = [];
  if (hp.showPhone && p.phone?.trim()) classicPrimaryReadonly.push(<span key="ph">{p.phone.trim()}</span>);
  if (hp.showEmail) {
    const e = p.email?.trim() ?? '';
    classicPrimaryReadonly.push(
      e ? (
        <a key="em" href={`mailto:${e}`} className="text-[#0066cc] underline">
          {e}
        </a>
      ) : (
        <span key="em-ph" className="text-black/40">
          your.email@example.com
        </span>
      ),
    );
  }
  if (hp.showLocation && p.location?.trim()) classicPrimaryReadonly.push(<span key="loc">{p.location.trim()}</span>);

  const classicLinksReadonly: ReactNode[] = [];
  if (hp.showLinkedIn && p.linkedin?.trim()) {
    const li = p.linkedin.trim();
    const href = li.startsWith('http') ? li : `https://${li}`;
    classicLinksReadonly.push(
      <a key="li" href={href} className="text-[#0066cc] underline" target="_blank" rel="noreferrer">
        LinkedIn
      </a>,
    );
  }
  if (hp.showGithub && p.github?.trim()) {
    const g = p.github.trim();
    const href = g.startsWith('http') ? g : `https://${g}`;
    classicLinksReadonly.push(
      <a key="gh" href={href} className="text-[#0066cc] underline" target="_blank" rel="noreferrer">
        GitHub
      </a>,
    );
  }
  if (hp.showWebsiteToggle && showWebsite && p.website?.trim()) {
    const w = p.website.trim();
    const href = w.startsWith('http') ? w : `https://${w}`;
    classicLinksReadonly.push(
      <a key="web" href={href} className="text-[#0066cc] underline" target="_blank" rel="noreferrer">
        Website
      </a>,
    );
  }
  if (hp.showPortfolioToggle && showPortfolio && p.portfolio?.trim()) {
    const po = p.portfolio.trim();
    const href = po.startsWith('http') ? po : `https://${po}`;
    classicLinksReadonly.push(
      <a key="pf" href={href} className="text-[#0066cc] underline" target="_blank" rel="noreferrer">
        Portfolio
      </a>,
    );
  }

  const summaryHas = Boolean(data.summary.text?.trim());
  const summaryEl =
    vis('summary') && (summaryHas || inline)
      ? (
        <CVSectionWrapper sectionId="summary">
          {sectionBox(
            'summary',
            activeSection,
            'mb-4',
            <>
              {renderSectionTitle('summary', 'Summary', () => ctx?.onUpdate({ summary: { text: '' } }))}
              <div className="mt-1.5 w-full min-w-0 text-center text-justify text-[11pt] font-normal leading-[1.45] text-[#1f2937]">
                {inline && ctx ? (
                  <div
                    data-entry-id="summary-body"
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx.setFocusedSection('summary');
                      ctx.setFocusedEntryId('summary-body');
                      ctx.setFocusedEntrySection('summary');
                    }}
                    style={{
                      outline: ctx.focusedEntryId === 'summary-body' ? '1.5px dashed #00C9B1' : 'none',
                      outlineOffset: '3px',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                  >
                    {ctx.focusedEntryId === 'summary-body' ? (
                      <EntryToolbar
                        sectionType="summary"
                        onAddEntry={() => {}}
                        onMoveUp={() => {}}
                        onMoveDown={() => {}}
                        onDelete={() => {
                          ctx.onUpdate({ summary: { text: '' } });
                          ctx.setFocusedEntryId(null);
                          ctx.setFocusedEntrySection(null);
                        }}
                        showMoveUp={false}
                        showMoveDown={false}
                        showDatePicker={false}
                        hideAddButton
                      />
                    ) : null}
                    <InlineField
                      multiline
                      layout="block"
                      sectionId="summary"
                      fieldPath="text"
                      entryId="summary-body"
                      value={data.summary.text}
                      placeholder="Briefly explain why you're a great fit for the role…"
                      onChange={(v) => ctx.onUpdate({ summary: { text: v } })}
                      className="block w-full min-w-0 max-w-full text-justify text-[11pt] leading-[1.45] text-[#1f2937]"
                    />
                  </div>
                ) : (
                  <RichText text={data.summary.text} />
                )}
              </div>
            </>,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
          )}
        </CVSectionWrapper>
      )
      : null;

  const educationInner = (
    <>
      {renderSectionTitle('education', 'Education', () => ctx?.onUpdate({ education: { items: [] } }))}
      <div className="mt-1.5 space-y-1.5 text-left text-[11pt] leading-[1.32] text-[#1f2937]">
        {data.education.items.length ? (
          data.education.items.map((e) => {
            const { line1Right, degreeLine } = professionalEducationLayout(e);
            const dates = formatEduRangeEnDash(e.startYear, e.endYear);
            const topRight = line1Right || '';
            return (
              <div
                key={e.id}
                data-entry-id={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  ctx?.setFocusedSection('education');
                  ctx?.setFocusedEntryId(e.id);
                  ctx?.setFocusedEntrySection('education');
                }}
                style={{
                  outline: ctx?.focusedEntryId === e.id ? '1.5px dashed #00C9B1' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '3px',
                  position: 'relative',
                }}
              >
                {inline && ctx?.focusedEntryId === e.id ? (
                  <EntryToolbar
                    sectionType="education"
                    onAddEntry={() =>
                      ctx!.onUpdate({
                        education: {
                          items: [
                            ...data.education.items,
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
                    onMoveUp={() => {
                      const idx = data.education.items.findIndex((row) => row.id === e.id);
                      if (idx <= 0) return;
                      const next = [...data.education.items];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      ctx!.onUpdate({ education: { items: next } });
                    }}
                    onMoveDown={() => {
                      const idx = data.education.items.findIndex((row) => row.id === e.id);
                      if (idx < 0 || idx >= data.education.items.length - 1) return;
                      const next = [...data.education.items];
                      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                      ctx!.onUpdate({ education: { items: next } });
                    }}
                    onDelete={() => {
                      ctx!.onUpdate({ education: { items: data.education.items.filter((row) => row.id !== e.id) } });
                      ctx!.setFocusedEntryId(null);
                      ctx!.setFocusedEntrySection(null);
                    }}
                    onDatePick={(startDate, endDate) =>
                      ctx!.onUpdate({
                        education: {
                          items: data.education.items.map((row) =>
                            row.id === e.id ? { ...row, startYear: startDate, endYear: endDate } : row,
                          ),
                        },
                      })
                    }
                    showMoveUp={data.education.items.findIndex((row) => row.id === e.id) > 0}
                    showMoveDown={
                      data.education.items.findIndex((row) => row.id === e.id) < data.education.items.length - 1
                    }
                    dateStart={e.startYear}
                    dateEnd={e.endYear}
                    showDatePicker
                    settingsOptions={[
                      {
                        key: 'school',
                        label: 'School / University',
                        enabled: entryFieldOn(`education:${e.id}`, 'school'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'school', next),
                      },
                      {
                        key: 'field',
                        label: 'Field',
                        enabled: entryFieldOn(`education:${e.id}`, 'field'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'field', next),
                      },
                      {
                        key: 'degree',
                        label: 'Degree',
                        enabled: entryFieldOn(`education:${e.id}`, 'degree'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'degree', next),
                      },
                      {
                        key: 'date',
                        label: 'Date Period',
                        enabled: entryFieldOn(`education:${e.id}`, 'date'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'date', next),
                      },
                    ]}
                  />
                ) : null}
                {inline && ctx ? (
                  <>
                    <div className="flex justify-between gap-4">
                      {entryFieldOn(`education:${e.id}`, 'school') ? (
                        <span className="font-bold">
                          <InlineField
                            value={e.school}
                            placeholder="Institution"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx!.onUpdate({
                                education: {
                                  items: data.education.items.map((row) =>
                                    row.id === e.id ? { ...row, school: v } : row,
                                  ),
                                },
                              })
                            }
                            className="font-bold text-black"
                          />
                        </span>
                      ) : (
                        <span />
                      )}
                      {entryFieldOn(`education:${e.id}`, 'field') ? (
                        <span className="shrink-0 text-right font-normal">
                          <InlineField
                            value={topRight}
                            placeholder="Field"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx!.onUpdate({
                                education: {
                                  items: data.education.items.map((row) =>
                                    row.id === e.id ? { ...row, field: v } : row,
                                  ),
                                },
                              })
                            }
                            className="text-right text-black"
                          />
                        </span>
                      ) : null}
                    </div>
                    <div className="flex justify-between gap-4">
                      {entryFieldOn(`education:${e.id}`, 'degree') ? (
                        <span className="font-normal">
                          <InlineField
                            value={degreeLine || ''}
                            placeholder="Degree"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx!.onUpdate({
                                education: {
                                  items: data.education.items.map((row) =>
                                    row.id === e.id ? { ...row, degree: v, grade: '' } : row,
                                  ),
                                },
                              })
                            }
                            className="text-black"
                          />
                        </span>
                      ) : (
                        <span />
                      )}
                      {entryFieldOn(`education:${e.id}`, 'date') ? (
                        <span className="shrink-0 text-right font-bold">
                          <InlineField
                            value={dates}
                            placeholder="Years"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx!.onUpdate({
                                education: {
                                  items: data.education.items.map((row) =>
                                    row.id === e.id ? { ...row, startYear: v.trim(), endYear: '' } : row,
                                  ),
                                },
                              })
                            }
                            className="text-right font-bold text-black"
                          />
                        </span>
                      ) : null}
                    </div>
                    <div className="group mt-2 flex justify-center">
                      <button
                        type="button"
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                          addButtonVisibilityClass(activeSection, 'education'),
                        )}
                        aria-label="Add education entry"
                        title="Add education entry"
                        onClick={() =>
                          ctx!.onUpdate({
                            education: {
                              items: [
                                ...data.education.items,
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
                        +
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="font-bold">{e.school || 'Institution'}</span>
                      <span className="shrink-0 text-right font-normal">{topRight}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="font-normal">{degreeLine || '—'}</span>
                      <span className="shrink-0 text-right font-bold">{dates}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        ) : inline && ctx ? (
          <button
            type="button"
            className="text-left text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
            onClick={() =>
              ctx.onUpdate({
                education: {
                  items: [
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
            + Click to add education
          </button>
        ) : (
          <p className="text-black">Add your education in the editor.</p>
        )}
      </div>
    </>
  );
  const educationEl = vis('education') ? (
    <CVSectionWrapper sectionId="education">
      {sectionBox('education', activeSection, 'mb-5', educationInner, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)}
    </CVSectionWrapper>
  ) : null;

  const skillsInner = (
    <>
      {renderSectionTitle('skills', 'Areas of expertise', () => ctx?.onUpdate({ skills: { categories: [] } }))}
      <div className="mt-1.5 space-y-1.5 text-left text-[11pt] leading-[1.32] text-black">
        {data.skills.categories.length === 0 && inline && ctx ? (
          <button
            type="button"
            className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
            onClick={() => ctx.onUpdate({ skills: { categories: [{ id: newLocalId(), name: '', skills: [''] }] } })}
          >
            + Click to add skills
          </button>
        ) : (
          data.skills.categories.map((cat, catIdx) => (
            <div
              key={cat.id}
              data-entry-id={cat.id}
              onClick={(e) => {
                e.stopPropagation();
                ctx?.setFocusedSection('skills');
                ctx?.setFocusedEntryId(cat.id);
                ctx?.setFocusedEntrySection('skills');
              }}
              style={{
                outline: ctx?.focusedEntryId === cat.id ? '1.5px dashed #00C9B1' : 'none',
                outlineOffset: '3px',
                borderRadius: '3px',
                position: 'relative',
              }}
            >
              {inline && ctx?.focusedEntryId === cat.id ? (
                <EntryToolbar
                  sectionType="skills"
                  onAddEntry={() => ctx.onUpdate({ skills: { categories: [...data.skills.categories, { id: newLocalId(), name: '', skills: [''] }] } })}
                  onAddSecondaryEntry={() => ctx.onUpdate({ skills: { categories: [...data.skills.categories, { id: newLocalId(), name: 'Group Title', skills: [''] }] } })}
                  onMoveUp={() => {
                    if (catIdx === 0) return;
                    const next = [...data.skills.categories];
                    [next[catIdx - 1], next[catIdx]] = [next[catIdx], next[catIdx - 1]];
                    ctx.onUpdate({ skills: { categories: next } });
                  }}
                  onMoveDown={() => {
                    if (catIdx >= data.skills.categories.length - 1) return;
                    const next = [...data.skills.categories];
                    [next[catIdx], next[catIdx + 1]] = [next[catIdx + 1], next[catIdx]];
                    ctx.onUpdate({ skills: { categories: next } });
                  }}
                  onDelete={() => {
                    ctx.onUpdate({ skills: { categories: data.skills.categories.filter((c) => c.id !== cat.id) } });
                    ctx.setFocusedEntryId(null);
                    ctx.setFocusedEntrySection(null);
                  }}
                  showMoveUp={catIdx > 0}
                  showMoveDown={catIdx < data.skills.categories.length - 1}
                  addEntryLabel="+ Skill"
                  addSecondaryEntryLabel="+ Group"
                  showDatePicker={false}
                  settingsOptions={[
                    {
                      key: 'groupTitle',
                      label: 'Group Title',
                      enabled: entryFieldOn(`skills:${cat.id}`, 'groupTitle'),
                      onToggle: (next) => setEntryFieldOn(`skills:${cat.id}`, 'groupTitle', next),
                    },
                  ]}
                />
              ) : null}
              <p>
                {entryFieldOn(`skills:${cat.id}`, 'groupTitle') && inline && ctx && (cat.name.trim() !== '' || (ctx.focusedEntryId === cat.id && cat.name.trim() === 'Group Title')) ? (
                  <InlineField
                    value={cat.name.trim() === 'Group Title' ? '' : cat.name}
                    placeholder="Skill group title"
                    sectionId="skills"
                    entryId={cat.id}
                    onChange={(v) =>
                      ctx.onUpdate({
                        skills: {
                          categories: data.skills.categories.map((row) => (row.id === cat.id ? { ...row, name: v } : row)),
                        },
                      })
                    }
                    className="font-bold text-black"
                  />
                ) : cat.name.trim() && cat.name.trim() !== 'Group Title' ? (
                  <span className="font-bold">{cat.name.trim()}: </span>
                ) : null}
                <span>
                  {inline && ctx
                    ? (
                      <InlineSkillsCommaField
                        skills={cat.skills}
                        onChange={(next) =>
                          ctx.onUpdate({
                            skills: {
                              categories: data.skills.categories.map((row) =>
                                row.id === cat.id ? { ...row, skills: next } : row,
                              ),
                            },
                          })
                        }
                        onFocus={() => {
                          ctx.setFocusedSection('skills');
                          ctx.setFocusedEntryId(cat.id);
                          ctx.setFocusedEntrySection('skills');
                        }}
                        className="text-black"
                      />
                    )
                    : <SkillsRichComma skills={cat.skills} />}
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    </>
  );
  const skillsEl = vis('skills') ? (
    <CVSectionWrapper sectionId="skills">
      {sectionBox('skills', activeSection, 'mb-5', skillsInner, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)}
    </CVSectionWrapper>
  ) : null;

  const experienceInner = (
    <>
      {renderSectionTitle('experience', 'Work experience', () => ctx?.onUpdate({ experience: { items: [] } }))}
      <div className="mt-1.5 space-y-5 text-left text-[11pt] leading-[1.4] text-[#1f2937]">
        {data.experience.items.length ? (
          data.experience.items.map((x, itemIdx) => (
            <div
              key={x.id}
              id={`cv-preview-experience-item-${x.id}`}
              data-entry-id={x.id}
              className={experienceItemWrapClass(activeSection, x.id)}
              style={{
                outline: ctx?.focusedEntryId === x.id ? '1.5px dashed #00C9B1' : 'none',
                outlineOffset: '3px',
                borderRadius: '3px',
                position: 'relative',
              }}
              onClick={(e) => {
                e.stopPropagation();
                ctx?.setFocusedSection('experience');
                ctx?.setFocusedEntryId(x.id);
                ctx?.setFocusedEntrySection('experience');
              }}
            >
              {inline && ctx?.focusedEntryId === x.id ? (
                <EntryToolbar
                  sectionType="experience"
                  onAddEntry={() =>
                    ctx!.onUpdate({
                      experience: {
                        items: [
                          ...data.experience.items,
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
                  onAddBullet={() =>
                    ctx!.onUpdate({
                      experience: {
                        items: data.experience.items.map((row) => {
                          if (row.id !== x.id) return row;
                          const base = Array.isArray(row.bullets)
                            ? row.bullets
                            : normalizeBullets(row.bullets as unknown as string | string[] | undefined);
                          return { ...row, bullets: [...(base.length ? base : ['']), ''] };
                        }),
                      },
                    })
                  }
                  onMoveUp={() => {
                    if (itemIdx === 0) return;
                    const next = [...data.experience.items];
                    [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                    ctx!.onUpdate({ experience: { items: next } });
                  }}
                  onMoveDown={() => {
                    if (itemIdx >= data.experience.items.length - 1) return;
                    const next = [...data.experience.items];
                    [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                    ctx!.onUpdate({ experience: { items: next } });
                  }}
                  onDelete={() => {
                    ctx!.onUpdate({
                      experience: { items: data.experience.items.filter((row) => row.id !== x.id) },
                    });
                    ctx!.setFocusedEntryId(null);
                    ctx!.setFocusedEntrySection(null);
                  }}
                  onDatePick={(startDate, endDate) =>
                    ctx!.onUpdate({
                      experience: {
                        items: data.experience.items.map((row) =>
                          row.id === x.id ? { ...row, startDate, endDate } : row,
                        ),
                      },
                    })
                  }
                  showMoveUp={itemIdx > 0}
                  showMoveDown={itemIdx < data.experience.items.length - 1}
                  showAddBullet
                  dateStart={x.startDate}
                  dateEnd={x.endDate}
                  showDatePicker
                  settingsOptions={[
                    {
                      key: 'title',
                      label: 'Title',
                      enabled: entryFieldOn(`experience:${x.id}`, 'title'),
                      onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'title', next),
                    },
                    {
                      key: 'company',
                      label: 'Company Name',
                      enabled: entryFieldOn(`experience:${x.id}`, 'company'),
                      onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'company', next),
                    },
                    {
                      key: 'location',
                      label: 'Location',
                      enabled: entryFieldOn(`experience:${x.id}`, 'location'),
                      onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'location', next),
                    },
                    {
                      key: 'date',
                      label: 'Date Period',
                      enabled: entryFieldOn(`experience:${x.id}`, 'date'),
                      onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'date', next),
                    },
                    {
                      key: 'bullets',
                      label: 'Bullets',
                      enabled: entryFieldOn(`experience:${x.id}`, 'bullets'),
                      onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'bullets', next),
                    },
                  ]}
                />
              ) : null}
              {inline && ctx ? (
                <>
                  <div className="flex justify-between gap-3">
                    <p className="min-w-0 leading-tight">
                      {entryFieldOn(`experience:${x.id}`, 'title') ? (
                        <InlineField
                          value={x.title}
                          placeholder="Job title"
                          sectionId="experience"
                          entryId={x.id}
                          onChange={(v) =>
                            ctx!.onUpdate({
                              experience: {
                                items: data.experience.items.map((row) =>
                                  row.id === x.id ? { ...row, title: v } : row,
                                ),
                              },
                            })
                          }
                          className="font-bold text-[#111111]"
                        />
                      ) : null}
                      {entryFieldOn(`experience:${x.id}`, 'company') ? (
                        <>
                          <span className="font-bold text-[#111111]">{' \u2013 '}</span>
                          <InlineField
                            value={x.company}
                            placeholder="Company"
                            sectionId="experience"
                            entryId={x.id}
                            onChange={(v) =>
                              ctx!.onUpdate({
                                experience: {
                                  items: data.experience.items.map((row) =>
                                    row.id === x.id ? { ...row, company: v } : row,
                                  ),
                                },
                              })
                            }
                            className="font-bold text-[#111111]"
                          />
                        </>
                      ) : null}
                      {entryFieldOn(`experience:${x.id}`, 'location') ? (
                        <>
                          <span className="font-normal">{' \u2013 '}</span>
                          <InlineField
                            value={x.location ?? ''}
                            placeholder="Location"
                            sectionId="experience"
                            entryId={x.id}
                            onChange={(v) =>
                              ctx!.onUpdate({
                                experience: {
                                  items: data.experience.items.map((row) =>
                                    row.id === x.id ? { ...row, location: v } : row,
                                  ),
                                },
                              })
                            }
                            className="font-normal italic text-[#111111]"
                          />
                        </>
                      ) : null}
                    </p>
                    {entryFieldOn(`experience:${x.id}`, 'date') ? (
                      <span className="shrink-0 whitespace-nowrap font-normal text-[#4b5563]">
                        <InlineField
                          value={formatCvPeriodEnDash(x.startDate, x.endDate, x.current)}
                          placeholder="Dates"
                          sectionId="experience"
                          entryId={x.id}
                          onChange={(v) =>
                            ctx!.onUpdate({
                              experience: {
                                items: data.experience.items.map((row) =>
                                  row.id === x.id ? { ...row, startDate: v.trim(), endDate: '', current: false } : row,
                                ),
                              },
                            })
                          }
                          className="font-normal text-[#4b5563]"
                        />
                      </span>
                    ) : null}
                  </div>
                  {entryFieldOn(`experience:${x.id}`, 'bullets') ? (
                    <ul className="mt-1 list-none space-y-0 pl-[18px] text-[11pt] leading-[1.4] text-[#1f2937]">
                      {(Array.isArray(x.bullets) && x.bullets.length > 0
                        ? x.bullets
                        : normalizeBullets(x.bullets as unknown as string | string[] | undefined).length
                          ? normalizeBullets(x.bullets as unknown as string | string[] | undefined)
                          : ['']
                      ).map((bullet, bulletIdx) => (
                        <li key={`${x.id}-edit-bullet-${bulletIdx}`} className="mb-[3px] flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span className="flex-1">
                            <InlineField
                              value={bullet}
                              layout="block"
                              placeholder="Describe your accomplishment with numbers..."
                              sectionId="experience"
                              fieldPath={`items[${itemIdx}].bullets[${bulletIdx}]`}
                              entryId={x.id}
                              dataBulletEntry={x.id}
                              dataBulletIdx={String(bulletIdx)}
                              onChange={(v) => {
                                const base = Array.isArray(x.bullets)
                                  ? x.bullets
                                  : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                const nextBullets = [...(base.length ? base : [''])];
                                nextBullets[bulletIdx] = normalizeBulletInput(v);
                                ctx!.onUpdate({
                                  experience: {
                                    items: data.experience.items.map((row) =>
                                      row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                    ),
                                  },
                                });
                              }}
                              onInputKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const base = Array.isArray(x.bullets)
                                    ? x.bullets
                                    : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                  const nextBullets = [...(base.length ? base : [''])];
                                  nextBullets.splice(bulletIdx + 1, 0, '');
                                  ctx!.onUpdate({
                                    experience: {
                                      items: data.experience.items.map((row) =>
                                        row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                      ),
                                    },
                                  });
                                  setTimeout(() => {
                                    const inputs = document.querySelectorAll(
                                      `[data-bullet-entry="${x.id}"][data-bullet-idx="${String(bulletIdx + 1)}"]`,
                                    );
                                    const next = inputs[0] as HTMLElement | undefined;
                                    next?.focus();
                                  }, 50);
                                }
                                if (e.key === 'Backspace') {
                                  const base = Array.isArray(x.bullets)
                                    ? x.bullets
                                    : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                  if (cvBulletFieldDomIsEmpty(e) && base.length > 1) {
                                    e.preventDefault();
                                    const nextBullets = base.filter((_, bi) => bi !== bulletIdx);
                                    ctx!.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) =>
                                          row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                        ),
                                      },
                                    });
                                  }
                                }
                              }}
                              className="text-[#1f2937]"
                            />
                          </span>
                          {ctx?.focusedEntryId === x.id && ctx?.focusedEntrySection === 'experience' ? (
                            <button
                              type="button"
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                const base = Array.isArray(x.bullets)
                                  ? x.bullets
                                  : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                if (base.length <= 1) return;
                                const nextBullets = base.filter((_, bi) => bi !== bulletIdx);
                                ctx!.onUpdate({
                                  experience: {
                                    items: data.experience.items.map((row) =>
                                      row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                    ),
                                  },
                                });
                              }}
                              aria-label="Remove bullet"
                            >
                              ×
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="group mt-2 flex justify-center">
                    <button
                      type="button"
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                        addButtonVisibilityClass(activeSection, 'experience'),
                      )}
                      aria-label="Add experience entry"
                      title="Add experience entry"
                      onClick={() =>
                        ctx!.onUpdate({
                          experience: {
                            items: [
                              ...data.experience.items,
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
                      +
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <p className="min-w-0 leading-tight">
                      <span className="font-bold text-[#111111]">{x.title || 'Job title'}</span>
                      <span className="font-bold text-[#111111]">{' \u2013 '}</span>
                      <span className="font-bold text-[#111111]">{x.company || 'Company'}</span>
                      {x.location?.trim() ? (
                        <>
                          <span className="font-normal">{' \u2013 '}</span>
                          <span className="font-normal italic text-[#111111]">{x.location.trim()}</span>
                        </>
                      ) : null}
                    </p>
                    <span className="shrink-0 whitespace-nowrap font-normal text-[#4b5563]">
                      {formatCvPeriodEnDash(x.startDate, x.endDate, x.current)}
                    </span>
                  </div>
                  <ul className="mt-1 list-none space-y-0 pl-[18px] leading-[1.4] text-[11pt] text-[#1f2937]">
                    {normalizeBullets(x.bullets as unknown as string | string[] | undefined).map((b, i) => (
                      <li key={i} className="mb-[3px] flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">•</span>
                        <RichText text={b} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))
        ) : inline && ctx ? (
          <button
            type="button"
            className="text-left text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
            onClick={() =>
              ctx.onUpdate({
                experience: {
                  items: [
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
            + Click to add work experience
          </button>
        ) : (
          <p className="text-black">Add your experience in the editor.</p>
        )}
      </div>
    </>
  );
  const experienceEl = vis('experience')
    ? (
        <CVSectionWrapper sectionId="experience">
          {sectionBox(
            'experience',
            activeSection,
            'mb-5',
            experienceInner,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
            experienceOuterSectionActive,
          )}
        </CVSectionWrapper>
      )
    : null;

  const projectsEl =
    optionalSectionShown(optionalSectionPresence, 'projects', data.projects.length > 0) && vis('projects')
      ? (
        <CVSectionWrapper sectionId="projects">
          {sectionBox(
          'projects',
          activeSection,
          'mb-3',
          <>
            {renderSectionTitle('projects', 'Projects', () => ctx?.onUpdate({ projects: [] }))}
            <div className="mt-1.5 space-y-1.5 text-left text-[9pt] leading-[1.32] text-black">
              {(inline && ctx ? data.projects : data.projects.filter((proj) => {
                const pAny = proj as unknown as Record<string, unknown>;
                return stripHtmlTags(proj.name || '').trim() || richTextPlainText(proj.description || '').length > 0 || projectPayloadTech(pAny).length > 0 || projectPayloadBullets(pAny).length > 0 || (proj.url || '').trim();
              })).map((proj, projIdx) => {
                const pAny = proj as unknown as Record<string, unknown>;
                const rawBullets =
                  typeof proj.bullets === 'string'
                    ? proj.bullets
                    : normalizeBullets(proj.bullets as unknown as string | string[] | undefined).join('\n');
                const editLines = rawBullets.split(/\r?\n/);
                const techList = projectPayloadTech(pAny);
                return (
                  <div
                    key={proj.id || `project-${projIdx}`}
                    data-entry-id={proj.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx?.setFocusedSection('projects');
                      ctx?.setFocusedEntryId(proj.id);
                      ctx?.setFocusedEntrySection('projects');
                    }}
                    style={{
                      outline: ctx?.focusedEntryId === proj.id ? '1.5px dashed #00C9B1' : 'none',
                      outlineOffset: '3px',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                  >
                    {inline && ctx?.focusedEntryId === proj.id ? (
                      <EntryToolbar
                        sectionType="projects"
                        onAddBullet={() =>
                          ctx.onUpdate({
                            projects: data.projects.map((row) =>
                              row.id === proj.id
                                ? { ...row, bullets: `${row.bullets ?? ''}${(row.bullets ?? '').toString().length ? '\n' : ''}` }
                                : row,
                            ),
                          })
                        }
                        onAddEntry={() =>
                          ctx.onUpdate({
                            projects: [
                              ...data.projects,
                              { id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' },
                            ],
                          })
                        }
                        onMoveUp={() => {
                          if (projIdx === 0) return;
                          const next = [...data.projects];
                          [next[projIdx - 1], next[projIdx]] = [next[projIdx], next[projIdx - 1]];
                          ctx.onUpdate({ projects: next });
                        }}
                        onMoveDown={() => {
                          if (projIdx >= data.projects.length - 1) return;
                          const next = [...data.projects];
                          [next[projIdx], next[projIdx + 1]] = [next[projIdx + 1], next[projIdx]];
                          ctx.onUpdate({ projects: next });
                        }}
                        onDelete={() => {
                          ctx.onUpdate({ projects: data.projects.filter((row) => row.id !== proj.id) });
                          ctx.setFocusedEntryId(null);
                          ctx.setFocusedEntrySection(null);
                        }}
                        showMoveUp={projIdx > 0}
                        showMoveDown={projIdx < data.projects.length - 1}
                        showAddBullet
                        showDatePicker={false}
                        settingsOptions={[
                          {
                            key: 'description',
                            label: 'Description',
                            enabled: entryFieldOn(`projects:${proj.id}`, 'description'),
                            onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'description', next),
                          },
                          {
                            key: 'technologies',
                            label: 'Tools & keywords',
                            enabled: entryFieldOn(`projects:${proj.id}`, 'technologies'),
                            onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'technologies', next),
                          },
                          {
                            key: 'url',
                            label: 'Project link',
                            enabled: entryFieldOn(`projects:${proj.id}`, 'url'),
                            onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'url', next),
                          },
                          {
                            key: 'bullets',
                            label: 'Bullets',
                            enabled: entryFieldOn(`projects:${proj.id}`, 'bullets'),
                            onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'bullets', next),
                          },
                        ]}
                      />
                    ) : null}
                    <p className="font-bold">
                      {inline && ctx ? (
                        <InlineField value={proj.name || ''} placeholder="Project name" sectionId="projects" entryId={proj.id} onChange={(v) => ctx.onUpdate({ projects: data.projects.map((row) => row.id === proj.id ? { ...row, name: v } : row) })} className="font-bold text-black" />
                      ) : (
                        stripHtmlTags(proj.name || '') || 'Project'
                      )}
                    </p>
                    {inline && ctx && entryFieldOn(`projects:${proj.id}`, 'description') ? (
                      <p className="mt-0.5 leading-[1.48]">
                        <InlineField multiline value={proj.description || ''} placeholder="Description" sectionId="projects" entryId={proj.id} onChange={(v) => ctx.onUpdate({ projects: data.projects.map((row) => row.id === proj.id ? { ...row, description: v } : row) })} className="text-black" />
                      </p>
                    ) : !inline && proj.description ? (
                      <p className="mt-0.5 leading-[1.48]">
                        <RichText text={proj.description} />
                      </p>
                    ) : null}
                    {techList.length > 0 || (inline && ctx && entryFieldOn(`projects:${proj.id}`, 'technologies')) ? (
                      <p className="mt-0.5 text-[9pt] text-black">
                        {inline && ctx && entryFieldOn(`projects:${proj.id}`, 'technologies') ? (
                          <InlineField
                            value={techList.join(', ')}
                            placeholder="Tools, software, methods (comma-separated)"
                            sectionId="projects"
                            entryId={proj.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                projects: data.projects.map((row) =>
                                  row.id === proj.id ? { ...row, technologies: v.split(',').map((t) => t.trim()).filter(Boolean) } : row,
                                ),
                              })
                            }
                            className="text-black"
                          />
                        ) : techList.length > 0 ? (
                          techList.join(' | ')
                        ) : null}
                      </p>
                    ) : null}
                    {(proj.url || '').trim() || (inline && ctx && entryFieldOn(`projects:${proj.id}`, 'url')) ? (
                      <p className="mt-0.5 text-[9pt]">
                        {inline && ctx && entryFieldOn(`projects:${proj.id}`, 'url') ? (
                          <InlineField value={proj.url ?? ''} placeholder="URL" sectionId="projects" entryId={proj.id} onChange={(v) => ctx.onUpdate({ projects: data.projects.map((row) => row.id === proj.id ? { ...row, url: v } : row) })} className="text-black" />
                        ) : (proj.url || '').trim() ? (
                          <a href={proj.url.startsWith('http') ? proj.url : `https://${proj.url}`} className="text-black underline" target="_blank" rel="noreferrer">
                            {proj.url.replace(/^https?:\/\//i, '')}
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                    {entryFieldOn(`projects:${proj.id}`, 'bullets') && (editLines.some((x) => richTextPlainText(x).length > 0) || inline) ? (
                      <ul className="mt-2 list-none space-y-0.5 pl-0 text-[9pt] leading-[1.35] text-black">
                        {(editLines.length > 0 ? editLines : ['']).map((b, bIdx) => (
                          <li key={`${proj.id}-b-${bIdx}`} className="flex items-start gap-1.5">
                            {inline && ctx ? (
                              <>
                                <span className="mt-0.5 shrink-0">•</span>
                                <span className="flex-1">
                                  <InlineField
                                    value={b}
                                    layout="block"
                                    placeholder="Bullet"
                                    sectionId="projects"
                                    entryId={proj.id}
                                    dataBulletIdx={String(bIdx)}
                                    onChange={(v) => {
                                      const arr = rawBullets.split(/\r?\n/);
                                      const next = [...(arr.length ? arr : [''])];
                                      next[bIdx] = normalizeBulletInput(v);
                                      ctx.onUpdate({ projects: data.projects.map((row) => (row.id === proj.id ? { ...row, bullets: next.join('\n') } : row)) });
                                    }}
                                    onInputKeyDown={(e) => {
                                      const arr = rawBullets.split(/\r?\n/);
                                      const next = [...(arr.length ? arr : [''])];
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        next.splice(bIdx + 1, 0, '');
                                        ctx.onUpdate({ projects: data.projects.map((row) => (row.id === proj.id ? { ...row, bullets: next.join('\n') } : row)) });
                                      }
                                      if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && next.length > 1) {
                                        e.preventDefault();
                                        const filtered = next.filter((_, i) => i !== bIdx);
                                        ctx.onUpdate({ projects: data.projects.map((row) => (row.id === proj.id ? { ...row, bullets: filtered.join('\n') } : row)) });
                                      }
                                    }}
                                    className="text-black"
                                  />
                                </span>
                                {ctx?.focusedEntryId === proj.id && ctx?.focusedEntrySection === 'projects' ? (
                                  <button
                                    type="button"
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      const arr = rawBullets.split(/\r?\n/);
                                      if (arr.length <= 1) return;
                                      const filtered = arr.filter((_, i) => i !== bIdx);
                                      ctx.onUpdate({ projects: data.projects.map((row) => (row.id === proj.id ? { ...row, bullets: filtered.join('\n') } : row)) });
                                    }}
                                    aria-label="Remove bullet"
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </>
                            ) : stripHtmlTags(b).trim() ? (
                              <span className="flex gap-2">
                                <span className="shrink-0">•</span>
                                <span>
                                  <RichText text={b} />
                                </span>
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : !inline && projectPayloadBullets(pAny).length > 0 ? (
                      <ul className="mt-2 list-disc list-outside pl-5">
                        {projectPayloadBullets(pAny).map((b, i) => (
                          <li key={i}>
                            <RichText text={b} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
              {inline && ctx && data.projects.length === 0 ? (
                <button
                  type="button"
                  className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                  onClick={() => ctx.onUpdate({ projects: [{ id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' }] })}
                >
                  + Click to add project
                </button>
              ) : null}
            </div>
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
        )}
        </CVSectionWrapper>
      )
      : null;

  const certListClassic =
    inline && ctx ? data.certifications : data.certifications.filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim());

  const certificationsEl =
    optionalSectionShown(optionalSectionPresence, 'certifications', data.certifications.length > 0) && vis('certifications')
      ? (
        <CVSectionWrapper sectionId="certifications">
          {sectionBox(
          'certifications',
          activeSection,
          'mb-3',
          <>
            {renderSectionTitle('certifications', 'Certifications', () => ctx?.onUpdate({ certifications: [] }))}
            <div className="mt-1.5 space-y-1.5 text-left text-[9pt] leading-[1.32] text-black">
              {certListClassic.length === 0 && inline && ctx ? (
                <button
                  type="button"
                  className="text-sm italic text-[#00C9B1] hover:underline"
                  onClick={() =>
                    ctx.onUpdate({
                      certifications: [
                        { id: newLocalId(), name: '', issuer: '', date: '', url: '' },
                      ],
                    })
                  }
                >
                  + Click to add certification
                </button>
              ) : (
                certListClassic.map((c, cIdx) => (
                  <div
                    key={c.id}
                    data-entry-id={c.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx?.setFocusedSection('certifications');
                      ctx?.setFocusedEntryId(c.id);
                      ctx?.setFocusedEntrySection('certifications');
                    }}
                    style={{
                      outline: ctx?.focusedEntryId === c.id ? '1.5px dashed #00C9B1' : 'none',
                      outlineOffset: '3px',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                  >
                    {inline && ctx?.focusedEntryId === c.id ? (
                      <EntryToolbar
                        sectionType="certifications"
                        onAddEntry={() => ctx.onUpdate({ certifications: [...data.certifications, { id: newLocalId(), name: '', issuer: '', date: '', url: '' }] })}
                        onMoveUp={() => {
                          if (cIdx === 0) return;
                          const next = [...data.certifications];
                          [next[cIdx - 1], next[cIdx]] = [next[cIdx], next[cIdx - 1]];
                          ctx.onUpdate({ certifications: next });
                        }}
                        onMoveDown={() => {
                          if (cIdx >= data.certifications.length - 1) return;
                          const next = [...data.certifications];
                          [next[cIdx], next[cIdx + 1]] = [next[cIdx + 1], next[cIdx]];
                          ctx.onUpdate({ certifications: next });
                        }}
                        onDelete={() => {
                          ctx.onUpdate({ certifications: data.certifications.filter((row) => row.id !== c.id) });
                          ctx.setFocusedEntryId(null);
                          ctx.setFocusedEntrySection(null);
                        }}
                        showMoveUp={cIdx > 0}
                        showMoveDown={cIdx < data.certifications.length - 1}
                        showDatePicker={false}
                      />
                    ) : null}
                    <div className="text-black">
                      {inline && ctx ? (
                        <>
                          <InlineField
                            value={c.name}
                            placeholder="Certification name"
                            onChange={(v) =>
                              ctx.onUpdate({
                                certifications: data.certifications.map((row) =>
                                  row.id === c.id ? { ...row, name: v } : row,
                                ),
                              })
                            }
                            className="font-bold text-black"
                          />
                          <span className="text-black/40"> · </span>
                          <InlineField
                            value={c.issuer}
                            placeholder="Issuer"
                            onChange={(v) =>
                              ctx.onUpdate({
                                certifications: data.certifications.map((row) =>
                                  row.id === c.id ? { ...row, issuer: v } : row,
                                ),
                              })
                            }
                            className="text-black"
                          />
                          <span className="text-black/40"> · </span>
                          <InlineField
                            value={c.date}
                            placeholder="Date"
                            onChange={(v) =>
                              ctx.onUpdate({
                                certifications: data.certifications.map((row) =>
                                  row.id === c.id ? { ...row, date: v } : row,
                                ),
                              })
                            }
                            className="text-black"
                          />
                          <span className="mt-0.5 block">
                            <InlineField
                              value={c.url}
                              placeholder="URL (optional)"
                              onChange={(v) =>
                                ctx.onUpdate({
                                  certifications: data.certifications.map((row) =>
                                    row.id === c.id ? { ...row, url: v } : row,
                                  ),
                                })
                              }
                              className="text-[9pt] text-black"
                            />
                          </span>
                          <div className="group mt-2 flex justify-center">
                            <button
                              type="button"
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                                addButtonVisibilityClass(activeSection, 'certifications'),
                              )}
                              aria-label="Add certification"
                              title="Add certification"
                              onClick={() =>
                                ctx.onUpdate({
                                  certifications: [
                                    ...data.certifications,
                                    { id: newLocalId(), name: '', issuer: '', date: '', url: '' },
                                  ],
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        </>
                      ) : c.url.trim() ? (
                        <a
                          href={c.url.trim().startsWith('http') ? c.url.trim() : `https://${c.url.trim()}`}
                          className="font-bold text-black underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.name || 'Certification'}
                        </a>
                      ) : (
                        <span className="font-bold">{c.name || 'Certification'}</span>
                      )}
                      {!inline || !ctx ? (
                        <>
                          {c.issuer.trim() ? <span> · {c.issuer.trim()}</span> : null}
                          {c.date.trim() ? <span> · {c.date.trim()}</span> : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
        )}
        </CVSectionWrapper>
      )
      : null;

  const achievementsEl =
    optionalSectionShown(optionalSectionPresence, 'achievements', data.achievements.length > 0) && vis('achievements')
      ? (
        <CVSectionWrapper sectionId="achievements">
          {sectionBox(
          'achievements',
          activeSection,
          'mb-3',
          <>
            {renderSectionTitle('achievements', 'Achievements & awards', () => ctx?.onUpdate({ achievements: [] }))}
            <div className="mt-1.5 space-y-1.5 text-left text-[9pt] leading-[1.32] text-black">
              {(inline && ctx ? data.achievements : data.achievements
                .filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail.trim())
                ).map((a, aIdx) => (
                  <div
                    key={a.id}
                    data-entry-id={a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx?.setFocusedSection('achievements');
                      ctx?.setFocusedEntryId(a.id);
                      ctx?.setFocusedEntrySection('achievements');
                    }}
                    style={{
                      outline: ctx?.focusedEntryId === a.id ? '1.5px dashed #00C9B1' : 'none',
                      outlineOffset: '3px',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                  >
                    {inline && ctx?.focusedEntryId === a.id ? (
                      <EntryToolbar
                        sectionType="achievements"
                        onAddEntry={() => ctx.onUpdate({ achievements: [...data.achievements, { id: newLocalId(), title: '', issuer: '', date: '', detail: '' }] })}
                        onMoveUp={() => {
                          if (aIdx === 0) return;
                          const next = [...data.achievements];
                          [next[aIdx - 1], next[aIdx]] = [next[aIdx], next[aIdx - 1]];
                          ctx.onUpdate({ achievements: next });
                        }}
                        onMoveDown={() => {
                          if (aIdx >= data.achievements.length - 1) return;
                          const next = [...data.achievements];
                          [next[aIdx], next[aIdx + 1]] = [next[aIdx + 1], next[aIdx]];
                          ctx.onUpdate({ achievements: next });
                        }}
                        onDelete={() => {
                          ctx.onUpdate({ achievements: data.achievements.filter((row) => row.id !== a.id) });
                          ctx.setFocusedEntryId(null);
                          ctx.setFocusedEntrySection(null);
                        }}
                        showMoveUp={aIdx > 0}
                        showMoveDown={aIdx < data.achievements.length - 1}
                        showDatePicker={false}
                      />
                    ) : null}
                    <div className="flex justify-between gap-4">
                      <span className="font-bold">
                        {inline && ctx ? (
                          <InlineField value={a.title} placeholder="Achievement title" sectionId="achievements" fieldPath={`items[${aIdx}].title`} entryId={a.id} onChange={(v) => ctx.onUpdate({ achievements: data.achievements.map((row) => row.id === a.id ? { ...row, title: v } : row) })} className="font-bold text-black" />
                        ) : (a.title || 'Achievement')}
                      </span>
                      {inline && ctx ? <span className="shrink-0 font-semibold"><InlineField value={a.date} placeholder="Date" sectionId="achievements" entryId={a.id} onChange={(v) => ctx.onUpdate({ achievements: data.achievements.map((row) => row.id === a.id ? { ...row, date: v } : row) })} className="font-semibold text-black" /></span> : (a.date.trim() ? <span className="shrink-0 font-semibold">{a.date.trim()}</span> : null)}
                    </div>
                    {inline && ctx ? <p className="mt-0.5 text-black"><InlineField value={a.issuer} placeholder="Issuer" sectionId="achievements" entryId={a.id} onChange={(v) => ctx.onUpdate({ achievements: data.achievements.map((row) => row.id === a.id ? { ...row, issuer: v } : row) })} className="text-black" /></p> : (a.issuer.trim() ? <p className="mt-0.5 text-black">{a.issuer.trim()}</p> : null)}
                    {inline && ctx ? (
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-black"><InlineField multiline value={a.detail} placeholder="Details" sectionId="achievements" fieldPath={`items[${aIdx}].detail`} entryId={a.id} onChange={(v) => ctx.onUpdate({ achievements: data.achievements.map((row) => row.id === a.id ? { ...row, detail: v } : row) })} className="leading-relaxed text-black" /></p>
                    ) : a.detail.trim() ? (
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-black">{a.detail.trim()}</p>
                    ) : null}
                  </div>
                ))}
            </div>
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
        )}
        </CVSectionWrapper>
      )
      : null;

  const languagesEl =
    optionalSectionShown(optionalSectionPresence, 'languages', data.languages.length > 0) && vis('languages')
      ? (
        <CVSectionWrapper sectionId="languages">
          {sectionBox(
          'languages',
          activeSection,
          'mb-3',
          <>
            {renderSectionTitle('languages', 'Languages', () => ctx?.onUpdate({ languages: [] }))}
            <ul className="mt-1.5 list-none space-y-1 text-left text-[9pt] leading-[1.32] text-black">
              {(inline && ctx ? data.languages : data.languages.filter((l) => l.language.trim() || l.proficiency?.trim())).map((l, lIdx) => {
                const lang = l.language.trim() || 'Language';
                const level = l.proficiency?.trim();
                return (
                  <li
                    key={l.id}
                    className="flex justify-between gap-4"
                    data-entry-id={l.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx?.setFocusedSection('languages');
                      ctx?.setFocusedEntryId(l.id);
                      ctx?.setFocusedEntrySection('languages');
                    }}
                    style={{
                      outline: ctx?.focusedEntryId === l.id ? '1.5px dashed #00C9B1' : 'none',
                      outlineOffset: '3px',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                  >
                    {inline && ctx?.focusedEntryId === l.id ? (
                      <EntryToolbar
                        sectionType="languages"
                        onAddEntry={() => ctx.onUpdate({ languages: [...data.languages, { id: newLocalId(), language: '', proficiency: '' }] })}
                        onMoveUp={() => {
                          if (lIdx === 0) return;
                          const next = [...data.languages];
                          [next[lIdx - 1], next[lIdx]] = [next[lIdx], next[lIdx - 1]];
                          ctx.onUpdate({ languages: next });
                        }}
                        onMoveDown={() => {
                          if (lIdx >= data.languages.length - 1) return;
                          const next = [...data.languages];
                          [next[lIdx], next[lIdx + 1]] = [next[lIdx + 1], next[lIdx]];
                          ctx.onUpdate({ languages: next });
                        }}
                        onDelete={() => {
                          ctx.onUpdate({ languages: data.languages.filter((row) => row.id !== l.id) });
                          ctx.setFocusedEntryId(null);
                          ctx.setFocusedEntrySection(null);
                        }}
                        showMoveUp={lIdx > 0}
                        showMoveDown={lIdx < data.languages.length - 1}
                        showDatePicker={false}
                      />
                    ) : null}
                    <span className="font-semibold">
                      {inline && ctx ? <InlineField value={l.language} placeholder="Language" sectionId="languages" entryId={l.id} onChange={(v) => ctx.onUpdate({ languages: data.languages.map((row) => row.id === l.id ? { ...row, language: v } : row) })} className="font-semibold text-black" /> : lang}
                    </span>
                    {inline && ctx ? <span className="shrink-0 text-black"><InlineField value={l.proficiency ?? ''} placeholder="e.g. Fluent, Intermediate" sectionId="languages" entryId={l.id} onChange={(v) => ctx.onUpdate({ languages: data.languages.map((row) => row.id === l.id ? { ...row, proficiency: v as CVBuilderLanguage['proficiency'] } : row) })} className="text-black" /></span> : (level ? <span className="shrink-0 text-black">{level}</span> : null)}
                  </li>
                );
              })}
              {inline && ctx && data.languages.length === 0 ? (
                <li className="list-none">
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={() => ctx.onUpdate({ languages: [{ id: newLocalId(), language: '', proficiency: '' }] })}
                  >
                    + Click to add language
                  </button>
                </li>
              ) : null}
            </ul>
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
        )}
        </CVSectionWrapper>
      )
      : null;

  const referencesEl =
    optionalSectionShown(
      optionalSectionPresence,
      'references',
      filterCvBuilderReferences(data.references).length > 0 || Boolean(inline && ctx),
    ) && vis('references')
      ? (
        <CVSectionWrapper sectionId="references">
          {sectionBox(
            'references',
            activeSection,
            'mb-3',
            <>
              {renderSectionTitle('references', 'References', () => ctx?.onUpdate({ references: [] }))}
              <CvEditableReferencesList
                references={data.references}
                layout="compact"
                textClassName="text-left text-[9pt] leading-[1.32] text-black"
              />
            </>,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
          )}
        </CVSectionWrapper>
      )
      : null;

  const customEl =
    shouldRenderCustomLegacySection(data, inline) && vis('custom-legacy')
      ? (
        <CVSectionWrapper sectionId="custom-legacy">
          {sectionBox(
            'custom-legacy',
            activeSection,
            'mb-3',
            <>
              {inline && ctx && data.customSections.length === 0 ? (
                <button
                  type="button"
                  className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                  onClick={() => ctx.onUpdate({ customSections: [{ id: newLocalId(), title: '', body: '' }] })}
                >
                  + Click to add section
                </button>
              ) : null}
              {(inline && ctx ? data.customSections : data.customSections.filter((x) => x.title.trim() || x.body.trim()))
                .map((x, xIdx) => (
                  <Fragment key={x.id}>
                    {inline && ctx ? (
                      <EntryToolbar
                        sectionType="custom"
                        onAddEntry={() => ctx.onUpdate({ customSections: [...data.customSections, { id: newLocalId(), title: '', body: '' }] })}
                        onMoveUp={() => {
                          if (xIdx === 0) return;
                          const next = [...data.customSections];
                          [next[xIdx - 1], next[xIdx]] = [next[xIdx], next[xIdx - 1]];
                          ctx.onUpdate({ customSections: next });
                        }}
                        onMoveDown={() => {
                          if (xIdx >= data.customSections.length - 1) return;
                          const next = [...data.customSections];
                          [next[xIdx], next[xIdx + 1]] = [next[xIdx + 1], next[xIdx]];
                          ctx.onUpdate({ customSections: next });
                        }}
                        onDelete={() => ctx.onUpdate({ customSections: data.customSections.filter((row) => row.id !== x.id) })}
                        showMoveUp={xIdx > 0}
                        showMoveDown={xIdx < data.customSections.length - 1}
                        showDatePicker={false}
                      />
                    ) : null}
                    <ClassicSectionBand title={x.title.trim() || 'Additional'} />
                    <p className="mt-1.5 whitespace-pre-wrap text-left text-[9pt] leading-[1.32] text-black">
                      {inline && ctx ? (
                        <InlineField
                          multiline
                          layout="block"
                          value={x.body}
                          placeholder="Section details"
                          sectionId="custom-legacy"
                          entryId={x.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              customSections: data.customSections.map((row) => (row.id === x.id ? { ...row, body: v } : row)),
                            })
                          }
                          className="text-black"
                        />
                      ) : (
                        <RichText text={x.body.trim()} />
                      )}
                    </p>
                  </Fragment>
                ))}
            </>,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
          )}
        </CVSectionWrapper>
      )
      : null;

  const parsedByKey: Record<string, ReactNode> = {};
  const parsedEls = filterParsedCustomSectionsForEditor(data.parsedCustomSections).map((block) => {
    const node =
      block.title.trim() || block.items.some((i) => i.text.trim() || i.subItems.length) ? (
      <Fragment key={block.sectionId}>
        {vis(`parsed-${block.sectionId}`) ? (
          <CVSectionWrapper sectionId={`parsed-${block.sectionId}`}>
            {sectionBox(
              `parsed-${block.sectionId}`,
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle(`parsed-${block.sectionId}`, block.title.trim() || 'Additional', () =>
                  ctx?.onUpdate({
                    parsedCustomSections: data.parsedCustomSections.filter((b) => b.sectionId !== block.sectionId),
                  })
                )}
                <div className="mt-1.5 space-y-1.5 text-left text-[9pt] leading-[1.32] text-black">
                  {block.items.length === 0 && inline && ctx ? (
                    <button
                      type="button"
                      className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                      onClick={() =>
                        ctx.onUpdate({
                          parsedCustomSections: data.parsedCustomSections.map((b) =>
                            b.sectionId === block.sectionId
                              ? { ...b, items: [{ id: newLocalId(), text: '', date: '', subItems: [] }] }
                              : b,
                          ),
                        })
                      }
                    >
                      + Click to add item
                    </button>
                  ) : null}
                  {block.items.map((item, itemIdx) => {
                    const usesRangeDates = /volunteer|experience|employment|work|project/i.test(block.sectionType);
                    return (
                      <div
                        key={item.id}
                        data-entry-id={item.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          ctx?.setFocusedSection(`parsed-${block.sectionId}`);
                          ctx?.setFocusedEntryId(item.id);
                          ctx?.setFocusedEntrySection(`parsed-${block.sectionId}`);
                        }}
                        style={{
                          outline: ctx?.focusedEntryId === item.id ? '1.5px dashed #00C9B1' : 'none',
                          outlineOffset: '3px',
                          borderRadius: '3px',
                          position: 'relative',
                        }}
                      >
                        {inline && ctx?.focusedEntryId === item.id ? (
                          <EntryToolbar
                            sectionType={block.sectionType}
                            onAddBullet={() =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? {
                                        ...b,
                                        items: b.items.map((it) =>
                                          it.id === item.id ? { ...it, subItems: [...(it.subItems.length ? it.subItems : ['']), ''] } : it,
                                        ),
                                      }
                                    : b,
                                ),
                              })
                            }
                            onAddEntry={() =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? { ...b, items: [...b.items, { id: newLocalId(), text: '', date: '', subItems: [] }] }
                                    : b,
                                ),
                              })
                            }
                            onMoveUp={() => {
                              if (itemIdx === 0) return;
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) => {
                                  if (b.sectionId !== block.sectionId) return b;
                                  const next = [...b.items];
                                  [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                                  return { ...b, items: next };
                                }),
                              });
                            }}
                            onMoveDown={() => {
                              if (itemIdx >= block.items.length - 1) return;
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) => {
                                  if (b.sectionId !== block.sectionId) return b;
                                  const next = [...b.items];
                                  [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                                  return { ...b, items: next };
                                }),
                              });
                            }}
                            onDelete={() => {
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId ? { ...b, items: b.items.filter((it) => it.id !== item.id) } : b,
                                ),
                              });
                              ctx.setFocusedEntryId(null);
                              ctx.setFocusedEntrySection(null);
                            }}
                            onDatePick={(startDate, endDate) =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? {
                                        ...b,
                                        items: b.items.map((it) => {
                                          if (it.id !== item.id) return it;
                                          return { ...it, date: usesRangeDates ? [startDate, endDate].filter(Boolean).join(' - ') : startDate };
                                        }),
                                      }
                                    : b,
                                ),
                              })
                            }
                            dateMode={usesRangeDates ? 'range' : 'single'}
                            dateStart={splitCvStoredRange(item.date ?? '').start}
                            dateEnd={splitCvStoredRange(item.date ?? '').end}
                            showMoveUp={itemIdx > 0}
                            showMoveDown={itemIdx < block.items.length - 1}
                            showAddBullet
                            showDatePicker
                            settingsOptions={[
                              {
                                key: 'date',
                                label: 'Date',
                                enabled: entryFieldOn(`parsed:${item.id}`, 'date'),
                                onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'date', next),
                              },
                              {
                                key: 'bullets',
                                label: 'Bullets',
                                enabled: entryFieldOn(`parsed:${item.id}`, 'bullets'),
                                onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'bullets', next),
                              },
                            ]}
                          />
                        ) : null}
                        {inline && ctx ? (
                          <>
                            <p className="font-bold">
                              <InlineField
                                value={item.text}
                                placeholder={parsedCustomMainPlaceholder(block.sectionType)}
                                sectionId={`parsed-${block.sectionId}`}
                                entryId={item.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    parsedCustomSections: data.parsedCustomSections.map((b) =>
                                      b.sectionId === block.sectionId
                                        ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, text: v } : it)) }
                                        : b,
                                    ),
                                  })
                                }
                                className="font-bold text-black"
                              />
                              <span className="font-normal"> </span>
                              {entryFieldOn(`parsed:${item.id}`, 'date') ? (
                                <InlineField
                                  value={item.date ?? ''}
                                  placeholder={usesRangeDates ? 'Date range (From - To)' : 'Date'}
                                  sectionId={`parsed-${block.sectionId}`}
                                  entryId={item.id}
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId
                                          ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, date: v } : it)) }
                                          : b,
                                      ),
                                    })
                                  }
                                  className="text-black"
                                />
                              ) : null}
                            </p>
                            {entryFieldOn(`parsed:${item.id}`, 'bullets') ? (
                              <ul className="mt-1 list-none space-y-0.5 pl-0 text-[9pt] leading-[1.35] text-black">
                                {(item.subItems.length > 0 ? item.subItems : ['']).map((line, lineIdx) => (
                                  <li key={`${item.id}-sub-${lineIdx}`} className="flex items-start gap-1.5">
                                    <span className="mt-0.5 shrink-0">•</span>
                                    <span className="flex-1">
                                      <InlineField
                                        value={line}
                                        layout="block"
                                        placeholder="Detail bullet"
                                        sectionId={`parsed-${block.sectionId}`}
                                        entryId={item.id}
                                        dataBulletIdx={item.id}
                                        onChange={(v) =>
                                          ctx.onUpdate({
                                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                                              b.sectionId === block.sectionId
                                                ? {
                                                    ...b,
                                                    items: b.items.map((it) => {
                                                      if (it.id !== item.id) return it;
                                                      const next = [...(it.subItems.length ? it.subItems : [''])];
                                                      next[lineIdx] = normalizeBulletInput(v);
                                                      return { ...it, subItems: next };
                                                    }),
                                                  }
                                                : b,
                                            ),
                                          })
                                        }
                                        onInputKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            ctx.onUpdate({
                                              parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                b.sectionId === block.sectionId
                                                  ? {
                                                      ...b,
                                                      items: b.items.map((it) => {
                                                        if (it.id !== item.id) return it;
                                                        const next = [...(it.subItems.length ? it.subItems : [''])];
                                                        next.splice(lineIdx + 1, 0, '');
                                                        return { ...it, subItems: next };
                                                      }),
                                                    }
                                                  : b,
                                              ),
                                            });
                                          }
                                          if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && (item.subItems.length || 1) > 1) {
                                            e.preventDefault();
                                            ctx.onUpdate({
                                              parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                b.sectionId === block.sectionId
                                                  ? {
                                                      ...b,
                                                      items: b.items.map((it) =>
                                                        it.id === item.id
                                                          ? {
                                                              ...it,
                                                              subItems: (it.subItems.length ? it.subItems : ['']).filter((_, i) => i !== lineIdx),
                                                            }
                                                          : it,
                                                      ),
                                                    }
                                                  : b,
                                              ),
                                            });
                                          }
                                        }}
                                        className="text-black"
                                      />
                                    </span>
                                    {ctx?.focusedEntryId === item.id && ctx?.focusedEntrySection === `parsed-${block.sectionId}` ? (
                                      <button
                                        type="button"
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          const current = item.subItems.length ? item.subItems : [''];
                                          if (current.length <= 1) return;
                                          ctx.onUpdate({
                                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                                              b.sectionId === block.sectionId
                                                ? {
                                                    ...b,
                                                    items: b.items.map((it) =>
                                                      it.id === item.id ? { ...it, subItems: current.filter((_, i) => i !== lineIdx) } : it,
                                                    ),
                                                  }
                                                : b,
                                            ),
                                          });
                                        }}
                                        aria-label="Remove bullet"
                                      >
                                        ×
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <p className="font-semibold">
                              <RichText text={item.text} />
                              {item.date?.trim() ? <span className="ml-2 font-normal text-black">({item.date.trim()})</span> : null}
                            </p>
                            {item.subItems.length > 0 ? (
                              <ul className="mt-1 list-disc list-outside pl-5">
                                {item.subItems.map((line, i) => (
                                  <li key={i}>
                                    <RichText text={line} />
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )}
          </CVSectionWrapper>
        ) : null}
      </Fragment>
    ) : null;
    if (node) parsedByKey[`parsed-${block.sectionId}`] = node;
    return node;
  });

  const coreOrderKeys = isRecentGrad
    ? (['summary', 'education', 'skills', 'experience', 'projects', 'certifications', 'achievements', 'languages'] as const)
    : (['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements', 'languages'] as const);
  const coreOrderNodes = isRecentGrad
    ? [summaryEl, educationEl, skillsEl, experienceEl, projectsEl, certificationsEl, achievementsEl, languagesEl]
    : [summaryEl, experienceEl, educationEl, skillsEl, projectsEl, certificationsEl, achievementsEl, languagesEl];

  const personalBlock = vis('personal') ? (
    <div className="mb-3 text-center leading-[1.15]">
      {hp.showTitle ? (
        <h1
          className={cn(
            'mb-0.5 text-[18pt] font-normal tracking-[0.01em] leading-[1.05] text-black',
            hp.uppercaseName && 'uppercase',
          )}
        >
          {inline && ctx ? (
            <InlineField
              value={p.name}
              placeholder="Your Name"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, name: v } })}
              className="text-[18pt] font-normal tracking-[0.01em] leading-[1.05] text-black"
            />
          ) : (
            displayName
          )}
        </h1>
      ) : null}
      {inline && ctx && hp.showHeadline ? (
        <p className="mb-1 mt-0.5 text-[10pt] font-normal leading-[1.1] text-[#111111]">
          <InlineField
            value={p.headline}
            placeholder="The role you are applying for"
            onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, headline: v } })}
            className="text-[10pt] text-[#111111]"
          />
        </p>
      ) : !inline && hp.showHeadline && p.headline?.trim() ? (
        <p className="mb-1 mt-0.5 text-[10pt] font-normal leading-[1.1] text-[#111111]">{p.headline.trim()}</p>
      ) : null}
      <>
        <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 text-[10pt] font-normal leading-[1.1] text-[#111111]">
          {inline && ctx ? (
            <>
              {hp.showPhone ? (
                <>
                  <InlineField
                    value={p.phone ?? ''}
                    placeholder="Phone"
                    onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, phone: v } })}
                    className="text-[10pt] text-[#111111]"
                  />
                  {(hp.showEmail || hp.showLocation) ? <span className="text-black/35">|</span> : null}
                </>
              ) : null}
              {hp.showEmail ? (
                <>
                  <InlineField
                    value={p.email}
                    placeholder="your.email@example.com"
                    onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, email: v } })}
                    className="text-[10pt] text-[#111111]"
                  />
                  {hp.showLocation ? <span className="text-black/35">|</span> : null}
                </>
              ) : null}
              {hp.showLocation ? (
                <InlineField
                  value={p.location ?? ''}
                  placeholder="Location"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, location: v } })}
                  className="text-[10pt] text-[#111111]"
                />
              ) : null}
            </>
          ) : (
            <>
              {classicPrimaryReadonly.length > 0 ? (
                <span className="inline-flex flex-wrap items-center justify-center gap-x-2">
                  {classicPrimaryReadonly.map((part, i) => (
                    <Fragment key={`classic-primary-${i}`}>
                      {i > 0 ? <span className="text-black/35">|</span> : null}
                      {part}
                    </Fragment>
                  ))}
                </span>
              ) : null}
            </>
          )}
        </p>
        {inline && ctx &&
        (hp.showLinkedIn || hp.showGithub || hp.showWebsiteToggle || hp.showPortfolioToggle) ? (
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-[11px] font-normal leading-[1.15] text-black">
            {hp.showLinkedIn ? (
              <>
                <InlineField
                  value={p.linkedin ?? ''}
                  placeholder="LinkedIn"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, linkedin: v } })}
                  className="text-[11px] text-black"
                />
                {(hp.showGithub || hp.showWebsiteToggle || hp.showPortfolioToggle) ? (
                  <span className="text-[#333]">|</span>
                ) : null}
              </>
            ) : null}
            {hp.showGithub ? (
              <>
                <InlineField
                  value={p.github ?? ''}
                  placeholder="GitHub"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, github: v } })}
                  className="text-[11px] text-black"
                />
                {(hp.showWebsiteToggle || hp.showPortfolioToggle) ? <span className="text-[#333]">|</span> : null}
              </>
            ) : null}
            {(showWebsite || inline) && hp.showWebsiteToggle ? (
              <>
                <InlineField
                  value={p.website ?? ''}
                  placeholder="Website"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, website: v } })}
                  className="text-[11px] text-black"
                />
                {(showPortfolio || inline) && hp.showPortfolioToggle ? <span className="text-[#333]">|</span> : null}
              </>
            ) : null}
            {(showPortfolio || inline) && hp.showPortfolioToggle ? (
              <InlineField
                value={p.portfolio ?? ''}
                placeholder="Portfolio"
                onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, portfolio: v } })}
                className="text-[11px] text-black"
              />
            ) : null}
          </p>
        ) : null}
        {!inline && classicLinksReadonly.length > 0 ? (
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-[11px] font-normal leading-[1.15] text-black">
            {classicLinksReadonly.map((part, i) => (
              <Fragment key={`classic-links-${i}`}>
                {i > 0 ? <span className="text-[#333]">|</span> : null}
                {part}
              </Fragment>
            ))}
          </p>
        ) : null}
      </>
      {hp.extraField
        ? p.extras
            .filter((x) => x.label.trim() || x.value.trim())
            .map((x, i) => {
              const v = x.value.trim();
              const isUrl = /^https?:\/\//i.test(v);
              return (
                <p key={`classic-extra-${i}`} className="mt-1 text-[9pt] leading-[1.2] text-black">
                  {x.label.trim() ? <span className="font-semibold">{x.label.trim()}: </span> : null}
                  {isUrl ? (
                    <a href={v} className="text-black underline" target="_blank" rel="noreferrer">
                      {v}
                    </a>
                  ) : (
                    <span>{v || '—'}</span>
                  )}
                </p>
              );
            })
        : null}
      {inline && ctx && hp.dateOfBirth ? (
        <p className="mt-1 text-[9pt] text-black">
          <InlineField
            value={p.dateOfBirth ?? ''}
            placeholder="Date of birth"
            onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, dateOfBirth: v } })}
            className="text-[9pt] text-black"
          />
        </p>
      ) : hp.dateOfBirth && p.dateOfBirth?.trim() ? (
        <p className="mt-1 text-[9pt] text-black">{p.dateOfBirth.trim()}</p>
      ) : null}
      {inline && ctx && hp.nationality ? (
        <p className="mt-1 text-[9pt] text-black">
          <InlineField
            value={p.nationality ?? ''}
            placeholder="Nationality"
            onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, nationality: v } })}
            className="text-[9pt] text-black"
          />
        </p>
      ) : hp.nationality && p.nationality?.trim() ? (
        <p className="mt-1 text-[9pt] text-black">{p.nationality.trim()}</p>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        'box-border min-w-0 w-full bg-white pt-2 pb-6 pl-[30px] pr-[30px] text-[12pt] leading-[1.48] text-[#111111] antialiased',
        ebGaramond.className,
      )}
    >
      {personalBlock ? (
        <CVSectionWrapper sectionId="personal" className="relative">
          <HeaderFloatingControls />
          {sectionBox('personal', activeSection, 'mb-2 text-center', personalBlock, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)}
        </CVSectionWrapper>
      ) : null}

      <div className="classic-content w-full text-left text-[#111111] [&_a]:text-[#111111] [&_a]:underline">
        {sectionOrder && sectionOrder.length > 0
          ? sectionOrder.map((id, i) => {
              if (id === 'summary') return summaryEl ? <Fragment key={`classic-${id}-${i}`}>{summaryEl}</Fragment> : null;
              if (id === 'experience') return experienceEl ? <Fragment key={`classic-${id}-${i}`}>{experienceEl}</Fragment> : null;
              if (id === 'education') return educationEl ? <Fragment key={`classic-${id}-${i}`}>{educationEl}</Fragment> : null;
              if (id === 'skills') return skillsEl ? <Fragment key={`classic-${id}-${i}`}>{skillsEl}</Fragment> : null;
              if (id === 'projects') return projectsEl ? <Fragment key={`classic-${id}-${i}`}>{projectsEl}</Fragment> : null;
              if (id === 'certifications')
                return certificationsEl ? <Fragment key={`classic-${id}-${i}`}>{certificationsEl}</Fragment> : null;
              if (id === 'achievements') return achievementsEl ? <Fragment key={`classic-${id}-${i}`}>{achievementsEl}</Fragment> : null;
              if (id === 'languages') return languagesEl ? <Fragment key={`classic-${id}-${i}`}>{languagesEl}</Fragment> : null;
              if (id === 'references') return referencesEl ? <Fragment key={`classic-${id}-${i}`}>{referencesEl}</Fragment> : null;
              if (id === 'custom-legacy') return customEl ? <Fragment key={`classic-${id}-${i}`}>{customEl}</Fragment> : null;
              if (id.startsWith('parsed-'))
                return parsedByKey[id] ? <Fragment key={`classic-${id}-${i}`}>{parsedByKey[id]}</Fragment> : null;
              return null;
            })
          : coreOrderKeys
              .map((id) => {
                if (id === 'summary') return summaryEl;
                if (id === 'experience') return experienceEl;
                if (id === 'education') return educationEl;
                if (id === 'skills') return skillsEl;
                if (id === 'projects') return projectsEl;
                if (id === 'certifications') return certificationsEl;
                if (id === 'achievements') return achievementsEl;
                if (id === 'languages') return languagesEl;
                if (id === 'references') return referencesEl;
                return null;
              })
              .map((node, i) => (node != null ? <Fragment key={`classic-section-${i}`}>{node}</Fragment> : null))}
        {!(sectionOrder && sectionOrder.length > 0) ? (
          <>
            {customEl}
            {parsedEls}
          </>
        ) : null}
      </div>
      <CvPreviewWatermarkFooter />
    </div>
  );
}

/** Modern — navy-accent two-column layout (ATS: flex, not tables/columns CSS) */
function ModernDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
  optionalSectionPresence,
  sectionOrder,
  onReorderSections,
}: {
  data: CVBuilderData;
  activeSection?: string | null;
  sectionVisibility?: CVSectionVisibilityMap | null;
  diffSection?: string | null;
  diffChangedFields?: ChangedField[] | null;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  optionalSectionPresence?: Set<string>;
  sectionOrder?: string[];
  onReorderSections?: (nextOrder: string[]) => void;
}) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing && ctx?.onUpdate);
  const hp = ctx?.headerPreview ?? DEFAULT_HEADER_PREVIEW;
  const [sectionTitleOverrides, setSectionTitleOverrides] = useState<Record<string, string>>({});
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  /**
   * Reconcile local hides with backend visibility — when a section becomes visible again
   * (e.g. user re-added/restored it via the Sections modal), clear it from the local hidden
   * set so the preview renders the section instantly without a manual refresh.
   */
  useEffect(() => {
    if (!sectionVisibility) return;
    setHiddenSections((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const key of prev) {
        if (sectionVisibility[key] === true) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sectionVisibility]);
  const [entryFieldVisibility, setEntryFieldVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const draggingSectionIdRef = useRef<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const entryFieldOn = (entryKey: string, field: string) => entryFieldVisibility[entryKey]?.[field] ?? true;
  const setEntryFieldOn = (entryKey: string, field: string, enabled: boolean) => {
    setEntryFieldVisibility((prev) => ({
      ...prev,
      [entryKey]: { ...(prev[entryKey] ?? {}), [field]: enabled },
    }));
  };

  const p = data.personal;
  const name = (p.name || '').trim() || 'Your Name';
  const vis = (k: string) => isCvSectionVisible(k, sectionVisibility) && !hiddenSections.has(k);
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);

  const accent = '#1e3a5f';
  const sidebarBg = '#f4f5f7';

  const allSkillCats = inline
    ? data.skills.categories
    : data.skills.categories.filter((c) => c.name.trim() || c.skills.some((s) => s.trim()));

  const modernSectionTitle = (t: string) => (
    <h3
      className="mb-2.5 border-b-2 pb-1 text-[10pt] font-bold uppercase leading-[1.1] tracking-[0.12em]"
      style={{ borderColor: accent, color: accent }}
    >
      {t}
    </h3>
  );

  const sectionTitle = (sectionId: string, fallback: string) =>
    resolveSectionDisplayTitle(sectionId, fallback, data, sectionTitleOverrides);
  const sectionIsActive = (sectionId: string) =>
    ctx?.focusedSection === sectionId || ctx?.focusedEntrySection === sectionId;
  const reorderPreviewSections = (targetSectionId: string) => {
    /**
     * Local ref handles drops on the title bar; module-level fallback handles drops on the
     * section body (forwarded from `CVSectionWrapper` via `cv:section-reorder-drop`).
     */
    const draggingSectionId = draggingSectionIdRef.current ?? getActiveDraggingSectionId();
    if (!draggingSectionId || draggingSectionId === targetSectionId) return;
    const sourceOrder =
      sectionOrder && sectionOrder.length > 0
        ? sectionOrder
        : [...DEFAULT_PREVIEW_DRAG_SECTION_ORDER];
    const next = reorderSectionKeys(sourceOrder, draggingSectionId, targetSectionId);
    if (!next) return;
    onReorderSections?.(next);
    draggingSectionIdRef.current = null;
  };
  useEffect(() => {
    if (!inline) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SectionReorderDropDetail>).detail;
      if (!detail?.targetSectionId) return;
      reorderPreviewSections(detail.targetSectionId);
    };
    window.addEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closure captures latest sectionOrder/onReorderSections via re-registration on those deps
  }, [inline, sectionOrder, onReorderSections]);
  const renderSectionTitle = (
    sectionId: string,
    fallback: string,
    onDeleteSection?: () => void,
  ) => {
    const titleEntryId = `__section-title__:${sectionId}`;
    const focused = ctx?.focusedEntryId === titleEntryId;
    return (
      <div
        className={cn('mb-2.5', inline && sectionIsActive(sectionId) && 'group')}
        data-entry-id={titleEntryId}
        onDragOver={(e) => {
          if (!inline || !draggingSectionIdRef.current) return;
          e.preventDefault();
          setDragOverSectionId(sectionId);
        }}
        onDragLeave={() => {
          if (dragOverSectionId === sectionId) setDragOverSectionId(null);
        }}
        onDrop={(e) => {
          if (!inline) return;
          e.preventDefault();
          /** stopPropagation prevents CVSectionWrapper's drop listener from firing a second reorder. */
          e.stopPropagation();
          reorderPreviewSections(sectionId);
          setDragOverSectionId(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          ctx?.setFocusedSection(sectionId);
          ctx?.setFocusedEntryId(titleEntryId);
          ctx?.setFocusedEntrySection(sectionId);
        }}
      >
        {inline && dragOverSectionId === sectionId && draggingSectionIdRef.current !== sectionId ? (
          <div className="mb-1 rounded-md border-2 border-dashed border-[#00C9B1]/70 bg-[#00C9B1]/8 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#007A7A]">
            Drop section here
          </div>
        ) : null}
        {inline && focused ? (
          <EntryToolbar
            sectionType={sectionId}
            onAddEntry={() => {}}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            onDelete={() => {
              if (!onDeleteSection || isCoreSectionId(sectionId)) return;
              onDeleteSection();
              setHiddenSections((prev) => new Set(prev).add(sectionId));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cv:section-hidden', { detail: { sectionId } }));
              }
              ctx?.setFocusedEntryId(null);
              ctx?.setFocusedEntrySection(null);
            }}
            showMoveUp={false}
            showMoveDown={false}
            hideAddButton
            hideDelete={isCoreSectionId(sectionId)}
          />
        ) : null}
        <h3
          className="relative flex items-center justify-center gap-1 border-b-2 pb-1 text-[10pt] font-bold uppercase leading-[1.1] tracking-[0.12em]"
          style={{ borderColor: accent, color: accent }}
        >
          {inline ? (
            <span
              role="button"
              tabIndex={0}
              title="Drag section to reorder"
              aria-label={`Drag ${fallback} section to reorder`}
              draggable
              className="absolute left-0 cursor-grab rounded-sm border border-[#00C9B1]/45 bg-white/95 p-0.5 text-[#00C9B1] shadow-sm shadow-[#00C9B1]/15 transition hover:border-[#00C9B1]/70 hover:bg-[#00C9B1]/10 hover:text-[#007A7A] active:cursor-grabbing"
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                draggingSectionIdRef.current = sectionId;
                setActiveDraggingSectionId(sectionId);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', sectionId);
              }}
              onDragEnd={() => {
                draggingSectionIdRef.current = null;
                setActiveDraggingSectionId(null);
                setDragOverSectionId(null);
                dispatchSectionDragEnd();
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
              }}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          {inline ? (
            <InlineField
              value={sectionTitle(sectionId, fallback)}
              placeholder={fallback}
              sectionId={sectionId}
              entryId={titleEntryId}
              onChange={(v) => {
                const title = persistSectionTitleChange(sectionId, v, fallback, data, ctx?.onUpdate);
                setSectionTitleOverrides((prev) => ({ ...prev, [sectionId]: title }));
              }}
              className="font-bold uppercase"
            />
          ) : (
            sectionTitle(sectionId, fallback)
          )}
        </h3>
      </div>
    );
  };

  const linkify = (raw: string) => {
    const t = raw.trim();
    if (!t) return null;
    const href = t.startsWith('http') ? t : `https://${t}`;
    return (
      <a href={href} className="break-words text-[#1f2937] underline decoration-solid" target="_blank" rel="noreferrer">
        {t.replace(/^https?:\/\//i, '')}
      </a>
    );
  };

  /** Right column name block (export parity — no navy banner). */
  const modernMainHeader = vis('personal') ? (
    <div
      data-cv-section="personal"
      className="relative mb-4 bg-white"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        ctx?.setFocusedSection('personal');
        ctx?.setFocusedEntryId(null);
        ctx?.setFocusedEntrySection('personal');
      }}
    >
      <HeaderFloatingControls />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 pr-0 sm:pr-4">
          <h1 className="text-left text-[26px] font-bold leading-tight text-[#111111]">
            {inline && ctx && hp.showTitle ? (
              <InlineField
                value={p.name}
                placeholder="Your Name"
                sectionId="personal"
                entryId="__header-name__"
                onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, name: v } })}
                className={cn('text-left text-[26px] font-bold text-[#111111]', hp.uppercaseName && 'uppercase')}
              />
            ) : !inline && hp.showTitle ? (
              hp.uppercaseName ? name.toUpperCase() : name
            ) : null}
          </h1>
          {inline && ctx && hp.showHeadline ? (
            <p className="mt-1 text-left text-[13px] font-normal leading-snug text-[#555555]">
              <InlineField
                value={p.headline}
                placeholder="Professional title"
                sectionId="personal"
                entryId="__header-headline__"
                onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, headline: v } })}
                className="text-left text-[13px] text-[#555555]"
              />
            </p>
          ) : !inline && hp.showHeadline && p.headline?.trim() ? (
            <p className="mt-1 text-left text-[13px] font-normal leading-snug text-[#555555]">{p.headline.trim()}</p>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const sidebarPersonalInner = (
    <>
      {renderSectionTitle('personal', 'Contact')}
      <div className="mt-2.5 space-y-1.5 text-[10.5px] leading-[1.28] text-[#374151]">
        {(inline && ctx && hp.showEmail) || (!inline && hp.showEmail) ? (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              ✉
            </span>
            <span className="min-w-0 break-words">
              {inline && ctx && hp.showEmail ? (
                <InlineField
                  value={p.email}
                  placeholder="your.email@example.com"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, email: v } })}
                  className="text-[10.5px] text-[#374151]"
                />
              ) : !inline && hp.showEmail && p.email?.trim() ? (
                linkify(p.email)
              ) : (
                <span className="text-black/40">your.email@example.com</span>
              )}
            </span>
          </div>
        ) : null}
        {inline && ctx && hp.showPhone ? (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              ☎
            </span>
            <span className="min-w-0 break-words">
              <InlineField
                value={p.phone ?? ''}
                placeholder="Phone"
                onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, phone: v } })}
                className="text-[10.5px] text-[#374151]"
              />
            </span>
          </div>
        ) : !inline && hp.showPhone && p.phone?.trim() ? (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              ☎
            </span>
            <span className="min-w-0 break-words">{p.phone.trim()}</span>
          </div>
        ) : null}
        {inline && ctx && hp.showLocation ? (
          <div className="text-[10.5px] leading-[1.28] text-[#374151]">
            <span className="font-semibold text-[#111827]">Location: </span>
            <InlineField
              value={p.location ?? ''}
              placeholder="Location"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, location: v } })}
              className="text-[10.5px] text-[#374151]"
            />
          </div>
        ) : !inline && hp.showLocation && p.location?.trim() ? (
          <div className="text-[10.5px] leading-[1.28] text-[#374151]">
            <span className="font-semibold text-[#111827]">Location: </span>
            <span className="break-words">{p.location.trim()}</span>
          </div>
        ) : null}
        {inline && ctx && hp.showLinkedIn ? (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              🔗
            </span>
            <span className="min-w-0 break-words">
              <InlineField
                value={p.linkedin ?? ''}
                placeholder="LinkedIn URL"
                onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, linkedin: v } })}
                className="text-[10.5px] text-[#374151]"
              />
            </span>
          </div>
        ) : !inline && hp.showLinkedIn && p.linkedin?.trim() ? (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              🔗
            </span>
            <span className="min-w-0 break-words">{linkify(p.linkedin)}</span>
          </div>
        ) : null}
        {inline && ctx && hp.showGithub ? (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              🔗
            </span>
            <span className="min-w-0 break-words">
              <InlineField
                value={p.github ?? ''}
                placeholder="GitHub URL"
                onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, github: v } })}
                className="text-[10.5px] text-[#374151]"
              />
            </span>
          </div>
        ) : !inline && hp.showGithub && p.github?.trim() ? (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              🔗
            </span>
            <span className="min-w-0 break-words">{linkify(p.github)}</span>
          </div>
        ) : null}
        {(showWebsite || (inline && ctx)) && hp.showWebsiteToggle && (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              🔗
            </span>
            <span className="min-w-0 break-words">
              {inline && ctx ? (
                <InlineField
                  value={p.website ?? ''}
                  placeholder="Website"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, website: v } })}
                  className="text-[10.5px] text-[#374151]"
                />
              ) : p.website?.trim() ? (
                linkify(p.website)
              ) : (
                <span className="text-black/40">Website</span>
              )}
            </span>
          </div>
        )}
        {(showPortfolio || (inline && ctx)) && hp.showPortfolioToggle && (
          <div className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              🔗
            </span>
            <span className="min-w-0 break-words">
              {inline && ctx ? (
                <InlineField
                  value={p.portfolio ?? ''}
                  placeholder="Portfolio URL"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, portfolio: v } })}
                  className="text-[10.5px] text-[#374151]"
                />
              ) : p.portfolio?.trim() ? (
                linkify(p.portfolio)
              ) : (
                <span className="text-black/40">Portfolio</span>
              )}
            </span>
          </div>
        )}
        {p.extras.filter((x) => x.label.trim() || x.value.trim()).map((x, i) => (
          <div key={`extra-${i}`} className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              🔗
            </span>
            <span className="min-w-0 break-words">
              {x.label.trim() ? <span className="font-semibold">{x.label.trim()}: </span> : null}
              {x.value.trim() ? <span>{x.value.trim()}</span> : <span className="text-black/40">—</span>}
            </span>
          </div>
        ))}
      </div>
    </>
  );

  const sidebarSkillsInner = (
    <>
      {renderSectionTitle('skills', 'Skills', () => ctx?.onUpdate({ skills: { categories: [] } }))}
      <div className="mt-2.5 space-y-2.5 text-[10.5px] leading-[1.28] text-[#374151]">
        {!inline || !ctx ? (
          allSkillCats.length ? (
            allSkillCats.map((c) => (
              <div key={c.id} className="border-l-2 pl-2" style={{ borderColor: accent }}>
                <p className="font-bold text-[#111827]">{c.name?.trim() ? `${c.name.trim()}: ` : null}</p>
                <p className="mt-0.5 font-normal">{c.skills.length ? skillsCommaList(c.skills) : ''}</p>
              </div>
            ))
          ) : (
            <p className="text-black/45">Add skills in the editor.</p>
          )
        ) : data.skills.categories.length === 0 ? (
          <div className={cn('relative', ctx.focusedEntryId === '__skills-empty__' && 'min-h-[2.75rem] pt-11')}>
            {ctx.focusedEntryId === '__skills-empty__' ? (
              <EntryToolbar
                sectionType="skills"
                onAddEntry={() => {
                  const id = newLocalId();
                  ctx.onUpdate({ skills: { categories: [{ id, name: '', skills: [''] }] } });
                  ctx.setFocusedSection('skills');
                  ctx.setFocusedEntryId(id);
                  ctx.setFocusedEntrySection('skills');
                }}
                onAddSecondaryEntry={() => {
                  const id = newLocalId();
                  ctx.onUpdate({ skills: { categories: [{ id, name: 'Group Title', skills: [''] }] } });
                  ctx.setFocusedSection('skills');
                  ctx.setFocusedEntryId(id);
                  ctx.setFocusedEntrySection('skills');
                }}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                onDelete={() => {}}
                showMoveUp={false}
                showMoveDown={false}
                addEntryLabel="+ Skill"
                addSecondaryEntryLabel="+ Group"
                showDatePicker={false}
              />
            ) : null}
            <button
              type="button"
              data-entry-id="__skills-empty__"
              className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                ctx.setFocusedSection('skills');
                ctx.setFocusedEntryId('__skills-empty__');
                ctx.setFocusedEntrySection('skills');
              }}
            >
              + Click to add skills
            </button>
          </div>
        ) : (
          data.skills.categories.map((cat, catIdx) => (
            <div
              key={cat.id}
              data-entry-id={cat.id}
              className={cn(
                'relative border-l-2 pl-2',
                inline && ctx?.focusedEntryId === cat.id && 'pt-11',
              )}
              style={{ borderColor: accent }}
              onClick={(e) => {
                e.stopPropagation();
                ctx.setFocusedSection('skills');
                ctx.setFocusedEntryId(cat.id);
                ctx.setFocusedEntrySection('skills');
              }}
            >
              {ctx.focusedEntryId === cat.id ? (
                <EntryToolbar
                  sectionType="skills"
                  onAddEntry={() => {
                    const id = newLocalId();
                    ctx.onUpdate({
                      skills: { categories: [...data.skills.categories, { id, name: '', skills: [''] }] },
                    });
                    ctx.setFocusedSection('skills');
                    ctx.setFocusedEntryId(id);
                    ctx.setFocusedEntrySection('skills');
                  }}
                  onAddSecondaryEntry={() => {
                    const id = newLocalId();
                    ctx.onUpdate({
                      skills: { categories: [...data.skills.categories, { id, name: 'Group Title', skills: [''] }] },
                    });
                    ctx.setFocusedSection('skills');
                    ctx.setFocusedEntryId(id);
                    ctx.setFocusedEntrySection('skills');
                  }}
                  onMoveUp={() => {
                    if (catIdx === 0) return;
                    const next = [...data.skills.categories];
                    [next[catIdx - 1], next[catIdx]] = [next[catIdx], next[catIdx - 1]];
                    ctx.onUpdate({ skills: { categories: next } });
                  }}
                  onMoveDown={() => {
                    if (catIdx >= data.skills.categories.length - 1) return;
                    const next = [...data.skills.categories];
                    [next[catIdx], next[catIdx + 1]] = [next[catIdx + 1], next[catIdx]];
                    ctx.onUpdate({ skills: { categories: next } });
                  }}
                  onDelete={() => {
                    ctx.onUpdate({ skills: { categories: data.skills.categories.filter((c) => c.id !== cat.id) } });
                    ctx.setFocusedEntryId(null);
                    ctx.setFocusedEntrySection(null);
                  }}
                  showMoveUp={catIdx > 0}
                  showMoveDown={catIdx < data.skills.categories.length - 1}
                  addEntryLabel="+ Skill"
                  addSecondaryEntryLabel="+ Group"
                  showDatePicker={false}
                  settingsOptions={[
                    {
                      key: 'groupTitle',
                      label: 'Group title',
                      enabled: entryFieldOn(`skills:${cat.id}`, 'groupTitle'),
                      onToggle: (next) => setEntryFieldOn(`skills:${cat.id}`, 'groupTitle', next),
                    },
                  ]}
                />
              ) : null}
              <p className="text-[#111827]">
                {entryFieldOn(`skills:${cat.id}`, 'groupTitle') &&
                (cat.name.trim() !== '' || (ctx.focusedEntryId === cat.id && cat.name.trim() === 'Group Title')) ? (
                  <InlineField
                    value={cat.name.trim() === 'Group Title' ? '' : cat.name}
                    placeholder="Skill group title"
                    sectionId="skills"
                    entryId={cat.id}
                    onChange={(v) =>
                      ctx.onUpdate({
                        skills: {
                          categories: data.skills.categories.map((row) => (row.id === cat.id ? { ...row, name: v } : row)),
                        },
                      })
                    }
                    className="font-bold text-[#111827]"
                  />
                ) : cat.name.trim() && cat.name.trim() !== 'Group Title' ? (
                  <span className="font-bold">{cat.name.trim()}: </span>
                ) : null}
                <span className="font-normal">
                  <InlineSkillsCommaField
                    skills={cat.skills}
                    onChange={(next) =>
                      ctx.onUpdate({
                        skills: {
                          categories: data.skills.categories.map((row) =>
                            row.id === cat.id ? { ...row, skills: next } : row,
                          ),
                        },
                      })
                    }
                    onFocus={() => {
                      ctx.setFocusedSection('skills');
                      ctx.setFocusedEntryId(cat.id);
                      ctx.setFocusedEntrySection('skills');
                    }}
                    className="text-[#374151]"
                  />
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    </>
  );

  const sidebarLanguagesInner = (
    <>
      {renderSectionTitle('languages', 'Languages', () => ctx?.onUpdate({ languages: [] }))}
      <ul className="mt-2.5 list-none space-y-1 text-[10.5px] leading-[1.28] text-[#374151]">
        {data.languages.length === 0 && inline && ctx ? (
          <li className="list-none">
            <button
              type="button"
              className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
              onClick={() =>
                ctx.onUpdate({ languages: [{ id: newLocalId(), language: '', proficiency: '' }] })
              }
            >
              + Click to add language
            </button>
          </li>
        ) : (
          data.languages.map((l, lIdx) => {
            const lang = l.language.trim() || 'Language';
            const level = l.proficiency?.trim();
            return (
              <li
                key={l.id}
                data-entry-id={l.id}
                className="flex justify-between gap-3"
                onClick={(ev) => {
                  ev.stopPropagation();
                  ctx?.setFocusedSection('languages');
                  ctx?.setFocusedEntryId(l.id);
                  ctx?.setFocusedEntrySection('languages');
                }}
                style={{
                  outline: ctx?.focusedEntryId === l.id ? '1.5px dashed #00C9B1' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '3px',
                  position: 'relative',
                }}
              >
                {inline && ctx?.focusedEntryId === l.id ? (
                  <EntryToolbar
                    sectionType="languages"
                    onAddEntry={() =>
                      ctx.onUpdate({
                        languages: [...data.languages, { id: newLocalId(), language: '', proficiency: '' }],
                      })
                    }
                    onMoveUp={() => {
                      if (lIdx === 0) return;
                      const next = [...data.languages];
                      [next[lIdx - 1], next[lIdx]] = [next[lIdx], next[lIdx - 1]];
                      ctx.onUpdate({ languages: next });
                    }}
                    onMoveDown={() => {
                      if (lIdx >= data.languages.length - 1) return;
                      const next = [...data.languages];
                      [next[lIdx], next[lIdx + 1]] = [next[lIdx + 1], next[lIdx]];
                      ctx.onUpdate({ languages: next });
                    }}
                    onDelete={() => {
                      ctx.onUpdate({ languages: data.languages.filter((row) => row.id !== l.id) });
                      ctx.setFocusedEntryId(null);
                      ctx.setFocusedEntrySection(null);
                    }}
                    showMoveUp={lIdx > 0}
                    showMoveDown={lIdx < data.languages.length - 1}
                    showDatePicker={false}
                    settingsOptions={[
                      {
                        key: 'level',
                        label: 'Proficiency',
                        enabled: entryFieldOn(`languages:${l.id}`, 'level'),
                        onToggle: (next) => setEntryFieldOn(`languages:${l.id}`, 'level', next),
                      },
                    ]}
                  />
                ) : null}
                {inline && ctx ? (
                  <>
                    <span className="font-semibold text-[#111827]">
                      <InlineField
                        value={l.language}
                        placeholder="Language"
                        sectionId="languages"
                        entryId={l.id}
                        onChange={(v) =>
                          ctx.onUpdate({
                            languages: data.languages.map((row) => (row.id === l.id ? { ...row, language: v } : row)),
                          })
                        }
                        className="font-semibold text-[#111827]"
                      />
                    </span>
                    {entryFieldOn(`languages:${l.id}`, 'level') ? (
                      <span className="shrink-0 text-black/60">
                        <InlineField
                          value={l.proficiency ?? ''}
                          placeholder="e.g. Fluent, Intermediate"
                          sectionId="languages"
                          entryId={l.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              languages: data.languages.map((row) =>
                                row.id === l.id ? { ...row, proficiency: v as CVBuilderLanguage['proficiency'] } : row,
                              ),
                            })
                          }
                          className="text-black/60"
                        />
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{lang}</span>
                    {level ? <span className="shrink-0 text-black/60">{level}</span> : null}
                  </>
                )}
              </li>
            );
          })
        )}
      </ul>
    </>
  );

  const certListModern =
    inline && ctx ? data.certifications : data.certifications.filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim());

  const sidebarCertsInner = (
    <>
      {renderSectionTitle('certifications', 'Certifications', () => ctx?.onUpdate({ certifications: [] }))}
      <div className="mt-2.5 space-y-2 text-[10.5px] leading-[1.28] text-[#374151]">
        {certListModern.length === 0 && inline && ctx ? (
          <button
            type="button"
            className="text-sm italic text-[#00C9B1] hover:underline"
            onClick={() =>
              ctx.onUpdate({
                certifications: [{ id: newLocalId(), name: '', issuer: '', date: '', url: '' }],
              })
            }
          >
            + Click to add certification
          </button>
        ) : (
          certListModern.map((c, cIdx) => (
            <div
              key={c.id}
              data-entry-id={c.id}
              className="border-l-2 pl-2"
              style={{ borderColor: accent }}
              onClick={(ev) => {
                ev.stopPropagation();
                ctx?.setFocusedSection('certifications');
                ctx?.setFocusedEntryId(c.id);
                ctx?.setFocusedEntrySection('certifications');
              }}
            >
              <div
                className="relative mt-0.5 text-[10.5px] font-normal leading-[1.28] text-[#374151]"
                style={{
                  outline: ctx?.focusedEntryId === c.id ? '1.5px dashed #00C9B1' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '3px',
                }}
              >
                {inline && ctx?.focusedEntryId === c.id ? (
                  <EntryToolbar
                    sectionType="certifications"
                    onAddEntry={() =>
                      ctx.onUpdate({
                        certifications: [...data.certifications, { id: newLocalId(), name: '', issuer: '', date: '', url: '' }],
                      })
                    }
                    onMoveUp={() => {
                      if (cIdx === 0) return;
                      const next = [...data.certifications];
                      [next[cIdx - 1], next[cIdx]] = [next[cIdx], next[cIdx - 1]];
                      ctx.onUpdate({ certifications: next });
                    }}
                    onMoveDown={() => {
                      if (cIdx >= data.certifications.length - 1) return;
                      const next = [...data.certifications];
                      [next[cIdx], next[cIdx + 1]] = [next[cIdx + 1], next[cIdx]];
                      ctx.onUpdate({ certifications: next });
                    }}
                    onDelete={() => {
                      ctx.onUpdate({ certifications: data.certifications.filter((row) => row.id !== c.id) });
                      ctx.setFocusedEntryId(null);
                      ctx.setFocusedEntrySection(null);
                    }}
                    onDatePick={(startDate) =>
                      ctx.onUpdate({
                        certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, date: startDate } : row)),
                      })
                    }
                    dateMode="single"
                    dateStart={c.date}
                    dateEnd=""
                    showMoveUp={cIdx > 0}
                    showMoveDown={cIdx < data.certifications.length - 1}
                    showDatePicker
                    settingsOptions={[
                      {
                        key: 'issuer',
                        label: 'Issuer',
                        enabled: entryFieldOn(`certifications:${c.id}`, 'issuer'),
                        onToggle: (next) => setEntryFieldOn(`certifications:${c.id}`, 'issuer', next),
                      },
                      {
                        key: 'date',
                        label: 'Date',
                        enabled: entryFieldOn(`certifications:${c.id}`, 'date'),
                        onToggle: (next) => setEntryFieldOn(`certifications:${c.id}`, 'date', next),
                      },
                      {
                        key: 'url',
                        label: 'Credential URL',
                        enabled: entryFieldOn(`certifications:${c.id}`, 'url'),
                        onToggle: (next) => setEntryFieldOn(`certifications:${c.id}`, 'url', next),
                      },
                    ]}
                  />
                ) : null}
                <p>
                  {inline && ctx ? (
                    <span>
                      <InlineField
                        value={c.name}
                        placeholder="Certification"
                        sectionId="certifications"
                        entryId={c.id}
                        onChange={(v) =>
                          ctx.onUpdate({
                            certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, name: v } : row)),
                          })
                        }
                        className="font-bold text-[#111827]"
                      />
                      {entryFieldOn(`certifications:${c.id}`, 'issuer') ? (
                        <>
                          <span className="text-black/40"> · </span>
                          <InlineField
                            value={c.issuer}
                            placeholder="Issuer"
                            sectionId="certifications"
                            entryId={c.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, issuer: v } : row)),
                              })
                            }
                            className="text-[#374151]"
                          />
                        </>
                      ) : null}
                      {entryFieldOn(`certifications:${c.id}`, 'date') ? (
                        <>
                          <span className="text-black/40"> · </span>
                          <InlineField
                            value={c.date}
                            placeholder="Date"
                            sectionId="certifications"
                            entryId={c.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, date: v } : row)),
                              })
                            }
                            className="text-[#374151]"
                          />
                        </>
                      ) : null}
                      {entryFieldOn(`certifications:${c.id}`, 'url') ? (
                        <span className="mt-1 block">
                          <InlineField
                            value={c.url}
                            placeholder="URL (optional)"
                            sectionId="certifications"
                            entryId={c.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, url: v } : row)),
                              })
                            }
                            className="text-[8.2pt] text-[#374151]"
                          />
                        </span>
                      ) : null}
                    </span>
                  ) : c.url.trim() ? (
                    <a
                      href={c.url.trim().startsWith('http') ? c.url.trim() : `https://${c.url.trim()}`}
                      className="block break-all font-bold text-[#111827] underline"
                      style={{ color: accent }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {c.name || 'Certification'}
                    </a>
                  ) : (
                    <span className="font-bold text-[#111827]">{c.name || 'Certification'}</span>
                  )}
                  {!inline || !ctx ? (
                    <>
                      {c.issuer.trim() ? <span> · {c.issuer.trim()}</span> : null}
                      {c.date.trim() ? (
                        <span className="ml-1 inline-block whitespace-pre-line align-top leading-tight">
                          {formatSidebarDateStack(c.date.trim())}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </p>
                {!inline || !ctx ? (
                  c.url.trim() ? (
                    <p className="mt-0.5 break-all text-[9.5px] text-[#4b5563]">{c.url.trim().replace(/^https?:\/\//i, '')}</p>
                  ) : null
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  const mainSummary =
    vis('summary') && (data.summary.text.trim().length > 0 || inline) ? (
      sectionBox(
        'summary',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('summary', 'Summary', () => ctx?.onUpdate({ summary: { text: '' } }))}
          <div className="mt-1.5 text-left text-[9.5pt] leading-[1.38] text-[#111827]">
            {inline && ctx ? (
              <div
                data-entry-id="summary-body"
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.setFocusedSection('summary');
                  ctx.setFocusedEntryId('summary-body');
                  ctx.setFocusedEntrySection('summary');
                }}
                style={{
                  outline: ctx.focusedEntryId === 'summary-body' ? '1.5px dashed #00C9B1' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '3px',
                  position: 'relative',
                }}
              >
                {ctx.focusedEntryId === 'summary-body' ? (
                  <EntryToolbar
                    sectionType="summary"
                    onAddEntry={() => {}}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                    onDelete={() => {
                      ctx.onUpdate({ summary: { text: '' } });
                      ctx.setFocusedEntryId(null);
                      ctx.setFocusedEntrySection(null);
                    }}
                    showMoveUp={false}
                    showMoveDown={false}
                    showDatePicker={false}
                    hideAddButton
                  />
                ) : null}
                <InlineField
                  multiline
                  sectionId="summary"
                  fieldPath="text"
                  entryId="summary-body"
                  value={data.summary.text}
                  placeholder="Briefly explain why you're a great fit…"
                  onChange={(v) => ctx.onUpdate({ summary: { text: v } })}
                  className="text-[9.5pt] leading-[1.38] text-[#111827]"
                />
              </div>
            ) : (
              <RichText text={data.summary.text} />
            )}
          </div>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )
    ) : null;

  const mainExperience = vis('experience') ? (
    sectionBox(
      'experience',
      activeSection,
      'mb-3',
      <>
        {renderSectionTitle('experience', 'Work experience', () => ctx?.onUpdate({ experience: { items: [] } }))}
        <div className="mt-2.5 space-y-3.5">
          {data.experience.items.length ? (
            data.experience.items.map((x, itemIdx) => (
              <div
                key={x.id}
                id={`cv-preview-experience-item-${x.id}`}
                data-entry-id={x.id}
                className={experienceItemWrapClass(activeSection, x.id)}
                style={{
                  outline: ctx?.focusedEntryId === x.id ? '1.5px dashed #00C9B1' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '3px',
                  position: 'relative',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  ctx?.setFocusedSection('experience');
                  ctx?.setFocusedEntryId(x.id);
                  ctx?.setFocusedEntrySection('experience');
                }}
              >
                {inline && ctx?.focusedEntryId === x.id ? (
                  <EntryToolbar
                    sectionType="experience"
                    onAddEntry={() =>
                      ctx!.onUpdate({
                        experience: {
                          items: [
                            ...data.experience.items,
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
                    onAddBullet={() =>
                      ctx!.onUpdate({
                        experience: {
                          items: data.experience.items.map((row) => {
                            if (row.id !== x.id) return row;
                            const base = Array.isArray(row.bullets)
                              ? row.bullets
                              : normalizeBullets(row.bullets as unknown as string | string[] | undefined);
                            return { ...row, bullets: [...(base.length ? base : ['']), ''] };
                          }),
                        },
                      })
                    }
                    onMoveUp={() => {
                      if (itemIdx === 0) return;
                      const next = [...data.experience.items];
                      [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                      ctx!.onUpdate({ experience: { items: next } });
                    }}
                    onMoveDown={() => {
                      if (itemIdx >= data.experience.items.length - 1) return;
                      const next = [...data.experience.items];
                      [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                      ctx!.onUpdate({ experience: { items: next } });
                    }}
                    onDelete={() => {
                      ctx!.onUpdate({
                        experience: { items: data.experience.items.filter((row) => row.id !== x.id) },
                      });
                      ctx!.setFocusedEntryId(null);
                      ctx!.setFocusedEntrySection(null);
                    }}
                    onDatePick={(startDate, endDate) =>
                      ctx!.onUpdate({
                        experience: {
                          items: data.experience.items.map((row) =>
                            row.id === x.id ? { ...row, startDate, endDate } : row,
                          ),
                        },
                      })
                    }
                    showMoveUp={itemIdx > 0}
                    showMoveDown={itemIdx < data.experience.items.length - 1}
                    showAddBullet
                    dateStart={x.startDate}
                    dateEnd={x.endDate}
                    showDatePicker
                    settingsOptions={[
                      {
                        key: 'title',
                        label: 'Title',
                        enabled: entryFieldOn(`experience:${x.id}`, 'title'),
                        onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'title', next),
                      },
                      {
                        key: 'company',
                        label: 'Company Name',
                        enabled: entryFieldOn(`experience:${x.id}`, 'company'),
                        onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'company', next),
                      },
                      {
                        key: 'location',
                        label: 'Location',
                        enabled: entryFieldOn(`experience:${x.id}`, 'location'),
                        onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'location', next),
                      },
                      {
                        key: 'date',
                        label: 'Date Period',
                        enabled: entryFieldOn(`experience:${x.id}`, 'date'),
                        onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'date', next),
                      },
                      {
                        key: 'bullets',
                        label: 'Bullets',
                        enabled: entryFieldOn(`experience:${x.id}`, 'bullets'),
                        onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'bullets', next),
                      },
                    ]}
                  />
                ) : null}
                <div className="flex justify-between gap-3">
                  {entryFieldOn(`experience:${x.id}`, 'company') ? (
                    <span className="text-[9.5pt] font-bold text-[#111827]">
                      {inline && ctx ? (
                        <InlineField
                          value={x.company}
                          placeholder="Company"
                          onChange={(v) =>
                            ctx.onUpdate({
                              experience: {
                                items: data.experience.items.map((row) => (row.id === x.id ? { ...row, company: v } : row)),
                              },
                            })
                          }
                          className="font-bold text-[#111827]"
                        />
                      ) : (
                        x.company || 'Company'
                      )}
                    </span>
                  ) : (
                    <span />
                  )}
                  {entryFieldOn(`experience:${x.id}`, 'date') ? (
                    <span className="shrink-0 whitespace-nowrap text-[9.5pt] font-semibold text-[#111827]">
                      {inline && ctx ? (
                        <InlineField
                          value={formatCvPeriod(x.startDate, x.endDate, x.current)}
                          placeholder="Dates"
                          onChange={(v) =>
                            ctx.onUpdate({
                              experience: {
                                items: data.experience.items.map((row) =>
                                  row.id === x.id ? { ...row, startDate: v.trim(), endDate: '', current: false } : row,
                                ),
                              },
                            })
                          }
                          className="text-[9.5pt] font-semibold text-[#111827]"
                        />
                      ) : (
                        formatCvPeriod(x.startDate, x.endDate, x.current)
                      )}
                    </span>
                  ) : null}
                </div>
                {entryFieldOn(`experience:${x.id}`, 'title') || entryFieldOn(`experience:${x.id}`, 'location') ? (
                  <p className="mt-0.5 text-[9.5pt] italic" style={{ color: accent }}>
                    {inline && ctx ? (
                      <>
                        {entryFieldOn(`experience:${x.id}`, 'title') ? (
                          <InlineField
                            value={x.title}
                            placeholder="Job title"
                            onChange={(v) =>
                              ctx.onUpdate({
                                experience: {
                                  items: data.experience.items.map((row) => (row.id === x.id ? { ...row, title: v } : row)),
                                },
                              })
                            }
                            className="italic text-[#111827]"
                          />
                        ) : null}
                        {entryFieldOn(`experience:${x.id}`, 'title') && entryFieldOn(`experience:${x.id}`, 'location') ? (
                          <span className="not-italic text-black/55"> · </span>
                        ) : null}
                        {entryFieldOn(`experience:${x.id}`, 'location') ? (
                          <InlineField
                            value={x.location ?? ''}
                            placeholder="Location"
                            onChange={(v) =>
                              ctx.onUpdate({
                                experience: {
                                  items: data.experience.items.map((row) => (row.id === x.id ? { ...row, location: v } : row)),
                                },
                              })
                            }
                            className="not-italic text-black/55"
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        {x.title || 'Job title'}
                        {x.location?.trim() ? <span className="not-italic text-black/55"> · {x.location.trim()}</span> : null}
                      </>
                    )}
                  </p>
                ) : !inline ? (
                  <p className="mt-0.5 text-[9.5pt] italic" style={{ color: accent }}>
                    {x.title || 'Job title'}
                    {x.location?.trim() ? <span className="not-italic text-[#1a1a1a]/65"> · {x.location.trim()}</span> : null}
                  </p>
                ) : null}
                {entryFieldOn(`experience:${x.id}`, 'bullets') ? (
                  <ul className="mt-1 list-none space-y-0.5 text-[9.5pt] leading-[1.35] text-[#111827]">
                    {normalizeBullets(x.bullets as unknown as string | string[] | undefined).map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">•</span>
                        <span>
                          {inline && ctx ? (
                            <InlineField
                              multiline
                              value={b}
                              placeholder="Accomplishment"
                              sectionId="experience"
                              fieldPath={`items[${itemIdx}].bullets[${i}]`}
                              entryId={x.id}
                              dataBulletEntry={x.id}
                              dataBulletIdx={String(i)}
                              onChange={(v) => {
                                const list = [...normalizeBullets(x.bullets as unknown as string | string[] | undefined)];
                                list[i] = v;
                                ctx.onUpdate({
                                  experience: {
                                    items: data.experience.items.map((row) =>
                                      row.id === x.id ? { ...row, bullets: list } : row,
                                    ),
                                  },
                                });
                              }}
                              onInputKeyDown={(e) => {
                                const base = normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                const list = [...(base.length ? base : [''])];
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  list.splice(i + 1, 0, '');
                                  ctx.onUpdate({
                                    experience: {
                                      items: data.experience.items.map((row) =>
                                        row.id === x.id ? { ...row, bullets: list } : row,
                                      ),
                                    },
                                  });
                                  setTimeout(() => {
                                    const inputs = document.querySelectorAll(
                                      `[data-bullet-entry="${x.id}"][data-bullet-idx="${String(i + 1)}"]`,
                                    );
                                    const next = inputs[0] as HTMLElement | undefined;
                                    next?.focus();
                                  }, 50);
                                }
                                if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && list.length > 1) {
                                  e.preventDefault();
                                  const nextBullets = list.filter((_, bi) => bi !== i);
                                  ctx.onUpdate({
                                    experience: {
                                      items: data.experience.items.map((row) =>
                                        row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                      ),
                                    },
                                  });
                                }
                              }}
                              className="text-[#111827]"
                            />
                          ) : (
                            b
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : !inline ? (
                  <ul className="mt-1 list-none space-y-0.5 text-[9.5pt] leading-[1.35] text-[#111827]">
                    {normalizeBullets(x.bullets as unknown as string | string[] | undefined).map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">•</span>
                        <RichText text={b} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-[9.5pt] text-black/45">{inline ? 'Add roles from Sections or your profile.' : 'Add your experience in the editor.'}</p>
          )}
        </div>
      </>,
      diffSection,
      diffChangedFields,
      onAcceptDiff,
      onRejectDiff,
      experienceOuterSectionActive,
    )
  ) : null;

  const mainEducation = vis('education') ? (
    sectionBox(
      'education',
      activeSection,
      'mb-3',
      <>
        {renderSectionTitle('education', 'Education', () => ctx?.onUpdate({ education: { items: [] } }))}
        <div className="mt-2.5 space-y-2.5 text-[9.5pt] leading-tight text-[#111827]">
          {data.education.items.length ? (
            data.education.items.map((e, eduIdx) => (
              <div
                key={e.id}
                data-entry-id={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  ctx?.setFocusedSection('education');
                  ctx?.setFocusedEntryId(e.id);
                  ctx?.setFocusedEntrySection('education');
                }}
                style={{
                  outline: ctx?.focusedEntryId === e.id ? '1.5px dashed #00C9B1' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '3px',
                  position: 'relative',
                }}
              >
                {inline && ctx?.focusedEntryId === e.id ? (
                  <EntryToolbar
                    sectionType="education"
                    onAddEntry={() =>
                      ctx!.onUpdate({
                        education: {
                          items: [
                            ...data.education.items,
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
                    onMoveUp={() => {
                      if (eduIdx === 0) return;
                      const next = [...data.education.items];
                      [next[eduIdx - 1], next[eduIdx]] = [next[eduIdx], next[eduIdx - 1]];
                      ctx!.onUpdate({ education: { items: next } });
                    }}
                    onMoveDown={() => {
                      if (eduIdx >= data.education.items.length - 1) return;
                      const next = [...data.education.items];
                      [next[eduIdx], next[eduIdx + 1]] = [next[eduIdx + 1], next[eduIdx]];
                      ctx!.onUpdate({ education: { items: next } });
                    }}
                    onDelete={() => {
                      ctx!.onUpdate({ education: { items: data.education.items.filter((row) => row.id !== e.id) } });
                      ctx!.setFocusedEntryId(null);
                      ctx!.setFocusedEntrySection(null);
                    }}
                    onDatePick={(startDate, endDate) =>
                      ctx!.onUpdate({
                        education: {
                          items: data.education.items.map((row) =>
                            row.id === e.id ? { ...row, startYear: startDate, endYear: endDate } : row,
                          ),
                        },
                      })
                    }
                    showMoveUp={eduIdx > 0}
                    showMoveDown={eduIdx < data.education.items.length - 1}
                    dateStart={e.startYear}
                    dateEnd={e.endYear}
                    showDatePicker
                    settingsOptions={[
                      {
                        key: 'school',
                        label: 'School / University',
                        enabled: entryFieldOn(`education:${e.id}`, 'school'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'school', next),
                      },
                      {
                        key: 'field',
                        label: 'Field',
                        enabled: entryFieldOn(`education:${e.id}`, 'field'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'field', next),
                      },
                      {
                        key: 'degree',
                        label: 'Degree',
                        enabled: entryFieldOn(`education:${e.id}`, 'degree'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'degree', next),
                      },
                      {
                        key: 'grade',
                        label: 'Grade / honors',
                        enabled: entryFieldOn(`education:${e.id}`, 'grade'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'grade', next),
                      },
                      {
                        key: 'date',
                        label: 'Date period',
                        enabled: entryFieldOn(`education:${e.id}`, 'date'),
                        onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'date', next),
                      },
                    ]}
                  />
                ) : null}
                {inline && ctx ? (
                  <>
                    <div className="flex justify-between gap-3">
                      {entryFieldOn(`education:${e.id}`, 'school') ? (
                        <span className="font-bold">
                          <InlineField
                            value={e.school}
                            placeholder="Institution"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                education: {
                                  items: data.education.items.map((row) => (row.id === e.id ? { ...row, school: v } : row)),
                                },
                              })
                            }
                            className="font-bold text-[#111827]"
                          />
                        </span>
                      ) : (
                        <span />
                      )}
                      {entryFieldOn(`education:${e.id}`, 'date') ? (
                        <span className="shrink-0 text-right font-semibold">
                          <InlineField
                            value={formatEduRangeStacked(e.startYear, e.endYear)}
                            placeholder="Years"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                education: {
                                  items: data.education.items.map((row) =>
                                    row.id === e.id ? { ...row, startYear: v.trim(), endYear: '' } : row,
                                  ),
                                },
                              })
                            }
                            className="whitespace-pre-line text-[9.5pt] font-semibold text-[#111827]"
                          />
                        </span>
                      ) : null}
                    </div>
                    {(entryFieldOn(`education:${e.id}`, 'degree') ||
                      entryFieldOn(`education:${e.id}`, 'field') ||
                      entryFieldOn(`education:${e.id}`, 'grade')) ? (
                      <p className="mt-0.5 italic text-[#111827]">
                        {entryFieldOn(`education:${e.id}`, 'degree') ? (
                          <InlineField
                            value={e.degree}
                            placeholder="Degree"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                education: {
                                  items: data.education.items.map((row) => (row.id === e.id ? { ...row, degree: v } : row)),
                                },
                              })
                            }
                            className="italic text-[#111827]"
                          />
                        ) : null}
                        {entryFieldOn(`education:${e.id}`, 'degree') &&
                        (entryFieldOn(`education:${e.id}`, 'field') || entryFieldOn(`education:${e.id}`, 'grade')) ? (
                          <span className="not-italic text-black/55"> · </span>
                        ) : null}
                        {entryFieldOn(`education:${e.id}`, 'field') ? (
                          <InlineField
                            value={e.field}
                            placeholder="Field"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                education: {
                                  items: data.education.items.map((row) => (row.id === e.id ? { ...row, field: v } : row)),
                                },
                              })
                            }
                            className="italic text-[#111827]"
                          />
                        ) : null}
                        {entryFieldOn(`education:${e.id}`, 'field') && entryFieldOn(`education:${e.id}`, 'grade') ? (
                          <span className="not-italic text-black/55"> · </span>
                        ) : null}
                        {entryFieldOn(`education:${e.id}`, 'grade') ? (
                          <InlineField
                            value={e.grade ?? ''}
                            placeholder="Grade / honors"
                            sectionId="education"
                            entryId={e.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                education: {
                                  items: data.education.items.map((row) => (row.id === e.id ? { ...row, grade: v } : row)),
                                },
                              })
                            }
                            className="not-italic text-black/55"
                          />
                        ) : null}
                      </p>
                    ) : null}
                    <div className="group mt-2 flex justify-center">
                      <button
                        type="button"
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                          addButtonVisibilityClass(activeSection, 'education'),
                        )}
                        aria-label="Add education entry"
                        title="Add education entry"
                        onClick={() =>
                          ctx.onUpdate({
                            education: {
                              items: [
                                ...data.education.items,
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
                        +
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 justify-between gap-3">
                      <span className="min-w-0 font-bold">{e.school || 'Institution'}</span>
                      <span className="max-w-[9.5rem] shrink whitespace-pre-line text-right font-semibold leading-tight break-words">
                        {formatEduRangeStacked(e.startYear, e.endYear)}
                      </span>
                    </div>
                    <p className="mt-0.5 italic text-[#111827]">
                      {[e.degree, e.field].filter(Boolean).join(', ')}
                      {e.grade?.trim() ? <span className="not-italic text-black/55"> · {e.grade.trim()}</span> : null}
                    </p>
                  </>
                )}
              </div>
            ))
          ) : inline && ctx ? (
            <button
              type="button"
              className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
              onClick={() =>
                ctx.onUpdate({
                  education: {
                    items: [
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
              + Click to add education
            </button>
          ) : (
            <p className="text-[9.5pt] text-black/45">Add your education in the editor.</p>
          )}
        </div>
      </>,
      diffSection,
      diffChangedFields,
      onAcceptDiff,
      onRejectDiff,
    )
  ) : null;

  const mainProjects =
    vis('projects') &&
    optionalSectionShown(optionalSectionPresence, 'projects', data.projects.length > 0 || Boolean(inline && ctx)) ? (
      sectionBox(
        'projects',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('projects', 'Projects', () => ctx?.onUpdate({ projects: [] }))}
          <div className="mt-2.5 space-y-2.5 text-[9.5pt] leading-tight text-[#111827]">
            {(() => {
              const rows =
                inline && ctx
                  ? data.projects
                  : data.projects.filter((pr) => {
                      const pAny = pr as unknown as Record<string, unknown>;
                      return (
                        stripHtmlTags(pr.name || '').trim() ||
                        Boolean(pr.description?.trim()) ||
                        Boolean(pr.url?.trim()) ||
                        projectPayloadBullets(pAny).length > 0 ||
                        projectPayloadTech(pAny).length > 0
                      );
                    });
              if (rows.length === 0 && inline && ctx) {
                return (
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={() =>
                      ctx.onUpdate({
                        projects: [{ id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' }],
                      })
                    }
                  >
                    + Click to add project
                  </button>
                );
              }
              return rows.map((pr, prIdx) => {
                const pAny = pr as unknown as Record<string, unknown>;
                const techList = projectPayloadTech(pAny);
                const rawBullets = typeof pr.bullets === 'string' ? pr.bullets : normalizeBullets(pr.bullets as unknown as string | string[] | undefined).join('\n');
                const bLines = rawBullets.split(/\r?\n/);
                if (inline && ctx) {
                  return (
                    <div
                      key={pr.id}
                      data-entry-id={pr.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        ctx.setFocusedSection('projects');
                        ctx.setFocusedEntryId(pr.id);
                        ctx.setFocusedEntrySection('projects');
                      }}
                      style={{
                        outline: ctx.focusedEntryId === pr.id ? '1.5px dashed #00C9B1' : 'none',
                        outlineOffset: '3px',
                        borderRadius: '3px',
                        position: 'relative',
                      }}
                    >
                      {ctx.focusedEntryId === pr.id ? (
                        <EntryToolbar
                          sectionType="projects"
                          onAddBullet={() =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) =>
                                row.id === pr.id
                                  ? { ...row, bullets: `${row.bullets ?? ''}${(row.bullets ?? '').toString().length ? '\n' : ''}` }
                                  : row,
                              ),
                            })
                          }
                          onAddEntry={() =>
                            ctx.onUpdate({
                              projects: [
                                ...data.projects,
                                { id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' },
                              ],
                            })
                          }
                          onMoveUp={() => {
                            if (prIdx === 0) return;
                            const next = [...data.projects];
                            [next[prIdx - 1], next[prIdx]] = [next[prIdx], next[prIdx - 1]];
                            ctx.onUpdate({ projects: next });
                          }}
                          onMoveDown={() => {
                            if (prIdx >= data.projects.length - 1) return;
                            const next = [...data.projects];
                            [next[prIdx], next[prIdx + 1]] = [next[prIdx + 1], next[prIdx]];
                            ctx.onUpdate({ projects: next });
                          }}
                          onDelete={() => {
                            ctx.onUpdate({ projects: data.projects.filter((row) => row.id !== pr.id) });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }}
                          showMoveUp={prIdx > 0}
                          showMoveDown={prIdx < data.projects.length - 1}
                          showAddBullet
                          showDatePicker={false}
                          settingsOptions={[
                            {
                              key: 'description',
                              label: 'Description',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'description'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'description', next),
                            },
                            {
                              key: 'technologies',
                              label: 'Tools & keywords',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'technologies'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'technologies', next),
                            },
                            {
                              key: 'url',
                              label: 'Project link',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'url'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'url', next),
                            },
                            {
                              key: 'bullets',
                              label: 'Bullets',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'bullets'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'bullets', next),
                            },
                          ]}
                        />
                      ) : null}
                      <p className="font-bold">
                        <InlineField
                          value={pr.name || ''}
                          placeholder="Project name"
                          sectionId="projects"
                          entryId={pr.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) => (row.id === pr.id ? { ...row, name: v } : row)),
                            })
                          }
                          className="font-bold text-[#111827]"
                        />
                      </p>
                      {entryFieldOn(`projects:${pr.id}`, 'description') ? (
                        <div className="mt-1">
                          <InlineField
                            multiline
                            layout="block"
                            value={pr.description ?? ''}
                            placeholder="Project description"
                            sectionId="projects"
                            entryId={pr.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                projects: data.projects.map((row) => (row.id === pr.id ? { ...row, description: v } : row)),
                              })
                            }
                            className="text-[9.5pt] text-[#111827]"
                          />
                        </div>
                      ) : null}
                      {entryFieldOn(`projects:${pr.id}`, 'technologies') ? (
                        <p className="mt-1 text-[8.2pt] text-black/65">
                          <InlineField
                            value={techList.join(', ')}
                            placeholder="Tools, software, methods (comma-separated)"
                            sectionId="projects"
                            entryId={pr.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                projects: data.projects.map((row) =>
                                  row.id === pr.id
                                    ? { ...row, technologies: v.split(',').map((t) => t.trim()).filter(Boolean) }
                                    : row,
                                ),
                              })
                            }
                            className="text-[8.2pt] text-[#111827]"
                          />
                        </p>
                      ) : null}
                      {entryFieldOn(`projects:${pr.id}`, 'url') ? (
                        <p className="mt-1 text-[8.2pt]">
                          <InlineField
                            value={pr.url ?? ''}
                            placeholder="Project URL"
                            sectionId="projects"
                            entryId={pr.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                projects: data.projects.map((row) => (row.id === pr.id ? { ...row, url: v } : row)),
                              })
                            }
                            className="text-[8.2pt] text-[#111827]"
                          />
                        </p>
                      ) : null}
                      {entryFieldOn(`projects:${pr.id}`, 'bullets') ? (
                        <ul className="mt-1 list-none space-y-0.5 pl-0 text-[9.5pt] leading-[1.35] text-[#111827]">
                          {(bLines.length > 0 ? bLines : ['']).map((b, bIdx) => (
                            <li key={`${pr.id}-bullet-${bIdx}`} className="flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0">•</span>
                              <span className="flex-1">
                                <InlineField
                                  value={b}
                                  layout="block"
                                  placeholder="Project bullet"
                                  sectionId="projects"
                                  entryId={pr.id}
                                  dataBulletIdx={String(bIdx)}
                                  onChange={(v) => {
                                    const arr = rawBullets.split(/\r?\n/);
                                    const next = [...(arr.length ? arr : [''])];
                                    next[bIdx] = normalizeBulletInput(v);
                                    ctx.onUpdate({
                                      projects: data.projects.map((row) =>
                                        row.id === pr.id ? { ...row, bullets: next.join('\n') } : row,
                                      ),
                                    });
                                  }}
                                  onInputKeyDown={(e) => {
                                    const arr = rawBullets.split(/\r?\n/);
                                    const next = [...(arr.length ? arr : [''])];
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      next.splice(bIdx + 1, 0, '');
                                      ctx.onUpdate({
                                        projects: data.projects.map((row) =>
                                          row.id === pr.id ? { ...row, bullets: next.join('\n') } : row,
                                        ),
                                      });
                                    }
                                    if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && next.length > 1) {
                                      e.preventDefault();
                                      const filtered = next.filter((_, i) => i !== bIdx);
                                      ctx.onUpdate({
                                        projects: data.projects.map((row) =>
                                          row.id === pr.id ? { ...row, bullets: filtered.join('\n') } : row,
                                        ),
                                      });
                                    }
                                  }}
                                  className="text-[#111827]"
                                />
                              </span>
                              {ctx.focusedEntryId === pr.id && ctx.focusedEntrySection === 'projects' ? (
                                <button
                                  type="button"
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    const arr = rawBullets.split(/\r?\n/);
                                    if (arr.length <= 1) return;
                                    const filtered = arr.filter((_, i) => i !== bIdx);
                                    ctx.onUpdate({
                                      projects: data.projects.map((row) =>
                                        row.id === pr.id ? { ...row, bullets: filtered.join('\n') } : row,
                                      ),
                                    });
                                  }}
                                  aria-label="Remove bullet"
                                >
                                  ×
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <div key={pr.id}>
                    <p className="font-bold">{stripHtmlTags(pr.name || '') || 'Project'}</p>
                    {pr.description?.trim() ? (
                      <p className="mt-1 leading-snug">
                        <RichText text={pr.description} />
                      </p>
                    ) : null}
                    {techList.length ? <p className="mt-1 text-[8.2pt] text-black/60">{techList.join(', ')}</p> : null}
                    {pr.url?.trim() ? (
                      <p className="mt-1 text-[8.2pt]">{linkify(pr.url)}</p>
                    ) : null}
                    {bLines.filter((x) => x.trim()).length ? (
                      <ul className="mt-1 list-disc list-outside pl-4 text-[9.5pt] leading-[1.35]">
                        {bLines.map((b, i) => (
                          <li key={i}>
                            <RichText text={b} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              });
            })()}
          </div>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )
    ) : null;

  const mainAchievements =
    optionalSectionShown(
      optionalSectionPresence,
      'achievements',
      data.achievements.length > 0 || Boolean(inline && ctx),
    ) && vis('achievements') ? (
      sectionBox(
        'achievements',
        activeSection,
        'mt-2 mb-3',
        <>
          {renderSectionTitle('achievements', 'Achievements & awards', () => ctx?.onUpdate({ achievements: [] }))}
          <div className="mt-2.5 space-y-2 text-[9.5pt] leading-[1.32] text-[#111827]">
            {(() => {
              const rows =
                inline && ctx
                  ? data.achievements
                  : data.achievements.filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail.trim());
              if (rows.length === 0 && inline && ctx) {
                return (
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={() =>
                      ctx.onUpdate({
                        achievements: [{ id: newLocalId(), title: '', issuer: '', date: '', detail: '' }],
                      })
                    }
                  >
                    + Click to add achievement
                  </button>
                );
              }
              return rows.map((a, aIdx) => {
                if (inline && ctx) {
                  return (
                    <div
                      key={a.id}
                      data-entry-id={a.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        ctx.setFocusedSection('achievements');
                        ctx.setFocusedEntryId(a.id);
                        ctx.setFocusedEntrySection('achievements');
                      }}
                      style={{
                        outline: ctx.focusedEntryId === a.id ? '1.5px dashed #00C9B1' : 'none',
                        outlineOffset: '3px',
                        borderRadius: '3px',
                        position: 'relative',
                      }}
                    >
                      {ctx.focusedEntryId === a.id ? (
                        <EntryToolbar
                          sectionType="achievements"
                          onAddEntry={() =>
                            ctx.onUpdate({
                              achievements: [...data.achievements, { id: newLocalId(), title: '', issuer: '', date: '', detail: '' }],
                            })
                          }
                          onMoveUp={() => {
                            if (aIdx === 0) return;
                            const next = [...data.achievements];
                            [next[aIdx - 1], next[aIdx]] = [next[aIdx], next[aIdx - 1]];
                            ctx.onUpdate({ achievements: next });
                          }}
                          onMoveDown={() => {
                            if (aIdx >= data.achievements.length - 1) return;
                            const next = [...data.achievements];
                            [next[aIdx], next[aIdx + 1]] = [next[aIdx + 1], next[aIdx]];
                            ctx.onUpdate({ achievements: next });
                          }}
                          onDelete={() => {
                            ctx.onUpdate({ achievements: data.achievements.filter((row) => row.id !== a.id) });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }}
                          onDatePick={(startDate) =>
                            ctx.onUpdate({
                              achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, date: startDate } : row)),
                            })
                          }
                          dateMode="single"
                          dateStart={a.date}
                          dateEnd=""
                          showMoveUp={aIdx > 0}
                          showMoveDown={aIdx < data.achievements.length - 1}
                          showDatePicker
                          settingsOptions={[
                            {
                              key: 'issuer',
                              label: 'Issuer',
                              enabled: entryFieldOn(`achievements:${a.id}`, 'issuer'),
                              onToggle: (next) => setEntryFieldOn(`achievements:${a.id}`, 'issuer', next),
                            },
                            {
                              key: 'date',
                              label: 'Date',
                              enabled: entryFieldOn(`achievements:${a.id}`, 'date'),
                              onToggle: (next) => setEntryFieldOn(`achievements:${a.id}`, 'date', next),
                            },
                            {
                              key: 'detail',
                              label: 'Description',
                              enabled: entryFieldOn(`achievements:${a.id}`, 'detail'),
                              onToggle: (next) => setEntryFieldOn(`achievements:${a.id}`, 'detail', next),
                            },
                          ]}
                        />
                      ) : null}
                      <div className="flex justify-between gap-3">
                        <p className="min-w-0 font-bold">
                          <InlineField
                            value={a.title}
                            placeholder="Achievement title"
                            sectionId="achievements"
                            fieldPath={`items[${aIdx}].title`}
                            entryId={a.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, title: v } : row)),
                              })
                            }
                            className="font-bold text-[#111827]"
                          />
                          {entryFieldOn(`achievements:${a.id}`, 'issuer') ? (
                            <>
                              <span className="font-normal">, </span>
                              <InlineField
                                value={a.issuer}
                                placeholder="Issuer"
                                sectionId="achievements"
                                entryId={a.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, issuer: v } : row)),
                                  })
                                }
                                className="font-normal text-[#111827]"
                              />
                            </>
                          ) : null}
                        </p>
                        {entryFieldOn(`achievements:${a.id}`, 'date') ? (
                          <span className="shrink-0 text-right font-semibold whitespace-pre-line leading-tight">
                            <InlineField
                              value={formatSidebarDateStack(a.date)}
                              placeholder="Date"
                              sectionId="achievements"
                              entryId={a.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, date: v } : row)),
                                })
                              }
                            className="whitespace-pre-line font-semibold text-[#111827]"
                            />
                          </span>
                        ) : null}
                      </div>
                      {entryFieldOn(`achievements:${a.id}`, 'detail') ? (
                        <div className="mt-1">
                          <InlineField
                            multiline
                            layout="block"
                            value={a.detail}
                            placeholder="Achievement detail"
                            sectionId="achievements"
                            fieldPath={`items[${aIdx}].detail`}
                            entryId={a.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, detail: v } : row)),
                              })
                            }
                            className="leading-[1.55] text-[#111827]"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <div key={a.id}>
                    <div className="flex justify-between gap-3">
                      <p className="min-w-0 font-bold">
                        <span>{a.title || 'Achievement'}</span>
                        {a.issuer.trim() ? (
                          <>
                            <span className="font-normal">, </span>
                            <span className="font-normal">{a.issuer.trim()}</span>
                          </>
                        ) : null}
                      </p>
                    {a.date.trim() ? (
                      <span className="shrink-0 whitespace-pre-line text-right font-semibold leading-tight">
                        {formatSidebarDateStack(a.date.trim())}
                      </span>
                    ) : null}
                    </div>
                    {a.detail.trim() ? (
                      <p className="mt-1 whitespace-pre-wrap leading-[1.55]">{a.detail.trim()}</p>
                    ) : null}
                  </div>
                );
              });
            })()}
          </div>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )
    ) : null;

  const mainCustom =
    shouldRenderCustomLegacySection(data, inline) && vis('custom-legacy') ? (
      <CVSectionWrapper sectionId="custom-legacy">
      {sectionBox(
        'custom-legacy',
        activeSection,
        'mb-3',
        <>
          {inline && ctx && data.customSections.length === 0 ? (
            <button
              type="button"
              className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
              onClick={() =>
                ctx.onUpdate({
                  customSections: [{ id: newLocalId(), title: '', body: '' }],
                })
              }
            >
              + Click to add section
            </button>
          ) : null}
          {(inline && ctx ? data.customSections : data.customSections.filter((x) => x.title.trim() || x.body.trim())).map((x, xIdx) => (
              <div key={x.id} className="relative mb-4 last:mb-0">
                {inline && ctx ? (
                  <EntryToolbar
                    sectionType="custom"
                    onAddEntry={() =>
                      ctx.onUpdate({
                        customSections: [...data.customSections, { id: newLocalId(), title: '', body: '' }],
                      })
                    }
                    onMoveUp={() => {
                      if (xIdx === 0) return;
                      const next = [...data.customSections];
                      [next[xIdx - 1], next[xIdx]] = [next[xIdx], next[xIdx - 1]];
                      ctx.onUpdate({ customSections: next });
                    }}
                    onMoveDown={() => {
                      if (xIdx >= data.customSections.length - 1) return;
                      const next = [...data.customSections];
                      [next[xIdx], next[xIdx + 1]] = [next[xIdx + 1], next[xIdx]];
                      ctx.onUpdate({ customSections: next });
                    }}
                    onDelete={() => ctx.onUpdate({ customSections: data.customSections.filter((row) => row.id !== x.id) })}
                    showMoveUp={xIdx > 0}
                    showMoveDown={xIdx < data.customSections.length - 1}
                    showDatePicker={false}
                  />
                ) : null}
                {inline && ctx ? (
                  <div className="mt-3">
                    <span style={{ color: accent }}>
                      <InlineField
                        value={x.title}
                        placeholder="Section title"
                        sectionId="custom-legacy"
                        entryId={x.id}
                        onChange={(v) =>
                          ctx.onUpdate({
                            customSections: data.customSections.map((row) => (row.id === x.id ? { ...row, title: v } : row)),
                          })
                        }
                        className="text-left text-[10pt] font-bold uppercase tracking-[0.12em]"
                      />
                    </span>
                    <div className="mt-1 h-px w-full" style={{ backgroundColor: accent, height: '1.5px' }} />
                  </div>
                ) : (
                  modernSectionTitle(x.title.trim() || 'Additional')
                )}
                <div className="mt-1.5 text-[9.5pt] leading-[1.38] text-[#111827]">
                  {inline && ctx ? (
                    <InlineField
                      multiline
                      layout="block"
                      value={x.body}
                      placeholder="Section details"
                      sectionId="custom-legacy"
                      entryId={x.id}
                      onChange={(v) =>
                        ctx.onUpdate({
                          customSections: data.customSections.map((row) => (row.id === x.id ? { ...row, body: v } : row)),
                        })
                      }
                      className="text-[#111827]"
                    />
                  ) : (
                    <RichText text={x.body.trim()} />
                  )}
                </div>
              </div>
            ))}
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )}
      </CVSectionWrapper>
    ) : null;

  const parsedMainByKey: Record<string, ReactNode> = {};
  const mainParsed = filterParsedCustomSectionsForEditor(data.parsedCustomSections).map((block) => {
    const node =
      block.title.trim() || block.items.some((i) => i.text.trim() || i.subItems.length) ? (
      <Fragment key={block.sectionId}>
        {vis(`parsed-${block.sectionId}`) ? (
          <CVSectionWrapper sectionId={`parsed-${block.sectionId}`}>
            {sectionBox(
              `parsed-${block.sectionId}`,
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle(`parsed-${block.sectionId}`, block.title.trim() || 'Additional', () =>
                  ctx?.onUpdate({
                    parsedCustomSections: data.parsedCustomSections.filter((b) => b.sectionId !== block.sectionId),
                  })
                )}
                <div className="mt-2.5 space-y-2 text-[9.5pt] leading-[1.32] text-[#111827]">
                  {block.items.length === 0 && inline && ctx ? (
                    <button
                      type="button"
                      className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                      onClick={() =>
                        ctx.onUpdate({
                          parsedCustomSections: data.parsedCustomSections.map((b) =>
                            b.sectionId === block.sectionId
                              ? { ...b, items: [{ id: newLocalId(), text: '', date: '', subItems: [] }] }
                              : b,
                          ),
                        })
                      }
                    >
                      + Click to add item
                    </button>
                  ) : null}
                  {block.items.map((item, itemIdx) => {
                    const usesRangeDates = /volunteer|experience|employment|work|project/i.test(block.sectionType);
                    return (
                      <div
                        key={item.id}
                        data-entry-id={item.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          ctx?.setFocusedSection(`parsed-${block.sectionId}`);
                          ctx?.setFocusedEntryId(item.id);
                          ctx?.setFocusedEntrySection(`parsed-${block.sectionId}`);
                        }}
                        style={{
                          outline: ctx?.focusedEntryId === item.id ? '1.5px dashed #00C9B1' : 'none',
                          outlineOffset: '3px',
                          borderRadius: '3px',
                          position: 'relative',
                        }}
                      >
                        {inline && ctx?.focusedEntryId === item.id ? (
                          <EntryToolbar
                            sectionType={block.sectionType}
                            onAddBullet={() =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? {
                                        ...b,
                                        items: b.items.map((it) =>
                                          it.id === item.id ? { ...it, subItems: [...(it.subItems.length ? it.subItems : ['']), ''] } : it,
                                        ),
                                      }
                                    : b,
                                ),
                              })
                            }
                            onAddEntry={() =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? { ...b, items: [...b.items, { id: newLocalId(), text: '', date: '', subItems: [] }] }
                                    : b,
                                ),
                              })
                            }
                            onMoveUp={() => {
                              if (itemIdx === 0) return;
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) => {
                                  if (b.sectionId !== block.sectionId) return b;
                                  const next = [...b.items];
                                  [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                                  return { ...b, items: next };
                                }),
                              });
                            }}
                            onMoveDown={() => {
                              if (itemIdx >= block.items.length - 1) return;
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) => {
                                  if (b.sectionId !== block.sectionId) return b;
                                  const next = [...b.items];
                                  [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                                  return { ...b, items: next };
                                }),
                              });
                            }}
                            onDelete={() => {
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId ? { ...b, items: b.items.filter((it) => it.id !== item.id) } : b,
                                ),
                              });
                              ctx.setFocusedEntryId(null);
                              ctx.setFocusedEntrySection(null);
                            }}
                            onDatePick={(startDate, endDate) =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? {
                                        ...b,
                                        items: b.items.map((it) => {
                                          if (it.id !== item.id) return it;
                                          return { ...it, date: usesRangeDates ? [startDate, endDate].filter(Boolean).join(' - ') : startDate };
                                        }),
                                      }
                                    : b,
                                ),
                              })
                            }
                            dateMode={usesRangeDates ? 'range' : 'single'}
                            dateStart={splitCvStoredRange(item.date ?? '').start}
                            dateEnd={splitCvStoredRange(item.date ?? '').end}
                            showMoveUp={itemIdx > 0}
                            showMoveDown={itemIdx < block.items.length - 1}
                            showAddBullet
                            showDatePicker
                            settingsOptions={[
                              {
                                key: 'date',
                                label: 'Date',
                                enabled: entryFieldOn(`parsed:${item.id}`, 'date'),
                                onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'date', next),
                              },
                              {
                                key: 'bullets',
                                label: 'Bullets',
                                enabled: entryFieldOn(`parsed:${item.id}`, 'bullets'),
                                onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'bullets', next),
                              },
                            ]}
                          />
                        ) : null}
                        {inline && ctx ? (
                          <>
                            <p className="font-semibold">
                              <InlineField
                                value={item.text}
                                placeholder={parsedCustomMainPlaceholder(block.sectionType)}
                                sectionId={`parsed-${block.sectionId}`}
                                entryId={item.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    parsedCustomSections: data.parsedCustomSections.map((b) =>
                                      b.sectionId === block.sectionId
                                        ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, text: v } : it)) }
                                        : b,
                                    ),
                                  })
                                }
                                className="font-semibold text-[#111827]"
                              />
                              <span className="font-normal"> </span>
                              {entryFieldOn(`parsed:${item.id}`, 'date') ? (
                                <InlineField
                                  value={item.date ?? ''}
                                  placeholder={usesRangeDates ? 'Date range (From - To)' : 'Date'}
                                  sectionId={`parsed-${block.sectionId}`}
                                  entryId={item.id}
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId
                                          ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, date: v } : it)) }
                                          : b,
                                      ),
                                    })
                                  }
                                  className="text-[#111827]"
                                />
                              ) : null}
                            </p>
                            {entryFieldOn(`parsed:${item.id}`, 'bullets') ? (
                              <ul className="mt-1 list-none space-y-0.5 pl-0 text-[9.5pt] leading-[1.35] text-[#111827]">
                                {(item.subItems.length > 0 ? item.subItems : ['']).map((line, lineIdx) => (
                                  <li key={`${item.id}-sub-${lineIdx}`} className="flex items-start gap-1.5">
                                    <span className="mt-0.5 shrink-0">•</span>
                                    <span className="flex-1">
                                      <InlineField
                                        value={line}
                                        layout="block"
                                        placeholder="Detail bullet"
                                        sectionId={`parsed-${block.sectionId}`}
                                        entryId={item.id}
                                        dataBulletIdx={item.id}
                                        onChange={(v) =>
                                          ctx.onUpdate({
                                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                                              b.sectionId === block.sectionId
                                                ? {
                                                    ...b,
                                                    items: b.items.map((it) => {
                                                      if (it.id !== item.id) return it;
                                                      const next = [...(it.subItems.length ? it.subItems : [''])];
                                                      next[lineIdx] = normalizeBulletInput(v);
                                                      return { ...it, subItems: next };
                                                    }),
                                                  }
                                                : b,
                                            ),
                                          })
                                        }
                                        onInputKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            ctx.onUpdate({
                                              parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                b.sectionId === block.sectionId
                                                  ? {
                                                      ...b,
                                                      items: b.items.map((it) => {
                                                        if (it.id !== item.id) return it;
                                                        const next = [...(it.subItems.length ? it.subItems : [''])];
                                                        next.splice(lineIdx + 1, 0, '');
                                                        return { ...it, subItems: next };
                                                      }),
                                                    }
                                                  : b,
                                              ),
                                            });
                                          }
                                          if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && (item.subItems.length || 1) > 1) {
                                            e.preventDefault();
                                            ctx.onUpdate({
                                              parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                b.sectionId === block.sectionId
                                                  ? {
                                                      ...b,
                                                      items: b.items.map((it) =>
                                                        it.id === item.id
                                                          ? {
                                                              ...it,
                                                              subItems: (it.subItems.length ? it.subItems : ['']).filter((_, i) => i !== lineIdx),
                                                            }
                                                          : it,
                                                      ),
                                                    }
                                                  : b,
                                              ),
                                            });
                                          }
                                        }}
                                        className="text-[#111827]"
                                      />
                                    </span>
                                    {ctx?.focusedEntryId === item.id && ctx?.focusedEntrySection === `parsed-${block.sectionId}` ? (
                                      <button
                                        type="button"
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          const current = item.subItems.length ? item.subItems : [''];
                                          if (current.length <= 1) return;
                                          ctx.onUpdate({
                                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                                              b.sectionId === block.sectionId
                                                ? {
                                                    ...b,
                                                    items: b.items.map((it) =>
                                                      it.id === item.id ? { ...it, subItems: current.filter((_, i) => i !== lineIdx) } : it,
                                                    ),
                                                  }
                                                : b,
                                            ),
                                          });
                                        }}
                                        aria-label="Remove bullet"
                                      >
                                        ×
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <p className="font-semibold">
                              <RichText text={item.text} />
                              {item.date?.trim() ? <span className="ml-2 font-normal text-black/55">({item.date.trim()})</span> : null}
                            </p>
                            {item.subItems.length > 0 ? (
                              <ul className="mt-1 list-disc list-outside pl-4 leading-[1.32]">
                                {item.subItems.map((line, i) => (
                                  <li key={i}>
                                    <RichText text={line} />
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )}
          </CVSectionWrapper>
        ) : null}
      </Fragment>
    ) : null;
    if (node) parsedMainByKey[`parsed-${block.sectionId}`] = node;
    return node;
  });

  const modernSidebarKeys = new Set([
    'personal',
    'skills',
    'education',
    'languages',
    'certifications',
    'achievements',
    'references',
  ]);
  const isModernMainKey = (id: string) =>
    id === 'summary' || id === 'experience' || id === 'projects' || id === 'custom-legacy' || id.startsWith('parsed-');
  const defaultModernSidebarWalk = [
    'personal',
    'skills',
    'education',
    'languages',
    'certifications',
    'achievements',
    'references',
  ] as const;
  const parsedKeysOrderedModern = orderedParsedPreviewKeys(
    sectionOrder,
    filterParsedCustomSectionsForEditor(data.parsedCustomSections).filter(
      (b) => b.title.trim() || b.items.some((i) => i.text.trim() || i.subItems.length) || Boolean(inline && ctx),
    ),
  );
  const showCustomModern =
    shouldRenderCustomLegacySection(data, inline) && vis('custom-legacy');
  const defaultModernMainWalk = [
    'summary',
    'experience',
    'projects',
    ...(showCustomModern ? (['custom-legacy'] as const) : []),
    ...parsedKeysOrderedModern,
  ];
  const mergeModernOrder = (full: string[] | undefined, defaults: readonly string[], allow: (id: string) => boolean): string[] => {
    if (full && full.length > 0) {
      const fromOrder = full.filter(allow);
      const seen = new Set(fromOrder);
      return [...fromOrder, ...defaults.filter((id) => allow(id) && !seen.has(id))];
    }
    return defaults.filter((id) => allow(id));
  };
  const sidebarWalk = mergeModernOrder(sectionOrder, defaultModernSidebarWalk, (id) => modernSidebarKeys.has(id));
  const mainWalk = mergeModernOrder(sectionOrder, defaultModernMainWalk, isModernMainKey);

  return (
    <div className={cn('box-border min-w-0 w-full bg-white text-[9.5pt] leading-normal text-[#111827] antialiased', inter.className)}>
      <div className="flex min-h-[720px] w-full">
        <aside className="relative z-30 w-[28%] shrink-0 px-[14px] py-5" style={{ backgroundColor: sidebarBg }}>
          {sidebarWalk.map((id) => {
            if (id === 'personal') {
              return vis('personal') ? (
                <CVSectionWrapper key={id} sectionId="personal">
                  {sectionBox(
                    'personal',
                    activeSection,
                    'mb-4',
                    sidebarPersonalInner,
                    diffSection,
                    diffChangedFields,
                    onAcceptDiff,
                    onRejectDiff,
                  )}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'skills') {
              return vis('skills') ? (
                <CVSectionWrapper key={id} sectionId="skills">
                  {sectionBox(
                    'skills',
                    activeSection,
                    'mb-4',
                    sidebarSkillsInner,
                    diffSection,
                    diffChangedFields,
                    onAcceptDiff,
                    onRejectDiff,
                  )}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'education') {
              return mainEducation ? (
                <CVSectionWrapper key={id} sectionId="education">
                  {mainEducation}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'languages') {
              return vis('languages') &&
                optionalSectionShown(optionalSectionPresence, 'languages', data.languages.length > 0 || Boolean(inline && ctx)) ? (
                <CVSectionWrapper key={id} sectionId="languages">
                  {sectionBox(
                    'languages',
                    activeSection,
                    'mb-4',
                    sidebarLanguagesInner,
                    diffSection,
                    diffChangedFields,
                    onAcceptDiff,
                    onRejectDiff,
                  )}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'certifications') {
              return vis('certifications') &&
                optionalSectionShown(
                  optionalSectionPresence,
                  'certifications',
                  data.certifications.length > 0 || Boolean(inline && ctx),
                ) ? (
                <CVSectionWrapper key={id} sectionId="certifications">
                  {sectionBox(
                    'certifications',
                    activeSection,
                    '',
                    sidebarCertsInner,
                    diffSection,
                    diffChangedFields,
                    onAcceptDiff,
                    onRejectDiff,
                  )}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'references') {
              return vis('references') &&
                optionalSectionShown(
                  optionalSectionPresence,
                  'references',
                  filterCvBuilderReferences(data.references).length > 0 || Boolean(inline && ctx),
                ) ? (
                <CVSectionWrapper key={id} sectionId="references">
                  {sectionBox(
                    'references',
                    activeSection,
                    '',
                    <>
                      {renderSectionTitle('references', 'References', () => ctx?.onUpdate({ references: [] }))}
                      <CvEditableReferencesList
                        references={data.references}
                        layout="compact"
                        textClassName="text-[9pt] leading-[1.32] text-black"
                      />
                    </>,
                    diffSection,
                    diffChangedFields,
                    onAcceptDiff,
                    onRejectDiff,
                  )}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'achievements') {
              return mainAchievements ? (
                <CVSectionWrapper key={id} sectionId="achievements">
                  {mainAchievements}
                </CVSectionWrapper>
              ) : null;
            }
            return null;
          })}
        </aside>
        <div className="relative z-10 min-w-0 flex-1 bg-white px-[22px] py-5">
          {modernMainHeader}
          {mainWalk.map((id) => {
            if (id === 'summary') {
              return mainSummary ? (
                <CVSectionWrapper key={id} sectionId="summary">
                  {mainSummary}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'experience') {
              return mainExperience ? (
                <CVSectionWrapper key={id} sectionId="experience">
                  {mainExperience}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'projects') {
              return mainProjects ? (
                <CVSectionWrapper key={id} sectionId="projects">
                  {mainProjects}
                </CVSectionWrapper>
              ) : null;
            }
            if (id === 'custom-legacy') return mainCustom ? <Fragment key={id}>{mainCustom}</Fragment> : null;
            if (id.startsWith('parsed-')) {
              const n = parsedMainByKey[id];
              return n ? <Fragment key={id}>{n}</Fragment> : null;
            }
            return null;
          })}
        </div>
      </div>
      <CvPreviewWatermarkFooter />
    </div>
  );
}

/** Creative — bold teal header band + refined single-column body (no icon fonts) */
function CreativeDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
  optionalSectionPresence,
  sectionOrder,
  onReorderSections,
}: {
  data: CVBuilderData;
  activeSection?: string | null;
  sectionVisibility?: CVSectionVisibilityMap | null;
  diffSection?: string | null;
  diffChangedFields?: ChangedField[] | null;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  optionalSectionPresence?: Set<string>;
  sectionOrder?: string[];
  onReorderSections?: (nextOrder: string[]) => void;
}) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing && ctx?.onUpdate);
  const hp = ctx?.headerPreview ?? DEFAULT_HEADER_PREVIEW;
  const [sectionTitleOverrides, setSectionTitleOverrides] = useState<Record<string, string>>({});
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  /**
   * Reconcile local hides with backend visibility — when a section becomes visible again
   * (e.g. user re-added/restored it via the Sections modal), clear it from the local hidden
   * set so the preview renders the section instantly without a manual refresh.
   */
  useEffect(() => {
    if (!sectionVisibility) return;
    setHiddenSections((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const key of prev) {
        if (sectionVisibility[key] === true) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sectionVisibility]);
  const [entryFieldVisibility, setEntryFieldVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const entryFieldOn = (entryKey: string, field: string) => entryFieldVisibility[entryKey]?.[field] ?? true;
  const setEntryFieldOn = (entryKey: string, field: string, enabled: boolean) => {
    setEntryFieldVisibility((prev) => ({
      ...prev,
      [entryKey]: { ...(prev[entryKey] ?? {}), [field]: enabled },
    }));
  };
  const draggingSectionIdRef = useRef<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const p = data.personal;
  const name = p.name.trim() || 'Your Name';
  const vis = (k: string) => isCvSectionVisible(k, sectionVisibility) && !hiddenSections.has(k);
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);
  const accent = '#00796b';
  const ink = '#1a1a1a';

  const creativeSectionTitle = (t: string) => (
    <div className="mt-3">
      <h2 className="text-left text-[10pt] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
        {t}
      </h2>
      <div className="mt-1 h-px w-full" style={{ backgroundColor: accent, height: '1.5px' }} />
    </div>
  );

  const sectionTitle = (sectionId: string, fallback: string) =>
    resolveSectionDisplayTitle(sectionId, fallback, data, sectionTitleOverrides);
  const sectionIsActive = (sectionId: string) =>
    ctx?.focusedSection === sectionId || ctx?.focusedEntrySection === sectionId;
  const reorderPreviewSections = (targetSectionId: string) => {
    /**
     * Local ref handles drops on the title bar; module-level fallback handles drops on the
     * section body (forwarded from `CVSectionWrapper` via `cv:section-reorder-drop`).
     */
    const draggingSectionId = draggingSectionIdRef.current ?? getActiveDraggingSectionId();
    if (!draggingSectionId || draggingSectionId === targetSectionId) return;
    const sourceOrder =
      sectionOrder && sectionOrder.length > 0
        ? sectionOrder
        : [...DEFAULT_PREVIEW_DRAG_SECTION_ORDER];
    const next = reorderSectionKeys(sourceOrder, draggingSectionId, targetSectionId);
    if (!next) return;
    onReorderSections?.(next);
    draggingSectionIdRef.current = null;
  };
  useEffect(() => {
    if (!inline) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SectionReorderDropDetail>).detail;
      if (!detail?.targetSectionId) return;
      reorderPreviewSections(detail.targetSectionId);
    };
    window.addEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closure captures latest sectionOrder/onReorderSections via re-registration on those deps
  }, [inline, sectionOrder, onReorderSections]);
  const renderSectionTitle = (
    sectionId: string,
    fallback: string,
    onDeleteSection?: () => void,
  ) => {
    const titleEntryId = `__section-title__:${sectionId}`;
    const focused = ctx?.focusedEntryId === titleEntryId;
    return (
      <div
        className={cn('mt-3', inline && sectionIsActive(sectionId) && 'group')}
        data-entry-id={titleEntryId}
        onDragOver={(e) => {
          if (!inline || !draggingSectionIdRef.current) return;
          e.preventDefault();
          setDragOverSectionId(sectionId);
        }}
        onDragLeave={() => {
          if (dragOverSectionId === sectionId) setDragOverSectionId(null);
        }}
        onDrop={(e) => {
          if (!inline) return;
          e.preventDefault();
          /** stopPropagation prevents CVSectionWrapper's drop listener from firing a second reorder. */
          e.stopPropagation();
          reorderPreviewSections(sectionId);
          setDragOverSectionId(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          ctx?.setFocusedSection(sectionId);
          ctx?.setFocusedEntryId(titleEntryId);
          ctx?.setFocusedEntrySection(sectionId);
        }}
      >
        {inline && dragOverSectionId === sectionId && draggingSectionIdRef.current !== sectionId ? (
          <div className="mb-1 rounded-md border-2 border-dashed border-[#00C9B1]/70 bg-[#00C9B1]/8 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#007A7A]">
            Drop section here
          </div>
        ) : null}
        {inline && focused ? (
          <EntryToolbar
            sectionType={sectionId}
            onAddEntry={() => {}}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            onDelete={() => {
              if (!onDeleteSection || isCoreSectionId(sectionId)) return;
              onDeleteSection();
              setHiddenSections((prev) => new Set(prev).add(sectionId));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cv:section-hidden', { detail: { sectionId } }));
              }
              ctx?.setFocusedEntryId(null);
              ctx?.setFocusedEntrySection(null);
            }}
            showMoveUp={false}
            showMoveDown={false}
            hideAddButton
            hideDelete={isCoreSectionId(sectionId)}
          />
        ) : null}
        <h2 className="relative flex items-center justify-center gap-1 text-center text-[10pt] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
          {inline ? (
            <span
              role="button"
              tabIndex={0}
              title="Drag section to reorder"
              aria-label={`Drag ${fallback} section to reorder`}
              draggable
              className="absolute left-0 cursor-grab rounded-sm border border-[#00C9B1]/45 bg-white/95 p-0.5 text-[#00C9B1] shadow-sm shadow-[#00C9B1]/15 transition hover:border-[#00C9B1]/70 hover:bg-[#00C9B1]/10 hover:text-[#007A7A] active:cursor-grabbing"
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                draggingSectionIdRef.current = sectionId;
                setActiveDraggingSectionId(sectionId);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', sectionId);
              }}
              onDragEnd={() => {
                draggingSectionIdRef.current = null;
                setActiveDraggingSectionId(null);
                setDragOverSectionId(null);
                dispatchSectionDragEnd();
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
              }}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          {inline ? (
            <InlineField
              value={sectionTitle(sectionId, fallback)}
              placeholder={fallback}
              sectionId={sectionId}
              entryId={titleEntryId}
              onChange={(v) => {
                const title = persistSectionTitleChange(sectionId, v, fallback, data, ctx?.onUpdate);
                setSectionTitleOverrides((prev) => ({ ...prev, [sectionId]: title }));
              }}
              className="font-bold uppercase"
            />
          ) : (
            sectionTitle(sectionId, fallback)
          )}
        </h2>
        <div className="mt-1 h-px w-full" style={{ backgroundColor: accent, height: '1.5px' }} />
      </div>
    );
  };

  const creativeContactBitsReadOnly: ReactNode[] = [];
  if (hp.showLocation && p.location?.trim()) creativeContactBitsReadOnly.push(<span key="loc">{p.location.trim()}</span>);
  if (hp.showEmail && p.email?.trim()) creativeContactBitsReadOnly.push(<span key="em">{p.email.trim()}</span>);
  if (hp.showPhone && p.phone?.trim()) creativeContactBitsReadOnly.push(<span key="ph">{p.phone.trim()}</span>);
  if (hp.showLinkedIn && p.linkedin?.trim()) {
    const href = p.linkedin.trim().startsWith('http') ? p.linkedin.trim() : `https://${p.linkedin.trim()}`;
    creativeContactBitsReadOnly.push(
      <a key="li" href={href} className="text-white underline" target="_blank" rel="noreferrer">
        LinkedIn
      </a>,
    );
  }
  if (hp.showGithub && p.github?.trim()) {
    const href = p.github.trim().startsWith('http') ? p.github.trim() : `https://${p.github.trim()}`;
    creativeContactBitsReadOnly.push(
      <a key="gh" href={href} className="text-white underline" target="_blank" rel="noreferrer">
        GitHub
      </a>,
    );
  }
  if (hp.showWebsiteToggle && showWebsite && p.website?.trim()) {
    const href = p.website.trim().startsWith('http') ? p.website.trim() : `https://${p.website.trim()}`;
    creativeContactBitsReadOnly.push(
      <a key="web" href={href} className="text-white underline" target="_blank" rel="noreferrer">
        Website
      </a>,
    );
  }
  if (hp.showPortfolioToggle && showPortfolio && p.portfolio?.trim()) {
    const href = p.portfolio.trim().startsWith('http') ? p.portfolio.trim() : `https://${p.portfolio.trim()}`;
    creativeContactBitsReadOnly.push(
      <a key="pf" href={href} className="text-white underline" target="_blank" rel="noreferrer">
        Portfolio
      </a>,
    );
  }
  for (const x of p.extras.filter((e) => e.label.trim() || e.value.trim())) {
    const lab = x.label.trim();
    const v = x.value.trim();
    const isUrl = /^https?:\/\//i.test(v);
    creativeContactBitsReadOnly.push(
      <span key={`ex-${lab}-${v}`} className="min-w-0 break-words">
        {lab ? <span className="font-semibold">{lab}: </span> : null}
        {isUrl ? (
          <a href={v} className="text-white underline" target="_blank" rel="noreferrer">
            {v}
          </a>
        ) : (
          <span>{v}</span>
        )}
      </span>,
    );
  }

  const headerInner = (
    <div
      data-cv-section="personal"
      className="relative mb-[14px] px-5 pb-[14px] pt-4 text-white"
      style={{ backgroundColor: accent }}
      onClick={(e) => {
        e.stopPropagation();
        ctx?.setFocusedSection('personal');
        ctx?.setFocusedEntryId(null);
        ctx?.setFocusedEntrySection('personal');
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 pr-0 sm:pr-4">
          {(inline && ctx && hp.showTitle) || (!inline && hp.showTitle) ? (
            <h1 className="mb-1.5 text-left text-[19pt] font-bold leading-[1.05] text-white">
              {inline && ctx && hp.showTitle ? (
                <InlineField
                  value={p.name}
                  placeholder="Your name"
                  sectionId="personal"
                  entryId="__header-name__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, name: v } })}
                  className={cn(
                    'text-left text-[19pt] font-bold leading-[1.05] text-white',
                    hp.uppercaseName && 'uppercase',
                  )}
                />
              ) : (
                (hp.uppercaseName ? name.toUpperCase() : name)
              )}
            </h1>
          ) : null}
          {(inline && ctx && hp.showHeadline) || (!inline && hp.showHeadline && p.headline?.trim()) ? (
            <p className="mb-1.5 mt-0 text-left text-[10pt] font-normal leading-snug text-white">
              {inline && ctx && hp.showHeadline ? (
                <InlineField
                  value={p.headline ?? ''}
                  placeholder="Professional headline"
                  sectionId="personal"
                  entryId="__header-headline__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, headline: v } })}
                  className="text-[10pt] text-white"
                />
              ) : (
                p.headline?.trim()
              )}
            </p>
          ) : null}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9pt] font-normal leading-[1.2] text-white">
            {inline && ctx ? (
          <>
            {hp.showLocation ? (
              <>
                <InlineField
                  value={p.location ?? ''}
                  placeholder="Location"
                  sectionId="personal"
                  entryId="__header-location__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, location: v } })}
                  className="min-w-0 text-[9pt] text-white/95"
                />
                {(hp.showEmail || hp.showPhone || hp.showLinkedIn || hp.showGithub || hp.showWebsiteToggle || hp.showPortfolioToggle) ? (
                  <span className="text-white/55">·</span>
                ) : null}
              </>
            ) : null}
            {hp.showEmail ? (
              <>
                <InlineField
                  value={p.email ?? ''}
                  placeholder="Email"
                  sectionId="personal"
                  entryId="__header-email__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, email: v } })}
                  className="min-w-0 text-[9pt] text-white/95"
                />
                {(hp.showPhone || hp.showLinkedIn || hp.showGithub || hp.showWebsiteToggle || hp.showPortfolioToggle) ? (
                  <span className="text-white/55">·</span>
                ) : null}
              </>
            ) : null}
            {hp.showPhone ? (
              <>
                <InlineField
                  value={p.phone ?? ''}
                  placeholder="Phone"
                  sectionId="personal"
                  entryId="__header-phone__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, phone: v } })}
                  className="min-w-0 text-[9pt] text-white/95"
                />
                {(hp.showLinkedIn || hp.showGithub || hp.showWebsiteToggle || hp.showPortfolioToggle) ? (
                  <span className="text-white/55">·</span>
                ) : null}
              </>
            ) : null}
            {hp.showLinkedIn ? (
              <>
                <InlineField
                  value={p.linkedin ?? ''}
                  placeholder="LinkedIn"
                  sectionId="personal"
                  entryId="__header-linkedin__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, linkedin: v } })}
                  className="min-w-0 text-[9pt] text-white/95"
                />
                {(hp.showGithub || hp.showWebsiteToggle || hp.showPortfolioToggle) ? (
                  <span className="text-white/55">·</span>
                ) : null}
              </>
            ) : null}
            {hp.showGithub ? (
              <>
                <InlineField
                  value={p.github ?? ''}
                  placeholder="GitHub"
                  sectionId="personal"
                  entryId="__header-github__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, github: v } })}
                  className="min-w-0 text-[9pt] text-white/95"
                />
                {((showWebsite || inline) && hp.showWebsiteToggle) || ((showPortfolio || inline) && hp.showPortfolioToggle) ? (
                  <span className="text-white/55">·</span>
                ) : null}
              </>
            ) : null}
            {(showWebsite || inline) && hp.showWebsiteToggle ? (
              <>
                <InlineField
                  value={p.website ?? ''}
                  placeholder="Website"
                  sectionId="personal"
                  entryId="__header-website__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, website: v } })}
                  className="min-w-0 text-[9pt] text-white/95"
                />
                {(showPortfolio || inline) && hp.showPortfolioToggle ? <span className="text-white/55">·</span> : null}
              </>
            ) : null}
            {(showPortfolio || inline) && hp.showPortfolioToggle ? (
              <InlineField
                value={p.portfolio ?? ''}
                placeholder="Portfolio"
                sectionId="personal"
                entryId="__header-portfolio__"
                onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, portfolio: v } })}
                className="min-w-0 text-[9pt] text-white/95"
              />
            ) : null}
          </>
        ) : creativeContactBitsReadOnly.length ? (
          creativeContactBitsReadOnly.map((bit, i) => (
            <Fragment key={`hdr-${i}`}>
              {i > 0 ? <span className="text-white/55">·</span> : null}
              {bit}
            </Fragment>
          ))
        ) : (
          <span className="text-white/70">Add contact details in the editor.</span>
        )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:max-w-[40%]">
          <HeaderFloatingControls toolbarAlign="end" />
        </div>
      </div>
    </div>
  );

  const certListCreative =
    inline && ctx
      ? data.certifications
      : data.certifications.filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim());

  const creativeOrd = (id: string, fallback: number) =>
    sectionOrder && sectionOrder.length > 0
      ? (() => {
          const i = sectionOrder.indexOf(id);
          return i >= 0 ? i : 800 + fallback;
        })()
      : fallback;

  return (
    <div
      className={cn('box-border min-w-0 w-full bg-white px-5 pb-5 pt-0 text-[9.5pt] text-black antialiased', dmSans.className)}
      style={{ color: ink }}
    >
      {vis('personal') ? sectionBox('personal', activeSection, 'mb-3', headerInner, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}

      <div className="flex w-full flex-col gap-6 text-left">
        <div style={{ order: creativeOrd('summary', 0) }} className="min-w-0">
        {vis('summary') && (inline || data.summary.text.trim().length > 0)
          ? sectionBox(
              'summary',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('summary', 'Summary', () => ctx?.onUpdate({ summary: { text: '' } }))}
                <div className="mt-1.5 text-left text-[9.5pt] leading-[1.38] text-[#1a1a1a]">
                  {inline && ctx ? (
                    <div
                      data-entry-id="summary-body"
                      className="relative"
                      onClick={(e) => {
                        e.stopPropagation();
                        ctx.setFocusedSection('summary');
                        ctx.setFocusedEntryId('summary-body');
                        ctx.setFocusedEntrySection('summary');
                      }}
                      style={{
                        outline: ctx.focusedEntryId === 'summary-body' ? '1.5px dashed #00C9B1' : 'none',
                        outlineOffset: '3px',
                        borderRadius: '3px',
                        position: 'relative',
                      }}
                    >
                      {ctx.focusedEntryId === 'summary-body' ? (
                        <EntryToolbar
                          sectionType="summary"
                          onAddEntry={() => {}}
                          onMoveUp={() => {}}
                          onMoveDown={() => {}}
                          onDelete={() => {
                            ctx.onUpdate({ summary: { text: '' } });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }}
                          showMoveUp={false}
                          showMoveDown={false}
                          showDatePicker={false}
                          hideAddButton
                        />
                      ) : null}
                      <InlineField
                        multiline
                        layout="block"
                        sectionId="summary"
                        entryId="summary-body"
                        value={data.summary.text}
                        placeholder="Briefly explain why you're a great fit…"
                        onChange={(v) => ctx.onUpdate({ summary: { text: v } })}
                        className="text-[9.5pt] leading-[1.38] text-[#1a1a1a]"
                      />
                    </div>
                  ) : (
                    <RichText text={data.summary.text} />
                  )}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('experience', 1) }} className="min-w-0">
        {vis('experience')
          ? sectionBox(
              'experience',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('experience', 'Experience', () => ctx?.onUpdate({ experience: { items: [] } }))}
                <div className="mt-2.5 space-y-6">
                  {data.experience.items.length ? (
                    data.experience.items.map((x, itemIdx) => (
                      <div
                        key={x.id}
                        id={`cv-preview-experience-item-${x.id}`}
                        data-entry-id={x.id}
                        className={experienceItemWrapClass(activeSection, x.id)}
                        style={{
                          outline: ctx?.focusedEntryId === x.id ? '1.5px dashed #00C9B1' : 'none',
                          outlineOffset: '3px',
                          borderRadius: '3px',
                          position: 'relative',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          ctx?.setFocusedSection('experience');
                          ctx?.setFocusedEntryId(x.id);
                          ctx?.setFocusedEntrySection('experience');
                        }}
                      >
                        {inline && ctx?.focusedEntryId === x.id ? (
                          <EntryToolbar
                            sectionType="experience"
                            onAddEntry={() =>
                              ctx!.onUpdate({
                                experience: {
                                  items: [
                                    ...data.experience.items,
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
                            onAddBullet={() =>
                              ctx!.onUpdate({
                                experience: {
                                  items: data.experience.items.map((row) => {
                                    if (row.id !== x.id) return row;
                                    const base = Array.isArray(row.bullets)
                                      ? row.bullets
                                      : normalizeBullets(row.bullets as unknown as string | string[] | undefined);
                                    return { ...row, bullets: [...(base.length ? base : ['']), ''] };
                                  }),
                                },
                              })
                            }
                            onMoveUp={() => {
                              if (itemIdx === 0) return;
                              const next = [...data.experience.items];
                              [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                              ctx!.onUpdate({ experience: { items: next } });
                            }}
                            onMoveDown={() => {
                              if (itemIdx >= data.experience.items.length - 1) return;
                              const next = [...data.experience.items];
                              [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                              ctx!.onUpdate({ experience: { items: next } });
                            }}
                            onDelete={() => {
                              ctx!.onUpdate({
                                experience: { items: data.experience.items.filter((row) => row.id !== x.id) },
                              });
                              ctx!.setFocusedEntryId(null);
                              ctx!.setFocusedEntrySection(null);
                            }}
                            onDatePick={(startDate, endDate) =>
                              ctx!.onUpdate({
                                experience: {
                                  items: data.experience.items.map((row) =>
                                    row.id === x.id ? { ...row, startDate, endDate } : row,
                                  ),
                                },
                              })
                            }
                            showMoveUp={itemIdx > 0}
                            showMoveDown={itemIdx < data.experience.items.length - 1}
                            showAddBullet
                            dateStart={x.startDate}
                            dateEnd={x.endDate}
                            showDatePicker
                            settingsOptions={[
                              {
                                key: 'title',
                                label: 'Title',
                                enabled: entryFieldOn(`experience:${x.id}`, 'title'),
                                onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'title', next),
                              },
                              {
                                key: 'company',
                                label: 'Company Name',
                                enabled: entryFieldOn(`experience:${x.id}`, 'company'),
                                onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'company', next),
                              },
                              {
                                key: 'location',
                                label: 'Location',
                                enabled: entryFieldOn(`experience:${x.id}`, 'location'),
                                onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'location', next),
                              },
                              {
                                key: 'date',
                                label: 'Date Period',
                                enabled: entryFieldOn(`experience:${x.id}`, 'date'),
                                onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'date', next),
                              },
                              {
                                key: 'bullets',
                                label: 'Bullets',
                                enabled: entryFieldOn(`experience:${x.id}`, 'bullets'),
                                onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'bullets', next),
                              },
                            ]}
                          />
                        ) : null}
                        <div className="flex justify-between gap-3">
                          {entryFieldOn(`experience:${x.id}`, 'company') ? (
                            <span className="text-[9.5pt] font-bold text-[#1a1a1a]">
                              {inline && ctx ? (
                                <InlineField
                                  value={x.company}
                                  placeholder="Company"
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) => (row.id === x.id ? { ...row, company: v } : row)),
                                      },
                                    })
                                  }
                                  className="font-bold text-[#1a1a1a]"
                                />
                              ) : (
                                x.company || 'Company'
                              )}
                            </span>
                          ) : (
                            <span />
                          )}
                          {entryFieldOn(`experience:${x.id}`, 'date') ? (
                            <span className="shrink-0 whitespace-nowrap text-[9.5pt] font-semibold text-[#1a1a1a]">
                              {inline && ctx ? (
                                <InlineField
                                  value={formatCvPeriod(x.startDate, x.endDate, x.current)}
                                  placeholder="Dates"
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) =>
                                          row.id === x.id ? { ...row, startDate: v.trim(), endDate: '', current: false } : row,
                                        ),
                                      },
                                    })
                                  }
                                  className="text-[9.5pt] font-semibold text-[#1a1a1a]"
                                />
                              ) : (
                                formatCvPeriod(x.startDate, x.endDate, x.current)
                              )}
                            </span>
                          ) : null}
                        </div>
                        {entryFieldOn(`experience:${x.id}`, 'title') || entryFieldOn(`experience:${x.id}`, 'location') ? (
                          <p className="mt-0.5 text-[9.5pt] italic" style={{ color: accent }}>
                            {inline && ctx ? (
                              <>
                                {entryFieldOn(`experience:${x.id}`, 'title') ? (
                                  <InlineField
                                    value={x.title}
                                    placeholder="Job title"
                                    onChange={(v) =>
                                      ctx.onUpdate({
                                        experience: {
                                          items: data.experience.items.map((row) => (row.id === x.id ? { ...row, title: v } : row)),
                                        },
                                      })
                                    }
                                    className="italic text-[#1a1a1a]"
                                  />
                                ) : null}
                                {entryFieldOn(`experience:${x.id}`, 'title') && entryFieldOn(`experience:${x.id}`, 'location') ? (
                                  <span className="not-italic text-black/55"> · </span>
                                ) : null}
                                {entryFieldOn(`experience:${x.id}`, 'location') ? (
                                  <InlineField
                                    value={x.location ?? ''}
                                    placeholder="Location"
                                    onChange={(v) =>
                                      ctx.onUpdate({
                                        experience: {
                                          items: data.experience.items.map((row) => (row.id === x.id ? { ...row, location: v } : row)),
                                        },
                                      })
                                    }
                                    className="not-italic text-black/55"
                                  />
                                ) : null}
                              </>
                            ) : (
                              <>
                                {x.title || 'Job title'}
                                {x.location?.trim() ? <span className="not-italic text-black/55"> · {x.location.trim()}</span> : null}
                              </>
                            )}
                          </p>
                        ) : !inline ? (
                          <p className="mt-0.5 text-[9.5pt] italic" style={{ color: accent }}>
                            {x.title || 'Job title'}
                            {x.location?.trim() ? <span className="not-italic text-[#1a1a1a]/65"> · {x.location.trim()}</span> : null}
                          </p>
                        ) : null}
                        {entryFieldOn(`experience:${x.id}`, 'bullets') ? (
                          <ul className="mt-1 list-none space-y-0.5 text-[9.5pt] leading-[1.35] text-[#1a1a1a]">
                            {normalizeBullets(x.bullets as unknown as string | string[] | undefined).map((b, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-0.5 shrink-0">•</span>
                                <span>
                                  {inline && ctx ? (
                                    <InlineField
                                      multiline
                                      value={b}
                                      placeholder="Accomplishment"
                                      sectionId="experience"
                                      entryId={x.id}
                                      dataBulletEntry={x.id}
                                      dataBulletIdx={String(i)}
                                      onChange={(v) => {
                                        const list = [...normalizeBullets(x.bullets as unknown as string | string[] | undefined)];
                                        list[i] = v;
                                        ctx.onUpdate({
                                          experience: {
                                            items: data.experience.items.map((row) =>
                                              row.id === x.id ? { ...row, bullets: list } : row,
                                            ),
                                          },
                                        });
                                      }}
                                      onInputKeyDown={(e) => {
                                        const base = normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                        const list = [...(base.length ? base : [''])];
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          list.splice(i + 1, 0, '');
                                          ctx.onUpdate({
                                            experience: {
                                              items: data.experience.items.map((row) =>
                                                row.id === x.id ? { ...row, bullets: list } : row,
                                              ),
                                            },
                                          });
                                          setTimeout(() => {
                                            const inputs = document.querySelectorAll(`[data-bullet-entry="${x.id}"][data-bullet-idx="${String(i + 1)}"]`);
                                            const next = inputs[0] as HTMLElement | undefined;
                                            next?.focus();
                                          }, 50);
                                        }
                                        if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && list.length > 1) {
                                          e.preventDefault();
                                          const nextBullets = list.filter((_, bi) => bi !== i);
                                          ctx.onUpdate({
                                            experience: {
                                              items: data.experience.items.map((row) =>
                                                row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                              ),
                                            },
                                          });
                                        }
                                      }}
                                      className="text-[#1a1a1a]"
                                    />
                                  ) : (
                                    b
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : !inline ? (
                          <ul className="mt-1 list-none space-y-0.5 text-[9.5pt] leading-[1.35] text-[#1a1a1a]">
                            {normalizeBullets(x.bullets as unknown as string | string[] | undefined).map((b, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-0.5 shrink-0">•</span>
                                <RichText text={b} />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-[9.5pt] text-black/45">
                      {inline ? 'Add roles from Sections or your profile.' : 'Add your experience in the editor.'}
                    </p>
                  )}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
              experienceOuterSectionActive,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('education', 2) }} className="min-w-0">
        {vis('education')
          ? sectionBox(
              'education',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('education', 'Education', () => ctx?.onUpdate({ education: { items: [] } }))}
                <div className="mt-2.5 space-y-2.5 text-[9.5pt] leading-tight text-[#1a1a1a]">
                  {data.education.items.length ? (
                    data.education.items.map((e, eduIdx) => (
                      <div
                        key={e.id}
                        data-entry-id={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          ctx?.setFocusedSection('education');
                          ctx?.setFocusedEntryId(e.id);
                          ctx?.setFocusedEntrySection('education');
                        }}
                        style={{
                          outline: ctx?.focusedEntryId === e.id ? '1.5px dashed #00C9B1' : 'none',
                          outlineOffset: '3px',
                          borderRadius: '3px',
                          position: 'relative',
                        }}
                      >
                        {inline && ctx?.focusedEntryId === e.id ? (
                          <EntryToolbar
                            sectionType="education"
                            onAddEntry={() =>
                              ctx!.onUpdate({
                                education: {
                                  items: [
                                    ...data.education.items,
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
                            onMoveUp={() => {
                              if (eduIdx === 0) return;
                              const next = [...data.education.items];
                              [next[eduIdx - 1], next[eduIdx]] = [next[eduIdx], next[eduIdx - 1]];
                              ctx!.onUpdate({ education: { items: next } });
                            }}
                            onMoveDown={() => {
                              if (eduIdx >= data.education.items.length - 1) return;
                              const next = [...data.education.items];
                              [next[eduIdx], next[eduIdx + 1]] = [next[eduIdx + 1], next[eduIdx]];
                              ctx!.onUpdate({ education: { items: next } });
                            }}
                            onDelete={() => {
                              ctx!.onUpdate({ education: { items: data.education.items.filter((row) => row.id !== e.id) } });
                              ctx!.setFocusedEntryId(null);
                              ctx!.setFocusedEntrySection(null);
                            }}
                            onDatePick={(startDate, endDate) =>
                              ctx!.onUpdate({
                                education: {
                                  items: data.education.items.map((row) =>
                                    row.id === e.id ? { ...row, startYear: startDate, endYear: endDate } : row,
                                  ),
                                },
                              })
                            }
                            showMoveUp={eduIdx > 0}
                            showMoveDown={eduIdx < data.education.items.length - 1}
                            dateStart={e.startYear}
                            dateEnd={e.endYear}
                            showDatePicker
                            settingsOptions={[
                              {
                                key: 'school',
                                label: 'School / University',
                                enabled: entryFieldOn(`education:${e.id}`, 'school'),
                                onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'school', next),
                              },
                              {
                                key: 'field',
                                label: 'Field',
                                enabled: entryFieldOn(`education:${e.id}`, 'field'),
                                onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'field', next),
                              },
                              {
                                key: 'degree',
                                label: 'Degree',
                                enabled: entryFieldOn(`education:${e.id}`, 'degree'),
                                onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'degree', next),
                              },
                              {
                                key: 'grade',
                                label: 'Grade / honors',
                                enabled: entryFieldOn(`education:${e.id}`, 'grade'),
                                onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'grade', next),
                              },
                              {
                                key: 'date',
                                label: 'Date period',
                                enabled: entryFieldOn(`education:${e.id}`, 'date'),
                                onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'date', next),
                              },
                            ]}
                          />
                        ) : null}
                        {inline && ctx ? (
                          <>
                            <div className="flex justify-between gap-3">
                              {entryFieldOn(`education:${e.id}`, 'school') ? (
                                <span className="font-bold">
                                  <InlineField
                                    value={e.school}
                                    placeholder="Institution"
                                    sectionId="education"
                                    entryId={e.id}
                                    onChange={(v) =>
                                      ctx.onUpdate({
                                        education: {
                                          items: data.education.items.map((row) => (row.id === e.id ? { ...row, school: v } : row)),
                                        },
                                      })
                                    }
                                    className="font-bold text-[#1a1a1a]"
                                  />
                                </span>
                              ) : (
                                <span />
                              )}
                              {entryFieldOn(`education:${e.id}`, 'date') ? (
                                <span className="shrink-0 whitespace-nowrap font-semibold">
                                  <InlineField
                                    value={formatEduRange(e.startYear, e.endYear)}
                                    placeholder="Years"
                                    sectionId="education"
                                    entryId={e.id}
                                    onChange={(v) =>
                                      ctx.onUpdate({
                                        education: {
                                          items: data.education.items.map((row) =>
                                            row.id === e.id ? { ...row, startYear: v.trim(), endYear: '' } : row,
                                          ),
                                        },
                                      })
                                    }
                                    className="text-[9.5pt] font-semibold text-[#1a1a1a]"
                                  />
                                </span>
                              ) : null}
                            </div>
                            {(entryFieldOn(`education:${e.id}`, 'degree') ||
                              entryFieldOn(`education:${e.id}`, 'field') ||
                              entryFieldOn(`education:${e.id}`, 'grade')) ? (
                              <p className="mt-0.5 italic text-[#1a1a1a]">
                                {entryFieldOn(`education:${e.id}`, 'degree') ? (
                                  <InlineField
                                    value={e.degree}
                                    placeholder="Degree"
                                    sectionId="education"
                                    entryId={e.id}
                                    onChange={(v) =>
                                      ctx.onUpdate({
                                        education: {
                                          items: data.education.items.map((row) => (row.id === e.id ? { ...row, degree: v } : row)),
                                        },
                                      })
                                    }
                                    className="italic text-[#1a1a1a]"
                                  />
                                ) : null}
                                {entryFieldOn(`education:${e.id}`, 'degree') &&
                                (entryFieldOn(`education:${e.id}`, 'field') || entryFieldOn(`education:${e.id}`, 'grade')) ? (
                                  <span className="not-italic text-black/55"> · </span>
                                ) : null}
                                {entryFieldOn(`education:${e.id}`, 'field') ? (
                                  <InlineField
                                    value={e.field}
                                    placeholder="Field"
                                    sectionId="education"
                                    entryId={e.id}
                                    onChange={(v) =>
                                      ctx.onUpdate({
                                        education: {
                                          items: data.education.items.map((row) => (row.id === e.id ? { ...row, field: v } : row)),
                                        },
                                      })
                                    }
                                    className="italic text-[#1a1a1a]"
                                  />
                                ) : null}
                                {entryFieldOn(`education:${e.id}`, 'field') && entryFieldOn(`education:${e.id}`, 'grade') ? (
                                  <span className="not-italic text-black/55"> · </span>
                                ) : null}
                                {entryFieldOn(`education:${e.id}`, 'grade') ? (
                                  <InlineField
                                    value={e.grade ?? ''}
                                    placeholder="Grade / honors"
                                    sectionId="education"
                                    entryId={e.id}
                                    onChange={(v) =>
                                      ctx.onUpdate({
                                        education: {
                                          items: data.education.items.map((row) => (row.id === e.id ? { ...row, grade: v } : row)),
                                        },
                                      })
                                    }
                                    className="not-italic text-black/55"
                                  />
                                ) : null}
                              </p>
                            ) : null}
                            <div className="group mt-2 flex justify-center">
                              <button
                                type="button"
                                className={cn(
                                  'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                                  addButtonVisibilityClass(activeSection, 'education'),
                                )}
                                aria-label="Add education entry"
                                title="Add education entry"
                                onClick={() =>
                                  ctx.onUpdate({
                                    education: {
                                      items: [
                                        ...data.education.items,
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
                                +
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between gap-3">
                              <span className="font-bold">{e.school || 'Institution'}</span>
                              <span className="shrink-0 whitespace-nowrap font-semibold">{formatEduRange(e.startYear, e.endYear)}</span>
                            </div>
                            <p className="mt-0.5 italic text-[#1a1a1a]">
                              {[e.degree, e.field].filter(Boolean).join(', ')}
                              {e.grade?.trim() ? <span className="not-italic text-black/55"> · {e.grade.trim()}</span> : null}
                            </p>
                          </>
                        )}
                      </div>
                    ))
                  ) : inline && ctx ? (
                    <button
                      type="button"
                      className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                      onClick={() =>
                        ctx.onUpdate({
                          education: {
                            items: [
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
                      + Click to add education
                    </button>
                  ) : (
                    <p className="text-[9.5pt] text-black/45">
                      {inline ? 'Add education from Sections or your profile.' : 'Add your education in the editor.'}
                    </p>
                  )}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('skills', 3) }} className="min-w-0">
        {vis('skills')
          ? sectionBox(
              'skills',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('skills', 'Skills', () => ctx?.onUpdate({ skills: { categories: [] } }))}
                <div className="mt-2.5 space-y-1.5 text-left text-[9.5pt] leading-[1.32] text-[#1a1a1a]">
                  {data.skills.categories.length === 0 && inline && ctx ? (
                    <button
                      type="button"
                      className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                      onClick={() => ctx.onUpdate({ skills: { categories: [{ id: newLocalId(), name: '', skills: [''] }] } })}
                    >
                      + Click to add skills
                    </button>
                  ) : (
                    data.skills.categories.map((cat, catIdx) => (
                      <div
                        key={cat.id}
                        data-entry-id={cat.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          ctx?.setFocusedSection('skills');
                          ctx?.setFocusedEntryId(cat.id);
                          ctx?.setFocusedEntrySection('skills');
                        }}
                        style={{
                          outline: ctx?.focusedEntryId === cat.id ? '1.5px dashed #00C9B1' : 'none',
                          outlineOffset: '3px',
                          borderRadius: '3px',
                          position: 'relative',
                        }}
                      >
                        {inline && ctx?.focusedEntryId === cat.id ? (
                          <EntryToolbar
                            sectionType="skills"
                            onAddEntry={() =>
                              ctx.onUpdate({
                                skills: { categories: [...data.skills.categories, { id: newLocalId(), name: '', skills: [''] }] },
                              })
                            }
                            onAddSecondaryEntry={() =>
                              ctx.onUpdate({
                                skills: {
                                  categories: [...data.skills.categories, { id: newLocalId(), name: 'Group Title', skills: [''] }],
                                },
                              })
                            }
                            onMoveUp={() => {
                              if (catIdx === 0) return;
                              const next = [...data.skills.categories];
                              [next[catIdx - 1], next[catIdx]] = [next[catIdx], next[catIdx - 1]];
                              ctx.onUpdate({ skills: { categories: next } });
                            }}
                            onMoveDown={() => {
                              if (catIdx >= data.skills.categories.length - 1) return;
                              const next = [...data.skills.categories];
                              [next[catIdx], next[catIdx + 1]] = [next[catIdx + 1], next[catIdx]];
                              ctx.onUpdate({ skills: { categories: next } });
                            }}
                            onDelete={() => {
                              ctx.onUpdate({ skills: { categories: data.skills.categories.filter((c) => c.id !== cat.id) } });
                              ctx.setFocusedEntryId(null);
                              ctx.setFocusedEntrySection(null);
                            }}
                            showMoveUp={catIdx > 0}
                            showMoveDown={catIdx < data.skills.categories.length - 1}
                            addEntryLabel="+ Skill"
                            addSecondaryEntryLabel="+ Group"
                            showDatePicker={false}
                            settingsOptions={[
                              {
                                key: 'groupTitle',
                                label: 'Group Title',
                                enabled: entryFieldOn(`skills:${cat.id}`, 'groupTitle'),
                                onToggle: (next) => setEntryFieldOn(`skills:${cat.id}`, 'groupTitle', next),
                              },
                            ]}
                          />
                        ) : null}
                        <div className="mb-6">
                          {entryFieldOn(`skills:${cat.id}`, 'groupTitle') &&
                          inline &&
                          ctx &&
                          (cat.name.trim() !== '' || (ctx.focusedEntryId === cat.id && cat.name.trim() === 'Group Title')) ? (
                            <InlineField
                              value={cat.name.trim() === 'Group Title' ? '' : cat.name}
                              placeholder="Skill group title"
                              sectionId="skills"
                              entryId={cat.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  skills: {
                                    categories: data.skills.categories.map((row) => (row.id === cat.id ? { ...row, name: v } : row)),
                                  },
                                })
                              }
                              className="mb-1.5 block font-bold text-[#007A7B]"
                            />
                          ) : cat.name.trim() && cat.name.trim() !== 'Group Title' ? (
                            <span className="mb-1.5 block text-[11px] font-bold text-[#007A7B]">{cat.name.trim()}</span>
                          ) : null}
                          {inline && ctx ? (
                            <InlineSkillsCommaField
                              skills={cat.skills}
                              onChange={(next) =>
                                ctx.onUpdate({
                                  skills: {
                                    categories: data.skills.categories.map((row) =>
                                      row.id === cat.id ? { ...row, skills: next } : row,
                                    ),
                                  },
                                })
                              }
                              onFocus={() => {
                                ctx.setFocusedSection('skills');
                                ctx.setFocusedEntryId(cat.id);
                                ctx.setFocusedEntrySection('skills');
                              }}
                              className="text-[#1a1a1a]"
                            />
                          ) : (
                            <div className="flex flex-wrap">
                              {cat.skills
                                .filter((s) => s.trim())
                                .map((skill, skillIdx) => (
                                  <span
                                    key={`${cat.id}-pill-${skillIdx}`}
                                    className="mb-0.5 mr-0.5 inline-block rounded-[12px] border border-[#007A7B] px-2.5 py-0.5 text-[11px] leading-none text-[#007A7B]"
                                    style={{ margin: 2 }}
                                  >
                                    {skill.trim()}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('projects', 4) }} className="min-w-0">
        {optionalSectionShown(optionalSectionPresence, 'projects', data.projects.length > 0) && vis('projects')
          ? sectionBox(
              'projects',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('projects', 'Projects', () => ctx?.onUpdate({ projects: [] }))}
                <div className="mt-2.5 space-y-2.5 text-left text-[9.5pt] leading-[1.32] text-[#1a1a1a]">
                  {(inline && ctx
                    ? data.projects
                    : data.projects.filter((proj) => {
                        const pAny = proj as unknown as Record<string, unknown>;
                        return (
                          stripHtmlTags(proj.name || '').trim() ||
                          richTextPlainText(proj.description || '').length > 0 ||
                          projectPayloadTech(pAny).length > 0 ||
                          projectPayloadBullets(pAny).length > 0 ||
                          (proj.url || '').trim()
                        );
                      })
                  ).map((proj, projIdx) => {
                    const pAny = proj as unknown as Record<string, unknown>;
                    const rawBullets =
                      typeof proj.bullets === 'string'
                        ? proj.bullets
                        : normalizeBullets(proj.bullets as unknown as string | string[] | undefined).join('\n');
                    const editLines = rawBullets.split(/\r?\n/);
                    const techList = projectPayloadTech(pAny);
                    return (
                      <div
                        key={proj.id || `project-${projIdx}`}
                        data-entry-id={proj.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          ctx?.setFocusedSection('projects');
                          ctx?.setFocusedEntryId(proj.id);
                          ctx?.setFocusedEntrySection('projects');
                        }}
                        style={{
                          outline: ctx?.focusedEntryId === proj.id ? '1.5px dashed #00C9B1' : 'none',
                          outlineOffset: '3px',
                          borderRadius: '3px',
                          position: 'relative',
                        }}
                      >
                        {inline && ctx?.focusedEntryId === proj.id ? (
                          <EntryToolbar
                            sectionType="projects"
                            onAddBullet={() =>
                              ctx.onUpdate({
                                projects: data.projects.map((row) =>
                                  row.id === proj.id
                                    ? { ...row, bullets: `${row.bullets ?? ''}${(row.bullets ?? '').toString().length ? '\n' : ''}` }
                                    : row,
                                ),
                              })
                            }
                            onAddEntry={() =>
                              ctx.onUpdate({
                                projects: [
                                  ...data.projects,
                                  { id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' },
                                ],
                              })
                            }
                            onMoveUp={() => {
                              if (projIdx === 0) return;
                              const next = [...data.projects];
                              [next[projIdx - 1], next[projIdx]] = [next[projIdx], next[projIdx - 1]];
                              ctx.onUpdate({ projects: next });
                            }}
                            onMoveDown={() => {
                              if (projIdx >= data.projects.length - 1) return;
                              const next = [...data.projects];
                              [next[projIdx], next[projIdx + 1]] = [next[projIdx + 1], next[projIdx]];
                              ctx.onUpdate({ projects: next });
                            }}
                            onDelete={() => {
                              ctx.onUpdate({ projects: data.projects.filter((row) => row.id !== proj.id) });
                              ctx.setFocusedEntryId(null);
                              ctx.setFocusedEntrySection(null);
                            }}
                            showMoveUp={projIdx > 0}
                            showMoveDown={projIdx < data.projects.length - 1}
                            showAddBullet
                            showDatePicker={false}
                            settingsOptions={[
                              {
                                key: 'description',
                                label: 'Description',
                                enabled: entryFieldOn(`projects:${proj.id}`, 'description'),
                                onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'description', next),
                              },
                              {
                                key: 'technologies',
                                label: 'Tools & keywords',
                                enabled: entryFieldOn(`projects:${proj.id}`, 'technologies'),
                                onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'technologies', next),
                              },
                              {
                                key: 'url',
                                label: 'Project link',
                                enabled: entryFieldOn(`projects:${proj.id}`, 'url'),
                                onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'url', next),
                              },
                              {
                                key: 'bullets',
                                label: 'Bullets',
                                enabled: entryFieldOn(`projects:${proj.id}`, 'bullets'),
                                onToggle: (next) => setEntryFieldOn(`projects:${proj.id}`, 'bullets', next),
                              },
                            ]}
                          />
                        ) : null}
                        <p className="font-bold">
                          {inline && ctx ? (
                            <InlineField
                              value={proj.name || ''}
                              placeholder="Project name"
                              sectionId="projects"
                              entryId={proj.id}
                              onChange={(v) =>
                                ctx.onUpdate({ projects: data.projects.map((row) => (row.id === proj.id ? { ...row, name: v } : row)) })
                              }
                              className="font-bold text-[#1a1a1a]"
                            />
                          ) : (
                            stripHtmlTags(proj.name || '') || 'Project'
                          )}
                        </p>
                        {inline && ctx && entryFieldOn(`projects:${proj.id}`, 'description') ? (
                          <div className="mt-1 leading-[1.48]">
                            <InlineField
                              multiline
                              value={proj.description || ''}
                              placeholder="Description"
                              sectionId="projects"
                              entryId={proj.id}
                              onChange={(v) =>
                                ctx.onUpdate({ projects: data.projects.map((row) => (row.id === proj.id ? { ...row, description: v } : row)) })
                              }
                              className="text-[#1a1a1a]"
                            />
                          </div>
                        ) : !inline && proj.description ? (
                          <p className="mt-1 leading-[1.48]">
                            <RichText text={proj.description} />
                          </p>
                        ) : null}
                        {techList.length > 0 || (inline && ctx && entryFieldOn(`projects:${proj.id}`, 'technologies')) ? (
                          <p className="mt-1 text-[8.2pt] text-[#1a1a1a]/80">
                            {inline && ctx && entryFieldOn(`projects:${proj.id}`, 'technologies') ? (
                              <InlineField
                                value={techList.join(', ')}
                                placeholder="Tools, software, methods (comma-separated)"
                                sectionId="projects"
                                entryId={proj.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    projects: data.projects.map((row) =>
                                      row.id === proj.id ? { ...row, technologies: v.split(',').map((t) => t.trim()).filter(Boolean) } : row,
                                    ),
                                  })
                                }
                                className="text-[#1a1a1a]/80"
                              />
                            ) : techList.length > 0 ? (
                              techList.join(' | ')
                            ) : null}
                          </p>
                        ) : null}
                        {(proj.url || '').trim() || (inline && ctx && entryFieldOn(`projects:${proj.id}`, 'url')) ? (
                          <p className="mt-1 text-[8.2pt]">
                            {inline && ctx && entryFieldOn(`projects:${proj.id}`, 'url') ? (
                              <InlineField
                                value={proj.url ?? ''}
                                placeholder="URL"
                                sectionId="projects"
                                entryId={proj.id}
                                onChange={(v) =>
                                  ctx.onUpdate({ projects: data.projects.map((row) => (row.id === proj.id ? { ...row, url: v } : row)) })
                                }
                                className="text-[#1a1a1a]"
                              />
                            ) : (proj.url || '').trim() ? (
                              <a
                                href={proj.url.startsWith('http') ? proj.url : `https://${proj.url}`}
                                className="text-[#1a1a1a] underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {proj.url.replace(/^https?:\/\//i, '')}
                              </a>
                            ) : null}
                          </p>
                        ) : null}
                        {entryFieldOn(`projects:${proj.id}`, 'bullets') && (editLines.some((x) => richTextPlainText(x).length > 0) || inline) ? (
                          <ul className="mt-2 list-none space-y-0.5 pl-0 text-[9.5pt] leading-[1.35] text-[#1a1a1a]">
                            {(editLines.length > 0 ? editLines : ['']).map((b, bIdx) => (
                              <li key={`${proj.id}-b-${bIdx}`} className="flex items-start gap-1.5">
                                {inline && ctx ? (
                                  <>
                                    <span className="mt-0.5 shrink-0">•</span>
                                    <span className="flex-1">
                                      <InlineField
                                        value={b}
                                        layout="block"
                                        placeholder="Bullet"
                                        sectionId="projects"
                                        entryId={proj.id}
                                        dataBulletIdx={String(bIdx)}
                                        onChange={(v) => {
                                          const arr = rawBullets.split(/\r?\n/);
                                          const next = [...(arr.length ? arr : [''])];
                                          next[bIdx] = normalizeBulletInput(v);
                                          ctx.onUpdate({
                                            projects: data.projects.map((row) =>
                                              row.id === proj.id ? { ...row, bullets: next.join('\n') } : row,
                                            ),
                                          });
                                        }}
                                        onInputKeyDown={(e) => {
                                          const arr = rawBullets.split(/\r?\n/);
                                          const next = [...(arr.length ? arr : [''])];
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            next.splice(bIdx + 1, 0, '');
                                            ctx.onUpdate({
                                              projects: data.projects.map((row) =>
                                                row.id === proj.id ? { ...row, bullets: next.join('\n') } : row,
                                              ),
                                            });
                                          }
                                          if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && next.length > 1) {
                                            e.preventDefault();
                                            const filtered = next.filter((_, i) => i !== bIdx);
                                            ctx.onUpdate({
                                              projects: data.projects.map((row) =>
                                                row.id === proj.id ? { ...row, bullets: filtered.join('\n') } : row,
                                              ),
                                            });
                                          }
                                        }}
                                        className="text-[#1a1a1a]"
                                      />
                                    </span>
                                    {ctx?.focusedEntryId === proj.id && ctx?.focusedEntrySection === 'projects' ? (
                                      <button
                                        type="button"
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          const arr = rawBullets.split(/\r?\n/);
                                          if (arr.length <= 1) return;
                                          const filtered = arr.filter((_, i) => i !== bIdx);
                                          ctx.onUpdate({
                                            projects: data.projects.map((row) =>
                                              row.id === proj.id ? { ...row, bullets: filtered.join('\n') } : row,
                                            ),
                                          });
                                        }}
                                        aria-label="Remove bullet"
                                      >
                                        ×
                                      </button>
                                    ) : null}
                                  </>
                                ) : stripHtmlTags(b).trim() ? (
                                  <span className="flex gap-2 pl-5">
                                    <span className="shrink-0">•</span>
                                <span>
                                  <RichText text={b} />
                                </span>
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : !inline && projectPayloadBullets(pAny).length > 0 ? (
                      <ul className="mt-2 list-disc list-outside pl-5">
                        {projectPayloadBullets(pAny).map((b, i) => (
                          <li key={i}>
                            <RichText text={b} />
                          </li>
                        ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                  {inline && ctx && data.projects.length === 0 ? (
                    <button
                      type="button"
                      className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                      onClick={() =>
                        ctx.onUpdate({
                          projects: [{ id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' }],
                        })
                      }
                    >
                      + Click to add project
                    </button>
                  ) : null}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('certifications', 5) }} className="min-w-0">
        {optionalSectionShown(optionalSectionPresence, 'certifications', data.certifications.length > 0) && vis('certifications')
          ? sectionBox(
              'certifications',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('certifications', 'Certifications', () => ctx?.onUpdate({ certifications: [] }))}
                <div className="mt-2.5 space-y-1.5 text-left text-[9.5pt] leading-[1.32] text-[#1a1a1a]">
                  {certListCreative.length === 0 && inline && ctx ? (
                    <button
                      type="button"
                      className="text-sm italic text-[#00C9B1] hover:underline"
                      onClick={() =>
                        ctx.onUpdate({
                          certifications: [{ id: newLocalId(), name: '', issuer: '', date: '', url: '' }],
                        })
                      }
                    >
                      + Click to add certification
                    </button>
                  ) : (
                    certListCreative.map((c, cIdx) => (
                      <div
                        key={c.id}
                        data-entry-id={c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          ctx?.setFocusedSection('certifications');
                          ctx?.setFocusedEntryId(c.id);
                          ctx?.setFocusedEntrySection('certifications');
                        }}
                        style={{
                          outline: ctx?.focusedEntryId === c.id ? '1.5px dashed #00C9B1' : 'none',
                          outlineOffset: '3px',
                          borderRadius: '3px',
                          position: 'relative',
                        }}
                      >
                        {inline && ctx?.focusedEntryId === c.id ? (
                          <EntryToolbar
                            sectionType="certifications"
                            onAddEntry={() =>
                              ctx.onUpdate({
                                certifications: [...data.certifications, { id: newLocalId(), name: '', issuer: '', date: '', url: '' }],
                              })
                            }
                            onMoveUp={() => {
                              if (cIdx === 0) return;
                              const next = [...data.certifications];
                              [next[cIdx - 1], next[cIdx]] = [next[cIdx], next[cIdx - 1]];
                              ctx.onUpdate({ certifications: next });
                            }}
                            onMoveDown={() => {
                              if (cIdx >= data.certifications.length - 1) return;
                              const next = [...data.certifications];
                              [next[cIdx], next[cIdx + 1]] = [next[cIdx + 1], next[cIdx]];
                              ctx.onUpdate({ certifications: next });
                            }}
                            onDelete={() => {
                              ctx.onUpdate({ certifications: data.certifications.filter((row) => row.id !== c.id) });
                              ctx.setFocusedEntryId(null);
                              ctx.setFocusedEntrySection(null);
                            }}
                            showMoveUp={cIdx > 0}
                            showMoveDown={cIdx < data.certifications.length - 1}
                            showDatePicker={false}
                          />
                        ) : null}
                        <div>
                          {inline && ctx ? (
                            <>
                              <InlineField
                                value={c.name}
                                placeholder="Certification name"
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, name: v } : row)),
                                  })
                                }
                                className="font-bold text-[#1a1a1a]"
                              />
                              <span className="text-black/40"> · </span>
                              <InlineField
                                value={c.issuer}
                                placeholder="Issuer"
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, issuer: v } : row)),
                                  })
                                }
                                className="text-[#1a1a1a]"
                              />
                              <span className="text-black/40"> · </span>
                              <InlineField
                                value={c.date}
                                placeholder="Date"
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, date: v } : row)),
                                  })
                                }
                                className="text-[#1a1a1a]"
                              />
                              <span className="mt-0.5 block">
                                <InlineField
                                  value={c.url}
                                  placeholder="URL (optional)"
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, url: v } : row)),
                                    })
                                  }
                                  className="text-[8.2pt] text-[#1a1a1a]/80"
                                />
                              </span>
                              <div className="group mt-2 flex justify-center">
                                <button
                                  type="button"
                                  className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                                    addButtonVisibilityClass(activeSection, 'certifications'),
                                  )}
                                  aria-label="Add certification"
                                  title="Add certification"
                                  onClick={() =>
                                    ctx.onUpdate({
                                      certifications: [
                                        ...data.certifications,
                                        { id: newLocalId(), name: '', issuer: '', date: '', url: '' },
                                      ],
                                    })
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </>
                          ) : c.url.trim() ? (
                            <a
                              href={c.url.trim().startsWith('http') ? c.url.trim() : `https://${c.url.trim()}`}
                              className="font-bold text-[#1a1a1a] underline"
                              style={{ color: accent }}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {c.name || 'Certification'}
                            </a>
                          ) : (
                            <span className="font-bold text-[#1a1a1a]">{c.name || 'Certification'}</span>
                          )}
                          {!inline || !ctx ? (
                            <>
                              {c.issuer.trim() ? <span> · {c.issuer.trim()}</span> : null}
                              {c.date.trim() ? <span> · {c.date.trim()}</span> : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('languages', 6) }} className="min-w-0">
        {optionalSectionShown(optionalSectionPresence, 'languages', data.languages.length > 0) && vis('languages')
          ? sectionBox(
              'languages',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('languages', 'Languages', () => ctx?.onUpdate({ languages: [] }))}
                <ul className="mt-2.5 list-none space-y-1 text-left text-[9.5pt] leading-[1.32] text-[#1a1a1a]">
                  {(inline && ctx ? data.languages : data.languages.filter((l) => l.language.trim() || l.proficiency?.trim())).map(
                    (l, lIdx) => {
                      const lang = l.language.trim() || 'Language';
                      const level = l.proficiency?.trim();
                      return (
                        <li
                          key={l.id}
                          className="flex justify-between gap-4"
                          data-entry-id={l.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            ctx?.setFocusedSection('languages');
                            ctx?.setFocusedEntryId(l.id);
                            ctx?.setFocusedEntrySection('languages');
                          }}
                          style={{
                            outline: ctx?.focusedEntryId === l.id ? '1.5px dashed #00C9B1' : 'none',
                            outlineOffset: '3px',
                            borderRadius: '3px',
                            position: 'relative',
                          }}
                        >
                          {inline && ctx?.focusedEntryId === l.id ? (
                            <EntryToolbar
                              sectionType="languages"
                              onAddEntry={() =>
                                ctx.onUpdate({ languages: [...data.languages, { id: newLocalId(), language: '', proficiency: '' }] })
                              }
                              onMoveUp={() => {
                                if (lIdx === 0) return;
                                const next = [...data.languages];
                                [next[lIdx - 1], next[lIdx]] = [next[lIdx], next[lIdx - 1]];
                                ctx.onUpdate({ languages: next });
                              }}
                              onMoveDown={() => {
                                if (lIdx >= data.languages.length - 1) return;
                                const next = [...data.languages];
                                [next[lIdx], next[lIdx + 1]] = [next[lIdx + 1], next[lIdx]];
                                ctx.onUpdate({ languages: next });
                              }}
                              onDelete={() => {
                                ctx.onUpdate({ languages: data.languages.filter((row) => row.id !== l.id) });
                                ctx.setFocusedEntryId(null);
                                ctx.setFocusedEntrySection(null);
                              }}
                              showMoveUp={lIdx > 0}
                              showMoveDown={lIdx < data.languages.length - 1}
                              showDatePicker={false}
                            />
                          ) : null}
                          <span className="font-semibold">
                            {inline && ctx ? (
                              <InlineField
                                value={l.language}
                                placeholder="Language"
                                sectionId="languages"
                                entryId={l.id}
                                onChange={(v) =>
                                  ctx.onUpdate({ languages: data.languages.map((row) => (row.id === l.id ? { ...row, language: v } : row)) })
                                }
                                className="font-semibold text-[#1a1a1a]"
                              />
                            ) : (
                              lang
                            )}
                          </span>
                          {inline && ctx ? (
                            <span className="shrink-0 text-[#1a1a1a]/75">
                              <InlineField
                                value={l.proficiency ?? ''}
                                placeholder="e.g. Fluent, Intermediate"
                                sectionId="languages"
                                entryId={l.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    languages: data.languages.map((row) =>
                                      row.id === l.id ? { ...row, proficiency: v as CVBuilderLanguage['proficiency'] } : row,
                                    ),
                                  })
                                }
                                className="text-[#1a1a1a]/75"
                              />
                            </span>
                          ) : level ? (
                            <span className="shrink-0 text-[#1a1a1a]/75">{level}</span>
                          ) : null}
                        </li>
                      );
                    },
                  )}
                  {inline && ctx && data.languages.length === 0 ? (
                    <li className="list-none">
                      <button
                        type="button"
                        className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                        onClick={() =>
                          ctx.onUpdate({ languages: [{ id: newLocalId(), language: '', proficiency: '' }] })
                        }
                      >
                        + Click to add language
                      </button>
                    </li>
                  ) : null}
                </ul>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('achievements', 7) }} className="min-w-0">
        {optionalSectionShown(optionalSectionPresence, 'achievements', data.achievements.length > 0) && vis('achievements')
          ? sectionBox(
              'achievements',
              activeSection,
              'mb-3',
              <>
                {renderSectionTitle('achievements', 'Achievements & awards', () => ctx?.onUpdate({ achievements: [] }))}
                <div className="mt-2.5 space-y-2 text-left text-[9.5pt] leading-[1.32] text-[#1a1a1a]">
                  {(inline && ctx
                    ? data.achievements
                    : data.achievements.filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail.trim())
                  ).map((a, aIdx) => (
                    <div
                      key={a.id}
                      data-entry-id={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        ctx?.setFocusedSection('achievements');
                        ctx?.setFocusedEntryId(a.id);
                        ctx?.setFocusedEntrySection('achievements');
                      }}
                      style={{
                        outline: ctx?.focusedEntryId === a.id ? '1.5px dashed #00C9B1' : 'none',
                        outlineOffset: '3px',
                        borderRadius: '3px',
                        position: 'relative',
                      }}
                    >
                      {inline && ctx?.focusedEntryId === a.id ? (
                        <EntryToolbar
                          sectionType="achievements"
                          onAddEntry={() =>
                            ctx.onUpdate({
                              achievements: [
                                ...data.achievements,
                                { id: newLocalId(), title: '', issuer: '', date: '', detail: '' },
                              ],
                            })
                          }
                          onMoveUp={() => {
                            if (aIdx === 0) return;
                            const next = [...data.achievements];
                            [next[aIdx - 1], next[aIdx]] = [next[aIdx], next[aIdx - 1]];
                            ctx.onUpdate({ achievements: next });
                          }}
                          onMoveDown={() => {
                            if (aIdx >= data.achievements.length - 1) return;
                            const next = [...data.achievements];
                            [next[aIdx], next[aIdx + 1]] = [next[aIdx + 1], next[aIdx]];
                            ctx.onUpdate({ achievements: next });
                          }}
                          onDelete={() => {
                            ctx.onUpdate({ achievements: data.achievements.filter((row) => row.id !== a.id) });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }}
                          showMoveUp={aIdx > 0}
                          showMoveDown={aIdx < data.achievements.length - 1}
                          showDatePicker={false}
                        />
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <span className="font-bold">
                          {inline && ctx ? (
                            <InlineField
                              value={a.title}
                              placeholder="Achievement title"
                              sectionId="achievements"
                              entryId={a.id}
                              onChange={(v) =>
                                ctx.onUpdate({ achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, title: v } : row)) })
                              }
                              className="font-bold text-[#1a1a1a]"
                            />
                          ) : (
                            a.title || 'Achievement'
                          )}
                        </span>
                        {inline && ctx ? (
                          <span className="shrink-0 font-semibold">
                            <InlineField
                              value={a.date}
                              placeholder="Date"
                              sectionId="achievements"
                              entryId={a.id}
                              onChange={(v) =>
                                ctx.onUpdate({ achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, date: v } : row)) })
                              }
                              className="font-semibold text-[#1a1a1a]"
                            />
                          </span>
                        ) : a.date.trim() ? (
                          <span className="shrink-0 font-semibold">{a.date.trim()}</span>
                        ) : null}
                      </div>
                      {inline && ctx ? (
                        <div className="mt-0.5 text-[#1a1a1a]/75">
                          <InlineField
                            value={a.issuer}
                            placeholder="Issuer"
                            sectionId="achievements"
                            entryId={a.id}
                            onChange={(v) =>
                              ctx.onUpdate({ achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, issuer: v } : row)) })
                            }
                            className="text-[#1a1a1a]/75"
                          />
                        </div>
                      ) : a.issuer.trim() ? (
                        <p className="mt-0.5 text-[#1a1a1a]/75">{a.issuer.trim()}</p>
                      ) : null}
                      {inline && ctx ? (
                        <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                          <InlineField
                            multiline
                            value={a.detail}
                            placeholder="Details"
                            sectionId="achievements"
                            entryId={a.id}
                            onChange={(v) =>
                              ctx.onUpdate({ achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, detail: v } : row)) })
                            }
                            className="leading-relaxed text-[#1a1a1a]"
                          />
                        </div>
                      ) : a.detail.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{a.detail.trim()}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>,
              diffSection,
              diffChangedFields,
              onAcceptDiff,
              onRejectDiff,
            )
          : null}
        </div>

        <div style={{ order: creativeOrd('references', 8) }} className="min-w-0">
        {optionalSectionShown(
          optionalSectionPresence,
          'references',
          filterCvBuilderReferences(data.references).length > 0 || Boolean(inline && ctx),
        ) && vis('references')
          ? (
            <CVSectionWrapper sectionId="references">
              {sectionBox(
                'references',
                activeSection,
                'mb-3',
                <>
                  {renderSectionTitle('references', 'References', () => ctx?.onUpdate({ references: [] }))}
                  <CvEditableReferencesList
                    references={data.references}
                    layout="inline-separated"
                    textClassName="text-left text-[9.5pt] leading-[1.32] text-[#1a1a1a]"
                    className="mt-2.5"
                  />
                </>,
                diffSection,
                diffChangedFields,
                onAcceptDiff,
                onRejectDiff,
              )}
            </CVSectionWrapper>
          )
          : null}
        </div>

        <div style={{ order: creativeOrd('custom-legacy', 9) }} className="min-w-0">
        {shouldRenderCustomLegacySection(data, inline) && vis('custom-legacy')
          ? (
            <CVSectionWrapper sectionId="custom-legacy">
              {sectionBox(
                'custom-legacy',
                activeSection,
                'mb-3',
                <>
                  {inline && ctx && data.customSections.length === 0 ? (
                    <button
                      type="button"
                      className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                      onClick={() => ctx.onUpdate({ customSections: [{ id: newLocalId(), title: '', body: '' }] })}
                    >
                      + Click to add section
                    </button>
                  ) : null}
                  {(inline && ctx ? data.customSections : data.customSections.filter((x) => x.title.trim() || x.body.trim())).map(
                    (x, xIdx) => (
                      <Fragment key={x.id}>
                        {inline && ctx ? (
                          <EntryToolbar
                            sectionType="custom"
                            onAddEntry={() =>
                              ctx.onUpdate({ customSections: [...data.customSections, { id: newLocalId(), title: '', body: '' }] })
                            }
                            onMoveUp={() => {
                              if (xIdx === 0) return;
                              const next = [...data.customSections];
                              [next[xIdx - 1], next[xIdx]] = [next[xIdx], next[xIdx - 1]];
                              ctx.onUpdate({ customSections: next });
                            }}
                            onMoveDown={() => {
                              if (xIdx >= data.customSections.length - 1) return;
                              const next = [...data.customSections];
                              [next[xIdx], next[xIdx + 1]] = [next[xIdx + 1], next[xIdx]];
                              ctx.onUpdate({ customSections: next });
                            }}
                            onDelete={() => ctx.onUpdate({ customSections: data.customSections.filter((row) => row.id !== x.id) })}
                            showMoveUp={xIdx > 0}
                            showMoveDown={xIdx < data.customSections.length - 1}
                            showDatePicker={false}
                          />
                        ) : null}
                        {inline && ctx ? (
                          <div className="mt-3">
                            <span style={{ color: accent }}>
                              <InlineField
                                value={x.title}
                                placeholder="Section title"
                                sectionId="custom-legacy"
                                entryId={x.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    customSections: data.customSections.map((row) => (row.id === x.id ? { ...row, title: v } : row)),
                                  })
                                }
                                className="text-left text-[10pt] font-bold uppercase tracking-[0.14em]"
                              />
                            </span>
                            <div className="mt-1 h-px w-full" style={{ backgroundColor: accent, height: '1.5px' }} />
                          </div>
                        ) : (
                          creativeSectionTitle(x.title.trim() || 'Additional')
                        )}
                        <div className="mt-1.5 text-[9.5pt] leading-[1.38] text-[#1a1a1a]">
                          {inline && ctx ? (
                            <InlineField
                              multiline
                              layout="block"
                              value={x.body}
                              placeholder="Section details"
                              sectionId="custom-legacy"
                              entryId={x.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  customSections: data.customSections.map((row) => (row.id === x.id ? { ...row, body: v } : row)),
                                })
                              }
                              className="text-[#1a1a1a]"
                            />
                          ) : (
                            <RichText text={x.body.trim()} />
                          )}
                        </div>
                      </Fragment>
                    ),
                  )}
                </>,
                diffSection,
                diffChangedFields,
                onAcceptDiff,
                onRejectDiff,
              )}
            </CVSectionWrapper>
          )
          : null}
        </div>

        {filterParsedCustomSectionsForEditor(data.parsedCustomSections).map((block, blockIdx) =>
          block.title.trim() || block.items.some((i) => i.text.trim() || i.subItems.length) ? (
            <div
              key={block.sectionId}
              style={{ order: creativeOrd(`parsed-${block.sectionId}`, 50 + blockIdx) }}
              className="min-w-0"
            >
              <Fragment key={block.sectionId}>
              {vis(`parsed-${block.sectionId}`) ? (
                <CVSectionWrapper sectionId={`parsed-${block.sectionId}`}>
                  {sectionBox(
                    `parsed-${block.sectionId}`,
                    activeSection,
                    'mb-3',
                    <>
                      {renderSectionTitle(`parsed-${block.sectionId}`, block.title.trim() || 'Additional', () =>
                        ctx?.onUpdate({
                          parsedCustomSections: data.parsedCustomSections.filter((b) => b.sectionId !== block.sectionId),
                        })
                      )}
                      <div className="mt-2.5 space-y-1.5 text-left text-[9.5pt] leading-[1.32] text-[#1a1a1a]">
                        {block.items.length === 0 && inline && ctx ? (
                          <button
                            type="button"
                            className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                            onClick={() =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? { ...b, items: [{ id: newLocalId(), text: '', date: '', subItems: [] }] }
                                    : b,
                                ),
                              })
                            }
                          >
                            + Click to add item
                          </button>
                        ) : null}
                        {block.items.map((item, itemIdx) => {
                          const usesRangeDates = /volunteer|experience|employment|work|project/i.test(block.sectionType);
                          return (
                            <div
                              key={item.id}
                              data-entry-id={item.id}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                ctx?.setFocusedSection(`parsed-${block.sectionId}`);
                                ctx?.setFocusedEntryId(item.id);
                                ctx?.setFocusedEntrySection(`parsed-${block.sectionId}`);
                              }}
                              style={{
                                outline: ctx?.focusedEntryId === item.id ? '1.5px dashed #00C9B1' : 'none',
                                outlineOffset: '3px',
                                borderRadius: '3px',
                                position: 'relative',
                              }}
                            >
                              {inline && ctx?.focusedEntryId === item.id ? (
                                <EntryToolbar
                                  sectionType={block.sectionType}
                                  onAddBullet={() =>
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId
                                          ? {
                                              ...b,
                                              items: b.items.map((it) =>
                                                it.id === item.id ? { ...it, subItems: [...(it.subItems.length ? it.subItems : ['']), ''] } : it,
                                              ),
                                            }
                                          : b,
                                      ),
                                    })
                                  }
                                  onAddEntry={() =>
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId
                                          ? { ...b, items: [...b.items, { id: newLocalId(), text: '', date: '', subItems: [] }] }
                                          : b,
                                      ),
                                    })
                                  }
                                  onMoveUp={() => {
                                    if (itemIdx === 0) return;
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) => {
                                        if (b.sectionId !== block.sectionId) return b;
                                        const next = [...b.items];
                                        [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                                        return { ...b, items: next };
                                      }),
                                    });
                                  }}
                                  onMoveDown={() => {
                                    if (itemIdx >= block.items.length - 1) return;
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) => {
                                        if (b.sectionId !== block.sectionId) return b;
                                        const next = [...b.items];
                                        [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                                        return { ...b, items: next };
                                      }),
                                    });
                                  }}
                                  onDelete={() => {
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId ? { ...b, items: b.items.filter((it) => it.id !== item.id) } : b,
                                      ),
                                    });
                                    ctx.setFocusedEntryId(null);
                                    ctx.setFocusedEntrySection(null);
                                  }}
                                  onDatePick={(startDate, endDate) =>
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId
                                          ? {
                                              ...b,
                                              items: b.items.map((it) => {
                                                if (it.id !== item.id) return it;
                                                return { ...it, date: usesRangeDates ? [startDate, endDate].filter(Boolean).join(' - ') : startDate };
                                              }),
                                            }
                                          : b,
                                      ),
                                    })
                                  }
                                  dateMode={usesRangeDates ? 'range' : 'single'}
                                  dateStart={splitCvStoredRange(item.date ?? '').start}
                                  dateEnd={splitCvStoredRange(item.date ?? '').end}
                                  showMoveUp={itemIdx > 0}
                                  showMoveDown={itemIdx < block.items.length - 1}
                                  showAddBullet
                                  showDatePicker
                                  settingsOptions={[
                                    {
                                      key: 'date',
                                      label: 'Date',
                                      enabled: entryFieldOn(`parsed:${item.id}`, 'date'),
                                      onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'date', next),
                                    },
                                    {
                                      key: 'bullets',
                                      label: 'Bullets',
                                      enabled: entryFieldOn(`parsed:${item.id}`, 'bullets'),
                                      onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'bullets', next),
                                    },
                                  ]}
                                />
                              ) : null}
                              {inline && ctx ? (
                                <>
                                  <div className="font-bold">
                                    <InlineField
                                      value={item.text}
                                      placeholder={parsedCustomMainPlaceholder(block.sectionType)}
                                      sectionId={`parsed-${block.sectionId}`}
                                      entryId={item.id}
                                      onChange={(v) =>
                                        ctx.onUpdate({
                                          parsedCustomSections: data.parsedCustomSections.map((b) =>
                                            b.sectionId === block.sectionId
                                              ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, text: v } : it)) }
                                              : b,
                                          ),
                                        })
                                      }
                                      className="font-bold text-[#1a1a1a]"
                                    />
                                    <span className="font-normal"> </span>
                                    {entryFieldOn(`parsed:${item.id}`, 'date') ? (
                                      <InlineField
                                        value={item.date ?? ''}
                                        placeholder={usesRangeDates ? 'Date range (From - To)' : 'Date'}
                                        sectionId={`parsed-${block.sectionId}`}
                                        entryId={item.id}
                                        onChange={(v) =>
                                          ctx.onUpdate({
                                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                                              b.sectionId === block.sectionId
                                                ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, date: v } : it)) }
                                                : b,
                                            ),
                                          })
                                        }
                                        className="text-[#1a1a1a]"
                                      />
                                    ) : null}
                                  </div>
                                  {entryFieldOn(`parsed:${item.id}`, 'bullets') ? (
                                    <ul className="mt-1 list-none space-y-0.5 pl-0 text-[9.5pt] leading-[1.35] text-[#1a1a1a]">
                                      {(item.subItems.length > 0 ? item.subItems : ['']).map((line, lineIdx) => (
                                        <li key={`${item.id}-sub-${lineIdx}`} className="flex items-start gap-1.5">
                                          <span className="mt-0.5 shrink-0">•</span>
                                          <span className="flex-1">
                                            <InlineField
                                              value={line}
                                              layout="block"
                                              placeholder="Detail bullet"
                                              sectionId={`parsed-${block.sectionId}`}
                                              entryId={item.id}
                                              dataBulletIdx={item.id}
                                              onChange={(v) =>
                                                ctx.onUpdate({
                                                  parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                    b.sectionId === block.sectionId
                                                      ? {
                                                          ...b,
                                                          items: b.items.map((it) => {
                                                            if (it.id !== item.id) return it;
                                                            const next = [...(it.subItems.length ? it.subItems : [''])];
                                                            next[lineIdx] = normalizeBulletInput(v);
                                                            return { ...it, subItems: next };
                                                          }),
                                                        }
                                                      : b,
                                                  ),
                                                })
                                              }
                                              onInputKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  ctx.onUpdate({
                                                    parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                      b.sectionId === block.sectionId
                                                        ? {
                                                            ...b,
                                                            items: b.items.map((it) => {
                                                              if (it.id !== item.id) return it;
                                                              const next = [...(it.subItems.length ? it.subItems : [''])];
                                                              next.splice(lineIdx + 1, 0, '');
                                                              return { ...it, subItems: next };
                                                            }),
                                                          }
                                                        : b,
                                                    ),
                                                  });
                                                }
                                                if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && (item.subItems.length || 1) > 1) {
                                                  e.preventDefault();
                                                  ctx.onUpdate({
                                                    parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                      b.sectionId === block.sectionId
                                                        ? {
                                                            ...b,
                                                            items: b.items.map((it) =>
                                                              it.id === item.id
                                                                ? {
                                                                    ...it,
                                                                    subItems: (it.subItems.length ? it.subItems : ['']).filter((_, i) => i !== lineIdx),
                                                                  }
                                                                : it,
                                                            ),
                                                          }
                                                        : b,
                                                    ),
                                                  });
                                                }
                                              }}
                                              className="text-[#1a1a1a]"
                                            />
                                          </span>
                                          {ctx?.focusedEntryId === item.id && ctx?.focusedEntrySection === `parsed-${block.sectionId}` ? (
                                            <button
                                              type="button"
                                              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                              onClick={(ev) => {
                                                ev.stopPropagation();
                                                const current = item.subItems.length ? item.subItems : [''];
                                                if (current.length <= 1) return;
                                                ctx.onUpdate({
                                                  parsedCustomSections: data.parsedCustomSections.map((b) =>
                                                    b.sectionId === block.sectionId
                                                      ? {
                                                          ...b,
                                                          items: b.items.map((it) =>
                                                            it.id === item.id ? { ...it, subItems: current.filter((_, i) => i !== lineIdx) } : it,
                                                          ),
                                                        }
                                                      : b,
                                                  ),
                                                });
                                              }}
                                              aria-label="Remove bullet"
                                            >
                                              ×
                                            </button>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <p className="font-semibold">
                                    <RichText text={item.text} />
                                    {item.date?.trim() ? (
                                      <span className="ml-2 font-normal text-[#1a1a1a]/65">({item.date.trim()})</span>
                                    ) : null}
                                  </p>
                                  {item.subItems.length > 0 ? (
                                    <ul className="mt-1 list-disc list-outside pl-5 leading-[1.32]">
                                      {item.subItems.map((line, i) => (
                                        <li key={i}>
                                          <RichText text={line} />
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>,
                    diffSection,
                    diffChangedFields,
                    onAcceptDiff,
                    onRejectDiff,
                  )}
                </CVSectionWrapper>
              ) : null}
            </Fragment>
            </div>
          ) : null,
        )}
      </div>
      <CvPreviewWatermarkFooter />
    </div>
  );
}


function formatEduRangeEnDash(startYear: string, endYear: string): string {
  return formatEduRange(startYear, endYear).replace(/\s*—\s*/g, ' – ');
}

/** When `field` looks like a campus/location (no 4-digit year), show it top-right like the reference CV. */
function professionalEducationLayout(e: CVBuilderData['education']['items'][number]): {
  line1Right: string;
  degreeLine: string;
} {
  const f = (e.field || '').trim();
  const d = (e.degree || '').trim();
  if (f && !/\d{4}/.test(f)) {
    const degParts = [d, e.grade?.trim()].filter(Boolean);
    return { line1Right: f, degreeLine: degParts.join(degParts.length > 1 ? ' · ' : '') };
  }
  return { line1Right: '', degreeLine: [d, f, e.grade?.trim()].filter(Boolean).join(', ') };
}

function professionalLinkLabel(url: string): string {
  const u = url.trim().toLowerCase();
  if (u.includes('linkedin.com')) return 'LinkedIn';
  if (u.includes('github.com')) return 'GitHub';
  if (u.includes('dev.to')) return 'Dev.to';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'X / Twitter';
  try {
    const host = new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '');
    return host || 'Link';
  } catch {
    return 'Link';
  }
}

function professionalHeaderLinks(p: CVBuilderData['personal']): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  const shortLabel = (raw: string): string => {
    const t = raw.trim();
    if (!t) return '';
    try {
      const href = t.startsWith('http') ? t : `https://${t}`;
      const u = new URL(href);
      return `${u.hostname.replace(/^www\./, '')}${u.pathname}${u.search}${u.hash}`.replace(/\/$/, '') || u.hostname.replace(/^www\./, '');
    } catch {
      return t.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }
  };
  const push = (raw: string | undefined) => {
    const t = (raw || '').trim();
    if (!t) return;
    const href = t.startsWith('http') ? t : `https://${t}`;
    const key = normalizePersonalUrlKey(href);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ href, label: shortLabel(t) || professionalLinkLabel(t) });
  };
  push(p.linkedin);
  push(p.github);
  push(p.website);
  push(p.portfolio);
  return out;
}

/** Professional — strict B&W Verdana reference layout (ATS-friendly) */
function ProfessionalDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
  optionalSectionPresence,
  sectionOrder,
  onReorderSections,
}: {
  data: CVBuilderData;
  activeSection?: string | null;
  sectionVisibility?: CVSectionVisibilityMap | null;
  diffSection?: string | null;
  diffChangedFields?: ChangedField[] | null;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  optionalSectionPresence?: Set<string>;
  sectionOrder?: string[];
  onReorderSections?: (nextOrder: string[]) => void;
}) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing && ctx?.onUpdate);
  const hp = ctx?.headerPreview ?? DEFAULT_HEADER_PREVIEW;
  const [entryFieldVisibility, setEntryFieldVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const [sectionTitleOverrides, setSectionTitleOverrides] = useState<Record<string, string>>({});
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  /**
   * Reconcile local hides with backend visibility — when a section becomes visible again
   * (e.g. user re-added/restored it via the Sections modal), clear it from the local hidden
   * set so the preview renders the section instantly without a manual refresh.
   */
  useEffect(() => {
    if (!sectionVisibility) return;
    setHiddenSections((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const key of prev) {
        if (sectionVisibility[key] === true) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sectionVisibility]);
  const draggingSectionIdRef = useRef<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const vis = (k: string) => isCvSectionVisible(k, sectionVisibility) && !hiddenSections.has(k);
  const p = data.personal;
  const displayName = ((p.name || '').trim() || 'Your Name').toUpperCase();
  const emailStr = (p.email || '').trim();
  const phoneStr = (p.phone || '').trim();
  const headerLinks = professionalHeaderLinks(p);

  const professionalFont = 'Verdana, Geneva, ui-sans-serif, system-ui, sans-serif';

  const entryFieldOn = (entryKey: string, field: string) => entryFieldVisibility[entryKey]?.[field] ?? true;
  const setEntryFieldOn = (entryKey: string, field: string, enabled: boolean) => {
    setEntryFieldVisibility((prev) => ({
      ...prev,
      [entryKey]: {
        ...(prev[entryKey] ?? {}),
        [field]: enabled,
      },
    }));
  };

  const sectionTitle = (sectionId: string, fallback: string) =>
    resolveSectionDisplayTitle(sectionId, fallback, data, sectionTitleOverrides);
  const sectionIsActive = (sectionId: string) =>
    ctx?.focusedSection === sectionId || ctx?.focusedEntrySection === sectionId;

  const reorderPreviewSections = (targetSectionId: string) => {
    /**
     * Local ref handles drops on the title bar; module-level fallback handles drops on the
     * section body (forwarded from `CVSectionWrapper` via `cv:section-reorder-drop`).
     */
    const draggingSectionId = draggingSectionIdRef.current ?? getActiveDraggingSectionId();
    if (!draggingSectionId || draggingSectionId === targetSectionId) return;
    const sourceOrder = sectionOrder && sectionOrder.length > 0
      ? sectionOrder
      : [...DEFAULT_PREVIEW_DRAG_SECTION_ORDER];
    const next = reorderSectionKeys(sourceOrder, draggingSectionId, targetSectionId);
    if (!next) return;
    onReorderSections?.(next);
    draggingSectionIdRef.current = null;
  };
  useEffect(() => {
    if (!inline) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SectionReorderDropDetail>).detail;
      if (!detail?.targetSectionId) return;
      reorderPreviewSections(detail.targetSectionId);
    };
    window.addEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(SECTION_REORDER_DROP_EVENT_NAME, handler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closure captures latest sectionOrder/onReorderSections via re-registration on those deps
  }, [inline, sectionOrder, onReorderSections]);

  const renderSectionTitle = (
    sectionId: string,
    fallback: string,
    onDeleteSection?: () => void,
  ) => {
    const titleEntryId = `__section-title__:${sectionId}`;
    const focused = ctx?.focusedEntryId === titleEntryId;
    return (
      <div
        className={cn('mb-0.5', inline && sectionIsActive(sectionId) && 'group')}
        data-entry-id={titleEntryId}
        onDragOver={(e) => {
          if (!inline || !draggingSectionIdRef.current) return;
          e.preventDefault();
          setDragOverSectionId(sectionId);
        }}
        onDragLeave={() => {
          if (dragOverSectionId === sectionId) setDragOverSectionId(null);
        }}
        onDrop={(e) => {
          if (!inline) return;
          e.preventDefault();
          /** stopPropagation prevents CVSectionWrapper's drop listener from firing a second reorder. */
          e.stopPropagation();
          reorderPreviewSections(sectionId);
          setDragOverSectionId(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          ctx?.setFocusedSection(sectionId);
          ctx?.setFocusedEntryId(titleEntryId);
          ctx?.setFocusedEntrySection(sectionId);
        }}
      >
        {inline && dragOverSectionId === sectionId && draggingSectionIdRef.current !== sectionId ? (
          <div className="mb-1 rounded-md border-2 border-dashed border-[#00C9B1]/70 bg-[#00C9B1]/8 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#007A7A]">
            Drop section here
          </div>
        ) : null}
        {inline && focused ? (
          <EntryToolbar
            sectionType={sectionId}
            onAddEntry={() => {}}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            onDelete={() => {
              if (!onDeleteSection || isCoreSectionId(sectionId)) return;
              onDeleteSection();
              setHiddenSections((prev) => new Set(prev).add(sectionId));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cv:section-hidden', { detail: { sectionId } }));
              }
              ctx?.setFocusedEntryId(null);
              ctx?.setFocusedEntrySection(null);
            }}
            showMoveUp={false}
            showMoveDown={false}
            hideAddButton
            hideDelete={isCoreSectionId(sectionId)}
          />
        ) : null}
        <h2 className="relative flex items-center justify-center gap-1 text-center text-[8.5pt] font-extrabold uppercase tracking-[0.04em] text-black antialiased">
          {inline ? (
            <span
              role="button"
              tabIndex={0}
              title="Drag section to reorder"
              aria-label={`Drag ${fallback} section to reorder`}
              draggable
              className="absolute left-0 cursor-grab rounded-sm border border-[#00C9B1]/45 bg-white/95 p-0.5 text-[#00C9B1] shadow-sm shadow-[#00C9B1]/15 transition hover:border-[#00C9B1]/70 hover:bg-[#00C9B1]/10 hover:text-[#007A7A] active:cursor-grabbing"
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                draggingSectionIdRef.current = sectionId;
                setActiveDraggingSectionId(sectionId);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', sectionId);
              }}
              onDragEnd={() => {
                draggingSectionIdRef.current = null;
                setActiveDraggingSectionId(null);
                setDragOverSectionId(null);
                dispatchSectionDragEnd();
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
              }}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          {inline ? (
            <InlineField
              value={sectionTitle(sectionId, fallback)}
              placeholder={fallback}
              sectionId={sectionId}
              entryId={titleEntryId}
              onChange={(v) => {
                const title = persistSectionTitleChange(sectionId, v, fallback, data, ctx?.onUpdate);
                setSectionTitleOverrides((prev) => ({ ...prev, [sectionId]: title }));
              }}
              className="font-extrabold uppercase text-black"
            />
          ) : (
            sectionTitle(sectionId, fallback)
          )}
        </h2>
        <div className="mt-0.5 h-[3px] w-full bg-black" />
      </div>
    );
  };

  const allSkillCats = inline
    ? data.skills.categories
    : data.skills.categories.filter((c) => c.name.trim() || c.skills.some((s) => s.trim()));

  const educationEl = vis('education')
    ? (
      <CVSectionWrapper sectionId="education">
        {sectionBox(
          'education',
          activeSection,
          'mb-3',
          <>
            {renderSectionTitle('education', 'Education', () =>
              ctx?.onUpdate({ education: { items: [] } })
            )}
            <div className="mt-1.5 space-y-1.5 text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
              {data.education.items.length ? (
                data.education.items.map((e) => {
                  const { line1Right, degreeLine } = professionalEducationLayout(e);
                  const dates = formatEduRangeEnDash(e.startYear, e.endYear);
                  const topRight = line1Right || '';
                  return (
                    <div
                      key={e.id}
                      data-entry-id={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        ctx?.setFocusedSection('education');
                        ctx?.setFocusedEntryId(e.id);
                        ctx?.setFocusedEntrySection('education');
                      }}
                      style={{
                        outline: ctx?.focusedEntryId === e.id ? '1.5px dashed #00C9B1' : 'none',
                        outlineOffset: '3px',
                        borderRadius: '3px',
                        position: 'relative',
                      }}
                    >
                      {inline && ctx?.focusedEntryId === e.id ? (
                        <EntryToolbar
                          sectionType="education"
                          onAddEntry={() =>
                            ctx.onUpdate({
                              education: {
                                items: [
                                  ...data.education.items,
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
                          onMoveUp={() => {
                            const idx = data.education.items.findIndex((row) => row.id === e.id);
                            if (idx <= 0) return;
                            const next = [...data.education.items];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            ctx.onUpdate({ education: { items: next } });
                          }}
                          onMoveDown={() => {
                            const idx = data.education.items.findIndex((row) => row.id === e.id);
                            if (idx < 0 || idx >= data.education.items.length - 1) return;
                            const next = [...data.education.items];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            ctx.onUpdate({ education: { items: next } });
                          }}
                          onDelete={() => {
                            ctx.onUpdate({ education: { items: data.education.items.filter((row) => row.id !== e.id) } });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }}
                          onDatePick={(startDate, endDate) =>
                            ctx.onUpdate({
                              education: {
                                items: data.education.items.map((row) =>
                                  row.id === e.id ? { ...row, startYear: startDate, endYear: endDate } : row,
                                ),
                              },
                            })
                          }
                          showMoveUp={data.education.items.findIndex((row) => row.id === e.id) > 0}
                          showMoveDown={
                            data.education.items.findIndex((row) => row.id === e.id) < data.education.items.length - 1
                          }
                          dateStart={e.startYear}
                          dateEnd={e.endYear}
                          showDatePicker
                          settingsOptions={[
                            {
                              key: 'school',
                              label: 'School / University',
                              enabled: entryFieldOn(`education:${e.id}`, 'school'),
                              onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'school', next),
                            },
                            {
                              key: 'field',
                              label: 'Field',
                              enabled: entryFieldOn(`education:${e.id}`, 'field'),
                              onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'field', next),
                            },
                            {
                              key: 'degree',
                              label: 'Degree',
                              enabled: entryFieldOn(`education:${e.id}`, 'degree'),
                              onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'degree', next),
                            },
                            {
                              key: 'date',
                              label: 'Date Period',
                              enabled: entryFieldOn(`education:${e.id}`, 'date'),
                              onToggle: (next) => setEntryFieldOn(`education:${e.id}`, 'date', next),
                            },
                          ]}
                        />
                      ) : null}
                      {inline && ctx ? (
                        <>
                          <div className="flex justify-between gap-4">
                            {entryFieldOn(`education:${e.id}`, 'school') ? (
                            <span className="font-bold">
                              <InlineField
                                value={e.school}
                                placeholder="Institution"
                                sectionId="education"
                                entryId={e.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    education: {
                                      items: data.education.items.map((row) =>
                                        row.id === e.id ? { ...row, school: v } : row,
                                      ),
                                    },
                                  })
                                }
                                className="font-bold text-black"
                              />
                            </span>
                            ) : <span />}
                            {entryFieldOn(`education:${e.id}`, 'field') ? (
                            <span className="shrink-0 text-right font-normal">
                              <InlineField
                                value={topRight}
                                placeholder="Field"
                                sectionId="education"
                                entryId={e.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    education: {
                                      items: data.education.items.map((row) =>
                                        row.id === e.id ? { ...row, field: v } : row,
                                      ),
                                    },
                                  })
                                }
                                className="text-right text-black"
                              />
                            </span>
                            ) : null}
                          </div>
                          <div className="flex justify-between gap-4">
                            {entryFieldOn(`education:${e.id}`, 'degree') ? (
                            <span className="font-normal">
                              <InlineField
                                value={degreeLine || ''}
                                placeholder="Degree"
                                sectionId="education"
                                entryId={e.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    education: {
                                      items: data.education.items.map((row) =>
                                        row.id === e.id ? { ...row, degree: v, grade: '' } : row,
                                      ),
                                    },
                                  })
                                }
                                className="text-black"
                              />
                            </span>
                            ) : <span />}
                            {entryFieldOn(`education:${e.id}`, 'date') ? (
                            <span className="shrink-0 text-right font-bold">
                              <InlineField
                                value={dates}
                                placeholder="Years"
                                sectionId="education"
                                entryId={e.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    education: {
                                      items: data.education.items.map((row) =>
                                        row.id === e.id ? { ...row, startYear: v.trim(), endYear: '' } : row,
                                      ),
                                    },
                                  })
                                }
                                className="text-right font-bold text-black"
                              />
                            </span>
                            ) : null}
                          </div>
                          <div className="group mt-2 flex justify-center">
                            <button
                              type="button"
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                                addButtonVisibilityClass(activeSection, 'education'),
                              )}
                              aria-label="Add education entry"
                              title="Add education entry"
                              onClick={() =>
                                ctx.onUpdate({
                                  education: {
                                    items: [
                                      ...data.education.items,
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
                              +
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between gap-4">
                            <span className="font-bold">{e.school || 'Institution'}</span>
                            <span className="shrink-0 text-right font-normal">{topRight}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="font-normal">{degreeLine || '—'}</span>
                            <span className="shrink-0 text-right font-bold">{dates}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : inline && ctx ? (
                <button
                  type="button"
                  className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                  onClick={() =>
                    ctx.onUpdate({
                      education: {
                        items: [
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
                  + Click to add education
                </button>
              ) : (
                <p className="text-black">Add your education in the editor.</p>
              )}
            </div>
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
        )}
      </CVSectionWrapper>
    )
    : null;

  const achievementsEl =
    optionalSectionShown(optionalSectionPresence, 'achievements', data.achievements.length > 0) && vis('achievements') ? (
      <CVSectionWrapper sectionId="achievements">
      {sectionBox(
        'achievements',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('achievements', 'Achievements / awards', () =>
            ctx?.onUpdate({ achievements: [] })
          )}
          <div className="mt-1.5 space-y-1.5 text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
            {(() => {
              const rows = inline && ctx
                ? data.achievements
                : data.achievements.filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail.trim());
              if (rows.length === 0 && inline && ctx) {
                return (
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={() =>
                      ctx.onUpdate({
                        achievements: [{ id: newLocalId(), title: '', issuer: '', date: '', detail: '' }],
                      })
                    }
                  >
                    + Click to add achievement
                  </button>
                );
              }
              return rows.map((a, aIdx) => {
                const detailLines = a.detail
                  .trim()
                  .split(/\r?\n/)
                  .map((l) => l.trim())
                  .filter(Boolean);
                if (inline && ctx) {
                  return (
                    <div
                      key={a.id}
                      data-entry-id={a.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        ctx.setFocusedSection('achievements');
                        ctx.setFocusedEntryId(a.id);
                        ctx.setFocusedEntrySection('achievements');
                      }}
                      style={{
                        outline: ctx.focusedEntryId === a.id ? '1.5px dashed #00C9B1' : 'none',
                        outlineOffset: '3px',
                        borderRadius: '3px',
                        position: 'relative',
                      }}
                    >
                      {ctx.focusedEntryId === a.id ? (
                        <EntryToolbar
                          sectionType="achievements"
                          onAddEntry={() =>
                            ctx.onUpdate({
                              achievements: [...data.achievements, { id: newLocalId(), title: '', issuer: '', date: '', detail: '' }],
                            })
                          }
                          onMoveUp={() => {
                            if (aIdx === 0) return;
                            const next = [...data.achievements];
                            [next[aIdx - 1], next[aIdx]] = [next[aIdx], next[aIdx - 1]];
                            ctx.onUpdate({ achievements: next });
                          }}
                          onMoveDown={() => {
                            if (aIdx >= data.achievements.length - 1) return;
                            const next = [...data.achievements];
                            [next[aIdx], next[aIdx + 1]] = [next[aIdx + 1], next[aIdx]];
                            ctx.onUpdate({ achievements: next });
                          }}
                          onDelete={() => {
                            ctx.onUpdate({ achievements: data.achievements.filter((row) => row.id !== a.id) });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }}
                          onDatePick={(startDate) =>
                            ctx.onUpdate({
                              achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, date: startDate } : row)),
                            })
                          }
                          dateMode="single"
                          dateStart={a.date}
                          dateEnd=""
                          showMoveUp={aIdx > 0}
                          showMoveDown={aIdx < data.achievements.length - 1}
                          showDatePicker
                          settingsOptions={[
                            {
                              key: 'issuer',
                              label: 'Issuer',
                              enabled: entryFieldOn(`achievements:${a.id}`, 'issuer'),
                              onToggle: (next) => setEntryFieldOn(`achievements:${a.id}`, 'issuer', next),
                            },
                            {
                              key: 'date',
                              label: 'Date',
                              enabled: entryFieldOn(`achievements:${a.id}`, 'date'),
                              onToggle: (next) => setEntryFieldOn(`achievements:${a.id}`, 'date', next),
                            },
                            {
                              key: 'detail',
                              label: 'Description',
                              enabled: entryFieldOn(`achievements:${a.id}`, 'detail'),
                              onToggle: (next) => setEntryFieldOn(`achievements:${a.id}`, 'detail', next),
                            },
                          ]}
                        />
                      ) : null}
                      <div className="flex justify-between gap-3">
                        <p className="min-w-0 font-extrabold">
                          <InlineField
                            value={a.title}
                            placeholder="Achievement title"
                            sectionId="achievements"
                            entryId={a.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, title: v } : row)),
                              })
                            }
                            className="font-extrabold text-black"
                          />
                          {entryFieldOn(`achievements:${a.id}`, 'issuer') ? (
                            <>
                              <span>, </span>
                              <InlineField
                                value={a.issuer}
                                placeholder="Issuer"
                                sectionId="achievements"
                                entryId={a.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, issuer: v } : row)),
                                  })
                                }
                                className="text-black"
                              />
                            </>
                          ) : null}
                        </p>
                        {entryFieldOn(`achievements:${a.id}`, 'date') ? (
                        <span className="shrink-0 font-extrabold">
                          <InlineField
                            value={a.date}
                            placeholder="Date"
                            sectionId="achievements"
                            entryId={a.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, date: v } : row)),
                              })
                            }
                            className="font-extrabold text-black"
                          />
                        </span>
                        ) : null}
                      </div>
                      {entryFieldOn(`achievements:${a.id}`, 'detail') ? (
                      <div className="mt-1">
                        <InlineField
                          multiline
                          layout="block"
                          value={a.detail}
                          placeholder="Achievement detail"
                          sectionId="achievements"
                          entryId={a.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, detail: v } : row)),
                            })
                          }
                          className="text-black"
                        />
                      </div>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <div key={a.id}>
                    <div className="flex justify-between gap-3">
                      <p className="min-w-0 font-extrabold">
                        <span>{a.title || 'Achievement'}</span>
                        {a.issuer.trim() ? (
                          <>
                            {a.title.trim() ? ', ' : null}
                            <span>{a.issuer.trim()}</span>
                          </>
                        ) : null}
                      </p>
                      {a.date.trim() ? <span className="shrink-0 font-extrabold">{a.date.trim()}</span> : null}
                    </div>
                    {detailLines.length > 0 ? (
                      <ul className="mt-1 list-disc pl-4 text-[8.5pt] leading-snug marker:text-[8pt]">
                        {detailLines.map((line, i) => (
                          <li key={i}>{line.replace(/^[-•]\s*/, '')}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              });
            })()}
          </div>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )}
      </CVSectionWrapper>
    ) : null;

  const skillsEl = vis('skills')
    ? (
      <CVSectionWrapper sectionId="skills">
      {sectionBox(
        'skills',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('skills', 'Skills', () =>
            ctx?.onUpdate({ skills: { categories: [] } })
          )}
          <div className="mt-1.5 space-y-1.5" style={{ fontFamily: professionalFont }}>
            {allSkillCats.length === 0 ? (
              inline && ctx ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx.setFocusedSection('skills');
                      ctx.setFocusedEntryId('__skills-new__');
                      ctx.setFocusedEntrySection('skills');
                    }}
                  >
                    + Click to add skills
                  </button>
                  {ctx.focusedEntryId === '__skills-new__' ? (
                    <div
                      className="relative min-h-[2.2rem]"
                      data-entry-id="__skills-new__"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EntryToolbar
                        sectionType="skills"
                        onAddEntry={() => {
                          const id = newLocalId();
                          ctx.onUpdate({
                            skills: {
                              categories: [...data.skills.categories, { id, name: '', skills: [''] }],
                            },
                          });
                          ctx.setFocusedEntryId(id);
                        }}
                        onAddSecondaryEntry={() => {
                          const id = newLocalId();
                          ctx.onUpdate({
                            skills: {
                              categories: [...data.skills.categories, { id, name: 'Group Title', skills: [''] }],
                            },
                          });
                          ctx.setFocusedEntryId(id);
                        }}
                        onMoveUp={() => {}}
                        onMoveDown={() => {}}
                        onDelete={() => {
                          ctx.setFocusedEntryId(null);
                          ctx.setFocusedEntrySection(null);
                        }}
                        showMoveUp={false}
                        showMoveDown={false}
                        addEntryLabel="+ Skill"
                        addSecondaryEntryLabel="+ Group"
                        showDatePicker={false}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-[8.5pt] leading-tight text-black">Add skills in the editor.</p>
              )
            ) : (
              allSkillCats.map((cat, catIdx) => (
                <div
                  key={cat.id}
                  data-entry-id={cat.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx?.setFocusedSection('skills');
                    ctx?.setFocusedEntryId(cat.id);
                    ctx?.setFocusedEntrySection('skills');
                  }}
                  style={{
                    outline: ctx?.focusedEntryId === cat.id ? '1.5px dashed #00C9B1' : 'none',
                    outlineOffset: '3px',
                    borderRadius: '3px',
                    position: 'relative',
                  }}
                  className="mb-1.5"
                >
                  {inline && ctx?.focusedEntryId === cat.id ? (
                    <EntryToolbar
                      sectionType="skills"
                      onAddEntry={() =>
                        {
                          const id = newLocalId();
                          ctx.onUpdate({
                            skills: { categories: [...data.skills.categories, { id, name: '', skills: [''] }] },
                          });
                          ctx.setFocusedSection('skills');
                          ctx.setFocusedEntryId(id);
                          ctx.setFocusedEntrySection('skills');
                        }
                      }
                      onAddSecondaryEntry={() =>
                        {
                          const id = newLocalId();
                          ctx.onUpdate({
                            skills: { categories: [...data.skills.categories, { id, name: 'Group Title', skills: [''] }] },
                          });
                          ctx.setFocusedSection('skills');
                          ctx.setFocusedEntryId(id);
                          ctx.setFocusedEntrySection('skills');
                        }
                      }
                      onMoveUp={() => {
                        if (catIdx === 0) return;
                        const next = [...data.skills.categories];
                        [next[catIdx - 1], next[catIdx]] = [next[catIdx], next[catIdx - 1]];
                        ctx.onUpdate({ skills: { categories: next } });
                      }}
                      onMoveDown={() => {
                        if (catIdx >= data.skills.categories.length - 1) return;
                        const next = [...data.skills.categories];
                        [next[catIdx], next[catIdx + 1]] = [next[catIdx + 1], next[catIdx]];
                        ctx.onUpdate({ skills: { categories: next } });
                      }}
                      onDelete={() => {
                        ctx.onUpdate({ skills: { categories: data.skills.categories.filter((c) => c.id !== cat.id) } });
                        ctx.setFocusedEntryId(null);
                        ctx.setFocusedEntrySection(null);
                      }}
                      showMoveUp={catIdx > 0}
                      showMoveDown={catIdx < data.skills.categories.length - 1}
                      addEntryLabel="+ Skill"
                      addSecondaryEntryLabel="+ Group"
                      showDatePicker={false}
                      settingsOptions={[
                        {
                          key: 'groupTitle',
                          label: 'Group Title',
                          enabled: entryFieldOn(`skills:${cat.id}`, 'groupTitle'),
                          onToggle: (next) => setEntryFieldOn(`skills:${cat.id}`, 'groupTitle', next),
                        },
                      ]}
                    />
                  ) : null}
                  <p className="text-[8.5pt] leading-tight text-black">
                    {entryFieldOn(`skills:${cat.id}`, 'groupTitle') && inline && ctx && (cat.name.trim() !== '' || (ctx.focusedEntryId === cat.id && cat.name.trim() === 'Group Title')) ? (
                      <InlineField
                        value={cat.name.trim() === 'Group Title' ? '' : cat.name}
                        placeholder="Skill group title"
                        sectionId="skills"
                        entryId={cat.id}
                        onChange={(v) =>
                          ctx.onUpdate({
                            skills: {
                              categories: data.skills.categories.map((row) =>
                                row.id === cat.id ? { ...row, name: v } : row,
                              ),
                            },
                          })
                        }
                        className="font-extrabold text-black"
                      />
                    ) : cat.name.trim() && cat.name.trim() !== 'Group Title' ? (
                      <span className="font-extrabold">{cat.name.trim()}: </span>
                    ) : null}
                    <span className="font-normal">
                      {inline && ctx ? (
                        <InlineSkillsCommaField
                          skills={cat.skills}
                          onChange={(next) =>
                            ctx.onUpdate({
                              skills: {
                                categories: data.skills.categories.map((row) =>
                                  row.id === cat.id ? { ...row, skills: next } : row,
                                ),
                              },
                            })
                          }
                          onFocus={() => {
                            ctx.setFocusedSection('skills');
                            ctx.setFocusedEntryId(cat.id);
                            ctx.setFocusedEntrySection('skills');
                          }}
                          className="text-black"
                        />
                      ) : (
                        skillsCommaList(cat.skills)
                      )}
                    </span>
                  </p>
                </div>
              ))
            )}
          </div>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )}
      </CVSectionWrapper>
    )
    : null;

  const experienceEl = vis('experience')
    ? (
      <CVSectionWrapper sectionId="experience">
        {sectionBox(
          'experience',
          activeSection,
          'mb-3',
          <>
            {renderSectionTitle('experience', 'Work experience', () =>
              ctx?.onUpdate({ experience: { items: [] } })
            )}
            <div className="mt-1.5 space-y-2.5 text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
              {data.experience.items.length ? (
                data.experience.items.map((x, itemIdx) => (
                  <div
                    key={x.id}
                    id={`cv-preview-experience-item-${x.id}`}
                    data-entry-id={x.id}
                    className={experienceItemWrapClass(activeSection, x.id)}
                    style={{
                      outline: ctx?.focusedEntryId === x.id ? '1.5px dashed #00C9B1' : 'none',
                      outlineOffset: '3px',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx?.setFocusedSection('experience');
                      ctx?.setFocusedEntryId?.(x.id);
                      ctx?.setFocusedEntrySection?.('experience');
                    }}
                  >
                    {inline && ctx?.focusedEntryId === x.id ? (
                      <EntryToolbar
                        sectionType="experience"
                        onAddEntry={() =>
                          ctx.onUpdate({
                            experience: {
                              items: [
                                ...data.experience.items,
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
                        onAddBullet={() =>
                          ctx.onUpdate({
                            experience: {
                              items: data.experience.items.map((row) => {
                                if (row.id !== x.id) return row;
                                const base = Array.isArray(row.bullets) ? row.bullets : normalizeBullets(row.bullets as unknown as string | string[] | undefined);
                                return { ...row, bullets: [...(base.length ? base : ['']), ''] };
                              }),
                            },
                          })
                        }
                        onMoveUp={() => {
                          if (itemIdx === 0) return;
                          const next = [...data.experience.items];
                          [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                          ctx.onUpdate({ experience: { items: next } });
                        }}
                        onMoveDown={() => {
                          if (itemIdx >= data.experience.items.length - 1) return;
                          const next = [...data.experience.items];
                          [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                          ctx.onUpdate({ experience: { items: next } });
                        }}
                        onDelete={() =>
                          {
                            ctx.onUpdate({
                              experience: {
                                items: data.experience.items.filter((row) => row.id !== x.id),
                              },
                            });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }
                        }
                        onDatePick={(startDate, endDate) =>
                          ctx.onUpdate({
                            experience: {
                              items: data.experience.items.map((row) =>
                                row.id === x.id ? { ...row, startDate, endDate } : row,
                              ),
                            },
                          })
                        }
                        showMoveUp={itemIdx > 0}
                        showMoveDown={itemIdx < data.experience.items.length - 1}
                        showAddBullet
                        dateStart={x.startDate}
                        dateEnd={x.endDate}
                        showDatePicker
                        settingsOptions={[
                          {
                            key: 'title',
                            label: 'Title',
                            enabled: entryFieldOn(`experience:${x.id}`, 'title'),
                            onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'title', next),
                          },
                          {
                            key: 'company',
                            label: 'Company Name',
                            enabled: entryFieldOn(`experience:${x.id}`, 'company'),
                            onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'company', next),
                          },
                          {
                            key: 'location',
                            label: 'Location',
                            enabled: entryFieldOn(`experience:${x.id}`, 'location'),
                            onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'location', next),
                          },
                          {
                            key: 'date',
                            label: 'Date Period',
                            enabled: entryFieldOn(`experience:${x.id}`, 'date'),
                            onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'date', next),
                          },
                          {
                            key: 'bullets',
                            label: 'Bullets',
                            enabled: entryFieldOn(`experience:${x.id}`, 'bullets'),
                            onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'bullets', next),
                          },
                        ]}
                      />
                    ) : null}
                    {inline && ctx ? (
                      <>
                        <div className="flex justify-between gap-3">
                          <p className="min-w-0 leading-tight">
                            {entryFieldOn(`experience:${x.id}`, 'title') ? (
                              <InlineField
                                value={x.title}
                                placeholder="Job title"
                                sectionId="experience"
                                entryId={x.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    experience: {
                                      items: data.experience.items.map((row) =>
                                        row.id === x.id ? { ...row, title: v } : row,
                                      ),
                                    },
                                  })
                                }
                                className="font-extrabold text-black"
                              />
                            ) : null}
                            {entryFieldOn(`experience:${x.id}`, 'company') ? (
                              <>
                                <span className="font-extrabold">{' \u2013 '}</span>
                                <InlineField
                                  value={x.company}
                                  placeholder="Company"
                                  sectionId="experience"
                                  entryId={x.id}
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) =>
                                          row.id === x.id ? { ...row, company: v } : row,
                                        ),
                                      },
                                    })
                                  }
                                  className="font-extrabold text-black"
                                />
                              </>
                            ) : null}
                            {entryFieldOn(`experience:${x.id}`, 'location') ? (
                              <>
                                <span className="font-normal">{' \u2013 '}</span>
                                <InlineField
                                  value={x.location ?? ''}
                                  placeholder="Location"
                                  sectionId="experience"
                                  entryId={x.id}
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) =>
                                          row.id === x.id ? { ...row, location: v } : row,
                                        ),
                                      },
                                    })
                                  }
                                  className="font-normal italic text-black"
                                />
                              </>
                            ) : null}
                          </p>
                          {entryFieldOn(`experience:${x.id}`, 'date') ? (
                            <span className="shrink-0 whitespace-nowrap font-extrabold">
                              <InlineField
                                value={formatCvPeriodEnDash(x.startDate, x.endDate, x.current)}
                                placeholder="Dates"
                                sectionId="experience"
                                entryId={x.id}
                                onChange={(v) =>
                                  ctx.onUpdate({
                                    experience: {
                                      items: data.experience.items.map((row) =>
                                        row.id === x.id ? { ...row, startDate: v.trim(), endDate: '', current: false } : row,
                                      ),
                                    },
                                  })
                                }
                                className="font-extrabold text-black"
                              />
                            </span>
                          ) : null}
                        </div>
                        {entryFieldOn(`experience:${x.id}`, 'bullets') ? (
                        <ul className="mt-1 list-none space-y-0.5 pl-0 text-[8.5pt] leading-[1.4] text-black">
                          {(Array.isArray(x.bullets) && x.bullets.length > 0
                            ? x.bullets
                            : normalizeBullets(x.bullets as unknown as string | string[] | undefined).length
                              ? normalizeBullets(x.bullets as unknown as string | string[] | undefined)
                              : ['']
                          ).map((bullet, bulletIdx) => (
                            <li key={`${x.id}-edit-bullet-${bulletIdx}`} className="mb-0.5 flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0">•</span>
                              <span className="flex-1">
                              <InlineField
                                value={bullet}
                                layout="block"
                                placeholder="Describe your accomplishment with numbers..."
                                sectionId="experience"
                                entryId={x.id}
                                dataBulletEntry={x.id}
                                dataBulletIdx={String(bulletIdx)}
                                onChange={(v) => {
                                  const base = Array.isArray(x.bullets) ? x.bullets : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                  const nextBullets = [...(base.length ? base : [''])];
                                  nextBullets[bulletIdx] = normalizeBulletInput(v);
                                  ctx.onUpdate({
                                    experience: {
                                      items: data.experience.items.map((row) =>
                                        row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                      ),
                                    },
                                  });
                                }}
                                onInputKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const base = Array.isArray(x.bullets) ? x.bullets : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                    const nextBullets = [...(base.length ? base : [''])];
                                    nextBullets.splice(bulletIdx + 1, 0, '');
                                    ctx.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) =>
                                          row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                        ),
                                      },
                                    });
                                    setTimeout(() => {
                                      const inputs = document.querySelectorAll(
                                        `[data-bullet-entry="${x.id}"][data-bullet-idx="${String(bulletIdx + 1)}"]`,
                                      );
                                      const next = inputs[0] as HTMLElement | undefined;
                                      next?.focus();
                                    }, 50);
                                  }
                                  if (e.key === 'Backspace') {
                                    const base = Array.isArray(x.bullets) ? x.bullets : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                    if (cvBulletFieldDomIsEmpty(e) && base.length > 1) {
                                      e.preventDefault();
                                      const nextBullets = base.filter((_, bi) => bi !== bulletIdx);
                                      ctx.onUpdate({
                                        experience: {
                                          items: data.experience.items.map((row) =>
                                            row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                          ),
                                        },
                                      });
                                    }
                                  }
                                }}
                                className="text-black"
                              />
                              </span>
                              {ctx?.focusedEntryId === x.id && ctx?.focusedEntrySection === 'experience' ? (
                                <button
                                  type="button"
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    const base = Array.isArray(x.bullets) ? x.bullets : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                    if (base.length <= 1) return;
                                    const nextBullets = base.filter((_, bi) => bi !== bulletIdx);
                                    ctx.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) =>
                                          row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                        ),
                                      },
                                    });
                                  }}
                                  aria-label="Remove bullet"
                                >
                                  ×
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        ) : null}
                        <div className="group mt-2 flex justify-center">
                          <button
                            type="button"
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full bg-[#00C9B1] text-lg font-bold leading-none text-white shadow-sm hover:bg-[#009697]',
                              addButtonVisibilityClass(activeSection, 'experience'),
                            )}
                            aria-label="Add experience entry"
                            title="Add experience entry"
                            onClick={() =>
                              ctx.onUpdate({
                                experience: {
                                  items: [
                                    ...data.experience.items,
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
                            +
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between gap-3">
                          <p className="min-w-0 leading-tight">
                            <span className="font-extrabold">{x.title || 'Job title'}</span>
                            <span className="font-extrabold">{' \u2013 '}</span>
                            <span className="font-extrabold">{x.company || 'Company'}</span>
                            {x.location?.trim() ? (
                              <>
                                <span className="font-normal">{' \u2013 '}</span>
                                <span className="font-normal italic">{x.location.trim()}</span>
                              </>
                            ) : null}
                          </p>
                          <span className="shrink-0 whitespace-nowrap font-extrabold">
                            {formatCvPeriodEnDash(x.startDate, x.endDate, x.current)}
                          </span>
                        </div>
                        <ul className="mt-1 list-none space-y-0.5 pl-0 leading-[1.4]">
                          {normalizeBullets(x.bullets as unknown as string | string[] | undefined).map((b, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0">•</span>
                              <RichText text={b} />
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))
              ) : inline && ctx ? (
                <button
                  type="button"
                  className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                  onClick={() =>
                    ctx.onUpdate({
                      experience: {
                        items: [
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
                  + Click to add work experience
                </button>
              ) : (
                <p className="text-black">Add your experience in the editor.</p>
              )}
            </div>
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
          experienceOuterSectionActive,
        )}
      </CVSectionWrapper>
    )
    : null;

  const projectsEl =
    optionalSectionShown(optionalSectionPresence, 'projects', data.projects.length > 0) && vis('projects') ? (
      <CVSectionWrapper sectionId="projects">
      {sectionBox(
        'projects',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('projects', 'Projects', () =>
            ctx?.onUpdate({ projects: [] })
          )}
          <div className="mt-1.5 space-y-1.5 text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
            {(() => {
              const rows = inline && ctx
                ? data.projects
                : data.projects.filter((pr) => {
                const pAny = pr as unknown as Record<string, unknown>;
                return (
                  pr.name.trim() ||
                  Boolean(pr.description?.trim()) ||
                  Boolean(pr.url?.trim()) ||
                  projectPayloadBullets(pAny).length > 0 ||
                  projectPayloadTech(pAny).length > 0
                );
              });
              if (rows.length === 0 && inline && ctx) {
                return (
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={() =>
                      ctx.onUpdate({
                        projects: [{ id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' }],
                      })
                    }
                  >
                    + Click to add project
                  </button>
                );
              }
              return rows.map((pr, prIdx) => {
                const pAny = pr as unknown as Record<string, unknown>;
                const bLines = projectPayloadBullets(pAny);
                const rawPb =
                  typeof pr.bullets === 'string'
                    ? pr.bullets
                    : normalizeBullets(pr.bullets as unknown as string | string[] | undefined).join('\n');
                const pbLines = rawPb.split(/\r?\n/);
                const techList = projectPayloadTech(pAny);
                if (inline && ctx) {
                  return (
                    <div
                      key={pr.id}
                      data-entry-id={pr.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        ctx.setFocusedSection('projects');
                        ctx.setFocusedEntryId(pr.id);
                        ctx.setFocusedEntrySection('projects');
                      }}
                      style={{
                        outline: ctx.focusedEntryId === pr.id ? '1.5px dashed #00C9B1' : 'none',
                        outlineOffset: '3px',
                        borderRadius: '3px',
                        position: 'relative',
                      }}
                    >
                      {ctx.focusedEntryId === pr.id ? (
                        <EntryToolbar
                          sectionType="projects"
                          onAddBullet={() =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) =>
                                row.id === pr.id
                                  ? { ...row, bullets: `${row.bullets ?? ''}${(row.bullets ?? '').toString().length ? '\n' : ''}` }
                                  : row,
                              ),
                            })
                          }
                          onAddEntry={() =>
                            ctx.onUpdate({
                              projects: [...data.projects, { id: newLocalId(), name: '', description: '', technologies: [], url: '', bullets: '' }],
                            })
                          }
                          onMoveUp={() => {
                            if (prIdx === 0) return;
                            const next = [...data.projects];
                            [next[prIdx - 1], next[prIdx]] = [next[prIdx], next[prIdx - 1]];
                            ctx.onUpdate({ projects: next });
                          }}
                          onMoveDown={() => {
                            if (prIdx >= data.projects.length - 1) return;
                            const next = [...data.projects];
                            [next[prIdx], next[prIdx + 1]] = [next[prIdx + 1], next[prIdx]];
                            ctx.onUpdate({ projects: next });
                          }}
                          onDelete={() => {
                            ctx.onUpdate({ projects: data.projects.filter((row) => row.id !== pr.id) });
                            ctx.setFocusedEntryId(null);
                            ctx.setFocusedEntrySection(null);
                          }}
                          showMoveUp={prIdx > 0}
                          showMoveDown={prIdx < data.projects.length - 1}
                          showAddBullet
                          showDatePicker={false}
                          settingsOptions={[
                            {
                              key: 'description',
                              label: 'Description',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'description'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'description', next),
                            },
                            {
                              key: 'technologies',
                              label: 'Tools & keywords',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'technologies'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'technologies', next),
                            },
                            {
                              key: 'url',
                              label: 'Project link',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'url'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'url', next),
                            },
                            {
                              key: 'bullets',
                              label: 'Bullets',
                              enabled: entryFieldOn(`projects:${pr.id}`, 'bullets'),
                              onToggle: (next) => setEntryFieldOn(`projects:${pr.id}`, 'bullets', next),
                            },
                          ]}
                        />
                      ) : null}
                      <p className="font-extrabold">
                        <InlineField
                          value={pr.name || ''}
                          placeholder="Project name"
                          sectionId="projects"
                          entryId={pr.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) => (row.id === pr.id ? { ...row, name: v } : row)),
                            })
                          }
                          className="font-extrabold text-black"
                        />
                      </p>
                      {entryFieldOn(`projects:${pr.id}`, 'description') ? (
                      <div className="mt-0.5">
                        <InlineField
                          multiline
                          layout="block"
                          value={pr.description ?? ''}
                          placeholder="Project description"
                          sectionId="projects"
                          entryId={pr.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) => (row.id === pr.id ? { ...row, description: v } : row)),
                            })
                          }
                          className="text-black"
                        />
                      </div>
                      ) : null}
                      {entryFieldOn(`projects:${pr.id}`, 'technologies') ? (
                      <p className="mt-0.5 font-normal">
                        <InlineField
                          value={projectPayloadTech(pAny).join(', ')}
                          placeholder="Tools, software, methods (comma-separated)"
                          sectionId="projects"
                          entryId={pr.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) =>
                                row.id === pr.id
                                  ? { ...row, technologies: v.split(',').map((t) => t.trim()).filter(Boolean) }
                                  : row,
                              ),
                            })
                          }
                          className="text-black"
                        />
                      </p>
                      ) : null}
                      {entryFieldOn(`projects:${pr.id}`, 'url') ? (
                      <p className="mt-0.5 font-normal">
                        <InlineField
                          value={pr.url}
                          placeholder="Project URL"
                          sectionId="projects"
                          entryId={pr.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) => (row.id === pr.id ? { ...row, url: v } : row)),
                            })
                          }
                          className="text-black"
                        />
                      </p>
                      ) : null}
                      {entryFieldOn(`projects:${pr.id}`, 'bullets') ? (
                      <ul className="mt-1 list-none space-y-0.5 pl-0 text-[8.5pt] leading-[1.35] text-black">
                        {(pbLines.length > 0 ? pbLines : ['']).map((b, bIdx) => (
                          <li key={`${pr.id}-bullet-${bIdx}`} className="flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0">•</span>
                            <span className="flex-1">
                              <InlineField
                                value={b}
                                layout="block"
                                placeholder="Project bullet"
                                sectionId="projects"
                                entryId={pr.id}
                                dataBulletIdx={String(bIdx)}
                                onChange={(v) => {
                                  const arr = rawPb.split(/\r?\n/);
                                  const next = [...(arr.length ? arr : [''])];
                                  next[bIdx] = normalizeBulletInput(v);
                                  ctx.onUpdate({
                                    projects: data.projects.map((row) => (row.id === pr.id ? { ...row, bullets: next.join('\n') } : row)),
                                  });
                                }}
                                onInputKeyDown={(e) => {
                                  const arr = rawPb.split(/\r?\n/);
                                  const next = [...(arr.length ? arr : [''])];
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    next.splice(bIdx + 1, 0, '');
                                    ctx.onUpdate({
                                      projects: data.projects.map((row) => (row.id === pr.id ? { ...row, bullets: next.join('\n') } : row)),
                                    });
                                  }
                                  if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && next.length > 1) {
                                    e.preventDefault();
                                    const filtered = next.filter((_, i) => i !== bIdx);
                                    ctx.onUpdate({
                                      projects: data.projects.map((row) => (row.id === pr.id ? { ...row, bullets: filtered.join('\n') } : row)),
                                    });
                                  }
                                }}
                                className="text-black"
                              />
                            </span>
                            {ctx?.focusedEntryId === pr.id && ctx?.focusedEntrySection === 'projects' ? (
                              <button
                                type="button"
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  const arr = rawPb.split(/\r?\n/);
                                  if (arr.length <= 1) return;
                                  const next = arr.filter((_, i) => i !== bIdx);
                                  ctx.onUpdate({
                                    projects: data.projects.map((row) => (row.id === pr.id ? { ...row, bullets: next.join('\n') } : row)),
                                  });
                                }}
                                aria-label="Remove bullet"
                              >
                                ×
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <div key={pr.id}>
                    <p className="font-extrabold">{stripHtmlTags(pr.name || '') || 'Project'}</p>
                    {pr.description?.trim() ? (
                      <p className="mt-0.5 font-normal leading-snug">
                        <RichText text={pr.description} />
                      </p>
                    ) : null}
                    {techList.length ? <p className="mt-0.5 font-normal">{techList.join(', ')}</p> : null}
                    {pr.url?.trim() ? (
                      <p className="mt-0.5 font-normal">
                        <a
                          href={pr.url.trim().startsWith('http') ? pr.url.trim() : `https://${pr.url.trim()}`}
                          className="text-[#0000EE] underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {pr.url.trim()}
                        </a>
                      </p>
                    ) : null}
                    {bLines.length ? (
                      <ul className="mt-1 list-disc list-outside pl-4 leading-snug marker:text-[8pt]">
                        {bLines.map((b, i) => (
                          <li key={i}>
                            <RichText text={b} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              });
            })()}
          </div>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )}
      </CVSectionWrapper>
    ) : null;

  const certificationsEl =
    optionalSectionShown(optionalSectionPresence, 'certifications', data.certifications.length > 0) && vis('certifications') ? (
      <CVSectionWrapper sectionId="certifications">
      {sectionBox(
        'certifications',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('certifications', 'Certifications', () =>
            ctx?.onUpdate({ certifications: [] })
          )}
          <div className="mt-1.5 space-y-1.5 text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
            {(() => {
              const rows = inline && ctx
                ? data.certifications
                : data.certifications.filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim());
              if (rows.length === 0 && inline && ctx) {
                return (
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={() =>
                      ctx.onUpdate({
                        certifications: [{ id: newLocalId(), name: '', issuer: '', date: '', url: '' }],
                      })
                    }
                  >
                    + Click to add certification
                  </button>
                );
              }
              return rows.map((c, cIdx) => (
                <div
                  key={c.id}
                  data-entry-id={c.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    ctx?.setFocusedSection('certifications');
                    ctx?.setFocusedEntryId(c.id);
                    ctx?.setFocusedEntrySection('certifications');
                  }}
                  style={{
                    outline: ctx?.focusedEntryId === c.id ? '1.5px dashed #00C9B1' : 'none',
                    outlineOffset: '3px',
                    borderRadius: '3px',
                    position: 'relative',
                  }}
                >
                  {inline && ctx?.focusedEntryId === c.id ? (
                    <EntryToolbar
                      sectionType="certifications"
                      onAddEntry={() =>
                        ctx.onUpdate({
                          certifications: [...data.certifications, { id: newLocalId(), name: '', issuer: '', date: '', url: '' }],
                        })
                      }
                      onMoveUp={() => {
                        if (cIdx === 0) return;
                        const next = [...data.certifications];
                        [next[cIdx - 1], next[cIdx]] = [next[cIdx], next[cIdx - 1]];
                        ctx.onUpdate({ certifications: next });
                      }}
                      onMoveDown={() => {
                        if (cIdx >= data.certifications.length - 1) return;
                        const next = [...data.certifications];
                        [next[cIdx], next[cIdx + 1]] = [next[cIdx + 1], next[cIdx]];
                        ctx.onUpdate({ certifications: next });
                      }}
                      onDelete={() => {
                        ctx.onUpdate({ certifications: data.certifications.filter((row) => row.id !== c.id) });
                        ctx.setFocusedEntryId(null);
                        ctx.setFocusedEntrySection(null);
                      }}
                      onDatePick={(startDate) =>
                        ctx.onUpdate({
                          certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, date: startDate } : row)),
                        })
                      }
                      dateMode="single"
                      dateStart={c.date}
                      dateEnd=""
                      showMoveUp={cIdx > 0}
                      showMoveDown={cIdx < data.certifications.length - 1}
                      showDatePicker
                      settingsOptions={[
                        {
                          key: 'issuer',
                          label: 'Issuer',
                          enabled: entryFieldOn(`certifications:${c.id}`, 'issuer'),
                          onToggle: (next) => setEntryFieldOn(`certifications:${c.id}`, 'issuer', next),
                        },
                        {
                          key: 'date',
                          label: 'Date',
                          enabled: entryFieldOn(`certifications:${c.id}`, 'date'),
                          onToggle: (next) => setEntryFieldOn(`certifications:${c.id}`, 'date', next),
                        },
                        {
                          key: 'url',
                          label: 'Credential URL',
                          enabled: entryFieldOn(`certifications:${c.id}`, 'url'),
                          onToggle: (next) => setEntryFieldOn(`certifications:${c.id}`, 'url', next),
                        },
                      ]}
                    />
                  ) : null}
                  <p className="mt-0.5 font-normal">
                    {inline && ctx ? (
                      <span>
                        <InlineField
                          value={c.name}
                          placeholder="Certification"
                          sectionId="certifications"
                          entryId={c.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, name: v } : row)),
                            })
                          }
                          className="font-extrabold text-black"
                        />
                        {entryFieldOn(`certifications:${c.id}`, 'issuer') ? (
                          <>
                            <span> · </span>
                            <InlineField
                              value={c.issuer}
                              placeholder="Issuer"
                              sectionId="certifications"
                              entryId={c.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, issuer: v } : row)),
                                })
                              }
                              className="text-black"
                            />
                          </>
                        ) : null}
                        {entryFieldOn(`certifications:${c.id}`, 'date') ? (
                          <>
                            <span> · </span>
                            <InlineField
                              value={c.date}
                              placeholder="Date"
                              sectionId="certifications"
                              entryId={c.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, date: v } : row)),
                                })
                              }
                              className="text-black"
                            />
                          </>
                        ) : null}
                        {entryFieldOn(`certifications:${c.id}`, 'url') ? (
                          <>
                            <span> · </span>
                            <InlineField
                              value={c.url}
                              placeholder="URL"
                              sectionId="certifications"
                              entryId={c.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, url: v } : row)),
                                })
                              }
                              className="text-black"
                            />
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <span>
                        {c.url.trim() ? (
                          <a
                            href={c.url.trim().startsWith('http') ? c.url.trim() : `https://${c.url.trim()}`}
                            className="font-extrabold text-[#0000EE] underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {c.name || 'Certification'}
                          </a>
                        ) : (
                          <span className="font-extrabold">{c.name || 'Certification'}</span>
                        )}
                        {c.issuer.trim() ? <span> · {c.issuer.trim()}</span> : null}
                        {c.date.trim() ? <span> · {c.date.trim()}</span> : null}
                      </span>
                    )}
                  </p>
                </div>
              ));
            })()}
          </div>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )}
      </CVSectionWrapper>
    ) : null;

  const languagesEl =
    optionalSectionShown(optionalSectionPresence, 'languages', data.languages.length > 0) && vis('languages') ? (
      <CVSectionWrapper sectionId="languages">
      {sectionBox(
        'languages',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('languages', 'Languages', () =>
            ctx?.onUpdate({ languages: [] })
          )}
          <ul className="mt-1.5 list-disc list-outside space-y-0.5 pl-4 text-[8.5pt] leading-tight marker:text-[8pt]" style={{ fontFamily: professionalFont }}>
            {data.languages.length === 0 && inline && ctx ? (
              <li className="list-none pl-0">
                <button
                  type="button"
                  className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                  onClick={() =>
                    ctx.onUpdate({
                      languages: [{ id: newLocalId(), language: '', proficiency: '' }],
                    })
                  }
                >
                  + Click to add language
                </button>
              </li>
            ) : (
              data.languages.map((l, lIdx) => (
                <li
                  key={l.id}
                  data-entry-id={l.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    ctx?.setFocusedSection('languages');
                    ctx?.setFocusedEntryId(l.id);
                    ctx?.setFocusedEntrySection('languages');
                  }}
                  style={{
                    outline: ctx?.focusedEntryId === l.id ? '1.5px dashed #00C9B1' : 'none',
                    outlineOffset: '3px',
                    borderRadius: '3px',
                    position: 'relative',
                  }}
                >
                  {inline && ctx?.focusedEntryId === l.id ? (
                    <EntryToolbar
                      sectionType="languages"
                      onAddEntry={() =>
                        ctx.onUpdate({
                          languages: [...data.languages, { id: newLocalId(), language: '', proficiency: '' }],
                        })
                      }
                      onMoveUp={() => {
                        if (lIdx === 0) return;
                        const next = [...data.languages];
                        [next[lIdx - 1], next[lIdx]] = [next[lIdx], next[lIdx - 1]];
                        ctx.onUpdate({ languages: next });
                      }}
                      onMoveDown={() => {
                        if (lIdx >= data.languages.length - 1) return;
                        const next = [...data.languages];
                        [next[lIdx], next[lIdx + 1]] = [next[lIdx + 1], next[lIdx]];
                        ctx.onUpdate({ languages: next });
                      }}
                      onDelete={() => {
                        ctx.onUpdate({ languages: data.languages.filter((row) => row.id !== l.id) });
                        ctx.setFocusedEntryId(null);
                        ctx.setFocusedEntrySection(null);
                      }}
                      showMoveUp={lIdx > 0}
                      showMoveDown={lIdx < data.languages.length - 1}
                      showDatePicker={false}
                      settingsOptions={[
                        {
                          key: 'level',
                          label: 'Proficiency',
                          enabled: entryFieldOn(`languages:${l.id}`, 'level'),
                          onToggle: (next) => setEntryFieldOn(`languages:${l.id}`, 'level', next),
                        },
                      ]}
                    />
                  ) : null}
                  {inline && ctx ? (
                    <>
                      <InlineField
                        value={l.language}
                        placeholder="Language"
                        sectionId="languages"
                        entryId={l.id}
                        onChange={(v) =>
                          ctx.onUpdate({
                            languages: data.languages.map((row) => (row.id === l.id ? { ...row, language: v } : row)),
                          })
                        }
                        className="font-extrabold text-black"
                      />
                      {entryFieldOn(`languages:${l.id}`, 'level') ? (
                        <>
                          <span> — </span>
                          <InlineField
                            value={l.proficiency ?? ''}
                            placeholder="e.g. Fluent, Intermediate"
                            sectionId="languages"
                            entryId={l.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                languages: data.languages.map((row) => (row.id === l.id ? { ...row, proficiency: v as CVBuilderLanguage['proficiency'] } : row)),
                              })
                            }
                            className="text-black"
                          />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="font-extrabold">{l.language.trim() || 'Language'}</span>
                      {l.proficiency?.trim() ? <span className="font-normal"> — {l.proficiency.trim()}</span> : null}
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )}
      </CVSectionWrapper>
    ) : null;

  const referencesEl =
    optionalSectionShown(
      optionalSectionPresence,
      'references',
      filterCvBuilderReferences(data.references).length > 0 || Boolean(inline && ctx),
    ) && vis('references') ? (
      <CVSectionWrapper sectionId="references">
      {sectionBox(
        'references',
        activeSection,
        'mb-3',
        <>
          {renderSectionTitle('references', 'References', () =>
            ctx?.onUpdate({ references: [] })
          )}
          <CvEditableReferencesList
            references={data.references}
            layout="compact"
            textClassName="text-[8.5pt] leading-tight text-black"
            className="leading-tight"
          />
        </>,
        diffSection,
        diffChangedFields,
        onAcceptDiff,
        onRejectDiff,
      )}
      </CVSectionWrapper>
    ) : null;

  const summaryEl =
    vis('summary') && (inline || data.summary.text.trim()) ? (
      <CVSectionWrapper sectionId="summary">
        {sectionBox(
          'summary',
          activeSection,
          'mb-3',
          <>
            {renderSectionTitle('summary', 'Professional summary', () =>
              ctx?.onUpdate({ summary: { text: '' } })
            )}
            <div className="mt-1.5 text-left text-justify text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
              {inline && ctx ? (
                <div
                  data-entry-id="summary-body"
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.setFocusedSection('summary');
                    ctx.setFocusedEntryId('summary-body');
                    ctx.setFocusedEntrySection('summary');
                  }}
                  style={{
                    outline: ctx.focusedEntryId === 'summary-body' ? '1.5px dashed #00C9B1' : 'none',
                    outlineOffset: '3px',
                    borderRadius: '3px',
                    position: 'relative',
                  }}
                >
                  {ctx.focusedEntryId === 'summary-body' ? (
                    <EntryToolbar
                      sectionType="summary"
                      onAddEntry={() => {}}
                      onMoveUp={() => {}}
                      onMoveDown={() => {}}
                      onDelete={() => {
                        ctx.onUpdate({ summary: { text: '' } });
                        ctx.setFocusedEntryId(null);
                        ctx.setFocusedEntrySection(null);
                      }}
                      showMoveUp={false}
                      showMoveDown={false}
                      showDatePicker={false}
                      hideAddButton
                    />
                  ) : null}
                  <InlineField
                    multiline
                    layout="block"
                    sectionId="summary"
                    entryId="summary-body"
                    value={data.summary.text}
                    placeholder="Professional summary"
                    onChange={(v) => ctx.onUpdate({ summary: { text: v } })}
                    className="text-justify text-[8.5pt] leading-tight text-black"
                  />
                </div>
              ) : (
                <RichText text={data.summary.text} />
              )}
            </div>
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
        )}
      </CVSectionWrapper>
    ) : null;

  const parsedByKey: Record<string, ReactNode> = {};
  const parsedEls = filterParsedCustomSectionsForEditor(data.parsedCustomSections).map((block) => {
    const node =
      block.title.trim() || block.items.some((i) => i.text.trim() || i.subItems.length) ? (
      <Fragment key={block.sectionId}>
        {vis(`parsed-${block.sectionId}`) ? (
          <CVSectionWrapper sectionId={`parsed-${block.sectionId}`}>
            {sectionBox(
              `parsed-${block.sectionId}`,
              activeSection,
              'mb-3',
              <>
              {renderSectionTitle(`parsed-${block.sectionId}`, block.title.trim() || 'Additional', () =>
                ctx?.onUpdate({
                  parsedCustomSections: data.parsedCustomSections.filter((b) => b.sectionId !== block.sectionId),
                })
              )}
              <div className="mt-1.5 space-y-1.5 text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
                {block.items.length === 0 && inline && ctx ? (
                  <button
                    type="button"
                    className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
                    onClick={() =>
                      ctx.onUpdate({
                        parsedCustomSections: data.parsedCustomSections.map((b) =>
                          b.sectionId === block.sectionId
                            ? { ...b, items: [{ id: newLocalId(), text: '', date: '', subItems: [] }] }
                            : b,
                        ),
                      })
                    }
                  >
                    + Click to add item
                  </button>
                ) : null}
                {block.items.map((item, itemIdx) => {
                  const usesRangeDates = /volunteer|experience|employment|work|project/i.test(block.sectionType);
                  return (
                  <div
                    key={item.id}
                    data-entry-id={item.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      ctx?.setFocusedSection(`parsed-${block.sectionId}`);
                      ctx?.setFocusedEntryId(item.id);
                      ctx?.setFocusedEntrySection(`parsed-${block.sectionId}`);
                    }}
                    style={{
                      outline: ctx?.focusedEntryId === item.id ? '1.5px dashed #00C9B1' : 'none',
                      outlineOffset: '3px',
                      borderRadius: '3px',
                      position: 'relative',
                    }}
                  >
                    {inline && ctx?.focusedEntryId === item.id ? (
                      <EntryToolbar
                        sectionType={block.sectionType}
                        onAddBullet={() =>
                          ctx.onUpdate({
                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                              b.sectionId === block.sectionId
                                ? {
                                    ...b,
                                    items: b.items.map((it) =>
                                      it.id === item.id ? { ...it, subItems: [...(it.subItems.length ? it.subItems : ['']), ''] } : it,
                                    ),
                                  }
                                : b,
                            ),
                          })
                        }
                        onAddEntry={() =>
                          ctx.onUpdate({
                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                              b.sectionId === block.sectionId
                                ? { ...b, items: [...b.items, { id: newLocalId(), text: '', date: '', subItems: [] }] }
                                : b,
                            ),
                          })
                        }
                        onMoveUp={() => {
                          if (itemIdx === 0) return;
                          ctx.onUpdate({
                            parsedCustomSections: data.parsedCustomSections.map((b) => {
                              if (b.sectionId !== block.sectionId) return b;
                              const next = [...b.items];
                              [next[itemIdx - 1], next[itemIdx]] = [next[itemIdx], next[itemIdx - 1]];
                              return { ...b, items: next };
                            }),
                          });
                        }}
                        onMoveDown={() => {
                          if (itemIdx >= block.items.length - 1) return;
                          ctx.onUpdate({
                            parsedCustomSections: data.parsedCustomSections.map((b) => {
                              if (b.sectionId !== block.sectionId) return b;
                              const next = [...b.items];
                              [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                              return { ...b, items: next };
                            }),
                          });
                        }}
                        onDelete={() => {
                          ctx.onUpdate({
                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                              b.sectionId === block.sectionId
                                ? { ...b, items: b.items.filter((it) => it.id !== item.id) }
                                : b,
                            ),
                          });
                          ctx.setFocusedEntryId(null);
                          ctx.setFocusedEntrySection(null);
                        }}
                        onDatePick={(startDate, endDate) =>
                          ctx.onUpdate({
                            parsedCustomSections: data.parsedCustomSections.map((b) =>
                              b.sectionId === block.sectionId
                                ? {
                                    ...b,
                                    items: b.items.map((it) => {
                                      if (it.id !== item.id) return it;
                                      return { ...it, date: usesRangeDates ? [startDate, endDate].filter(Boolean).join(' - ') : startDate };
                                    }),
                                  }
                                : b,
                            ),
                          })
                        }
                        dateMode={usesRangeDates ? 'range' : 'single'}
                        dateStart={splitCvStoredRange(item.date ?? '').start}
                        dateEnd={splitCvStoredRange(item.date ?? '').end}
                        showMoveUp={itemIdx > 0}
                        showMoveDown={itemIdx < block.items.length - 1}
                        showAddBullet
                        showDatePicker
                        settingsOptions={[
                          {
                            key: 'date',
                            label: 'Date',
                            enabled: entryFieldOn(`parsed:${item.id}`, 'date'),
                            onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'date', next),
                          },
                          {
                            key: 'bullets',
                            label: 'Bullets',
                            enabled: entryFieldOn(`parsed:${item.id}`, 'bullets'),
                            onToggle: (next) => setEntryFieldOn(`parsed:${item.id}`, 'bullets', next),
                          },
                        ]}
                      />
                    ) : null}
                    {inline && ctx ? (
                      <>
                        <p className="font-extrabold">
                          <InlineField
                            value={item.text}
                            placeholder="Item title"
                            sectionId={`parsed-${block.sectionId}`}
                            entryId={item.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                parsedCustomSections: data.parsedCustomSections.map((b) =>
                                  b.sectionId === block.sectionId
                                    ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, text: v } : it)) }
                                    : b,
                                ),
                              })
                            }
                            className="font-extrabold text-black"
                          />
                          <span className="font-normal"> </span>
                          {entryFieldOn(`parsed:${item.id}`, 'date') ? (
                            <InlineField
                              value={item.date ?? ''}
                              placeholder={usesRangeDates ? 'Date range (From - To)' : 'Date'}
                              sectionId={`parsed-${block.sectionId}`}
                              entryId={item.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  parsedCustomSections: data.parsedCustomSections.map((b) =>
                                    b.sectionId === block.sectionId
                                      ? { ...b, items: b.items.map((it) => (it.id === item.id ? { ...it, date: v } : it)) }
                                      : b,
                                  ),
                                })
                              }
                              className="text-black"
                            />
                          ) : null}
                        </p>
                        {entryFieldOn(`parsed:${item.id}`, 'bullets') ? (
                        <ul className="mt-1 list-none space-y-0.5 pl-0 text-[8.5pt] leading-[1.35] text-black">
                          {((item.subItems.length > 0 ? item.subItems : [''])).map((line, lineIdx) => (
                            <li key={`${item.id}-sub-${lineIdx}`} className="flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0">•</span>
                              <span className="flex-1">
                                <InlineField
                                  value={line}
                                  layout="block"
                                  placeholder="Detail bullet"
                                  sectionId={`parsed-${block.sectionId}`}
                                  entryId={item.id}
                                  dataBulletIdx={item.id}
                                  onChange={(v) =>
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId
                                          ? {
                                              ...b,
                                              items: b.items.map((it) => {
                                                if (it.id !== item.id) return it;
                                                const next = [...(it.subItems.length ? it.subItems : [''])];
                                                next[lineIdx] = normalizeBulletInput(v);
                                                return { ...it, subItems: next };
                                              }),
                                            }
                                          : b,
                                      ),
                                    })
                                  }
                                  onInputKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      ctx.onUpdate({
                                        parsedCustomSections: data.parsedCustomSections.map((b) =>
                                          b.sectionId === block.sectionId
                                            ? {
                                                ...b,
                                                items: b.items.map((it) => {
                                                  if (it.id !== item.id) return it;
                                                  const next = [...(it.subItems.length ? it.subItems : [''])];
                                                  next.splice(lineIdx + 1, 0, '');
                                                  return { ...it, subItems: next };
                                                }),
                                              }
                                            : b,
                                        ),
                                      });
                                    }
                                    if (e.key === 'Backspace' && cvBulletFieldDomIsEmpty(e) && (item.subItems.length || 1) > 1) {
                                      e.preventDefault();
                                      ctx.onUpdate({
                                        parsedCustomSections: data.parsedCustomSections.map((b) =>
                                          b.sectionId === block.sectionId
                                            ? {
                                                ...b,
                                                items: b.items.map((it) =>
                                                  it.id === item.id
                                                    ? { ...it, subItems: (it.subItems.length ? it.subItems : ['']).filter((_, i) => i !== lineIdx) }
                                                    : it,
                                                ),
                                              }
                                            : b,
                                        ),
                                      });
                                    }
                                  }}
                                  className="text-black"
                                />
                              </span>
                              {ctx?.focusedEntryId === item.id && ctx?.focusedEntrySection === `parsed-${block.sectionId}` ? (
                                <button
                                  type="button"
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-red-500/80 text-[9px] leading-none text-white hover:bg-red-500"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    const current = item.subItems.length ? item.subItems : [''];
                                    if (current.length <= 1) return;
                                    ctx.onUpdate({
                                      parsedCustomSections: data.parsedCustomSections.map((b) =>
                                        b.sectionId === block.sectionId
                                          ? {
                                              ...b,
                                              items: b.items.map((it) =>
                                                it.id === item.id
                                                  ? { ...it, subItems: current.filter((_, i) => i !== lineIdx) }
                                                  : it,
                                              ),
                                            }
                                          : b,
                                      ),
                                    });
                                  }}
                                  aria-label="Remove bullet"
                                >
                                  ×
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="font-extrabold">
                          <RichText text={item.text} />
                          {item.date?.trim() ? <span className="font-normal"> ({item.date.trim()})</span> : null}
                        </p>
                        {item.subItems.length > 0 ? (
                          <ul className="mt-1 list-disc list-outside pl-4 leading-snug marker:text-[8pt]">
                            {item.subItems.map((line, i) => (
                              <li key={i}><RichText text={line} /></li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
            </>,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
          )}
          </CVSectionWrapper>
        ) : null}
      </Fragment>
    ) : null;
    if (node) parsedByKey[`parsed-${block.sectionId}`] = node;
    return node;
  });

  const customEl =
    shouldRenderCustomLegacySection(data, inline) && vis('custom-legacy') ? (
      <CVSectionWrapper sectionId="custom-legacy">
        {sectionBox(
          'custom-legacy',
          activeSection,
          'mb-3',
          <>
          {inline && ctx && data.customSections.length === 0 ? (
            <button
              type="button"
              className="text-xs italic text-gray-400 hover:text-[#00C9B1] hover:underline"
              onClick={() =>
                ctx.onUpdate({
                  customSections: [{ id: newLocalId(), title: '', body: '' }],
                })
              }
            >
              + Click to add section
            </button>
          ) : null}
          {data.customSections
            .filter((x) => x.title.trim() || x.body.trim())
            .map((x, xIdx) => (
              <div key={x.id} className="mb-3 last:mb-0">
                {inline && ctx ? (
                  <EntryToolbar
                    sectionType="custom"
                    onAddEntry={() =>
                      ctx.onUpdate({
                        customSections: [...data.customSections, { id: newLocalId(), title: '', body: '' }],
                      })
                    }
                    onMoveUp={() => {
                      if (xIdx === 0) return;
                      const next = [...data.customSections];
                      [next[xIdx - 1], next[xIdx]] = [next[xIdx], next[xIdx - 1]];
                      ctx.onUpdate({ customSections: next });
                    }}
                    onMoveDown={() => {
                      if (xIdx >= data.customSections.length - 1) return;
                      const next = [...data.customSections];
                      [next[xIdx], next[xIdx + 1]] = [next[xIdx + 1], next[xIdx]];
                      ctx.onUpdate({ customSections: next });
                    }}
                    onDelete={() => ctx.onUpdate({ customSections: data.customSections.filter((row) => row.id !== x.id) })}
                    showMoveUp={xIdx > 0}
                    showMoveDown={xIdx < data.customSections.length - 1}
                    showDatePicker={false}
                  />
                ) : null}
                <div className="mb-0.5">
                  <h2 className="text-left text-[8.5pt] font-extrabold uppercase tracking-[0.04em] text-black antialiased">
                    {x.title.trim() || 'Additional'}
                  </h2>
                  <div className="mt-0.5 h-[3px] w-full bg-black" />
                </div>
                {inline && ctx ? (
                  <div className="mt-1.5 space-y-1">
                    <InlineField
                      value={x.title}
                      placeholder="Section title"
                      onChange={(v) =>
                        ctx.onUpdate({
                          customSections: data.customSections.map((row) => (row.id === x.id ? { ...row, title: v } : row)),
                        })
                      }
                      className="font-bold text-black"
                    />
                    <InlineField
                      multiline
                      layout="block"
                      value={x.body}
                      placeholder="Section body"
                      onChange={(v) =>
                        ctx.onUpdate({
                          customSections: data.customSections.map((row) => (row.id === x.id ? { ...row, body: v } : row)),
                        })
                      }
                      className="text-[8.5pt] leading-tight text-black"
                    />
                  </div>
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap text-[8.5pt] leading-tight text-black" style={{ fontFamily: professionalFont }}>
                    <RichText text={x.body.trim()} />
                  </p>
                )}
              </div>
            ))}
          </>,
          diffSection,
          diffChangedFields,
          onAcceptDiff,
          onRejectDiff,
        )}
      </CVSectionWrapper>
    ) : null;

  const personalInner = (
    <div className="text-center text-black" style={{ fontFamily: professionalFont }}>
      {hp.showTitle ? (
        <h1 className="text-[14pt] font-extrabold uppercase leading-[1] tracking-[0.03em] text-black">
          {inline && ctx ? (
            <InlineField
              value={p.name}
              placeholder="Your Name"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, name: v } })}
              className={cn(
                'text-[14pt] font-extrabold leading-[1] tracking-[0.03em] text-black',
                hp.uppercaseName && 'uppercase',
              )}
            />
          ) : (
            displayName
          )}
        </h1>
      ) : null}
      {inline && ctx && hp.showHeadline ? (
        <p className="mt-0.5 text-[8.5pt] font-normal leading-[1.15] text-black">
          <InlineField
            value={p.headline}
            placeholder="Professional headline"
            onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, headline: v } })}
            className="text-[8.5pt] text-black"
          />
        </p>
      ) : !inline && hp.showHeadline && p.headline?.trim() ? (
        <p className="mt-0.5 text-[8.5pt] font-normal leading-[1.15] text-black">{p.headline.trim()}</p>
      ) : null}
      <p
        className={cn(
          'text-[8.5pt] font-normal leading-[1.15] text-black',
          p.headline?.trim() || (inline && ctx && hp.showHeadline) ? 'mt-0.5' : 'mt-1',
        )}
      >
        {inline && ctx && hp.showPhone ? (
          <InlineField
            value={p.phone ?? ''}
            placeholder="Your phone number"
            onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, phone: v } })}
            className="text-[8.5pt] text-black"
          />
        ) : phoneStr ? (
          phoneStr
        ) : (
          <span className="text-black">Your phone number</span>
        )}
      </p>
      <p className="mt-0.5 text-[8.5pt] font-normal leading-[1.15] text-black">
        {inline && ctx && hp.showEmail ? (
          <InlineField
            value={p.email}
            placeholder="your.email@example.com"
            onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, email: v } })}
            className="text-[8.5pt] text-black"
          />
        ) : emailStr ? (
          <a href={`mailto:${emailStr}`} className="text-[#0000EE] underline">
            {emailStr}
          </a>
        ) : (
          <span className="text-black">your.email@example.com</span>
        )}
      </p>
      {hp.showLocation ? (
        <p className="mt-0.5 text-[8.5pt] font-normal leading-[1.15] text-black">
          {inline && ctx ? (
            <InlineField
              value={p.location ?? ''}
              placeholder="City, Country"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, location: v } })}
              className="text-[8.5pt] text-black"
            />
          ) : p.location?.trim() ? (
            p.location.trim()
          ) : (
            <span className="text-black/45">City, Country</span>
          )}
        </p>
      ) : null}
      {inline && ctx ? (
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-[8.5pt] font-normal leading-[1.15]">
          {hp.showLinkedIn ? (
            <InlineField
              value={p.linkedin ?? ''}
              placeholder="LinkedIn"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, linkedin: v } })}
              className="text-[8.5pt] text-black"
            />
          ) : null}
          {hp.showLinkedIn && hp.showGithub ? <span className="text-black">|</span> : null}
          {hp.showGithub ? (
            <InlineField
              value={p.github ?? ''}
              placeholder="GitHub"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, github: v } })}
              className="text-[8.5pt] text-black"
            />
          ) : null}
          {(hp.showLinkedIn || hp.showGithub) && hp.showWebsiteToggle ? <span className="text-black">|</span> : null}
          {hp.showWebsiteToggle ? (
            <InlineField
              value={p.website ?? ''}
              placeholder="Website"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, website: v } })}
              className="text-[8.5pt] text-black"
            />
          ) : null}
          {(hp.showLinkedIn || hp.showGithub || hp.showWebsiteToggle) && hp.showPortfolioToggle ? (
            <span className="text-black">|</span>
          ) : null}
          {hp.showPortfolioToggle ? (
            <InlineField
              value={p.portfolio ?? ''}
              placeholder="Portfolio"
              onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, portfolio: v } })}
              className="text-[8.5pt] text-black"
            />
          ) : null}
        </p>
      ) : headerLinks.length > 0 ? (
        <p className="mt-1 text-[8.5pt] font-normal leading-[1.15]">
          {headerLinks.map((link, i) => (
            <Fragment key={`header-link-${i}-${normalizePersonalUrlKey(link.href)}`}>
              {i > 0 ? <span className="text-black">{' | '}</span> : null}
              <a href={link.href} className="text-[#0000EE] underline" target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </Fragment>
          ))}
        </p>
      ) : null}
      {hp.extraField
        ? p.extras.filter((x) => x.label.trim() || x.value.trim()).map((x, i) => (
            <p key={`pex-${i}`} className="mt-0.5 text-[8.5pt] leading-tight">
              {x.label.trim() ? <span className="font-extrabold">{x.label.trim()}: </span> : null}
              <span className="text-black">{x.value.trim() || '—'}</span>
            </p>
          ))
        : null}
    </div>
  );

  return (
    <div
      className="box-border mx-auto min-w-0 w-full max-w-[800px] bg-white px-[30px] pb-7 pt-0 text-[8.5pt] leading-[1.25] text-black antialiased"
      style={{ fontFamily: professionalFont }}
    >
      {vis('personal') ? (
        <CVSectionWrapper sectionId="personal" className="relative">
          <HeaderFloatingControls />
          {sectionBox(
            'personal',
            activeSection,
            'mb-2 pt-0 text-center',
            personalInner,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
          )}
        </CVSectionWrapper>
      ) : null}

      <div className="text-left" style={{ fontFamily: professionalFont }}>
        {sectionOrder && sectionOrder.length > 0
          ? sectionOrder.map((id) => {
              let node: ReactNode = null;
              if (id === 'education') node = educationEl;
              else if (id === 'achievements') node = achievementsEl;
              else if (id === 'skills') node = skillsEl;
              else if (id === 'experience') node = experienceEl;
              else if (id === 'summary') node = summaryEl;
              else if (id === 'projects') node = projectsEl;
              else if (id === 'certifications') node = certificationsEl;
              else if (id === 'languages') node = languagesEl;
              else if (id === 'references') node = referencesEl;
              else if (id === 'custom-legacy') node = customEl;
              else if (id.startsWith('parsed-')) node = parsedByKey[id] ?? null;
              return node ? <Fragment key={`professional-section-${id}`}>{node}</Fragment> : null;
            })
          : (
              <>
                {(
                  [
                    'education',
                    'achievements',
                    'skills',
                    'experience',
                    'summary',
                    'projects',
                    'certifications',
                    'languages',
                  ] as const
                ).map((id) => {
                  let node: ReactNode = null;
                  if (id === 'education') node = educationEl;
                  else if (id === 'achievements') node = achievementsEl;
                  else if (id === 'skills') node = skillsEl;
                  else if (id === 'experience') node = experienceEl;
                  else if (id === 'summary') node = summaryEl;
                  else if (id === 'projects') node = projectsEl;
                  else if (id === 'certifications') node = certificationsEl;
                  else if (id === 'languages') node = languagesEl;
                  else if (id === 'references') node = referencesEl;
                  return node ? <Fragment key={`professional-section-${id}`}>{node}</Fragment> : null;
                })}
                {parsedEls}
                {customEl}
              </>
            )}
      </div>
      <CvPreviewWatermarkFooter />
    </div>
  );
}


