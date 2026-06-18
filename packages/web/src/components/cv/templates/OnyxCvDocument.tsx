'use client';

import { Montserrat } from 'next/font/google';
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  GripVertical,
  Upload,
  X as XIcon,
  Phone as PhoneIcon,
  Mail as MailIcon,
  MapPin as MapPinIcon,
  Link2 as Link2Icon,
  GitBranch as GitBranchIcon,
  Globe as GlobeIcon,
  Calendar as CalendarIcon,
  Flag as FlagIcon,
} from 'lucide-react';

import { DEFAULT_HEADER_PREVIEW, useCVEdit } from '@/components/cv/CVEditContext';
import { CVSectionWrapper } from '@/components/cv/CVSectionWrapper';
import { EntryToolbar } from '@/components/cv/EntryToolbar';
import { HeaderFloatingControls } from '@/components/cv/HeaderFloatingControls';
import { InlineField } from '@/components/cv/InlineField';
import { InlineSkillsCommaField } from '@/components/cv/InlineSkillsCommaField';
import { SkillsRichComma } from '@/components/cv/SkillsRichComma';
import { persistSectionTitleChange, resolveSectionDisplayTitle } from '@/lib/cvSectionTitlePersist';
import { useToast } from '@/components/ui/Toast';
import {
  dispatchSectionDragEnd,
  getActiveDraggingSectionId,
  SECTION_REORDER_DROP_EVENT_NAME,
  setActiveDraggingSectionId,
  type SectionReorderDropDetail,
} from '@/components/cv/cvSectionDrag';
import {
  cvTemplateSectionBox,
  type CvTemplateSectionChangedField,
} from '@/components/cv/templates/cvTemplateSectionBox';
import {
  filterCvBuilderReferences,
  normalizeBullets,
  newLocalId,
  type CVBuilderData,
  type CVBuilderLanguage,
} from '@/lib/cvBuilder';
import { CvCustomLegacySectionBody } from '@/components/cv/CvCustomLegacySectionBody';
import { CvEditableReferencesList } from '@/components/cv/CvEditableReferencesList';
import { CvParsedCustomSectionItems } from '@/components/cv/CvParsedCustomSectionItems';
import {
  filterParsedCustomSectionsForEditor,
  shouldRenderCustomLegacySection,
  orderedParsedPreviewKeys,
} from '@/lib/cvParsedCustomSectionUtils';
import { dedupePreviewSectionKeys, DEFAULT_PREVIEW_DRAG_SECTION_ORDER } from '@/lib/cvSectionProfessionalOrder';
import { formatCvPeriodEnDash, formatEduRange } from '@/lib/cvDate';
import { compressImageFileToCvDataUrl, CV_PHOTO_TOO_LARGE_USER_MESSAGE } from '@/lib/cvPhotoCompress';
import { normalizeEditableHtml } from '@/lib/cvRichTextCore';
import { toPreviewRichTextHtml } from '@/lib/cvRichTextPreview';
import { cn } from '@/lib/utils';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const ONYX_SIDEBAR = '#313131';
export const ONYX_HEADER = '#EBEBEB';
export const ONYX_TEXT = '#333333';

const ONYX_SIDEBAR_TITLE =
  'text-[11pt] font-semibold uppercase tracking-wide text-white border-b border-white/40 pb-1 mb-3';
const ONYX_MAIN_TITLE = 'text-[11pt] font-semibold border-b border-[#333]/30 pb-1 mb-3 text-[#333333]';
const ONYX_SIDEBAR_FIELD = 'text-[8.5pt] text-white';
const ONYX_SIDEBAR_PLACEHOLDER_TONE = 'onDark' as const;

const CORE_SECTION_IDS = new Set(['summary', 'experience', 'education', 'skills']);
const CV_PREVIEW_ITEM_SEP = '::';

type CVSectionVisibilityMap = Record<string, boolean>;

type OnyxCvDocumentProps = {
  data: CVBuilderData;
  activeSection?: string | null;
  sectionVisibility?: CVSectionVisibilityMap | null;
  diffSection?: string | null;
  diffChangedFields?: CvTemplateSectionChangedField[] | null;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  optionalSectionPresence?: Set<string>;
  sectionOrder?: string[];
  onReorderSections?: (nextOrder: string[]) => void;
};

function isCvSectionVisible(sectionKey: string, map?: CVSectionVisibilityMap | null): boolean {
  if (!map) return true;
  return map[sectionKey] !== false;
}

function reorderSectionKeys(sourceOrder: string[], dragId: string, targetId: string): string[] | null {
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

function isCoreSectionId(sectionId: string): boolean {
  return CORE_SECTION_IDS.has(sectionId);
}

function optionalSectionShown(presence: Set<string> | undefined, type: string, hasRows: boolean): boolean {
  if (!presence) return hasRows;
  return presence.has(type) || hasRows;
}

const ONYX_BULLET_LIST =
  'mt-1.5 list-disc list-outside space-y-0.5 pl-4 text-[9pt] leading-relaxed marker:text-[#333333]';

function onyxBulletLines(raw: string | string[] | undefined): string[] {
  return normalizeBullets(raw as string | string[] | undefined).filter(Boolean);
}

function onyxMultilineLines(text: string): string[] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function onyxProjectLines(project: CVBuilderData['projects'][number]): string[] {
  const fromBullets = onyxBulletLines(project.bullets);
  if (fromBullets.length) return fromBullets;
  const fromDescription = onyxMultilineLines(project.description);
  if (fromDescription.length) return fromDescription;
  if (project.description.trim()) return [project.description.trim()];
  return [];
}

function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn('[&_a]:text-[#1D4ED8] [&_a]:underline', className)}
      dangerouslySetInnerHTML={{ __html: toPreviewRichTextHtml(text) }}
    />
  );
}

