'use client';

import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CvAiPatchDiffView } from '@/components/cv/CvAiPatchDiffView';
import { CvDiffActionPair } from '@/components/cv/cvDiffImprovementActions';
import { cvDiffFieldDisplayText } from '@/lib/cvAiPatchDisplay';
import {
  CV_DIFF_EMPTY_PREVIEW_MESSAGE,
  CV_DIFF_STRUCTURAL_SECTION_MESSAGE,
} from '@/lib/cvDiffCopy';
import { cvStructuralDiffPayloadPresent } from '@/lib/cvDiffPreviewMap';
import {
  gCvDocPreviewDiffMultiSection,
  gCvDocPreviewStructuralAfter,
  gCvDocPreviewStructuralBefore,
  resolveCvPreviewSectionDiff,
  type CvPreviewChangedField,
} from '@/lib/cvDocumentPreviewDiffContext';
import { cn } from '@/lib/utils';

export type CvTemplateSectionChangedField = CvPreviewChangedField;

/** Sections whose changes belong to one entry (a job, a school…), addressed as `section[i]…`. */
const ENTRY_LIST_SECTIONS = new Set([
  'experience',
  'education',
  'projects',
  'certifications',
  'achievements',
  'volunteerwork',
]);

/** Index of the entry a change targets (`experience[1].bullets[3]` → 1), or null. */
export function cvChangeEntryIndex(path: string): number | null {
  const m = /^([a-z_]+)(?:\.items)?(?:\[(\d+)\]|\.(\d+)(?=\.|$))/i.exec(
    path.trim(),
  );
  if (!m || !ENTRY_LIST_SECTIONS.has(m[1].toLowerCase())) return null;
  return Number(m[2] ?? m[3]);
}

let lastScrolledSuggestionKey = '';

function scrollSuggestionIntoView(el: HTMLElement, key: string) {
  if (!key || key === lastScrolledSuggestionKey) return;
  lastScrolledSuggestionKey = key;
  requestAnimationFrame(() =>
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  );
}

/** Entry elements of a section box, in data order (section title rows excluded). */
function sectionEntryElements(box: HTMLElement): HTMLElement[] {
  const isTitle = (el: HTMLElement) =>
    el.dataset.entryId?.startsWith('__section-title__') === true;
  return Array.from(
    box.querySelectorAll<HTMLElement>('[data-entry-id]'),
  ).filter((el) => {
    if (isTitle(el)) return false;
    const outer = el.parentElement?.closest<HTMLElement>('[data-entry-id]');
    return !outer || !box.contains(outer) || isTitle(outer);
  });
}

/** Renders its card right under entry `entryIndex` of the surrounding section box. */
function EntrySuggestionSlot({
  entryIndex,
  scrollKey,
  children,
}: {
  entryIndex: number;
  scrollKey: string;
  children: ReactNode;
}) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState<HTMLElement | 'inline' | null>(null);

  useLayoutEffect(() => {
    const box = markerRef.current?.parentElement;
    const entry = box ? sectionEntryElements(box)[entryIndex] : undefined;
    if (!entry) {
      setTarget('inline');
      return;
    }
    const host = document.createElement('div');
    host.setAttribute('data-cv-ai-entry-suggestion', '');
    entry.appendChild(host);
    setTarget(host);
    return () => {
      host.remove();
    };
  }, [entryIndex]);

  useEffect(() => {
    if (target instanceof HTMLElement)
      scrollSuggestionIntoView(target, scrollKey);
  }, [target, scrollKey]);

  return (
    <>
      <span ref={markerRef} hidden />
      {target === 'inline'
        ? children
        : target
          ? createPortal(children, target)
          : null}
    </>
  );
}

function ScrollIntoViewOnce({ scrollKey }: { scrollKey: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const card = ref.current?.parentElement;
    if (card) scrollSuggestionIntoView(card, scrollKey);
  }, [scrollKey]);
  return <span ref={ref} hidden />;
}

