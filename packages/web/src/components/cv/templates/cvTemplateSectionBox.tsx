'use client';

import type { ReactNode } from 'react';

import { CvAiPatchDiffView } from '@/components/cv/CvAiPatchDiffView';
import { CvDiffActionPair } from '@/components/cv/cvDiffImprovementActions';
import { coerceAiPatchToDisplayString } from '@/lib/cvAiPatchDisplay';
import { CV_DIFF_EMPTY_PREVIEW_MESSAGE, CV_DIFF_STRUCTURAL_SECTION_MESSAGE } from '@/lib/cvDiffCopy';
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
  const isActive = isOuterSectionActive ? isOuterSectionActive(activeSection) : activeSection === id;
  const { isDiff, fields: sectionChangedFields, sectionDiffIndex } = resolveCvPreviewSectionDiff(
    id,
    diffSection,
    changedFields,
  );
  const hasChanges = isDiff && sectionChangedFields && sectionChangedFields.length > 0;
  const sectionDiffCallbackIndex =
    sectionDiffIndex != null && sectionDiffIndex >= 0 ? sectionDiffIndex : undefined;
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
            const beforeDisplay = coerceAiPatchToDisplayString(
              cf.before,
              sectionHint,
              cf.fieldPath ?? cf.field ?? '',
            );
            const afterDisplay = coerceAiPatchToDisplayString(
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
          <CvDiffActionPair
            className="mt-3 flex items-center justify-end gap-1.5"
            rejectLabel={gCvDocPreviewDiffMultiSection ? '✕ Reject section' : '✕ Reject all'}
            acceptLabel={gCvDocPreviewDiffMultiSection ? '✓ Accept section' : '✓ Accept all'}
            onReject={() => onReject?.(sectionDiffCallbackIndex)}
            onAccept={() => onAccept?.(sectionDiffCallbackIndex)}
          />
        </div>
      )}
    </div>
  );
}