function OnyxBulletList({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={cn(ONYX_BULLET_LIST, className)}>
      {items.map((line, i) => (
        <li key={i} style={{ color: ONYX_TEXT }}>
          <RichText text={line} />
        </li>
      ))}
    </ul>
  );
}

function normalizeBulletInput(value: string): string {
  return normalizeEditableHtml(value);
}

function cvBulletFieldDomIsEmpty(e: { currentTarget: HTMLElement }): boolean {
  const t = (e.currentTarget.innerText || '').replace(/\u200b/g, '').replace(/\u00a0/g, ' ').trim();
  return t.length === 0;
}

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

function entryFocusStyle(focused: boolean): CSSProperties {
  return {
    outline: focused ? '1.5px dashed #00C9B1' : 'none',
    outlineOffset: '3px',
    borderRadius: '3px',
    position: 'relative',
  };
}

function splitDisplayName(raw: string): { firstParts: string; lastPart: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstParts: 'YOUR', lastPart: 'NAME' };
  if (parts.length === 1) return { firstParts: '', lastPart: parts[0]!.toUpperCase() };
  const last = parts[parts.length - 1]!.toUpperCase();
  const first = parts.slice(0, -1).join(' ').toUpperCase();
  return { firstParts: first, lastPart: last };
}

function formatEduRangeEnDash(startYear: string, endYear: string): string {
  return formatEduRange(startYear, endYear).replace(/\s*—\s*/g, ' – ');
}

function eduDegreeLine(e: CVBuilderData['education']['items'][number]): string {
  const d = (e.degree || '').trim();
  const f = (e.field || '').trim();
  const g = (e.grade || '').trim();
  return [d, f, g].filter(Boolean).join(', ');
}