export function cvTemplateSectionBox(
  id: string,
  activeSection: string | null | undefined,
  className: string,
  children: ReactNode,
  diffSection?: string | null,
  changedFields?: CvTemplateSectionChangedField[] | null,
  onAccept?: (changeIndex?: number) => void,
  onReject?: (changeIndex?: number) => void,
  isOuterSectionActive?: (active: string | null | undefined) => boolean,
) {
  const isActive = isOuterSectionActive
    ? isOuterSectionActive(activeSection)
    : activeSection === id;
  const {
    isDiff,
    fields: sectionChangedFields,
    sectionDiffIndex,
  } = resolveCvPreviewSectionDiff(id, diffSection, changedFields);
  const hasChanges =
    isDiff && sectionChangedFields && sectionChangedFields.length > 0;
  const sectionDiffCallbackIndex =
    sectionDiffIndex != null && sectionDiffIndex >= 0
      ? sectionDiffIndex
      : undefined;
  const structuralPresent = cvStructuralDiffPayloadPresent(
    gCvDocPreviewStructuralBefore,
    gCvDocPreviewStructuralAfter,
  );
  const showEmptyDiffFallback =
    isDiff &&
    (!changedFields || changedFields.length === 0) &&
    !structuralPresent;
  const showStructuralSectionFallback =
    isDiff &&
    (!changedFields || changedFields.length === 0) &&
    structuralPresent;
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

  const card =
    'mx-1 mt-3 overflow-hidden rounded-xl border border-[#D0D5DD] bg-white text-left shadow-[0_4px_16px_rgba(16,24,40,0.08)]';
  const cardHeader = (label: string) => (
    <div className="flex items-center gap-2 border-b border-[#EAECF0] bg-[#F6FEF9] px-3.5 py-2">
      <Sparkles className="h-3.5 w-3.5 text-[#17B26A]" aria-hidden />
      <p className="text-[12px] font-semibold text-[#101828]">{label}</p>
    </div>
  );

  return (
    <div
      id={`cv-preview-${id}`}
      style={{ breakInside: 'avoid-page', pageBreakInside: 'avoid' }}
      className={cn(
        'relative transition-[box-shadow] duration-200',
        isActive && !isDiff
          ? 'rounded-[4px] ring-1 ring-inset ring-[rgba(23,178,106,0.35)]'
          : '',
        isDiff
          ? 'rounded-[4px] pb-1 ring-2 ring-[#17B26A]/40 ring-offset-2 ring-offset-white'
          : '',
        className,
      )}
    >
      {children}
      {showStructuralSectionFallback || showEmptyDiffFallback ? (
        <div className={card}>
          {cardHeader('Suggested change')}
          <div className="px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-[#344054]">
              {showStructuralSectionFallback
                ? CV_DIFF_STRUCTURAL_SECTION_MESSAGE
                : CV_DIFF_EMPTY_PREVIEW_MESSAGE}
            </p>
            <CvDiffActionPair
              tone="paper"
              className="mt-3 flex items-center justify-end gap-2"
              rejectLabel="Keep mine"
              acceptLabel="Use this"
              onReject={() => onReject?.(sectionDiffCallbackIndex)}
              onAccept={() => onAccept?.(sectionDiffCallbackIndex)}
            />
          </div>
        </div>
      ) : null}
      {hasChanges ? changeCards() : null}
    </div>
  );

  function changeCards() {
    const fields = sectionChangedFields!;
    const many = fields.length > 1;
    const scrollKey = `${id}:${fields
      .map((cf) => cf.fieldPath ?? cf.field ?? '')
      .join('|')}`;
    const renderField = (cf: CvTemplateSectionChangedField, i: number) => {
      const path = cf.fieldPath ?? cf.field ?? '';
      const fieldCallbackIndex =
        sectionDiffCallbackIndex ??
        cf.sectionDiffIndex ??
        (fields.length === 1 ? undefined : i);
      return (
        <div key={i} className="px-3.5 py-3">
          <CvAiPatchDiffView
            tone="paper"
            title={
              many ? formatDiffTitle((cf.fieldLabel ?? path).trim()) : undefined
            }
            before={cvDiffFieldDisplayText(cf.before, id, path)}
            after={cvDiffFieldDisplayText(cf.after, id, path)}
            compact
          />
          <CvDiffActionPair
            tone="paper"
            className="mt-2.5 flex items-center justify-end gap-2"
            rejectLabel="Keep mine"
            acceptLabel="Use this"
            onReject={() => onReject?.(fieldCallbackIndex)}
            onAccept={() => onAccept?.(fieldCallbackIndex)}
          />
        </div>
      );
    };

    const byEntry = new Map<number, number[]>();
    const sectionLevel: number[] = [];
    fields.forEach((cf, i) => {
      const entry = cvChangeEntryIndex(cf.fieldPath ?? cf.field ?? '');
      if (entry == null) sectionLevel.push(i);
      else byEntry.set(entry, [...(byEntry.get(entry) ?? []), i]);
    });
    const entryGroups = Array.from(byEntry.entries()).sort(([a], [b]) => a - b);
    const footer = many ? (
      <CvDiffActionPair
        tone="paper"
        className="flex items-center justify-end gap-2 border-t border-[#EAECF0] bg-[#F9FAFB] px-3.5 py-2.5"
        rejectLabel="Keep all mine"
        acceptLabel={
          gCvDocPreviewDiffMultiSection ? 'Use this section' : 'Use all'
        }
        onReject={() => onReject?.(sectionDiffCallbackIndex)}
        onAccept={() => onAccept?.(sectionDiffCallbackIndex)}
      />
    ) : null;

    return (
      <>
        {entryGroups.map(([entryIndex, indexes], g) => (
          <EntrySuggestionSlot
            key={`entry-${entryIndex}`}
            entryIndex={entryIndex}
            scrollKey={g === 0 ? scrollKey : ''}
          >
            <div className={card} onClick={(e) => e.stopPropagation()}>
              {cardHeader(
                indexes.length > 1
                  ? `${indexes.length} suggested changes here`
                  : 'Suggested rewrite',
              )}
              <div className="divide-y divide-[#EAECF0]">
                {indexes.map((i) => renderField(fields[i], i))}
              </div>
            </div>
          </EntrySuggestionSlot>
        ))}
        {sectionLevel.length > 0 ? (
          <div className={card}>
            {entryGroups.length === 0 ? (
              <ScrollIntoViewOnce scrollKey={scrollKey} />
            ) : null}
            {cardHeader(
              sectionLevel.length > 1
                ? `${sectionLevel.length} suggested changes`
                : 'Suggested rewrite',
            )}
            <div className="divide-y divide-[#EAECF0]">
              {sectionLevel.map((i) => renderField(fields[i], i))}
            </div>
            {footer}
          </div>
        ) : footer ? (
          <div className={card}>{footer}</div>
        ) : null}
      </>
    );
  }
}
