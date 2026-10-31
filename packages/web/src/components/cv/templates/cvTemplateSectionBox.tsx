'use client';

import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

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
      {hasChanges && (
        <div className={card}>
          {cardHeader(
            sectionChangedFields!.length > 1
              ? `${sectionChangedFields!.length} suggested changes`
              : 'Suggested rewrite',
          )}
          <div className="divide-y divide-[#EAECF0]">
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
                <div key={i} className="px-3.5 py-3">
                  <CvAiPatchDiffView
                    tone="paper"
                    title={
                      sectionChangedFields!.length > 1
                        ? formatDiffTitle(
                            (
                              cf.fieldLabel ??
                              cf.fieldPath ??
                              cf.field ??
                              ''
                            ).trim(),
                          )
                        : undefined
                    }
                    before={beforeDisplay}
                    after={afterDisplay}
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
            })}
          </div>
          {sectionChangedFields!.length > 1 ? (
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
          ) : null}
        </div>
      )}
    </div>
  );
}
