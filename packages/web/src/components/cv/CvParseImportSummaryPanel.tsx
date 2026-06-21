'use client';

import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  itemCountLabel,
  type CvParseImportSummary,
} from '@/lib/cvParseImportSummary';
import { displayResumeCopy } from '@/lib/resumeDisplayCopy';
import { cn } from '@/lib/utils';

type CvParseImportSummaryPanelProps = {
  importSummary: CvParseImportSummary;
  onContinue?: () => void;
  continueLabel?: string;
  className?: string;
  /** When true, omit outer padding (panel lives inside a modal body). */
  embedded?: boolean;
};

function kindBadgeClass(kind: CvParseImportSummary['sections'][number]['kind']): string {
  if (kind === 'custom') {
    return 'border-[#00C9B1]/40 bg-[#00C9B1]/12 text-[#7ee8d8]';
  }
  if (kind === 'optional') return 'border-white/12 bg-white/[0.04] text-white/55';
  if (kind === 'links') return 'border-white/12 bg-white/[0.04] text-white/45';
  return 'border-white/10 bg-white/[0.03] text-white/50';
}

function kindBadgeLabel(kind: CvParseImportSummary['sections'][number]['kind']): string {
  if (kind === 'custom') return 'Custom';
  if (kind === 'core') return 'Core';
  return kind;
}

export function CvParseImportSummaryPanel({
  importSummary,
  onContinue,
  continueLabel = 'Open resume editor',
  className,
  embedded = false,
}: CvParseImportSummaryPanelProps) {
  const customCount = importSummary.sections.filter((s) => s.kind === 'custom').length;
  const message = displayResumeCopy(importSummary.message);
  const sectionCount = importSummary.sections.length;

  return (
    <div className={cn(!embedded && 'w-full', className)}>
      {!embedded ? (
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-[#00C9B1]" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-snug text-white">{message}</h3>
            {customCount > 0 ? (
              <p className="mt-2 text-sm text-white/50">
                {customCount === 1
                  ? 'One specialised section'
                  : `${customCount} specialised sections`}{' '}
                (e.g. Publications, Patents) were kept with their original headings.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-[#00C9B1]/15 bg-[#00C9B1]/5 px-3.5 py-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#00C9B1]" aria-hidden />
          <p className="text-sm leading-relaxed text-white/75">{message}</p>
        </div>
      )}

      {embedded ? (
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
          {sectionCount} section{sectionCount === 1 ? '' : 's'} imported
        </p>
      ) : null}

      {customCount > 0 && embedded ? (
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          {customCount === 1
            ? 'One specialised section'
            : `${customCount} specialised sections`}{' '}
          kept with original headings.
        </p>
      ) : null}

      <ul
        className={cn(
          'space-y-2',
          embedded ? 'mt-3' : 'app-scrollbar mt-5 max-h-[min(42vh,320px)] overflow-y-auto overscroll-contain pr-1',
        )}
        aria-label="Imported sections"
      >
        {importSummary.sections.map((row) => (
          <li
            key={`${row.type}-${row.label}`}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors',
              row.kind === 'custom'
                ? 'border-[#00C9B1]/30 bg-[#00C9B1]/8'
                : 'border-white/[0.08] bg-[#0a0e0e]/80',
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white/92">{row.label}</p>
              <span
                className={cn(
                  'mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  kindBadgeClass(row.kind),
                )}
              >
                {kindBadgeLabel(row.kind)}
              </span>
            </div>
            <span className="shrink-0 text-xs font-medium text-white/45">
              {itemCountLabel(row.itemCount)}
            </span>
          </li>
        ))}
      </ul>

      {onContinue ? (
        <div
          className={cn(
            'mt-6 flex justify-end border-t border-white/[0.08] pt-4',
            embedded && 'sticky bottom-0 bg-inherit',
          )}
        >
          <Button type="button" className="min-w-[10rem]" onClick={onContinue}>
            {continueLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