function flattenSkillList(data: CVBuilderData, inline: boolean): string[] {
  const cats = inline
    ? data.skills.categories
    : data.skills.categories.filter((c) => c.name.trim() || c.skills.some((s) => s.trim()));
  const out: string[] = [];
  for (const cat of cats) {
    for (const skill of cat.skills) {
      const t = skill.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

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

function EditableHeaderPhoto({ photoUrl, imgClassName }: { photoUrl: string; imgClassName: string }) {
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
      <div className="mb-4 flex justify-center">
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

function OnyxPhotoReadOnlyPlaceholder() {
  return (
    <div className="mb-4 flex justify-center" aria-hidden>
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
        <svg viewBox="0 0 96 96" className="h-full w-full text-white/35" fill="currentColor">
          <circle cx="48" cy="34" r="16" />
          <ellipse cx="48" cy="78" rx="28" ry="20" />
        </svg>
      </div>
    </div>
  );
}

function OnyxPhotoPlaceholder() {
  const ctx = useCVEdit();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files)} />
      <div className="mb-4 flex justify-center">
        <button
          type="button"
          className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-white/40 bg-white/10 text-white/60 transition hover:border-white/70 hover:bg-white/15 hover:text-white/80"
          onClick={(e) => {
            e.stopPropagation();
            fileRef.current?.click();
          }}
          aria-label="Upload profile photo"
        >
          <Upload className="h-6 w-6" />
        </button>
      </div>
    </>
  );
}

const ONYX_SIDEBAR_KEYS = new Set(['summary', 'education', 'skills']);

function isOnyxMainKey(id: string): boolean {
  return (
    id === 'experience' ||
    id === 'references' ||
    id === 'projects' ||
    id === 'certifications' ||
    id === 'languages' ||
    id === 'achievements' ||
    id === 'custom-legacy' ||
    id.startsWith('parsed-')
  );
}

/** Walk global preview drag order once; preserve within-column order from that walk. */
function splitOnyxColumnOrder(
  full: string[] | undefined,
  defaults: { sidebar: readonly string[]; main: readonly string[] },
): { sidebar: string[]; main: string[] } {
  const order =
    full && full.length > 0 ? full : [...defaults.sidebar, ...defaults.main];
  const sidebar: string[] = [];
  const main: string[] = [];
  const sidebarSeen = new Set<string>();
  const mainSeen = new Set<string>();
  for (const id of order) {
    if (ONYX_SIDEBAR_KEYS.has(id) && !sidebarSeen.has(id)) {
      sidebar.push(id);
      sidebarSeen.add(id);
    } else if (isOnyxMainKey(id) && !mainSeen.has(id)) {
      main.push(id);
      mainSeen.add(id);
    }
  }
  for (const id of defaults.sidebar) {
    if (ONYX_SIDEBAR_KEYS.has(id) && !sidebarSeen.has(id)) sidebar.push(id);
  }
  for (const id of defaults.main) {
    if (isOnyxMainKey(id) && !mainSeen.has(id)) main.push(id);
  }
  return { sidebar, main };
}

export function OnyxCvDocument({
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
}: OnyxCvDocumentProps) {
  const ctx = useCVEdit();
  const inline = Boolean(ctx?.isEditing && ctx?.onUpdate);
  const hp = ctx?.headerPreview ?? DEFAULT_HEADER_PREVIEW;
  const [sectionTitleOverrides, setSectionTitleOverrides] = useState<Record<string, string>>({});
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [entryFieldVisibility, setEntryFieldVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const draggingSectionIdRef = useRef<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

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

  const p = data.personal;
  const vis = (k: string) => isCvSectionVisible(k, sectionVisibility) && !hiddenSections.has(k);
  const sectionBox = (
    id: string,
    className: string,
    children: ReactNode,
    isOuterSectionActive?: (active: string | null | undefined) => boolean,
  ) =>
    cvTemplateSectionBox(
      id,
      activeSection,
      className,
      children,
      diffSection,
      diffChangedFields,
      onAcceptDiff,
      onRejectDiff,
      isOuterSectionActive,
    );

  const entryFieldOn = (entryKey: string, field: string) => entryFieldVisibility[entryKey]?.[field] ?? true;
  const setEntryFieldOn = (entryKey: string, field: string, enabled: boolean) => {
    setEntryFieldVisibility((prev) => ({
      ...prev,
      [entryKey]: { ...(prev[entryKey] ?? {}), [field]: enabled },
    }));
  };

  const sectionTitle = (sectionId: string, fallback: string) =>
    resolveSectionDisplayTitle(sectionId, fallback, data, sectionTitleOverrides);
  const sectionIsActive = (sectionId: string) =>
    ctx?.focusedSection === sectionId || ctx?.focusedEntrySection === sectionId;

  const reorderPreviewSections = (targetSectionId: string) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, sectionOrder, onReorderSections]);

  const renderSectionTitle = (
    sectionId: string,
    fallback: string,
    sidebar: boolean,
    onDeleteSection?: () => void,
  ) => {
    const titleEntryId = `__section-title__:${sectionId}`;
    const focused = ctx?.focusedEntryId === titleEntryId;
    const titleClass = sidebar ? ONYX_SIDEBAR_TITLE : ONYX_MAIN_TITLE;

    return (
      <div
        className={cn('relative', inline && sectionIsActive(sectionId) && 'group')}
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
        <h2 className={cn('flex items-center gap-1.5', titleClass)}>
          {inline ? (
            <span
              role="button"
              tabIndex={0}
              title="Drag section to reorder"
              aria-label={`Drag ${fallback} section to reorder`}
              draggable
              className={cn(
                'shrink-0 cursor-grab rounded-sm border border-[#00C9B1]/45 p-0.5 text-[#00C9B1] shadow-sm shadow-[#00C9B1]/15 transition hover:border-[#00C9B1]/70 hover:bg-[#00C9B1]/10 hover:text-[#007A7A] active:cursor-grabbing',
                sidebar ? 'bg-[#313131]/95' : 'bg-white/95',
              )}
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
              className={cn('font-semibold uppercase', sidebar ? 'text-white' : 'text-[#333333]')}
              placeholderTone={sidebar ? ONYX_SIDEBAR_PLACEHOLDER_TONE : 'default'}
            />
          ) : (
            sectionTitle(sectionId, fallback)
          )}
        </h2>
      </div>
    );
  };

  const photoBlock = !hp.showPhoto
    ? null
    : p.photoUrl?.trim()
      ? (
          <EditableHeaderPhoto
            photoUrl={p.photoUrl}
            imgClassName={cn(
              'h-24 w-24 border border-white/20 object-cover',
              hp.photoStyle === 'circle' && 'rounded-full',
              hp.photoStyle === 'square' && 'rounded-md',
              hp.photoStyle === 'avatar' && 'rounded-full ring-2 ring-white/20',
            )}
          />
        )
      : inline
        ? (
            <OnyxPhotoPlaceholder />
          )
        : (
            <OnyxPhotoReadOnlyPlaceholder />
          );

  const renderSidebarContactRow = (
    show: boolean,
    icon: ReactNode,
    entryId: string,
    value: string,
    placeholder: string,
    onChange: (next: string) => void,
  ) => {
    if (!show) return null;
    if (!inline && !value.trim()) return null;
    return (
      <div className="flex items-start gap-2">
        {icon}
        <span className="min-w-0 break-words">
          {inline && ctx ? (
            <InlineField
              value={value}
              placeholder={placeholder}
              sectionId="personal"
              entryId={entryId}
              onChange={onChange}
              placeholderTone={ONYX_SIDEBAR_PLACEHOLDER_TONE}
              className={ONYX_SIDEBAR_FIELD}
            />
          ) : (
            value.trim()
          )}
        </span>
      </div>
    );
  };

  const aboutMeEl =
    vis('summary') && (inline || data.summary.text.trim()) ? (
      <CVSectionWrapper sectionId="summary">
        {sectionBox('summary', 'mb-5', <>
          {renderSectionTitle('summary', 'About Me', true, () => ctx?.onUpdate({ summary: { text: '' } }))}
          <div className="text-[9pt] leading-relaxed text-white/95">
            {inline && ctx ? (
              <div
                data-entry-id="summary-body"
                style={entryFocusStyle(ctx.focusedEntryId === 'summary-body')}
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.setFocusedSection('summary');
                  ctx.setFocusedEntryId('summary-body');
                  ctx.setFocusedEntrySection('summary');
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
                  placeholder="Brief professional summary"
                  onChange={(v) => ctx.onUpdate({ summary: { text: v } })}
                  placeholderTone={ONYX_SIDEBAR_PLACEHOLDER_TONE}
                  className="text-[9pt] leading-relaxed text-white"
                />
              </div>
            ) : (
              <RichText text={data.summary.text} className="text-white/95" />
            )}
          </div>
          <div className="mt-3 space-y-1.5 text-[8.5pt] text-white/90">
            {renderSidebarContactRow(
              hp.showPhone,
              <PhoneIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-phone__',
              p.phone ?? '',
              'Phone',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, phone: v } }),
            )}
            {renderSidebarContactRow(
              hp.showEmail,
              <MailIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-email__',
              p.email ?? '',
              'Email',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, email: v } }),
            )}
            {renderSidebarContactRow(
              hp.showLocation,
              <MapPinIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-location__',
              p.location ?? '',
              'Location',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, location: v } }),
            )}
            {renderSidebarContactRow(
              hp.showLinkedIn,
              <Link2Icon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-linkedin__',
              p.linkedin ?? '',
              'LinkedIn',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, linkedin: v } }),
            )}
            {renderSidebarContactRow(
              hp.showGithub,
              <GitBranchIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-github__',
              p.github ?? '',
              'GitHub',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, github: v } }),
            )}
            {renderSidebarContactRow(
              hp.showWebsiteToggle,
              <GlobeIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-website__',
              p.website ?? '',
              'Website',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, website: v } }),
            )}
            {renderSidebarContactRow(
              hp.showPortfolioToggle,
              <GlobeIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-portfolio__',
              p.portfolio ?? '',
              'Portfolio',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, portfolio: v } }),
            )}
            {renderSidebarContactRow(
              hp.nationality,
              <FlagIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-nationality__',
              p.nationality ?? '',
              'Nationality',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, nationality: v } }),
            )}
            {renderSidebarContactRow(
              hp.dateOfBirth,
              <CalendarIcon className="mt-0.5 h-3 w-3 shrink-0 text-white" aria-hidden />,
              '__onyx-dob__',
              p.dateOfBirth ?? '',
              'Date of birth',
              (v) => ctx?.onUpdate({ personal: { ...data.personal, dateOfBirth: v } }),
            )}
          </div>
        </>)}
      </CVSectionWrapper>
    ) : null;

  const educationEl = vis('education') ? (
    <CVSectionWrapper sectionId="education">
      {sectionBox('education', 'mb-5', <>
        {renderSectionTitle('education', 'Education', true, () => ctx?.onUpdate({ education: { items: [] } }))}
        <div className="space-y-3 text-[9pt] leading-snug text-white/95">
          {data.education.items.length ? (
            data.education.items.map((e, eIdx) => {
              const dates = formatEduRangeEnDash(e.startYear, e.endYear);
              const degreeLine = eduDegreeLine(e);
              return (
                <div
                  key={e.id}
                  data-entry-id={e.id}
                  style={entryFocusStyle(ctx?.focusedEntryId === e.id)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    ctx?.setFocusedSection('education');
                    ctx?.setFocusedEntryId(e.id);
                    ctx?.setFocusedEntrySection('education');
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
                              { id: newLocalId(), degree: '', field: '', school: '', startYear: '', endYear: '', grade: '' },
                            ],
                          },
                        })
                      }
                      onMoveUp={() => {
                        if (eIdx === 0) return;
                        const next = [...data.education.items];
                        [next[eIdx - 1], next[eIdx]] = [next[eIdx], next[eIdx - 1]];
                        ctx.onUpdate({ education: { items: next } });
                      }}
                      onMoveDown={() => {
                        if (eIdx >= data.education.items.length - 1) return;
                        const next = [...data.education.items];
                        [next[eIdx], next[eIdx + 1]] = [next[eIdx + 1], next[eIdx]];
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
                      showMoveUp={eIdx > 0}
                      showMoveDown={eIdx < data.education.items.length - 1}
                      dateStart={e.startYear}
                      dateEnd={e.endYear}
                      showDatePicker
                    />
                  ) : null}
                  {inline && ctx ? (
                    <>
                      <p className="font-bold text-white">
                        <InlineField
                          value={e.school}
                          placeholder="School"
                          sectionId="education"
                          entryId={e.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              education: {
                                items: data.education.items.map((row) => (row.id === e.id ? { ...row, school: v } : row)),
                              },
                            })
                          }
                          className="font-bold text-white"
                          placeholderTone={ONYX_SIDEBAR_PLACEHOLDER_TONE}
                        />
                      </p>
                      <p className="text-white/90">
                        <InlineField
                          value={degreeLine}
                          placeholder="Degree, field"
                          sectionId="education"
                          entryId={e.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              education: {
                                items: data.education.items.map((row) =>
                                  row.id === e.id ? { ...row, degree: v, field: '', grade: '' } : row,
                                ),
                              },
                            })
                          }
                          className="text-white/90"
                          placeholderTone={ONYX_SIDEBAR_PLACEHOLDER_TONE}
                        />
                      </p>
                      <p className="text-white/75">
                        <InlineField
                          value={dates}
                          placeholder="Date range"
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
                          className="text-white/75"
                          placeholderTone={ONYX_SIDEBAR_PLACEHOLDER_TONE}
                        />
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-white">{e.school || 'School'}</p>
                      {degreeLine ? <p className="text-white/90">{degreeLine}</p> : null}
                      {dates ? <p className="text-white/75">{dates}</p> : null}
                    </>
                  )}
                </div>
              );
            })
          ) : inline && ctx ? (
            <button
              type="button"
              className="text-xs italic text-white/50 hover:text-[#00C9B1] hover:underline"
              onClick={() =>
                ctx.onUpdate({
                  education: {
                    items: [{ id: newLocalId(), degree: '', field: '', school: '', startYear: '', endYear: '', grade: '' }],
                  },
                })
              }
            >
              + Click to add education
            </button>
          ) : (
            <p className="text-white/60">Add your education in the editor.</p>
          )}
        </div>
      </>)}
    </CVSectionWrapper>
  ) : null;

  const allSkillCats = inline
    ? data.skills.categories
    : data.skills.categories.filter((c) => c.name.trim() || c.skills.some((s) => s.trim()));
  const flatSkills = flattenSkillList(data, inline);

  const skillsEl = vis('skills') ? (
    <CVSectionWrapper sectionId="skills">
      {sectionBox('skills', 'mb-4', <>
        {renderSectionTitle('skills', 'Skills', true, () => ctx?.onUpdate({ skills: { categories: [] } }))}
        {inline && ctx ? (
          <div className="space-y-2">
            {allSkillCats.length === 0 ? (
              <button
                type="button"
                className="text-xs italic text-white/50 hover:text-[#00C9B1] hover:underline"
                onClick={() => {
                  const id = newLocalId();
                  ctx.onUpdate({ skills: { categories: [{ id, name: '', skills: [''] }] } });
                  ctx.setFocusedEntryId(id);
                  ctx.setFocusedSection('skills');
                  ctx.setFocusedEntrySection('skills');
                }}
              >
                + Click to add skills
              </button>
            ) : (
              allSkillCats.map((cat, catIdx) => (
                <div
                  key={cat.id}
                  data-entry-id={cat.id}
                  style={entryFocusStyle(ctx.focusedEntryId === cat.id)}
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
                        ctx.onUpdate({ skills: { categories: [...data.skills.categories, { id, name: '', skills: [''] }] } });
                        ctx.setFocusedEntryId(id);
                      }}
                      onAddSecondaryEntry={() => {
                        const id = newLocalId();
                        ctx.onUpdate({
                          skills: { categories: [...data.skills.categories, { id, name: 'Group Title', skills: [''] }] },
                        });
                        ctx.setFocusedEntryId(id);
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
                    />
                  ) : null}
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
                    className="text-white"
                    placeholderTone={ONYX_SIDEBAR_PLACEHOLDER_TONE}
                  />
                </div>
              ))
            )}
          </div>
        ) : flatSkills.length ? (
          <div className="text-[9pt] text-white/95">
            <SkillsRichComma skills={flatSkills} />
          </div>
        ) : (
          <p className="text-[9pt] text-white/60">Add skills in the editor.</p>
        )}
      </>)}
    </CVSectionWrapper>
  ) : null;

  const displayNameRaw = (p.name || '').trim() || 'Your Name';
  const { firstParts, lastPart } = splitDisplayName(displayNameRaw);

  const headerEl = vis('personal') ? (
    <CVSectionWrapper sectionId="personal" className="relative">
      {sectionBox(
        'personal',
        '',
        <div
          className="relative px-6 py-5"
          style={{ backgroundColor: ONYX_HEADER }}
          data-cv-section="personal"
          onClick={(e) => {
            e.stopPropagation();
            ctx?.setFocusedSection('personal');
            ctx?.setFocusedEntryId(null);
            ctx?.setFocusedEntrySection('personal');
          }}
        >
          <HeaderFloatingControls />
          {hp.showTitle ? (
            <h1 className="text-[18pt] uppercase leading-tight tracking-wide text-[#333333]">
              {inline && ctx ? (
                <InlineField
                  value={p.name}
                  placeholder="Your Name"
                  sectionId="personal"
                  entryId="__header-name__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, name: v } })}
                  className="text-[18pt] uppercase text-[#333]"
                />
              ) : (
                <>
                  {firstParts ? <span className="font-light">{firstParts} </span> : null}
                  <span className="font-bold">{lastPart}</span>
                </>
              )}
            </h1>
          ) : null}
          {(inline && ctx && hp.showHeadline) || (!inline && hp.showHeadline && p.headline?.trim()) ? (
            <p className="mt-1 text-[10pt] font-normal text-[#333333]">
              {inline && ctx && hp.showHeadline ? (
                <InlineField
                  value={p.headline ?? ''}
                  placeholder="Professional title"
                  sectionId="personal"
                  entryId="__header-headline__"
                  onChange={(v) => ctx.onUpdate({ personal: { ...data.personal, headline: v } })}
                  className="text-[10pt] font-normal text-[#333]"
                />
              ) : (
                p.headline?.trim()
              )}
            </p>
          ) : null}
        </div>,
      )}
    </CVSectionWrapper>
  ) : null;

  const experienceEl = vis('experience') ? (
    <CVSectionWrapper sectionId="experience">
      {sectionBox(
        'experience',
        'mb-5',
        <>
          {renderSectionTitle('experience', 'Experience', false, () => ctx?.onUpdate({ experience: { items: [] } }))}
          <div className="space-y-3.5">
            {data.experience.items.length ? (
              data.experience.items.map((x, itemIdx) => (
                <div
                  key={x.id}
                  id={`cv-preview-experience-item-${x.id}`}
                  data-entry-id={x.id}
                  className={experienceItemWrapClass(activeSection, x.id)}
                  style={entryFocusStyle(ctx?.focusedEntryId === x.id)}
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
                        ctx.onUpdate({ experience: { items: next } });
                      }}
                      onMoveDown={() => {
                        if (itemIdx >= data.experience.items.length - 1) return;
                        const next = [...data.experience.items];
                        [next[itemIdx], next[itemIdx + 1]] = [next[itemIdx + 1], next[itemIdx]];
                        ctx.onUpdate({ experience: { items: next } });
                      }}
                      onDelete={() => {
                        ctx.onUpdate({ experience: { items: data.experience.items.filter((row) => row.id !== x.id) } });
                        ctx.setFocusedEntryId(null);
                        ctx.setFocusedEntrySection(null);
                      }}
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
                        { key: 'title', label: 'Title', enabled: entryFieldOn(`experience:${x.id}`, 'title'), onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'title', next) },
                        { key: 'company', label: 'Company', enabled: entryFieldOn(`experience:${x.id}`, 'company'), onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'company', next) },
                        { key: 'date', label: 'Date', enabled: entryFieldOn(`experience:${x.id}`, 'date'), onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'date', next) },
                        { key: 'bullets', label: 'Bullets', enabled: entryFieldOn(`experience:${x.id}`, 'bullets'), onToggle: (next) => setEntryFieldOn(`experience:${x.id}`, 'bullets', next) },
                      ]}
                    />
                  ) : null}
                  {inline && ctx ? (
                    <>
                      <div className="flex justify-between gap-3">
                        {entryFieldOn(`experience:${x.id}`, 'title') ? (
                          <span className="min-w-0 font-bold" style={{ color: ONYX_TEXT }}>
                            <InlineField
                              value={x.title}
                              placeholder="Job title"
                              sectionId="experience"
                              entryId={x.id}
                              onChange={(v) =>
                                ctx.onUpdate({
                                  experience: {
                                    items: data.experience.items.map((row) => (row.id === x.id ? { ...row, title: v } : row)),
                                  },
                                })
                              }
                              className="font-bold text-[#333]"
                            />
                          </span>
                        ) : (
                          <span />
                        )}
                        {entryFieldOn(`experience:${x.id}`, 'date') ? (
                          <span className="shrink-0 italic" style={{ color: ONYX_TEXT }}>
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
                              className="italic text-[#333]"
                            />
                          </span>
                        ) : null}
                      </div>
                      {entryFieldOn(`experience:${x.id}`, 'company') ? (
                        <p className="mt-0.5" style={{ color: ONYX_TEXT }}>
                          <InlineField
                            value={x.company}
                            placeholder="Company"
                            sectionId="experience"
                            entryId={x.id}
                            onChange={(v) =>
                              ctx.onUpdate({
                                experience: {
                                  items: data.experience.items.map((row) => (row.id === x.id ? { ...row, company: v } : row)),
                                },
                              })
                            }
                            className="text-[#333]"
                          />
                        </p>
                      ) : null}
                      {entryFieldOn(`experience:${x.id}`, 'bullets') ? (
                        <ul className={cn(ONYX_BULLET_LIST, 'marker:text-[#333333]')}>
                          {(Array.isArray(x.bullets) && x.bullets.length > 0
                            ? x.bullets
                            : normalizeBullets(x.bullets as unknown as string | string[] | undefined).length
                              ? normalizeBullets(x.bullets as unknown as string | string[] | undefined)
                              : ['']
                          ).map((bullet, bulletIdx) => (
                            <li key={`${x.id}-b-${bulletIdx}`} className="group/bullet" style={{ color: ONYX_TEXT }}>
                              <InlineField
                                value={bullet}
                                layout="block"
                                placeholder="Describe your accomplishment..."
                                sectionId="experience"
                                entryId={x.id}
                                dataBulletEntry={x.id}
                                dataBulletIdx={String(bulletIdx)}
                                onChange={(v) => {
                                  const base = Array.isArray(x.bullets)
                                    ? x.bullets
                                    : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
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
                                    const base = Array.isArray(x.bullets)
                                      ? x.bullets
                                      : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                    const nextBullets = [...(base.length ? base : [''])];
                                    nextBullets.splice(bulletIdx + 1, 0, '');
                                    ctx.onUpdate({
                                      experience: {
                                        items: data.experience.items.map((row) =>
                                          row.id === x.id ? { ...row, bullets: nextBullets } : row,
                                        ),
                                      },
                                    });
                                  }
                                  if (e.key === 'Backspace') {
                                    const base = Array.isArray(x.bullets)
                                      ? x.bullets
                                      : normalizeBullets(x.bullets as unknown as string | string[] | undefined);
                                    if (cvBulletFieldDomIsEmpty(e) && base.length > 1) {
                                      e.preventDefault();
                                      ctx.onUpdate({
                                        experience: {
                                          items: data.experience.items.map((row) =>
                                            row.id === x.id
                                              ? { ...row, bullets: base.filter((_, bi) => bi !== bulletIdx) }
                                              : row,
                                          ),
                                        },
                                      });
                                    }
                                  }
                                }}
                                className="text-[9pt] leading-relaxed text-[#333]"
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3">
                        <span className="min-w-0 font-bold" style={{ color: ONYX_TEXT }}>
                          {x.title || 'Job title'}
                        </span>
                        <span className="shrink-0 italic" style={{ color: ONYX_TEXT }}>
                          {formatCvPeriodEnDash(x.startDate, x.endDate, x.current)}
                        </span>
                      </div>
                      {x.company?.trim() ? (
                        <p className="mt-0.5" style={{ color: ONYX_TEXT }}>
                          {x.company.trim()}
                        </p>
                      ) : null}
                      <OnyxBulletList
                        items={onyxBulletLines(x.bullets as unknown as string | string[] | undefined)}
                      />
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
                + Click to add experience
              </button>
            ) : (
              <p className="text-[9pt]" style={{ color: ONYX_TEXT }}>
                Add your experience in the editor.
              </p>
            )}
          </div>
        </>,
        experienceOuterSectionActive,
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
        {sectionBox('references', 'mb-5', <>
          {renderSectionTitle('references', 'References', false, () => ctx?.onUpdate({ references: [] }))}
          <CvEditableReferencesList references={data.references} layout="onyx-grid" />
        </>)}
      </CVSectionWrapper>
    ) : null;

  const renderOptionalMainSection = (sectionId: string): ReactNode => {
    if (sectionId === 'projects') {
      if (!optionalSectionShown(optionalSectionPresence, 'projects', data.projects.length > 0) || !vis('projects')) {
        return null;
      }
      return (
        <CVSectionWrapper key={sectionId} sectionId="projects">
          {sectionBox('projects', 'mb-5', <>
            {renderSectionTitle('projects', 'Projects', false, () => ctx?.onUpdate({ projects: [] }))}
            <div className="space-y-2 text-[9pt]" style={{ color: ONYX_TEXT }}>
              {(inline && ctx ? data.projects : data.projects.filter((pr) => pr.name.trim() || pr.description.trim())).map(
                (pr, prIdx) => (
                  <div
                    key={pr.id}
                    data-entry-id={pr.id}
                    style={entryFocusStyle(ctx?.focusedEntryId === pr.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx?.setFocusedSection('projects');
                      ctx?.setFocusedEntryId(pr.id);
                      ctx?.setFocusedEntrySection('projects');
                    }}
                  >
                    {inline && ctx?.focusedEntryId === pr.id ? (
                      <EntryToolbar
                        sectionType="projects"
                        onAddEntry={() =>
                          ctx.onUpdate({
                            projects: [
                              ...data.projects,
                              { id: newLocalId(), name: '', description: '', url: '', technologies: [], bullets: '' },
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
                        onAddBullet={() =>
                          ctx.onUpdate({
                            projects: data.projects.map((row) => {
                              if (row.id !== pr.id) return row;
                              const base = onyxProjectLines(row);
                              const bullets = base.length ? base : [''];
                              return { ...row, bullets: [...bullets, ''].join('\n') };
                            }),
                          })
                        }
                        showMoveUp={prIdx > 0}
                        showMoveDown={prIdx < data.projects.length - 1}
                        showAddBullet
                        showDatePicker={false}
                      />
                    ) : null}
                    <p className="font-bold">
                      {inline && ctx ? (
                        <InlineField
                          value={pr.name}
                          placeholder="Project name"
                          sectionId="projects"
                          entryId={pr.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              projects: data.projects.map((row) => (row.id === pr.id ? { ...row, name: v } : row)),
                            })
                          }
                          className="font-bold text-[#333]"
                        />
                      ) : (
                        pr.name.trim() || 'Project'
                      )}
                    </p>
                    {inline && ctx && ctx.focusedEntryId === pr.id ? (
                      <InlineField
                        multiline
                        layout="block"
                        value={pr.description}
                        placeholder="One accomplishment per line"
                        sectionId="projects"
                        entryId={pr.id}
                        onChange={(v) =>
                          ctx.onUpdate({
                            projects: data.projects.map((row) => (row.id === pr.id ? { ...row, description: v } : row)),
                          })
                        }
                        className="text-[9pt] leading-relaxed text-[#333]"
                      />
                    ) : (
                      <OnyxBulletList items={onyxProjectLines(pr)} />
                    )}
                  </div>
                ),
              )}
            </div>
          </>)}
        </CVSectionWrapper>
      );
    }

    if (sectionId === 'certifications') {
      if (
        !optionalSectionShown(optionalSectionPresence, 'certifications', data.certifications.length > 0) ||
        !vis('certifications')
      ) {
        return null;
      }
      return (
        <CVSectionWrapper key={sectionId} sectionId="certifications">
          {sectionBox('certifications', 'mb-5', <>
            {renderSectionTitle('certifications', 'Certifications', false, () => ctx?.onUpdate({ certifications: [] }))}
            <div className="space-y-2 text-[9pt]" style={{ color: ONYX_TEXT }}>
              {(inline && ctx
                ? data.certifications
                : data.certifications.filter((c) => c.name.trim() || c.issuer.trim())
              ).map((c, cIdx) => (
                <div
                  key={c.id}
                  data-entry-id={c.id}
                  style={entryFocusStyle(ctx?.focusedEntryId === c.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx?.setFocusedSection('certifications');
                    ctx?.setFocusedEntryId(c.id);
                    ctx?.setFocusedEntrySection('certifications');
                  }}
                >
                  {inline && ctx?.focusedEntryId === c.id ? (
                    <EntryToolbar
                      sectionType="certifications"
                      onAddEntry={() =>
                        ctx.onUpdate({
                          certifications: [
                            ...data.certifications,
                            { id: newLocalId(), name: '', issuer: '', date: '', url: '' },
                          ],
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
                  <p className="font-bold">
                    {inline && ctx ? (
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
                        className="font-bold text-[#333]"
                      />
                    ) : (
                      c.name.trim() || 'Certification'
                    )}
                    {!inline && c.issuer.trim() ? <span> · {c.issuer.trim()}</span> : null}
                    {!inline && c.date.trim() ? <span> · {c.date.trim()}</span> : null}
                  </p>
                  {inline && ctx ? (
                    <p>
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
                        className="text-[#333]"
                      />
                      {' · '}
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
                        className="text-[#333]"
                      />
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </>)}
        </CVSectionWrapper>
      );
    }

    if (sectionId === 'languages') {
      if (!optionalSectionShown(optionalSectionPresence, 'languages', data.languages.length > 0) || !vis('languages')) {
        return null;
      }
      return (
        <CVSectionWrapper key={sectionId} sectionId="languages">
          {sectionBox('languages', 'mb-5', <>
            {renderSectionTitle('languages', 'Languages', false, () => ctx?.onUpdate({ languages: [] }))}
            <ul className="space-y-1 text-[9pt]" style={{ color: ONYX_TEXT }}>
              {data.languages.map((l, lIdx) => (
                <li
                  key={l.id}
                  data-entry-id={l.id}
                  style={entryFocusStyle(ctx?.focusedEntryId === l.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx?.setFocusedSection('languages');
                    ctx?.setFocusedEntryId(l.id);
                    ctx?.setFocusedEntrySection('languages');
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
                        className="font-semibold text-[#333]"
                      />
                      {' — '}
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
                        className="text-[#333]"
                      />
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{l.language.trim() || 'Language'}</span>
                      {l.proficiency?.trim() ? <span> — {l.proficiency.trim()}</span> : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>)}
        </CVSectionWrapper>
      );
    }

    if (sectionId === 'achievements') {
      if (
        !optionalSectionShown(optionalSectionPresence, 'achievements', data.achievements.length > 0) ||
        !vis('achievements')
      ) {
        return null;
      }
      return (
        <CVSectionWrapper key={sectionId} sectionId="achievements">
          {sectionBox('achievements', 'mb-5', <>
            {renderSectionTitle('achievements', 'Achievements', false, () => ctx?.onUpdate({ achievements: [] }))}
            <div className="space-y-2 text-[9pt]" style={{ color: ONYX_TEXT }}>
              {data.achievements.map((a, aIdx) => (
                <div
                  key={a.id}
                  data-entry-id={a.id}
                  style={entryFocusStyle(ctx?.focusedEntryId === a.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx?.setFocusedSection('achievements');
                    ctx?.setFocusedEntryId(a.id);
                    ctx?.setFocusedEntrySection('achievements');
                  }}
                >
                  {inline && ctx?.focusedEntryId === a.id ? (
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
                          achievements: data.achievements.map((row) =>
                            row.id === a.id ? { ...row, date: startDate } : row,
                          ),
                        })
                      }
                      dateMode="single"
                      dateStart={a.date}
                      dateEnd=""
                      showMoveUp={aIdx > 0}
                      showMoveDown={aIdx < data.achievements.length - 1}
                      showDatePicker
                    />
                  ) : null}
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="min-w-0 font-bold">
                      {inline && ctx ? (
                        <InlineField
                          value={a.title}
                          placeholder="Achievement"
                          sectionId="achievements"
                          entryId={a.id}
                          onChange={(v) =>
                            ctx.onUpdate({
                              achievements: data.achievements.map((row) =>
                                row.id === a.id ? { ...row, title: v } : row,
                              ),
                            })
                          }
                          className="font-bold text-[#333]"
                        />
                      ) : (
                        a.title.trim() || 'Achievement'
                      )}
                    </p>
                    {inline && ctx ? (
                      <InlineField
                        value={a.date}
                        placeholder="Date"
                        sectionId="achievements"
                        entryId={a.id}
                        onChange={(v) =>
                          ctx.onUpdate({
                            achievements: data.achievements.map((row) =>
                              row.id === a.id ? { ...row, date: v } : row,
                            ),
                          })
                        }
                        className="shrink-0 text-[#333]"
                      />
                    ) : a.date.trim() ? (
                      <span className="shrink-0 italic text-[#333]">{a.date.trim()}</span>
                    ) : null}
                  </div>
                  {inline && ctx && ctx.focusedEntryId === a.id ? (
                    <InlineField
                      multiline
                      layout="block"
                      value={a.detail}
                      placeholder="One detail per line"
                      sectionId="achievements"
                      entryId={a.id}
                      onChange={(v) =>
                        ctx.onUpdate({
                          achievements: data.achievements.map((row) => (row.id === a.id ? { ...row, detail: v } : row)),
                        })
                      }
                      className="text-[9pt] text-[#333]"
                    />
                  ) : (
                    <OnyxBulletList items={onyxMultilineLines(a.detail)} />
                  )}
                </div>
              ))}
            </div>
          </>)}
        </CVSectionWrapper>
      );
    }

    if (sectionId === 'custom-legacy') {
      if (!shouldRenderCustomLegacySection(data, inline) || !vis('custom-legacy')) {
        return null;
      }
      return (
        <CVSectionWrapper key={sectionId} sectionId="custom-legacy">
          {sectionBox('custom-legacy', 'mb-5', <>
            {renderSectionTitle('custom-legacy', 'Custom section', false, () =>
              ctx?.onUpdate({ customSections: [] }),
            )}
            <CvCustomLegacySectionBody
              textClassName="text-[9pt] text-[#333]"
              bodyClassName="text-[9pt] leading-relaxed text-[#333]"
            />
          </>)}
        </CVSectionWrapper>
      );
    }

    if (sectionId.startsWith('parsed-')) {
      const block = filterParsedCustomSectionsForEditor(data.parsedCustomSections).find(
        (b) => `parsed-${b.sectionId}` === sectionId,
      );
      if (!block || !vis(sectionId)) return null;
      if (!(block.title.trim() || block.items.some((i) => i.text.trim() || i.subItems.length) || inline)) {
        return null;
      }
      return (
        <CVSectionWrapper key={sectionId} sectionId={sectionId}>
          {sectionBox(sectionId, 'mb-5', <>
            {renderSectionTitle(sectionId, block.title.trim() || 'Additional', false, () =>
              ctx?.onUpdate({
                parsedCustomSections: data.parsedCustomSections.filter((b) => b.sectionId !== block.sectionId),
              }),
            )}
            <CvParsedCustomSectionItems
              block={block}
              previewSectionId={sectionId}
              textClassName="text-[9pt] text-[#333]"
              className="space-y-2"
            />
          </>)}
        </CVSectionWrapper>
      );
    }

    return null;
  };

  const renderMainSection = (id: string): ReactNode => {
    if (id === 'experience') return experienceEl;
    if (id === 'references') return referencesEl;
    if (id.startsWith('parsed-')) return renderOptionalMainSection(id);
    return renderOptionalMainSection(id);
  };

  const renderSidebarSection = (id: string): ReactNode => {
    if (id === 'summary') return aboutMeEl;
    if (id === 'education') return educationEl;
    if (id === 'skills') return skillsEl;
    return null;
  };

  const parsedKeysOrdered = orderedParsedPreviewKeys(
    sectionOrder,
    filterParsedCustomSectionsForEditor(data.parsedCustomSections).filter(
      (b) => b.title.trim() || b.items.some((i) => i.text.trim() || i.subItems.length) || inline,
    ),
  );
  const showCustom = shouldRenderCustomLegacySection(data, inline) && vis('custom-legacy');

  const defaultSidebarWalk = ['summary', 'education', 'skills'] as const;
  const defaultMainWalk = [
    'experience',
    'projects',
    'certifications',
    'languages',
    'achievements',
    'references',
    ...(showCustom ? (['custom-legacy'] as const) : []),
    ...parsedKeysOrdered,
  ];

  const { sidebar: sidebarWalk, main: mainWalk } = splitOnyxColumnOrder(sectionOrder, {
    sidebar: defaultSidebarWalk,
    main: defaultMainWalk,
  });

  return (
    <div
      className={cn(
        'box-border mx-auto min-h-[1123px] min-w-0 w-full max-w-[794px] bg-white text-[9.5pt] leading-normal antialiased',
        montserrat.className,
      )}
    >
      <div className="flex min-h-[1123px] w-full">
        <aside className="w-[35%] shrink-0 px-5 py-6 text-white" style={{ backgroundColor: ONYX_SIDEBAR }}>
          {photoBlock}
          {sidebarWalk.map((id) => (
            <Fragment key={`onyx-sidebar-${id}`}>{renderSidebarSection(id)}</Fragment>
          ))}
        </aside>
        <div className="min-w-0 flex-1 bg-white">
          {headerEl}
          <div className="px-6 py-5" style={{ color: ONYX_TEXT }}>
            {mainWalk.map((id) => (
              <Fragment key={`onyx-main-${id}`}>{renderMainSection(id)}</Fragment>
            ))}
          </div>
        </div>
      </div>
      <CvPreviewWatermarkFooter />
    </div>
  );
}
